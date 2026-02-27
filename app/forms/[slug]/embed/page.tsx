import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import MultiStepForm from '../MultiStepForm'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ utm_source?: string; utm_medium?: string; utm_campaign?: string }>
}

export default async function EmbedFormPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { utm_source, utm_medium, utm_campaign } = await searchParams

  const adminSupabase = createAdminClient()
  const { data: funnel } = await adminSupabase
    .from('funnels')
    .select('id, name, slug, description')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!funnel) notFound()

  return (
    <div className="min-h-screen bg-[#0F1911] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-white mb-1">{funnel.name}</h2>
          {funnel.description && (
            <p className="text-[#9CA3AF] text-xs">{funnel.description}</p>
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
  )
}
