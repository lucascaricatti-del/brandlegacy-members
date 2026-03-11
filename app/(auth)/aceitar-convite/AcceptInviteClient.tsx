'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const ROLE_LABELS: Record<string, string> = {
  manager: 'Manager',
  collaborator: 'Colaborador',
  mentee: 'Mentorado',
}

type Status = 'verifying' | 'accepting' | 'accepted' | 'no_session' | 'error'

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
  const [status, setStatus] = useState<Status>(isAuthenticated ? 'accepting' : 'verifying')
  const [error, setError] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const acceptedRef = useRef(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  async function acceptInvite() {
    if (acceptedRef.current) return
    acceptedRef.current = true
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
        acceptedRef.current = false
        return
      }

      setStatus('accepted')
      setTimeout(() => router.push('/dashboard'), 1200)
    } catch {
      setError('Erro inesperado. Tente novamente.')
      setStatus('error')
      acceptedRef.current = false
    }
  }

  useEffect(() => {
    // If server already confirmed auth, accept immediately
    if (isAuthenticated) {
      acceptInvite()
      return
    }

    // Check if URL has hash fragment with access_token (magic link)
    const hash = window.location.hash
    const hasHashToken = hash.includes('access_token')

    if (!hasHashToken) {
      // No hash token and not authenticated — show "use email link"
      setStatus('no_session')
      return
    }

    // Hash token present — Supabase will auto-exchange it via onAuthStateChange
    setStatus('verifying')

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
          acceptInvite()
        }
      }
    )

    // Fallback: if onAuthStateChange doesn't fire within 5s, check manually
    const fallbackTimer = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        acceptInvite()
      } else {
        setStatus('no_session')
      }
    }, 5000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(fallbackTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleResend() {
    setResending(true)
    setResent(false)
    try {
      const res = await fetch('/api/team/invite/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (res.ok) setResent(true)
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

      <div className="p-8 text-center space-y-3">
        {/* Verifying session from hash token */}
        {status === 'verifying' && (
          <>
            <div className="w-8 h-8 border-2 border-brand-gold border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-text-primary font-medium">Verificando seu acesso...</p>
          </>
        )}

        {/* Accepting invite */}
        {status === 'accepting' && (
          <>
            <div className="w-8 h-8 border-2 border-brand-gold border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-text-primary font-medium">Aceitando convite...</p>
          </>
        )}

        {/* Success */}
        {status === 'accepted' && (
          <>
            <div className="text-4xl text-emerald-400">&#10003;</div>
            <p className="text-text-primary font-medium">Convite aceito!</p>
            <p className="text-text-secondary text-sm">Bem-vindo a {workspaceName}! Redirecionando...</p>
          </>
        )}

        {/* Error */}
        {status === 'error' && (
          <>
            <p className="text-error font-medium">{error}</p>
            <button
              onClick={() => { acceptedRef.current = false; acceptInvite() }}
              className="mt-2 px-4 py-2 bg-brand-gold text-bg-base rounded-lg text-sm font-medium hover:bg-brand-gold-light transition-colors"
            >
              Tentar novamente
            </button>
          </>
        )}

        {/* No session — user arrived without magic link hash */}
        {status === 'no_session' && (
          <div className="space-y-4">
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
    </div>
  )
}
