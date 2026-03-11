'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Workspace = {
  id: string
  name: string
  is_active: boolean
  created_at: string
  member_count: number
  owner_name: string
}

export default function AdminDashboardClient({ workspaces }: { workspaces: Workspace[] }) {
  const [search, setSearch] = useState('')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const router = useRouter()

  const filtered = workspaces.filter((ws) =>
    ws.name.toLowerCase().includes(search.toLowerCase()) ||
    ws.owner_name.toLowerCase().includes(search.toLowerCase())
  )

  async function handleImpersonate(wsId: string) {
    setLoadingId(wsId)
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: wsId }),
      })
      if (res.ok) {
        router.push('/dashboard')
      }
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Empresas</h1>
        <p className="text-text-secondary mt-1">
          {workspaces.filter((w) => w.is_active).length} empresa{workspaces.filter((w) => w.is_active).length !== 1 ? 's' : ''} ativa{workspaces.filter((w) => w.is_active).length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Buscar empresa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-bg-card border border-border text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-brand-gold transition-colors"
        />
      </div>

      {/* Workspace list */}
      {filtered.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-xl p-12 text-center text-text-muted text-sm">
          {search ? 'Nenhuma empresa encontrada.' : 'Nenhuma empresa criada.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ws) => (
            <div
              key={ws.id}
              className="bg-bg-card border border-border rounded-xl p-5 hover:border-border-light transition-colors"
            >
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-xl bg-brand-gold/15 flex items-center justify-center text-lg font-bold text-brand-gold shrink-0">
                  {ws.name[0]?.toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary">{ws.name}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-muted mt-1">
                    {ws.owner_name && <span>{ws.owner_name}</span>}
                    <span>{ws.member_count} membro{ws.member_count !== 1 ? 's' : ''}</span>
                    <span className={ws.is_active ? 'text-success' : 'text-error'}>
                      {ws.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>

                {/* Impersonate button */}
                <button
                  onClick={() => handleImpersonate(ws.id)}
                  disabled={loadingId === ws.id}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-brand-gold/10 text-brand-gold border border-brand-gold/20 hover:bg-brand-gold/20 transition-colors disabled:opacity-50 shrink-0"
                >
                  {loadingId === ws.id ? (
                    'Acessando...'
                  ) : (
                    <>
                      Acessar
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
