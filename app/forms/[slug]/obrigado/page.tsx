import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function ObrigadoFormPage({ params }: Props) {
  const { slug } = await params

  const adminSupabase = createAdminClient()
  const { data: funnel } = await adminSupabase
    .from('funnels')
    .select('name, slug, product')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!funnel) notFound()

  return (
    <div className="min-h-screen bg-[#0F1911] flex flex-col">
      <header className="px-6 py-4 border-b border-[#1F3D25]">
        <img src="/logo.png" alt="BrandLegacy" className="h-7 w-auto" />
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full text-center">
          {/* Check icon */}
          <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-6">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-white mb-3">
            Inscrição confirmada!
          </h1>
          <p className="text-[#9CA3AF] text-sm mb-8 leading-relaxed">
            Parabéns! Sua inscrição para <strong className="text-white">{funnel.name}</strong> foi registrada com sucesso.
          </p>

          {/* Next steps */}
          <div className="rounded-xl bg-[#122014] border border-[#1F3D25] p-6 text-left mb-8">
            <h2 className="text-sm font-bold text-[#ECA206] mb-4 uppercase tracking-wider">Próximos passos</h2>
            <div className="space-y-4">
              <StepItem number={1} text="Nosso time vai entrar em contato pelo WhatsApp nas próximas horas." />
              <StepItem number={2} text="Fique de olho no seu email para receber informações exclusivas." />
              <StepItem number={3} text="Prepare-se para transformar seu negócio!" />
            </div>
          </div>

          <a
            href="https://wa.me/5511999999999?text=Ol%C3%A1!%20Acabei%20de%20me%20inscrever%20na%20Imers%C3%A3o."
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Falar com o time comercial
          </a>
        </div>
      </div>
    </div>
  )
}

function StepItem({ number, text }: { number: number; text: string }) {
  return (
    <div className="flex gap-3">
      <div className="w-6 h-6 rounded-full bg-[#ECA206]/15 flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-[#ECA206] text-xs font-bold">{number}</span>
      </div>
      <p className="text-[#9CA3AF] text-sm leading-relaxed">{text}</p>
    </div>
  )
}
