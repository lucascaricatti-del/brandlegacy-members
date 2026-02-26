'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { WorkspaceRole, PlanType } from '@/lib/types/database'

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
// WORKSPACES
// ============================================================

export async function createWorkspace(formData: FormData) {
  const { supabase, user } = await requireAdmin()

  const name = formData.get('name') as string
  const slug = (formData.get('slug') as string)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')

  const { error, data } = await supabase
    .from('workspaces')
    .insert({
      name,
      slug,
      plan_type: (formData.get('plan_type') as PlanType) || 'free',
      is_active: true,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    if (error.message.includes('slug')) return { error: 'Slug já em uso. Use outro identificador.' }
    return { error: error.message }
  }

  revalidatePath('/admin/workspaces')
  return { success: true, id: data.id }
}

export async function updateWorkspace(id: string, formData: FormData) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('workspaces')
    .update({
      name: formData.get('name') as string,
      plan_type: formData.get('plan_type') as PlanType,
      is_active: formData.get('is_active') !== 'false',
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/workspaces')
  revalidatePath(`/admin/workspaces/${id}`)
  return { success: true }
}

export async function deleteWorkspace(id: string) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase.from('workspaces').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/admin/workspaces')
  return { success: true }
}

// ============================================================
// WORKSPACE MEMBERS
// ============================================================

export async function addWorkspaceMember(workspaceId: string, formData: FormData) {
  const { supabase, user } = await requireAdmin()

  const email = (formData.get('email') as string).trim().toLowerCase()
  const role = (formData.get('role') as WorkspaceRole) || 'collaborator'

  // Busca o usuário pelo email
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('email', email)
    .single()

  if (!profile) {
    return { error: 'Usuário não encontrado. Ele precisa ter uma conta para ser adicionado.' }
  }

  const { error } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspaceId,
      user_id: profile.id,
      role,
      invited_by: user.id,
    })

  if (error) {
    if (error.message.includes('unique') || error.message.includes('duplicate')) {
      return { error: 'Usuário já é membro deste workspace.' }
    }
    return { error: error.message }
  }

  revalidatePath(`/admin/workspaces/${workspaceId}`)
  return { success: true, name: profile.name }
}

export async function updateMemberRole(memberId: string, workspaceId: string, role: WorkspaceRole) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('workspace_members')
    .update({ role })
    .eq('id', memberId)

  if (error) return { error: error.message }

  revalidatePath(`/admin/workspaces/${workspaceId}`)
  return { success: true }
}

export async function toggleMemberActive(memberId: string, workspaceId: string, isActive: boolean) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('workspace_members')
    .update({ is_active: !isActive })
    .eq('id', memberId)

  if (error) return { error: error.message }

  revalidatePath(`/admin/workspaces/${workspaceId}`)
  return { success: true }
}

export async function removeMember(memberId: string, workspaceId: string) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('id', memberId)

  if (error) return { error: error.message }

  revalidatePath(`/admin/workspaces/${workspaceId}`)
  return { success: true }
}

// ============================================================
// CONTENT ACCESS (Liberação manual de masterclasses)
// ============================================================

export async function grantContentAccess(workspaceId: string, moduleId: string, notes?: string) {
  const { supabase, user } = await requireAdmin()

  const { error } = await supabase
    .from('content_access')
    .upsert({
      workspace_id: workspaceId,
      module_id: moduleId,
      granted_by: user.id,
      revoked_at: null,
      notes: notes || null,
    }, { onConflict: 'workspace_id,module_id' })

  if (error) return { error: error.message }

  revalidatePath(`/admin/workspaces/${workspaceId}`)
  return { success: true }
}

