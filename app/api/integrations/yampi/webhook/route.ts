import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const PAID_STATUSES = ['paid', 'invoiced', 'shipped', 'delivered']
const CANCELLED_STATUSES = ['cancelled', 'refused']

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const resource = payload.resource
    if (!resource) return NextResponse.json({ received: true })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Busca workspace com integração yampi ativa
    const { data: integration } = await supabase
      .from('workspace_integrations')
      .select('workspace_id')
      .eq('provider', 'yampi')
      .eq('status', 'active')
      .single()

    if (!integration) return NextResponse.json({ received: true })

    const workspace_id = integration.workspace_id

    // ── Parse com campos corretos ──

    // Date
    const createdAtRaw = resource.created_at?.date ?? resource.created_at ?? ''
    const date = typeof createdAtRaw === 'string'
      ? createdAtRaw.split(' ')[0]
      : new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)

    // Order ID
    const order_id = String(resource.number)

    // Revenue
    const revenue = Number(resource.value_total ?? 0)

    // Status
    const statusAlias = resource.status?.data?.alias ?? 'unknown'
    const status = PAID_STATUSES.includes(statusAlias)
      ? statusAlias
      : CANCELLED_STATUSES.includes(statusAlias)
        ? 'cancelled'
        : 'pending'

    // Payment method
    const payment_method = resource.transactions?.data?.[0]?.payment?.data?.alias ?? null

    // Coupon
    const coupon_code = resource.promocode?.data?.code
      ?? resource.search?.data?.discount_names?.[0]
      ?? null

    // State
    const state = resource.shipping_address?.data?.state
      ?? resource.shipping_address?.data?.uf
      ?? null

    // Free shipping
    const free_shipping = Number(resource.value_shipment ?? 1) === 0

    // Items
    const items = (resource.items?.data ?? []).map((item: any) => ({
      product_id: item.product_id,
      name: item.sku?.data?.title ?? item.item_sku ?? '',
      quantity: Number(item.quantity),
      price: Number(item.price ?? 0),
    }))

    // Upsert pedido
    await supabase.from('yampi_orders').upsert({
      workspace_id, order_id, date, status, payment_method,
      coupon_code, state, revenue, items, free_shipping,
    }, { onConflict: 'workspace_id,order_id' })

    // Recalcula métricas do dia
    const { data: dayOrders } = await supabase
      .from('yampi_orders')
      .select('*')
      .eq('workspace_id', workspace_id)
      .eq('date', date)

    if (dayOrders) {
      // Revenue/orders = ONLY paid statuses; pending does NOT count as revenue
      const paid = dayOrders.filter(o => PAID_STATUSES.includes(o.status))
      const cancelled = dayOrders.filter(o => CANCELLED_STATUSES.includes(o.status))
      const pix = dayOrders.filter(o => (o.payment_method ?? '').toLowerCase() === 'pix')
      const pix_paid = pix.filter(o => PAID_STATUSES.includes(o.status))
      const revenue_total = paid.reduce((s: number, o: any) => s + Number(o.revenue), 0)
      const orders_count = paid.length
      const avg_ticket = orders_count > 0 ? revenue_total / orders_count : 0
      const checkout_conversion = dayOrders.length > 0 ? Math.round((orders_count / dayOrders.length) * 100 * 100) / 100 : 0
      const pix_approval_rate = pix.length > 0 ? Math.round((pix_paid.length / pix.length) * 100 * 100) / 100 : 0
      const cancellation_rate = dayOrders.length > 0 ? Math.round((cancelled.length / dayOrders.length) * 100 * 100) / 100 : 0

      await supabase.from('yampi_metrics').upsert({
        workspace_id, date, revenue: revenue_total, orders: orders_count,
        avg_ticket, checkout_conversion, pix_approval_rate, cancellation_rate,
        synced_at: new Date().toISOString(),
      }, { onConflict: 'workspace_id,date' })
    }

    return NextResponse.json({ received: true })
  } catch (e) {
    console.error('[yampi/webhook] error:', e)
    return NextResponse.json({ received: true })
  }
}
