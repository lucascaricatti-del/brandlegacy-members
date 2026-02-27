'use client'

import { useState } from 'react'
import Link from 'next/link'

type Workspace = {
  id: string
  name: string
  slug: string
  plan_type: string
  is_active: boolean
}

type Delivery = {
  id: string
  title: string
  status: string
  scheduled_date: string | null
  completed_date: string | null
  link_call: string | null
  order_index: number
}

type Task = {
  id: string
  title: string
  status: string
  priority: string
  due_date: string | null
  responsible: string | null
  is_archived: boolean
}

type Session = {
  id: string
  title: string
  session_date: string | null
  status: string
  summary: string | null
  created_at: string
}

type Tab = 'dashboard' | 'tarefas' | 'entregas' | 'sessoes' | 'agenda'

const PRIORITY_COLORS: Record<string, string> = {
  baixa: 'text-green-400 bg-green-400/10',
  media: 'text-blue-400 bg-blue-400/10',
  alta: 'text-yellow-400 bg-yellow-400/10',
  urgente: 'text-red-400 bg-red-400/10',
}
const PRIORITY_LABELS: Record<string, string> = {
  baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente',
}
const TASK_STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente', em_andamento: 'Em andamento', concluida: 'Concluída',
}
const DELIVERY_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'text-text-muted bg-bg-surface' },
  scheduled: { label: 'Agendada', color: 'text-info bg-info/10' },
  completed: { label: 'Concluída', color: 'text-green-400 bg-green-400/10' },
}

interface Props {
  workspace: Workspace
  deliveries: Delivery[]
  tasks: Task[]
  sessions: Session[]
}

export default function ViewAsMentoradoClient({ workspace, deliveries, tasks, sessions }: Props) {
  const [tab, setTab] = useState<Tab>('dashboard')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'tarefas', label: 'Tarefas' },
    { key: 'entregas', label: 'Entregas' },
    { key: 'sessoes', label: 'Sessões' },
    { key: 'agenda', label: 'Agenda' },
  ]

  const totalTasks = tasks.length
  const completedTasks = tasks.filter((t) => t.status === 'concluida').length
  const todayStr = new Date().toISOString().split('T')[0]
  const overdueTasks = tasks.filter((t) => t.status !== 'concluida' && t.due_date && t.due_date < todayStr).length
  const completedDeliveries = deliveries.filter((d) => d.status === 'completed').length
  const scheduledDeliveries = deliveries.filter((d) => d.status === 'scheduled')

  return (
    <div className="animate-fade-in">
      {/* Banner */}
      <div className="bg-brand-gold/10 border border-brand-gold/30 rounded-xl p-4 mb-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-gold">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
          </svg>
          <span className="text-sm text-brand-gold font-medium">
            Visualizando como <strong>{workspace.name}</strong>
          </span>
        </div>
        <Link
          href={`/admin/workspaces/${workspace.id}`}
          className="text-xs px-3 py-1.5 rounded-lg bg-bg-surface border border-border text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          Voltar ao Admin
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-bg-card border border-border rounded-xl p-1 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              tab === t.key
                ? 'bg-brand-gold/15 text-brand-gold'
                : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Tarefas" value={`${completedTasks}/${totalTasks}`} sub={`${totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}% concluídas`} />
            <StatCard label="Atrasadas" value={String(overdueTasks)} color={overdueTasks > 0 ? 'text-red-400' : undefined} />
            <StatCard label="Entregas" value={`${completedDeliveries}/${deliveries.length}`} />
            <StatCard label="Sessões" value={String(sessions.length)} />
          </div>

          {/* Recent tasks */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Tarefas recentes</h3>
            {tasks.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm text-text-primary">{t.title}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[t.priority] ?? ''}`}>
                  {PRIORITY_LABELS[t.priority] ?? t.priority}
                </span>
              </div>
            ))}
            {tasks.length === 0 && <p className="text-text-muted text-sm">Nenhuma tarefa.</p>}
          </div>
        </div>
      )}

      {tab === 'tarefas' && (
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <div className="bg-bg-card border border-border rounded-xl p-12 text-center text-text-muted text-sm">Nenhuma tarefa.</div>
          ) : (
            tasks.map((t) => (
              <div key={t.id} className="bg-bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full shrink-0 ${t.status === 'concluida' ? 'bg-green-400' : t.status === 'em_andamento' ? 'bg-blue-400' : 'bg-text-muted'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${t.status === 'concluida' ? 'text-text-muted line-through' : 'text-text-primary'}`}>{t.title}</p>
                  <div className="flex gap-3 text-xs text-text-muted mt-0.5">
                    <span>{TASK_STATUS_LABELS[t.status] ?? t.status}</span>
                    {t.due_date && <span>Prazo: {new Date(t.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>}
                    {t.responsible && <span>{t.responsible}</span>}
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${PRIORITY_COLORS[t.priority] ?? ''}`}>
                  {PRIORITY_LABELS[t.priority] ?? t.priority}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'entregas' && (
        <div className="space-y-3">
          {deliveries.length === 0 ? (
            <div className="bg-bg-card border border-border rounded-xl p-12 text-center text-text-muted text-sm">Nenhuma entrega.</div>
          ) : (
            deliveries.map((d) => {
              const ds = DELIVERY_STATUS[d.status] ?? DELIVERY_STATUS.pending
              return (
                <div key={d.id} className="bg-bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-text-primary">{d.title}</p>
                      <div className="flex gap-3 text-xs text-text-muted mt-1">
                        {d.scheduled_date && <span>Agendada: {new Date(d.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>}
                        {d.completed_date && <span>Concluída: {new Date(d.completed_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>}
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ds.color}`}>{ds.label}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {tab === 'sessoes' && (
        <div className="space-y-3">
          {sessions.length === 0 ? (
            <div className="bg-bg-card border border-border rounded-xl p-12 text-center text-text-muted text-sm">Nenhuma sessão.</div>
          ) : (
            sessions.map((s) => (
              <div key={s.id} className="bg-bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-text-primary">{s.title}</p>
                  <span className="text-xs text-text-muted">
                    {s.session_date
                      ? new Date(s.session_date + 'T12:00:00').toLocaleDateString('pt-BR')
                      : new Date(s.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                {s.summary && (
                  <p className="text-xs text-text-secondary mt-1 line-clamp-2">{s.summary}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'agenda' && (
        <div className="space-y-3">
          {scheduledDeliveries.length === 0 ? (
            <div className="bg-bg-card border border-border rounded-xl p-12 text-center text-text-muted text-sm">Nenhuma entrega agendada.</div>
          ) : (
            scheduledDeliveries.map((d) => (
              <div key={d.id} className="bg-bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{d.title}</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {d.scheduled_date && new Date(d.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                  </div>
                  {d.link_call && (
                    <a
                      href={d.link_call}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-3 py-1.5 rounded-lg bg-info/10 text-info border border-info/20 hover:bg-info/20 transition-colors"
                    >
                      Entrar na call
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 text-center">
      <p className={`text-2xl font-bold ${color ?? 'text-text-primary'}`}>{value}</p>
      <p className="text-xs text-text-muted mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-text-muted mt-0.5">{sub}</p>}
    </div>
  )
}
