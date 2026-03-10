import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import TeamClient from './TeamClient'

export const metadata = { title: 'Meu Time — BrandLegacy' }

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = createAdminClient()

  // Busca workspaces onde o usuário é owner ou manager
  const { data: memberships } = await adminSupabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(id, name, plan_type)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .in('role', ['owner', 'manager'])

  type Membership = {
    workspace_id: string
    role: string
    workspaces: { id: string; name: string; plan_type: string } | null
  }

  const adminWorkspaces = ((memberships ?? []) as unknown as Membership[])
    .map((m) => m.workspaces)
    .filter(Boolean) as { id: string; name: string; plan_type: string }[]

  // Se não for owner/manager de nenhum workspace, mostra mensagem
  if (adminWorkspaces.length === 0) {
    const { data: anyMembership } = await adminSupabase
      .from('workspace_members')
      .select('workspace_id, workspaces(name)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .single()

    type AnyMembership = {
      workspace_id: string
      workspaces: { name: string } | null
    }

    const ws = (anyMembership as unknown as AnyMembership | null)?.workspaces

    return (
      <div className="animate-fade-in">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-primary">Meu Time</h1>
          <p className="text-text-secondary mt-1">Gerencie os membros do seu workspace.</p>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-12 text-center">
          <div className="text-4xl mb-4">👥</div>
          {ws ? (
            <>
              <p className="text-text-primary font-medium mb-1">Você é membro de {ws.name}</p>
              <p className="text-text-muted text-sm">
                Apenas o <strong className="text-text-secondary">owner</strong> ou <strong className="text-text-secondary">manager</strong> pode gerenciar o time.
              </p>
            </>
          ) : (
            <>
              <p className="text-text-muted mb-1">Você não está em nenhum workspace.</p>
              <p className="text-text-muted text-sm">Entre em contato com seu mentor para ser adicionado.</p>
            </>
          )}
        </div>
      </div>
    )
  }

  const ws = adminWorkspaces[0]

  // Fetch members with profiles
  const { data: rawMembers } = await adminSupabase
    .from('workspace_members')
    .select('id, user_id, role, is_active, permissions')
    .eq('workspace_id', ws.id)
    .eq('is_active', true)

  const memberUserIds = (rawMembers ?? []).map((m) => m.user_id)

  const { data: profiles } = memberUserIds.length > 0
    ? await adminSupabase
        .from('profiles')
        .select('id, name, email')
        .in('id', memberUserIds)
    : { data: [] as { id: string; name: string; email: string }[] }

  const profileMap = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, p])
  )

  const members = (rawMembers ?? []).map((m) => ({
    id: m.id,
    userId: m.user_id,
    name: profileMap[m.user_id]?.name ?? '',
    email: profileMap[m.user_id]?.email ?? '',
    role: m.role,
    permissions: m.permissions as Record<string, unknown> | null,
    isOwnerOrManager: ['owner', 'manager'].includes(m.role),
  }))

  // Fetch pending invites
  const { data: pendingInvites } = await adminSupabase
    .from('workspace_invites')
    .select('id, email, role, status, created_at, expires_at')
    .eq('workspace_id', ws.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  const PLAN_LABELS: Record<string, string> = { free: 'Free', tracao: 'Tração', club: 'Club' }
  const PLAN_COLORS: Record<string, string> = {
    free: 'bg-bg-surface text-text-muted border border-border',
    tracao: 'bg-info/15 text-info',
    club: 'bg-brand-gold/15 text-brand-gold',
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-text-primary">Meu Time</h1>
          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${PLAN_COLORS[ws.plan_type] ?? PLAN_COLORS.free}`}>
            {PLAN_LABELS[ws.plan_type] ?? ws.plan_type}
          </span>
        </div>
        <p className="text-text-secondary">{ws.name} — {members.length} membro{members.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="max-w-2xl">
        <TeamClient
          workspaceId={ws.id}
          members={members}
          pendingInvites={pendingInvites ?? []}
          currentUserId={user.id}
        />
      </div>
    </div>
  )
}
