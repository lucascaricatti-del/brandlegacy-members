import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'

interface Props {
  params: Promise<{ slug: string }>
}

function getEmbedUrl(videoUrl: string): string | null {
  // YouTube
  const ytMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/)
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`

  // Vimeo
  const vimeoMatch = videoUrl.match(/vimeo\.com\/(\d+)/)
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`

  return videoUrl
}

export default async function ObrigadoPage({ params }: Props) {
  const { slug: moduleId } = await params

  const adminSupabase = createAdminClient()

  const { data: mod } = await adminSupabase
    .from('modules')
    .select('id, title, description, lessons(id, title, video_url, video_type, order_index)')
    .eq('id', moduleId)
    .eq('is_published', true)
    .order('order_index', { referencedTable: 'lessons' })
    .single()

  if (!mod) notFound()

  const lessons = (mod.lessons ?? []).filter((l) => l.video_url)
  const firstLesson = lessons[0]

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 border-b border-border">
        <img src="/logo.png" alt="BrandLegacy" className="h-7 w-auto" />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-3xl w-full text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/15 text-green-400 text-xs font-medium mb-4">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            Acesso liberado
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-2">{mod.title}</h1>
          {mod.description && <p className="text-text-secondary">{mod.description}</p>}
        </div>

        {/* Video embed */}
        {firstLesson?.video_url && (
          <div className="w-full max-w-3xl rounded-xl overflow-hidden border border-border bg-black mb-8">
            <div className="relative" style={{ paddingBottom: '56.25%' }}>
              <iframe
                src={getEmbedUrl(firstLesson.video_url) ?? ''}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        )}

        {/* Lesson list */}
        {lessons.length > 1 && (
          <div className="w-full max-w-3xl">
            <h2 className="text-sm font-semibold text-text-primary mb-3">Todas as aulas</h2>
            <div className="space-y-2">
              {lessons.map((lesson, i) => (
                <div key={lesson.id} className="flex items-center gap-3 p-3 rounded-xl bg-bg-card border border-border">
                  <div className="w-7 h-7 rounded-full bg-brand-gold/15 flex items-center justify-center text-brand-gold text-xs font-bold shrink-0">
                    {i + 1}
                  </div>
                  <span className="text-sm text-text-primary">{lesson.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
