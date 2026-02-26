'use client'

import { useState, useTransition } from 'react'
import { createInternalAccess } from '@/app/actions/workspace'

type InternalMember = {
  id: string
  name: string
  email: string
  role: string
  is_active: boolean
}

type Credentials = { name: string; email: string; password: string }

const ROLE_OPTIONS = [
  { value: 'cx', label: 'CX (Customer Experience)' },
  { value: 'financial', label: 'Financeiro' },
  { value: 'mentor', label: 'Mentor' },
]

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', cx: 'CX', financial: 'Financeiro', mentor: 'Mentor',
}
const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-brand-gold/15 text-brand-gold',
  cx: 'bg-info/15 text-info',
  financial: 'bg-success/15 text-success',
  mentor: 'bg-bg-surface text-text-secondary border border-border',
}

export default function InternalTeamSection({ members }: { members: InternalMember[] }) {
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'cx' | 'financial' | 'mentor'>('cx')

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await createInternalAccess(name, email, password, role)
      if (res?.error) {
        setError(res.error)
      } else if (res?.credentials) {
        setCredentials(res.credentials)
        setName('')
        setEmail('')
        setPassword('')
        setShowForm(false)
      }
    })
  }

  async function handleCopy(value: string, field: string) {
    await navigator.clipboard.writeText(value)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  return (
    <div>
      {/* Credenciais recém-criadas */}
      {credentials && (
        <div className="mb-6 bg-success/10 border border-success/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-success text-sm font-semibold">Acesso criado com sucesso!</p>
            <button onClick={() => setCredentials(null)} className="text-text-muted hover:text-text-primary text-xs">✕</button>
          </div>
          <p className="text-text-secondary text-xs">Envie as credenciais ao colaborador:</p>
          <div className="space-y-2">
            {[
              { label: 'Nome', value: credentials.name, field: 'name' },
              { label: 'Email', value: credentials.email, field: 'email' },
              { label: 'Senha', value: credentials.password, field: 'password' },
            ].map(({ label, value, field }) => (
              <div key={field} className="flex items-center gap-2 bg-bg-card rounded-lg px-3 py-2">
                <span className="text-text-muted text-xs w-12 shrink-0">{label}:</span>
                <span className="flex-1 text-text-primary text-sm font-mono truncate">{value}</span>
                <button
                  onClick={() => handleCopy(value, field)}
                  className="text-xs text-brand-gold hover:text-brand-gold-light shrink-0"
                >
                  {copiedField === field ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => handleCopy(`Nome: ${credentials.name}\nEmail: ${credentials.email}\nSenha: ${credentials.password}`, 'all')}
            className="w-full py-2 text-xs rounded-lg bg-brand-gold/15 text-brand-gold hover:bg-brand-gold/25 transition-colors"
          >
            {copiedField === 'all' ? '✓ Tudo copiado!' : 'Copiar tudo'}
          </button>
        </div>
      )}

      {/* Formulário */}
      {showForm && (
        <form onSubmit={handleCreate} className="mb-5 bg-bg-surface border border-border rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-text-primary">Novo acesso interno</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Nome completo</label>
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)} required
                placeholder="Ana Silva"
                className="w-full px-3 py-2 rounded-lg bg-bg-card border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold placeholder:text-text-muted"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                placeholder="ana@brandlegacy.com"
                className="w-full px-3 py-2 rounded-lg bg-bg-card border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold placeholder:text-text-muted"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Senha temporária</label>
              <input
                type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                placeholder="Mín. 6 caracteres"
                className="w-full px-3 py-2 rounded-lg bg-bg-card border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold placeholder:text-text-muted"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Função</label>
              <select
                value={role} onChange={(e) => setRole(e.target.value as typeof role)}
                className="w-full px-3 py-2 rounded-lg bg-bg-card border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>
          {error && <p className="text-error text-xs">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit" disabled={isPending}
              className="flex-1 py-2 rounded-lg bg-brand-gold text-bg-base text-sm font-medium hover:bg-brand-gold-light transition-colors disabled:opacity-60"
            >
              {isPending ? 'Criando...' : 'Criar acesso'}
            </button>
            <button
              type="button" onClick={() => { setShowForm(false); setError(null) }}
              className="px-4 py-2 rounded-lg text-text-muted text-sm hover:bg-bg-hover transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Lista */}
      {members.length > 0 && (
        <div className="space-y-2 mb-4">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 p-3 bg-bg-surface border border-border rounded-lg">
              <div className="w-8 h-8 rounded-full bg-brand-gold/15 flex items-center justify-center shrink-0">
                <span className="text-brand-gold text-xs font-bold">{m.name?.[0]?.toUpperCase() ?? '?'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{m.name}</p>
                <p className="text-xs text-text-muted truncate">{m.email}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${ROLE_COLORS[m.role] ?? ROLE_COLORS.mentor}`}>
                {ROLE_LABELS[m.role] ?? m.role}
              </span>
            </div>
          ))}
        </div>
      )}

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-brand-gold/40 text-brand-gold hover:bg-brand-gold/5 text-sm transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Criar novo acesso
        </button>
      )}
    </div>
  )
}
