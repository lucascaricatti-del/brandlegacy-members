import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import MetricsClient from './MetricsClient'

export const metadata = { title: 'Métricas — BrandLegacy' }

export default async function MetricasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = createAdminClient()

  // Busca workspace ativo
  const { data: memberships } = await adminSupabase
    .from('workspace_members')
    .select('workspace_id, workspaces(id, name)')
    .eq('user_id', user.id)
    .eq('is_active', true)

  type WsMembership = {
    workspace_id: string
    workspaces: { id: string; name: string } | null
  }

  const workspaces = ((memberships ?? []) as unknown as WsMembership[])
    .map((m) => m.workspaces)
    .filter(Boolean) as { id: string; name: string }[]

  if (workspaces.length === 0) {
    return (
      <div className="animate-fade-in">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-primary">Métricas</h1>
          <p className="text-text-secondary mt-1">Dashboard de performance das suas plataformas.</p>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-16 text-center">
          <p className="text-text-muted">Você ainda não está vinculado a um workspace.</p>
        </div>
      </div>
    )
  }

  const ws = workspaces[0]

  // Busca integrações ativas
  const { data: integrations } = await adminSupabase
    .from('integrations')
    .select('platform, is_active')
    .eq('workspace_id', ws.id)
    .eq('is_active', true)

  const connectedPlatforms = (integrations ?? []).map((i) => i.platform as string)

  // Busca métricas dos últimos 90 dias (cobre todos os períodos possíveis)
  const since = new Date()
  since.setDate(since.getDate() - 90)
  const sinceStr = since.toISOString().split('T')[0]

  const { data: metrics } = await adminSupabase
    .from('integration_metrics')
    .select('*')
    .eq('workspace_id', ws.id)
    .gte('metric_date', sinceStr)
    .order('metric_date', { ascending: true })

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Métricas</h1>
        <p className="text-text-secondary mt-1">Dashboard de performance das suas plataformas conectadas.</p>
      </div>
      <MetricsClient
        connectedPlatforms={connectedPlatforms}
        metrics={(metrics ?? []) as Array<{
          id: string
          platform: string
          metric_date: string
          data: Record<string, number>
        }>}
      />
    </div>
  )
}
