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
          <p className="text-text-secondary mt-1">Dashboard de performance.</p>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-16 text-center">
          <p className="text-text-muted">Você ainda não está vinculado a um workspace.</p>
        </div>
      </div>
    )
  }

  const ws = workspaces[0]

  // Busca integração Meta ativa
  const { data: metaIntegration } = await (adminSupabase as any)
    .from('workspace_integrations')
    .select('status, account_id, account_name')
    .eq('workspace_id', ws.id)
    .eq('provider', 'meta_ads')
    .eq('status', 'active')
    .single()

  // Busca integração Google ativa
  const { data: googleIntegration } = await (adminSupabase as any)
    .from('workspace_integrations')
    .select('status, account_id, account_name')
    .eq('workspace_id', ws.id)
    .eq('provider', 'google_ads')
    .eq('status', 'active')
    .single()

  const isMetaConnected = !!metaIntegration?.account_id
  const isGoogleConnected = !!googleIntegration?.account_id

  // Busca 180 dias de ads_metrics separado por provider
  const since = new Date()
  since.setDate(since.getDate() - 180)
  const sinceStr = since.toISOString().split('T')[0]

  const [{ data: metaMetrics }, { data: googleMetrics }] = await Promise.all([
    (adminSupabase as any)
      .from('ads_metrics')
      .select('*')
      .eq('workspace_id', ws.id)
      .eq('provider', 'meta_ads')
      .gte('date', sinceStr)
      .order('date', { ascending: true }),
    (adminSupabase as any)
      .from('ads_metrics')
      .select('*')
      .eq('workspace_id', ws.id)
      .eq('provider', 'google_ads')
      .gte('date', sinceStr)
      .order('date', { ascending: true }),
  ])

  const accountNames = [...new Set(
    [metaIntegration?.account_name, googleIntegration?.account_name]
      .filter((name): name is string => !!name && name !== ws.name)
  )].join(' · ')

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Métricas</h1>
        <p className="text-text-secondary mt-1">
          Dashboard de performance — {ws.name}
          {accountNames && ` · ${accountNames}`}
        </p>
      </div>
      <MetricsClient
        workspaceId={ws.id}
        isMetaConnected={isMetaConnected}
        isGoogleConnected={isGoogleConnected}
        metaMetrics={(metaMetrics ?? []) as any[]}
        googleMetrics={(googleMetrics ?? []) as any[]}
      />
    </div>
  )
}
