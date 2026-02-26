'use client'

import { useState, useTransition } from 'react'
import { createWorkspace } from '@/app/actions/workspace'
import { useRouter } from 'next/navigation'

export default function CreateWorkspaceForm() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const nameInput = e.currentTarget.form?.elements.namedItem('name') as HTMLInputElement
    const slugInput = e.currentTarget.form?.elements.namedItem('slug') as HTMLInputElement
    if (slugInput && nameInput) {
      slugInput.value = nameInput.value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await createWorkspace(formData)
      if (result.error) {
        setError(result.error)
      } else {
        router.push(`/admin/workspaces/${result.id}`)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Nome da empresa *</label>
        <input
          name="name"
          required
          placeholder="Ex: Studio Marca X"
          onChange={handleNameChange}
          className="w-full px-4 py-2.5 rounded-lg bg-bg-surface border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition-colors text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Slug (ID único) *</label>
        <input
          name="slug"
          required
          placeholder="studio-marca-x"
          className="w-full px-4 py-2.5 rounded-lg bg-bg-surface border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition-colors text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Plano</label>
        <select
          name="plan_type"
          className="w-full px-4 py-2.5 rounded-lg bg-bg-surface border border-border text-text-primary focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition-colors text-sm"
        >
          <option value="free">Free</option>
          <option value="tracao">Tração</option>
          <option value="club">Club</option>
        </select>
      </div>

      <div className="sm:col-span-3 flex items-center justify-end gap-3">
        {error && <p className="text-error text-sm flex-1">{error}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2.5 rounded-lg bg-brand-gold hover:bg-brand-gold-light text-bg-base text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? 'Criando...' : 'Criar Workspace'}
        </button>
      </div>
    </form>
  )
}
