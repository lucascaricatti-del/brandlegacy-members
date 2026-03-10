'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const ROLE_LABELS: Record<string, string> = {
  manager: 'Manager',
  collaborator: 'Colaborador',
  mentee: 'Mentorado',
}

export default function AcceptInviteClient({
  token,
  workspaceName,
  email,
  role,
}: {
  token: string
  workspaceName: string
  email: string
  role: string
}) {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [formEmail, setFormEmail] = useState(email)
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (mode === 'login') {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: formEmail,
          password,
        })
        if (authError) {
          setError(authError.message)
          setLoading(false)
          return
        }
      } else {
        const { error: authError } = await supabase.auth.signUp({
          email: formEmail,
          password,
          options: { data: { name } },
        })
        if (authError) {
          setError(authError.message)
          setLoading(false)
          return
        }
      }

      // After auth, redirect to accept invite (server will handle the rest)
      router.push(`/aceitar-convite?token=${token}`)
      router.refresh()
    } catch {
      setError('Erro inesperado. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      {/* Invite info */}
      <div className="p-6 border-b border-border text-center">
        <div className="w-12 h-12 rounded-full bg-brand-gold/15 flex items-center justify-center mx-auto mb-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-gold">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-1">Convite para workspace</h2>
        <p className="text-text-secondary text-sm">
          Você foi convidado para <strong className="text-brand-gold">{workspaceName}</strong> como{' '}
          <strong className="text-text-primary">{ROLE_LABELS[role] ?? role}</strong>
        </p>
      </div>

      {/* Auth form */}
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <p className="text-text-muted text-xs text-center">
          {mode === 'login' ? 'Faça login para aceitar o convite' : 'Crie sua conta para aceitar o convite'}
        </p>

        {mode === 'signup' && (
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Nome completo</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="Seu nome"
              className="w-full px-3 py-2.5 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold placeholder:text-text-muted"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">Email</label>
          <input
            type="email"
            value={formEmail}
            onChange={e => setFormEmail(e.target.value)}
            required
            placeholder="seu@email.com"
            className="w-full px-3 py-2.5 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold placeholder:text-text-muted"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">Senha</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            placeholder="Mín. 6 caracteres"
            className="w-full px-3 py-2.5 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold placeholder:text-text-muted"
          />
        </div>

        {error && <p className="text-error text-xs">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-brand-gold text-bg-base text-sm font-semibold hover:bg-brand-gold-light transition-colors disabled:opacity-60"
        >
          {loading ? 'Processando...' : mode === 'login' ? 'Entrar e Aceitar' : 'Criar Conta e Aceitar'}
        </button>

        <p className="text-center text-xs text-text-muted">
          {mode === 'login' ? (
            <>Não tem conta?{' '}
              <button type="button" onClick={() => setMode('signup')} className="text-brand-gold hover:underline">
                Criar conta
              </button>
            </>
          ) : (
            <>Já tem conta?{' '}
              <button type="button" onClick={() => setMode('login')} className="text-brand-gold hover:underline">
                Fazer login
              </button>
            </>
          )}
        </p>
      </form>
    </div>
  )
}
