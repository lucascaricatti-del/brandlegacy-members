'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import {
  updateCard,
  archiveCard,
  addComment,
  moveCard,
  updateCardLabels,
  addCardAttachment,
  removeCardAttachment,
} from '@/app/actions/kanban'
import type { KanbanPriority, CardLabel, CardAttachment } from '@/lib/types/database'
import type { CardData, Member, ColumnMeta } from './Board'

// ── Constants ──────────────────────────────────────────────

const PRIORITY_OPTIONS: { value: KanbanPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Baixa', color: 'bg-blue-400' },
  { value: 'medium', label: 'Média', color: 'bg-yellow-400' },
  { value: 'high', label: 'Alta', color: 'bg-orange-400' },
  { value: 'urgent', label: 'Urgente', color: 'bg-red-400' },
]

const LABEL_COLORS = [
  '#22c55e', '#eab308', '#f97316', '#ef4444', '#a855f7',
  '#3b82f6', '#ec4899', '#0ea5e9', '#84cc16',
]

// ── Props ──────────────────────────────────────────────────

interface Props {
  card: CardData
  workspaceId: string
  members: Member[]
  allColumns: ColumnMeta[]
  onClose: () => void
}

// ── Component ──────────────────────────────────────────────

export default function CardModal({ card, workspaceId, members, allColumns, onClose }: Props) {
  // ── State ──
  const [title, setTitle] = useState(card.title)
  const [editingTitle, setEditingTitle] = useState(false)
  const [description, setDescription] = useState(card.description ?? '')
  const [editingDesc, setEditingDesc] = useState(false)
  const [priority, setPriority] = useState<KanbanPriority>(card.priority)
  const [dueDate, setDueDate] = useState(card.due_date?.slice(0, 10) ?? '')
  const [assigneeId, setAssigneeId] = useState(card.assignee_id ?? '')
  const [labels, setLabels] = useState<CardLabel[]>(card.labels ?? [])
  const [attachments, setAttachments] = useState<CardAttachment[]>(card.attachments ?? [])
  const [comment, setComment] = useState('')

  // Label picker
  const [showLabelPicker, setShowLabelPicker] = useState(false)
  const [newLabelText, setNewLabelText] = useState('')
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0])

  // Attachment form
  const [showAttachForm, setShowAttachForm] = useState(false)
  const [attachTitle, setAttachTitle] = useState('')
  const [attachUrl, setAttachUrl] = useState('')

  // Transitions
  const [savePending, startSaveTransition] = useTransition()
  const [commentPending, startCommentTransition] = useTransition()
  const [labelPending, startLabelTransition] = useTransition()
  const [attachPending, startAttachTransition] = useTransition()
  const [movePending, startMoveTransition] = useTransition()

  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const titleRef = useRef<HTMLInputElement>(null)

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  // ── Handlers ──

  function handleSave() {
    setError(null)
    setSaved(false)
    const formData = new FormData()
    formData.set('title', title)
    formData.set('description', description)
    formData.set('priority', priority)
    formData.set('due_date', dueDate)
    formData.set('assignee_id', assigneeId)
    startSaveTransition(async () => {
      const result = await updateCard(workspaceId, card.id, formData)
      if (result.error) setError(result.error)
      else setSaved(true)
    })
  }

  function handleArchive() {
    if (!confirm('Arquivar este card?')) return
    startSaveTransition(async () => {
      await archiveCard(workspaceId, card.id)
      onClose()
    })
  }

  function handleMove(columnId: string) {
    if (columnId === card.column_id) return
    startMoveTransition(async () => {
      await moveCard(workspaceId, card.id, columnId, 0)
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

  function handleAddLabel() {
    if (!newLabelText.trim()) return
    const newLabel: CardLabel = {
      id: crypto.randomUUID(),
      text: newLabelText.trim(),
      color: newLabelColor,
    }
    const updated = [...labels, newLabel]
    setLabels(updated)
    setNewLabelText('')
    startLabelTransition(async () => {
      await updateCardLabels(workspaceId, card.id, updated)
    })
  }

  function handleRemoveLabel(labelId: string) {
    const updated = labels.filter((l) => l.id !== labelId)
    setLabels(updated)
    startLabelTransition(async () => {
      await updateCardLabels(workspaceId, card.id, updated)
    })
  }

  function handleAddAttachment() {
    if (!attachTitle.trim() || !attachUrl.trim()) return
    startAttachTransition(async () => {
      const result = await addCardAttachment(workspaceId, card.id, attachTitle, attachUrl)
      if (!result.error) {
        const newAtt: CardAttachment = {
          id: crypto.randomUUID(),
          title: attachTitle.trim(),
          url: attachUrl.trim(),
          created_at: new Date().toISOString(),
        }
        setAttachments((prev) => [...prev, newAtt])
        setAttachTitle('')
        setAttachUrl('')
        setShowAttachForm(false)
      }
    })
  }

  function handleRemoveAttachment(attId: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== attId))
    startAttachTransition(async () => {
      await removeCardAttachment(workspaceId, card.id, attId)
    })
  }

  // ── Auto-save on field change ──
  function handleFieldChange(field: 'priority' | 'assignee' | 'due_date', value: string) {
    if (field === 'priority') setPriority(value as KanbanPriority)
    else if (field === 'assignee') setAssigneeId(value)
    else if (field === 'due_date') setDueDate(value)

    // Auto-save after change
    const formData = new FormData()
    formData.set('title', title)
    formData.set('description', description)
    formData.set('priority', field === 'priority' ? value : priority)
    formData.set('due_date', field === 'due_date' ? value : dueDate)
    formData.set('assignee_id', field === 'assignee' ? value : assigneeId)
    startSaveTransition(async () => {
      const result = await updateCard(workspaceId, card.id, formData)
      if (result.error) setError(result.error)
    })
  }

  // Current column name
  const currentCol = allColumns.find((c) => c.id === card.column_id)

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 pt-[8vh] overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-bg-card border border-border rounded-xl w-full max-w-[768px] shadow-2xl">
        {/* ── Header ── */}
        <div className="flex items-start gap-3 p-5 pb-3">
          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <input
                ref={titleRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => { setEditingTitle(false); handleSave() }}
                onKeyDown={(e) => { if (e.key === 'Enter') { setEditingTitle(false); handleSave() } }}
                autoFocus
                className="w-full text-lg font-semibold text-text-primary bg-transparent border-b border-brand-gold focus:outline-none pb-0.5"
              />
            ) : (
              <h2
                onClick={() => { setEditingTitle(true); setTimeout(() => titleRef.current?.focus(), 0) }}
                className="text-lg font-semibold text-text-primary cursor-pointer hover:text-brand-gold transition-colors"
              >
                {title}
              </h2>
            )}
            {currentCol && (
              <p className="text-xs text-text-muted mt-1">
                em <span className="text-text-secondary font-medium">{currentCol.title}</span>
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors p-1 shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ── Labels display ── */}
        {labels.length > 0 && (
          <div className="flex gap-1.5 flex-wrap px-5 pb-3">
            {labels.map((label) => (
              <span
                key={label.id}
                className="text-[11px] font-medium text-white px-2.5 py-0.5 rounded-full"
                style={{ backgroundColor: label.color }}
              >
                {label.text}
              </span>
            ))}
          </div>
        )}

        {/* ── Body: Two columns ── */}
        <div className="flex flex-col md:flex-row gap-0 md:gap-5 px-5 pb-5">
          {/* ── Main content (left) ── */}
          <div className="flex-1 min-w-0 space-y-5">
            {/* Description */}
            <div>
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Descrição</h3>
              {editingDesc ? (
                <div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    autoFocus
                    className="w-full px-3 py-2 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold resize-y"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => { setEditingDesc(false); handleSave() }}
                      disabled={savePending}
                      className="px-3 py-1.5 rounded-lg bg-brand-gold text-bg-base text-xs font-medium hover:bg-brand-gold-light transition-colors disabled:opacity-60"
                    >
                      Salvar
                    </button>
                    <button
                      onClick={() => { setEditingDesc(false); setDescription(card.description ?? '') }}
                      className="px-3 py-1.5 rounded-lg text-text-muted text-xs hover:bg-bg-hover transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setEditingDesc(true)}
                  className="min-h-[60px] px-3 py-2 rounded-lg bg-bg-surface/50 border border-transparent hover:border-border cursor-pointer transition-colors"
                >
                  {description ? (
                    <p className="text-sm text-text-secondary whitespace-pre-wrap">{description}</p>
                  ) : (
                    <p className="text-sm text-text-muted">Adicionar uma descrição...</p>
                  )}
                </div>
              )}
            </div>

            {/* Attachments list */}
            {attachments.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Anexos</h3>
                <div className="space-y-1.5">
                  {attachments.map((att) => (
                    <div key={att.id} className="flex items-center gap-3 px-3 py-2 bg-bg-surface rounded-lg border border-border group">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted shrink-0">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                      </svg>
                      <a
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-sm text-brand-gold hover:text-brand-gold-light truncate transition-colors"
                      >
                        {att.title}
                      </a>
                      <button
                        onClick={() => handleRemoveAttachment(att.id)}
                        disabled={attachPending}
                        className="text-text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comments */}
            <div>
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Comentários</h3>
              <form onSubmit={handleAddComment} className="flex gap-2 mb-3">
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Escreva um comentário..."
                  className="flex-1 px-3 py-2 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold placeholder:text-text-muted"
                />
                <button
                  type="submit"
                  disabled={commentPending || !comment.trim()}
                  className="px-3 py-2 rounded-lg bg-brand-gold/15 text-brand-gold text-sm hover:bg-brand-gold/25 transition-colors disabled:opacity-40"
                >
                  Enviar
                </button>
              </form>
              {(card.comments ?? []).length === 0 && (
                <p className="text-text-muted text-xs">Nenhum comentário ainda.</p>
              )}
              <div className="space-y-2">
                {(card.comments ?? []).map((c) => (
                  <div key={c.id} className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-bg-surface flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-text-muted text-[10px] font-semibold">
                        {c.profiles?.name?.[0]?.toUpperCase() ?? '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium text-text-secondary">{c.profiles?.name ?? '?'}</span>
                        <span className="text-[10px] text-text-muted">
                          {new Date(c.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm text-text-secondary">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Sidebar (right) ── */}
          <div className="w-full md:w-[200px] shrink-0 space-y-3 mt-5 md:mt-0 border-t md:border-t-0 border-border pt-4 md:pt-0">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-1">Ações</p>

            {/* Assignee */}
            <div>
              <label className="block text-[10px] font-medium text-text-muted mb-1 uppercase tracking-wider">Responsável</label>
              <select
                value={assigneeId}
                onChange={(e) => handleFieldChange('assignee', e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-bg-surface border border-border text-text-primary text-xs focus:outline-none focus:border-brand-gold"
              >
                <option value="">Nenhum</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>{m.profiles?.name ?? m.user_id}</option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-[10px] font-medium text-text-muted mb-1 uppercase tracking-wider">Prioridade</label>
              <div className="space-y-1">
                {PRIORITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleFieldChange('priority', opt.value)}
                    className={`
                      w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-2
                      ${priority === opt.value
                        ? 'bg-bg-surface border border-brand-gold/40 text-text-primary'
                        : 'border border-transparent hover:bg-bg-surface text-text-secondary'
                      }
                    `}
                  >
                    <div className={`w-2 h-2 rounded-full ${opt.color}`} />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Due date */}
            <div>
              <label className="block text-[10px] font-medium text-text-muted mb-1 uppercase tracking-wider">Data de entrega</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => handleFieldChange('due_date', e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-bg-surface border border-border text-text-primary text-xs focus:outline-none focus:border-brand-gold"
              />
            </div>

            {/* Labels */}
            <div>
              <label className="block text-[10px] font-medium text-text-muted mb-1 uppercase tracking-wider">Etiquetas</label>
              <div className="space-y-1 mb-1.5">
                {labels.map((label) => (
                  <div key={label.id} className="flex items-center gap-1.5 group">
                    <span
                      className="flex-1 text-[11px] font-medium text-white px-2 py-0.5 rounded truncate"
                      style={{ backgroundColor: label.color }}
                    >
                      {label.text}
                    </span>
                    <button
                      onClick={() => handleRemoveLabel(label.id)}
                      className="text-text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              {showLabelPicker ? (
                <div className="bg-bg-surface border border-border rounded-lg p-2.5 space-y-2">
                  <input
                    value={newLabelText}
                    onChange={(e) => setNewLabelText(e.target.value)}
                    placeholder="Nome da etiqueta"
                    className="w-full px-2 py-1 rounded bg-bg-card border border-border text-text-primary text-xs focus:outline-none focus:border-brand-gold placeholder:text-text-muted"
                  />
                  <div className="flex flex-wrap gap-1">
                    {LABEL_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewLabelColor(color)}
                        className={`w-5 h-5 rounded-full transition-all ${newLabelColor === color ? 'ring-2 ring-white/60 scale-110' : ''}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleAddLabel}
                      disabled={labelPending || !newLabelText.trim()}
                      className="flex-1 px-2 py-1 rounded bg-brand-gold text-bg-base text-[10px] font-medium hover:bg-brand-gold-light disabled:opacity-40"
                    >
                      Criar
                    </button>
                    <button
                      onClick={() => setShowLabelPicker(false)}
                      className="px-2 py-1 rounded text-text-muted text-[10px] hover:bg-bg-hover"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowLabelPicker(true)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg bg-bg-surface border border-border text-text-muted text-xs hover:text-text-secondary hover:border-border-light transition-colors"
                >
                  + Etiqueta
                </button>
              )}
            </div>

            {/* Attachments */}
            <div>
              <label className="block text-[10px] font-medium text-text-muted mb-1 uppercase tracking-wider">Anexos</label>
              {showAttachForm ? (
                <div className="bg-bg-surface border border-border rounded-lg p-2.5 space-y-1.5">
                  <input
                    value={attachTitle}
                    onChange={(e) => setAttachTitle(e.target.value)}
                    placeholder="Título"
                    className="w-full px-2 py-1 rounded bg-bg-card border border-border text-text-primary text-xs focus:outline-none focus:border-brand-gold placeholder:text-text-muted"
                  />
                  <input
                    value={attachUrl}
                    onChange={(e) => setAttachUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-2 py-1 rounded bg-bg-card border border-border text-text-primary text-xs focus:outline-none focus:border-brand-gold placeholder:text-text-muted"
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleAddAttachment}
                      disabled={attachPending || !attachTitle.trim() || !attachUrl.trim()}
                      className="flex-1 px-2 py-1 rounded bg-brand-gold text-bg-base text-[10px] font-medium hover:bg-brand-gold-light disabled:opacity-40"
                    >
                      Adicionar
                    </button>
                    <button
                      onClick={() => setShowAttachForm(false)}
                      className="px-2 py-1 rounded text-text-muted text-[10px] hover:bg-bg-hover"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAttachForm(true)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg bg-bg-surface border border-border text-text-muted text-xs hover:text-text-secondary hover:border-border-light transition-colors"
                >
                  + Anexo
                </button>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-border pt-3 space-y-1.5">
              {/* Move */}
              <div>
                <label className="block text-[10px] font-medium text-text-muted mb-1 uppercase tracking-wider">Mover para</label>
                <div className="space-y-1">
                  {allColumns.map((col) => (
                    <button
                      key={col.id}
                      onClick={() => handleMove(col.id)}
                      disabled={movePending || col.id === card.column_id}
                      className={`
                        w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors
                        ${col.id === card.column_id
                          ? 'bg-brand-gold/10 text-brand-gold border border-brand-gold/30'
                          : 'border border-border text-text-secondary hover:border-brand-gold/30 hover:text-text-primary disabled:opacity-40'
                        }
                      `}
                    >
                      {col.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Archive */}
              <button
                onClick={handleArchive}
                disabled={savePending}
                className="w-full text-left px-2.5 py-1.5 rounded-lg bg-bg-surface border border-border text-red-400 text-xs hover:bg-red-400/10 hover:border-red-400/30 transition-colors disabled:opacity-40"
              >
                Arquivar
              </button>
            </div>
          </div>
        </div>

        {/* ── Footer status ── */}
        {(error || saved) && (
          <div className="px-5 pb-3">
            {error && <p className="text-red-400 text-xs">{error}</p>}
            {saved && <p className="text-green-400 text-xs">Salvo!</p>}
          </div>
        )}
      </div>
    </div>
  )
}
