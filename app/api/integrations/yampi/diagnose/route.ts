import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWorkspaceAccess } from '@/lib/api-auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const ALIAS = 'denavita-vitaminas-e-suplementos-ltda'

const yampiHeaders = {
  'User-Token': process.env.YAMPI_TOKEN!,
  'User-Secret-Key': process.env.YAMPI_SECRET_KEY!,
  'Accept': 'application/json',
}

/**
 * Diagnose Yampi status mapping issues.
 * GET /api/integrations/yampi/diagnose?workspace_id=xxx
 *
 * Returns:
 * - db_status_counts: current status distribution in yampi_orders
 * - api_raw_aliases: first 100 raw status aliases from Yampi API
 * - sample_pending: 10 pending orders with revenue > 0 (the bug)
 */
export async function GET(req: NextRequest) {
  const workspace_id = req.nextUrl.searchParams.get('workspace_id')
  if (!workspace_id) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })

  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  // 1. Current status distribution in DB
  const { data: allOrders } = await supabase
    .from('yampi_orders')
    .select('status, revenue')
    .eq('workspace_id', workspace_id)

  const statusCounts: Record<string, { count: number; revenue: number }> = {}
  for (const o of allOrders ?? []) {
    const s = o.status || 'null'
    if (!statusCounts[s]) statusCounts[s] = { count: 0, revenue: 0 }
    statusCounts[s].count++
    statusCounts[s].revenue += Number(o.revenue || 0)
  }

  // 2. Fetch first 100 orders from Yampi API to see raw aliases
  const rawAliases: string[] = []
  try {
    const res = await fetch(
      `https://api.yampi.io/v2/${ALIAS}/orders?limit=100&page=1&include=items,transactions`,
      { headers: yampiHeaders, signal: AbortSignal.timeout(15000) },
    )
    if (res.ok) {
      const json = await res.json()
      for (const order of json.data || []) {
        rawAliases.push(order.status?.data?.alias ?? order.status_alias ?? 'unknown')
      }
    }
  } catch { /* ignore */ }

  const aliasDistribution: Record<string, number> = {}
  for (const a of rawAliases) {
    aliasDistribution[a] = (aliasDistribution[a] || 0) + 1
  }

  // 3. Sample pending orders with revenue > 0
  const { data: samplePending } = await supabase
    .from('yampi_orders')
    .select('order_id, date, status, revenue, payment_method')
    .eq('workspace_id', workspace_id)
    .eq('status', 'pending')
    .gt('revenue', 0)
    .order('revenue', { ascending: false })
    .limit(10)

  return NextResponse.json({
    db_status_counts: statusCounts,
    api_raw_aliases_sample: aliasDistribution,
    sample_pending_with_revenue: samplePending,
    total_orders: allOrders?.length ?? 0,
  })
}
