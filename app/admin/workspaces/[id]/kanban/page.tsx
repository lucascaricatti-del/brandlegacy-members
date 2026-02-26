import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import KanbanBoard from '@/components/kanban/Board'
import type { KanbanPriority, CardLabel, CardAttachment } from '@/lib/types/database'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AdminWorkspaceKanbanPage({ params }: Props) {
  const { id } = await params

  // Verificação de autenticação e papel admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  // Dados via adminClient (bypass RLS — admin não é membro do workspace)
  const adminSupabase = createAdminClient()

  const { data: workspace } = await adminSupabase
    .from('workspaces')
    .select('id, name')
    .eq('id', id)
    .single()

  if (!workspace) notFound()

  const { data: board } = await adminSupabase
    .from('kanban_boards')
    .select('id, title')
    .eq('workspace_id', id)
    .single()

  if (!board) {
    return (
      <div className="animate-fade-in">
        <nav className="flex items-center gap-2 text-sm text-text-muted mb-6">
          <Link href="/admin/workspaces" className="hover:text-text-primary transition-colors">Empresas</Link>
          <span>/</span>
          <Link href={`/admin/workspaces/${id}`} className="hover:text-text-primary transition-colors">{workspace.name}</Link>
          <span>/</span>
          <span className="text-text-secondary">Kanban</span>
        </nav>
        <p className="text-text-muted text-sm text-center py-12">
          Nenhum board encontrado para este workspace.
        </p>
      </div>
    )
  }

  // Busca colunas + cards + comentários + assignee
  const { data: columns } = await adminSupabase
    .from('kanban_columns')
    .select(`
      id, title, color, order_index,
      kanban_cards(
        id, title, description, priority, due_date, assignee_id, column_id, order_index, is_archived, labels, attachments,
        profiles:assignee_id(name),
        card_comments(id, content, created_at, profiles:user_id(name))
      )
    `)
    .eq('board_id', board.id)
    .order('order_index')

  // Busca membros do workspace
  const { data: membersData } = await adminSupabase
    .from('workspace_members')
    .select('user_id, profiles:user_id(id, name)')
    .eq('workspace_id', id)
    .eq('is_active', true)

  type RawColumn = {
    id: string
    title: string
    color: string | null
    order_index: number
    kanban_cards: {
      id: string
      title: string
      description: string | null
      priority: string
      due_date: string | null
      assignee_id: string | null
      column_id: string
      order_index: number
      is_archived: boolean
      labels: unknown
      attachments: unknown
      profiles: { name: string } | null
      card_comments: {
        id: string
        content: string
        created_at: string
        profiles: { name: string } | null
      }[]
    }[]
  }

  type RawMember = {
    user_id: string
    profiles: { id: string; name: string } | null
  }

  const processedColumns = (columns as unknown as RawColumn[] ?? []).map((col) => ({
    id: col.id,
    title: col.title,
    color: col.color,
    position: col.order_index,
    cards: (col.kanban_cards ?? [])
      .filter((c) => !c.is_archived)
      .sort((a, b) => a.order_index - b.order_index)
      .map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        priority: c.priority as KanbanPriority,
        due_date: c.due_date,
        assignee_id: c.assignee_id,
        column_id: c.column_id,
        position: c.order_index,
        labels: (Array.isArray(c.labels) ? c.labels : []) as CardLabel[],
        attachments: (Array.isArray(c.attachments) ? c.attachments : []) as CardAttachment[],
        profiles: c.profiles,
        comments: c.card_comments ?? [],
      })),
  }))

  const members = (membersData as unknown as RawMember[] ?? [])

  return (
    <div className="animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-text-muted mb-6">
        <Link href="/admin/workspaces" className="hover:text-text-primary transition-colors">Empresas</Link>
        <span>/</span>
        <Link href={`/admin/workspaces/${id}`} className="hover:text-text-primary transition-colors">{workspace.name}</Link>
        <span>/</span>
        <span className="text-text-secondary">Kanban</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">{board.title}</h1>
          <p className="text-sm text-text-muted">{workspace.name}</p>
        </div>
        <Link
          href={`/admin/workspaces/${id}`}
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Voltar
        </Link>
      </div>

      <KanbanBoard
        columns={processedColumns}
        workspaceId={id}
        members={members}
      />
    </div>
  )
}
