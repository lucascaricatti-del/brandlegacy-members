'use client'

import { useState, useTransition } from 'react'
import {
  updateTeamMemberRole,
  updateMemberPermissions,
  removeTeamMember,
  cancelInvite,
  resendInvite,
} from '@/app/actions/team'
import { DEFAULT_PERMISSIONS, resolvePermissions, type PermissionsMap, type WorkspaceRoleType } from '@/lib/permissions'

type Member = {
  id: string
  userId: string
  name: string
  email: string
  role: string
  permissions: Record<string, unknown> | null
  isOwnerOrManager: boolean
}

type PendingInvite = {
  id: string
  email: string
  role: string
  status: string
  created_at: string
  expires_at: string
}

const ROLE_OPTIONS = [
  { value: 'manager', label: 'Manager' },
  { value: 'collaborator', label: 'Colaborador' },
  { value: 'mentee', label: 'Mentorado' },
]

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-brand-gold/15 text-brand-gold',
  manager: 'bg-info/15 text-info',
  collaborator: 'bg-success/15 text-success',
  mentee: 'bg-bg-surface text-text-muted border border-border',
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner', manager: 'Manager',
  collaborator: 'Colaborador', mentee: 'Mentorado',
}

// Permission sections for the accordion
const PERMISSION_SECTIONS = [
  { key: 'dashboard', label: 'Dashboard', type: 'bool' as const },
  { key: 'academy', label: 'Academy', type: 'bool' as const },
  {
    key: 'operations', label: 'Operations', type: 'group' as const,
    children: [
      { key: 'workflow', label: 'Workflow' },
      { key: 'tasks', label: 'Tasks' },
    ],
  },
  {
    key: 'midia_analytics', label: 'Mídia Analytics', type: 'group' as const,
    children: [
      { key: 'performance', label: 'Performance' },
      { key: 'meta_ads', label: 'Meta Ads' },
      { key: 'google_ads', label: 'Google Ads' },
      { key: 'yampi', label: 'Yampi' },
      { key: 'influencers', label: 'Influencers' },
    ],
  },
  {
    key: 'business_plan', label: 'Business Plan', type: 'group' as const,
    children: [
      { key: 'roas_cac_planner', label: 'ROAS/CAC Planner' },
      { key: 'midia_plan', label: 'Mídia Plan' },
      { key: 'sales_forecast', label: 'Sales Forecast' },
      { key: 'forecast', label: 'Forecast' },
    ],
  },
  { key: 'marketplaces', label: 'Marketplaces', type: 'bool' as const },
  { key: 'team', label: 'Equipe', type: 'bool' as const },
  { key: 'integracoes', label: 'Integrações', type: 'bool' as const },
]

