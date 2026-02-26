'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
// INICIALIZAR ENTREGAS
// Cria as entregas padrão conforme o plano do workspace
// ============================================================

const DELIVERIES_BY_PLAN = {
  club: [
    'Diagnóstico Estratégico',
    'Plano de Ação',
    'Mentoria 1',
    'Mentoria 2',
    'Mentoria 3',
    'Mentoria 4',
  ],
  tracao: [
    'Diagnóstico Estratégico',
    'Plano de Ação',
    'Mentoria 1',
  ],
} as const

export async function initWorkspaceDeliveries(
  workspaceId: string,
  planType: 'tracao' | 'club',
  contractId?: string | null,
) {
  const { supabase } = await requireAdmin()

  const titles = DELIVERIES_BY_PLAN[planType]
  const rows = titles.map((title, i) => ({
    workspace_id: workspaceId,
    contract_id: contractId ?? null,
    title,
    order_index: i + 1,
  }))

  const { error } = await supabase.from('deliveries').insert(rows)
  if (error) return { error: error.message }

  revalidatePath(`/admin/workspaces/${workspaceId}/entregas`)
  return { success: true }
}

// ============================================================
// ATUALIZAR ENTREGA (status, datas, notas)
// ============================================================

export async function updateDelivery(
  deliveryId: string,
  workspaceId: string,
  data: {
    status?: import('@/lib/types/database').DeliveryStatus
    scheduled_date?: string | null
    completed_date?: string | null
    notes?: string | null
    link_call?: string | null
  },
) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('deliveries')
    .update(data)
    .eq('id', deliveryId)

  if (error) return { error: error.message }

  revalidatePath(`/admin/workspaces/${workspaceId}/entregas`)
  revalidatePath('/entregas')
  return { success: true }
}

// ============================================================
// ADICIONAR MATERIAL
// ============================================================

export async function addDeliveryMaterial(
  deliveryId: string,
  workspaceId: string,
  title: string,
  type: 'video' | 'material',
  url: string | null,
  fileUrl: string | null,
) {
  const { supabase } = await requireAdmin()

  if (!title.trim()) return { error: 'Título é obrigatório.' }
  if (type === 'video' && !url?.trim()) return { error: 'URL do vídeo é obrigatória.' }
  if (type === 'material' && !url?.trim() && !fileUrl?.trim()) {
    return { error: 'Informe o link ou URL do arquivo.' }
  }

  const { error } = await supabase.from('delivery_materials').insert({
    delivery_id: deliveryId,
    title: title.trim(),
    type,
    url: url?.trim() || null,
    file_url: fileUrl?.trim() || null,
  })

  if (error) return { error: error.message }

  revalidatePath(`/admin/workspaces/${workspaceId}/entregas`)
  revalidatePath('/entregas')
  return { success: true }
}

// ============================================================
// REMOVER MATERIAL
// ============================================================

export async function deleteDeliveryMaterial(materialId: string, workspaceId: string) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('delivery_materials')
    .delete()
    .eq('id', materialId)

  if (error) return { error: error.message }

  revalidatePath(`/admin/workspaces/${workspaceId}/entregas`)
  revalidatePath('/entregas')
  return { success: true }
}

// ============================================================
// AGENDAR ENTREGA (ação do mentorado)
// ============================================================

export async function scheduleDeliveryDate(
  deliveryId: string,
  scheduledDate: string,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const adminSupabase = createAdminClient()

  // Busca a entrega para pegar workspace_id
  const { data: delivery } = await adminSupabase
    .from('deliveries')
    .select('id, workspace_id')
    .eq('id', deliveryId)
    .single()

  if (!delivery) return { error: 'Entrega não encontrada' }

  // Verifica se o usuário é membro do workspace
  const { data: membership } = await adminSupabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', delivery.workspace_id)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership) return { error: 'Acesso negado' }

  const { error } = await adminSupabase
    .from('deliveries')
    .update({
      scheduled_date: scheduledDate,
      status: 'scheduled' as const,
    })
    .eq('id', deliveryId)

  if (error) return { error: error.message }

  revalidatePath('/agenda')
  revalidatePath('/entregas')
  return { success: true }
}
