'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ContactType, FinancialStatus } from '@/lib/types/database'

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

  return { supabase, user, role: profile.role }
}

// ============================================================
// CONTATOS CX
// ============================================================

export async function addContactLog(workspaceId: string, formData: FormData) {
  const { supabase, user } = await requireInternal()

  const { error } = await supabase.from('internal_contacts').insert({
    workspace_id: workspaceId,
    recorded_by: user.id,
    contact_type: (formData.get('contact_type') as ContactType) || 'note',
    content: formData.get('summary') as string,
    next_action: (formData.get('next_action') as string) || null,
    next_action_date: (formData.get('next_action_date') as string) || null,
  })

  if (error) return { error: error.message }

  revalidatePath(`/interno/mentorados/${workspaceId}`)
  return { success: true }
}

// ============================================================
// REGISTROS FINANCEIROS
// ============================================================

export async function addFinancialRecord(workspaceId: string, formData: FormData) {
  const { supabase, user } = await requireInternal()

  const { error } = await supabase.from('financial_records').insert({
    workspace_id: workspaceId,
    created_by: user.id,
    type: (formData.get('record_type') as 'payment' | 'refund' | 'credit' | 'charge') || 'payment',
    amount_brl: Number(formData.get('amount_brl') ?? 0),
    due_date: (formData.get('due_date') as string) || null,
    paid_at: (formData.get('paid_date') as string) || null,
    status: (formData.get('status') as FinancialStatus) || 'pending',
    description: (formData.get('notes') as string) || null,
  })

  if (error) return { error: error.message }

  revalidatePath(`/interno/mentorados/${workspaceId}`)
  revalidatePath('/interno/financeiro')
  return { success: true }
}

export async function updateFinancialStatus(recordId: string, status: FinancialStatus, workspaceId: string) {
  const { supabase } = await requireInternal()

  const update: { status: FinancialStatus; paid_at?: string } = { status }
  if (status === 'paid') update.paid_at = new Date().toISOString()

  const { error } = await supabase
    .from('financial_records')
    .update(update)
    .eq('id', recordId)

  if (error) return { error: error.message }

  revalidatePath(`/interno/mentorados/${workspaceId}`)
  revalidatePath('/interno/financeiro')
  return { success: true }
}
