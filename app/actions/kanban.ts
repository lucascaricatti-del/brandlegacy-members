'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { KanbanPriority } from '@/lib/types/database'

async function requireWorkspaceMember(workspaceId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' as const, user: null, adminSupabase: null }

  // Usa adminClient para checar membership — bypass RLS em workspace_members
  const adminSupabase = createAdminClient()
  const { data: membership } = await adminSupabase
    .from('workspace_members')
    .select('id, role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership) return { error: 'Acesso negado ao workspace' as const, user: null, adminSupabase: null }

  return { error: null, user, adminSupabase }
}

// ============================================================
// CARDS
// ============================================================

export async function createCard(workspaceId: string, formData: FormData) {
  const { error, user, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !user || !adminSupabase) return { error: error ?? 'Erro de autenticação' }

  const columnId = formData.get('column_id') as string
  const title = (formData.get('title') as string).trim()
  if (!title) return { error: 'Título obrigatório' }

  const { data: lastCard } = await adminSupabase
    .from('kanban_cards')
    .select('order_index')
    .eq('column_id', columnId)
    .eq('is_archived', false)
    .order('order_index', { ascending: false })
    .limit(1)
    .single()

  const order_index = (lastCard?.order_index ?? -1) + 1

  const { error: insertError } = await adminSupabase.from('kanban_cards').insert({
    column_id: columnId,
    title,
    description: (formData.get('description') as string) || null,
    priority: (formData.get('priority') as KanbanPriority) || 'medium',
    due_date: (formData.get('due_date') as string) || null,
    assignee_id: (formData.get('assignee_id') as string) || null,
    order_index,
    created_by: user.id,
  })

  if (insertError) return { error: insertError.message }

  revalidatePath(`/workspace/kanban`)
  return { success: true }
}

export async function updateCard(workspaceId: string, cardId: string, formData: FormData) {
  const { error, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !adminSupabase) return { error: error ?? 'Erro de autenticação' }

  const { error: updateError } = await adminSupabase
    .from('kanban_cards')
    .update({
      title: formData.get('title') as string,
      description: (formData.get('description') as string) || null,
      priority: (formData.get('priority') as KanbanPriority) || 'medium',
      due_date: (formData.get('due_date') as string) || null,
      assignee_id: (formData.get('assignee_id') as string) || null,
    })
    .eq('id', cardId)

  if (updateError) return { error: updateError.message }

  revalidatePath(`/workspace/kanban`)
  return { success: true }
}

export async function moveCard(workspaceId: string, cardId: string, newColumnId: string, newPosition: number) {
  const { error, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !adminSupabase) return { error: error ?? 'Erro de autenticação' }

  const { error: updateError } = await adminSupabase
    .from('kanban_cards')
    .update({ column_id: newColumnId, order_index: newPosition })
    .eq('id', cardId)

  if (updateError) return { error: updateError.message }

  revalidatePath(`/workspace/kanban`)
  return { success: true }
}

export async function archiveCard(workspaceId: string, cardId: string) {
  const { error, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !adminSupabase) return { error: error ?? 'Erro de autenticação' }

  const { error: updateError } = await adminSupabase
    .from('kanban_cards')
    .update({ is_archived: true })
    .eq('id', cardId)

  if (updateError) return { error: updateError.message }

  revalidatePath(`/workspace/kanban`)
  return { success: true }
}

export async function addComment(workspaceId: string, cardId: string, content: string) {
  const { error, user, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !user || !adminSupabase) return { error: error ?? 'Erro de autenticação' }

  if (!content.trim()) return { error: 'Comentário vazio' }

  const { error: insertError } = await adminSupabase.from('card_comments').insert({
    card_id: cardId,
    user_id: user.id,
    content: content.trim(),
  })

  if (insertError) return { error: insertError.message }

  revalidatePath(`/workspace/kanban`)
  return { success: true }
}
