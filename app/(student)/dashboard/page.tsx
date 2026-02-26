import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Busca perfil, módulos publicados e progresso do aluno em paralelo
  const [profileRes, modulesRes, progressRes] = await Promise.all([
    supabase.from('profiles').select('name').eq('id', user.id).single(),
    supabase
      .from('modules')
      .select('id, title, description, thumbnail_url, lessons(id)')
      .eq('is_published', true)
      .order('order_index'),
    supabase
      .from('lesson_progress')
      .select('lesson_id')
      .eq('user_id', user.id),
  ])

  const profile = profileRes.data
  const modules = modulesRes.data ?? []
  const completedIds = new Set((progressRes.data ?? []).map((p) => p.lesson_id))

  // Calcula estatísticas globais
  const totalLessons = modules.reduce((acc, m) => acc + (m.lessons?.length ?? 0), 0)
  const completedLessons = completedIds.size
  const overallProgress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

  const firstName = profile?.name?.split(' ')[0] ?? 'Aluno'

  return (
    <div className="animate-fade-in">
      {/* Saudação */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">
          Olá, {firstName}! 👋
        </h1>
        <p className="text-text-secondary mt-1">
          Continue de onde parou. Você está indo muito bem.
        </p>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <StatCard
          label="Progresso geral"
          value={`${overallProgress}%`}
          sub={`${completedLessons} de ${totalLessons} aulas`}
          accent
        />
        <StatCard
          label="Módulos disponíveis"
          value={String(modules.length)}
          sub="módulos publicados"
        />
        <StatCard
          label="Aulas concluídas"
          value={String(completedLessons)}
          sub="continue assim!"
        />
      </div>

      {/* Barra de progresso geral */}
      <div className="bg-bg-card border border-border rounded-xl p-6 mb-10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-text-primary">Progresso total do curso</span>
          <span className="text-sm font-bold text-brand-gold">{overallProgress}%</span>
        </div>
        <div className="w-full h-2 bg-bg-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-gold rounded-full transition-all duration-700"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* Módulos */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Seus Módulos</h2>
          <Link
            href="/modulos"
            className="text-sm text-brand-gold hover:text-brand-gold-light transition-colors"
          >
            Ver todos →
          </Link>
        </div>

        {modules.length === 0 ? (
          <div className="bg-bg-card border border-border rounded-xl p-12 text-center">
            <p className="text-text-muted text-sm">Nenhum módulo disponível ainda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {modules.map((mod) => {
              const total = mod.lessons?.length ?? 0
              const done = mod.lessons?.filter((l) => completedIds.has(l.id)).length ?? 0
              const pct = total > 0 ? Math.round((done / total) * 100) : 0

              return (
                <Link
                  key={mod.id}
                  href={`/modulos/${mod.id}`}
                  className="
                    bg-bg-card border border-border rounded-xl p-5
                    hover:border-brand-gold/40 hover:bg-bg-surface
                    transition-all duration-200 card-glow group
                  "
                >
                  <h3 className="font-semibold text-text-primary group-hover:text-brand-gold transition-colors mb-1">
                    {mod.title}
                  </h3>
                  {mod.description && (
                    <p className="text-text-muted text-sm line-clamp-2 mb-4">{mod.description}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-text-muted mb-2">
                    <span>{done}/{total} aulas</span>
                    <span className="font-medium text-brand-gold">{pct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-bg-surface rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-gold rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub: string
  accent?: boolean
}) {
  return (
    <div
      className={`
        bg-bg-card border rounded-xl p-5
        ${accent ? 'border-brand-gold/30' : 'border-border'}
      `}
    >
      <p className="text-text-muted text-xs font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-3xl font-bold ${accent ? 'text-brand-gold' : 'text-text-primary'}`}>{value}</p>
      <p className="text-text-muted text-xs mt-1">{sub}</p>
    </div>
  )
}