export async function revokeContentAccess(workspaceId: string, moduleId: string) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('content_access')
    .update({ revoked_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('module_id', moduleId)
    .is('revoked_at', null)

  if (error) return { error: error.message }

  revalidatePath(`/admin/workspaces/${workspaceId}`)
  return { success: true }
}

// ============================================================
// CRIAR ACESSO PARA MENTORADO (admin BrandLegacy only)
// Usa Service Role para:
//   1. Criar usuário auth + confirmar email automaticamente
//   2. Inserir perfil manualmente (trigger pode não disparar via admin API)
//   3. Vincular ao workspace como owner
//   4. Garantir que o board do workspace existe
// ============================================================

export async function createMentoradoAccess(
  workspaceId: string,
  name: string,
  email: string,
  tempPassword: string,
) {
  await requireAdmin() // valida que o chamador é admin BrandLegacy

  if (!name.trim() || !email.trim() || !tempPassword.trim()) {
    return { error: 'Nome, email e senha são obrigatórios.' }
  }
  if (tempPassword.length < 6) {
    return { error: 'A senha deve ter no mínimo 6 caracteres.' }
  }

  const adminSupabase = createAdminClient()

  // 1. Criar usuário auth com email já confirmado
  const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name: name.trim() },
  })

  if (authError) return { error: authError.message }

  const userId = authData.user.id

  // 2. Inserir/atualizar perfil (trigger pode não disparar via admin API)
  const { error: profileError } = await adminSupabase.from('profiles').upsert(
    {
      id: userId,
      email: email.trim().toLowerCase(),
      name: name.trim(),
      role: 'student',
      is_active: true,
    },
    { onConflict: 'id' },
  )

  if (profileError) {
    // Tenta limpar o usuário auth criado antes de retornar erro
    await adminSupabase.auth.admin.deleteUser(userId)
    return { error: `Erro ao criar perfil: ${profileError.message}` }
  }

  // 3. Vincular ao workspace como owner (upsert para evitar duplicatas)
  const { error: memberError } = await adminSupabase.from('workspace_members').upsert(
    {
      workspace_id: workspaceId,
      user_id: userId,
      role: 'owner' as WorkspaceRole,
      is_active: true,
    },
    { onConflict: 'workspace_id,user_id' },
  )

  if (memberError) {
    await adminSupabase.auth.admin.deleteUser(userId)
    return { error: `Erro ao vincular ao workspace: ${memberError.message}` }
  }

  // 4. Garantir que o board do workspace existe (caso o trigger não tenha disparado)
  const { data: existingBoard } = await adminSupabase
    .from('kanban_boards')
    .select('id')
    .eq('workspace_id', workspaceId)
    .single()

  if (!existingBoard) {
    const { data: newBoard } = await adminSupabase
      .from('kanban_boards')
      .insert({ workspace_id: workspaceId, title: 'Board Principal' })
      .select('id')
      .single()

    if (newBoard) {
      await adminSupabase.from('kanban_columns').insert([
        { board_id: newBoard.id, title: 'A fazer', order_index: 1 },
        { board_id: newBoard.id, title: 'Em andamento', order_index: 2 },
        { board_id: newBoard.id, title: 'Em revisão', order_index: 3 },
        { board_id: newBoard.id, title: 'Concluído', order_index: 4 },
      ])
    }
  }

  revalidatePath(`/admin/workspaces/${workspaceId}`)

  return {
    success: true,
    userId,
    credentials: {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: tempPassword,
    },
  }
}

// ============================================================
// CRIAR ACESSO PARA EQUIPE INTERNA (admin BrandLegacy only)
// ============================================================

export async function createInternalAccess(
  name: string,
  email: string,
  password: string,
  role: 'cx' | 'financial' | 'mentor',
) {
  await requireAdmin()

  if (!name.trim() || !email.trim() || !password.trim()) {
    return { error: 'Todos os campos são obrigatórios.' }
  }
  if (password.length < 6) {
    return { error: 'A senha deve ter no mínimo 6 caracteres.' }
  }

  const adminSupabase = createAdminClient()

  const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { name: name.trim() },
  })

  if (authError) return { error: authError.message }

  const userId = authData.user.id

  const { error: profileError } = await adminSupabase.from('profiles').upsert(
    {
      id: userId,
      email: email.trim().toLowerCase(),
      name: name.trim(),
      role,
      is_active: true,
    },
    { onConflict: 'id' },
  )

  if (profileError) {
    await adminSupabase.auth.admin.deleteUser(userId)
    return { error: `Erro ao criar perfil: ${profileError.message}` }
  }

  revalidatePath('/admin')

  return {
    success: true,
    credentials: {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
    },
  }
}
