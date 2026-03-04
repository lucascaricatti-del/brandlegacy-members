import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMlToken } from '@/lib/ml-token'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  const { workspace_id, days } = await req.json()

  if (!workspace_id) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
  }

  const syncDays = days || 30
  const dateFrom = new Date(Date.now() - syncDays * 86400000).toISOString()

  try {
    const accessToken = await getMlToken(workspace_id)

    // Get seller_id from integration
    const { data: integration } = await (adminSupabase as any)
      .from('workspace_integrations')
      .select('metadata')
      .eq('workspace_id', workspace_id)
      .eq('provider', 'mercadolivre')
      .eq('status', 'active')
      .single()

    if (!integration?.metadata?.seller_id) {
      return NextResponse.json({ error: 'Seller ID not found' }, { status: 404 })
    }

    const sellerId = integration.metadata.seller_id

    // Paginate orders
    const allOrders: any[] = []
    let offset = 0
    const limit = 50
    const MAX_RESULTS = 5000

    while (offset < MAX_RESULTS) {
      const url =
        `https://api.mercadolibre.com/orders/search?seller=${sellerId}` +
        `&order.date_created.from=${dateFrom}` +
        `&sort=date_desc&limit=${limit}&offset=${offset}`

      const res: Response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(15000),
      })

      if (!res.ok) {
        const errText = await res.text()
        console.error(`[ml/sync] orders page offset=${offset} error:`, res.status, errText)
        break
      }

      const json = await res.json()
      const orders = json.results || []
      allOrders.push(...orders)

      console.log(`[ml/sync] offset=${offset}: ${orders.length} orders, total: ${allOrders.length}`)

      const total = json.paging?.total ?? 0
      if (offset + limit >= total || orders.length === 0) break
      offset += limit
    }

    // Parse and enrich orders
    const orderRows = []

    for (const order of allOrders) {
      // Fetch billing_info for fees
      let marketplaceFee = 0
      let shippingCost = 0

      try {
        if (order.id) {
          const billingRes: Response = await fetch(
            `https://api.mercadolibre.com/orders/${order.id}/billing_info`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              signal: AbortSignal.timeout(10000),
            }
          )
          if (billingRes.ok) {
            const billing = await billingRes.json()
            const charges = billing.charges || []
            for (const charge of charges) {
              if (charge.name === 'marketplace_fee' || charge.type === 'marketplace_fee') {
                marketplaceFee += Math.abs(Number(charge.amount || 0))
              }
              if (charge.name === 'shipping' || charge.type === 'shipping') {
                shippingCost += Math.abs(Number(charge.amount || 0))
              }
            }
          }
        }
      } catch {
        // billing_info may not be available for all orders
      }

      const revenue = Number(order.total_amount || 0)
      const netRevenue = revenue - marketplaceFee - shippingCost

      const createdAt = order.date_created || ''
      const date = createdAt.split('T')[0] || ''

      const items = (order.order_items || []).map((item: any) => ({
        item_id: String(item.item?.id || ''),
        title: item.item?.title || '',
        quantity: Number(item.quantity || 1),
        unit_price: Number(item.unit_price || 0),
        sku: item.item?.seller_sku || null,
      }))

      const payment = order.payments?.[0] || {}

      orderRows.push({
        workspace_id,
        order_id: String(order.id),
        date,
        status: order.status || 'unknown',
        revenue,
        shipping_cost: shippingCost,
        marketplace_fee: marketplaceFee,
        net_revenue: netRevenue,
        payment_method: payment.payment_method_id || null,
        payment_status: payment.status || null,
        buyer_id: String(order.buyer?.id || ''),
        buyer_nickname: order.buyer?.nickname || '',
        items,
        shipping_id: order.shipping?.id ? String(order.shipping.id) : null,
        currency: order.currency_id || 'BRL',
        synced_at: new Date().toISOString(),
      })
    }

    // Upsert in batches
    let synced = 0
    if (orderRows.length > 0) {
      for (let i = 0; i < orderRows.length; i += 200) {
        const batch = orderRows.slice(i, i + 200)
        const { error: upsertErr } = await (adminSupabase as any)
          .from('ml_orders')
          .upsert(batch, { onConflict: 'workspace_id,order_id' })
        if (upsertErr) {
          console.error('[ml/sync] upsert error:', upsertErr.message)
        } else {
          synced += batch.length
        }
      }
    }

    return NextResponse.json({
      synced,
      total_orders: allOrders.length,
      days: syncDays,
    })
  } catch (err: any) {
    console.error('[ml/sync] error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
