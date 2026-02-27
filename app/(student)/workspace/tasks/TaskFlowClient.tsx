'use client'

import { useState, useTransition } from 'react'
import { createTask, updateTask, completeTask, archiveTask } from '@/app/actions/tasks'
import type { TaskPriority, TaskStatus } from '@/lib/types/database'

// ── Types ────────────────────────────────────────────────────

interface TaskRow {
  id: string
  title: string
  description: string | null
  responsible: string | null
  due_date: string | null
  priority: string
  status: string
  is_archived: boolean
  session_id: string | null
  created_at: string
  sessions: { title: string } | null
}

interface Props {
  workspaceId: string
  tasks: TaskRow[]
  isAdmin?: boolean
}

// ── Config ───────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 }
const PRIORITY_COLORS: Record<string, string> = {
  baixa: 'text-blue-400 bg-blue-400/15',
  media: 'text-yellow-400 bg-yellow-400/15',
  alta: 'text-orange-400 bg-orange-400/15',
  urgente: 'text-red-400 bg-red-400/15',
}
const PRIORITY_LABELS: Record<string, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente' }
const STATUS_COLORS: Record<string, string> = {
  pendente: 'text-text-muted bg-bg-surface',
  em_andamento: 'text-blue-400 bg-blue-400/15',
  concluida: 'text-green-400 bg-green-400/15',
}
const STATUS_LABELS: Record<string, string> = { pendente: 'Pendente', em_andamento: 'Em andamento', concluida: 'Concluída' }

// ── Component ────────────────────────────────────────────────

export default function TaskFlowClient({ workspaceId, tasks, isAdmin }: Props) {
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all')
  const [showArchived, setShowArchived] = useState(false)
  const [drawerTask, setDrawerTask] = useState<TaskRow | null>(null)
  const [showNewTask, setShowNewTask] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const activeTasks = tasks.filter((t) => !t.is_archived)
  const archivedTasks = tasks.filter((t) => t.is_archived)

  const filtered = activeTasks
    .filter((t) => statusFilter === 'all' || t.status === statusFilter)
    .filter((t) => priorityFilter === 'all' || t.priority === priorityFilter)
    .sort((a, b) => {
      // Concluídas por último
      if (a.status === 'concluida' && b.status !== 'concluida') return 1
      if (b.status === 'concluida' && a.status !== 'concluida') return -1
      // Prioridade
      const pa = PRIORITY_ORDER[a.priority] ?? 99
      const pb = PRIORITY_ORDER[b.priority] ?? 99
      if (pa !== pb) return pa - pb
      // Data
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
      if (a.due_date) return -1
      if (b.due_date) return 1
      return 0
    })

  const todayStr = new Date().toISOString().split('T')[0]

  function handleComplete(taskId: string) {
    setMessage(null)
    startTransition(async () => {
      const result = await completeTask(taskId, workspaceId)
      if ('error' in result && result.error) setMessage({ type: 'error', text: result.error })
    })
  }

  function handleArchive(taskId: string) {
    setMessage(null)
    startTransition(async () => {
      const result = await archiveTask(taskId, workspaceId)
      if ('error' in result && result.error) setMessage({ type: 'error', text: result.error })
      setDrawerTask(null)
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-text-primary">
          {isAdmin ? 'Tarefas do Mentorado' : 'Minhas Tarefas'}
        </h1>
        <button
          onClick={() => setShowNewTask(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-gold text-bg-base text-sm font-medium hover:bg-brand-gold-light transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nova Tarefa
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'all')}
          className="px-3 py-1.5 text-sm rounded-lg bg-bg-card border border-border text-text-primary focus:outline-none focus:border-brand-gold/50"
        >
          <option value="all">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="em_andamento">Em andamento</option>
          <option value="concluida">Concluída</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | 'all')}
          className="px-3 py-1.5 text-sm rounded-lg bg-bg-card border border-border text-text-primary focus:outline-none focus:border-brand-gold/50"
        >
          <option value="all">Todas prioridades</option>
          <option value="urgente">Urgente</option>
          <option value="alta">Alta</option>
          <option value="media">Média</option>
          <option value="baixa">Baixa</option>
        </select>
      </div>

      {message && (
        <div className={`text-sm px-3 py-2 rounded-lg ${message.type === 'success' ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
          {message.text}
        </div>
      )}

      {/* New Task Form */}
      {showNewTask && (
        <NewTaskForm
          workspaceId={workspaceId}
          onClose={() => setShowNewTask(false)}
          onMessage={setMessage}
        />
      )}

      {/* Task List */}
      {filtered.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-xl p-12 text-center">
          <p className="text-text-muted text-sm">Nenhuma tarefa encontrada.</p>
        </div>
      ) : (
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <div className="divide-y divide-border">
            {filtered.map((task) => {
              const isOverdue = task.status !== 'concluida' && task.due_date && task.due_date < todayStr
              const isCompleted = task.status === 'concluida'

              return (
                <div
                  key={task.id}
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-bg-surface/30 transition-colors cursor-pointer ${isCompleted ? 'opacity-60' : ''} ${isOverdue ? 'bg-red-400/5' : ''}`}
                  onClick={() => setDrawerTask(task)}
                >
                  {/* Checkbox */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleComplete(task.id) }}
                    disabled={isPending || isCompleted}
                    className={`w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                      isCompleted
                        ? 'bg-green-400/20 border-green-400 text-green-400'
                        : 'border-border hover:border-brand-gold/50'
                    }`}
                  >
                    {isCompleted && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm text-text-primary ${isCompleted ? 'line-through' : ''}`}>{task.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {task.responsible && <span className="text-[10px] text-text-muted">{task.responsible}</span>}
                      {task.due_date && (
                        <span className={`text-[10px] ${isOverdue ? 'text-red-400 font-medium' : 'text-text-muted'}`}>
                          {new Date(task.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </span>
                      )}
                      {isAdmin && task.sessions && (
                        <span className="text-[10px] text-purple-400">Sessão: {task.sessions.title}</span>
                      )}
                    </div>
                  </div>

                  {/* Badges */}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.media}`}>
                    {PRIORITY_LABELS[task.priority] ?? task.priority}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${STATUS_COLORS[task.status] ?? STATUS_COLORS.pendente}`}>
                    {STATUS_LABELS[task.status] ?? task.status}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Archived section */}
      {archivedTasks.length > 0 && (
        <div>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className={`transition-transform ${showArchived ? 'rotate-90' : ''}`}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            Arquivadas ({archivedTasks.length})
          </button>
          {showArchived && (
            <div className="mt-2 bg-bg-card border border-border rounded-xl overflow-hidden opacity-60">
              <div className="divide-y divide-border">
                {archivedTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-5 h-5 rounded border-2 border-border shrink-0" />
                    <p className="text-sm text-text-muted line-through flex-1">{task.title}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLORS[task.priority] ?? ''}`}>
                      {PRIORITY_LABELS[task.priority] ?? task.priority}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Drawer */}
      {drawerTask && (
        <TaskDrawer
          task={drawerTask}
          workspaceId={workspaceId}
          isAdmin={isAdmin}
          onClose={() => setDrawerTask(null)}
          onArchive={handleArchive}
          onMessage={setMessage}
        />
      )}
    </div>
  )
}

