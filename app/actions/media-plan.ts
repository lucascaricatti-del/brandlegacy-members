'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
// GET OR CREATE MEDIA PLAN
// ============================================================

export async function getOrCreateMediaPlan(workspaceId: string, year: number) {
  const { error, user, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !adminSupabase || !user) return { error: error ?? 'Erro de autenticação' }

  // Try to find existing plan
  const { data: existing } = await adminSupabase
    .from('media_plans')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('year', year)
    .eq('plan_type', 'media')
    .single()

  if (existing) return { plan: existing }

  // Create new plan
  const { data: created, error: createError } = await adminSupabase
    .from('media_plans')
    .insert({
      workspace_id: workspaceId,
      year,
      created_by: user.id,
    })
    .select()
    .single()

  if (createError) return { error: createError.message }
  return { plan: created }
}

// Admin version — no workspace membership check
export async function getOrCreateMediaPlanAdmin(workspaceId: string, year: number) {
  const { user } = await requireAdmin()
  const adminSupabase = createAdminClient()

  const { data: existing } = await adminSupabase
    .from('media_plans')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('year', year)
    .eq('plan_type', 'media')
    .single()

  if (existing) return { plan: existing }

  const { data: created, error: createError } = await adminSupabase
    .from('media_plans')
    .insert({
      workspace_id: workspaceId,
      year,
      created_by: user.id,
    })
    .select()
    .single()

  if (createError) return { error: createError.message }
  return { plan: created }
}

// ============================================================
// GET METRICS
// ============================================================

export async function getMediaPlanMetrics(planId: string, workspaceId: string) {
  const { error, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !adminSupabase) return { error: error ?? 'Erro' }

  const { data, error: fetchError } = await adminSupabase
    .from('media_plan_metrics')
    .select('*')
    .eq('media_plan_id', planId)
    .order('metric_key')
    .order('month')

  if (fetchError) return { error: fetchError.message }
  return { metrics: data ?? [] }
}

export async function getMediaPlanMetricsAdmin(planId: string) {
  await requireAdmin()
  const adminSupabase = createAdminClient()

  const { data, error: fetchError } = await adminSupabase
    .from('media_plan_metrics')
    .select('*')
    .eq('media_plan_id', planId)
    .order('metric_key')
    .order('month')

  if (fetchError) return { error: fetchError.message }
  return { metrics: data ?? [] }
}

// ============================================================
// UPSERT METRICS (batch)
// ============================================================

export async function upsertMetrics(
  workspaceId: string,
  planId: string,
  updates: Array<{
    metric_key: string
    month: number
    value_numeric: number | null
    delta_pct: number | null
    input_mode: 'value' | 'delta_pct'
  }>
) {
  const { error, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !adminSupabase) return { error: error ?? 'Erro' }

  if (updates.length === 0) return { success: true }

  const rows = updates.map((u) => ({
    media_plan_id: planId,
    metric_key: u.metric_key,
    month: u.month,
    value_numeric: u.value_numeric,
    delta_pct: u.delta_pct,
    input_mode: u.input_mode,
    updated_at: new Date().toISOString(),
  }))

  const { error: upsertError } = await adminSupabase
    .from('media_plan_metrics')
    .upsert(rows, { onConflict: 'media_plan_id,metric_key,month' })

  if (upsertError) return { error: upsertError.message }

  // Update plan timestamp
  await adminSupabase
    .from('media_plans')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', planId)

  return { success: true }
}

export async function upsertMetricsAdmin(
  planId: string,
  updates: Array<{
    metric_key: string
    month: number
    value_numeric: number | null
    delta_pct: number | null
    input_mode: 'value' | 'delta_pct'
  }>
) {
  await requireAdmin()
  const adminSupabase = createAdminClient()

  if (updates.length === 0) return { success: true }

  const rows = updates.map((u) => ({
    media_plan_id: planId,
    metric_key: u.metric_key,
    month: u.month,
    value_numeric: u.value_numeric,
    delta_pct: u.delta_pct,
    input_mode: u.input_mode,
    updated_at: new Date().toISOString(),
  }))

  const { error: upsertError } = await adminSupabase
    .from('media_plan_metrics')
    .upsert(rows, { onConflict: 'media_plan_id,metric_key,month' })

  if (upsertError) return { error: upsertError.message }

  await adminSupabase
    .from('media_plans')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', planId)

  return { success: true }
}

// ============================================================
// SYNC MEDIA → FINANCIAL
// ============================================================

export async function syncMediaToFinancial(workspaceId: string, year: number) {
  const { error, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !adminSupabase) return { error: error ?? 'Erro' }

  // Get media plan
  const { data: mediaPlan } = await adminSupabase
    .from('media_plans')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('year', year)
    .eq('plan_type', 'media')
    .single()

  if (!mediaPlan) return { error: 'Plano de mídia não encontrado' }

  // Get financial plan
  const { data: finPlan } = await adminSupabase
    .from('media_plans')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('year', year)
    .eq('plan_type', 'financial')
    .single()

  if (!finPlan) return { error: 'Plano financeiro não encontrado. Acesse o Planejamento Financeiro primeiro.' }

  // Get REV_BILLED from media plan
  const { data: revMetrics } = await adminSupabase
    .from('media_plan_metrics')
    .select('month, value_numeric')
    .eq('media_plan_id', mediaPlan.id)
    .eq('metric_key', 'REV_BILLED')

  if (!revMetrics || revMetrics.length === 0) return { error: 'Nenhuma receita faturada encontrada no plano de mídia' }

  // Write FATURAMENTO to financial plan
  const rows = revMetrics
    .filter((r) => r.value_numeric && r.value_numeric > 0)
    .map((r) => ({
      media_plan_id: finPlan.id,
      metric_key: 'FATURAMENTO',
      month: r.month,
      value_numeric: r.value_numeric,
      delta_pct: null,
      input_mode: 'value',
      updated_at: new Date().toISOString(),
    }))

  if (rows.length === 0) return { error: 'Nenhum valor de receita faturada para enviar' }

  const { error: upsertError } = await adminSupabase
    .from('media_plan_metrics')
    .upsert(rows, { onConflict: 'media_plan_id,metric_key,month' })

  if (upsertError) return { error: upsertError.message }

  return { success: true, synced: rows.length }
}
