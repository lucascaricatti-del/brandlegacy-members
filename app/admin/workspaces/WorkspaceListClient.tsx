'use client'

import { useState } from 'react'
import Link from 'next/link'

type EnrichedWorkspace = {
  id: string
  name: string
  slug: string
  plan_type: string
  is_active: boolean
  task_progress: number
  total_tasks: number
  completed_tasks: number
  overdue_tasks: number
  last_session_date: string | null
  days_inactive: number
  health: 'em_dia' | 'atencao' | 'churn'
  financial_status: string | null
}

const PLAN_LABELS: Record<string, string> = { free: 'Free', tracao: 'Tração', club: 'Club' }
const PLAN_COLORS: Record<string, string> = {
  free: 'bg-bg-surface text-text-muted border border-border',
  tracao: 'bg-info/15 text-info',
  club: 'bg-brand-gold/15 text-brand-gold',
}

const HEALTH_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  em_dia: { label: 'Em dia', emoji: '🟢', color: 'text-green-400' },
  atencao: { label: 'Atenção', emoji: '🟡', color: 'text-yellow-400' },
  churn: { label: 'Risco', emoji: '🔴', color: 'text-red-400' },
}

const HEALTH_ORDER: Record<string, number> = { churn: 0, atencao: 1, em_dia: 2 }

export default function WorkspaceListClient({ workspaces }: { workspaces: EnrichedWorkspace[] }) {
  const [search, setSearch] = useState('')

  const filtered = workspaces.filter((ws) =>
    ws.name.toLowerCase().includes(search.toLowerCase())
  )

  const sorted = [...filtered].sort(
    (a, b) => (HEALTH_ORDER[a.health] ?? 9) - (HEALTH_ORDER[b.health] ?? 9)
  )

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Buscar por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-bg-card border border-border text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-brand-gold transition-colors"
        />
      </div>

      {/* List */}
      {sorted.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-xl p-12 text-center text-text-muted text-sm">
          {search ? 'Nenhum mentorado encontrado.' : 'Nenhuma empresa criada.'}
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((ws) => {
            const hc = HEALTH_CONFIG[ws.health] ?? HEALTH_CONFIG.em_dia
            return (
              <div
                key={ws.id}
                className="bg-bg-card border border-border rounded-xl p-5 hover:border-border-light transition-colors"
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl bg-brand-gold/15 flex items-center justify-center text-lg font-bold text-brand-gold shrink-0">
                    {ws.name[0]?.toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/admin/workspaces/${ws.id}`}
                        className="text-sm font-semibold text-text-primary hover:text-brand-gold transition-colors"
                      >
                        {ws.name}
                      </Link>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[ws.plan_type] ?? ''}`}>
                        {PLAN_LABELS[ws.plan_type] ?? ws.plan_type}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ws.is_active ? 'bg-success/15 text-success' : 'bg-error/15 text-error'}`}>
                        {ws.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>

                    {/* Metrics row */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted mt-1.5">
                      <span>Tarefas: {ws.completed_tasks}/{ws.total_tasks} ({ws.task_progress}%)</span>
                      <span>
                        Última sessão:{' '}
                        {ws.last_session_date
                          ? new Date(ws.last_session_date).toLocaleDateString('pt-BR')
                          : 'Nunca'}
                      </span>
                      {ws.days_inactive >= 0 && (
                        <span className={ws.days_inactive > 7 ? 'text-yellow-400' : ''}>
                          {ws.days_inactive}d sem movimentação
                        </span>
                      )}
                      {ws.overdue_tasks > 0 && (
                        <span className="text-red-400">{ws.overdue_tasks} atrasada{ws.overdue_tasks > 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>

                  {/* Health + Action */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-sm ${hc.color}`} title={hc.label}>
                      {hc.emoji}
                    </span>
                    <Link
                      href={`/admin/workspaces/${ws.id}`}
                      className="px-3 py-1.5 text-xs rounded-lg bg-brand-gold/10 text-brand-gold border border-brand-gold/20 hover:bg-brand-gold/20 transition-colors"
                    >
                      Acessar
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
