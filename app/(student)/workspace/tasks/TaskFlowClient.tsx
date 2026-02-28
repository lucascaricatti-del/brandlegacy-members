'use client'

import { useState, useTransition, useEffect, useCallback, useRef } from 'react'
import {
  createTask,
  updateTask,
  completeTask,
  archiveTask,
  bulkUpdateTasks,
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  getChecklistItems,
  addTaskComment,
  getTaskComments,
  uploadTaskFile,
} from '@/app/actions/tasks'
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
  completed_at: string | null
  created_by: string | null
  start_date: string | null
  tags: string[] | null
  order_index: number
  file_url: string | null
  file_name: string | null
  created_at: string
  sessions: { title: string } | null
  creator: { id: string; name: string } | null
}

interface MemberOption {
  id: string
  name: string
  email: string
}

interface ChecklistItem {
  id: string
  task_id: string
  title: string
  is_done: boolean
  order_index: number
  created_at: string
}

interface CommentRow {
  id: string
  task_id: string
  user_id: string
  body: string
  created_at: string
  profiles: { id: string; name: string } | null
}

interface Props {
  workspaceId: string
  tasks: TaskRow[]
  members?: MemberOption[]
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

type QuickFilter = 'hoje' | 'semana' | 'atrasadas' | 'sem_responsavel' | null

// ── Component ────────────────────────────────────────────────

export default function TaskFlowClient({ workspaceId, tasks, members = [], isAdmin }: Props) {
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all')
  const [showArchived, setShowArchived] = useState(false)
  const [drawerTask, setDrawerTask] = useState<TaskRow | null>(null)
  const [showNewTask, setShowNewTask] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // New states
  const [searchQuery, setSearchQuery] = useState('')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkMode, setBulkMode] = useState(false)

  const todayStr = new Date().toISOString().split('T')[0]

  // Compute end of week (Sunday)
  const now = new Date()
  const endOfWeek = new Date(now)
  endOfWeek.setDate(now.getDate() + (7 - now.getDay()))
  const endOfWeekStr = endOfWeek.toISOString().split('T')[0]

  const activeTasks = tasks.filter((t) => !t.is_archived)
  const archivedTasks = tasks.filter((t) => t.is_archived)

  // Counters
  const totalCount = activeTasks.length
  const pendingCount = activeTasks.filter((t) => t.status === 'pendente').length
  const inProgressCount = activeTasks.filter((t) => t.status === 'em_andamento').length
  const completedCount = activeTasks.filter((t) => t.status === 'concluida').length
  const overdueCount = activeTasks.filter((t) => t.status !== 'concluida' && t.due_date && t.due_date < todayStr).length
  const noResponsibleCount = activeTasks.filter((t) => !t.responsible).length