export default function TeamClient({
  workspaceId,
  members,
  pendingInvites,
  currentUserId,
}: {
  workspaceId: string
  members: Member[]
  pendingInvites: PendingInvite[]
  currentUserId: string
}) {
  const [isPending, startTransition] = useTransition()

  // Invite modal
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<string>('collaborator')
  const [invitePerms, setInvitePerms] = useState<PermissionsMap>(DEFAULT_PERMISSIONS.collaborator)
  const [showInvitePerms, setShowInvitePerms] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)

  // Edit permissions modal
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [editPerms, setEditPerms] = useState<PermissionsMap | null>(null)

  function handleInviteRoleChange(role: string) {
    setInviteRole(role)
    setInvitePerms(DEFAULT_PERMISSIONS[role as WorkspaceRoleType] ?? DEFAULT_PERMISSIONS.mentee)
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError(null)
    setInviteSuccess(null)
    setInviteLoading(true)

    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          email: inviteEmail,
          role: inviteRole,
          permissions: invitePerms,
        }),
      })

      const data = await res.json()
      if (data.error) {
        setInviteError(data.error)
      } else {
        setInviteSuccess(`Convite enviado para ${inviteEmail}!`)
        setInviteEmail('')
        setShowInvite(false)
        setShowInvitePerms(false)
      }
    } catch {
      setInviteError('Erro ao enviar convite.')
    } finally {
      setInviteLoading(false)
    }
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

  function handleCancelInvite(inviteId: string) {
    if (!confirm('Cancelar este convite?')) return
    startTransition(async () => {
      await cancelInvite(inviteId, workspaceId)
    })
  }

  function handleResendInvite(inviteId: string) {
    startTransition(async () => {
      await resendInvite(inviteId, workspaceId)
    })
  }

  function openEditPerms(member: Member) {
    const resolved = resolvePermissions(member.role, member.permissions)
    setEditPerms(resolved)
    setEditingMember(member)
  }

  function saveEditPerms() {
    if (!editingMember || !editPerms) return
    startTransition(async () => {
      await updateMemberPermissions(editingMember.id, workspaceId, editPerms as unknown as Record<string, unknown>)
      setEditingMember(null)
      setEditPerms(null)
    })
  }

  return (
    <div className="space-y-6">
      {/* Success message */}
      {inviteSuccess && (
        <div className="bg-success/10 border border-success/30 rounded-lg px-4 py-3 flex items-center justify-between">
          <p className="text-success text-sm">{inviteSuccess}</p>
          <button onClick={() => setInviteSuccess(null)} className="text-text-muted hover:text-text-primary text-xs">✕</button>
        </div>
      )}

      {/* Invite button / form */}
      {!showInvite ? (
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-brand-gold/40 text-brand-gold hover:bg-brand-gold/5 text-sm transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Convidar membro
        </button>
      ) : (
        <form onSubmit={handleInvite} className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
          <p className="text-sm font-semibold text-text-primary">Enviar convite</p>
          <p className="text-xs text-text-muted">
            O convite será enviado por email. Se o usuário já tem conta, pode aceitar diretamente.
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
                onChange={(e) => handleInviteRoleChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Permission accordion toggle */}
          <button
            type="button"
            onClick={() => setShowInvitePerms(!showInvitePerms)}
            className="flex items-center gap-2 text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: showInvitePerms ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
            Personalizar permissões
          </button>

          {showInvitePerms && (
            <PermissionEditor perms={invitePerms} onChange={setInvitePerms} />
          )}

          {inviteError && <p className="text-error text-xs">{inviteError}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={inviteLoading}
              className="flex-1 py-2 rounded-lg bg-brand-gold text-bg-base text-sm font-medium hover:bg-brand-gold-light transition-colors disabled:opacity-60"
            >
              {inviteLoading ? 'Enviando...' : 'Enviar Convite'}
            </button>
            <button
              type="button"
              onClick={() => { setShowInvite(false); setInviteError(null); setShowInvitePerms(false) }}
              className="px-4 py-2 rounded-lg text-text-muted text-sm hover:bg-bg-hover transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider px-1">
            Convites pendentes ({pendingInvites.length})
          </p>
          {pendingInvites.map((invite) => (
            <div key={invite.id} className="flex items-center gap-3 p-3 bg-bg-card border border-border border-dashed rounded-xl">
              <div className="w-9 h-9 rounded-full bg-bg-surface flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-secondary truncate">{invite.email}</p>
                <p className="text-xs text-text-muted">
                  Convite enviado {new Date(invite.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${ROLE_COLORS[invite.role] ?? ROLE_COLORS.mentee}`}>
                {ROLE_LABELS[invite.role] ?? invite.role}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleResendInvite(invite.id)}
                  disabled={isPending}
                  title="Reenviar convite"
                  className="text-text-muted hover:text-brand-gold transition-colors disabled:opacity-50 p-1"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                  </svg>
                </button>
                <button
                  onClick={() => handleCancelInvite(invite.id)}
                  disabled={isPending}
                  title="Cancelar convite"
                  className="text-text-muted hover:text-error transition-colors disabled:opacity-50 p-1"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Members list */}
      <div className="space-y-2">
        {members.length > 0 && (
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider px-1">
            Membros ({members.length})
          </p>
        )}
        {members.map((member) => {
          const isMe = member.userId === currentUserId
          const canManage = !['owner'].includes(member.role) && !isMe
          const hasCustomPerms = member.permissions && Object.keys(member.permissions).length > 0

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
                  {isMe && <span className="text-xs text-text-muted">(você)</span>}
                  {hasCustomPerms && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-gold/10 text-brand-gold">custom</span>
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

              {/* Actions */}
              {canManage && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEditPerms(member)}
                    disabled={isPending}
                    title="Editar permissões"
                    className="text-text-muted hover:text-brand-gold transition-colors disabled:opacity-50 p-1"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleRemove(member.id)}
                    disabled={isPending}
                    title="Remover membro"
                    className="text-text-muted hover:text-error transition-colors disabled:opacity-50 p-1"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                    </svg>
                  </button>
                </div>
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

      {/* Edit permissions modal */}
      {editingMember && editPerms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setEditingMember(null)}>
          <div className="bg-bg-card border border-border rounded-xl p-6 w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Permissões de {editingMember.name}</h3>
                <p className="text-xs text-text-muted mt-0.5">{ROLE_LABELS[editingMember.role] ?? editingMember.role}</p>
              </div>
              <button onClick={() => setEditingMember(null)} className="text-text-muted hover:text-text-primary">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <PermissionEditor perms={editPerms} onChange={setEditPerms} />

            <div className="flex gap-2 mt-4">
              <button
                onClick={saveEditPerms}
                disabled={isPending}
                className="flex-1 py-2 rounded-lg bg-brand-gold text-bg-base text-sm font-medium hover:bg-brand-gold-light transition-colors disabled:opacity-60"
              >
                {isPending ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                onClick={() => setEditingMember(null)}
                className="px-4 py-2 rounded-lg text-text-muted text-sm hover:bg-bg-hover transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Permission Editor Component ──

function PermissionEditor({
  perms,
  onChange,
}: {
  perms: PermissionsMap
  onChange: (p: PermissionsMap) => void
}) {
  function toggle(path: string) {
    const parts = path.split('.')
    const updated = JSON.parse(JSON.stringify(perms))
    if (parts.length === 1) {
      (updated as Record<string, unknown>)[parts[0]] = !(updated as Record<string, boolean>)[parts[0]]
    } else {
      const group = (updated as Record<string, Record<string, boolean>>)[parts[0]]
      if (group) group[parts[1]] = !group[parts[1]]
    }
    onChange(updated)
  }

  return (
    <div className="space-y-1 bg-bg-surface rounded-lg p-3 border border-border">
      {PERMISSION_SECTIONS.map((section) => {
        if (section.type === 'bool') {
          const val = (perms as unknown as Record<string, boolean>)[section.key]
          return (
            <PermToggle key={section.key} label={section.label} checked={val} onToggle={() => toggle(section.key)} />
          )
        }
        // Group
        const group = (perms as unknown as Record<string, Record<string, boolean>>)[section.key] ?? {}
        return (
          <div key={section.key}>
            <p className="text-[10px] uppercase tracking-wider text-text-muted mt-2 mb-1 px-1">{section.label}</p>
            {section.children?.map((child) => (
              <PermToggle
                key={`${section.key}.${child.key}`}
                label={child.label}
                checked={group[child.key] ?? false}
                onToggle={() => toggle(`${section.key}.${child.key}`)}
                indent
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}

function PermToggle({ label, checked, onToggle, indent }: {
  label: string; checked: boolean; onToggle: () => void; indent?: boolean
}) {
  return (
    <label className={`flex items-center gap-2 py-1.5 px-1 rounded hover:bg-bg-hover cursor-pointer ${indent ? 'pl-4' : ''}`}>
      <div
        onClick={(e) => { e.preventDefault(); onToggle() }}
        className={`w-8 h-4 rounded-full relative transition-colors cursor-pointer ${checked ? 'bg-brand-gold' : 'bg-bg-card border border-border'}`}
      >
        <div
          className={`absolute top-0.5 w-3 h-3 rounded-full transition-transform ${checked ? 'translate-x-4 bg-bg-base' : 'translate-x-0.5 bg-text-muted'}`}
        />
      </div>
      <span className="text-xs text-text-secondary">{label}</span>
    </label>
  )
}
