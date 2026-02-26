'use client'

import { useState, useTransition } from 'react'
import { createMentoradoAccess, removeMember } from '@/app/actions/workspace'

type Member = {
  id: string
  userId: string
  name: string
  email: string
  role: string
  isActive: boolean
}

type Credentials = {
  name: string
  email: string
  password: string
}

export default function MentoradoAccessManager({
  workspaceId,
  members,
}: {
  workspaceId: string
  members: Member[]
}) {
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Form fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await createMentoradoAccess(workspaceId, name, email, password)
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

  function handleRemove(memberId: string) {
    if (!confirm('Remover acesso deste membro?')) return
    startTransition(async () => {
      await removeMember(memberId, workspaceId)
    })
  }

  const ROLE_LABELS: Record<string, string> = {
    owner: 'Owner', admin: 'Admin', manager: 'Manager',
    collaborator: 'Colaborador', viewer: 'Visualizador',
  }
  const ROLE_COLORS: Record<string, string> = {
    owner: 'bg-brand-gold/15 text-brand-gold',
    admin: 'bg-info/15 text-info',
    manager: 'bg-success/15 text-success',
    collaborator: 'bg-bg-surface text-text-secondary border border-border',
    viewer: 'bg-bg-surface text-text-muted border border-border',
  }

  return (
    <div className="space-y-5">
      {/* Credenciais recém-criadas */}
      {credentials && (
        <div className="bg-success/10 border border-success/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-success text-sm font-semibold">Acesso criado com sucesso!</p>
            <button
              onClick={() => setCredentials(null)}
              className="text-text-muted hover:text-text-primary text-xs"
            >
              ✕
            </button>
          </div>
          <p className="text-text-secondary text-xs">Copie e envie as credenciais ao mentorado:</p>
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
            onClick={() => {
              const all = `Nome: ${credentials.name}\nEmail: ${credentials.email}\nSenha: ${credentials.password}`
              handleCopy(all, 'all')
            }}
            className="w-full py-2 text-xs rounded-lg bg-brand-gold/15 text-brand-gold hover:bg-brand-gold/25 transition-colors"
          >
            {copiedField === 'all' ? '✓ Tudo copiado!' : 'Copiar tudo'}
          </button>
        </div>
      )}

      {/* Botão / Formulário de criação */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-brand-gold/40 text-brand-gold hover:bg-brand-gold/5 text-sm transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Criar acesso para mentorado
        </button>
      ) : (
        <form onSubmit={handleCreate} className="bg-bg-surface border border-border rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-text-primary mb-1">Novo acesso</p>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Nome completo</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="João Silva"
              className="w-full px-3 py-2 rounded-lg bg-bg-card border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold placeholder:text-text-muted"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="joao@empresa.com"
              className="w-full px-3 py-2 rounded-lg bg-bg-card border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold placeholder:text-text-muted"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Senha temporária</label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Mín. 6 caracteres"
              className="w-full px-3 py-2 rounded-lg bg-bg-card border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold placeholder:text-text-muted"
            />
          </div>
          {error && <p className="text-error text-xs">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2 rounded-lg bg-brand-gold text-bg-base text-sm font-medium hover:bg-brand-gold-light transition-colors disabled:opacity-60"
            >
              {isPending ? 'Criando...' : 'Criar acesso'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(null) }}
              className="px-4 py-2 rounded-lg text-text-muted text-sm hover:bg-bg-hover transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Lista de membros */}
      {members.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider px-1">
            Membros ativos ({members.filter((m) => m.isActive).length})
          </p>
          {members.map((member) => (
            <div
              key={member.id}
              className={`flex items-center gap-3 p-3 rounded-lg border ${member.isActive ? 'bg-bg-surface border-border' : 'bg-bg-base border-border opacity-50'}`}
            >
              <div className="w-8 h-8 rounded-full bg-brand-gold/15 flex items-center justify-center shrink-0">
                <span className="text-brand-gold text-xs font-bold">
                  {member.name?.[0]?.toUpperCase() ?? '?'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{member.name || '—'}</p>
                <p className="text-xs text-text-muted truncate">{member.email}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${ROLE_COLORS[member.role] ?? ROLE_COLORS.viewer}`}>
                {ROLE_LABELS[member.role] ?? member.role}
              </span>
              <button
                onClick={() => handleRemove(member.id)}
                disabled={isPending}
                title="Remover acesso"
                className="text-text-muted hover:text-error transition-colors shrink-0 disabled:opacity-50"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14H6L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                  <path d="M9 6V4h6v2"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {members.length === 0 && !showForm && (
        <p className="text-text-muted text-sm text-center py-4">Nenhum membro ainda.</p>
      )}
    </div>
  )
}
