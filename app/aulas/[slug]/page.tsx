import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import LeadCaptureForm from './LeadCaptureForm'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ utm_source?: string; utm_campaign?: string }>
}

export default async function AulaPublicaPage({ params, searchParams }: Props) {
  const { slug: moduleId } = await params
  const { utm_source, utm_campaign } = await searchParams

  const adminSupabase = createAdminClient()

  const { data: mod } = await adminSupabase
    .from('modules')
    .select('id, title, description, thumbnail_url, category, lessons(id, title, duration_minutes)')
    .eq('id', moduleId)
    .eq('is_published', true)
    .single()

  if (!mod || mod.category !== 'free_class') notFound()

  const totalDuration = (mod.lessons ?? []).reduce((sum, l) => sum + (l.duration_minutes ?? 0), 0)
  const totalLessons = mod.lessons?.length ?? 0

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 border-b border-border">
        <img src="/logo.png" alt="BrandLegacy" className="h-7 w-auto" />
      </header>

      {/* Hero */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left: content */}
        <div className="flex-1 flex flex-col justify-center px-6 md:px-12 lg:px-16 py-12 lg:py-0">
          <div className="max-w-lg">
            <span className="inline-block text-[10px] px-2.5 py-1 rounded-full bg-green-500/15 text-green-400 font-bold tracking-wider uppercase mb-4">
              Aula Gratuita
            </span>
            <h1 className="text-3xl md:text-4xl font-bold text-text-primary mb-4 leading-tight">
              {mod.title}
            </h1>
            {mod.description && (
              <p className="text-text-secondary text-base mb-6 leading-relaxed">{mod.description}</p>
            )}
            <div className="flex items-center gap-4 text-sm text-text-muted mb-8">
              {totalLessons > 0 && <span>{totalLessons} {totalLessons === 1 ? 'aula' : 'aulas'}</span>}
              {totalDuration > 0 && <span>{totalDuration} min de conteúdo</span>}
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-bg-card border border-border">
              <div className="flex -space-x-2">
                {['A', 'B', 'C'].map((letter) => (
                  <div key={letter} className="w-7 h-7 rounded-full bg-brand-gold/20 border-2 border-bg-card flex items-center justify-center">
                    <span className="text-brand-gold text-[10px] font-bold">{letter}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-text-muted">Mais de 500 pessoas já assistiram</p>
            </div>
          </div>
        </div>

        {/* Right: form */}
        <div className="lg:w-[440px] shrink-0 bg-bg-card border-l border-border flex items-center justify-center px-6 md:px-12 py-12">
          <div className="w-full max-w-sm">
            <h2 className="text-lg font-bold text-text-primary mb-1">Assista gratuitamente</h2>
            <p className="text-text-muted text-sm mb-6">Preencha seus dados para acessar o conteúdo.</p>
            <LeadCaptureForm
              moduleId={mod.id}
              utmSource={utm_source ?? null}
              utmCampaign={utm_campaign ?? null}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