  const filtered = activeTasks
    .filter((t) => statusFilter === 'all' || t.status === statusFilter)
    .filter((t) => priorityFilter === 'all' || t.priority === priorityFilter)
    .filter((t) => !searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((t) => {
      if (!quickFilter) return true
      if (quickFilter === 'hoje') return t.due_date === todayStr
      if (quickFilter === 'semana') return t.due_date && t.due_date >= todayStr && t.due_date <= endOfWeekStr
      if (quickFilter === 'atrasadas') return t.status !== 'concluida' && t.due_date && t.due_date < todayStr
      if (quickFilter === 'sem_responsavel') return !t.responsible
      return true
    })
    .sort((a, b) => {
      if (a.status === 'concluida' && b.status !== 'concluida') return 1
      if (b.status === 'concluida' && a.status !== 'concluida') return -1
      const pa = PRIORITY_ORDER[a.priority] ?? 99
      const pb = PRIORITY_ORDER[b.priority] ?? 99
      if (pa !== pb) return pa - pb
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
      if (a.due_date) return -1
      if (b.due_date) return 1
      return 0
    })

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

  function toggleSelect(taskId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  function handleBulkAction(action: 'concluir' | 'arquivar' | TaskPriority) {
    if (selectedIds.size === 0) return
    setMessage(null)
    const ids = Array.from(selectedIds)
    startTransition(async () => {
      let result
      if (action === 'concluir') {
        result = await bulkUpdateTasks(workspaceId, ids, { status: 'concluida' })
      } else if (action === 'arquivar') {
        result = await bulkUpdateTasks(workspaceId, ids, { is_archived: true })
      } else {
        result = await bulkUpdateTasks(workspaceId, ids, { priority: action })
      }
      if ('error' in result && result.error) setMessage({ type: 'error', text: result.error })
      setSelectedIds(new Set())
      setBulkMode(false)
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-text-primary">
          {isAdmin ? 'Tarefas do Mentorado' : 'Minhas Tarefas'}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()) }}
            className={`px-3 py-2 rounded-lg text-sm transition-colors ${bulkMode ? 'bg-brand-gold/20 text-brand-gold border border-brand-gold/30' : 'text-text-muted hover:text-text-primary border border-border'}`}
          >
            {bulkMode ? 'Cancelar' : 'Selecionar'}
          </button>
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
      </div>

      {/* Counters */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-2 py-1 rounded bg-bg-surface text-text-secondary">{totalCount} total</span>
        <span className="px-2 py-1 rounded bg-bg-surface text-text-muted">{pendingCount} pendentes</span>
        <span className="px-2 py-1 rounded bg-blue-400/15 text-blue-400">{inProgressCount} em andamento</span>
        <span className="px-2 py-1 rounded bg-green-400/15 text-green-400">{completedCount} concluídas</span>
        {overdueCount > 0 && <span className="px-2 py-1 rounded bg-red-400/15 text-red-400">{overdueCount} atrasadas</span>}
        {noResponsibleCount > 0 && <span className="px-2 py-1 rounded bg-orange-400/15 text-orange-400">{noResponsibleCount} sem responsável</span>}
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar tarefa..."
          className="w-full pl-10 pr-3 py-2 rounded-lg bg-bg-card border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold/50 placeholder:text-text-muted"
        />
      </div>

      {/* Filters row: dropdowns + quick filter chips */}
      <div className="flex flex-wrap gap-2 items-center">
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

        <div className="h-4 w-px bg-border mx-1" />

        {(['hoje', 'semana', 'atrasadas', 'sem_responsavel'] as const).map((qf) => {
          const labels: Record<string, string> = { hoje: 'Hoje', semana: 'Esta Semana', atrasadas: 'Atrasadas', sem_responsavel: 'Sem Responsável' }
          const active = quickFilter === qf
          return (
            <button
              key={qf}
              onClick={() => setQuickFilter(active ? null : qf)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${active ? 'bg-brand-gold/20 text-brand-gold border border-brand-gold/30' : 'bg-bg-surface text-text-muted hover:text-text-primary border border-transparent'}`}
            >
              {labels[qf]}
            </button>
          )
        })}
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
          members={members}
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
              const isSelected = selectedIds.has(task.id)

              return (
                <div
                  key={task.id}
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-bg-surface/30 transition-colors cursor-pointer ${isCompleted ? 'opacity-60' : ''} ${isOverdue ? 'bg-red-400/5' : ''} ${isSelected ? 'bg-brand-gold/5' : ''}`}
                  onClick={() => bulkMode ? toggleSelect(task.id) : setDrawerTask(task)}
                >
                  {/* Bulk checkbox or complete checkbox */}
                  {bulkMode ? (
                    <div
                      className={`w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${isSelected ? 'bg-brand-gold/20 border-brand-gold text-brand-gold' : 'border-border'}`}
                    >
                      {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  ) : (
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
                  )}

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
                      {task.tags && task.tags.length > 0 && task.tags.map((tag) => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-brand-gold/15 text-brand-gold">{tag}</span>
                      ))}
                      {task.file_name && (
                        <span className="text-[10px] text-blue-400 flex items-center gap-0.5">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></svg>
                          {task.file_name}
                        </span>
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

      {/* Bulk action bar */}
      {bulkMode && selectedIds.size > 0 && (
        <div className="sticky bottom-4 mx-auto w-fit flex items-center gap-3 px-5 py-3 rounded-xl bg-bg-card border border-brand-gold/30 shadow-lg z-40">
          <span className="text-sm text-text-secondary font-medium">{selectedIds.size} selecionada(s)</span>
          <div className="h-4 w-px bg-border" />
          <button onClick={() => handleBulkAction('concluir')} disabled={isPending} className="px-3 py-1.5 text-xs rounded-lg bg-green-400/15 text-green-400 hover:bg-green-400/25 transition-colors disabled:opacity-60">
            Concluir
          </button>
          <select
            onChange={(e) => { if (e.target.value) handleBulkAction(e.target.value as TaskPriority); e.target.value = '' }}
            className="px-3 py-1.5 text-xs rounded-lg bg-bg-surface border border-border text-text-primary"
            defaultValue=""
          >
            <option value="" disabled>Prioridade</option>
            <option value="urgente">Urgente</option>
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
          </select>
          <button onClick={() => handleBulkAction('arquivar')} disabled={isPending} className="px-3 py-1.5 text-xs rounded-lg bg-red-400/15 text-red-400 hover:bg-red-400/25 transition-colors disabled:opacity-60">
            Arquivar
          </button>
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
          members={members}
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
  members,
  onClose,
  onMessage,
}: {
  workspaceId: string
  members: MemberOption[]
  onClose: () => void
  onMessage: (msg: { type: 'success' | 'error'; text: string } | null) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const file = fileInputRef.current?.files?.[0]

    startTransition(async () => {
      let fileUrl: string | undefined
      let fileName: string | undefined

      // Upload file if selected
      if (file && file.size > 0) {
        setUploading(true)
        const uploadFd = new FormData()
        uploadFd.append('file', file)
        const uploadResult = await uploadTaskFile(workspaceId, uploadFd)
        setUploading(false)
        if ('error' in uploadResult && uploadResult.error) {
          onMessage({ type: 'error', text: uploadResult.error })
          return
        }
        if ('fileUrl' in uploadResult) {
          fileUrl = uploadResult.fileUrl
          fileName = uploadResult.fileName
        }
      }

      const result = await createTask(workspaceId, {
        title: fd.get('title') as string,
        description: (fd.get('description') as string) || undefined,
        responsible: (fd.get('responsible') as string) || undefined,
        due_date: (fd.get('due_date') as string) || undefined,
        priority: (fd.get('priority') as TaskPriority) || 'media',
        file_url: fileUrl,
        file_name: fileName,
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
          {members.length > 0 ? (
            <select name="responsible" defaultValue="" className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold/60">
              <option value="">Sem responsável</option>
              {members.map((m) => (
                <option key={m.id} value={m.name}>{m.name}</option>
              ))}
            </select>
          ) : (
            <input name="responsible" placeholder="Nome" className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold/60 placeholder:text-text-muted" />
          )}
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
      <div>
        <label className="block text-xs text-text-muted mb-1">Anexar arquivo</label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.zip,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.pptx,.csv,.txt"
          className="w-full text-sm text-text-muted file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand-gold/15 file:text-brand-gold file:text-sm file:font-medium cursor-pointer hover:file:bg-brand-gold/25 transition-all"
        />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={isPending || uploading} className="px-4 py-2 rounded-lg bg-brand-gold text-bg-base text-sm font-medium hover:bg-brand-gold-light transition-colors disabled:opacity-60">
          {uploading ? 'Enviando arquivo...' : isPending ? 'Criando...' : 'Criar'}
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
  members,
  isAdmin,
  onClose,
  onArchive,
  onMessage,
}: {
  task: TaskRow
  workspaceId: string
  members: MemberOption[]
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

  // Checklist state
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([])
  const [newChecklistTitle, setNewChecklistTitle] = useState('')
  const [loadingChecklist, setLoadingChecklist] = useState(true)

  // Comments state
  const [comments, setComments] = useState<CommentRow[]>([])
  const [newComment, setNewComment] = useState('')
  const [loadingComments, setLoadingComments] = useState(true)

  const loadChecklist = useCallback(async () => {
    setLoadingChecklist(true)
    const items = await getChecklistItems(task.id, workspaceId)
    setChecklistItems(items as ChecklistItem[])
    setLoadingChecklist(false)
  }, [task.id, workspaceId])

  const loadComments = useCallback(async () => {
    setLoadingComments(true)
    const data = await getTaskComments(task.id, workspaceId)
    setComments(data as CommentRow[])
    setLoadingComments(false)
  }, [task.id, workspaceId])

  useEffect(() => {
    loadChecklist()
    loadComments()
  }, [loadChecklist, loadComments])

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

  function handleAddChecklistItem() {
    if (!newChecklistTitle.trim()) return
    startTransition(async () => {
      const result = await addChecklistItem(task.id, workspaceId, newChecklistTitle)
      if ('error' in result && result.error) {
        onMessage({ type: 'error', text: result.error })
      } else {
        setNewChecklistTitle('')
        await loadChecklist()
      }
    })
  }

  function handleToggleChecklistItem(itemId: string, isDone: boolean) {
    setChecklistItems((prev) => prev.map((it) => it.id === itemId ? { ...it, is_done: isDone } : it))
    startTransition(async () => {
      const result = await toggleChecklistItem(itemId, workspaceId, isDone)
      if ('error' in result && result.error) {
        onMessage({ type: 'error', text: result.error })
        await loadChecklist()
      }
    })
  }

  function handleDeleteChecklistItem(itemId: string) {
    setChecklistItems((prev) => prev.filter((it) => it.id !== itemId))
    startTransition(async () => {
      const result = await deleteChecklistItem(itemId, workspaceId)
      if ('error' in result && result.error) {
        onMessage({ type: 'error', text: result.error })
        await loadChecklist()
      }
    })
  }

  function handleAddComment() {
    if (!newComment.trim()) return
    startTransition(async () => {
      const result = await addTaskComment(task.id, workspaceId, newComment)
      if ('error' in result && result.error) {
        onMessage({ type: 'error', text: result.error })
      } else {
        setNewComment('')
        await loadComments()
      }
    })
  }

  const checklistDone = checklistItems.filter((it) => it.is_done).length
  const checklistTotal = checklistItems.length
  const checklistPercent = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0

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
                {members.length > 0 ? (
                  <select value={responsible} onChange={(e) => setResponsible(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold/60">
                    <option value="">Sem responsável</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                ) : (
                  <input value={responsible} onChange={(e) => setResponsible(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold/60" />
                )}
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

            {/* Tags display */}
            {task.tags && task.tags.length > 0 && (
              <div>
                <label className="block text-xs text-text-muted mb-1">Tags</label>
                <div className="flex flex-wrap gap-1">
                  {task.tags.map((tag) => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded bg-brand-gold/15 text-brand-gold">{tag}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Attached file */}
            {task.file_url && task.file_name && (
              <div>
                <label className="block text-xs text-text-muted mb-1">Arquivo anexado</label>
                <a
                  href={task.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-400/10 border border-blue-400/20 text-blue-400 text-xs hover:bg-blue-400/20 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></svg>
                  {task.file_name}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                </a>
              </div>
            )}

            {/* Origin info + creator */}
            {isAdmin && task.sessions && (
              <div className="text-xs text-text-muted bg-bg-surface/50 rounded-lg p-3 border border-border">
                Origem: Sessão IA — {task.sessions.title}
                {task.creator && <span className="block mt-1">Criado por: {task.creator.name}</span>}
              </div>
            )}
            {isAdmin && !task.sessions && (
              <div className="text-xs text-text-muted bg-bg-surface/50 rounded-lg p-3 border border-border">
                Origem: Criada manualmente
                {task.creator && <span className="block mt-1">Criado por: {task.creator.name}</span>}
              </div>
            )}

            {/* ── Checklist ── */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-text-secondary">Checklist</label>
                {checklistTotal > 0 && (
                  <span className="text-[10px] text-text-muted">{checklistDone}/{checklistTotal}</span>
                )}
              </div>

              {checklistTotal > 0 && (
                <div className="w-full h-1.5 bg-bg-surface rounded-full mb-3 overflow-hidden">
                  <div className="h-full bg-green-400 rounded-full transition-all duration-300" style={{ width: `${checklistPercent}%` }} />
                </div>
              )}

              {loadingChecklist ? (
                <p className="text-xs text-text-muted">Carregando...</p>
              ) : (
                <div className="space-y-1">
                  {checklistItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 group">
                      <button
                        onClick={() => handleToggleChecklistItem(item.id, !item.is_done)}
                        className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${item.is_done ? 'bg-green-400/20 border-green-400 text-green-400' : 'border-border hover:border-brand-gold/50'}`}
                      >
                        {item.is_done && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                      <span className={`flex-1 text-xs ${item.is_done ? 'line-through text-text-muted' : 'text-text-primary'}`}>{item.title}</span>
                      <button
                        onClick={() => handleDeleteChecklistItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 transition-all p-0.5"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 mt-2">
                <input
                  value={newChecklistTitle}
                  onChange={(e) => setNewChecklistTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddChecklistItem() } }}
                  placeholder="Novo item..."
                  className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-bg-base border border-border text-text-primary focus:outline-none focus:border-brand-gold/60 placeholder:text-text-muted"
                />
                <button onClick={handleAddChecklistItem} disabled={isPending || !newChecklistTitle.trim()} className="px-2.5 py-1.5 text-xs rounded-lg bg-brand-gold/15 text-brand-gold hover:bg-brand-gold/25 transition-colors disabled:opacity-40">
                  +
                </button>
              </div>
            </div>

            {/* ── Comments ── */}
            <div className="border-t border-border pt-4">
              <label className="text-xs font-semibold text-text-secondary block mb-2">Comentários</label>

              {loadingComments ? (
                <p className="text-xs text-text-muted">Carregando...</p>
              ) : comments.length === 0 ? (
                <p className="text-xs text-text-muted mb-2">Nenhum comentário ainda.</p>
              ) : (
                <div className="space-y-3 mb-3 max-h-48 overflow-y-auto">
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-2">
                      <div className="w-6 h-6 rounded-full bg-brand-gold/20 text-brand-gold text-[10px] flex items-center justify-center font-semibold shrink-0 mt-0.5">
                        {(c.profiles?.name ?? '?')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-text-primary">{c.profiles?.name ?? 'Usuário'}</span>
                          <span className="text-[10px] text-text-muted">{new Date(c.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-xs text-text-secondary mt-0.5 break-words">{c.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddComment() } }}
                  placeholder="Escreva um comentário..."
                  className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-bg-base border border-border text-text-primary focus:outline-none focus:border-brand-gold/60 placeholder:text-text-muted"
                />
                <button onClick={handleAddComment} disabled={isPending || !newComment.trim()} className="px-3 py-1.5 text-xs rounded-lg bg-brand-gold text-bg-base hover:bg-brand-gold-light transition-colors disabled:opacity-40">
                  Enviar
                </button>
              </div>
            </div>
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
