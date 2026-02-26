'use client'

import { useState, useTransition } from 'react'
import { toggleLessonComplete } from '@/app/actions/lessons'

interface Props {
  lessonId: string
  isCompleted: boolean
}

export default function LessonProgressButton({ lessonId, isCompleted: initialCompleted }: Props) {
  const [completed, setCompleted] = useState(initialCompleted)
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    startTransition(async () => {
      const prev = completed
      setCompleted(!prev) // optimistic update

      const result = await toggleLessonComplete(lessonId, prev)
      if (result.error) {
        setCompleted(prev) // rollback em caso de erro
      }
    })
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
        transition-all shrink-0
        disabled:opacity-60 disabled:cursor-not-allowed
        ${completed
          ? 'bg-success/15 text-success border border-success/30 hover:bg-success/25'
          : 'bg-brand-gold hover:bg-brand-gold-light text-bg-base'
        }
      `}
    >
      {completed ? (
        <>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Concluída
        </>
      ) : (
        <>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 8 12 12 14 14" />
          </svg>
          Marcar como concluída
        </>
      )}
    </button>
  )
}
