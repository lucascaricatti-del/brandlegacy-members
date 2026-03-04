import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AgentLogsClient from './AgentLogsClient'
import AgentMap from '@/components/admin/AgentMap'

export default async function AdminAgentesPage() {
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

  // Busca workspaces ativos com contexto e configs de agentes
  const { data: workspaces } = await adminSupabase
    .from('workspaces')
    .select('id, name, plan_type, is_active')
    .eq('is_active', true)
    .order('name')

  // Busca configs de agentes por workspace
  const { data: configsRaw } = await adminSupabase
    .from('agent_configs')
    .select('workspace_id, agent_type, is_active')

  type RawConfig = { workspace_id: string; agent_type: string; is_active: boolean }
  const configs = (configsRaw as unknown as RawConfig[] ?? [])
  const configsByWs: Record<string, string[]> = {}
  for (const c of configs) {
    if (!configsByWs[c.workspace_id]) configsByWs[c.workspace_id] = []
    configsByWs[c.workspace_id].push(c.agent_type)
  }

  // Busca contextos
  const { data: contextsRaw } = await adminSupabase
    .from('workspace_context')
    .select('workspace_id')

  type RawCtx = { workspace_id: string }
  const contextWsIds = new Set((contextsRaw as unknown as RawCtx[] ?? []).map((c) => c.workspace_id))

  // Busca logs
  const { data: logsRaw } = await adminSupabase
    .from('agent_logs')
    .select('*, workspaces:workspace_id(name)')
    .order('created_at', { ascending: false })
    .limit(100)

  type RawLog = {
    id: string
    workspace_id: string | null
    agent_type: string
    summary: string | null
    cards_found: number
    email_sent: boolean
    created_at: string
    workspaces: { name: string } | null
  }

  const logs = (logsRaw as unknown as RawLog[] ?? []).map((l) => ({
    id: l.id,
    workspace_name: l.workspaces?.name ?? 'N/A',
    agent_type: l.agent_type,
    summary: l.summary,
    cards_found: l.cards_found,
    email_sent: l.email_sent,
    created_at: l.created_at,
  }))

  const PLAN_LABELS: Record<string, string> = { free: 'Free', tracao: 'Tração', club: 'Club' }
  const PLAN_COLORS: Record<string, string> = {
    free: 'bg-bg-surface text-text-muted',
    tracao: 'bg-info/15 text-info',
    club: 'bg-brand-gold/15 text-brand-gold',
  }

  return (
    <div className="animate-fade-in">
      <AgentMap />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Agentes</h1>
          <p className="text-sm text-text-muted mt-1">
            Configure os agentes IA por empresa e monitore execuções
          </p>
        </div>
      </div>

      {/* Workspace list with config buttons */}
      <div className="bg-bg-card border border-border rounded-xl p-6 mb-6">
        <h2 className="font-semibold text-text-primary mb-4">Configuração por Empresa</h2>
        {(workspaces ?? []).length === 0 ? (
          <p className="text-text-muted text-sm text-center py-4">Nenhuma empresa ativa.</p>
        ) : (
          <div className="space-y-2">
            {(workspaces ?? []).map((ws) => {
              const agentCount = configsByWs[ws.id]?.length ?? 0
              const hasContext = contextWsIds.has(ws.id)
              return (
                <div
                  key={ws.id}
                  className="flex items-center justify-between gap-4 p-3 rounded-lg bg-bg-surface/50 border border-border/50 hover:bg-bg-surface transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-brand-gold/15 flex items-center justify-center text-sm font-bold text-brand-gold shrink-0">
                      {ws.name[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{ws.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PLAN_COLORS[ws.plan_type] ?? ''}`}>
                          {PLAN_LABELS[ws.plan_type] ?? ws.plan_type}
                        </span>
                        {hasContext && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-400/15 text-green-400 font-medium">
                            Contexto
                          </span>
                        )}
                        {agentCount > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-400/15 text-purple-400 font-medium">
                            {agentCount} agente{agentCount > 1 ? 's' : ''} custom
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/admin/agentes/config/${ws.id}`}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-brand-gold/10 text-brand-gold border border-brand-gold/20 hover:bg-brand-gold/20 transition-colors font-medium"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                    Configurar
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Agent logs */}
      <AgentLogsClient logs={logs} />
    </div>
  )
}
