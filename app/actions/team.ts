'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Papéis disponíveis para o time do mentorado (owner/admin são gerenciados pela BrandLegacy)
const ALLOWED_TEAM_ROLES = ['manager', 'collaborator', 'viewer'] as const
type TeamRole = (typeof ALLOWED_TEAM_ROLES)[number]

async function requireWorkspaceOwnerOrAdmin(workspaceId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('id, role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    throw new Error('Você precisa ser owner ou admin do workspace para gerenciar o time.')
  }

  return { supabase, user }
}

// ============================================================
// ADICIONAR MEMBRO AO TIME (usuário já existente)
// ============================================================

export async function addTeamMember(workspaceId: string, email: string, role: string) {
  const { supabase, user } = await requireWorkspaceOwnerOrAdmin(workspaceId)

  if (!ALLOWED_TEAM_ROLES.includes(role as TeamRole)) {
    return { error: 'Papel inválido. Use: Manager, Colaborador ou Visualizador.' }
  }

  // Busca o perfil pelo email
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('email', email.trim().toLowerCase())
    .single()

  if (!profile) {
    return {
      error: 'Usuário não encontrado. Peça ao administrador da BrandLegacy para criar o acesso primeiro.',
    }
  }

  // Verifica se já é membro
  const { data: existing } = await supabase
    .from('workspace_members')
    .select('id, is_active')
    .eq('workspace_id', workspaceId)
    .eq('user_id', profile.id)
    .single()

  if (existing) {
    if (existing.is_active) return { error: 'Este usuário já é membro do workspace.' }
    // Reativar membro removido
    const { error } = await supabase
      .from('workspace_members')
      .update({ is_active: true, role: role as TeamRole })
      .eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('workspace_members').insert({
      workspace_id: workspaceId,
      user_id: profile.id,
      role: role as TeamRole,
      invited_by: user.id,
      is_active: true,
    })
    if (error) return { error: error.message }
  }

  revalidatePath('/team')
  return { success: true, name: profile.name }
}

// ============================================================
// ATUALIZAR PAPEL DO MEMBRO
// ============================================================

export async function updateTeamMemberRole(memberId: string, workspaceId: string, role: string) {
  const { supabase } = await requireWorkspaceOwnerOrAdmin(workspaceId)

  if (!ALLOWED_TEAM_ROLES.includes(role as TeamRole)) {
    return { error: 'Papel inválido.' }
  }

  const { error } = await supabase
    .from('workspace_members')
    .update({ role: role as TeamRole })
    .eq('id', memberId)
    .eq('workspace_id', workspaceId)

  if (error) return { error: error.message }

  revalidatePath('/team')
  return { success: true }
}

// ============================================================
// REMOVER MEMBRO DO TIME
// ============================================================

export async function removeTeamMember(memberId: string, workspaceId: string) {
  const { supabase } = await requireWorkspaceOwnerOrAdmin(workspaceId)

  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('id', memberId)
    .eq('workspace_id', workspaceId)

  if (error) return { error: error.message }

  revalidatePath('/team')
  return { success: true }
}
