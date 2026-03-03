import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    console.log('[YAMPI RAW PAYLOAD]', JSON.stringify(payload, null, 2))
    const resource = payload.resource
    if (!resource) return NextResponse.json({ received: true })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
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
    const order_id = String(resource.number)
    console.log('[YAMPI WEBHOOK] resource.created_at:', JSON.stringify(resource.created_at))
    const createdAt = typeof resource.created_at === 'string'
      ? resource.created_at
      : resource.created_at?.date ?? resource.created_at?.value ?? ''
    const date = createdAt.split('T')[0].split(' ')[0] || new Date().toLocaleDateString('sv-SE')
    const status = resource.status?.data?.alias ?? 'unknown'
    console.log('[YAMPI] transaction:', JSON.stringify(resource.transactions?.data?.[0]))
    const payment_method = (resource.transactions?.data?.[0]?.payment_method ?? null)?.toLowerCase() ?? null
    const coupon_code = resource.coupon?.data?.code ?? null
    const state = resource.shipping_address?.data?.state ?? null
    const revenue = parseFloat(String(resource.total_amount ?? '0').replace(',', '.')) || 0
    const items = (resource.items?.data ?? []).map((i: any) => ({
      product_id: i.product_id,
      name: i.name,
      quantity: i.quantity,
      price: i.unit_price
    }))

    // Upsert pedido
    await supabase.from('yampi_orders').upsert({
      workspace_id, order_id, date, status, payment_method,
      coupon_code, state, revenue, items
    }, { onConflict: 'workspace_id,order_id' })

    // Recalcula métricas do dia
    const { data: dayOrders } = await supabase
      .from('yampi_orders')
      .select('*')
      .eq('workspace_id', workspace_id)
      .eq('date', date)

    if (dayOrders) {
      const paid = dayOrders.filter(o => ['paid', 'invoiced', 'shipped', 'delivered'].includes(o.status))
      const cancelled = dayOrders.filter(o => ['cancelled', 'refused'].includes(o.status))
      const pix = dayOrders.filter(o => (o.payment_method ?? '').toLowerCase() === 'pix')
      const pix_paid = pix.filter(o => ['paid', 'invoiced', 'shipped', 'delivered'].includes(o.status))
      const revenue_total = paid.reduce((s: number, o: any) => s + Number(o.revenue), 0)
      const orders_count = paid.length
      const avg_ticket = orders_count > 0 ? revenue_total / orders_count : 0
      const checkout_conversion = dayOrders.length > 0 ? Math.round((paid.length / dayOrders.length) * 100 * 100) / 100 : 0
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
