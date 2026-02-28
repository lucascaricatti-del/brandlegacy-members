import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateMediaPlan, getMediaPlanMetrics } from '@/app/actions/media-plan'
import PlannerClient from '../PlannerClient'

interface Props {
  params: Promise<{ year: string }>
}

export default async function PlanejamentoMidiaYearPage({ params }: Props) {
  const { year: yearParam } = await params
  const year = parseInt(yearParam, 10)
  if (isNaN(year) || year < 2020 || year > 2040) redirect('/ferramentas/planejamento-midia')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = createAdminClient()

  // Get active workspace
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

  // Get or create plan for this year
  const planResult = await getOrCreateMediaPlan(workspaceId, year)
  if (planResult.error || !planResult.plan) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-16 text-center">
        <p className="text-error">{planResult.error ?? 'Erro ao carregar planejador'}</p>
      </div>
    )
  }

  // Get metrics
  const metricsResult = await getMediaPlanMetrics(planResult.plan.id, workspaceId)

  return (
    <PlannerClient
      planId={planResult.plan.id}
      workspaceId={workspaceId}
      year={year}
      initialMetrics={(metricsResult.metrics ?? []).map((m) => ({
        metric_key: m.metric_key,
        month: m.month,
        value_numeric: m.value_numeric,
        delta_pct: m.delta_pct,
        input_mode: m.input_mode,
      }))}
    />
  )
}
