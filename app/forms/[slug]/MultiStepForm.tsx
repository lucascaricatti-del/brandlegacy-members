'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createLead } from '@/app/actions/crm'

interface Props {
  funnelId: string
  funnelSlug: string
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
}

const REVENUE_OPTIONS = [
  'Ainda não faturei',
  'Até R$ 20 mil/mês',
  'R$ 20k - R$ 50k/mês',
  'R$ 50k - R$ 100k/mês',
  'R$ 100k - R$ 300k/mês',
  'Acima de R$ 300k/mês',
]

const SEGMENT_OPTIONS = [
  'E-commerce / Loja Virtual',
  'Moda e Vestuário',
  'Beleza e Cosméticos',
  'Alimentação e Bebidas',
  'Casa e Decoração',
  'Outros',
]

function formatWhatsApp(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export default function MultiStepForm({ funnelId, funnelSlug, utmSource, utmMedium, utmCampaign }: Props) {
  const [step, setStep] = useState(1)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [revenue, setRevenue] = useState('')
  const [segment, setSegment] = useState('')

  function nextStep() {
    setError(null)
    if (step === 1) {
      if (!name.trim() || !email.trim()) {
        setError('Preencha nome e email.')
        return
      }
      setStep(2)
    } else if (step === 2) {
      if (!revenue || !segment) {
        setError('Selecione faturamento e segmento.')
        return
      }
      setStep(3)
    }
  }

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await createLead({
        funnel_id: funnelId,
        name: name.trim(),
        email: email.trim(),
        whatsapp: whatsapp || undefined,
        revenue_range: revenue || undefined,
        business_segment: segment || undefined,
        utm_source: utmSource || undefined,
        utm_medium: utmMedium || undefined,
        utm_campaign: utmCampaign || undefined,
      })
      if (result.error) {
        setError(result.error)
      } else {
        router.push(`/forms/${funnelSlug}/obrigado`)
      }
    })
  }

  const inputClass = 'w-full px-4 py-3 rounded-xl bg-[#122014] border border-[#1F3D25] text-white placeholder:text-[#6B7280] text-sm focus:outline-none focus:border-[#ECA206] transition-colors'
  const selectClass = 'w-full px-4 py-3 rounded-xl bg-[#122014] border border-[#1F3D25] text-white text-sm focus:outline-none focus:border-[#ECA206] transition-colors appearance-none'

  return (
    <div>
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex-1 flex items-center gap-2">
            <div className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? 'bg-[#ECA206]' : 'bg-[#1F3D25]'}`} />
          </div>
        ))}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="space-y-4 animate-fade-in">
          <p className="text-[#ECA206] text-xs font-bold tracking-wider uppercase mb-2">Etapa 1 de 3 — Identificação</p>
          <div>
            <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">Nome completo *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome completo"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">WhatsApp</label>
            <input
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(formatWhatsApp(e.target.value))}
              placeholder="(00) 00000-0000"
              className={inputClass}
            />
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="space-y-4 animate-fade-in">
          <p className="text-[#ECA206] text-xs font-bold tracking-wider uppercase mb-2">Etapa 2 de 3 — Sobre o negócio</p>
          <div>
            <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">Faturamento atual *</label>
            <select value={revenue} onChange={(e) => setRevenue(e.target.value)} className={selectClass}>
              <option value="" disabled>Selecione...</option>
              {REVENUE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">Segmento do negócio *</label>
            <select value={segment} onChange={(e) => setSegment(e.target.value)} className={selectClass}>
              <option value="" disabled>Selecione...</option>
              {SEGMENT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="space-y-4 animate-fade-in">
          <p className="text-[#ECA206] text-xs font-bold tracking-wider uppercase mb-2">Etapa 3 de 3 — Confirmação</p>
          <div className="rounded-xl bg-[#122014] border border-[#1F3D25] p-4 space-y-3">
            <SummaryRow label="Nome" value={name} />
            <SummaryRow label="Email" value={email} />
            {whatsapp && <SummaryRow label="WhatsApp" value={whatsapp} />}
            <SummaryRow label="Faturamento" value={revenue} />
            <SummaryRow label="Segmento" value={segment} />
          </div>
        </div>
      )}

      {error && <p className="text-red-400 text-xs mt-3">{error}</p>}

      {/* Actions */}
      <div className="mt-6 flex gap-3">
        {step > 1 && (
          <button
            onClick={() => { setStep(step - 1); setError(null) }}
            className="px-5 py-3 rounded-xl border border-[#1F3D25] text-[#9CA3AF] text-sm font-medium hover:bg-[#122014] transition-colors"
          >
            Voltar
          </button>
        )}
        {step < 3 ? (
          <button
            onClick={nextStep}
            className="flex-1 py-3 rounded-xl bg-[#ECA206] hover:bg-[#FCBB13] text-[#0F1911] text-sm font-bold transition-colors"
          >
            Continuar
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="flex-1 py-3 rounded-xl bg-[#ECA206] hover:bg-[#FCBB13] text-[#0F1911] text-sm font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isPending ? 'Enviando...' : 'Quero participar da Imersão'}
          </button>
        )}
      </div>

      <p className="text-[10px] text-[#6B7280] text-center mt-4">
        Ao preencher, você concorda com nossa política de privacidade.
      </p>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-[#6B7280]">{label}</span>
      <span className="text-white font-medium">{value}</span>
    </div>
  )
}
