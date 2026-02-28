'use client'

import { useState, useTransition } from 'react'
import { updateAdminRole, createTeamMember } from '@/app/actions/admin'
import type { AdminRole } from '@/lib/types/database'

const ADMIN_ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  mentor: 'Mentor',
  lideranca: 'Liderança',
  cx: 'CX',
  financeiro: 'Financeiro',
}

const ADMIN_ROLE_COLORS: Record<string, string> = {
  admin: 'bg-brand-gold/15 text-brand-gold',
  mentor: 'bg-info/15 text-info',
  lideranca: 'bg-purple-400/15 text-purple-400',
  cx: 'bg-green-400/15 text-green-400',
  financeiro: 'bg-yellow-400/15 text-yellow-400',
}

interface AdminUser {
  id: string
  name: string
  email: string
  avatar_url: string | null
  admin_role: string | null
}

export default function EquipeClient({ admins }: { admins: AdminUser[] }) {
  const [data, setData] = useState(admins)
  const [isPending, startTransition] = useTransition()
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Creation form
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formCargo, setFormCargo] = useState('')
  const [formRole, setFormRole] = useState<AdminRole>('admin')
  const [formError, setFormError] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<{ name: string; email: string; password: string } | null>(null)

  function handleRoleChange(userId: string, newRole: AdminRole) {
    setUpdatingId(userId)
    startTransition(async () => {
      const result = await updateAdminRole(userId, newRole)
      if (!result.error) {
        setData((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, admin_role: newRole } : u))
        )
      }
      setUpdatingId(null)
    })
  }

  function handleCreate() {
    if (!formName.trim() || !formEmail.trim()) {
      setFormError('Nome e email são obrigatórios.')
      return
    }
    setFormError(null)
    startTransition(async () => {
      const result = await createTeamMember(formName, formEmail, formCargo, formRole)
      if ('error' in result && result.error) {
        setFormError(result.error)
      } else if ('credentials' in result && result.credentials) {
        setCredentials(result.credentials)
        setData((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            name: result.credentials.name,
            email: result.credentials.email,
            avatar_url: null,
            admin_role: formRole,
          },
        ])
        setFormName('')
        setFormEmail('')
        setFormCargo('')
        setFormRole('admin')
        setShowForm(false)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Create form */}
      <div className="bg-bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-text-primary">Novo Membro</h2>
          <button
            onClick={() => { setShowForm((v) => !v); setCredentials(null) }}
            className="text-sm text-brand-gold hover:text-brand-gold-light transition-colors"
          >
            {showForm ? 'Cancelar' : '+ Adicionar'}
          </button>
        </div>

        {showForm && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Nome completo *"
                className="px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold/60 placeholder:text-text-muted"
              />
              <input
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="Email *"
                type="email"
                className="px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold/60 placeholder:text-text-muted"
              />
              <input
                value={formCargo}
                onChange={(e) => setFormCargo(e.target.value)}
                placeholder="Cargo (opcional)"
                className="px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold/60 placeholder:text-text-muted"
              />
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value as AdminRole)}
                className="px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold/60"
              >
                <option value="admin">Admin</option>
                <option value="mentor">Mentor</option>
                <option value="lideranca">Liderança</option>
                <option value="cx">CX</option>
                <option value="financeiro">Financeiro</option>
              </select>
            </div>
            {formError && (
              <p className="text-red-400 text-xs">{formError}</p>
            )}
            <button
              onClick={handleCreate}
              disabled={isPending}
              className="px-4 py-2 rounded-lg bg-brand-gold text-bg-base text-sm font-medium hover:bg-brand-gold-light transition-colors disabled:opacity-60"
            >
              {isPending ? 'Criando...' : 'Criar Membro'}
            </button>
          </div>
        )}

        {credentials && (
          <div className="mt-4 p-4 rounded-lg bg-green-400/10 border border-green-400/30 space-y-1">
            <p className="text-green-400 text-sm font-medium">Membro criado com sucesso!</p>
            <p className="text-text-primary text-xs">Email: <span className="font-mono">{credentials.email}</span></p>
            <p className="text-text-primary text-xs">Senha temporária: <span className="font-mono">{credentials.password}</span></p>
            <p className="text-text-muted text-xs mt-2">Compartilhe as credenciais com o membro.</p>
          </div>
        )}
      </div>

      {/* List */}
      <div className="space-y-3">
        {data.length === 0 ? (
          <div className="bg-bg-card border border-border rounded-xl p-12 text-center">
            <p className="text-text-muted text-sm">Nenhum administrador encontrado.</p>
          </div>
        ) : (
          data.map((user) => {
            const role = user.admin_role ?? 'admin'
            return (
              <div
                key={user.id}
                className="bg-bg-card border border-border rounded-xl p-5 flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-full bg-brand-gold/20 flex items-center justify-center shrink-0">
                  <span className="text-brand-gold text-sm font-semibold">
                    {user.name?.[0]?.toUpperCase() ?? '?'}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{user.name}</p>
                  <p className="text-xs text-text-muted truncate">{user.email}</p>
                </div>

                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${ADMIN_ROLE_COLORS[role] ?? ADMIN_ROLE_COLORS.admin}`}
                >
                  {ADMIN_ROLE_LABELS[role] ?? 'Admin'}
                </span>

                <select
                  value={role}
                  onChange={(e) => handleRoleChange(user.id, e.target.value as AdminRole)}
                  disabled={isPending && updatingId === user.id}
                  className="px-2.5 py-1.5 rounded-lg bg-bg-surface border border-border text-text-primary text-xs focus:outline-none focus:border-brand-gold disabled:opacity-60 shrink-0"
                >
                  <option value="admin">Admin</option>
                  <option value="mentor">Mentor</option>
                  <option value="lideranca">Liderança</option>
                  <option value="cx">CX</option>
                  <option value="financeiro">Financeiro</option>
                </select>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
