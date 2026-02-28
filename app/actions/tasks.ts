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
    .select('*, sessions:session_id(title), creator:profiles!tasks_created_by_fkey(id, name)')
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
    .select('*, sessions:session_id(title), creator:profiles!tasks_created_by_fkey(id, name)')
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
    file_url?: string
    file_name?: string
  },
) {
  const { error, user, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !adminSupabase || !user) return { error: error ?? 'Erro de autenticação' }

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
      created_by: user.id,
      file_url: data.file_url || null,
      file_name: data.file_name || null,
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
  const { supabase, user } = await requireAdmin()
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
      created_by: user.id,
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
    start_date?: string | null
    tags?: string[] | null
    order_index?: number
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
  if (data.start_date !== undefined) updateData.start_date = data.start_date
  if (data.tags !== undefined) updateData.tags = data.tags
  if (data.order_index !== undefined) updateData.order_index = data.order_index
  if (data.status !== undefined) {
    updateData.status = data.status
    if (data.status === 'concluida') {
      updateData.completed_at = new Date().toISOString()
    } else {
      updateData.completed_at = null
    }
  }

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
    start_date?: string | null
    tags?: string[] | null
    order_index?: number
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
  if (data.start_date !== undefined) updateData.start_date = data.start_date
  if (data.tags !== undefined) updateData.tags = data.tags
  if (data.order_index !== undefined) updateData.order_index = data.order_index
  if (data.status !== undefined) {
    updateData.status = data.status
    if (data.status === 'concluida') {
      updateData.completed_at = new Date().toISOString()
    } else {
      updateData.completed_at = null
    }
  }

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
    .update({ status: 'concluida' as const, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
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

// ============================================================
// CHECKLIST ITEMS
// ============================================================

export async function getChecklistItems(taskId: string, workspaceId: string) {
  const { error, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !adminSupabase) return []

  const { data } = await adminSupabase
    .from('task_checklist_items')
    .select('*')
    .eq('task_id', taskId)
    .order('order_index', { ascending: true })

  return data ?? []
}

export async function addChecklistItem(taskId: string, workspaceId: string, title: string) {
  const { error, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !adminSupabase) return { error: error ?? 'Erro de autenticação' }

  if (!title?.trim()) return { error: 'Título é obrigatório' }

  // Get next order_index
  const { data: existing } = await adminSupabase
    .from('task_checklist_items')
    .select('order_index')
    .eq('task_id', taskId)
    .order('order_index', { ascending: false })
    .limit(1)

  const nextOrder = existing && existing.length > 0 ? existing[0].order_index + 1 : 0

  const { error: dbError } = await adminSupabase
    .from('task_checklist_items')
    .insert({ task_id: taskId, title: title.trim(), order_index: nextOrder })

  if (dbError) return { error: dbError.message }
  return { success: true }
}

export async function toggleChecklistItem(itemId: string, workspaceId: string, isDone: boolean) {
  const { error, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !adminSupabase) return { error: error ?? 'Erro de autenticação' }

  const { error: dbError } = await adminSupabase
    .from('task_checklist_items')
    .update({ is_done: isDone })
    .eq('id', itemId)

  if (dbError) return { error: dbError.message }
  return { success: true }
}

export async function deleteChecklistItem(itemId: string, workspaceId: string) {
  const { error, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !adminSupabase) return { error: error ?? 'Erro de autenticação' }

  const { error: dbError } = await adminSupabase
    .from('task_checklist_items')
    .delete()
    .eq('id', itemId)

  if (dbError) return { error: dbError.message }
  return { success: true }
}

// ============================================================
// TASK COMMENTS
// ============================================================

export async function getTaskComments(taskId: string, workspaceId: string) {
  const { error, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !adminSupabase) return []

  const { data } = await adminSupabase
    .from('task_comments')
    .select('*, profiles:user_id(id, name)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })

  return data ?? []
}

export async function addTaskComment(taskId: string, workspaceId: string, body: string) {
  const { error, user, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !adminSupabase || !user) return { error: error ?? 'Erro de autenticação' }

  if (!body?.trim()) return { error: 'Comentário não pode estar vazio' }

  const { error: dbError } = await adminSupabase
    .from('task_comments')
    .insert({ task_id: taskId, user_id: user.id, body: body.trim() })

  if (dbError) return { error: dbError.message }
  return { success: true }
}

// ============================================================
// BULK UPDATE
// ============================================================

export async function bulkUpdateTasks(
  workspaceId: string,
  taskIds: string[],
  data: {
    status?: TaskStatus
    priority?: TaskPriority
    responsible?: string | null
    is_archived?: boolean
  },
) {
  const { error, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !adminSupabase) return { error: error ?? 'Erro de autenticação' }

  if (!taskIds.length) return { error: 'Nenhuma tarefa selecionada' }

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (data.status !== undefined) {
    updateData.status = data.status
    if (data.status === 'concluida') {
      updateData.completed_at = new Date().toISOString()
    } else {
      updateData.completed_at = null
    }
  }
  if (data.priority !== undefined) updateData.priority = data.priority
  if (data.responsible !== undefined) updateData.responsible = data.responsible
  if (data.is_archived !== undefined) updateData.is_archived = data.is_archived

  const { error: dbError } = await adminSupabase
    .from('tasks')
    .update(updateData)
    .in('id', taskIds)
    .eq('workspace_id', workspaceId)

  if (dbError) return { error: dbError.message }

  revalidatePath('/workspace/tasks')
  revalidatePath(`/admin/workspaces/${workspaceId}/tasks`)
  return { success: true }
}

// ============================================================
// FILE UPLOAD
// ============================================================

export async function uploadTaskFile(workspaceId: string, formData: FormData) {
  const { error, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !adminSupabase) return { error: error ?? 'Erro de autenticação' }

  const file = formData.get('file') as File
  if (!file || file.size === 0) return { error: 'Nenhum arquivo selecionado' }

  const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`
  const path = `tasks/${workspaceId}/${fileName}`

  const { error: uploadError } = await adminSupabase.storage
    .from('materials')
    .upload(path, file)

  if (uploadError) return { error: uploadError.message }

  const { data: urlData } = await adminSupabase.storage
    .from('materials')
    .createSignedUrl(path, 60 * 60 * 24 * 365)

  return { success: true, fileUrl: urlData?.signedUrl ?? path, fileName: file.name }
}

// ============================================================
// WORKSPACE MEMBERS (para dropdown de responsável)
// ============================================================

export async function getWorkspaceMembers(workspaceId: string) {
  const { error, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !adminSupabase) return []

  const { data: members } = await adminSupabase
    .from('workspace_members')
    .select('user_id, role, profiles:user_id(id, name, email)')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)

  return members ?? []
}
