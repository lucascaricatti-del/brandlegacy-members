import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import FinancialPlannerClient from '../FinancialPlannerClient'

interface Props {
  params: Promise<{ year: string }>
}

export default async function PlanejamentoFinanceiroYearPage({ params }: Props) {
  const { year: yearParam } = await params
  const year = parseInt(yearParam, 10)
  if (isNaN(year) || year < 2020 || year > 2040) redirect('/ferramentas/forecast')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = createAdminClient()

  const { data: membership } = await adminSupabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .single()

  if (!membership) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-16 text-center">
        <p className="text-text-muted">Nenhum workspace ativo encontrado.</p>
      </div>
    )
  }

  const workspaceId = membership.workspace_id

  // Get or create FINANCIAL plan
  const { data: existing } = await adminSupabase
    .from('media_plans')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('year', year)
    .eq('plan_type', 'financial')
    .single()

  let plan = existing
  if (!plan) {
    const { data: created, error: createError } = await adminSupabase
      .from('media_plans')
      .insert({
        workspace_id: workspaceId,
        year,
        plan_type: 'financial',
        created_by: user.id,
      })
      .select()
      .single()

    if (createError) {
      return (
        <div className="bg-bg-card border border-border rounded-xl p-16 text-center">
          <p className="text-error">{createError.message}</p>
        </div>
      )
    }
    plan = created
  }

  // Get financial metrics
  const { data: metrics } = await adminSupabase
    .from('media_plan_metrics')
    .select('*')
    .eq('media_plan_id', plan.id)
    .order('metric_key')
    .order('month')

  // Get ROAS Faturado from media plan (same workspace/year)
  let roasByMonth: Record<number, number> | undefined
  const { data: mediaPlan } = await adminSupabase
    .from('media_plans')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('year', year)
    .eq('plan_type', 'media')
    .single()

  if (mediaPlan) {
    const { data: roasMetrics } = await adminSupabase
      .from('media_plan_metrics')
      .select('month, value_numeric')
      .eq('media_plan_id', mediaPlan.id)
      .eq('metric_key', 'ROAS_BILLED')

    if (roasMetrics && roasMetrics.length > 0) {
      roasByMonth = {}
      for (const r of roasMetrics) {
        if (r.value_numeric) roasByMonth[r.month] = r.value_numeric
      }
    }
  }

  return (
    <FinancialPlannerClient
      planId={plan.id}
      workspaceId={workspaceId}
      year={year}
      initialMetrics={(metrics ?? []).map((m) => ({
        metric_key: m.metric_key,
        month: m.month,
        value_numeric: m.value_numeric,
        delta_pct: m.delta_pct,
        input_mode: m.input_mode,
        is_realizado: (m as any).is_realizado ?? false,
      }))}
    />
  )
}
