'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { TaskPriority, TaskStatus } from '@/lib/types/database'

// ============================================================
// AUTH HELPERS
// ============================================================

async function requireWorkspaceMember(workspaceId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' as const, user: null, adminSupabase: null }

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

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') throw new Error('Acesso negado')
  return { supabase, user }
}

// ============================================================
// GET TASKS
// ============================================================

export async function getTasks(
  workspaceId: string,
  filters?: {
    status?: TaskStatus | 'all'
    priority?: TaskPriority | 'all'
    includeArchived?: boolean
  },
) {
  const { error, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !adminSupabase) return []

  let query = adminSupabase
    .from('tasks')
    .select('*, sessions:session_id(title)')
    .eq('workspace_id', workspaceId)

  if (!filters?.includeArchived) {
    query = query.eq('is_archived', false)
  }

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }

  if (filters?.priority && filters.priority !== 'all') {
    query = query.eq('priority', filters.priority)
  }

  const { data } = await query.order('created_at', { ascending: false })
  return data ?? []
}

// Admin version — bypasses workspace member check
export async function getTasksAdmin(workspaceId: string) {
  await requireAdmin()
  const adminSupabase = createAdminClient()

  const { data } = await adminSupabase
    .from('tasks')
    .select('*, sessions:session_id(title)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  return data ?? []
}

// ============================================================
// CREATE TASK
// ============================================================

export async function createTask(
  workspaceId: string,
  data: {
    title: string
    description?: string
    responsible?: string
    assignee_id?: string
    due_date?: string
    priority?: TaskPriority
    session_id?: string
  },
) {
  const { error, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !adminSupabase) return { error: error ?? 'Erro de autenticação' }

  if (!data.title?.trim()) return { error: 'Título é obrigatório' }

  const { error: dbError, data: task } = await adminSupabase
    .from('tasks')
    .insert({
      workspace_id: workspaceId,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      responsible: data.responsible?.trim() || null,
      assignee_id: data.assignee_id || null,
      due_date: data.due_date || null,
      priority: data.priority || 'media',
      session_id: data.session_id || null,
    })
    .select('id')
    .single()

  if (dbError) return { error: dbError.message }

  revalidatePath('/workspace/tasks')
  revalidatePath(`/admin/workspaces/${workspaceId}/tasks`)
  return { success: true, taskId: task.id }
}

// Admin version
export async function createTaskAdmin(
  workspaceId: string,
  data: {
    title: string
    description?: string
    responsible?: string
    due_date?: string
    priority?: TaskPriority
    session_id?: string
  },
) {
  await requireAdmin()
  const adminSupabase = createAdminClient()

  if (!data.title?.trim()) return { error: 'Título é obrigatório' }

  const { error: dbError, data: task } = await adminSupabase
    .from('tasks')
    .insert({
      workspace_id: workspaceId,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      responsible: data.responsible?.trim() || null,
      due_date: data.due_date || null,
      priority: data.priority || 'media',
      session_id: data.session_id || null,
    })
    .select('id')
    .single()

  if (dbError) return { error: dbError.message }

  revalidatePath('/workspace/tasks')
  revalidatePath(`/admin/workspaces/${workspaceId}/tasks`)
  return { success: true, taskId: task.id }
}

// ============================================================
// UPDATE TASK
// ============================================================

export async function updateTask(
  taskId: string,
  workspaceId: string,
  data: {
    title?: string
    description?: string | null
    responsible?: string | null
    assignee_id?: string | null
    due_date?: string | null
    priority?: TaskPriority
    status?: TaskStatus
  },
) {
  const { error, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !adminSupabase) return { error: error ?? 'Erro de autenticação' }

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (data.title !== undefined) updateData.title = data.title.trim()
  if (data.description !== undefined) updateData.description = data.description
  if (data.responsible !== undefined) updateData.responsible = data.responsible
  if (data.assignee_id !== undefined) updateData.assignee_id = data.assignee_id
  if (data.due_date !== undefined) updateData.due_date = data.due_date
  if (data.priority !== undefined) updateData.priority = data.priority
  if (data.status !== undefined) updateData.status = data.status

  const { error: dbError } = await adminSupabase
    .from('tasks')
    .update(updateData)
    .eq('id', taskId)

  if (dbError) return { error: dbError.message }

  revalidatePath('/workspace/tasks')
  revalidatePath(`/admin/workspaces/${workspaceId}/tasks`)
  return { success: true }
}

// Admin version
export async function updateTaskAdmin(
  taskId: string,
  workspaceId: string,
  data: {
    title?: string
    description?: string | null
    responsible?: string | null
    due_date?: string | null
    priority?: TaskPriority
    status?: TaskStatus
  },
) {
  await requireAdmin()
  const adminSupabase = createAdminClient()

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (data.title !== undefined) updateData.title = data.title.trim()
  if (data.description !== undefined) updateData.description = data.description
  if (data.responsible !== undefined) updateData.responsible = data.responsible
  if (data.due_date !== undefined) updateData.due_date = data.due_date
  if (data.priority !== undefined) updateData.priority = data.priority
  if (data.status !== undefined) updateData.status = data.status

  const { error: dbError } = await adminSupabase
    .from('tasks')
    .update(updateData)
    .eq('id', taskId)

  if (dbError) return { error: dbError.message }

  revalidatePath('/workspace/tasks')
  revalidatePath(`/admin/workspaces/${workspaceId}/tasks`)
  return { success: true }
}

// ============================================================
// COMPLETE TASK
// ============================================================

export async function completeTask(taskId: string, workspaceId: string) {
  const { error, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !adminSupabase) return { error: error ?? 'Erro de autenticação' }

  const { error: dbError } = await adminSupabase
    .from('tasks')
    .update({ status: 'concluida' as const, updated_at: new Date().toISOString() })
    .eq('id', taskId)

  if (dbError) return { error: dbError.message }

  revalidatePath('/workspace/tasks')
  revalidatePath(`/admin/workspaces/${workspaceId}/tasks`)
  return { success: true }
}

// ============================================================
// ARCHIVE TASK
// ============================================================

export async function archiveTask(taskId: string, workspaceId: string) {
  const { error, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !adminSupabase) return { error: error ?? 'Erro de autenticação' }

  const { error: dbError } = await adminSupabase
    .from('tasks')
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq('id', taskId)

  if (dbError) return { error: dbError.message }

  revalidatePath('/workspace/tasks')
  revalidatePath(`/admin/workspaces/${workspaceId}/tasks`)
  return { success: true }
}

// ============================================================
// DELETE TASK
// ============================================================

export async function deleteTask(taskId: string, workspaceId: string) {
  const { error, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !adminSupabase) return { error: error ?? 'Erro de autenticação' }

  const { error: dbError } = await adminSupabase
    .from('tasks')
    .delete()
    .eq('id', taskId)

  if (dbError) return { error: dbError.message }

  revalidatePath('/workspace/tasks')
  revalidatePath(`/admin/workspaces/${workspaceId}/tasks`)
  return { success: true }
}
