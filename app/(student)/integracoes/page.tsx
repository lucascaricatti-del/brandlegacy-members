import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveWorkspace } from '@/lib/resolve-workspace'
import IntegrationsClient from './IntegrationsClient'

export const metadata = { title: 'Integrações — BrandLegacy' }

export default async function IntegracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = createAdminClient()

  const resolvedWs = await resolveWorkspace(user.id)
  const workspaces = resolvedWs ? [{ id: resolvedWs.id, name: resolvedWs.name }] : []

  if (workspaces.length === 0) {
    return (
      <div className="animate-fade-in">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-primary">Integrações</h1>
          <p className="text-text-secondary mt-1">Conecte suas plataformas de marketing e vendas.</p>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-16 text-center">
          <p className="text-text-muted">Você ainda não está vinculado a um workspace.</p>
        </div>
      </div>
    )
  }

  const ws = workspaces[0]

  // Busca todas as integrações (ads + marketplaces)
  const { data: integrations } = await (adminSupabase as any)
    .from('workspace_integrations')
    .select('id, workspace_id, provider, account_id, account_name, status, metadata, updated_at')
    .eq('workspace_id', ws.id)

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Integrações</h1>
        <p className="text-text-secondary mt-1">
          Conecte suas plataformas para visualizar métricas e alimentar seus agentes IA.
        </p>
      </div>
      <IntegrationsClient
        workspaceId={ws.id}
        integrations={(integrations ?? []) as any[]}
      />
    </div>
  )
}
