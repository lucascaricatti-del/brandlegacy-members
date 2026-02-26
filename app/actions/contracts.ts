'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ContractStatus } from '@/lib/types/database'

async function requireInternal() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const internalRoles = ['admin', 'cx', 'financial', 'mentor']
  if (!profile || !internalRoles.includes(profile.role)) throw new Error('Acesso negado')
  return { supabase, user }
}

export async function upsertContract(workspaceId: string, formData: FormData, existingId?: string) {
  const { supabase, user } = await requireInternal()

  const payload = {
    workspace_id: workspaceId,
    plan_type: formData.get('plan_type') as 'tracao' | 'club',
    contract_value_brl: Number(formData.get('contract_value_brl') ?? 0),
    installments: Number(formData.get('installments') ?? 1),
    start_date: formData.get('start_date') as string,
    duration_months: Number(formData.get('duration_months') ?? 6),
    renewal_date: (formData.get('renewal_date') as string) || null,
    status: (formData.get('status') as ContractStatus) || 'active',
    total_deliveries_promised: Number(formData.get('total_deliveries_promised') ?? 0),
    deliveries_completed: Number(formData.get('deliveries_completed') ?? 0),
    notes: (formData.get('notes') as string) || null,
    created_by: user.id,
  }

  let error
  if (existingId) {
    const res = await supabase.from('mentoring_contracts').update(payload).eq('id', existingId)
    error = res.error
  } else {
    const res = await supabase.from('mentoring_contracts').insert(payload)
    error = res.error
  }

  if (error) return { error: error.message }

  revalidatePath(`/admin/workspaces/${workspaceId}`)
  revalidatePath(`/interno/mentorados/${workspaceId}`)
  return { success: true }
}

export async function incrementDelivery(contractId: string, workspaceId: string) {
  const { supabase } = await requireInternal()

  // Busca o valor atual
  const { data: contract } = await supabase
    .from('mentoring_contracts')
    .select('deliveries_completed, total_deliveries_promised')
    .eq('id', contractId)
    .single()

  if (!contract) return { error: 'Contrato não encontrado' }

  const newValue = Math.min(
    contract.deliveries_completed + 1,
    contract.total_deliveries_promised
  )

  const { error } = await supabase
    .from('mentoring_contracts')
    .update({ deliveries_completed: newValue })
    .eq('id', contractId)

  if (error) return { error: error.message }

  revalidatePath(`/admin/workspaces/${workspaceId}`)
  revalidatePath(`/interno/mentorados/${workspaceId}`)
  return { success: true }
}
