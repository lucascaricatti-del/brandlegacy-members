import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

interface Props {
  params: Promise<{ moduleId: string }>
}

export default async function ModulePage({ params }: Props) {
  const { moduleId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [moduleRes, progressRes] = await Promise.all([
    supabase
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
  const total = publishedLessons.length
  const done = publishedLessons.filter((l) => completedIds.has(l.id)).length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-text-muted mb-6">
        <Link href="/modulos" className="hover:text-text-primary transition-colors">Módulos</Link>
        <span>/</span>
        <span className="text-text-secondary">{mod.title}</span>
      </nav>

      {/* Header do módulo */}
      <div className="bg-bg-card border border-border rounded-xl p-7 mb-6">
        <h1 className="text-2xl font-bold text-text-primary mb-2">{mod.title}</h1>
        {mod.description && (
          <p className="text-text-secondary mb-5">{mod.description}</p>
        )}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-2 bg-bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-gold rounded-full transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-sm font-medium text-brand-gold shrink-0">
            {done}/{total} aulas concluídas
          </span>
        </div>
      </div>

      {/* Lista de aulas */}
      <h2 className="text-lg font-semibold text-text-primary mb-4">Aulas</h2>

      {publishedLessons.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-xl p-12 text-center">
          <p className="text-text-muted text-sm">Nenhuma aula publicada ainda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {publishedLessons.map((lesson, index) => {
            const isCompleted = completedIds.has(lesson.id)
            const materials = lesson.materials ?? []

            return (
              <Link
                key={lesson.id}
                href={`/modulos/${mod.id}/aulas/${lesson.id}`}
                className="
                  flex items-center gap-4 bg-bg-card border border-border rounded-xl px-5 py-4
                  hover:border-brand-gold/40 hover:bg-bg-surface
                  transition-all duration-200 group
                "
              >
                {/* Status da aula */}
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold
                    ${isCompleted
                      ? 'bg-success/20 text-success'
                      : 'bg-bg-surface text-text-muted border border-border'
                    }
                  `}
                >
                  {isCompleted ? '✓' : index + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-sm group-hover:text-brand-gold transition-colors ${isCompleted ? 'text-text-secondary' : 'text-text-primary'}`}>
                    {lesson.title}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {lesson.duration_minutes > 0 && (
                      <span className="text-text-muted text-xs">{lesson.duration_minutes} min</span>
                    )}
                    {materials.length > 0 && (
                      <span className="text-text-muted text-xs flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        {materials.length} {materials.length === 1 ? 'material' : 'materiais'}
                      </span>
                    )}
                  </div>
                </div>

                {isCompleted && (
                  <span className="text-xs text-success bg-success/10 px-2 py-0.5 rounded-full shrink-0">
                    Concluída
                  </span>
                )}

                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted group-hover:text-brand-gold transition-colors shrink-0">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
