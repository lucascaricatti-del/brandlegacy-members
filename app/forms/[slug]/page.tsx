import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import MultiStepForm from './MultiStepForm'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ utm_source?: string; utm_medium?: string; utm_campaign?: string }>
}

export default async function FormPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { utm_source, utm_medium, utm_campaign } = await searchParams

  const adminSupabase = createAdminClient()
  const { data: funnel } = await adminSupabase
    .from('funnels')
    .select('id, name, slug, product, description')
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
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{funnel.name}</h1>
            {funnel.description && (
              <p className="text-[#9CA3AF] text-sm">{funnel.description}</p>
            )}
          </div>
          <MultiStepForm
            funnelId={funnel.id}
            funnelSlug={funnel.slug}
            utmSource={utm_source ?? null}
            utmMedium={utm_medium ?? null}
            utmCampaign={utm_campaign ?? null}
          />
        </div>
      </div>
    </div>
  )
}
