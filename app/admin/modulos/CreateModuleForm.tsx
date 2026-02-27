'use client'

import { useState, useTransition } from 'react'
import { createModule } from '@/app/actions/admin'
import { useRouter } from 'next/navigation'

export default function CreateModuleForm() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [contentType, setContentType] = useState<'course' | 'masterclass'>('course')
  const router = useRouter()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await createModule(formData)
      if (result.error) {
        setError(result.error)
      } else {
        ;(e.target as HTMLFormElement).reset()
        router.push(`/admin/modulos/${result.id}`)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Título *</label>
        <input
          name="title"
          required
          placeholder="Ex: Master Class — Posicionamento"
          className="w-full px-4 py-2.5 rounded-lg bg-bg-surface border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition-colors text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Ordem</label>
        <input
          name="order_index"
          type="number"
          defaultValue={1}
          min={0}
          className="w-full px-4 py-2.5 rounded-lg bg-bg-surface border border-border text-text-primary focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition-colors text-sm"
        />
      </div>

      {/* Tipo de conteúdo */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Tipo de conteúdo</label>
        <select
          name="content_type"
          value={contentType}
          onChange={(e) => setContentType(e.target.value as typeof contentType)}
          className="w-full px-4 py-2.5 rounded-lg bg-bg-surface border border-border text-text-primary focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition-colors text-sm"
        >
          <option value="course">Aula (acesso por plano)</option>
          <option value="masterclass">Masterclass (liberação manual)</option>
        </select>
      </div>

      {/* Categoria Academy */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Categoria Academy</label>
        <select
          name="category"
          className="w-full px-4 py-2.5 rounded-lg bg-bg-surface border border-border text-text-primary focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition-colors text-sm"
        >
          <option value="mentoria">Aula de Mentoria</option>
          <option value="masterclass">Masterclass</option>
          <option value="free_class">Aula Gravada (pública)</option>
        </select>
      </div>

      {/* min_plan: só aparece para course */}
      {contentType === 'course' && (
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Plano mínimo</label>
          <select
            name="min_plan"
            className="w-full px-4 py-2.5 rounded-lg bg-bg-surface border border-border text-text-primary focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition-colors text-sm"
          >
            <option value="free">Todos</option>
            <option value="tracao">Ambos (Tração + Club)</option>
            <option value="club">Exclusivo Club</option>
          </select>
        </div>
      )}

      <div className="sm:col-span-2">
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Descrição</label>
        <textarea
          name="description"
          rows={2}
          placeholder="Descrição breve"
          className="w-full px-4 py-2.5 rounded-lg bg-bg-surface border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition-colors text-sm resize-none"
        />
      </div>

      <div className="sm:col-span-2 flex items-center justify-between">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="hidden" name="is_published" value="false" />
          <input type="checkbox" name="is_published" value="true" className="w-4 h-4 accent-brand-gold" />
          <span className="text-sm text-text-secondary">Publicar imediatamente</span>
        </label>
        <div className="flex items-center gap-3">
          {error && <p className="text-error text-sm">{error}</p>}
          <button
            type="submit"
            disabled={isPending}
            className="px-5 py-2.5 rounded-lg bg-brand-gold hover:bg-brand-gold-light text-bg-base text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isPending ? 'Criando...' : 'Criar Módulo'}
          </button>
        </div>
      </div>
    </form>
  )
}
