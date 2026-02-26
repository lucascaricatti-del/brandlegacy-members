'use client'

import { useState, useTransition } from 'react'
import { addContactLog } from '@/app/actions/interno'

export default function ContactLogForm({ workspaceId }: { workspaceId: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await addContactLog(workspaceId, formData)
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        ;(e.target as HTMLFormElement).reset()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">Tipo</label>
          <select
            name="contact_type"
            className="w-full px-2.5 py-1.5 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold"
          >
            <option value="call">Ligação</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
            <option value="meeting">Reunião</option>
            <option value="note">Nota</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">Próxima ação</label>
          <input
            name="next_action_date"
            type="date"
            className="w-full px-2.5 py-1.5 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-muted mb-1">Resumo *</label>
        <textarea
          name="summary"
          required
          rows={2}
          placeholder="O que aconteceu neste contato?"
          className="w-full px-2.5 py-1.5 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold resize-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-text-muted mb-1">Próxima ação (descrição)</label>
        <input
          name="next_action"
          type="text"
          placeholder="Ex: Enviar proposta de renovação"
          className="w-full px-2.5 py-1.5 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold"
        />
      </div>

      {error && <p className="text-error text-xs">{error}</p>}
      {success && <p className="text-success text-xs">Contato registrado!</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-2 rounded-lg bg-brand-gold/15 text-brand-gold border border-brand-gold/30 hover:bg-brand-gold/25 text-sm font-medium transition-colors disabled:opacity-60"
      >
        {isPending ? 'Salvando...' : 'Registrar Contato'}
      </button>
    </form>
  )
}
