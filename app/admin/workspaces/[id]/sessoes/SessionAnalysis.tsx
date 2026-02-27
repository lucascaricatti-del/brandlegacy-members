'use client'

import { useState, useTransition } from 'react'
import {
  analyzeTranscript,
  addSessionTaskToKanban,
  addAllSessionTasksToKanban,
  deleteSession,
} from '@/app/actions/sessions'

// ── Types ────────────────────────────────────────────────────

interface SessionTask {
  id: string
  title: string
  responsible: string | null
  due_date: string | null
  priority: string
  kanban_card_id: string | null
}

interface Session {
  id: string
  title: string
  session_date: string | null
  transcript: string | null
  summary: string | null
  decisions: string | null
  risks: string | null
  agent_type: string | null
  result_json: string | null
  status: string
  created_at: string
  session_tasks: SessionTask[]
}

interface Props {
  sessions: Session[]
  workspaceId: string
}

// ── Config ───────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  baixa: 'text-blue-400 bg-blue-400/15',
  media: 'text-yellow-400 bg-yellow-400/15',
  alta: 'text-orange-400 bg-orange-400/15',
  urgente: 'text-red-400 bg-red-400/15',
}

const PRIORITY_LABELS: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
}

const PRIORITY_ORDER: Record<string, number> = {
  urgente: 0,
  alta: 1,
  media: 2,
  baixa: 3,
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Aguardando transcrição', color: 'text-text-muted bg-bg-surface' },
  analyzing: { label: 'Analisando...', color: 'text-yellow-400 bg-yellow-400/15' },
  completed: { label: 'Concluído', color: 'text-green-400 bg-green-400/15' },
  error: { label: 'Erro', color: 'text-red-400 bg-red-400/15' },
}

const AGENT_TYPE_LABELS: Record<string, string> = {
  diagnostic: 'Diagnóstico',
  plan: 'Plano de Ação',
  mentoring: 'Mentoria',
}

const AGENT_TYPE_COLORS: Record<string, string> = {
  diagnostic: 'text-purple-400 bg-purple-400/15',
  plan: 'text-blue-400 bg-blue-400/15',
  mentoring: 'text-brand-gold bg-brand-gold/15',
}

// ── Component ────────────────────────────────────────────────

