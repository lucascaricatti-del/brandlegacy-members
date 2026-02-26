'use client'

import { useState, useTransition } from 'react'
import { createLesson } from '@/app/actions/admin'

interface Props {
  moduleId: string
  currentLessonsCount: number
}

export default function CreateLessonForm({ moduleId, currentLessonsCount }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await createLesson(moduleId, formData)
      if (result.error) setError(result.error)
      else (e.target as HTMLFormElement).reset()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Título da Aula *</label>
          <input
            name="title"
            required
            placeholder="Ex: Introdução ao Posicionamento de Marca"
            className="w-full px-4 py-2.5 rounded-lg bg-bg-surface border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition-colors text-sm"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-text-secondary mb-1.5">URL do Vídeo</label>
          <input
            name="video_url"
            type="url"
            placeholder="https://youtu.be/... ou URL embed do Panda Video"
            className="w-full px-4 py-2.5 rounded-lg bg-bg-surface border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition-colors text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Plataforma do Vídeo</label>
          <select
            name="video_type"
            defaultValue="youtube"
            className="w-full px-4 py-2.5 rounded-lg bg-bg-surface border border-border text-text-primary focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition-colors text-sm"
          >
            <option value="youtube">YouTube</option>
            <option value="panda">Panda Video</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Duração (minutos)</label>
          <input
            name="duration_minutes"
            type="number"
            defaultValue={0}
            min={0}
            className="w-full px-4 py-2.5 rounded-lg bg-bg-surface border border-border text-text-primary focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition-colors text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Ordem</label>
          <input
            name="order_index"
            type="number"
            defaultValue={currentLessonsCount + 1}
            min={0}
            className="w-full px-4 py-2.5 rounded-lg bg-bg-surface border border-border text-text-primary focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition-colors text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Descrição</label>
          <input
            name="description"
            placeholder="Breve descrição da aula"
            className="w-full px-4 py-2.5 rounded-lg bg-bg-surface border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition-colors text-sm"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
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
            {isPending ? 'Criando...' : 'Adicionar Aula'}
          </button>
        </div>
      </div>
    </form>
  )
}
