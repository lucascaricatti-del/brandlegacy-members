'use client'

import { useState, useTransition } from 'react'
import { updateAdminRole } from '@/app/actions/admin'
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

  return (
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
  )
}
