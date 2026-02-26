'use client'

import { useTransition } from 'react'
import { toggleMemberActive, removeMember, updateMemberRole } from '@/app/actions/workspace'
import type { WorkspaceRole } from '@/lib/types/database'

interface Props {
  memberId: string
  workspaceId: string
  isActive: boolean
  currentRole: WorkspaceRole
}

export default function MemberActions({ memberId, workspaceId, isActive, currentRole }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    startTransition(async () => {
      await toggleMemberActive(memberId, workspaceId, isActive)
    })
  }

  function handleRemove() {
    if (!confirm('Remover membro do workspace?')) return
    startTransition(async () => {
      await removeMember(memberId, workspaceId)
    })
  }

  function handleRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newRole = e.target.value as WorkspaceRole
    startTransition(async () => {
      await updateMemberRole(memberId, workspaceId, newRole)
    })
  }

  return (
    <div className="flex items-center gap-1">
      <select
        defaultValue={currentRole}
        onChange={handleRoleChange}
        disabled={isPending}
        className="text-xs bg-bg-surface border border-border text-text-muted rounded px-1.5 py-1 focus:outline-none focus:border-brand-gold"
      >
        <option value="owner">Owner</option>
        <option value="admin">Admin</option>
        <option value="manager">Manager</option>
        <option value="collaborator">Colaborador</option>
        <option value="viewer">Viewer</option>
      </select>
      <button
        onClick={handleToggle}
        disabled={isPending}
        title={isActive ? 'Desativar' : 'Ativar'}
        className={`text-xs px-1.5 py-1 rounded transition-all disabled:opacity-50 ${isActive ? 'text-warning hover:bg-warning/10' : 'text-success hover:bg-success/10'}`}
      >
        {isActive ? '⏸' : '▶'}
      </button>
      <button
        onClick={handleRemove}
        disabled={isPending}
        title="Remover"
        className="text-xs px-1.5 py-1 rounded text-error hover:bg-error/10 transition-all disabled:opacity-50"
      >
        ✕
      </button>
    </div>
  )
}
