import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import KanbanBoard from '@/components/kanban/Board'
import type { KanbanPriority, CardLabel, CardAttachment } from '@/lib/types/database'

interface Props {
  searchParams: Promise<{ ws?: string }>
}

export default async function KanbanPage({ searchParams }: Props) {
  const { ws: workspaceId } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = createAdminClient()

  if (!workspaceId) {
    // Tenta auto-detectar o único workspace ativo do usuário via adminClient
    const { data: memberships } = await adminSupabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(2)

    if (memberships?.length === 1) {
      redirect(`/workspace/kanban?ws=${memberships[0].workspace_id}`)
    }
    redirect('/workspace')
  }

  // Verifica membership via adminClient (bypass RLS)
  const { data: membership } = await adminSupabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership) redirect('/workspace')

  // Busca o board do workspace via adminClient
  const { data: board } = await adminSupabase
    .from('kanban_boards')
    .select('id, title')
    .eq('workspace_id', workspaceId)
    .single()

  if (!board) {
    return (
      <div className="animate-fade-in">
        <p className="text-text-muted">Board não encontrado para este workspace.</p>
      </div>
    )
  }

  // Busca colunas + cards + comentários + assignee via adminClient
  const { data: columns } = await adminSupabase
    .from('kanban_columns')
    .select(`
      id, title, color, order_index,
      kanban_cards(
        id, title, description, priority, due_date, assignee_id, column_id, order_index, is_archived,
        card_comments(id, content, created_at)
      )
    `)
    .eq('board_id', board.id)
    .order('order_index')

  // Busca membros do workspace via adminClient
  const { data: membersData } = await adminSupabase
    .from('workspace_members')
    .select('user_id, profiles:user_id(id, name)')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)

  // Busca nome do workspace via adminClient
  const { data: workspace } = await adminSupabase
    .from('workspaces')
    .select('name')
    .eq('id', workspaceId)
    .single()

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

  type RawMember = {
    user_id: string
    profiles: { id: string; name: string } | null
  }

  const members = (membersData as unknown as RawMember[] ?? [])

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/workspace" className="text-text-muted hover:text-text-primary transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-text-primary">{board.title}</h1>
          <p className="text-sm text-text-muted">{workspace?.name}</p>
        </div>
      </div>

      <KanbanBoard
        columns={processedColumns}
        workspaceId={workspaceId}
        members={members}
      />
    </div>
  )
}
