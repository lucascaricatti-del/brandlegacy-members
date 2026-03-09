/**
 * Shared Yampi order parsing and metrics aggregation.
 * Single source of truth for status constants, order parsing, and daily metric calculation.
 */

export const PAID_STATUSES = ['paid', 'invoiced', 'shipped', 'delivered'] as const
export const CANCELLED_STATUSES = ['cancelled', 'refused', 'refunded'] as const

/**
 * Normalize a raw Yampi status alias to a consistent value.
 * - Paid statuses are kept as-is (paid, invoiced, shipped, delivered)
 * - Cancelled/refused/refunded → 'cancelled'
 * - Everything else → 'pending'
 */
export function normalizeStatus(rawStatus: string): string {
  if ((PAID_STATUSES as readonly string[]).includes(rawStatus)) return rawStatus
  if ((CANCELLED_STATUSES as readonly string[]).includes(rawStatus)) return 'cancelled'
  return 'pending'
}

export type ParsedYampiOrder = {
  workspace_id: string
  order_id: string
  date: string
  status: string
  payment_method: string | null
  coupon_code: string | null
  state: string | null
  revenue: number
  items: { product_id: string; name: string; quantity: number; price: number }[]
  free_shipping: boolean
  synced_at: string
}

/**
 * Parse a raw Yampi API order resource into a normalized row for yampi_orders.
 */
export function parseYampiOrder(resource: any, workspaceId: string): ParsedYampiOrder {
  const statusAlias = resource.status?.data?.alias ?? resource.status_alias ?? 'unknown'
  const createdAtRaw = resource.created_at?.date ?? resource.created_at ?? ''
  const date = typeof createdAtRaw === 'string'
    ? createdAtRaw.split(' ')[0].split('T')[0]
    : new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)

  return {
    workspace_id: workspaceId,
    order_id: String(resource.number ?? resource.id),
    date,
    status: normalizeStatus(statusAlias),
    payment_method: resource.transactions?.data?.[0]?.payment?.data?.alias ?? null,
    coupon_code: resource.promocode?.data?.code
      ?? resource.search?.data?.discount_names?.[0]
      ?? null,
    state: resource.shipping_address?.data?.state
      ?? resource.shipping_address?.data?.uf
      ?? null,
    revenue: Number(resource.value_total ?? 0),
    free_shipping: Number(resource.value_shipment ?? 1) === 0,
    items: (resource.items?.data ?? []).map((item: any) => ({
      product_id: String(item.product_id ?? item.id ?? ''),
      name: item.sku?.data?.title ?? item.item_sku ?? item.name ?? '',
      quantity: Number(item.quantity) || 1,
      price: Number(item.price) || 0,
    })),
    synced_at: new Date().toISOString(),
  }
}

export type DailyMetricRow = {
  workspace_id: string
  date: string
  revenue: number
  orders: number
  avg_ticket: number
  checkout_conversion: number
  pix_approval_rate: number
  cancellation_rate: number
  synced_at: string
}

/**
 * Aggregate an array of parsed orders into daily metric rows for yampi_metrics.
 * Uses PAID_STATUSES and CANCELLED_STATUSES consistently.
 */
export function aggregateOrdersToMetrics(
  orders: Pick<ParsedYampiOrder, 'date' | 'status' | 'revenue' | 'payment_method'>[],
  workspaceId: string,
): DailyMetricRow[] {
  const dailyMap = new Map<string, {
    paid_revenue: number
    paid_count: number
    cancelled_count: number
    total_count: number
    pix_total: number
    pix_paid: number
  }>()

  for (const o of orders) {
    if (!o.date) continue
    const d = dailyMap.get(o.date) ?? {
      paid_revenue: 0, paid_count: 0,
      cancelled_count: 0, total_count: 0,
      pix_total: 0, pix_paid: 0,
    }

    d.total_count++

    const isPaid = (PAID_STATUSES as readonly string[]).includes(o.status)
    const isCancelled = o.status === 'cancelled'

    if (isPaid) {
      d.paid_revenue += Number(o.revenue) || 0
      d.paid_count++
    } else if (isCancelled) {
      d.cancelled_count++
    }

    const pm = (o.payment_method ?? '').toLowerCase()
    if (pm === 'pix') {
      d.pix_total++
      if (isPaid) d.pix_paid++
    }

    dailyMap.set(o.date, d)
  }

  return Array.from(dailyMap.entries()).map(([date, d]) => ({
    workspace_id: workspaceId,
    date,
    revenue: d.paid_revenue,
    orders: d.paid_count,
    avg_ticket: d.paid_count > 0 ? d.paid_revenue / d.paid_count : 0,
    checkout_conversion: d.total_count > 0
      ? Math.round((d.paid_count / d.total_count) * 100 * 100) / 100
      : 0,
    pix_approval_rate: d.pix_total > 0
      ? Math.round((d.pix_paid / d.pix_total) * 100 * 100) / 100
      : 0,
    cancellation_rate: d.total_count > 0
      ? Math.round((d.cancelled_count / d.total_count) * 100 * 100) / 100
      : 0,
    synced_at: new Date().toISOString(),
  }))
}
