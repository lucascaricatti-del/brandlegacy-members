import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ALIAS = 'denavita-vitaminas-e-suplementos-ltda'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const yampiHeaders = {
  'User-Token': process.env.YAMPI_TOKEN!,
  'User-Secret-Key': process.env.YAMPI_SECRET_KEY!,
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'User-Agent': 'BrandLegacy/1.0',
}

export async function POST(req: NextRequest) {
  const { workspace_id, date_from, date_to } = await req.json()

  if (!workspace_id) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
  }

  const { data: integration } = await (supabase as any)
    .from('workspace_integrations')
    .select('status')
    .eq('workspace_id', workspace_id)
    .eq('provider', 'yampi')
    .eq('status', 'active')
    .single()

  if (!integration) {
    return NextResponse.json({ error: 'Yampi not connected' }, { status: 404 })
  }

  const fallbackSince = new Date(Date.now() - 180 * 86400000)
  const since = date_from || fallbackSince.toLocaleDateString('sv-SE')
  const until = date_to || new Date().toLocaleDateString('sv-SE')

  console.log('[yampi/sync] workspace_id:', workspace_id, 'period:', since, '→', until)

  try {
    // ── 1. Fetch all orders paginated ──
    const allOrders: any[] = []
    let page = 1
    const MAX_PAGES = 200

    while (page <= MAX_PAGES) {
      const url =
        `https://api.yampi.io/v2/${ALIAS}/orders?limit=100&page=${page}` +
        `&created_at_gteq=${since}&created_at_lteq=${until}` +
        `&include=items,transactions`

      const res: Response = await fetch(url, {
        headers: yampiHeaders,
        signal: AbortSignal.timeout(15000),
      })

      if (!res.ok) {
        const errText = await res.text()
        console.error(`[yampi/sync] page ${page} error:`, res.status, errText)
        break
      }

      const json = await res.json()
      const orders = json.data || []
      allOrders.push(...orders)

      console.log(`[yampi/sync] page ${page}: ${orders.length} orders, total: ${allOrders.length}`)

      // Check if there are more pages
      const lastPage = json.meta?.pagination?.last_page ?? json.meta?.last_page ?? page
      if (page >= lastPage || orders.length === 0) break
      page++
    }

    // ── Guard: if API returned nothing, preserve existing metrics ──
    if (allOrders.length === 0) {
      console.warn('[yampi/sync] API returned 0 orders — skipping metrics update to preserve data')
      return NextResponse.json({
        synced: 0,
        total_orders: 0,
        period: { since, until },
        message: 'API unavailable or returned 0 orders — metrics preserved',
      })
    }

    // ── 2. Parse and upsert individual orders ──
    const orderRows = allOrders.map((order: any) => {
      const statusAlias = order.status?.data?.alias ?? order.status_alias ?? 'unknown'
      const paymentMethod = order.transactions?.data?.[0]?.payment?.data?.alias ?? null
      const couponCode = order.promocode?.data?.code ?? order.search?.data?.discount_names?.[0] ?? null
      const state = order.shipping_address?.data?.state ?? order.shipping_address?.data?.uf ?? null
      const createdAtRaw = order.created_at?.date ?? order.created_at ?? ''
      const date = typeof createdAtRaw === 'string' ? createdAtRaw.split(' ')[0].split('T')[0] : ''
      const free_shipping = Number(order.value_shipment ?? 1) === 0
      const items = (order.items?.data ?? []).map((item: any) => ({
        product_id: String(item.product_id ?? item.id ?? ''),
        name: item.sku?.data?.title ?? item.item_sku ?? item.name ?? '',
        quantity: Number(item.quantity) || 1,
        price: Number(item.price) || 0,
      }))

      return {
        workspace_id,
        order_id: String(order.number ?? order.id),
        date,
        status: statusAlias,
        payment_method: paymentMethod,
        coupon_code: couponCode,
        state,
        revenue: Number(order.value_total) || 0,
        items,
        free_shipping,
        synced_at: new Date().toISOString(),
      }
    })

    // Upsert orders in batches
    if (orderRows.length > 0) {
      for (let i = 0; i < orderRows.length; i += 200) {
        const batch = orderRows.slice(i, i + 200)
        const { error: upsertErr } = await (supabase as any)
          .from('yampi_orders')
          .upsert(batch, { onConflict: 'workspace_id,order_id' })
        if (upsertErr) {
          console.error(`[yampi/sync] upsert orders batch error:`, upsertErr.message)
        }
      }
    }

    // ── 3. Aggregate by day for yampi_metrics ──
    // Revenue/orders = ONLY paid statuses; pending does NOT count as revenue
    const CANCEL = ['cancelled', 'refused']
    const APPROVED = ['paid', 'invoiced', 'shipped', 'delivered']
    const dailyMap = new Map<string, {
      paid_revenue: number
      paid_count: number
      cancelled_count: number
      total_count: number
      pix_total: number
      pix_paid: number
    }>()

    for (const o of orderRows) {
      if (!o.date) continue
      const d = dailyMap.get(o.date) ?? {
        paid_revenue: 0, paid_count: 0,
        cancelled_count: 0, total_count: 0,
        pix_total: 0, pix_paid: 0,
      }

      d.total_count++

      if (APPROVED.includes(o.status)) {
        d.paid_revenue += o.revenue
        d.paid_count++
      } else if (CANCEL.includes(o.status)) {
        d.cancelled_count++
      }

      if (o.payment_method === 'pix') {
        d.pix_total++
        if (APPROVED.includes(o.status)) d.pix_paid++
      }

      dailyMap.set(o.date, d)
    }

    const metricRows = Array.from(dailyMap.entries()).map(([date, d]) => ({
      workspace_id,
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

    // Delete then insert metrics
    await (supabase as any)
      .from('yampi_metrics')
      .delete()
      .eq('workspace_id', workspace_id)
      .gte('date', since)
      .lte('date', until)

    if (metricRows.length > 0) {
      for (let i = 0; i < metricRows.length; i += 500) {
        const batch = metricRows.slice(i, i + 500)
        const { error: insertErr } = await (supabase as any)
          .from('yampi_metrics')
          .insert(batch)
        if (insertErr) {
          console.error(`[yampi/sync] insert metrics error:`, insertErr.message)
        }
      }
    }

    return NextResponse.json({
      synced: metricRows.length,
      total_orders: allOrders.length,
      period: { since, until },
    })
  } catch (err: any) {
    console.error('[yampi/sync] unexpected error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
