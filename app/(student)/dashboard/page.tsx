import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { KanbanPriority } from '@/lib/types/database'

const PRIORITY_COLORS: Record<KanbanPriority, string> = {
  low: 'text-success bg-success/10',
  medium: 'text-info bg-info/10',
  high: 'text-warning bg-warning/10',
  urgent: 'text-error bg-error/10',
}
const PRIORITY_LABELS: Record<KanbanPriority, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = createAdminClient()

  // Busca perfil
  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .single()

  // Busca workspace ativo do usuário
  const { data: membership } = await adminSupabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .single()

  const workspaceId = membership?.workspace_id

  // Busca entregas do workspace
  let deliveries: { id: string; status: string }[] = []
  if (workspaceId) {
    const { data } = await adminSupabase
      .from('deliveries')
      .select('id, status')
      .eq('workspace_id', workspaceId)

    deliveries = data ?? []
  }

  const totalDeliveries = deliveries.length
  const completedDeliveries = deliveries.filter((d) => d.status === 'completed').length
  const deliveryProgress = totalDeliveries > 0
    ? Math.round((completedDeliveries / totalDeliveries) * 100)
    : 0

  // Busca tarefas pendentes do kanban (cards que não estão em colunas "Concluído")
  type PendingCard = {
    id: string
    title: string
    priority: KanbanPriority
    due_date: string | null
    column_title: string
  }
  let pendingCards: PendingCard[] = []

  if (workspaceId) {
    // Busca o board do workspace
    const { data: board } = await adminSupabase
      .from('kanban_boards')
      .select('id')
      .eq('workspace_id', workspaceId)
      .single()

    if (board) {
      // Busca colunas com seus cards
      const { data: columns } = await adminSupabase
        .from('kanban_columns')
        .select('id, title, kanban_cards(id, title, priority, due_date, is_archived, order_index)')
        .eq('board_id', board.id)
        .order('order_index')

      type RawCol = {
        id: string
        title: string
        kanban_cards: {
          id: string
          title: string
          priority: string
          due_date: string | null
          is_archived: boolean
          order_index: number
        }[]
      }

      const rawColumns = (columns ?? []) as unknown as RawCol[]

      // Filtra cards que NÃO estão em colunas "Concluído" e não estão arquivados
      for (const col of rawColumns) {
        if (col.title.toLowerCase().includes('concluíd')) continue
        for (const card of col.kanban_cards) {
          if (card.is_archived) continue
          pendingCards.push({
            id: card.id,
            title: card.title,
            priority: card.priority as KanbanPriority,
            due_date: card.due_date,
            column_title: col.title,
          })
        }
      }

      // Ordena por prioridade (urgent > high > medium > low), depois por due_date
      const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
      pendingCards.sort((a, b) => {
        const pa = priorityOrder[a.priority] ?? 2
        const pb = priorityOrder[b.priority] ?? 2
        if (pa !== pb) return pa - pb
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
        if (a.due_date) return -1
        if (b.due_date) return 1
        return 0
      })

      pendingCards = pendingCards.slice(0, 5)
    }
  }

  const firstName = profile?.name?.split(' ')[0] ?? 'Aluno'

  return (
    <div className="animate-fade-in">
      {/* Saudação */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">
          Olá, {firstName}!
        </h1>
        <p className="text-text-secondary mt-1">
          Acompanhe o progresso da sua mentoria.
        </p>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <StatCard
          label="Progresso da mentoria"
          value={`${deliveryProgress}%`}
          sub={`${completedDeliveries} de ${totalDeliveries} entregas`}
          accent
        />
        <StatCard
          label="Entregas concluídas"
          value={String(completedDeliveries)}
          sub={totalDeliveries > 0 ? 'continue assim!' : 'nenhuma entrega ainda'}
        />
        <StatCard
          label="Tarefas pendentes"
          value={String(pendingCards.length)}
          sub="no kanban"
        />
      </div>

      {/* Barra de progresso da mentoria */}
      {totalDeliveries > 0 && (
        <div className="bg-bg-card border border-border rounded-xl p-6 mb-10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-text-primary">Progresso da Mentoria</span>
            <span className="text-sm font-bold text-brand-gold">{deliveryProgress}%</span>
          </div>
          <div className="w-full h-2 bg-bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-gold rounded-full transition-all duration-700"
              style={{ width: `${deliveryProgress}%` }}
            />
          </div>
          <p className="text-xs text-text-muted mt-2">
            {completedDeliveries} de {totalDeliveries} entregas concluídas
          </p>
        </div>
      )}

      {/* Tarefas Pendentes */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Tarefas Pendentes</h2>
          {workspaceId && (
            <Link
              href={`/workspace/kanban?ws=${workspaceId}`}
              className="text-sm text-brand-gold hover:text-brand-gold-light transition-colors"
            >
              Ver kanban →
            </Link>
          )}
        </div>

        {pendingCards.length === 0 ? (
          <div className="bg-bg-card border border-border rounded-xl p-12 text-center">
            <p className="text-text-muted text-sm">Nenhuma tarefa pendente no momento.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingCards.map((card) => (
              <div
                key={card.id}
                className="flex items-center gap-3 p-4 bg-bg-card border border-border rounded-xl hover:border-brand-gold/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{card.title}</p>
                  <p className="text-xs text-text-muted mt-0.5">{card.column_title}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLORS[card.priority]}`}>
                    {PRIORITY_LABELS[card.priority]}
                  </span>
                  {card.due_date && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      new Date(card.due_date) < new Date()
                        ? 'text-error bg-error/10'
                        : 'text-text-muted bg-bg-surface'
                    }`}>
                      {new Date(card.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
            ))}
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
