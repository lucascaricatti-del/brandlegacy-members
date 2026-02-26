'use client'

import { useState, useTransition } from 'react'
import { grantContentAccess, revokeContentAccess } from '@/app/actions/workspace'

interface Props {
  workspaceId: string
  masterclasses: { id: string; title: string }[]
  grantedModuleIds: string[]
}

export default function ContentAccessManager({ workspaceId, masterclasses, grantedModuleIds }: Props) {
  const [granted, setGranted] = useState<Set<string>>(new Set(grantedModuleIds))
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleToggle(moduleId: string) {
    const isGranted = granted.has(moduleId)
    setError(null)

    // Optimistic update
    const newGranted = new Set(granted)
    if (isGranted) {
      newGranted.delete(moduleId)
    } else {
      newGranted.add(moduleId)
    }
    setGranted(newGranted)

    startTransition(async () => {
      const result = isGranted
        ? await revokeContentAccess(workspaceId, moduleId)
        : await grantContentAccess(workspaceId, moduleId)

      if (result.error) {
        // Rollback
        setGranted(granted)
        setError(result.error)
      }
    })
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-error text-xs mb-2">{error}</p>}
      {masterclasses.map((mc) => {
        const isGranted = granted.has(mc.id)

        return (
          <div
            key={mc.id}
            className={`
              flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer
              ${isGranted
                ? 'bg-success/10 border-success/30'
                : 'bg-bg-surface border-border hover:border-brand-gold/30'
              }
            `}
            onClick={() => !isPending && handleToggle(mc.id)}
          >
            <span className={`text-sm font-medium truncate flex-1 mr-2 ${isGranted ? 'text-success' : 'text-text-secondary'}`}>
              {mc.title}
            </span>
            <div
              className={`
                w-8 h-5 rounded-full flex items-center transition-all shrink-0
                ${isGranted ? 'bg-success justify-end pr-0.5' : 'bg-bg-hover justify-start pl-0.5'}
              `}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
            </div>
          </div>
        )
      })}
    </div>
  )
}
