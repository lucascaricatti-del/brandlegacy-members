import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWorkspaceAccess } from '@/lib/api-auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  const { workspace_id, date_from, date_to, include_goals } = await req.json()

  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!date_from || !date_to) return NextResponse.json({ error: 'date_from and date_to required' }, { status: 400 })

  // Fetch goals from media_plan_metrics for current month
  async function fetchGoals() {
    const now = new Date()
    const brNow = new Date(now.getTime() - 3 * 60 * 60 * 1000)
    const year = brNow.getUTCFullYear()
    const month = brNow.getUTCMonth() + 1
    const currentDay = brNow.getUTCDate()
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

    const { data: plan } = await supabase
      .from('media_plans')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('year', year)
      .eq('plan_type', 'media')
      .single()

    if (!plan) return null

    const { data: metrics } = await supabase
      .from('media_plan_metrics')
      .select('metric_key, value_numeric')
      .eq('media_plan_id', plan.id)
      .eq('month', month)
      .eq('is_realizado', false)
      .in('metric_key', ['RECEITA_META', 'SPEND_TOTAL', 'CPS', 'CR', 'AOV', 'ROAS_BILLED', 'SPEND_META', 'SPEND_GOOGLE', 'SPEND_INFLUENCER'])

    if (!metrics || metrics.length === 0) return null

    const m = new Map(metrics.map(r => [r.metric_key, Number(r.value_numeric) || 0]))
    const spendTotal = m.get('SPEND_TOTAL') || ((m.get('SPEND_META') ?? 0) + (m.get('SPEND_GOOGLE') ?? 0) + (m.get('SPEND_INFLUENCER') ?? 0))

    return {
      meta_receita: m.get('RECEITA_META') ?? 0,
      meta_investimento: spendTotal,
      meta_cps: m.get('CPS') ?? 0,
      meta_conversao: m.get('CR') ?? 0,
      meta_ticket: m.get('AOV') ?? 0,
      meta_roas: m.get('ROAS_BILLED') ?? 0,
      days_in_month: daysInMonth,
      current_day: currentDay,
    }
  }

  const [metricsRes, integrationsRes, goals] = await Promise.all([
    supabase.rpc('get_performance_metrics', {
      p_workspace_id: workspace_id,
      p_date_from: date_from,
      p_date_to: date_to,
    }),
    supabase
      .from('workspace_integrations')
      .select('provider, is_active, metadata, last_sync')
      .eq('workspace_id', workspace_id),
    include_goals ? fetchGoals() : Promise.resolve(undefined),
  ])

  if (metricsRes.error) return NextResponse.json({ error: metricsRes.error.message }, { status: 500 })

  return NextResponse.json({
    metrics: metricsRes.data,
    integrations: (integrationsRes.data ?? []).map((i: any) => ({
      provider: i.provider,
      is_active: i.is_active,
      has_ga4: i.provider === 'google_ads' && !!i.metadata?.ga4_property_id,
      last_sync: i.last_sync,
      last_ga4_sync: i.provider === 'google_ads' ? i.metadata?.last_ga4_sync ?? null : undefined,
    })),
    ...(goals ? { goals } : {}),
  })
}
