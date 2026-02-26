import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import EditWorkspaceForm from './EditWorkspaceForm'
import MentoradoAccessManager from './MentoradoAccessManager'
import ContractForm from './ContractForm'

interface Props {
  params: Promise<{ id: string }>
}

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

export default async function AdminWorkspacePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = createAdminClient()

  const [workspaceRes, contractsRes] = await Promise.all([
    supabase
      .from('workspaces')
      .select('*, workspace_members(*)')
      .eq('id', id)
      .single(),
    supabase
      .from('mentoring_contracts')
      .select('*')
      .eq('workspace_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!workspaceRes.data) notFound()

  const ws = workspaceRes.data
  const members = ws.workspace_members ?? []
  const contracts = contractsRes.data ?? []
  const activeContract = contracts.find((c) => c.status === 'active')

  // Busca profiles dos membros separadamente
  const memberIds = members.map((m) => m.user_id)
  const profilesRes = memberIds.length > 0
    ? await supabase.from('profiles').select('id, name, email, avatar_url').in('id', memberIds)
    : { data: [] as { id: string; name: string; email: string; avatar_url: string | null }[] }

  const profileMap = Object.fromEntries(
    (profilesRes.data ?? []).map((p) => [p.id, p])
  )

  // Busca kanban board + métricas via adminClient (bypass RLS)
  const { data: board } = await adminSupabase
    .from('kanban_boards')
    .select('id')
    .eq('workspace_id', id)
    .single()

  type RawKanbanCol = {
    title: string
    kanban_cards: { is_archived: boolean; due_date: string | null }[]
  }

  let kanbanStats = {
    totalCards: 0,
    overdueCards: 0,
    columns: [] as { title: string; count: number }[],
  }

  if (board) {
    const today = new Date().toISOString().split('T')[0]
    const { data: cols } = await adminSupabase
      .from('kanban_columns')
      .select('title, order_index, kanban_cards(is_archived, due_date)')
      .eq('board_id', board.id)
      .order('order_index')

    const rawCols = (cols as unknown as RawKanbanCol[] ?? [])
    kanbanStats = {
      totalCards: rawCols.reduce(
        (sum, col) => sum + (col.kanban_cards ?? []).filter((c) => !c.is_archived).length,
        0
      ),
      overdueCards: rawCols.reduce(
        (sum, col) =>
          sum +
          (col.kanban_cards ?? []).filter(
            (c) => !c.is_archived && !!c.due_date && c.due_date < today
          ).length,
        0
      ),
      columns: rawCols.map((col) => ({
        title: col.title,
        count: (col.kanban_cards ?? []).filter((c) => !c.is_archived).length,
      })),
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-text-muted mb-6">
        <Link href="/admin/workspaces" className="hover:text-text-primary transition-colors">Empresas</Link>
        <span>/</span>
        <span className="text-text-secondary">{ws.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-gold/15 flex items-center justify-center text-xl font-bold text-brand-gold">
            {ws.name[0]?.toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{ws.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${PLAN_COLORS[ws.plan_type as keyof typeof PLAN_COLORS]}`}>
                {PLAN_LABELS[ws.plan_type as keyof typeof PLAN_LABELS]}
              </span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full ${ws.is_active ? 'bg-success/15 text-success' : 'bg-error/15 text-error'}`}>
                {ws.is_active ? 'Ativo' : 'Inativo'}
              </span>
              <span className="text-xs text-text-muted">{ws.slug}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/admin/workspaces/${id}/sessoes`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-surface text-text-secondary border border-border hover:bg-bg-hover hover:text-text-primary text-sm font-medium transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a4 4 0 0 0-4 4v6a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4z" />
              <path d="M12 18.5V22" />
              <path d="M7 22h10" />
            </svg>
            Sessões IA
          </Link>
          <Link
            href={`/admin/workspaces/${id}/entregas`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-gold/15 text-brand-gold border border-brand-gold/30 hover:bg-brand-gold/25 text-sm font-medium transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            Entregas
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna esquerda: edição + contrato */}
        <div className="space-y-6">
          <div className="bg-bg-card border border-border rounded-xl p-6">
            <h2 className="font-semibold text-text-primary mb-4">Editar Empresa</h2>
            <EditWorkspaceForm workspace={ws} />
          </div>

          {/* Contrato */}
          <div className="bg-bg-card border border-border rounded-xl p-6">
            <h2 className="font-semibold text-text-primary mb-1">Contrato</h2>
            {activeContract && (
              <div className="mb-4 p-3 bg-bg-surface rounded-lg border border-border text-xs text-text-secondary space-y-1">
                <p className="font-medium text-text-primary capitalize">{activeContract.plan_type} — {activeContract.status}</p>
                <p>Início: {new Date(activeContract.start_date).toLocaleDateString('pt-BR')}</p>
                <p>Duração: {activeContract.duration_months} meses</p>
                <p>Deliveries: {activeContract.deliveries_completed}/{activeContract.total_deliveries_promised}</p>
                <p className="font-medium">
                  R$ {Number(activeContract.contract_value_brl).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}
            <ContractForm workspaceId={ws.id} existingContract={activeContract ?? null} />
          </div>
        </div>

        {/* Coluna central: acessos */}
        <div className="space-y-6">
          <div className="bg-bg-card border border-border rounded-xl p-6">
            <h2 className="font-semibold text-text-primary mb-4">Acessos</h2>
            <MentoradoAccessManager
              workspaceId={ws.id}
              members={members.map((m) => ({
                id: m.id,
                userId: m.user_id,
                name: profileMap[m.user_id]?.name ?? '',
                email: profileMap[m.user_id]?.email ?? '',
                role: m.role,
                isActive: m.is_active,
              }))}
            />
          </div>
        </div>

        {/* Coluna direita: Gestor de Tarefas */}
        <div>
          <div className="bg-bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-text-primary">Gestor de Tarefas</h2>
              <Link
                href={`/admin/workspaces/${id}/kanban`}
                className="text-xs text-brand-gold hover:text-brand-gold-light transition-colors"
              >
                Ver board →
              </Link>
            </div>

            {!board ? (
              <p className="text-text-muted text-sm text-center py-4">Board ainda não criado.</p>
            ) : kanbanStats.totalCards === 0 ? (
              <p className="text-text-muted text-sm text-center py-4">Nenhum card criado ainda.</p>
            ) : (
              <div className="space-y-4">
                {/* Métricas resumidas */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-bg-surface rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-text-primary">{kanbanStats.totalCards}</p>
                    <p className="text-xs text-text-muted mt-0.5">Cards ativos</p>
                  </div>
                  <div className="bg-bg-surface rounded-lg p-3 text-center">
                    <p className={`text-2xl font-bold ${kanbanStats.overdueCards > 0 ? 'text-error' : 'text-text-primary'}`}>
                      {kanbanStats.overdueCards}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">Em atraso</p>
                  </div>
                </div>

                {/* Cards por coluna */}
                <div className="space-y-1.5">
                  {kanbanStats.columns
                    .filter((c) => c.count > 0)
                    .map((col) => (
                      <div key={col.title} className="flex items-center justify-between">
                        <span className="text-sm text-text-secondary truncate">{col.title}</span>
                        <span className="text-sm text-text-muted ml-2 shrink-0 font-medium">{col.count}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <Link
              href={`/admin/workspaces/${id}/kanban`}
              className="mt-5 w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-brand-gold/10 border border-brand-gold/20 text-brand-gold text-sm hover:bg-brand-gold/20 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              </svg>
              Abrir Kanban
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
