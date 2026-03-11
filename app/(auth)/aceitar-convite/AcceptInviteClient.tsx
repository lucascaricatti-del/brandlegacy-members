'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const ROLE_LABELS: Record<string, string> = {
  manager: 'Manager',
  collaborator: 'Colaborador',
  mentee: 'Mentorado',
}

type Status = 'loading' | 'success' | 'need_email' | 'sent' | 'error'

export default function AcceptInviteClient({
  inviteToken,
  workspaceName,
  role,
  inviteEmail,
}: {
  inviteToken: string
  workspaceName: string
  role: string
  inviteEmail: string
}) {
  const [status, setStatus] = useState<Status>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [resending, setResending] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let accepted = false

    async function doAccept() {
      if (accepted) return
      accepted = true
      try {
        const res = await fetch('/api/team/invite/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: inviteToken }),
        })
        const data = await res.json()
        if (data.error) {
          setErrorMsg(data.error)
          setStatus('error')
          accepted = false
          return
        }
        setStatus('success')
        setTimeout(() => router.push('/dashboard'), 2000)
      } catch (e: any) {
        setErrorMsg(e.message || 'Erro inesperado')
        setStatus('error')
        accepted = false
      }
    }

    // Listen for ANY auth state change (magic link auto-fires SIGNED_IN)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
        subscription.unsubscribe()
        doAccept()
      }
    })

    // Also check if already logged in right now
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Already authenticated — accept immediately
        doAccept()
        return
      }
      // Not logged in yet — if no hash fragment, show email form
      if (!window.location.hash.includes('access_token')) {
        setStatus('need_email')
      }
      // If hash exists: onAuthStateChange above will fire automatically
    })

    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteToken])

  async function sendLink() {
    setResending(true)
    const supabase = createClient()
    await supabase.auth.signInWithOtp({
      email: inviteEmail,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: window.location.href,
      },
    })
    setStatus('sent')
    setResending(false)
  }

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      {/* Invite info header */}
      <div className="p-6 border-b border-border text-center">
        <div className="w-12 h-12 rounded-full bg-brand-gold/15 flex items-center justify-center mx-auto mb-3">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-brand-gold"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="23" y1="11" x2="17" y2="11" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-1">
          Convite para workspace
        </h2>
        <p className="text-text-secondary text-sm">
          Voc&#234; foi convidado para{' '}
          <strong className="text-brand-gold">{workspaceName}</strong> como{' '}
          <strong className="text-text-primary">
            {ROLE_LABELS[role] ?? role}
          </strong>
        </p>
      </div>

      <div className="p-8 text-center space-y-3">
        {/* Loading / verifying */}
        {status === 'loading' && (
          <>
            <div className="w-8 h-8 border-2 border-brand-gold border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-text-primary font-medium">
              Verificando acesso...
            </p>
          </>
        )}

        {/* Success */}
        {status === 'success' && (
          <>
            <div className="text-4xl text-emerald-400">&#10003;</div>
            <p className="text-text-primary font-medium">Convite aceito!</p>
            <p className="text-text-secondary text-sm">
              Bem-vindo a {workspaceName}! Redirecionando...
            </p>
          </>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="space-y-3">
            <p className="text-error font-medium">{errorMsg}</p>
            <a
              href="/login"
              className="inline-block px-6 py-2 bg-brand-gold text-bg-base rounded-lg text-sm font-medium hover:bg-brand-gold-light transition-colors"
            >
              Fazer login
            </a>
          </div>
        )}

        {/* Need email — user arrived without magic link */}
        {status === 'need_email' && (
          <div className="space-y-4">
            <p className="text-text-primary font-medium">
              Clique abaixo para receber o link de acesso
            </p>
            <p className="text-text-secondary text-sm">
              Enviaremos um link para{' '}
              <strong className="text-brand-gold">{inviteEmail}</strong>
            </p>
            <button
              onClick={sendLink}
              disabled={resending}
              className="px-6 py-2.5 bg-brand-gold text-bg-base rounded-lg text-sm font-medium hover:bg-brand-gold-light transition-colors disabled:opacity-60"
            >
              {resending ? 'Enviando...' : 'Enviar link de acesso'}
            </button>
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

        {/* Sent — magic link sent */}
        {status === 'sent' && (
          <div className="space-y-4">
            <div className="text-4xl">&#9993;&#65039;</div>
            <p className="text-text-primary font-medium">Link enviado!</p>
            <p className="text-text-secondary text-sm">
              Enviamos um link de acesso para{' '}
              <strong className="text-brand-gold">{inviteEmail}</strong>.
              <br />
              Clique no link no seu email para aceitar o convite.
            </p>
            <button
              onClick={sendLink}
              disabled={resending}
              className="text-brand-gold hover:underline text-sm disabled:opacity-50"
            >
              {resending ? 'Reenviando...' : 'Reenviar link'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
