'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { captureLead } from '@/app/actions/leads'

interface Props {
  moduleId: string
  utmSource: string | null
  utmCampaign: string | null
}

export default function LeadCaptureForm({ moduleId, utmSource, utmCampaign }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await captureLead({
        name: formData.get('name') as string,
        email: formData.get('email') as string,
        phone: (formData.get('phone') as string) || null,
        module_id: moduleId,
        utm_source: utmSource,
        utm_campaign: utmCampaign,
      })

      if (result.error) {
        setError(result.error)
      } else {
        router.push(`/aulas/${moduleId}/obrigado`)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-text-muted mb-1.5">Nome *</label>
        <input
          name="name"
          required
          placeholder="Seu nome completo"
          className="w-full px-4 py-3 rounded-lg bg-bg-surface border border-border text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-brand-gold transition-colors"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-text-muted mb-1.5">E-mail *</label>
        <input
          name="email"
          type="email"
          required
          placeholder="seu@email.com"
          className="w-full px-4 py-3 rounded-lg bg-bg-surface border border-border text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-brand-gold transition-colors"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-text-muted mb-1.5">WhatsApp</label>
        <input
          name="phone"
          type="tel"
          placeholder="(00) 00000-0000"
          className="w-full px-4 py-3 rounded-lg bg-bg-surface border border-border text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-brand-gold transition-colors"
        />
      </div>

      {error && <p className="text-error text-xs">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-3 rounded-lg bg-brand-gold hover:bg-brand-gold-light text-bg-base text-sm font-bold transition-colors disabled:opacity-60"
      >
        {isPending ? 'Enviando...' : 'Quero assistir agora'}
      </button>

      <p className="text-[10px] text-text-muted text-center">
        Ao preencher, você concorda com nossa política de privacidade.
      </p>
    </form>
  )
}
