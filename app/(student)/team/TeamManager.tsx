'use client'

import { useState, useTransition } from 'react'
import { addTeamMember, updateTeamMemberRole, removeTeamMember } from '@/app/actions/team'

type Member = {
  id: string
  userId: string
  name: string
  email: string
  role: string
  isOwnerOrAdmin: boolean // não pode ser alterado pelo time
}

const ROLE_OPTIONS = [
  { value: 'manager', label: 'Manager' },
  { value: 'collaborator', label: 'Colaborador' },
  { value: 'viewer', label: 'Visualizador' },
]

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-brand-gold/15 text-brand-gold',
  admin: 'bg-info/15 text-info',
  manager: 'bg-success/15 text-success',
  collaborator: 'bg-bg-surface text-text-secondary border border-border',
  viewer: 'bg-bg-surface text-text-muted border border-border',
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner', admin: 'Admin', manager: 'Manager',
  collaborator: 'Colaborador', viewer: 'Visualizador',
}

export default function TeamManager({
  workspaceId,
  members,
  currentUserId,
}: {
  workspaceId: string
  members: Member[]
  currentUserId: string
}) {
  const [isPending, startTransition] = useTransition()
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('collaborator')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)

  function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError(null)
    setInviteSuccess(null)
    startTransition(async () => {
      const res = await addTeamMember(workspaceId, inviteEmail, inviteRole)
      if (res?.error) {
        setInviteError(res.error)
      } else {
        setInviteSuccess(`${res.name} adicionado ao time!`)
        setInviteEmail('')
        setShowInvite(false)
      }
    })
  }

  function handleRoleChange(memberId: string, role: string) {
    startTransition(async () => {
      await updateTeamMemberRole(memberId, workspaceId, role)
    })
  }

  function handleRemove(memberId: string) {
    if (!confirm('Remover este membro do workspace?')) return
    startTransition(async () => {
      await removeTeamMember(memberId, workspaceId)
    })
  }

  return (
    <div className="space-y-6">
      {/* Sucesso ao convidar */}
      {inviteSuccess && (
        <div className="bg-success/10 border border-success/30 rounded-lg px-4 py-3 flex items-center justify-between">
          <p className="text-success text-sm">{inviteSuccess}</p>
          <button onClick={() => setInviteSuccess(null)} className="text-text-muted hover:text-text-primary text-xs">✕</button>
        </div>
      )}

      {/* Botão / Formulário de convite */}
      {!showInvite ? (
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-brand-gold/40 text-brand-gold hover:bg-brand-gold/5 text-sm transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Adicionar membro
        </button>
      ) : (
        <form onSubmit={handleInvite} className="bg-bg-card border border-border rounded-xl p-5 space-y-3">
          <p className="text-sm font-semibold text-text-primary">Adicionar ao time</p>
          <p className="text-xs text-text-muted">
            O usuário precisa ter uma conta criada pela BrandLegacy. Use o email cadastrado.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                placeholder="colaborador@empresa.com"
                className="w-full px-3 py-2 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold placeholder:text-text-muted"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Papel</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>
          {inviteError && <p className="text-error text-xs">{inviteError}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2 rounded-lg bg-brand-gold text-bg-base text-sm font-medium hover:bg-brand-gold-light transition-colors disabled:opacity-60"
            >
              {isPending ? 'Adicionando...' : 'Adicionar'}
            </button>
            <button
              type="button"
              onClick={() => { setShowInvite(false); setInviteError(null) }}
              className="px-4 py-2 rounded-lg text-text-muted text-sm hover:bg-bg-hover transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Lista de membros */}
      <div className="space-y-2">
        {members.map((member) => {
          const isMe = member.userId === currentUserId
          const canManage = !member.isOwnerOrAdmin

          return (
            <div key={member.id} className="flex items-center gap-3 p-4 bg-bg-card border border-border rounded-xl">
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-brand-gold/15 flex items-center justify-center shrink-0">
                <span className="text-brand-gold text-sm font-semibold">
                  {member.name?.[0]?.toUpperCase() ?? '?'}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-text-primary truncate">{member.name}</p>
                  {isMe && (
                    <span className="text-xs text-text-muted">(você)</span>
                  )}
                </div>
                <p className="text-xs text-text-muted truncate">{member.email}</p>
              </div>

              {/* Role */}
              {canManage ? (
                <select
                  defaultValue={member.role}
                  onChange={(e) => handleRoleChange(member.id, e.target.value)}
                  disabled={isPending}
                  className="text-xs bg-bg-surface border border-border text-text-secondary rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand-gold shrink-0"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              ) : (
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${ROLE_COLORS[member.role] ?? ''}`}>
                  {ROLE_LABELS[member.role] ?? member.role}
                </span>
              )}

              {/* Remover */}
              {canManage && !isMe && (
                <button
                  onClick={() => handleRemove(member.id)}
                  disabled={isPending}
                  title="Remover membro"
                  className="text-text-muted hover:text-error transition-colors shrink-0 disabled:opacity-50 ml-1"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14H6L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              )}
            </div>
          )
        })}
      </div>

      {members.length === 0 && (
        <div className="text-center py-8 text-text-muted text-sm">
          Nenhum membro no workspace.
        </div>
      )}
    </div>
  )
}
