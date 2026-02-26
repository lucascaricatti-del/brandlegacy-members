'use client'

import { useState, useTransition } from 'react'
import { createCard } from '@/app/actions/kanban'

interface Props {
  columnId: string
  workspaceId: string
}

export default function AddCardForm({ columnId, workspaceId }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set('column_id', columnId)

    startTransition(async () => {
      const result = await createCard(workspaceId, formData)
      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
        ;(e.target as HTMLFormElement).reset()
      }
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors text-sm"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Adicionar card
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input
        name="title"
        required
        autoFocus
        placeholder="Título do card..."
        className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold placeholder:text-text-muted"
      />
      <textarea
        name="description"
        rows={2}
        placeholder="Descrição (opcional)"
        className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold placeholder:text-text-muted resize-none"
      />
      <div className="flex gap-2">
        <select
          name="priority"
          defaultValue="medium"
          className="flex-1 px-3 py-1.5 rounded-lg bg-bg-base border border-border text-text-secondary text-xs focus:outline-none focus:border-brand-gold"
        >
          <option value="low">Baixa</option>
          <option value="medium">Média</option>
          <option value="high">Alta</option>
          <option value="urgent">Urgente</option>
        </select>
        <input
          name="due_date"
          type="date"
          className="flex-1 px-3 py-1.5 rounded-lg bg-bg-base border border-border text-text-secondary text-xs focus:outline-none focus:border-brand-gold"
        />
      </div>
      {error && <p className="text-error text-xs">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 py-1.5 rounded-lg bg-brand-gold/15 text-brand-gold text-xs font-medium hover:bg-brand-gold/25 transition-colors disabled:opacity-60"
        >
          {isPending ? '...' : 'Criar'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null) }}
          className="flex-1 py-1.5 rounded-lg text-text-muted text-xs hover:bg-bg-hover transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
