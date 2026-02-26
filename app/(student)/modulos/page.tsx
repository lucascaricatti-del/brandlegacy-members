import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ModulosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [modulesRes, progressRes] = await Promise.all([
    supabase
      .from('modules')
      .select('*, lessons(id)')
      .eq('is_published', true)
      .order('order_index'),
    supabase
      .from('lesson_progress')
      .select('lesson_id')
      .eq('user_id', user.id),
  ])

  const modules = modulesRes.data ?? []
  const completedIds = new Set((progressRes.data ?? []).map((p) => p.lesson_id))

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Módulos do Curso</h1>
        <p className="text-text-secondary mt-1">
          {modules.length} {modules.length === 1 ? 'módulo disponível' : 'módulos disponíveis'}
        </p>
      </div>

      {modules.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-xl p-16 text-center">
          <div className="text-4xl mb-4">📚</div>
          <p className="text-text-muted">Nenhum módulo disponível ainda. Em breve!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {modules.map((mod, index) => {
            const total = mod.lessons?.length ?? 0
            const done = mod.lessons?.filter((l) => completedIds.has(l.id)).length ?? 0
            const pct = total > 0 ? Math.round((done / total) * 100) : 0
            const isCompleted = total > 0 && done === total

            return (
              <Link
                key={mod.id}
                href={`/modulos/${mod.id}`}
                className="
                  flex items-start gap-5 bg-bg-card border border-border rounded-xl p-6
                  hover:border-brand-gold/40 hover:bg-bg-surface
                  transition-all duration-200 card-glow group
                "
              >
                {/* Número do módulo */}
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold
                    ${isCompleted
                      ? 'bg-success/20 text-success'
                      : 'bg-brand-gold/15 text-brand-gold'
                    }
                  `}
                >
                  {isCompleted ? '✓' : String(index + 1).padStart(2, '0')}
                </div>

                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-text-primary group-hover:text-brand-gold transition-colors mb-1">
                    {mod.title}
                  </h2>
                  {mod.description && (
                    <p className="text-text-muted text-sm line-clamp-2 mb-3">{mod.description}</p>
                  )}
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-1.5 bg-bg-surface rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isCompleted ? 'bg-success' : 'bg-brand-gold'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-text-muted shrink-0">
                      {done}/{total} aulas · {pct}%
                    </span>
                  </div>
                </div>

                <div className="text-text-muted group-hover:text-brand-gold transition-colors">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
