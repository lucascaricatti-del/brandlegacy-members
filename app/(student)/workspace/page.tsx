import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const PLAN_LABELS = { free: 'Free', tracao: 'Tração', club: 'Club' }
const PLAN_COLORS = {
  free: 'bg-bg-surface text-text-muted border border-border',
  tracao: 'bg-info/15 text-info',
  club: 'bg-brand-gold/15 text-brand-gold',
}
const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner', admin: 'Admin', manager: 'Manager',
  collaborator: 'Colaborador', viewer: 'Visualizador',
}

export default async function WorkspacePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Workspaces em que o usuário é membro ativo
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('role, workspace_id, workspaces(id, name, slug, plan_type, is_active, workspace_members(id, is_active, profiles(id, name, avatar_url)))')
    .eq('user_id', user.id)
    .eq('is_active', true)

  const workspaces = (memberships ?? []).map((m) => ({
    myRole: m.role,
    ...(m.workspaces as {
      id: string
      name: string
      slug: string
      plan_type: string
      is_active: boolean
      workspace_members: { id: string; is_active: boolean; profiles: { id: string; name: string; avatar_url: string | null } | null }[]
    }),
  }))

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Workspaces</h1>
        <p className="text-text-secondary mt-1">
          {workspaces.length === 0
            ? 'Você ainda não faz parte de nenhum workspace.'
            : `${workspaces.length} workspace${workspaces.length > 1 ? 's' : ''} disponível${workspaces.length > 1 ? 'is' : ''}.`}
        </p>
      </div>

      {workspaces.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-xl p-16 text-center">
          <div className="text-4xl mb-4">🏢</div>
          <p className="text-text-muted mb-2">Você não está em nenhum workspace ainda.</p>
          <p className="text-text-muted text-sm">Entre em contato com seu gestor para ser adicionado.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {workspaces.map((ws) => {
            const activeMembers = ws.workspace_members?.filter((m) => m.is_active) ?? []
            const planKey = ws.plan_type as keyof typeof PLAN_LABELS

            return (
              <div key={ws.id} className="bg-bg-card border border-border rounded-xl p-6 card-glow">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-gold/15 flex items-center justify-center text-lg font-bold text-brand-gold">
                      {ws.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <h2 className="font-semibold text-text-primary">{ws.name}</h2>
                      <p className="text-xs text-text-muted">{ws.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${PLAN_COLORS[planKey] ?? PLAN_COLORS.free}`}>
                      {PLAN_LABELS[planKey] ?? ws.plan_type}
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-bg-surface text-text-muted border border-border">
                      {ROLE_LABELS[ws.myRole] ?? ws.myRole}
                    </span>
                  </div>
                </div>

                {/* Membros */}
                <div className="mb-4">
                  <p className="text-xs font-medium text-text-muted mb-2">
                    {activeMembers.length} membro{activeMembers.length !== 1 ? 's' : ''} ativo{activeMembers.length !== 1 ? 's' : ''}
                  </p>
                  <div className="flex -space-x-2">
                    {activeMembers.slice(0, 8).map((m) => (
                      <div
                        key={m.id}
                        className="w-8 h-8 rounded-full bg-brand-gold/20 border-2 border-bg-card flex items-center justify-center shrink-0"
                        title={m.profiles?.name ?? ''}
                      >
                        <span className="text-brand-gold text-xs font-semibold">
                          {m.profiles?.name?.[0]?.toUpperCase() ?? '?'}
                        </span>
                      </div>
                    ))}
                    {activeMembers.length > 8 && (
                      <div className="w-8 h-8 rounded-full bg-bg-surface border-2 border-bg-card flex items-center justify-center shrink-0">
                        <span className="text-text-muted text-xs">+{activeMembers.length - 8}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Link para o Kanban */}
                <div className="flex items-center gap-3 pt-4 border-t border-border">
                  <Link
                    href={`/workspace/kanban?ws=${ws.id}`}
                    className="flex items-center gap-2 text-sm text-text-secondary hover:text-brand-gold transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="4" height="18" rx="1"/>
                      <rect x="10" y="3" width="4" height="12" rx="1"/>
                      <rect x="17" y="3" width="4" height="15" rx="1"/>
                    </svg>
                    Kanban
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
