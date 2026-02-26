import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import VideoPlayer from '@/components/student/VideoPlayer'
import LessonProgressButton from '@/components/student/LessonProgressButton'

interface Props {
  params: Promise<{ moduleId: string; lessonId: string }>
}

export default async function LessonPage({ params }: Props) {
  const { moduleId, lessonId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [lessonRes, moduleRes, progressRes, nextLessonRes] = await Promise.all([
    supabase
      .from('lessons')
      .select('*, materials(*)')
      .eq('id', lessonId)
      .eq('is_published', true)
      .single(),
    supabase
      .from('modules')
      .select('id, title')
      .eq('id', moduleId)
      .eq('is_published', true)
      .single(),
    supabase
      .from('lesson_progress')
      .select('id')
      .eq('user_id', user.id)
      .eq('lesson_id', lessonId)
      .maybeSingle(),
    // Próxima aula do mesmo módulo
    supabase
      .from('lessons')
      .select('id, title, order_index')
      .eq('module_id', moduleId)
      .eq('is_published', true)
      .order('order_index'),
  ])

  if (!lessonRes.data || !moduleRes.data) notFound()

  const lesson = lessonRes.data
  const mod = moduleRes.data
  const isCompleted = !!progressRes.data
  const allLessons = nextLessonRes.data ?? []
  const currentIndex = allLessons.findIndex((l) => l.id === lessonId)
  const nextLesson = currentIndex >= 0 ? allLessons[currentIndex + 1] : null
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null
  const materials = lesson.materials ?? []

  return (
    <div className="animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-text-muted mb-6">
        <Link href="/modulos" className="hover:text-text-primary transition-colors">Módulos</Link>
        <span>/</span>
        <Link href={`/modulos/${moduleId}`} className="hover:text-text-primary transition-colors">{mod.title}</Link>
        <span>/</span>
        <span className="text-text-secondary line-clamp-1">{lesson.title}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna principal: vídeo + info */}
        <div className="lg:col-span-2 space-y-5">
          {/* Player de vídeo */}
          {lesson.video_url ? (
            <VideoPlayer
              url={lesson.video_url}
              type={lesson.video_type ?? 'youtube'}
              title={lesson.title}
            />
          ) : (
            <div className="w-full bg-bg-card border border-border rounded-xl flex items-center justify-center text-text-muted" style={{ aspectRatio: '16/9' }}>
              <div className="text-center">
                <div className="text-4xl mb-2">🎬</div>
                <p className="text-sm">Vídeo em breve</p>
              </div>
            </div>
          )}

          {/* Título e info da aula */}
          <div className="bg-bg-card border border-border rounded-xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-text-primary mb-1">{lesson.title}</h1>
                {lesson.duration_minutes > 0 && (
                  <p className="text-text-muted text-sm">{lesson.duration_minutes} minutos</p>
                )}
              </div>
              <LessonProgressButton lessonId={lessonId} isCompleted={isCompleted} />
            </div>

            {lesson.description && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-text-secondary text-sm leading-relaxed">{lesson.description}</p>
              </div>
            )}
          </div>

          {/* Materiais para download */}
          {materials.length > 0 && (
            <div className="bg-bg-card border border-border rounded-xl p-6">
              <h2 className="font-semibold text-text-primary mb-4">Materiais da Aula</h2>
              <div className="space-y-2">
                {materials.map((mat) => (
                  <a
                    key={mat.id}
                    href={mat.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="
                      flex items-center gap-3 p-3 rounded-lg
                      bg-bg-surface hover:bg-bg-hover
                      border border-border hover:border-brand-gold/40
                      transition-all group
                    "
                  >
                    <div className="w-9 h-9 rounded-lg bg-brand-gold/15 flex items-center justify-center shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-gold">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary group-hover:text-brand-gold transition-colors truncate">
                        {mat.title}
                      </p>
                      {mat.file_size_kb && (
                        <p className="text-xs text-text-muted">{formatFileSize(mat.file_size_kb)}</p>
                      )}
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted group-hover:text-brand-gold transition-colors shrink-0">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: navegação entre aulas */}
        <div className="space-y-4">
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-text-primary mb-4 text-sm">Aulas do Módulo</h3>
            <div className="space-y-1">
              {allLessons.map((l, i) => (
                <Link
                  key={l.id}
                  href={`/modulos/${moduleId}/aulas/${l.id}`}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
                    ${l.id === lessonId
                      ? 'bg-brand-gold/15 text-brand-gold font-medium'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                    }
                  `}
                >
                  <span className="text-xs w-5 text-center shrink-0 opacity-60">{i + 1}</span>
                  <span className="truncate">{l.title}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Navegação anterior/próxima */}
          <div className="flex flex-col gap-2">
            {prevLesson && (
              <Link
                href={`/modulos/${moduleId}/aulas/${prevLesson.id}`}
                className="
                  flex items-center gap-2 px-4 py-3 rounded-xl text-sm
                  bg-bg-card border border-border
                  hover:border-brand-gold/40 hover:bg-bg-surface
                  transition-all text-text-secondary hover:text-text-primary
                "
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                <div className="min-w-0">
                  <p className="text-xs text-text-muted">Anterior</p>
                  <p className="truncate font-medium">{prevLesson.title}</p>
                </div>
              </Link>
            )}
            {nextLesson && (
              <Link
                href={`/modulos/${moduleId}/aulas/${nextLesson.id}`}
                className="
                  flex items-center justify-between gap-2 px-4 py-3 rounded-xl text-sm
                  bg-brand-gold/10 border border-brand-gold/30
                  hover:bg-brand-gold/20
                  transition-all text-text-primary
                "
              >
                <div className="min-w-0">
                  <p className="text-xs text-brand-gold">Próxima</p>
                  <p className="truncate font-medium">{nextLesson.title}</p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-gold shrink-0">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function formatFileSize(kb: number): string {
  if (kb < 1024) return `${kb} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}
