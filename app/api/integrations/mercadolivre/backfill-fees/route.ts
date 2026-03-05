import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMlToken } from '@/lib/ml-token'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function POST(req: NextRequest) {
  const { workspace_id, month, dry_run = false } = await req.json()

  if (!workspace_id) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month required in YYYY-MM format' }, { status: 400 })
  }

  const [yearStr, monthStr] = month.split('-')
  const year = parseInt(yearStr)
  const mon = parseInt(monthStr)
  const dateFrom = `${month}-01`
  const lastDay = new Date(year, mon, 0).getDate()
  const dateTo = `${month}-${String(lastDay).padStart(2, '0')}`

  try {
    const accessToken = await getMlToken(workspace_id)

    // Query orders missing fees
    const { data: orders, error: queryErr } = await (adminSupabase as any)
      .from('ml_orders')
      .select('order_id, revenue, ml_commission, frete_custo')
      .eq('workspace_id', workspace_id)
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .neq('status', 'cancelled')
      .or('ml_commission.eq.0,ml_commission.is.null')
      .order('date', { ascending: true })

    if (queryErr) {
      return NextResponse.json({ error: `Query failed: ${queryErr.message}` }, { status: 500 })
    }

    const toProcess = orders || []
    console.log(`[ml/backfill] month=${month}, orders_missing_fees=${toProcess.length}, dry_run=${dry_run}`)

    if (toProcess.length === 0) {
      return NextResponse.json({ month, processed: 0, updated: 0, skipped: 0, errors: [], message: 'No orders need backfill' })
    }

    let updated = 0
    let skipped = 0
    const errors: { order_id: string; error: string }[] = []
    const preview: any[] = []

    // Process in batches of 10
    for (let b = 0; b < toProcess.length; b += 10) {
      const batch = toProcess.slice(b, b + 10)

      const enriched = await Promise.allSettled(
        batch.map(async (order: any) => {
          const orderId = order.order_id

          // Step a: Fetch full order from ML to get payment_id and shipping_id
          const orderRes = await fetch(`https://api.mercadolibre.com/orders/${orderId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(10000),
          })
          if (!orderRes.ok) throw new Error(`Order fetch ${orderRes.status}`)
          const orderData = await orderRes.json()

          const paymentId = orderData.payments?.[0]?.id
          const shippingId = orderData.shipping?.id

          // Step b: Fetch payment and shipment in parallel
          const [paymentResult, shipmentResult] = await Promise.allSettled([
            paymentId
              ? fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
                  headers: { Authorization: `Bearer ${accessToken}` },
                  signal: AbortSignal.timeout(10000),
                }).then(r => r.ok ? r.json() : null)
              : Promise.resolve(null),
            shippingId
              ? fetch(`https://api.mercadolibre.com/shipments/${shippingId}`, {
                  headers: { Authorization: `Bearer ${accessToken}` },
                  signal: AbortSignal.timeout(10000),
                }).then(r => r.ok ? r.json() : null)
              : Promise.resolve(null),
          ])

          const payment = paymentResult.status === 'fulfilled' ? paymentResult.value : null
          const shipment = shipmentResult.status === 'fulfilled' ? shipmentResult.value : null

          // Step c: Extract commission
          let mlCommission = 0
          let mlFixedFee = 0
          const feeDetails: any[] = payment?.fee_details || []
          if (feeDetails.length > 0) {
            for (const fee of feeDetails) {
              const t = fee.type || ''
              const amount = Math.abs(Number(fee.amount || 0))
              if (t === 'mercadopago_fee' || t === 'ml_fee') mlCommission += amount
              else if (t === 'fixed_fee' || t === 'listing_fee') mlFixedFee += amount
            }
          } else if (payment?.transaction_details) {
            const td = payment.transaction_details
            if (td.net_received_amount != null && td.total_paid_amount != null) {
              mlCommission = Math.abs(Number(td.total_paid_amount) - Number(td.net_received_amount))
            }
          }

          // Fixed fee: R$6.00 per unit for Premium (gold_pro) listings
          if (mlFixedFee === 0) {
            const orderItems = orderData.order_items || []
            for (const item of orderItems) {
              const listingType = item.item?.listing_type_id || ''
              if (listingType === 'gold_pro') {
                mlFixedFee += 6.0 * (Number(item.quantity) || 1)
              }
            }
          }

          // Step d: Extract frete
          const freteCusto = Number(
            shipment?.shipping_option?.cost
            || shipment?.base_cost
            || shipment?.cost
            || 0
          )

          // Step e: Calculate net revenue
          const revenue = Number(order.revenue || 0)
          const totalFee = mlCommission + mlFixedFee
          const netRevenueFull = revenue - mlCommission - mlFixedFee - freteCusto

          return {
            order_id: orderId,
            revenue,
            ml_commission: mlCommission,
            ml_fixed_fee: mlFixedFee,
            frete_custo: freteCusto,
            net_revenue_full: netRevenueFull,
            marketplace_fee: totalFee,
            net_revenue: revenue - totalFee,
            shipping_cost: freteCusto,
          }
        })
      )

      // Process results
      for (let i = 0; i < batch.length; i++) {
        const result = enriched[i]
        const orderId = batch[i].order_id

        if (result.status === 'rejected') {
          errors.push({ order_id: orderId, error: result.reason?.message || 'Unknown error' })
          continue
        }

        const data = result.value
        if (data.ml_commission === 0 && data.ml_fixed_fee === 0 && data.frete_custo === 0) {
          skipped++
          continue
        }

        if (dry_run) {
          preview.push(data)
          updated++
        } else {
          const { error: upsertErr } = await (adminSupabase as any)
            .from('ml_orders')
            .update({
              ml_commission: data.ml_commission,
              ml_fixed_fee: data.ml_fixed_fee,
              ml_financing_fee: 0,
              frete_custo: data.frete_custo,
              net_revenue_full: data.net_revenue_full,
              marketplace_fee: data.marketplace_fee,
              net_revenue: data.net_revenue,
              shipping_cost: data.shipping_cost,
            })
            .eq('workspace_id', workspace_id)
            .eq('order_id', orderId)

          if (upsertErr) {
            errors.push({ order_id: orderId, error: upsertErr.message })
          } else {
            updated++
          }
        }
      }

      // 500ms delay between batches
      if (b + 10 < toProcess.length) await delay(500)
    }

    console.log(`[ml/backfill] done: month=${month}, processed=${toProcess.length}, updated=${updated}, skipped=${skipped}, errors=${errors.length}`)

    return NextResponse.json({
      month,
      processed: toProcess.length,
      updated,
      skipped,
      errors,
      ...(dry_run && { dry_run: true, preview: preview.slice(0, 20) }),
    })
  } catch (err: any) {
    console.error('[ml/backfill] error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
