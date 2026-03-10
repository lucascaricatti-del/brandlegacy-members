'use client'

import { useState } from 'react'
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
  const [formEmail] = useState(email)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  async function handleSendLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const redirectUrl = `${window.location.origin}/aceitar-convite?token=${token}`

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: formEmail,
        options: {
          emailRedirectTo: redirectUrl,
          shouldCreateUser: true,
        },
      })

      if (otpError) {
        setError(otpError.message)
        setLoading(false)
        return
      }

      setSent(true)
      setLoading(false)
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
          Voc&#234; foi convidado para <strong className="text-brand-gold">{workspaceName}</strong> como{' '}
          <strong className="text-text-primary">{ROLE_LABELS[role] ?? role}</strong>
        </p>
      </div>

      {sent ? (
        /* Success state */
        <div className="p-8 text-center space-y-3">
          <div className="text-4xl">&#9993;&#65039;</div>
          <p className="text-text-primary font-medium">Link enviado!</p>
          <p className="text-text-secondary text-sm">
            Enviamos um link de acesso para{' '}
            <strong className="text-brand-gold">{formEmail}</strong>.
            <br />
            Clique no link no seu email para acessar.
          </p>
          <p className="text-text-muted text-xs mt-4">
            N&#227;o recebeu?{' '}
            <button
              type="button"
              onClick={() => { setSent(false); setError(null) }}
              className="text-brand-gold hover:underline"
            >
              Enviar novamente
            </button>
          </p>
        </div>
      ) : (
        /* Email form */
        <form onSubmit={handleSendLink} className="p-6 space-y-4">
          <p className="text-text-muted text-xs text-center">
            Enviaremos um link de acesso para o seu email
          </p>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Email</label>
            <input
              type="email"
              value={formEmail}
              readOnly
              className="w-full px-3 py-2.5 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none opacity-70 cursor-not-allowed"
            />
          </div>

          {error && <p className="text-error text-xs">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-brand-gold text-bg-base text-sm font-semibold hover:bg-brand-gold-light transition-colors disabled:opacity-60"
          >
            {loading ? 'Enviando...' : 'Enviar link de acesso \u2192'}
          </button>
        </form>
      )}
    </div>
  )
}