// ── New Task Form ────────────────────────────────────────────

function NewTaskForm({
  workspaceId,
  onClose,
  onMessage,
}: {
  workspaceId: string
  onClose: () => void
  onMessage: (msg: { type: 'success' | 'error'; text: string } | null) => void
}) {
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createTask(workspaceId, {
        title: fd.get('title') as string,
        description: (fd.get('description') as string) || undefined,
        responsible: (fd.get('responsible') as string) || undefined,
        due_date: (fd.get('due_date') as string) || undefined,
        priority: (fd.get('priority') as TaskPriority) || 'media',
      })
      if ('error' in result && result.error) {
        onMessage({ type: 'error', text: result.error })
      } else {
        onMessage(null)
        onClose()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-bg-card border border-border rounded-xl p-5 space-y-3">
      <h3 className="text-sm font-semibold text-text-primary">Nova Tarefa</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-text-muted mb-1">Título *</label>
          <input name="title" required placeholder="O que precisa ser feito?" className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold/60 placeholder:text-text-muted" />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Responsável</label>
          <input name="responsible" placeholder="Nome" className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold/60 placeholder:text-text-muted" />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Data de entrega</label>
          <input name="due_date" type="date" className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold/60" />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Prioridade</label>
          <select name="priority" defaultValue="media" className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold/60">
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs text-text-muted mb-1">Descrição</label>
        <textarea name="description" rows={2} placeholder="Detalhes opcionais..." className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold/60 placeholder:text-text-muted resize-y" />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className="px-4 py-2 rounded-lg bg-brand-gold text-bg-base text-sm font-medium hover:bg-brand-gold-light transition-colors disabled:opacity-60">
          {isPending ? 'Criando...' : 'Criar'}
        </button>
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-text-muted hover:text-text-primary text-sm transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ── Task Drawer ──────────────────────────────────────────────

function TaskDrawer({
  task,
  workspaceId,
  isAdmin,
  onClose,
  onArchive,
  onMessage,
}: {
  task: TaskRow
  workspaceId: string
  isAdmin?: boolean
  onClose: () => void
  onArchive: (taskId: string) => void
  onMessage: (msg: { type: 'success' | 'error'; text: string } | null) => void
}) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [responsible, setResponsible] = useState(task.responsible ?? '')
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [priority, setPriority] = useState(task.priority)
  const [status, setStatus] = useState(task.status)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      const result = await updateTask(task.id, workspaceId, {
        title,
        description: description || null,
        responsible: responsible || null,
        due_date: dueDate || null,
        priority: priority as TaskPriority,
        status: status as TaskStatus,
      })
      if ('error' in result && result.error) {
        onMessage({ type: 'error', text: result.error })
      } else {
        onMessage(null)
        onClose()
      }
    })
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-bg-card border-l border-border overflow-y-auto">
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-text-primary">Editar Tarefa</h2>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary p-1">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-text-muted mb-1">Título</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold/60" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Descrição</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold/60 resize-y" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">Responsável</label>
                <input value={responsible} onChange={(e) => setResponsible(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold/60" />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Data de entrega</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold/60" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">Prioridade</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold/60">
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold/60">
                  <option value="pendente">Pendente</option>
                  <option value="em_andamento">Em andamento</option>
                  <option value="concluida">Concluída</option>
                </select>
              </div>
            </div>

            {/* Origin info */}
            {isAdmin && task.sessions && (
              <div className="text-xs text-text-muted bg-bg-surface/50 rounded-lg p-3 border border-border">
                Origem: Sessão IA — {task.sessions.title}
              </div>
            )}
            {isAdmin && !task.sessions && (
              <div className="text-xs text-text-muted bg-bg-surface/50 rounded-lg p-3 border border-border">
                Origem: Criada manualmente
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} disabled={isPending} className="flex-1 px-4 py-2 rounded-lg bg-brand-gold text-bg-base text-sm font-medium hover:bg-brand-gold-light transition-colors disabled:opacity-60">
              {isPending ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={() => onArchive(task.id)} disabled={isPending} className="px-4 py-2 rounded-lg border border-error/30 text-error text-sm hover:bg-error/10 transition-colors disabled:opacity-60">
              Arquivar
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
