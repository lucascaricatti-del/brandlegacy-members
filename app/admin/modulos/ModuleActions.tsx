'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toggleModulePublished, deleteModule } from '@/app/actions/admin'
import Link from 'next/link'

interface Props {
  moduleId: string
  isPublished: boolean
}

export default function ModuleActions({ moduleId, isPublished }: Props) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleToggle() {
    startTransition(async () => {
      await toggleModulePublished(moduleId, isPublished)
    })
  }

  function handleDelete() {
    if (!confirm('Tem certeza? Isso vai deletar o módulo e todas as aulas dentro dele.')) return
    startTransition(async () => {
      await deleteModule(moduleId)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/admin/modulos/${moduleId}`}
        className="text-xs px-3 py-1.5 rounded-lg bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-border transition-all"
      >
        Editar
      </Link>
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-all disabled:opacity-50 ${
          isPublished
            ? 'bg-warning/10 text-warning border-warning/20 hover:bg-warning/20'
            : 'bg-success/10 text-success border-success/20 hover:bg-success/20'
        }`}
      >
        {isPublished ? 'Despublicar' : 'Publicar'}
      </button>
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="text-xs px-3 py-1.5 rounded-lg bg-error/10 text-error border border-error/20 hover:bg-error/20 transition-all disabled:opacity-50"
      >
        Deletar
      </button>
    </div>
  )
}
