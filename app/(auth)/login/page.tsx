'use client'

import { useState } from 'react'
import Link from 'next/link'
import { login } from '@/app/actions/auth'
import { createBrowserClient } from '@supabase/ssr'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [magicMode, setMagicMode] = useState(false)
  const [magicEmail, setMagicEmail] = useState('')
  const [magicLoading, setMagicLoading] = useState(false)
  const [magicSent, setMagicSent] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await login(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (!magicEmail.trim()) return
    setError(null)
    setMagicLoading(true)

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: magicEmail.trim(),
      options: {
        emailRedirectTo: `${baseUrl}/dashboard`,
        shouldCreateUser: false,
      },
    })

    if (otpError) {
      setError(otpError.message)
      setMagicLoading(false)
      return
    }

    setMagicSent(true)
    setMagicLoading(false)
  }

  return (
    <div className="bg-bg-card border border-border rounded-2xl p-8 shadow-2xl animate-fade-in">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-text-primary">Entrar na sua conta</h2>
        <p className="text-text-secondary text-sm mt-1">
          Acesse seus módulos e aulas exclusivas
        </p>
      </div>

      {!magicMode ? (
        <>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-1.5">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="seu@email.com"
                className="
                  w-full px-4 py-2.5 rounded-lg
                  bg-bg-surface border border-border
                  text-text-primary placeholder:text-text-muted
                  focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold
                  transition-colors text-sm
                "
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-text-secondary">
                  Senha
                </label>
                <button
                  type="button"
                  onClick={() => setMagicMode(true)}
                  className="text-xs text-brand-gold hover:text-brand-gold-light transition-colors"
                >
                  Esqueci minha senha
                </button>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="
                  w-full px-4 py-2.5 rounded-lg
                  bg-bg-surface border border-border
                  text-text-primary placeholder:text-text-muted
                  focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold
                  transition-colors text-sm
                "
              />
            </div>

            {error && (
              <div className="bg-error/10 border border-error/20 rounded-lg px-4 py-3">
                <p className="text-error text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="
                w-full py-2.5 px-4 rounded-lg font-medium text-sm
                bg-brand-gold hover:bg-brand-gold-light
                text-bg-base
                transition-colors
                disabled:opacity-60 disabled:cursor-not-allowed
                mt-2
              "
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-text-muted text-xs">ou</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Magic link button */}
          <button
            onClick={() => setMagicMode(true)}
            className="w-full py-2.5 px-4 rounded-lg text-sm font-medium border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors flex items-center justify-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
            </svg>
            Entrar com link por email
          </button>
        </>
      ) : (
        /* Magic link mode */
        magicSent ? (
          <div className="text-center space-y-3 py-4">
            <div className="text-4xl">&#9993;&#65039;</div>
            <p className="text-text-primary font-medium">Link enviado!</p>
            <p className="text-text-secondary text-sm">
              Enviamos um link de acesso para{' '}
              <strong className="text-brand-gold">{magicEmail}</strong>.
              <br />
              Verifique sua caixa de entrada.
            </p>
            <button
              onClick={() => { setMagicSent(false); setMagicMode(false); setError(null) }}
              className="text-brand-gold text-sm hover:underline mt-2"
            >
              Voltar ao login
            </button>
          </div>
        ) : (
          <form onSubmit={handleMagicLink} className="space-y-4">
            <p className="text-text-muted text-xs">
              Enviaremos um link de acesso para o seu email. Sem senha.
            </p>

            <div>
              <label htmlFor="magic-email" className="block text-sm font-medium text-text-secondary mb-1.5">
                Email
              </label>
              <input
                id="magic-email"
                type="email"
                required
                autoComplete="email"
                placeholder="seu@email.com"
                value={magicEmail}
                onChange={e => setMagicEmail(e.target.value)}
                className="
                  w-full px-4 py-2.5 rounded-lg
                  bg-bg-surface border border-border
                  text-text-primary placeholder:text-text-muted
                  focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold
                  transition-colors text-sm
                "
              />
            </div>

            {error && (
              <div className="bg-error/10 border border-error/20 rounded-lg px-4 py-3">
                <p className="text-error text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={magicLoading}
              className="
                w-full py-2.5 px-4 rounded-lg font-medium text-sm
                bg-brand-gold hover:bg-brand-gold-light
                text-bg-base
                transition-colors
                disabled:opacity-60 disabled:cursor-not-allowed
              "
            >
              {magicLoading ? 'Enviando...' : 'Enviar link de acesso'}
            </button>

            <button
              type="button"
              onClick={() => { setMagicMode(false); setError(null) }}
              className="w-full text-center text-text-muted text-sm hover:text-text-secondary transition-colors"
            >
              Voltar ao login com senha
            </button>
          </form>
        )
      )}

      <p className="text-center text-text-muted text-sm mt-6">
        Não tem conta?{' '}
        <Link href="/cadastro" className="text-brand-gold hover:text-brand-gold-light transition-colors">
          Cadastre-se
        </Link>
      </p>
    </div>
  )
}
