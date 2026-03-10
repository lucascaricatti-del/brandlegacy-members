import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateMediaPlanAdmin, getMediaPlanMetricsAdmin } from '@/app/actions/media-plan'
import PlannerClient from '@/app/(student)/ferramentas/planejamento-midia/PlannerClient'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ year?: string }>
}

export default async function AdminPlannerPage({ params, searchParams }: Props) {
  const { id: workspaceId } = await params
  const { year: yearParam } = await searchParams

  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear()
  if (isNaN(year) || year < 2020 || year > 2040) redirect(`/admin/workspaces/${workspaceId}/planner`)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = createAdminClient()

  // Check workspace exists
  const { data: ws } = await adminSupabase
    .from('workspaces')
    .select('id, name')
    .eq('id', workspaceId)
    .single()

  if (!ws) notFound()

  // Get or create plan
  const planResult = await getOrCreateMediaPlanAdmin(workspaceId, year)
  if (planResult.error || !planResult.plan) {
    return (
      <div className="animate-fade-in">
        <p className="text-error">{planResult.error ?? 'Erro ao carregar planejador'}</p>
      </div>
    )
  }

  // Get metrics
  const metricsResult = await getMediaPlanMetricsAdmin(planResult.plan.id)

  return (
    <div className="animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-text-muted mb-6">
        <Link href="/admin/workspaces" className="hover:text-text-primary transition-colors">Empresas</Link>
        <span>/</span>
        <Link href={`/admin/workspaces/${workspaceId}`} className="hover:text-text-primary transition-colors">{ws.name}</Link>
        <span>/</span>
        <span className="text-text-secondary">Midia Plan</span>
      </nav>

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
        isAdmin
        initialMetadata={(planResult.plan as any).metadata ?? {}}
      />
    </div>
  )
}
