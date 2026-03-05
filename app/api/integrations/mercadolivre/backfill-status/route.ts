import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest) {
  const workspace_id = req.nextUrl.searchParams.get('workspace_id')
  if (!workspace_id) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })

  // Fetch all orders grouped by month
  const { data: orders, error } = await (adminSupabase as any)
    .from('ml_orders')
    .select('date, revenue, ml_commission, frete_custo, net_revenue_full')
    .eq('workspace_id', workspace_id)
    .order('date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Aggregate by month in JS (Supabase REST doesn't support DATE_TRUNC)
  const monthMap = new Map<string, {
    total_orders: number
    orders_with_fees: number
    orders_missing_fees: number
    total_revenue: number
    total_commission: number
    total_frete: number
    total_net: number
  }>()

  for (const o of (orders || [])) {
    const month = (o.date || '').slice(0, 7) // YYYY-MM
    if (!month) continue

    const entry = monthMap.get(month) ?? {
      total_orders: 0,
      orders_with_fees: 0,
      orders_missing_fees: 0,
      total_revenue: 0,
      total_commission: 0,
      total_frete: 0,
      total_net: 0,
    }

    entry.total_orders++
    const commission = Number(o.ml_commission || 0)
    if (commission > 0) {
      entry.orders_with_fees++
    } else {
      entry.orders_missing_fees++
    }
    entry.total_revenue += Number(o.revenue || 0)
    entry.total_commission += commission
    entry.total_frete += Number(o.frete_custo || 0)
    entry.total_net += Number(o.net_revenue_full || 0)

    monthMap.set(month, entry)
  }

  const months = Array.from(monthMap.entries())
    .map(([month, stats]) => ({
      month,
      ...stats,
      total_revenue: Math.round(stats.total_revenue * 100) / 100,
      total_commission: Math.round(stats.total_commission * 100) / 100,
      total_frete: Math.round(stats.total_frete * 100) / 100,
      total_net: Math.round(stats.total_net * 100) / 100,
      fee_coverage: stats.total_orders > 0
        ? `${Math.round((stats.orders_with_fees / stats.total_orders) * 100)}%`
        : '0%',
    }))
    .sort((a, b) => b.month.localeCompare(a.month))

  return NextResponse.json({ workspace_id, months })
}
