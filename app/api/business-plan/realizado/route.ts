import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWorkspaceAccess } from '@/lib/api-auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// Simple in-memory cache: Map key = workspace_year, TTL = 5 minutes
const cache = new Map<string, { data: Record<string, MonthRealizado>; ts: number }>()
const CACHE_TTL = 5 * 60 * 1000

interface MonthRealizado {
  receita_captada: number
  receita_faturada: number
  pedidos_captados: number
  pedidos_faturados: number
  ticket_medio: number
  meta_spend: number
  google_spend: number
  influencer_spend: number
  investimento_total: number
  ga4_sessions: number
  organic_sessions: number
  paid_sessions: number
  roas: number
  cac: number
}

const EMPTY_MONTH: MonthRealizado = {
  receita_captada: 0, receita_faturada: 0, pedidos_captados: 0, pedidos_faturados: 0,
  ticket_medio: 0, meta_spend: 0, google_spend: 0, influencer_spend: 0,
  investimento_total: 0, ga4_sessions: 0, organic_sessions: 0, paid_sessions: 0,
  roas: 0, cac: 0,
}

const PAID_STATUSES = ['paid', 'invoiced', 'shipped', 'delivered']

export async function POST(req: Request) {
  const { workspace_id, year } = await req.json()

  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!year) return NextResponse.json({ error: 'year required' }, { status: 400 })

  // Check cache
  const cacheKey = `${workspace_id}_${year}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data)
  }

  const dateFrom = `${year}-01-01`
  const dateTo = `${year}-12-31`

  // Parallel queries
  const [yampiRes, adsRes, ga4Res, seqRes] = await Promise.all([
    // Yampi orders grouped by month
    supabase
      .from('yampi_orders')
      .select('date, status, revenue, payment_method')
      .eq('workspace_id', workspace_id)
      .gte('date', dateFrom)
      .lte('date', dateTo),

    // Ads metrics grouped by month
    supabase
      .from('ads_metrics')
      .select('date, provider, spend')
      .eq('workspace_id', workspace_id)
      .gte('date', dateFrom)
      .lte('date', dateTo),

    // GA4 metrics
    supabase
      .from('ga4_metrics')
      .select('date, sessions, organic_sessions, paid_sessions')
      .eq('workspace_id', workspace_id)
      .gte('date', dateFrom)
      .lte('date', dateTo),

    // Influencer sequence costs
    supabase
      .from('influencer_sequences')
      .select('scheduled_date, cost')
      .eq('workspace_id', workspace_id)
      .gte('scheduled_date', dateFrom)
      .lte('scheduled_date', dateTo),
  ])

  // Initialize all 12 months
  const result: Record<string, MonthRealizado> = {}
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`
    result[key] = { ...EMPTY_MONTH }
  }

  // Process yampi orders
  if (yampiRes.data) {
    for (const order of yampiRes.data) {
      if (!order.date) continue
      const month = new Date(order.date + 'T12:00:00').getMonth() + 1
      const key = `${year}-${String(month).padStart(2, '0')}`
      if (!result[key]) continue

      result[key].receita_captada += order.revenue ?? 0
      result[key].pedidos_captados += 1

      if (PAID_STATUSES.includes(order.status)) {
        result[key].receita_faturada += order.revenue ?? 0
        result[key].pedidos_faturados += 1
      }
    }
  }

  // Process ads metrics
  if (adsRes.data) {
    for (const row of adsRes.data) {
      if (!row.date) continue
      const month = new Date(row.date + 'T12:00:00').getMonth() + 1
      const key = `${year}-${String(month).padStart(2, '0')}`
      if (!result[key]) continue

      const spend = row.spend ?? 0
      if (row.provider === 'meta_ads') result[key].meta_spend += spend
      else if (row.provider === 'google_ads') result[key].google_spend += spend
    }
  }

  // Process GA4 metrics
  if (ga4Res.data) {
    for (const row of ga4Res.data) {
      if (!row.date) continue
      const month = new Date(row.date + 'T12:00:00').getMonth() + 1
      const key = `${year}-${String(month).padStart(2, '0')}`
      if (!result[key]) continue

      result[key].ga4_sessions += row.sessions ?? 0
      result[key].organic_sessions += row.organic_sessions ?? 0
      result[key].paid_sessions += row.paid_sessions ?? 0
    }
  }

  // Process influencer sequences
  if (seqRes.data) {
    for (const row of seqRes.data) {
      if (!row.scheduled_date || !row.cost) continue
      const month = new Date(row.scheduled_date + 'T12:00:00').getMonth() + 1
      const key = `${year}-${String(month).padStart(2, '0')}`
      if (!result[key]) continue

      result[key].influencer_spend += Number(row.cost) || 0
    }
  }

  // Compute derived metrics
  for (const key of Object.keys(result)) {
    const m = result[key]
    m.investimento_total = m.meta_spend + m.google_spend + m.influencer_spend
    m.ticket_medio = m.pedidos_faturados > 0 ? Math.round(m.receita_faturada / m.pedidos_faturados * 100) / 100 : 0
    m.roas = m.investimento_total > 0 ? Math.round(m.receita_faturada / m.investimento_total * 100) / 100 : 0
    m.cac = m.pedidos_faturados > 0 ? Math.round(m.investimento_total / m.pedidos_faturados * 100) / 100 : 0

    // Round all currency values
    m.receita_captada = Math.round(m.receita_captada * 100) / 100
    m.receita_faturada = Math.round(m.receita_faturada * 100) / 100
    m.meta_spend = Math.round(m.meta_spend * 100) / 100
    m.google_spend = Math.round(m.google_spend * 100) / 100
    m.influencer_spend = Math.round(m.influencer_spend * 100) / 100
    m.investimento_total = Math.round(m.investimento_total * 100) / 100
  }

  // Cache result
  cache.set(cacheKey, { data: result, ts: Date.now() })

  return NextResponse.json(result)
}
