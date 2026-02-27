import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import VideoPlayer from '@/components/student/VideoPlayer'
import LessonProgressButton from '@/components/student/LessonProgressButton'
import AcademyLessonSidebar from './AcademyLessonSidebar'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ aula?: string }>
}

export default async function AcademyModulePage({ params, searchParams }: Props) {
  const { slug: moduleId } = await params
  const { aula: lessonIdParam } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = createAdminClient()

  const [moduleRes, progressRes] = await Promise.all([
    adminSupabase
      .from('modules')
      .select('*, lessons(*, materials(*))')
      .eq('id', moduleId)
      .eq('is_published', true)
      .order('order_index', { referencedTable: 'lessons' })
      .single(),
    supabase
      .from('lesson_progress')
      .select('lesson_id')
      .eq('user_id', user.id),
  ])

  if (!moduleRes.data) notFound()

  const mod = moduleRes.data
  const completedIds = new Set((progressRes.data ?? []).map((p) => p.lesson_id))
  const publishedLessons = (mod.lessons ?? []).filter((l) => l.is_published)

  // Determine active lesson
  const activeLesson = lessonIdParam
    ? publishedLessons.find((l) => l.id === lessonIdParam) ?? publishedLessons[0]
    : publishedLessons[0]

  if (!activeLesson) {
    return (
      <div className="animate-fade-in">
        <nav className="flex items-center gap-2 text-sm text-text-muted mb-6">
          <Link href="/academy" className="hover:text-text-primary transition-colors">Academy</Link>
          <span>/</span>
          <span className="text-text-secondary">{mod.title}</span>
        </nav>
        <div className="bg-bg-card border border-border rounded-xl p-16 text-center">
          <p className="text-text-muted">Nenhuma aula publicada ainda.</p>
        </div>
      </div>
    )
  }

  const isCompleted = completedIds.has(activeLesson.id)
  const currentIndex = publishedLessons.findIndex((l) => l.id === activeLesson.id)
  const nextLesson = currentIndex >= 0 ? publishedLessons[currentIndex + 1] : null
  const materials = activeLesson.materials ?? []
  const totalDone = publishedLessons.filter((l) => completedIds.has(l.id)).length
  const pct = publishedLessons.length > 0 ? Math.round((totalDone / publishedLessons.length) * 100) : 0

  return (
    <div className="animate-fade-in -mx-4 md:-mx-8">
      {/* Breadcrumb */}
      <div className="px-4 md:px-8">
        <nav className="flex items-center gap-2 text-sm text-text-muted mb-4">
          <Link href="/academy" className="hover:text-text-primary transition-colors">Academy</Link>
          <span>/</span>
          <span className="text-text-secondary line-clamp-1">{mod.title}</span>
        </nav>
      </div>

      <div className="flex flex-col lg:flex-row gap-0">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Video */}
          <div className="bg-black">
            {activeLesson.video_url ? (
              <div className="max-w-5xl mx-auto">
                <VideoPlayer
                  url={activeLesson.video_url}
                  type={activeLesson.video_type ?? 'youtube'}
                  title={activeLesson.title}
                />
              </div>
            ) : (
              <div className="max-w-5xl mx-auto flex items-center justify-center text-text-muted" style={{ aspectRatio: '16/9' }}>
                <div className="text-center">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-2 text-text-muted/40">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  <p className="text-sm">Vídeo em breve</p>
                </div>
              </div>
            )}
          </div>

          {/* Lesson info */}
          <div className="px-4 md:px-8 py-6 space-y-5 max-w-5xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-text-primary mb-1">{activeLesson.title}</h1>
                <p className="text-text-muted text-sm">
                  {mod.title} · Aula {currentIndex + 1} de {publishedLessons.length}
                  {activeLesson.duration_minutes > 0 && ` · ${activeLesson.duration_minutes} min`}
                </p>
              </div>
              <LessonProgressButton lessonId={activeLesson.id} isCompleted={isCompleted} />
            </div>

            {activeLesson.description && (
              <p className="text-text-secondary text-sm leading-relaxed">{activeLesson.description}</p>
            )}

            {/* Progress bar */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-bg-surface rounded-full overflow-hidden">
                <div className="h-full bg-brand-gold rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-text-muted shrink-0">{pct}%</span>
            </div>

            {/* Materials */}
            {materials.length > 0 && (
              <div className="bg-bg-card border border-border rounded-xl p-5">
                <h2 className="font-semibold text-text-primary mb-3 text-sm">Materiais</h2>
                <div className="space-y-2">
                  {materials.map((mat) => (
                    <a
                      key={mat.id}
                      href={mat.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-bg-surface hover:bg-bg-hover border border-border hover:border-brand-gold/40 transition-all group text-sm"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-gold shrink-0">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                      </svg>
                      <span className="text-text-primary group-hover:text-brand-gold transition-colors truncate">{mat.title}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Next lesson */}
            {nextLesson && (
              <Link
                href={`/academy/${moduleId}?aula=${nextLesson.id}`}
                className="flex items-center justify-between gap-3 p-4 rounded-xl bg-brand-gold/10 border border-brand-gold/30 hover:bg-brand-gold/20 transition-all"
              >
                <div className="min-w-0">
                  <p className="text-xs text-brand-gold font-medium">Próxima aula</p>
                  <p className="text-sm font-medium text-text-primary truncate">{nextLesson.title}</p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-gold shrink-0">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <AcademyLessonSidebar
          moduleId={moduleId}
          lessons={publishedLessons.map((l) => ({
            id: l.id,
            title: l.title,
            duration_minutes: l.duration_minutes,
            completed: completedIds.has(l.id),
          }))}
          activeLessonId={activeLesson.id}
        />
      </div>
    </div>
  )
}
