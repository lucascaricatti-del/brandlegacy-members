'use client'

import { useState, useRef, useTransition } from 'react'
import { createCard } from '@/app/actions/kanban'

interface Props {
  columnId: string
  workspaceId: string
}

export default function AddCardForm({ columnId, workspaceId }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

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
        // Reset and keep form open for quick adding
        formRef.current?.reset()
        formRef.current?.querySelector('input')?.focus()
      }
    })
  }

  function handleClose() {
    setOpen(false)
    setError(null)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="
          w-full flex items-center gap-1.5 px-3 py-1.5 rounded-lg
          text-text-muted hover:text-text-secondary hover:bg-bg-surface/50
          transition-colors text-sm
        "
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Adicionar card
      </button>
    )
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-1.5">
      <input
        name="title"
        required
        autoFocus
        placeholder="Título do card..."
        onKeyDown={(e) => { if (e.key === 'Escape') handleClose() }}
        className="
          w-full px-3 py-2 rounded-lg bg-bg-card border border-border
          text-text-primary text-sm shadow-sm
          focus:outline-none focus:border-brand-gold/60
          placeholder:text-text-muted
        "
      />
      {error && <p className="text-red-400 text-xs px-1">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="
            px-3 py-1.5 rounded-lg bg-brand-gold text-bg-base
            text-xs font-medium hover:bg-brand-gold-light
            transition-colors disabled:opacity-60
          "
        >
          {isPending ? '...' : 'Adicionar'}
        </button>
        <button
          type="button"
          onClick={handleClose}
          className="text-text-muted hover:text-text-primary transition-colors p-1"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </form>
  )
}
