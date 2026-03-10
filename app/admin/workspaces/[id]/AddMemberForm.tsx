'use client'

import { useState, useTransition } from 'react'
import { addWorkspaceMember } from '@/app/actions/workspace'

export default function AddMemberForm({ workspaceId }: { workspaceId: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await addWorkspaceMember(workspaceId, formData)
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(`${result.name} adicionado!`)
        ;(e.target as HTMLFormElement).reset()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-text-muted mb-1">Email do usuário</label>
        <input
          name="email"
          type="email"
          required
          placeholder="usuario@email.com"
          className="w-full px-3 py-2 rounded-lg bg-bg-surface border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-gold transition-colors text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-text-muted mb-1">Role no workspace</label>
        <select
          name="role"
          className="w-full px-3 py-2 rounded-lg bg-bg-surface border border-border text-text-primary focus:outline-none focus:border-brand-gold transition-colors text-sm"
        >
          <option value="owner">Owner</option>
          <option value="manager">Manager</option>
          <option value="collaborator">Colaborador</option>
          <option value="mentee">Mentorado</option>
        </select>
      </div>
      {error && <p className="text-error text-xs">{error}</p>}
      {success && <p className="text-success text-xs">{success}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="w-full py-2 rounded-lg bg-brand-gold/15 text-brand-gold border border-brand-gold/30 hover:bg-brand-gold/25 text-sm font-medium transition-colors disabled:opacity-60"
      >
        {isPending ? 'Adicionando...' : '+ Adicionar Membro'}
      </button>
    </form>
  )
}
