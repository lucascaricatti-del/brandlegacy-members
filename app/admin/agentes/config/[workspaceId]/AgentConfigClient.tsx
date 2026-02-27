'use client'

import { useState, useTransition } from 'react'
import { saveWorkspaceContext, saveAgentConfig } from '@/app/actions/agents'
import { DEFAULT_PROMPTS } from '@/lib/constants/agents'

// ── Types ────────────────────────────────────────────────────

interface ContextData {
  business_type: string
  business_description: string
  monthly_revenue: string
  team_size: string
  main_goal: string
  main_challenge: string
  mentorship_stage: string
  extra_context: string
}

interface Props {
  workspaceId: string
  context: ContextData | null
  agentConfigs: Record<string, { system_prompt: string; is_active: boolean }>
}

// ── Options ──────────────────────────────────────────────────

const BUSINESS_TYPES = [
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'servicos', label: 'Serviços' },
  { value: 'saas', label: 'SaaS' },
  { value: 'infoproduto', label: 'Infoproduto' },
  { value: 'agencia', label: 'Agência' },
  { value: 'consultoria', label: 'Consultoria' },
  { value: 'varejo', label: 'Varejo' },
  { value: 'outro', label: 'Outro' },
]

const REVENUE_OPTIONS = [
  { value: 'ate_50k', label: 'Até R$ 50k' },
  { value: '50k_200k', label: 'R$ 50k - 200k' },
  { value: '200k_1m', label: 'R$ 200k - 1M' },
  { value: 'acima_1m', label: 'Acima de R$ 1M' },
]

const TEAM_OPTIONS = [
  { value: '1', label: 'Somente eu' },
  { value: '2-5', label: '2-5 pessoas' },
  { value: '6-15', label: '6-15 pessoas' },
  { value: '16-50', label: '16-50 pessoas' },
  { value: '50+', label: '50+ pessoas' },
]

const STAGE_OPTIONS = [
  { value: 'inicio', label: 'Início' },
  { value: 'diagnostico', label: 'Diagnóstico feito' },
  { value: 'plano_criado', label: 'Plano criado' },
  { value: 'execucao', label: 'Em execução' },
  { value: 'escala', label: 'Escala' },
]

