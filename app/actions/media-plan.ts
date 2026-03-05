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

  // Get or create financial plan
  let finPlan: { id: string } | null = null
  const { data: existingFin } = await adminSupabase
    .from('media_plans')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('year', year)
    .eq('plan_type', 'financial')
    .single()

  if (existingFin) {
    finPlan = existingFin
  } else {
    const { data: { user } } = await (await createClient()).auth.getUser()
    const { data: created, error: createErr } = await adminSupabase
      .from('media_plans')
      .insert({ workspace_id: workspaceId, year, plan_type: 'financial', created_by: user?.id })
      .select('id')
      .single()
    if (createErr || !created) return { error: 'Erro ao criar plano financeiro: ' + (createErr?.message ?? '') }
    finPlan = created
  }

  // Get media plan metrics: REV_BILLED + spend keys
  const { data: mediaMetrics } = await adminSupabase
    .from('media_plan_metrics')
    .select('metric_key, month, value_numeric')
    .eq('media_plan_id', mediaPlan.id)
    .in('metric_key', ['REV_BILLED', 'SPEND_META', 'SPEND_GOOGLE', 'SPEND_INFLUENCER'])

  if (!mediaMetrics || mediaMetrics.length === 0) return { error: 'Nenhuma métrica encontrada no plano de mídia' }

  // Build per-month maps
  const revByMonth: Record<number, number> = {}
  const spendByMonth: Record<number, number> = {}
  for (const m of mediaMetrics) {
    const val = Number(m.value_numeric || 0)
    if (m.metric_key === 'REV_BILLED') {
      revByMonth[m.month] = val
    } else {
      spendByMonth[m.month] = (spendByMonth[m.month] || 0) + val
    }
  }

  const now = new Date().toISOString()
  const rows: Array<{ media_plan_id: string; metric_key: string; month: number; value_numeric: number; delta_pct: null; input_mode: string; updated_at: string }> = []

  // Sync REV_BILLED → FATURAMENTO
  for (const [month, val] of Object.entries(revByMonth)) {
    if (val > 0) {
      rows.push({
        media_plan_id: finPlan.id,
        metric_key: 'FATURAMENTO',
        month: Number(month),
        value_numeric: val,
        delta_pct: null,
        input_mode: 'value',
        updated_at: now,
      })
    }
  }

  // Sync SPEND_TOTAL → MIDIA_PCT (derive % from spend/rev)
  for (const [month, spend] of Object.entries(spendByMonth)) {
    const m = Number(month)
    const rev = revByMonth[m] || 0
    if (spend > 0 && rev > 0) {
      const midiaPct = Math.round((spend / rev) * 10000) / 100 // 2 decimal places
      rows.push({
        media_plan_id: finPlan.id,
        metric_key: 'MIDIA_PCT',
        month: m,
        value_numeric: midiaPct,
        delta_pct: null,
        input_mode: 'value',
        updated_at: now,
      })
    }
  }

  if (rows.length === 0) return { error: 'Nenhum valor para enviar' }

  const { error: upsertError } = await adminSupabase
    .from('media_plan_metrics')
    .upsert(rows, { onConflict: 'media_plan_id,metric_key,month' })

  if (upsertError) return { error: upsertError.message }

  return { success: true, synced: rows.length }
}

// ============================================================
// GET MEDIA PLAN GOALS (for Performance page)
// ============================================================

export async function getMediaPlanGoals(workspaceId: string, year: number, month: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const adminSupabase = createAdminClient()

  const { data: plan } = await adminSupabase
    .from('media_plans')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('year', year)
    .eq('plan_type', 'media')
    .single()

  if (!plan) return { error: 'Plano de mídia não encontrado para este ano' }

  const { data: metrics } = await adminSupabase
    .from('media_plan_metrics')
    .select('metric_key, value_numeric')
    .eq('media_plan_id', plan.id)
    .eq('month', month)
    .in('metric_key', ['RECEITA_META', 'SPEND_META', 'SPEND_GOOGLE', 'SPEND_INFLUENCER'])

  if (!metrics || metrics.length === 0) return { error: 'Nenhuma meta encontrada para este mês' }

  const metricMap = new Map(metrics.map(m => [m.metric_key, Number(m.value_numeric) || 0]))

  const revenueGoal = metricMap.get('RECEITA_META') ?? 0
  const investmentGoal = (metricMap.get('SPEND_META') ?? 0)
    + (metricMap.get('SPEND_GOOGLE') ?? 0)
    + (metricMap.get('SPEND_INFLUENCER') ?? 0)

  return { revenueGoal, investmentGoal }
}
