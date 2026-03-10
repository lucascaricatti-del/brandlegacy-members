'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MONTHS, KEY_METRICS, calcMonth, type KeyValues } from '@/lib/utils/media-plan-calc'

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
  }>,
  isRealizado?: boolean
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
    is_realizado: isRealizado ?? false,
    updated_at: new Date().toISOString(),
  }))

  const { error: upsertError } = await adminSupabase
    .from('media_plan_metrics')
    .upsert(rows, { onConflict: 'media_plan_id,metric_key,month,is_realizado' })

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
  }>,
  isRealizado?: boolean
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
    is_realizado: isRealizado ?? false,
    updated_at: new Date().toISOString(),
  }))

  const { error: upsertError } = await adminSupabase
    .from('media_plan_metrics')
    .upsert(rows, { onConflict: 'media_plan_id,metric_key,month,is_realizado' })

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

  // Get ALL key metrics from media plan (REV_BILLED and SPEND_TOTAL are calculated, not stored)
  const { data: mediaMetrics } = await adminSupabase
    .from('media_plan_metrics')
    .select('metric_key, month, value_numeric')
    .eq('media_plan_id', mediaPlan.id)
    .eq('is_realizado', false)
    .in('metric_key', KEY_METRICS as unknown as string[])

  if (!mediaMetrics || mediaMetrics.length === 0) return { error: 'Nenhuma métrica encontrada no plano de mídia' }

  // Build KeyValues structure for the calc engine
  const keyValues: KeyValues = {}
  for (const m of mediaMetrics) {
    const key = m.metric_key
    if (!keyValues[key]) keyValues[key] = {}
    keyValues[key][m.month] = Number(m.value_numeric || 0)
  }

  // Calculate results for each month using the media plan engine
  const now = new Date().toISOString()
  const rows: Array<{ media_plan_id: string; metric_key: string; month: number; value_numeric: number; delta_pct: null; input_mode: string; updated_at: string }> = []

  for (const month of MONTHS) {
    const results = calcMonth(keyValues, month)
    const revBilled = results.REV_BILLED
    const spendTotal = results.SPEND_TOTAL

    // Sync REV_BILLED → FATURAMENTO
    if (revBilled > 0) {
      rows.push({
        media_plan_id: finPlan.id,
        metric_key: 'FATURAMENTO',
        month,
        value_numeric: revBilled,
        delta_pct: null,
        input_mode: 'value',
        updated_at: now,
      })
    }

    // Sync SPEND_TOTAL → MIDIA_PCT (derive % from spend/rev)
    if (spendTotal > 0 && revBilled > 0) {
      const midiaPct = Math.round((spendTotal / revBilled) * 10000) / 100
      rows.push({
        media_plan_id: finPlan.id,
        metric_key: 'MIDIA_PCT',
        month,
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
    .upsert(rows.map(r => ({ ...r, is_realizado: false })), { onConflict: 'media_plan_id,metric_key,month,is_realizado' })

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

// ============================================================
// UPDATE MEDIA PLAN METADATA (for min investment settings, etc.)
// ============================================================

export async function updateMediaPlanMetadata(
  workspaceId: string,
  planId: string,
  metadata: Record<string, any>,
) {
  const { error, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !adminSupabase) return { error: error ?? 'Erro' }

  const { error: updateErr } = await adminSupabase
    .from('media_plans')
    .update({ metadata, updated_at: new Date().toISOString() })
    .eq('id', planId)

  if (updateErr) return { error: updateErr.message }
  return { success: true }
}
