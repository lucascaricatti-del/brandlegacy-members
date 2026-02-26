import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata = { title: 'Masterclasses — BrandLegacy' }

export default async function MasterclassesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = createAdminClient()

  // Busca masterclasses publicadas via adminClient (bypass RLS)
  const { data: masterclasses } = await adminSupabase
    .from('modules')
    .select('*, lessons(id)')
    .eq('is_published', true)
    .eq('content_type', 'masterclass')
    .order('order_index')

  // Busca progresso do aluno
  const { data: progressData } = await supabase
    .from('lesson_progress')
    .select('lesson_id')
    .eq('user_id', user.id)

  // Busca os workspaces ativos do aluno para checar acesso via adminClient (bypass RLS)
  const { data: memberships } = await adminSupabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('is_active', true)

  const workspaceIds = (memberships ?? []).map((m) => m.workspace_id)

  // Masterclasses liberadas para os workspaces do aluno
  let grantedModuleIds = new Set<string>()
  if (workspaceIds.length > 0) {
    const { data: access } = await adminSupabase
      .from('content_access')
      .select('module_id')
      .in('workspace_id', workspaceIds)
      .is('revoked_at', null)
    grantedModuleIds = new Set((access ?? []).map((a) => a.module_id))
  }

  const completedIds = new Set((progressData ?? []).map((p) => p.lesson_id))
  const mcs = masterclasses ?? []

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Masterclasses</h1>
        <p className="text-text-secondary mt-1">
          Conteúdo exclusivo liberado para o seu workspace.
        </p>
      </div>

      {mcs.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-xl p-16 text-center">
          <div className="text-4xl mb-4">🎬</div>
          <p className="text-text-muted">Nenhuma masterclass disponível ainda.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {mcs.map((mc, index) => {
            const hasAccess = grantedModuleIds.has(mc.id)
            const total = mc.lessons?.length ?? 0
            const done = mc.lessons?.filter((l: { id: string }) => completedIds.has(l.id)).length ?? 0
            const pct = total > 0 ? Math.round((done / total) * 100) : 0
            const isCompleted = total > 0 && done === total

            if (!hasAccess) {
              return (
                <div
                  key={mc.id}
                  className="flex items-start gap-5 bg-bg-card border border-border rounded-xl p-6 opacity-60 cursor-not-allowed relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-bg-base/40 backdrop-blur-[1px] flex items-center justify-end pr-6">
                    <span className="text-xs text-text-muted bg-bg-surface border border-border px-3 py-1.5 rounded-full">
                      Bloqueado — solicite ao seu gestor
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold bg-bg-surface text-text-muted">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-text-muted mb-1">{mc.title}</h2>
                    {mc.description && (
                      <p className="text-text-muted text-sm line-clamp-2">{mc.description}</p>
                    )}
                  </div>
                </div>
              )
            }

            return (
              <Link
                key={mc.id}
                href={`/modulos/${mc.id}`}
                className="flex items-start gap-5 bg-bg-card border border-border rounded-xl p-6 hover:border-brand-gold/40 hover:bg-bg-surface transition-all duration-200 card-glow group"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${isCompleted ? 'bg-success/20 text-success' : 'bg-brand-gold/15 text-brand-gold'}`}>
                  {isCompleted ? '✓' : String(index + 1).padStart(2, '0')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="font-semibold text-text-primary group-hover:text-brand-gold transition-colors">
                      {mc.title}
                    </h2>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-brand-gold/15 text-brand-gold font-medium">
                      Masterclass
                    </span>
                  </div>
                  {mc.description && (
                    <p className="text-text-muted text-sm line-clamp-2 mb-3">{mc.description}</p>
                  )}
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-1.5 bg-bg-surface rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${isCompleted ? 'bg-success' : 'bg-brand-gold'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-text-muted shrink-0">{done}/{total} aulas · {pct}%</span>
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
