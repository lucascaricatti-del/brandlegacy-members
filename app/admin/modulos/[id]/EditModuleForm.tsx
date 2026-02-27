'use client'

import { useState, useTransition } from 'react'
import { updateModule } from '@/app/actions/admin'
import type { Module } from '@/lib/types/database'

const CONTENT_TYPE_LABEL: Record<string, string> = {
  course: 'Aula',
  masterclass: 'Masterclass',
}

export default function EditModuleForm({ module: mod }: { module: Module }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [contentType, setContentType] = useState<'course' | 'masterclass'>(
    mod.content_type === 'masterclass' ? 'masterclass' : 'course'
  )

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await updateModule(mod.id, formData)
      if (result.error) setError(result.error)
      else setSuccess(true)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Título *</label>
        <input
          name="title"
          required
          defaultValue={mod.title}
          className="w-full px-4 py-2.5 rounded-lg bg-bg-surface border border-border text-text-primary focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition-colors text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Ordem</label>
        <input
          name="order_index"
          type="number"
          defaultValue={mod.order_index}
          min={0}
          className="w-full px-4 py-2.5 rounded-lg bg-bg-surface border border-border text-text-primary focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition-colors text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Tipo de conteúdo</label>
        <select
          name="content_type"
          value={contentType}
          onChange={(e) => setContentType(e.target.value as 'course' | 'masterclass')}
          className="w-full px-4 py-2.5 rounded-lg bg-bg-surface border border-border text-text-primary focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition-colors text-sm"
        >
          <option value="course">Aula (acesso por plano)</option>
          <option value="masterclass">Masterclass (liberação manual)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Categoria Academy</label>
        <select
          name="category"
          defaultValue={mod.category ?? 'mentoria'}
          className="w-full px-4 py-2.5 rounded-lg bg-bg-surface border border-border text-text-primary focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition-colors text-sm"
        >
          <option value="mentoria">Aula de Mentoria</option>
          <option value="masterclass">Masterclass</option>
          <option value="free_class">Aula Gravada (pública)</option>
        </select>
      </div>

      {contentType === 'course' && (
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Plano mínimo</label>
          <select
            name="min_plan"
            defaultValue={mod.min_plan ?? 'free'}
            className="w-full px-4 py-2.5 rounded-lg bg-bg-surface border border-border text-text-primary focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition-colors text-sm"
          >
            <option value="free">Todos</option>
            <option value="tracao">Ambos (Tração + Club)</option>
            <option value="club">Exclusivo Club</option>
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Descrição</label>
        <textarea
          name="description"
          rows={3}
          defaultValue={mod.description ?? ''}
          className="w-full px-4 py-2.5 rounded-lg bg-bg-surface border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition-colors text-sm resize-none"
        />
      </div>

      <label className="flex items-center gap-2.5 cursor-pointer">
        <input type="hidden" name="is_published" value="false" />
        <input
          type="checkbox"
          name="is_published"
          value="true"
          defaultChecked={mod.is_published}
          className="w-4 h-4 accent-brand-gold"
        />
        <span className="text-sm text-text-secondary">Publicado</span>
      </label>

      {error && <p className="text-error text-sm">{error}</p>}
      {success && (
        <p className="text-success text-sm">
          Módulo atualizado! Tipo: {CONTENT_TYPE_LABEL[contentType]}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-2.5 rounded-lg bg-brand-gold hover:bg-brand-gold-light text-bg-base text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? 'Salvando...' : 'Salvar Alterações'}
      </button>
    </form>
  )
}
