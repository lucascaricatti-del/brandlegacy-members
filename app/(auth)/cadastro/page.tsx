'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signup } from '@/app/actions/auth'

export default function CadastroPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    const password = formData.get('password') as string
    const confirm = formData.get('confirm_password') as string

    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }

    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.')
      return
    }

    setLoading(true)
    const result = await signup(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="bg-bg-card border border-border rounded-2xl p-8 shadow-2xl animate-fade-in">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-text-primary">Criar sua conta</h2>
        <p className="text-text-secondary text-sm mt-1">
          Junte-se à nossa mentoria
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-text-secondary mb-1.5">
            Nome completo
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="name"
            placeholder="Seu nome"
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
          <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-1.5">
            Senha
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Mínimo 6 caracteres"
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
          <label htmlFor="confirm_password" className="block text-sm font-medium text-text-secondary mb-1.5">
            Confirmar senha
          </label>
          <input
            id="confirm_password"
            name="confirm_password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Repita sua senha"
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
          {loading ? 'Criando conta...' : 'Criar conta'}
        </button>
      </form>

      <p className="text-center text-text-muted text-sm mt-6">
        Já tem conta?{' '}
        <Link href="/login" className="text-brand-gold hover:text-brand-gold-light transition-colors">
          Entrar
        </Link>
      </p>
    </div>
  )
}
