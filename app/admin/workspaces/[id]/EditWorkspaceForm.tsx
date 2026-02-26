'use client'

import { useState, useTransition } from 'react'
import { updateWorkspace } from '@/app/actions/workspace'
import type { Workspace } from '@/lib/types/database'

export default function EditWorkspaceForm({ workspace: ws }: { workspace: Workspace }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await updateWorkspace(ws.id, formData)
      if (result.error) setError(result.error)
      else setSuccess(true)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Nome *</label>
        <input
          name="name"
          required
          defaultValue={ws.name}
          className="w-full px-4 py-2.5 rounded-lg bg-bg-surface border border-border text-text-primary focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition-colors text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Plano</label>
        <select
          name="plan_type"
          defaultValue={ws.plan_type}
          className="w-full px-4 py-2.5 rounded-lg bg-bg-surface border border-border text-text-primary focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition-colors text-sm"
        >
          <option value="free">Free</option>
          <option value="tracao">Tração</option>
          <option value="club">Club</option>
        </select>
      </div>

      <label className="flex items-center gap-2.5 cursor-pointer">
        <input type="hidden" name="is_active" value="false" />
        <input
          type="checkbox"
          name="is_active"
          value="true"
          defaultChecked={ws.is_active}
          className="w-4 h-4 accent-brand-gold"
        />
        <span className="text-sm text-text-secondary">Workspace ativo</span>
      </label>

      {error && <p className="text-error text-sm">{error}</p>}
      {success && <p className="text-success text-sm">Salvo!</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-2.5 rounded-lg bg-brand-gold hover:bg-brand-gold-light text-bg-base text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? 'Salvando...' : 'Salvar'}
      </button>
    </form>
  )
}
