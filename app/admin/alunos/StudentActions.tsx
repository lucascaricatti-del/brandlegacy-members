'use client'

import { useState, useTransition } from 'react'
import { toggleStudentActive, setStudentRole } from '@/app/actions/admin'

interface Props {
  studentId: string
  isActive: boolean
  role: 'student' | 'admin'
  currentUserId: string
}

export default function StudentActions({ studentId, isActive, role, currentUserId }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const isSelf = studentId === currentUserId

  function handleToggleActive() {
    startTransition(async () => {
      const result = await toggleStudentActive(studentId, isActive)
      if (result.error) setError(result.error)
    })
  }

  function handleToggleRole() {
    startTransition(async () => {
      const newRole = role === 'admin' ? 'student' : 'admin'
      const result = await setStudentRole(studentId, newRole)
      if (result.error) setError(result.error)
    })
  }

  if (isSelf) {
    return <span className="text-xs text-text-muted px-2">Você</span>
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-error text-xs">{error}</span>}
      <button
        onClick={handleToggleActive}
        disabled={isPending}
        className={`
          text-xs px-3 py-1.5 rounded-lg font-medium transition-all
          disabled:opacity-50 disabled:cursor-not-allowed
          ${isActive
            ? 'bg-error/10 text-error hover:bg-error/20 border border-error/20'
            : 'bg-success/10 text-success hover:bg-success/20 border border-success/20'
          }
        `}
      >
        {isActive ? 'Desativar' : 'Ativar'}
      </button>
      <button
        onClick={handleToggleRole}
        disabled={isPending}
        className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all bg-bg-surface text-text-muted hover:bg-bg-hover border border-border disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {role === 'admin' ? 'Tornar Aluno' : 'Tornar Admin'}
      </button>
    </div>
  )
}
