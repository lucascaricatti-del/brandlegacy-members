'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { FinancialInfoStatus } from '@/lib/types/database'

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
// GET FINANCIAL INFO
// ============================================================

export async function getFinancialInfo(workspaceId: string) {
  const adminSupabase = createAdminClient()
  const { data } = await adminSupabase
    .from('financial_info')
    .select('*')
    .eq('workspace_id', workspaceId)
    .single()
  return data
}

export async function getAllFinancialInfo() {
  await requireAdmin()
  const adminSupabase = createAdminClient()

  const { data } = await adminSupabase
    .from('financial_info')
    .select('*, workspaces:workspace_id(id, name, plan_type, is_active)')
    .order('created_at', { ascending: false })

  return data ?? []
}

// ============================================================
// SAVE FINANCIAL INFO (upsert)
// ============================================================

export async function saveFinancialInfo(
  workspaceId: string,
  fields: {
    plan_name: string
    status: FinancialInfoStatus
    total_value: number | null
    installments: number | null
    entry_value: number | null
    installment_value: number | null
    first_payment_date: string | null
    start_date: string | null
    renewal_date: string | null
    notes: string | null
  },
) {
  await requireAdmin()
  const adminSupabase = createAdminClient()

  const { data: existing } = await adminSupabase
    .from('financial_info')
    .select('id')
    .eq('workspace_id', workspaceId)
    .single()

  if (existing) {
    const { error } = await adminSupabase
      .from('financial_info')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', existing.id)

    if (error) return { error: error.message }
  } else {
    const { error } = await adminSupabase
      .from('financial_info')
      .insert({ workspace_id: workspaceId, ...fields })

    if (error) return { error: error.message }
  }

  revalidatePath(`/admin/workspaces/${workspaceId}`)
  revalidatePath('/admin/financeiro')
  return { success: true }
}
