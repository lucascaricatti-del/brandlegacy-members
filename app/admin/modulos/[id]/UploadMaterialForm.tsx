'use client'

import { useState, useTransition, useRef } from 'react'
import { createMaterial } from '@/app/actions/admin'

interface Props {
  moduleId?: string
  lessonId?: string
  compact?: boolean
}

export default function UploadMaterialForm({ moduleId, lessonId, compact }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await createMaterial(formData)
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        formRef.current?.reset()
        setTimeout(() => setSuccess(false), 3000)
      }
    })
  }

  if (compact) {
    return (
      <form ref={formRef} onSubmit={handleSubmit} className="mt-2">
        {lessonId && <input type="hidden" name="lesson_id" value={lessonId} />}
        {moduleId && <input type="hidden" name="module_id" value={moduleId} />}
        <div className="flex items-center gap-2">
          <input
            name="title"
            required
            placeholder="Nome do material"
            className="flex-1 px-2.5 py-1.5 rounded-md bg-bg-surface border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-gold transition-colors text-xs"
          />
          <input
            name="file"
            type="file"
            required
            accept=".pdf,.zip,.png,.jpg,.jpeg"
            className="text-xs text-text-muted file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-bg-hover file:text-text-secondary file:text-xs cursor-pointer"
          />
          <button
            type="submit"
            disabled={isPending}
            className="px-3 py-1.5 rounded-md bg-brand-gold/20 text-brand-gold border border-brand-gold/30 hover:bg-brand-gold/30 text-xs font-medium transition-colors disabled:opacity-50 shrink-0"
          >
            {isPending ? '...' : 'Upload'}
          </button>
        </div>
        {error && <p className="text-error text-xs mt-1">{error}</p>}
        {success && <p className="text-success text-xs mt-1">Material adicionado!</p>}
      </form>
    )
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      {lessonId && <input type="hidden" name="lesson_id" value={lessonId} />}
      {moduleId && <input type="hidden" name="module_id" value={moduleId} />}

      <div>
        <label className="block text-xs font-medium text-text-muted mb-1">Nome do arquivo</label>
        <input
          name="title"
          required
          placeholder="Ex: Guia de Posicionamento.pdf"
          className="w-full px-3 py-2 rounded-lg bg-bg-surface border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-gold transition-colors text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-text-muted mb-1">Arquivo (PDF, ZIP, imagens)</label>
        <input
          name="file"
          type="file"
          required
          accept=".pdf,.zip,.png,.jpg,.jpeg"
          className="w-full text-sm text-text-muted file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand-gold/15 file:text-brand-gold file:text-sm file:font-medium cursor-pointer hover:file:bg-brand-gold/25 transition-all"
        />
      </div>

      {error && <p className="text-error text-sm">{error}</p>}
      {success && <p className="text-success text-sm">Material enviado com sucesso!</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-2 rounded-lg bg-brand-gold/15 text-brand-gold border border-brand-gold/30 hover:bg-brand-gold/25 text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? 'Enviando...' : 'Enviar Material'}
      </button>
    </form>
  )
}
