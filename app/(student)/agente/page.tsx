import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function StudentAgentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = createAdminClient()

  // Detecta workspace do usuário
  const { data: memberships } = await adminSupabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)

  const workspaceId = memberships?.[0]?.workspace_id
  if (!workspaceId) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-xl font-bold text-text-primary mb-2">Meu Agente IA</h1>
        <p className="text-text-muted text-sm">Você não está vinculado a nenhum workspace.</p>
      </div>
    )
  }

  // Busca workspace
  const { data: workspace } = await adminSupabase
    .from('workspaces')
    .select('name')
    .eq('id', workspaceId)
    .single()

  // Busca contexto do negócio
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

  const ctx = ctxRaw as unknown as RawContext

  // Busca configs dos agentes ativos
  const { data: configsRaw } = await adminSupabase
    .from('agent_configs')
    .select('agent_type, is_active')
    .eq('workspace_id', workspaceId)

  type RawConfig = { agent_type: string; is_active: boolean }
  const configs = (configsRaw as unknown as RawConfig[] ?? [])
  const activeAgents = configs.filter((c) => c.is_active).map((c) => c.agent_type)

  // Busca últimas sessões completadas
  const { data: sessionsRaw } = await adminSupabase
    .from('sessions')
    .select('id, title, session_date, summary, status, agent_type, created_at')
    .eq('workspace_id', workspaceId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(5)

  type RawSession = {
    id: string
    title: string
    session_date: string | null
    summary: string | null
    status: string
    agent_type: string | null
    created_at: string
  }

  const sessions = (sessionsRaw as unknown as RawSession[] ?? [])

  const BUSINESS_TYPE_LABELS: Record<string, string> = {
    ecommerce: 'E-commerce',
    servicos: 'Serviços',
    saas: 'SaaS',
    infoproduto: 'Infoproduto',
    agencia: 'Agência',
    consultoria: 'Consultoria',
    varejo: 'Varejo',
    outro: 'Outro',
  }

  const REVENUE_LABELS: Record<string, string> = {
    ate_50k: 'Até R$ 50k',
    '50k_200k': 'R$ 50k - 200k',
    '200k_1m': 'R$ 200k - 1M',
    acima_1m: 'Acima de R$ 1M',
  }

  const AGENT_LABELS: Record<string, string> = {
    diagnostic: 'Diagnóstico',
    plan: 'Plano de Ação',
    mentoring: 'Mentoria',
  }

  const AGENT_COLORS: Record<string, string> = {
    diagnostic: 'text-purple-400 bg-purple-400/15',
    plan: 'text-blue-400 bg-blue-400/15',
    mentoring: 'text-brand-gold bg-brand-gold/15',
  }

  const STAGE_LABELS: Record<string, string> = {
    inicio: 'Início',
    diagnostico: 'Diagnóstico feito',
    plano_criado: 'Plano criado',
    execucao: 'Em execução',
    escala: 'Escala',
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-bold text-text-primary mb-1">Meu Agente IA</h1>
      <p className="text-sm text-text-muted mb-6">{workspace?.name}</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Context + Config card */}
        <div className="bg-bg-card border border-border rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-gold/15 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-gold">
                <path d="M12 2a4 4 0 0 0-4 4v6a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4z" />
                <path d="M12 18.5V22" /><path d="M7 22h10" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Agentes Ativos</h2>
              <p className="text-xs text-text-muted">
                {activeAgents.length > 0
                  ? activeAgents.map((a) => AGENT_LABELS[a] ?? a).join(', ')
                  : '3 agentes padrão (sem personalização)'
                }
              </p>
            </div>
          </div>

          {ctx && (
            <div>
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
                Contexto do Negócio
              </h3>
              <div className="space-y-1.5">
                {ctx.business_type && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-muted">Tipo</span>
                    <span className="text-text-primary">{BUSINESS_TYPE_LABELS[ctx.business_type] ?? ctx.business_type}</span>
                  </div>
                )}
                {ctx.business_description && (
                  <div className="text-sm">
                    <span className="text-text-muted block mb-0.5">Descrição</span>
                    <span className="text-text-secondary text-xs">{ctx.business_description}</span>
                  </div>
                )}
                {ctx.monthly_revenue && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-muted">Faturamento</span>
                    <span className="text-text-primary">{REVENUE_LABELS[ctx.monthly_revenue] ?? ctx.monthly_revenue}</span>
                  </div>
                )}
                {ctx.team_size && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-muted">Equipe</span>
                    <span className="text-text-primary">{ctx.team_size}</span>
                  </div>
                )}
                {ctx.main_goal && (
                  <div className="text-sm">
                    <span className="text-text-muted block mb-0.5">Objetivo</span>
                    <span className="text-text-secondary text-xs">{ctx.main_goal}</span>
                  </div>
                )}
                {ctx.main_challenge && (
                  <div className="text-sm">
                    <span className="text-text-muted block mb-0.5">Principal desafio</span>
                    <span className="text-text-secondary text-xs">{ctx.main_challenge}</span>
                  </div>
                )}
                {ctx.mentorship_stage && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-muted">Estágio</span>
                    <span className="text-text-primary">{STAGE_LABELS[ctx.mentorship_stage] ?? ctx.mentorship_stage}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {!ctx && (
            <p className="text-text-muted text-xs bg-bg-surface/50 p-3 rounded-lg">
              O contexto do negócio ainda não foi configurado pelo admin.
            </p>
          )}
        </div>

        {/* Recent sessions */}
        <div className="bg-bg-card border border-border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Últimas Análises</h2>

          {sessions.length === 0 ? (
            <p className="text-text-muted text-sm text-center py-6">
              Nenhuma análise realizada ainda.
            </p>
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => (
                <div key={s.id} className="bg-bg-surface/30 rounded-lg p-3 border border-border/50">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="text-sm font-medium text-text-primary truncate">{s.title}</h3>
                      {s.agent_type && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 ${AGENT_COLORS[s.agent_type] ?? ''}`}>
                          {AGENT_LABELS[s.agent_type] ?? s.agent_type}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-text-muted shrink-0 ml-2">
                      {s.session_date
                        ? new Date(s.session_date + 'T12:00:00').toLocaleDateString('pt-BR')
                        : new Date(s.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  {s.summary && (
                    <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">
                      {s.summary}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
