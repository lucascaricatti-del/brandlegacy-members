'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

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
  isAuthenticated,
}: {
  token: string
  workspaceName: string
  email: string
  role: string
  isAuthenticated: boolean
}) {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'accepting' | 'accepted' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  // If authenticated, auto-accept the invite
  useEffect(() => {
    if (!isAuthenticated) return

    async function acceptInvite() {
      setStatus('accepting')
      try {
        const res = await fetch('/api/team/invite/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data = await res.json()

        if (!res.ok) {
          setError(data.error || 'Erro ao aceitar convite')
          setStatus('error')
          return
        }

        setStatus('accepted')
        // Redirect to dashboard after short delay
        setTimeout(() => router.push('/dashboard'), 1500)
      } catch {
        setError('Erro inesperado. Tente novamente.')
        setStatus('error')
      }
    }

    acceptInvite()
  }, [isAuthenticated, token, router])

  async function handleResend() {
    setResending(true)
    setResent(false)
    try {
      const res = await fetch('/api/team/invite/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (res.ok) {
        setResent(true)
      }
    } catch {
      // silently fail
    } finally {
      setResending(false)
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

      {/* Authenticated → auto-accepting */}
      {isAuthenticated && (
        <div className="p-8 text-center space-y-3">
          {status === 'accepting' && (
            <>
              <div className="w-8 h-8 border-2 border-brand-gold border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-text-primary font-medium">Aceitando convite...</p>
            </>
          )}
          {status === 'accepted' && (
            <>
              <div className="text-4xl">&#10003;</div>
              <p className="text-text-primary font-medium">Convite aceito!</p>
              <p className="text-text-secondary text-sm">Redirecionando para o dashboard...</p>
            </>
          )}
          {status === 'error' && (
            <>
              <p className="text-error font-medium">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 px-4 py-2 bg-brand-gold text-bg-base rounded-lg text-sm font-medium hover:bg-brand-gold-light transition-colors"
              >
                Tentar novamente
              </button>
            </>
          )}
        </div>
      )}

      {/* Not authenticated → prompt to use email link */}
      {!isAuthenticated && (
        <div className="p-8 text-center space-y-4">
          <div className="text-4xl">&#9993;&#65039;</div>
          <p className="text-text-primary font-medium">Use o link enviado para seu email</p>
          <p className="text-text-secondary text-sm">
            Enviamos um link de acesso para{' '}
            <strong className="text-brand-gold">{email}</strong>.
            <br />
            Clique no link no seu email para aceitar o convite.
          </p>

          <div className="pt-2">
            {resent ? (
              <p className="text-emerald-400 text-sm">Convite reenviado!</p>
            ) : (
              <button
                onClick={handleResend}
                disabled={resending}
                className="text-brand-gold hover:underline text-sm disabled:opacity-50"
              >
                {resending ? 'Reenviando...' : 'Reenviar convite'}
              </button>
            )}
          </div>

          <div className="pt-2 border-t border-border">
            <a
              href="/login"
              className="text-text-muted text-xs hover:text-text-secondary transition-colors"
            >
              Já tem uma conta? Fazer login
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
