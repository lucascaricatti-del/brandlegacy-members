import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMlToken } from '@/lib/ml-token'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export const maxDuration = 300 // 5 min (Vercel Pro)

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function POST(req: NextRequest) {
  const { workspace_id, month, dry_run = false, limit = 200, force = false, start_offset = 0 } = await req.json()

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

    // ═══ PAGINATED FETCH: get orders missing fees (capped by limit) ═══
    const PAGE_SIZE = 100
    const maxOrders = Math.min(Number(limit) || 200, 500)
    let allOrders: any[] = []
    let offset = Number(start_offset) || 0
    let totalPages = 0

    while (allOrders.length < maxOrders) {
      const fetchSize = Math.min(PAGE_SIZE, maxOrders - allOrders.length)
      let query = (adminSupabase as any)
        .from('ml_orders')
        .select('order_id, revenue, shipping_id')
        .eq('workspace_id', workspace_id)
        .gte('date', dateFrom)
        .lte('date', dateTo)
        .neq('status', 'cancelled')
      if (!force) query = query.or('ml_commission.eq.0,ml_commission.is.null')
      const { data, error: queryErr } = await query
        .order('date', { ascending: true })
        .range(offset, offset + fetchSize - 1)

      if (queryErr) {
        return NextResponse.json({ error: `Query failed: ${queryErr.message}` }, { status: 500 })
      }

      const page = data || []
      allOrders.push(...page)
      totalPages++

      if (page.length < fetchSize) break
      offset += fetchSize
    }

    // Count total remaining (for progress tracking)
    let countQuery = (adminSupabase as any)
      .from('ml_orders')
      .select('order_id', { count: 'exact', head: true })
      .eq('workspace_id', workspace_id)
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .neq('status', 'cancelled')
    if (!force) countQuery = countQuery.or('ml_commission.eq.0,ml_commission.is.null')
    const { count: totalRemaining } = await countQuery

    console.log(`[ml/backfill] month=${month}, batch=${allOrders.length}/${totalRemaining ?? '?'}, dry_run=${dry_run}`)

    if (allOrders.length === 0) {
      return NextResponse.json({ month, total_pages: totalPages, processed: 0, updated: 0, skipped: 0, remaining: 0, errors: [], message: 'No orders need backfill' })
    }

    let updated = 0
    let skipped = 0
    const errors: { order_id: string; error: string }[] = []
    const preview: any[] = []

    // Process in batches of 10
    for (let b = 0; b < allOrders.length; b += 10) {
      const batch = allOrders.slice(b, b + 10)

      const enriched = await Promise.allSettled(
        batch.map(async (order: any) => {
          const orderId = order.order_id

          // Step 1: Fetch order from ML → get sale_fee + listing_type_id from order_items + shipping.id
          const orderRes = await fetch(`https://api.mercadolibre.com/orders/${orderId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(10000),
          })
          if (!orderRes.ok) throw new Error(`Order fetch ${orderRes.status}`)
          const orderData = await orderRes.json()

          // Extract commission from sale_fee (already includes fixed fee)
          let mlCommission = 0
          const orderItems = orderData.order_items || []
          for (const item of orderItems) {
            mlCommission += Number(item.sale_fee || 0)
          }

          // Step 2: Fetch shipment for frete_custo (net of discounts)
          const shippingId = orderData.shipping?.id
          let freteCusto = 0

          if (shippingId) {
            const shipRes = await fetch(`https://api.mercadolibre.com/shipments/${shippingId}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
              signal: AbortSignal.timeout(10000),
            })
            if (shipRes.ok) {
              const shipment = await shipRes.json()
              const baseCost = Number(shipment?.base_cost || 0)
              const loyalDiscount = Math.abs(Number(shipment?.cost_components?.loyal_discount || 0))
              const specialDiscount = Math.abs(Number(shipment?.cost_components?.special_discount || 0))
              freteCusto = Math.max(0, baseCost - loyalDiscount - specialDiscount)
            }
          }

          // Step 3: Calculate net revenue (no fixed fee — included in sale_fee)
          const revenue = Number(order.revenue || 0)
          const netRevenueFull = revenue - mlCommission - freteCusto

          return {
            order_id: orderId,
            revenue,
            ml_commission: Math.round(mlCommission * 100) / 100,
            frete_custo: Math.round(freteCusto * 100) / 100,
            net_revenue_full: Math.round(netRevenueFull * 100) / 100,
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
        if (data.ml_commission === 0 && data.frete_custo === 0) {
          skipped++
          continue
        }

        if (dry_run) {
          preview.push(data)
          updated++
        } else {
          const { error: updateErr } = await (adminSupabase as any)
            .from('ml_orders')
            .update({
              ml_commission: data.ml_commission,
              ml_fixed_fee: 0,
              ml_financing_fee: 0,
              frete_custo: data.frete_custo,
              net_revenue_full: data.net_revenue_full,
              marketplace_fee: data.ml_commission,
              net_revenue: data.revenue - data.ml_commission,
              shipping_cost: data.frete_custo,
            })
            .eq('workspace_id', workspace_id)
            .eq('order_id', orderId)

          if (updateErr) {
            errors.push({ order_id: orderId, error: updateErr.message })
          } else {
            updated++
          }
        }
      }

      // 500ms delay between batches
      if (b + 10 < allOrders.length) await delay(500)

      // Log progress every 100 orders
      if ((b + 10) % 100 === 0) {
        console.log(`[ml/backfill] progress: ${b + 10}/${allOrders.length} (updated=${updated}, skipped=${skipped}, errors=${errors.length})`)
      }
    }

    console.log(`[ml/backfill] done: month=${month}, processed=${allOrders.length}, updated=${updated}, skipped=${skipped}, errors=${errors.length}`)

    const remaining = force
      ? Math.max(0, (totalRemaining ?? 0) - (Number(start_offset) || 0) - allOrders.length)
      : Math.max(0, (totalRemaining ?? 0) - allOrders.length)
    const nextOffset = force ? (Number(start_offset) || 0) + allOrders.length : undefined

    return NextResponse.json({
      month,
      total_pages: totalPages,
      processed: allOrders.length,
      updated,
      skipped,
      remaining,
      ...(nextOffset !== undefined && { next_offset: nextOffset }),
      errors: errors.slice(0, 50),
      ...(dry_run && { dry_run: true, preview: preview.slice(0, 20) }),
    })
  } catch (err: any) {
    console.error('[ml/backfill] error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
