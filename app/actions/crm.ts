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
  return { user }
}

// ============================================================
// FUNNELS
// ============================================================

export async function getFunnels() {
  const adminSupabase = createAdminClient()
  const { data, error } = await adminSupabase
    .from('funnels')
    .select('*')
    .eq('is_active', true)
    .order('created_at')

  if (error) return { error: error.message, data: [] }
  return { data: data ?? [] }
}

export async function createFunnel(fields: {
  name: string
  slug: string
  product: string
  description?: string
}) {
  await requireAdmin()
  const adminSupabase = createAdminClient()

  const { error, data } = await adminSupabase
    .from('funnels')
    .insert(fields)
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/admin/crm')
  return { success: true, id: data.id }
}

// ============================================================
// LEADS
// ============================================================

export async function getLeads(funnelId: string, filters?: { status?: string; search?: string }) {
  const adminSupabase = createAdminClient()

  let query = adminSupabase
    .from('crm_leads')
    .select('*, funnels(name, slug), profiles!crm_leads_assigned_to_fkey(name)')
    .eq('funnel_id', funnelId)
    .order('created_at', { ascending: false })

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`)
  }

  const { data, error } = await query
  if (error) return { error: error.message, data: [] }
  return { data: data ?? [] }
}

/** Público — sem auth, usado pelo form embeddable */
export async function createLead(fields: {
  funnel_id: string
  name: string
  email: string
  whatsapp?: string
  revenue_range?: string
  business_segment?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
}) {
  const adminSupabase = createAdminClient()

  const { error } = await adminSupabase
    .from('crm_leads')
    .insert({
      funnel_id: fields.funnel_id,
      name: fields.name,
      email: fields.email,
      whatsapp: fields.whatsapp || null,
      revenue_range: fields.revenue_range || null,
      business_segment: fields.business_segment || null,
      utm_source: fields.utm_source || null,
      utm_medium: fields.utm_medium || null,
      utm_campaign: fields.utm_campaign || null,
      status: 'novo',
    })

  if (error) return { error: error.message }
  return { success: true }
}

export async function updateLeadStatus(leadId: string, status: string) {
  await requireAdmin()
  const adminSupabase = createAdminClient()

  const { error } = await adminSupabase
    .from('crm_leads')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', leadId)

  if (error) return { error: error.message }
  revalidatePath('/admin/crm')
  return { success: true }
}

export async function assignLead(leadId: string, profileId: string | null) {
  await requireAdmin()
  const adminSupabase = createAdminClient()

  const { error } = await adminSupabase
    .from('crm_leads')
    .update({ assigned_to: profileId, updated_at: new Date().toISOString() })
    .eq('id', leadId)

  if (error) return { error: error.message }
  revalidatePath('/admin/crm')
  return { success: true }
}

// ============================================================
// NOTES
// ============================================================

export async function addNote(leadId: string, content: string, contactType: string) {
  const { user } = await requireAdmin()
  const adminSupabase = createAdminClient()

  const { error } = await adminSupabase
    .from('crm_notes')
    .insert({
      lead_id: leadId,
      author_id: user.id,
      content,
      contact_type: contactType,
    })

  if (error) return { error: error.message }
  revalidatePath('/admin/crm')
  return { success: true }
}

export async function getNotes(leadId: string) {
  const adminSupabase = createAdminClient()

  const { data, error } = await adminSupabase
    .from('crm_notes')
    .select('*, profiles!crm_notes_author_id_fkey(name)')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: data ?? [] }
}

// ============================================================
// STATS
// ============================================================

export async function getLeadStats(funnelId: string) {
  const adminSupabase = createAdminClient()

  const { data: leads } = await adminSupabase
    .from('crm_leads')
    .select('status, created_at')
    .eq('funnel_id', funnelId)

  const all = leads ?? []
  const today = new Date().toISOString().slice(0, 10)

  const stats = {
    total: all.length,
    novos_hoje: all.filter((l) => l.created_at.slice(0, 10) === today).length,
    por_status: {
      novo: all.filter((l) => l.status === 'novo').length,
      contatado: all.filter((l) => l.status === 'contatado').length,
      qualificado: all.filter((l) => l.status === 'qualificado').length,
      fechado: all.filter((l) => l.status === 'fechado').length,
      perdido: all.filter((l) => l.status === 'perdido').length,
    },
    conversao: all.length > 0
      ? Math.round((all.filter((l) => l.status === 'fechado').length / all.length) * 100)
      : 0,
  }

  return stats
}
