'use client'

import { useState, useRef, useTransition } from 'react'
import { createSession } from '@/app/actions/sessions'

interface DiagnosisSession {
  id: string
  title: string
  session_date: string | null
}

interface Props {
  workspaceId: string
  diagnosisSessions: DiagnosisSession[]
}

const AGENT_TYPES = [
  { value: 'diagnostic', label: 'Diagnóstico', desc: 'Relatório executivo, sem tarefas' },
  { value: 'performance', label: 'Performance', desc: 'Análise de KPIs + tarefas de otimização' },
  { value: 'mentoring', label: 'Mentoria', desc: 'Acompanhamento + tarefas' },
  { value: 'influenciadores', label: 'Influenciadores', desc: 'Estratégia de influenciadores + ações' },
]

export default function NewSessionForm({ workspaceId, diagnosisSessions }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [agentType, setAgentType] = useState('mentoring')
  const [diagnosisId, setDiagnosisId] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const title = (fd.get('title') as string).trim()
    const sessionDate = (fd.get('session_date') as string) || null

    if (!title) {
      setError('Título é obrigatório')
      return
    }

    startTransition(async () => {
      const result = await createSession(
        workspaceId,
        title,
        sessionDate,
        agentType,
        agentType === 'performance' && diagnosisId ? diagnosisId : null,
      )
      if ('error' in result) {
        setError(result.error ?? 'Erro desconhecido')
      } else {
        formRef.current?.reset()
        setAgentType('mentoring')
        setDiagnosisId('')
        setOpen(false)
      }
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-gold text-bg-base text-sm font-medium hover:bg-brand-gold-light transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Nova Sessão
      </button>
    )
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="bg-bg-card border border-border rounded-xl p-5 space-y-4"
    >
      <h3 className="text-sm font-semibold text-text-primary">Nova Sessão</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-text-muted mb-1">Título *</label>
          <input
            name="title"
            required
            autoFocus
            placeholder="Ex: Reunião de Diagnóstico"
            className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold/60 placeholder:text-text-muted"
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Data da sessão</label>
          <input
            name="session_date"
            type="date"
            className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold/60"
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Tipo de Agente *</label>
          <select
            value={agentType}
            onChange={(e) => setAgentType(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold/60"
          >
            {AGENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-text-muted mt-0.5">
            {AGENT_TYPES.find((t) => t.value === agentType)?.desc}
          </p>
        </div>
        {agentType === 'performance' && diagnosisSessions.length > 0 && (
          <div>
            <label className="block text-xs text-text-muted mb-1">Diagnóstico base (opcional)</label>
            <select
              value={diagnosisId}
              onChange={(e) => setDiagnosisId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold/60"
            >
              <option value="">Nenhum</option>
              {diagnosisSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}{s.session_date ? ` (${new Date(s.session_date + 'T12:00:00').toLocaleDateString('pt-BR')})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 rounded-lg bg-brand-gold text-bg-base text-sm font-medium hover:bg-brand-gold-light transition-colors disabled:opacity-60"
        >
          {isPending ? 'Criando...' : 'Criar Sessão'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null) }}
          className="px-4 py-2 rounded-lg text-text-muted hover:text-text-primary text-sm transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
