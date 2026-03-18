import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWorkspaceAccess } from '@/lib/api-auth'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type Period = 'today' | 'yesterday' | '7d' | 'month'

function toYMD(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}

function getDateRange(period: Period): { date_from: string; date_to: string } {
  const today = toYMD(new Date())
  if (period === 'today') return { date_from: today, date_to: today }
  if (period === 'yesterday') {
    const y = new Date(); y.setDate(y.getDate() - 1)
    return { date_from: toYMD(y), date_to: toYMD(y) }
  }
  if (period === 'month') return { date_from: today.slice(0, 7) + '-01', date_to: today }
  // 7d
  const since = new Date(); since.setDate(since.getDate() - 7)
  return { date_from: toYMD(since), date_to: today }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const workspace_id = searchParams.get('workspace_id')
  const period = (searchParams.get('period') || '7d') as Period

  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { date_from, date_to } = getDateRange(period)

  // 1. ML data from ml_orders (via existing RPC)
  const { data: mlData } = await (adminSupabase as any)
    .rpc('get_ml_metrics', {
      p_workspace_id: workspace_id,
      p_date_from: date_from,
      p_date_to: date_to,
    })

  // 2. Manual marketplaces from marketplace_manual_metrics
  const { data: manualRows, error: manualErr } = await (adminSupabase as any)
    .from('marketplace_manual_metrics')
    .select('*')
    .eq('workspace_id', workspace_id)
    .gte('date', date_from)
    .lte('date', date_to)

  if (manualErr) return NextResponse.json({ error: manualErr.message }, { status: 500 })

  // 3. Get tax config from workspace
  const { data: workspace } = await (adminSupabase as any)
    .from('workspaces')
    .select('marketplace_tax_config')
    .eq('id', workspace_id)
    .single()

  const taxConfig = workspace?.marketplace_tax_config || {}

  // 4. Aggregate manual data by marketplace
  const manualByMarketplace: Record<string, {
    revenue: number; orders: number; taxCost: number; shippingCost: number;
    adsInvestment: number; otherCosts: number
  }> = {}

  for (const row of (manualRows || [])) {
    const mk = row.marketplace
    if (!manualByMarketplace[mk]) {
      manualByMarketplace[mk] = { revenue: 0, orders: 0, taxCost: 0, shippingCost: 0, adsInvestment: 0, otherCosts: 0 }
    }
    const agg = manualByMarketplace[mk]
    const rev = Number(row.revenue || 0)
    const taxPct = Number(row.tax_rate_percent || 0)
    const shipPct = Number(row.shipping_rate_percent || 0)
    agg.revenue += rev
    agg.orders += Number(row.orders || 0)
    agg.taxCost += rev * (taxPct / 100)
    agg.shippingCost += rev * (shipPct / 100)
    agg.adsInvestment += Number(row.ads_investment || 0)
    agg.otherCosts += Number(row.other_costs || 0)
  }

  // 5. Build marketplace results
  const marketplaces: any[] = []

  // ML
  const mlRevenue = Number(mlData?.total_revenue || 0)
  const mlNet = Number(mlData?.total_net || 0)
  const mlOrders = Number(mlData?.total_orders || 0)
  marketplaces.push({
    marketplace: 'mercadolivre',
    grossRevenue: mlRevenue,
    netRevenue: mlNet,
    orders: mlOrders,
    avgTicket: mlOrders > 0 ? mlRevenue / mlOrders : 0,
    totalCosts: mlRevenue - mlNet,
    contributionMargin: mlRevenue > 0 ? (mlNet / mlRevenue) * 100 : 0,
    auto: true,
  })

  // Manual marketplaces
  const manualNames = ['shopee', 'magalu', 'netshoes', 'tiktok_shop']
  for (const mk of manualNames) {
    const agg = manualByMarketplace[mk]
    if (!agg) {
      marketplaces.push({
        marketplace: mk,
        grossRevenue: 0,
        netRevenue: 0,
        orders: 0,
        avgTicket: 0,
        totalCosts: 0,
        contributionMargin: 0,
        auto: false,
      })
      continue
    }
    const totalCosts = agg.taxCost + agg.shippingCost + agg.adsInvestment + agg.otherCosts
    const netRevenue = agg.revenue - totalCosts
    marketplaces.push({
      marketplace: mk,
      grossRevenue: agg.revenue,
      netRevenue,
      orders: agg.orders,
      avgTicket: agg.orders > 0 ? agg.revenue / agg.orders : 0,
      totalCosts,
      contributionMargin: agg.revenue > 0 ? (netRevenue / agg.revenue) * 100 : 0,
      auto: false,
    })
  }

  // 6. Totals
  const totals = marketplaces.reduce((acc, m) => ({
    grossRevenue: acc.grossRevenue + m.grossRevenue,
    netRevenue: acc.netRevenue + m.netRevenue,
    orders: acc.orders + m.orders,
    totalCosts: acc.totalCosts + m.totalCosts,
  }), { grossRevenue: 0, netRevenue: 0, orders: 0, totalCosts: 0 })

  return NextResponse.json({
    marketplaces,
    totals: {
      ...totals,
      avgTicket: totals.orders > 0 ? totals.grossRevenue / totals.orders : 0,
      contributionMargin: totals.grossRevenue > 0 ? (totals.netRevenue / totals.grossRevenue) * 100 : 0,
    },
    taxConfig,
    period,
    date_from,
    date_to,
  })
}