export default function SessionAnalysis({ sessions, workspaceId }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [transcriptMap, setTranscriptMap] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleAnalyze(sessionId: string) {
    const transcript = transcriptMap[sessionId]
    if (!transcript?.trim()) {
      setError('Cole a transcrição antes de analisar.')
      return
    }
    setError(null)
    setLoadingAction(`analyze-${sessionId}`)
    startTransition(async () => {
      const result = await analyzeTranscript(sessionId, workspaceId, transcript)
      if ('error' in result) setError(result.error ?? 'Erro desconhecido')
      setLoadingAction(null)
    })
  }

  function handleAddToKanban(taskId: string) {
    setError(null)
    setLoadingAction(`task-${taskId}`)
    startTransition(async () => {
      const result = await addSessionTaskToKanban(taskId, workspaceId)
      if ('error' in result) setError(result.error ?? 'Erro desconhecido')
      setLoadingAction(null)
    })
  }

  function handleAddAllToKanban(sessionId: string) {
    setError(null)
    setLoadingAction(`all-${sessionId}`)
    startTransition(async () => {
      const result = await addAllSessionTasksToKanban(sessionId, workspaceId)
      if ('error' in result) setError(result.error ?? 'Erro desconhecido')
      setLoadingAction(null)
    })
  }

  function handleDelete(sessionId: string) {
    if (!confirm('Tem certeza que deseja excluir esta sessão?')) return
    setError(null)
    setLoadingAction(`delete-${sessionId}`)
    startTransition(async () => {
      const result = await deleteSession(sessionId, workspaceId)
      if ('error' in result) setError(result.error ?? 'Erro desconhecido')
      setLoadingAction(null)
      if (expandedId === sessionId) setExpandedId(null)
    })
  }

  if (sessions.length === 0) {
    return (
      <p className="text-text-muted text-sm text-center py-8">
        Nenhuma sessão criada ainda. Crie uma nova sessão acima.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="bg-red-400/10 border border-red-400/30 rounded-lg px-4 py-2.5 text-red-400 text-sm">
          {error}
        </div>
      )}

      {sessions.map((session) => {
        const isExpanded = expandedId === session.id
        const statusCfg = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.pending
        const agentType = session.agent_type ?? 'mentoring'
        const isDiagnostic = agentType === 'diagnostic'

        return (
          <div
            key={session.id}
            className="bg-bg-card border border-border rounded-xl overflow-hidden"
          >
            {/* Header */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : session.id)}
              className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-bg-surface/30 transition-colors"
            >
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={`text-text-muted transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-text-primary truncate">
                    {session.title}
                  </h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${AGENT_TYPE_COLORS[agentType] ?? ''}`}>
                    {AGENT_TYPE_LABELS[agentType] ?? agentType}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${statusCfg.color}`}>
                    {statusCfg.label}
                  </span>
                </div>
                <p className="text-xs text-text-muted mt-0.5">
                  {session.session_date
                    ? new Date(session.session_date + 'T12:00:00').toLocaleDateString('pt-BR')
                    : 'Sem data'}
                  {session.session_tasks.length > 0 && (
                    <span className="ml-2">{session.session_tasks.length} tarefa(s)</span>
                  )}
                </p>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(session.id) }}
                disabled={isPending}
                className="text-text-muted hover:text-red-400 transition-colors p-1 shrink-0"
                title="Excluir sessão"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="px-5 pb-5 space-y-5 border-t border-border">
                {/* Transcript input */}
                {(session.status === 'pending' || session.status === 'error') && (
                  <div className="pt-4 space-y-3">
                    <label className="block text-xs font-medium text-text-secondary">
                      Cole a transcrição da reunião:
                    </label>
                    <textarea
                      value={transcriptMap[session.id] ?? session.transcript ?? ''}
                      onChange={(e) =>
                        setTranscriptMap((prev) => ({ ...prev, [session.id]: e.target.value }))
                      }
                      rows={8}
                      placeholder="Cole aqui a transcrição completa da reunião..."
                      className="w-full px-4 py-3 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold/60 placeholder:text-text-muted resize-y"
                    />
                    <button
                      onClick={() => handleAnalyze(session.id)}
                      disabled={isPending || loadingAction === `analyze-${session.id}`}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-gold text-bg-base text-sm font-medium hover:bg-brand-gold-light transition-colors disabled:opacity-60"
                    >
                      {loadingAction === `analyze-${session.id}` ? (
                        <>
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Analisando...
                        </>
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2a4 4 0 0 0-4 4v6a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4z" />
                            <path d="M12 18.5V22" /><path d="M7 22h10" />
                          </svg>
                          Analisar com IA
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Analyzing spinner */}
                {session.status === 'analyzing' && (
                  <div className="pt-4 flex items-center gap-3 text-yellow-400">
                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-sm font-medium">Analisando transcrição com IA...</span>
                  </div>
                )}

                {/* Results — diagnostic vs plan/mentoring */}
                {session.status === 'completed' && (
                  <div className="pt-4 space-y-5">
                    {isDiagnostic
                      ? <DiagnosticResults resultJson={session.result_json} summary={session.summary} />
                      : <TaskResults
                          session={session}
                          onAddToKanban={handleAddToKanban}
                          onAddAllToKanban={handleAddAllToKanban}
                          isPending={isPending}
                          loadingAction={loadingAction}
                        />
                    }
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Diagnostic Results ───────────────────────────────────────

function DiagnosticResults({ resultJson, summary }: { resultJson: string | null; summary: string | null }) {
  let parsed: {
    summary?: string
    strengths?: string[]
    bottlenecks?: string[]
    opportunities?: string[]
    risks?: string[]
    recommendations?: string[]
  } | null = null

  if (resultJson) {
    try { parsed = JSON.parse(resultJson) } catch { /* fallback to summary */ }
  }

  if (!parsed) {
    return summary ? (
      <div>
        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Resumo</h4>
        <p className="text-sm text-text-primary leading-relaxed bg-bg-surface/50 rounded-lg p-4 border border-border">{summary}</p>
      </div>
    ) : null
  }

  const sections: { key: string; title: string; items: string[]; icon: string; color: string }[] = [
    { key: 'strengths', title: 'Pontos Fortes', items: parsed.strengths ?? [], icon: 'M20 6L9 17l-5-5', color: 'text-green-400' },
    { key: 'bottlenecks', title: 'Gargalos', items: parsed.bottlenecks ?? [], icon: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', color: 'text-red-400' },
    { key: 'opportunities', title: 'Oportunidades', items: parsed.opportunities ?? [], icon: 'M12 2L2 7l10 5 10-5-10-5z', color: 'text-blue-400' },
    { key: 'risks', title: 'Riscos', items: parsed.risks ?? [], icon: 'M12 9v2m0 4h.01', color: 'text-orange-400' },
    { key: 'recommendations', title: 'Recomendações', items: parsed.recommendations ?? [], icon: 'M22 11.08V12a10 10 0 1 1-5.93-9.14', color: 'text-brand-gold' },
  ]

  return (
    <>
      {parsed.summary && (
        <div>
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Resumo Executivo</h4>
          <p className="text-sm text-text-primary leading-relaxed bg-bg-surface/50 rounded-lg p-4 border border-border">
            {parsed.summary}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sections.filter((s) => s.items.length > 0).map((section) => (
          <div key={section.key} className="bg-bg-surface/30 rounded-lg p-4 border border-border">
            <h4 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${section.color}`}>
              {section.title}
            </h4>
            <ul className="space-y-1.5">
              {section.items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-text-primary">
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${section.color.replace('text-', 'bg-')}`} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-text-muted italic">
        Agente de diagnóstico — relatório apenas, sem geração de tarefas para o Kanban.
      </p>
    </>
  )
}

// ── Task Results (plan + mentoring) ──────────────────────────

function TaskResults({
  session,
  onAddToKanban,
  onAddAllToKanban,
  isPending,
  loadingAction,
}: {
  session: Session
  onAddToKanban: (taskId: string) => void
  onAddAllToKanban: (sessionId: string) => void
  isPending: boolean
  loadingAction: string | null
}) {
  const decisions = safeParseArray(session.decisions)
  const risks = safeParseArray(session.risks)
  const pendingTasks = session.session_tasks.filter((t) => !t.kanban_card_id)

  // Sort tasks by priority
  const sortedTasks = [...session.session_tasks].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
  )

  // Parse next_session_topics from result_json
  let nextTopics: string[] = []
  if (session.result_json) {
    try {
      const parsed = JSON.parse(session.result_json)
      if (parsed.next_session_topics) nextTopics = parsed.next_session_topics
    } catch { /* ignore */ }
  }

  return (
    <>
      {/* Summary */}
      {session.summary && (
        <div>
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Resumo Executivo</h4>
          <p className="text-sm text-text-primary leading-relaxed bg-bg-surface/50 rounded-lg p-4 border border-border">
            {session.summary}
          </p>
        </div>
      )}

      {/* Decisions */}
      {decisions.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Decisões Tomadas</h4>
          <ul className="space-y-1.5">
            {decisions.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-text-primary">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-400 mt-0.5 shrink-0">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Risks */}
      {risks.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Riscos e Pontos de Atenção</h4>
          <ul className="space-y-1.5">
            {risks.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-text-primary">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-orange-400 mt-0.5 shrink-0">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tasks — sorted by priority */}
      {sortedTasks.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
              Tarefas ({sortedTasks.length})
            </h4>
            {pendingTasks.length > 0 && (
              <button
                onClick={() => onAddAllToKanban(session.id)}
                disabled={isPending || loadingAction === `all-${session.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-gold/15 text-brand-gold border border-brand-gold/30 text-xs font-medium hover:bg-brand-gold/25 transition-colors disabled:opacity-60"
              >
                {loadingAction === `all-${session.id}` ? 'Adicionando...' : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                    </svg>
                    Adicionar todas ao Kanban
                  </>
                )}
              </button>
            )}
          </div>

          <div className="space-y-2">
            {sortedTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 bg-bg-surface/50 rounded-lg p-3 border border-border"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary">{task.title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium leading-none ${PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.media}`}>
                      {PRIORITY_LABELS[task.priority] ?? task.priority}
                    </span>
                    {task.responsible && (
                      <span className="text-[10px] text-text-muted">{task.responsible}</span>
                    )}
                    {task.due_date && (
                      <span className="text-[10px] text-text-muted">
                        {new Date(task.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                </div>

                {task.kanban_card_id ? (
                  <span className="text-[10px] px-2 py-1 rounded bg-green-400/15 text-green-400 font-medium shrink-0">
                    No Kanban
                  </span>
                ) : (
                  <button
                    onClick={() => onAddToKanban(task.id)}
                    disabled={isPending || loadingAction === `task-${task.id}`}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-gold/10 text-brand-gold border border-brand-gold/20 text-[11px] font-medium hover:bg-brand-gold/20 transition-colors disabled:opacity-60 shrink-0"
                  >
                    {loadingAction === `task-${task.id}` ? '...' : (
                      <>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Kanban
                      </>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next session topics (mentoring only) */}
      {nextTopics.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Tópicos para Próxima Sessão</h4>
          <ul className="space-y-1.5">
            {nextTopics.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-text-primary">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-gold shrink-0" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

// ── Helpers ──────────────────────────────────────────────────

function safeParseArray(val: string | null): string[] {
  if (!val) return []
  try {
    const parsed = JSON.parse(val)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
