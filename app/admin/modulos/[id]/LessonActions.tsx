'use client'

import { useTransition } from 'react'
import { toggleLessonPublished, deleteLesson } from '@/app/actions/admin'

interface Props {
  lessonId: string
  moduleId: string
  isPublished: boolean
}

export default function LessonActions({ lessonId, moduleId, isPublished }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    startTransition(async () => {
      await toggleLessonPublished(lessonId, moduleId, isPublished)
    })
  }

  function handleDelete() {
    if (!confirm('Deletar esta aula? Esta ação não pode ser desfeita.')) return
    startTransition(async () => {
      await deleteLesson(lessonId, moduleId)
    })
  }

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={`text-xs px-2.5 py-1 rounded-lg font-medium border transition-all disabled:opacity-50 ${
          isPublished
            ? 'bg-warning/10 text-warning border-warning/20 hover:bg-warning/20'
            : 'bg-success/10 text-success border-success/20 hover:bg-success/20'
        }`}
      >
        {isPublished ? 'Ocultar' : 'Publicar'}
      </button>
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="text-xs px-2.5 py-1 rounded-lg bg-error/10 text-error border border-error/20 hover:bg-error/20 transition-all disabled:opacity-50"
      >
        Deletar
      </button>
    </div>
  )
}
