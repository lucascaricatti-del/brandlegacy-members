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
        <nav className="flex items-center gap-2 text-sm text-[#8a9e8f] mb-6">
          <Link href="/academy" className="hover:text-white transition-colors">Academy</Link>
          <span className="text-[#8a9e8f]/40">/</span>
          <span className="text-white/80">{mod.title}</span>
        </nav>
        <div className="bg-[#0f2318] border border-[#1f3d25] rounded-xl p-16 text-center">
          <p className="text-[#8a9e8f]">Nenhuma aula publicada ainda.</p>
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
      <div className="px-4 md:px-8 py-4 bg-[#0a1a0f] border-b border-[#1f3d25]">
        <nav className="flex items-center gap-2 text-sm text-[#8a9e8f]">
          <Link href="/academy" className="hover:text-white transition-colors">Academy</Link>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#8a9e8f]/40"><polyline points="9 18 15 12 9 6" /></svg>
          <Link href={`/academy/${moduleId}`} className="hover:text-white transition-colors truncate max-w-[200px]">{mod.title}</Link>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#8a9e8f]/40 shrink-0"><polyline points="9 18 15 12 9 6" /></svg>
          <span className="text-white/80 truncate">{activeLesson.title}</span>
        </nav>
      </div>

      {/* 70/30 Layout */}
      <div className="flex flex-col lg:flex-row">
        {/* Main content — 70% */}
        <div className="flex-1 min-w-0">
          {/* Video Player */}
          <div className="bg-black">
            {activeLesson.video_url ? (
              <div className="max-w-full">
                <VideoPlayer
                  url={activeLesson.video_url}
                  type={activeLesson.video_type ?? 'youtube'}
                  title={activeLesson.title}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center text-[#8a9e8f]" style={{ aspectRatio: '16/9' }}>
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-[#1f3d25] flex items-center justify-center mx-auto mb-3">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#8a9e8f]/60 ml-0.5">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium">Vídeo em breve</p>
                </div>
              </div>
            )}
          </div>

          {/* Lesson info */}
          <div className="px-4 md:px-8 py-6 md:py-8 space-y-6">
            {/* Title + progress button */}
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl md:text-2xl font-bold text-white mb-2">{activeLesson.title}</h1>
                <div className="flex items-center gap-3 text-sm text-[#8a9e8f]">
                  <span>{mod.title}</span>
                  <span className="w-1 h-1 rounded-full bg-[#8a9e8f]/40" />
                  <span>Aula {currentIndex + 1} de {publishedLessons.length}</span>
                  {activeLesson.duration_minutes > 0 && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-[#8a9e8f]/40" />
                      <span>{activeLesson.duration_minutes} min</span>
                    </>
                  )}
                </div>
              </div>
              <LessonProgressButton lessonId={activeLesson.id} isCompleted={isCompleted} />
            </div>

            {/* Module progress */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-[#1f3d25] rounded-full overflow-hidden">
                <div className="h-full bg-[#c9a84c] rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-[#8a9e8f] shrink-0 font-medium">{pct}% do módulo</span>
            </div>

            {/* Description */}
            {activeLesson.description && (
              <div className="bg-[#0f2318] border border-[#1f3d25] rounded-xl p-5">
                <h2 className="text-sm font-semibold text-white mb-2">Sobre esta aula</h2>
                <p className="text-[#8a9e8f] text-sm leading-relaxed whitespace-pre-line">{activeLesson.description}</p>
              </div>
            )}

            {/* Materials */}
            {materials.length > 0 && (
              <div className="bg-[#0f2318] border border-[#1f3d25] rounded-xl p-5">
                <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#c9a84c]">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Materiais para download
                </h2>
                <div className="space-y-2">
                  {materials.map((mat) => (
                    <a
                      key={mat.id}
                      href={mat.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg bg-[#152d1f] hover:bg-[#1f3d25] border border-[#1f3d25] hover:border-[#c9a84c]/30 transition-all group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-[#c9a84c]/10 flex items-center justify-center shrink-0">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#c9a84c]">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        </svg>
                      </div>
                      <span className="text-sm text-white group-hover:text-[#c9a84c] transition-colors truncate flex-1">{mat.title}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#8a9e8f] shrink-0">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Next lesson */}
            {nextLesson && (
              <Link
                href={`/academy/${moduleId}?aula=${nextLesson.id}`}
                className="flex items-center justify-between gap-3 p-5 rounded-xl bg-[#c9a84c]/10 border border-[#c9a84c]/25 hover:bg-[#c9a84c]/15 hover:border-[#c9a84c]/40 transition-all group"
              >
                <div className="min-w-0">
                  <p className="text-xs text-[#c9a84c] font-semibold mb-1 uppercase tracking-wide">Próxima aula</p>
                  <p className="text-sm font-bold text-white group-hover:text-[#c9a84c] transition-colors truncate">{nextLesson.title}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-[#c9a84c]/20 flex items-center justify-center shrink-0 group-hover:bg-[#c9a84c]/30 transition-colors">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#c9a84c]">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </Link>
            )}
          </div>
        </div>

        {/* Sidebar — 30% on desktop, accordion on mobile */}
        <AcademyLessonSidebar
          moduleId={moduleId}
          moduleTitle={mod.title}
          lessons={publishedLessons.map((l) => ({
            id: l.id,
            title: l.title,
            duration_minutes: l.duration_minutes,
            completed: completedIds.has(l.id),
          }))}
          activeLessonId={activeLesson.id}
          totalDone={totalDone}
        />
      </div>
    </div>
  )
}
