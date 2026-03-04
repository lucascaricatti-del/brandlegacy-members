import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMlToken } from '@/lib/ml-token'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const { topic, resource, user_id } = payload

    console.log('[ml/webhook] received:', { topic, resource, user_id })

    if (!topic || !resource || !user_id) {
      return NextResponse.json({ ok: true })
    }

    // Find workspace by seller_id matching user_id
    const { data: integrations } = await (adminSupabase as any)
      .from('workspace_integrations')
      .select('workspace_id, metadata')
      .eq('provider', 'mercadolivre')
      .eq('status', 'active')

    const integration = (integrations || []).find(
      (i: any) => String(i.metadata?.seller_id) === String(user_id)
    )

    if (!integration) {
      console.log('[ml/webhook] no workspace found for user_id:', user_id)
      return NextResponse.json({ ok: true })
    }

    const workspaceId = integration.workspace_id

    // Handle orders_v2
    if (topic === 'orders_v2') {
      try {
        const accessToken = await getMlToken(workspaceId)

        // resource is like /orders/123456
        const orderId = resource.split('/').pop()
        const res: Response = await fetch(`https://api.mercadolibre.com/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(10000),
        })

        if (!res.ok) {
          console.error('[ml/webhook] fetch order error:', res.status)
          return NextResponse.json({ ok: true })
        }

        const order = await res.json()
        const createdAt = order.date_created || ''
        const date = createdAt.split('T')[0] || ''
        const revenue = Number(order.total_amount || 0)

        // Fetch billing_info
        let marketplaceFee = 0
        let shippingCost = 0
        try {
          const billingRes: Response = await fetch(
            `https://api.mercadolibre.com/orders/${orderId}/billing_info`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              signal: AbortSignal.timeout(10000),
            }
          )
          if (billingRes.ok) {
            const billing = await billingRes.json()
            for (const charge of billing.charges || []) {
              if (charge.name === 'marketplace_fee' || charge.type === 'marketplace_fee') {
                marketplaceFee += Math.abs(Number(charge.amount || 0))
              }
              if (charge.name === 'shipping' || charge.type === 'shipping') {
                shippingCost += Math.abs(Number(charge.amount || 0))
              }
            }
          }
        } catch {
          // billing may not be available
        }

        const items = (order.order_items || []).map((item: any) => ({
          item_id: String(item.item?.id || ''),
          title: item.item?.title || '',
          quantity: Number(item.quantity || 1),
          unit_price: Number(item.unit_price || 0),
          sku: item.item?.seller_sku || null,
        }))

        const payment = order.payments?.[0] || {}

        await (adminSupabase as any)
          .from('ml_orders')
          .upsert({
            workspace_id: workspaceId,
            order_id: String(order.id),
            date,
            status: order.status || 'unknown',
            revenue,
            shipping_cost: shippingCost,
            marketplace_fee: marketplaceFee,
            net_revenue: revenue - marketplaceFee - shippingCost,
            payment_method: payment.payment_method_id || null,
            payment_status: payment.status || null,
            buyer_id: String(order.buyer?.id || ''),
            buyer_nickname: order.buyer?.nickname || '',
            items,
            shipping_id: order.shipping?.id ? String(order.shipping.id) : null,
            currency: order.currency_id || 'BRL',
          }, { onConflict: 'workspace_id,order_id' })

        console.log('[ml/webhook] order upserted:', orderId)
      } catch (err: any) {
        console.error('[ml/webhook] order processing error:', err.message)
      }
    }

    // Handle claims
    if (topic === 'claims') {
      try {
        const accessToken = await getMlToken(workspaceId)

        const claimId = resource.split('/').pop()
        const res: Response = await fetch(`https://api.mercadolibre.com/claims/${claimId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(10000),
        })

        if (!res.ok) {
          console.error('[ml/webhook] fetch claim error:', res.status)
          return NextResponse.json({ ok: true })
        }

        const claim = await res.json()

        await (adminSupabase as any)
          .from('ml_claims')
          .upsert({
            workspace_id: workspaceId,
            claim_id: String(claim.id),
            order_id: claim.resource_id ? String(claim.resource_id) : null,
            type: claim.type || null,
            status: claim.status || null,
            reason: claim.reason_id || claim.reason || null,
            amount: Number(claim.players?.[0]?.amount || 0),
            resolution_type: claim.resolution?.reason || null,
            resolution_status: claim.resolution?.status || null,
            created_at_ml: claim.date_created || null,
          }, { onConflict: 'workspace_id,claim_id' })

        console.log('[ml/webhook] claim upserted:', claimId)
      } catch (err: any) {
        console.error('[ml/webhook] claim processing error:', err.message)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[ml/webhook] error:', e)
    return NextResponse.json({ ok: true })
  }
}
