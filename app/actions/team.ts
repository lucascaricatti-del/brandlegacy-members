'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { WorkspaceRole } from '@/lib/types/database'

const ALLOWED_TEAM_ROLES = ['manager', 'collaborator', 'mentee'] as const
type TeamRole = (typeof ALLOWED_TEAM_ROLES)[number]

async function requireWorkspaceOwnerOrManager(workspaceId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const adminSupabase = createAdminClient()
  const { data: membership } = await adminSupabase
    .from('workspace_members')
    .select('id, role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership || !['owner', 'manager'].includes(membership.role)) {
    throw new Error('Você precisa ser owner ou manager do workspace para gerenciar o time.')
  }

  return { supabase, user, adminSupabase }
}

// ============================================================
// ADICIONAR MEMBRO AO TIME (usuário já existente)
// ============================================================

export async function addTeamMember(workspaceId: string, email: string, role: string) {
  const { user, adminSupabase } = await requireWorkspaceOwnerOrManager(workspaceId)

  if (!ALLOWED_TEAM_ROLES.includes(role as TeamRole)) {
    return { error: 'Papel inválido. Use: Manager, Colaborador ou Mentorado.' }
  }

  // Busca o perfil pelo email
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('id, name')
    .eq('email', email.trim().toLowerCase())
    .single()

  if (!profile) {
    return {
      error: 'Usuário não encontrado. Use o botão "Enviar Convite" para convidar por email.',
    }
  }

  // Verifica se já é membro
  const { data: existing } = await adminSupabase
    .from('workspace_members')
    .select('id, is_active')
    .eq('workspace_id', workspaceId)
    .eq('user_id', profile.id)
    .single()

  if (existing) {
    if (existing.is_active) return { error: 'Este usuário já é membro do workspace.' }
    // Reativar membro removido
    const { error } = await adminSupabase
      .from('workspace_members')
      .update({ is_active: true, role: role as WorkspaceRole, accepted_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await adminSupabase.from('workspace_members').insert({
      workspace_id: workspaceId,
      user_id: profile.id,
      role: role as WorkspaceRole,
      invited_by: user.id,
      is_active: true,
      accepted_at: new Date().toISOString(),
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
  const { adminSupabase } = await requireWorkspaceOwnerOrManager(workspaceId)

  if (!ALLOWED_TEAM_ROLES.includes(role as TeamRole)) {
    return { error: 'Papel inválido.' }
  }

  const { error } = await adminSupabase
    .from('workspace_members')
    .update({ role: role as WorkspaceRole })
    .eq('id', memberId)
    .eq('workspace_id', workspaceId)

  if (error) return { error: error.message }

  revalidatePath('/team')
  return { success: true }
}

// ============================================================
// ATUALIZAR PERMISSÕES DO MEMBRO
// ============================================================

export async function updateMemberPermissions(
  memberId: string,
  workspaceId: string,
  permissions: Record<string, unknown>,
) {
  const { adminSupabase } = await requireWorkspaceOwnerOrManager(workspaceId)

  const { error } = await adminSupabase
    .from('workspace_members')
    .update({ permissions: permissions as unknown as import('@/lib/types/database').Json })
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
  const { adminSupabase } = await requireWorkspaceOwnerOrManager(workspaceId)

  const { error } = await adminSupabase
    .from('workspace_members')
    .delete()
    .eq('id', memberId)
    .eq('workspace_id', workspaceId)

  if (error) return { error: error.message }

  revalidatePath('/team')
  return { success: true }
}

// ============================================================
// CANCELAR CONVITE
// ============================================================

export async function cancelInvite(inviteId: string, workspaceId: string) {
  const { adminSupabase } = await requireWorkspaceOwnerOrManager(workspaceId)

  const { error } = await adminSupabase
    .from('workspace_invites')
    .update({ status: 'cancelled' })
    .eq('id', inviteId)
    .eq('workspace_id', workspaceId)

  if (error) return { error: error.message }

  revalidatePath('/team')
  return { success: true }
}

// ============================================================
// REENVIAR CONVITE
// ============================================================

export async function resendInvite(inviteId: string, workspaceId: string) {
  const { adminSupabase } = await requireWorkspaceOwnerOrManager(workspaceId)

  // Get invite details
  const { data: invite } = await adminSupabase
    .from('workspace_invites')
    .select('email, role, permissions, token')
    .eq('id', inviteId)
    .eq('workspace_id', workspaceId)
    .single()

  if (!invite) return { error: 'Convite não encontrado.' }

  // Reset expiration
  const { error } = await adminSupabase
    .from('workspace_invites')
    .update({
      status: 'pending',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq('id', inviteId)

  if (error) return { error: error.message }

  revalidatePath('/team')
  return { success: true }
}