const TABS = [
  { key: 'context', label: 'Contexto', icon: 'M12 2a4 4 0 0 0-4 4v1H5a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-3V6a4 4 0 0 0-4-4z' },
  { key: 'diagnostic', label: 'Diagnóstico', icon: 'M9 19V6l12-3v13' },
  { key: 'plan', label: 'Plano de Ação', icon: 'M9 11l3 3L22 4' },
  { key: 'mentoring', label: 'Mentoria', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' },
] as const

// ── Component ────────────────────────────────────────────────

export default function AgentConfigClient({ workspaceId, context, agentConfigs }: Props) {
  const [activeTab, setActiveTab] = useState<string>('context')

  // Context state
  const [businessType, setBusinessType] = useState(context?.business_type ?? '')
  const [businessDesc, setBusinessDesc] = useState(context?.business_description ?? '')
  const [revenue, setRevenue] = useState(context?.monthly_revenue ?? '')
  const [teamSize, setTeamSize] = useState(context?.team_size ?? '')
  const [mainGoal, setMainGoal] = useState(context?.main_goal ?? '')
  const [mainChallenge, setMainChallenge] = useState(context?.main_challenge ?? '')
  const [mentorshipStage, setMentorshipStage] = useState(context?.mentorship_stage ?? 'inicio')
  const [extraContext, setExtraContext] = useState(context?.extra_context ?? '')

  // Agent prompts (fallback '' para segurança caso DEFAULT_PROMPTS falhe)
  const [diagnosticPrompt, setDiagnosticPrompt] = useState(
    agentConfigs.diagnostic?.system_prompt ?? DEFAULT_PROMPTS?.diagnostic ?? ''
  )
  const [planPrompt, setPlanPrompt] = useState(
    agentConfigs.plan?.system_prompt ?? DEFAULT_PROMPTS?.plan ?? ''
  )
  const [mentoringPrompt, setMentoringPrompt] = useState(
    agentConfigs.mentoring?.system_prompt ?? DEFAULT_PROMPTS?.mentoring ?? ''
  )

  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  function handleSaveContext() {
    setFeedback(null)
    startTransition(async () => {
      const result = await saveWorkspaceContext(workspaceId, {
        business_type: businessType,
        business_description: businessDesc,
        monthly_revenue: revenue,
        team_size: teamSize,
        main_goal: mainGoal,
        main_challenge: mainChallenge,
        mentorship_stage: mentorshipStage,
        extra_context: extraContext,
      })
      if ('error' in result) {
        setFeedback({ type: 'error', message: result.error ?? 'Erro' })
      } else {
        setFeedback({ type: 'success', message: 'Contexto salvo!' })
      }
    })
  }

  function handleSaveAgent(agentType: string, prompt: string) {
    setFeedback(null)
    startTransition(async () => {
      const result = await saveAgentConfig(workspaceId, agentType, prompt)
      if ('error' in result) {
        setFeedback({ type: 'error', message: result.error ?? 'Erro' })
      } else {
        setFeedback({ type: 'success', message: 'Prompt do agente salvo!' })
      }
    })
  }

  function handleResetPrompt(agentType: string) {
    const defaultPrompt = DEFAULT_PROMPTS?.[agentType] ?? ''
    if (agentType === 'diagnostic') setDiagnosticPrompt(defaultPrompt)
    if (agentType === 'plan') setPlanPrompt(defaultPrompt)
    if (agentType === 'mentoring') setMentoringPrompt(defaultPrompt)
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-bg-card border border-border rounded-xl p-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setFeedback(null) }}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
              ${activeTab === tab.key
                ? 'bg-brand-gold/15 text-brand-gold'
                : 'text-text-muted hover:text-text-primary hover:bg-bg-surface/50'
              }
            `}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={tab.icon} />
            </svg>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm ${
          feedback.type === 'success'
            ? 'bg-green-400/10 border border-green-400/30 text-green-400'
            : 'bg-red-400/10 border border-red-400/30 text-red-400'
        }`}>
          {feedback.message}
        </div>
      )}

      {/* TAB: Context */}
      {activeTab === 'context' && (
        <section className="bg-bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-brand-gold/15 flex items-center justify-center text-brand-gold text-sm font-bold">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-text-primary">Contexto do Negócio</h2>
              <p className="text-xs text-text-muted">Informações injetadas automaticamente nos prompts dos 3 agentes via {'{{context}}'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-text-muted mb-1">Tipo de negócio</label>
              <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold/60">
                <option value="">Selecione...</option>
                {BUSINESS_TYPES.map((bt) => <option key={bt.value} value={bt.value}>{bt.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Faturamento mensal</label>
              <select value={revenue} onChange={(e) => setRevenue(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold/60">
                <option value="">Selecione...</option>
                {REVENUE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-text-muted mb-1">Descrição do negócio</label>
              <textarea value={businessDesc} onChange={(e) => setBusinessDesc(e.target.value)} rows={2} placeholder="Breve descrição do que a empresa faz..." className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold/60 placeholder:text-text-muted resize-y" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Tamanho da equipe</label>
              <select value={teamSize} onChange={(e) => setTeamSize(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold/60">
                <option value="">Selecione...</option>
                {TEAM_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Estágio da mentoria</label>
              <select value={mentorshipStage} onChange={(e) => setMentorshipStage(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold/60">
                {STAGE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Objetivo principal</label>
              <input value={mainGoal} onChange={(e) => setMainGoal(e.target.value)} placeholder="Ex: Dobrar faturamento em 6 meses" className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold/60 placeholder:text-text-muted" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Principal desafio</label>
              <input value={mainChallenge} onChange={(e) => setMainChallenge(e.target.value)} placeholder="Ex: Baixa conversão de leads" className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold/60 placeholder:text-text-muted" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-text-muted mb-1">Contexto extra (opcional)</label>
              <textarea value={extraContext} onChange={(e) => setExtraContext(e.target.value)} rows={2} placeholder="Informações adicionais relevantes..." className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold/60 placeholder:text-text-muted resize-y" />
            </div>
          </div>

          <button
            onClick={handleSaveContext}
            disabled={isPending}
            className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-gold text-bg-base text-sm font-medium hover:bg-brand-gold-light transition-colors disabled:opacity-60"
          >
            {isPending ? 'Salvando...' : 'Salvar Contexto'}
          </button>
        </section>
      )}

      {/* TAB: Agent prompts */}
      {(activeTab === 'diagnostic' || activeTab === 'plan' || activeTab === 'mentoring') && (
        <AgentPromptEditor
          agentType={activeTab}
          label={TABS.find((t) => t.key === activeTab)?.label ?? ''}
          prompt={activeTab === 'diagnostic' ? diagnosticPrompt : activeTab === 'plan' ? planPrompt : mentoringPrompt}
          setPrompt={activeTab === 'diagnostic' ? setDiagnosticPrompt : activeTab === 'plan' ? setPlanPrompt : setMentoringPrompt}
          onSave={() => handleSaveAgent(
            activeTab,
            activeTab === 'diagnostic' ? diagnosticPrompt : activeTab === 'plan' ? planPrompt : mentoringPrompt,
          )}
          onReset={() => handleResetPrompt(activeTab)}
          isPending={isPending}
          hasCustomConfig={!!agentConfigs[activeTab]}
        />
      )}
    </div>
  )
}

// ── Agent Prompt Editor sub-component ────────────────────────

function AgentPromptEditor({
  agentType,
  label,
  prompt = '',
  setPrompt,
  onSave,
  onReset,
  isPending,
  hasCustomConfig,
}: {
  agentType: string
  label: string
  prompt: string
  setPrompt: (v: string) => void
  onSave: () => void
  onReset: () => void
  isPending: boolean
  hasCustomConfig: boolean
}) {
  const safePrompt = prompt ?? ''
  const estimatedTokens = Math.ceil(safePrompt.length / 4)

  const descriptions: Record<string, string> = {
    diagnostic: 'Analisa reuniões de diagnóstico. Gera relatório executivo com pontos fortes, gargalos, oportunidades e riscos. NÃO gera tarefas.',
    plan: 'Cria plano de ação a partir de reuniões. Gera tarefas priorizadas (urgente/alta/média/baixa) sem limite de quantidade. Pode usar diagnóstico anterior.',
    mentoring: 'Analisa reuniões de acompanhamento. Extrai todas as tarefas discutidas com priorização e sugere tópicos para próxima sessão.',
  }

  return (
    <section className="bg-bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-gold/15 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-gold">
              <path d="M12 2a4 4 0 0 0-4 4v6a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4z" />
              <path d="M12 18.5V22" /><path d="M7 22h10" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-text-primary">Agente: {label}</h2>
            <p className="text-xs text-text-muted">{descriptions[agentType]}</p>
          </div>
        </div>
        {hasCustomConfig && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-gold/15 text-brand-gold font-medium">
            Customizado
          </span>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-text-muted font-medium">System Prompt</label>
            <span className="text-[10px] text-text-muted">~{estimatedTokens.toLocaleString()} tokens</span>
          </div>
          <textarea
            value={safePrompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={16}
            className="w-full px-4 py-3 rounded-lg bg-bg-base border border-border text-text-primary text-sm font-mono leading-relaxed focus:outline-none focus:border-brand-gold/60 placeholder:text-text-muted resize-y"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onSave}
            disabled={isPending || !safePrompt.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-gold text-bg-base text-sm font-medium hover:bg-brand-gold-light transition-colors disabled:opacity-60"
          >
            {isPending ? 'Salvando...' : 'Salvar Prompt'}
          </button>
          <button
            onClick={onReset}
            disabled={isPending}
            className="px-4 py-2.5 rounded-xl text-text-muted hover:text-text-primary text-sm transition-colors border border-border hover:border-border-light"
          >
            Restaurar Padrão
          </button>
        </div>

        <p className="text-[10px] text-text-muted">
          Variáveis disponíveis: <code className="bg-bg-surface px-1 py-0.5 rounded">{'{{context}}'}</code>
          {agentType === 'plan' && (
            <> e <code className="bg-bg-surface px-1 py-0.5 rounded">{'{{diagnosis}}'}</code></>
          )}
        </p>
      </div>
    </section>
  )
}
