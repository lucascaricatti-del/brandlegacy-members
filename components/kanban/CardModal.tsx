'use client'

import { useState, useTransition, useEffect } from 'react'
import { updateCard, archiveCard, addComment } from '@/app/actions/kanban'
import type { KanbanPriority } from '@/lib/types/database'

interface Comment {
  id: string
  content: string
  created_at: string
  profiles: { name: string } | null
}

interface Card {
  id: string
  title: string
  description: string | null
  priority: KanbanPriority
  due_date: string | null
  assignee_id: string | null
  column_id: string
  comments?: Comment[]
}

interface Member {
  user_id: string
  profiles: { id: string; name: string } | null
}

interface Props {
  card: Card
  workspaceId: string
  members: Member[]
  onClose: () => void
}

const PRIORITY_COLORS: Record<KanbanPriority, string> = {
  low: 'text-success bg-success/10',
  medium: 'text-info bg-info/10',
  high: 'text-warning bg-warning/10',
  urgent: 'text-error bg-error/10',
}
const PRIORITY_LABELS: Record<KanbanPriority, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente',
}

export default function CardModal({ card, workspaceId, members, onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [comment, setComment] = useState('')
  const [commentPending, startCommentTransition] = useTransition()

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await updateCard(workspaceId, card.id, formData)
      if (result.error) setError(result.error)
      else setSuccess(true)
    })
  }

  function handleArchive() {
    if (!confirm('Arquivar este card?')) return
    startTransition(async () => {
      await archiveCard(workspaceId, card.id)
      onClose()
    })
  }

  function handleAddComment(e: React.FormEvent) {
    e.preventDefault()
    if (!comment.trim()) return
    startCommentTransition(async () => {
      await addComment(workspaceId, card.id, comment)
      setComment('')
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-bg-base/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-semibold text-text-primary">Editar Card</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Título</label>
            <input
              name="title"
              required
              defaultValue={card.title}
              className="w-full px-3 py-2 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Descrição</label>
            <textarea
              name="description"
              rows={3}
              defaultValue={card.description ?? ''}
              className="w-full px-3 py-2 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Prioridade</label>
              <select
                name="priority"
                defaultValue={card.priority}
                className="w-full px-3 py-2 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold"
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Prazo</label>
              <input
                name="due_date"
                type="date"
                defaultValue={card.due_date?.slice(0, 10) ?? ''}
                className="w-full px-3 py-2 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Responsável</label>
            <select
              name="assignee_id"
              defaultValue={card.assignee_id ?? ''}
              className="w-full px-3 py-2 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold"
            >
              <option value="">Sem responsável</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>{m.profiles?.name ?? m.user_id}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-error text-xs">{error}</p>}
          {success && <p className="text-success text-xs">Salvo!</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2 rounded-lg bg-brand-gold text-bg-base text-sm font-medium hover:bg-brand-gold-light transition-colors disabled:opacity-60"
            >
              {isPending ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={handleArchive}
              disabled={isPending}
              className="px-4 py-2 rounded-lg text-error hover:bg-error/10 text-sm transition-colors disabled:opacity-60"
            >
              Arquivar
            </button>
          </div>
        </form>

        {/* Comentários */}
        <div className="px-5 pb-5 border-t border-border pt-4">
          <h3 className="text-xs font-medium text-text-muted mb-3 uppercase tracking-wider">Comentários</h3>
          {(card.comments ?? []).length === 0 && (
            <p className="text-text-muted text-xs mb-3">Nenhum comentário ainda.</p>
          )}
          <div className="space-y-2 mb-3">
            {(card.comments ?? []).map((c) => (
              <div key={c.id} className="p-3 bg-bg-surface rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-text-secondary">{c.profiles?.name ?? '?'}</span>
                  <span className="text-xs text-text-muted">{new Date(c.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
                <p className="text-sm text-text-secondary">{c.content}</p>
              </div>
            ))}
          </div>
          <form onSubmit={handleAddComment} className="flex gap-2">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Adicionar comentário..."
              className="flex-1 px-3 py-2 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold placeholder:text-text-muted"
            />
            <button
              type="submit"
              disabled={commentPending || !comment.trim()}
              className="px-3 py-2 rounded-lg bg-brand-gold/15 text-brand-gold text-sm hover:bg-brand-gold/25 transition-colors disabled:opacity-60"
            >
              ↵
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export { PRIORITY_COLORS, PRIORITY_LABELS }
