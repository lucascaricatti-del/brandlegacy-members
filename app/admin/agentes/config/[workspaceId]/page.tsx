import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AgentConfigClient from './AgentConfigClient'

interface Props {
  params: Promise<{ workspaceId: string }>
}

export default async function AdminAgentConfigPage({ params }: Props) {
  const { workspaceId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const adminSupabase = createAdminClient()

  const { data: workspace } = await adminSupabase
    .from('workspaces')
    .select('id, name')
    .eq('id', workspaceId)
    .single()

  if (!workspace) notFound()

  // Busca workspace context
  const { data: ctxRaw } = await adminSupabase
    .from('workspace_context')
    .select('*')
    .eq('workspace_id', workspaceId)
    .single()

  type RawContext = {
    business_type: string | null
    business_description: string | null
    monthly_revenue: string | null
    team_size: string | null
    main_goal: string | null
    main_challenge: string | null
    mentorship_stage: string | null
    extra_context: string | null
  } | null

  const context = ctxRaw as unknown as RawContext

  // Busca configs dos 4 agentes
  const { data: configsRaw } = await adminSupabase
    .from('agent_configs')
    .select('agent_type, system_prompt, is_active')
    .eq('workspace_id', workspaceId)

  type RawConfig = { agent_type: string; system_prompt: string; is_active: boolean }
  const configs = (configsRaw as unknown as RawConfig[] ?? [])
  const configMap: Record<string, { system_prompt: string; is_active: boolean }> = {}
  for (const c of configs) {
    configMap[c.agent_type] = { system_prompt: c.system_prompt, is_active: c.is_active }
  }

  return (
    <div className="animate-fade-in">
      <nav className="flex items-center gap-2 text-sm text-text-muted mb-6">
        <Link href="/admin/workspaces" className="hover:text-text-primary transition-colors">Empresas</Link>
        <span>/</span>
        <Link href={`/admin/workspaces/${workspaceId}`} className="hover:text-text-primary transition-colors">{workspace.name}</Link>
        <span>/</span>
        <span className="text-text-secondary">Config. Agentes</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Configuração dos Agentes IA</h1>
          <p className="text-sm text-text-muted">{workspace.name} — 4 agentes especializados</p>
        </div>
        <Link
          href={`/admin/workspaces/${workspaceId}`}
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Voltar
        </Link>
      </div>

      <AgentConfigClient
        workspaceId={workspaceId}
        context={context ? {
          business_type: context.business_type ?? '',
          business_description: context.business_description ?? '',
          monthly_revenue: context.monthly_revenue ?? '',
          team_size: context.team_size ?? '',
          main_goal: context.main_goal ?? '',
          main_challenge: context.main_challenge ?? '',
          mentorship_stage: context.mentorship_stage ?? 'inicio',
          extra_context: context.extra_context ?? '',
        } : null}
        agentConfigs={configMap}
      />
    </div>
  )
}
