import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { aggregateOrdersToMetrics } from '@/lib/yampi/parser'
import { verifyWorkspaceAccess } from '@/lib/api-auth'

export const maxDuration = 300 // 5 min (Vercel Pro)

export async function POST(request: Request) {
  try {
    const { workspace_id } = await request.json()

    if (!workspace_id) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
    }

    const auth = await verifyWorkspaceAccess(workspace_id)
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

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

    // Aggregate using shared function
    const metricRows = aggregateOrdersToMetrics(allOrders, workspace_id)

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
