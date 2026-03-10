'use client'

import { useState, useTransition, useCallback } from 'react'
import {
  updateTeamMemberRole,
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
  owner: 'bg-[#C9971A]/15 text-[#C9971A]',
  manager: 'bg-info/15 text-info',
  collaborator: 'bg-success/15 text-success',
  mentee: 'bg-bg-surface text-text-muted border border-border',
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner', manager: 'Manager',
  collaborator: 'Colaborador', mentee: 'Mentorado',
}

// Permission sections for the card-based visualization
const PERMISSION_SECTIONS = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊', type: 'bool' as const },
  { key: 'academy', label: 'Academy', icon: '🎓', type: 'bool' as const },
  {
    key: 'operations', label: 'Operations', icon: '⚙️', type: 'group' as const,
    children: [
      { key: 'workflow', label: 'Workflow' },
      { key: 'tasks', label: 'Tasks' },
    ],
  },
  {
    key: 'midia_analytics', label: 'Mídia Analytics', icon: '📈', type: 'group' as const,
    children: [
      { key: 'performance', label: 'Performance' },
      { key: 'meta_ads', label: 'Meta Ads' },
      { key: 'google_ads', label: 'Google Ads' },
      { key: 'yampi', label: 'Yampi' },
      { key: 'influencers', label: 'Influencers' },
    ],
  },
  {
    key: 'business_plan', label: 'Business Plan', icon: '📋', type: 'group' as const,
    children: [
      { key: 'roas_cac_planner', label: 'ROAS/CAC Planner' },
      { key: 'midia_plan', label: 'Mídia Plan' },
      { key: 'sales_forecast', label: 'Sales Forecast' },
      { key: 'forecast', label: 'Forecast' },
    ],
  },
  { key: 'marketplaces', label: 'Marketplaces', icon: '🛒', type: 'bool' as const },
  { key: 'team', label: 'Equipe', icon: '👥', type: 'bool' as const },
  { key: 'integracoes', label: 'Integrações', icon: '🔗', type: 'bool' as const },
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

  // Selected member for permissions panel
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(
    members.length > 0 ? members[0].id : null
  )

  // Editable permissions for the selected member
  const [editPerms, setEditPerms] = useState<PermissionsMap | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Invite modal
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<string>('collaborator')
  const [invitePerms, setInvitePerms] = useState<PermissionsMap>(DEFAULT_PERMISSIONS.collaborator)
  const [showInvitePerms, setShowInvitePerms] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)

  const selectedMember = members.find((m) => m.id === selectedMemberId) ?? null
  const currentUser = members.find((m) => m.userId === currentUserId)
  const canEdit = currentUser && ['owner', 'manager'].includes(currentUser.role)

  // Select a member and load their resolved permissions
  const selectMember = useCallback((member: Member) => {
    setSelectedMemberId(member.id)
    const resolved = resolvePermissions(member.role, member.permissions)
    setEditPerms(resolved)
    setSaveSuccess(false)
  }, [])

  // Initialize permissions when component mounts
  useState(() => {
    if (selectedMember) {
      const resolved = resolvePermissions(selectedMember.role, selectedMember.permissions)
      setEditPerms(resolved)
    }
  })

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
      if (selectedMemberId === memberId) {
        setSelectedMemberId(members.find((m) => m.id !== memberId)?.id ?? null)
      }
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

  async function savePermissions() {
    if (!selectedMember || !editPerms) return
    setSaving(true)
    setSaveSuccess(false)
    try {
      const res = await fetch('/api/team/permissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          member_id: selectedMember.id,
          permissions: editPerms,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      }
    } catch {
      // silent fail
    } finally {
      setSaving(false)
    }
  }

  function togglePerm(path: string) {
    if (!editPerms || !canEdit || selectedMember?.role === 'owner') return
    const parts = path.split('.')
    const updated = JSON.parse(JSON.stringify(editPerms))
    if (parts.length === 1) {
      (updated as Record<string, unknown>)[parts[0]] = !(updated as Record<string, boolean>)[parts[0]]
    } else {
      const group = (updated as Record<string, Record<string, boolean>>)[parts[0]]
      if (group) group[parts[1]] = !group[parts[1]]
    }
    setEditPerms(updated)
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
      {canEdit && (
        <>
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
                <PermissionCards perms={invitePerms} onToggle={(path) => {
                  const parts = path.split('.')
                  const updated = JSON.parse(JSON.stringify(invitePerms))
                  if (parts.length === 1) {
                    (updated as Record<string, unknown>)[parts[0]] = !(updated as Record<string, boolean>)[parts[0]]
                  } else {
                    const group = (updated as Record<string, Record<string, boolean>>)[parts[0]]
                    if (group) group[parts[1]] = !group[parts[1]]
                  }
                  setInvitePerms(updated)
                }} editable />
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
        </>
      )}

      {/* Two-column layout: Members + Permissions */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
        {/* LEFT — Member list */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider px-1">
            Membros ({members.length})
          </p>

          <div className="space-y-1.5">
            {members.map((member) => {
              const isMe = member.userId === currentUserId
              const isSelected = member.id === selectedMemberId

              return (
                <button
                  key={member.id}
                  onClick={() => selectMember(member)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                    isSelected
                      ? 'bg-bg-card border-2 border-brand-gold/40 shadow-sm'
                      : 'bg-bg-card border border-border hover:border-border-light'
                  }`}
                >
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-brand-gold/20' : 'bg-brand-gold/10'
                  }`}>
                    <span className="text-brand-gold text-sm font-semibold">
                      {member.name?.[0]?.toUpperCase() ?? '?'}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-text-primary truncate">{member.name}</p>
                      {isMe && <span className="text-[10px] text-text-muted">(você)</span>}
                    </div>
                    <p className="text-xs text-text-muted truncate">{member.email}</p>
                  </div>

                  {/* Role badge */}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${ROLE_COLORS[member.role] ?? ''}`}>
                    {ROLE_LABELS[member.role] ?? member.role}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Pending invites */}
          {pendingInvites.length > 0 && (
            <div className="space-y-1.5 pt-3 border-t border-border">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider px-1">
                Convites pendentes ({pendingInvites.length})
              </p>
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="flex items-center gap-3 p-3 bg-bg-card border border-border border-dashed rounded-xl">
                  <div className="w-9 h-9 rounded-full bg-bg-surface flex items-center justify-center shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text-secondary truncate">{invite.email}</p>
                    <p className="text-[10px] text-text-muted">
                      {new Date(invite.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${ROLE_COLORS[invite.role] ?? ROLE_COLORS.mentee}`}>
                    {ROLE_LABELS[invite.role] ?? invite.role}
                  </span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleResendInvite(invite.id) }}
                      disabled={isPending}
                      title="Reenviar"
                      className="text-text-muted hover:text-brand-gold transition-colors disabled:opacity-50 p-1"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCancelInvite(invite.id) }}
                      disabled={isPending}
                      title="Cancelar"
                      className="text-text-muted hover:text-error transition-colors disabled:opacity-50 p-1"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {members.length === 0 && (
            <div className="text-center py-8 text-text-muted text-sm">
              Nenhum membro no workspace.
            </div>
          )}
        </div>

        {/* RIGHT — Permissions panel */}
        <div>
          {selectedMember && editPerms ? (
            <div className="bg-bg-card border border-border rounded-xl p-5 space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-gold/15 flex items-center justify-center">
                    <span className="text-brand-gold text-base font-semibold">
                      {selectedMember.name?.[0]?.toUpperCase() ?? '?'}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">{selectedMember.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[selectedMember.role] ?? ''}`}>
                        {ROLE_LABELS[selectedMember.role] ?? selectedMember.role}
                      </span>
                      <span className="text-xs text-text-muted">{selectedMember.email}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {canEdit && selectedMember.role !== 'owner' && selectedMember.userId !== currentUserId && (
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedMember.role}
                      onChange={(e) => handleRoleChange(selectedMember.id, e.target.value)}
                      disabled={isPending}
                      className="text-xs bg-bg-surface border border-border text-text-secondary rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand-gold"
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleRemove(selectedMember.id)}
                      disabled={isPending}
                      title="Remover membro"
                      className="text-text-muted hover:text-error transition-colors disabled:opacity-50 p-1.5 rounded-lg hover:bg-error/5"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Permissions title */}
              <div className="flex items-center justify-between border-t border-border pt-4">
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Permissões</p>
                {selectedMember.role === 'owner' && (
                  <span className="text-[10px] text-text-muted">Owner tem acesso total</span>
                )}
                {canEdit && selectedMember.role !== 'owner' && (
                  <div className="flex items-center gap-2">
                    {saveSuccess && (
                      <span className="text-[10px] text-success animate-fade-in">Salvo!</span>
                    )}
                    <button
                      onClick={savePermissions}
                      disabled={saving}
                      className="text-xs px-3 py-1.5 rounded-lg bg-brand-gold text-bg-base font-medium hover:bg-brand-gold-light transition-colors disabled:opacity-60"
                    >
                      {saving ? 'Salvando...' : 'Salvar permissões'}
                    </button>
                  </div>
                )}
              </div>

              {/* Permission cards grid */}
              <PermissionCards
                perms={editPerms}
                onToggle={togglePerm}
                editable={canEdit === true && selectedMember.role !== 'owner' && selectedMember.userId !== currentUserId}
              />
            </div>
          ) : (
            <div className="bg-bg-card border border-border rounded-xl p-12 text-center">
              <div className="text-3xl mb-3 opacity-40">🔐</div>
              <p className="text-text-muted text-sm">Selecione um membro para ver suas permissões</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Permission Cards Component ──

function PermissionCards({
  perms,
  onToggle,
  editable,
}: {
  perms: PermissionsMap
  onToggle: (path: string) => void
  editable?: boolean
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {PERMISSION_SECTIONS.map((section) => {
        if (section.type === 'bool') {
          const val = (perms as unknown as Record<string, boolean>)[section.key]
          return (
            <div key={section.key} className="bg-bg-surface border border-border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{section.icon}</span>
                  <span className="text-xs font-medium text-text-secondary">{section.label}</span>
                </div>
                <PermToggle
                  checked={val}
                  onToggle={() => onToggle(section.key)}
                  disabled={!editable}
                />
              </div>
            </div>
          )
        }

        // Group section
        const group = (perms as unknown as Record<string, Record<string, boolean>>)[section.key] ?? {}
        const enabledCount = section.children?.filter((c) => group[c.key]).length ?? 0
        const totalCount = section.children?.length ?? 0

        return (
          <div key={section.key} className="bg-bg-surface border border-border rounded-lg p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">{section.icon}</span>
                <span className="text-xs font-medium text-text-secondary">{section.label}</span>
              </div>
              <span className="text-[10px] text-text-muted">
                {enabledCount}/{totalCount}
              </span>
            </div>
            <div className="space-y-1 border-t border-border/50 pt-2">
              {section.children?.map((child) => (
                <div key={`${section.key}.${child.key}`} className="flex items-center justify-between py-0.5">
                  <span className="text-[11px] text-text-muted">{child.label}</span>
                  <PermToggle
                    checked={group[child.key] ?? false}
                    onToggle={() => onToggle(`${section.key}.${child.key}`)}
                    disabled={!editable}
                  />
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PermToggle({ checked, onToggle, disabled }: {
  checked: boolean; onToggle: () => void; disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onToggle}
      className={`w-8 h-4 rounded-full relative transition-colors ${
        disabled ? 'opacity-60 cursor-default' : 'cursor-pointer'
      } ${checked ? 'bg-brand-gold' : 'bg-bg-card border border-border'}`}
    >
      <div
        className={`absolute top-0.5 w-3 h-3 rounded-full transition-transform ${
          checked ? 'translate-x-4 bg-bg-base' : 'translate-x-0.5 bg-text-muted'
        }`}
      />
    </button>
  )
}
