import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const PAID_STATUSES = ['paid', 'invoiced', 'shipped', 'delivered']
const CANCELLED_STATUSES = ['cancelled', 'refused']

export async function POST(request: Request) {
  try {
    const { workspace_id } = await request.json()

    if (!workspace_id) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Fetch ALL yampi_orders for this workspace (paginated to avoid 1000-row limit)
    const allOrders: any[] = []
    let from = 0
    const PAGE_SIZE = 1000

    while (true) {
      const { data, error } = await supabase
        .from('yampi_orders')
        .select('date, status, payment_method, revenue')
        .eq('workspace_id', workspace_id)
        .range(from, from + PAGE_SIZE - 1)
        .order('date', { ascending: true })

      if (error) {
        console.error('[yampi/aggregate] fetch error:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      if (!data || data.length === 0) break
      allOrders.push(...data)
      if (data.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }

    if (allOrders.length === 0) {
      return NextResponse.json({ days_aggregated: 0, total_orders: 0 })
    }

    // Group by date — revenue/orders count ONLY paid statuses
    const dailyMap = new Map<string, {
      paid_revenue: number
      paid_count: number
      cancelled_count: number
      total_count: number
      pix_total: number
      pix_paid: number
    }>()

    for (const o of allOrders) {
      if (!o.date) continue
      const d = dailyMap.get(o.date) ?? {
        paid_revenue: 0, paid_count: 0,
        cancelled_count: 0, total_count: 0,
        pix_total: 0, pix_paid: 0,
      }

      d.total_count++

      const isPaid = PAID_STATUSES.includes(o.status)
      const isCancelled = CANCELLED_STATUSES.includes(o.status)

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

    // Build metric rows
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

    // Upsert in batches
    for (let i = 0; i < metricRows.length; i += 500) {
      const batch = metricRows.slice(i, i + 500)
      const { error: upsertErr } = await supabase
        .from('yampi_metrics')
        .upsert(batch, { onConflict: 'workspace_id,date' })
      if (upsertErr) {
        console.error('[yampi/aggregate] upsert error:', upsertErr.message)
      }
    }

    return NextResponse.json({
      days_aggregated: metricRows.length,
      total_orders: allOrders.length,
    })
  } catch (e: any) {
    console.error('[yampi/aggregate] error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
