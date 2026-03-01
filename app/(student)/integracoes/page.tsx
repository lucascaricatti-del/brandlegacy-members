import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import IntegrationsClient from './IntegrationsClient'

export const metadata = { title: 'Integrações — BrandLegacy' }

export default async function IntegracoesPage() {
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

  // Busca integrações de workspace_integrations
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
