import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWorkspaceAccess } from '@/lib/api-auth'
import {
  KEY_METRICS, MONTHS, resolveValue, calcAllMonths,
  type KeyValues,
} from '@/lib/utils/media-plan-calc'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/**
 * Import data from Midia Plan into Sales Forecast (ecommerce channel).
 *
 * DB only stores KEY metrics (editable inputs). RESULT metrics like
 * REV_BILLED, ORD_BILLED, SPEND_TOTAL are computed via calcAllMonths().
 *
 * Maps: REV_BILLED → faturamento_bruto, ORD_BILLED → pedidos, SPEND_TOTAL → investimento_midia
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { workspace_id, year } = body

  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (!year) return NextResponse.json({ error: 'year required' }, { status: 400 })

  // Find the media plan for this workspace/year
  const { data: mediaPlan } = await adminSupabase
    .from('media_plans')
    .select('id')
    .eq('workspace_id', workspace_id)
    .eq('year', year)
    .eq('plan_type', 'media')
    .single()

  if (!mediaPlan) {
    return NextResponse.json({ error: 'Midia Plan não encontrado para este ano' }, { status: 404 })
  }

  // Get ALL key metrics from the media plan (not just result metrics)
  const { data: metrics } = await adminSupabase
    .from('media_plan_metrics')
    .select('metric_key, month, value_numeric, delta_pct, input_mode')
    .eq('media_plan_id', mediaPlan.id)

  if (!metrics || metrics.length === 0) {
    return NextResponse.json({ error: 'Nenhum dado encontrado no Midia Plan' }, { status: 404 })
  }

  // Build raw cell data (same format as PlannerClient uses)
  const rawCells: Record<string, Record<number, { value: number | null; delta_pct: number | null; mode: 'value' | 'delta_pct' }>> = {}
  for (const m of metrics) {
    if (!rawCells[m.metric_key]) rawCells[m.metric_key] = {}
    rawCells[m.metric_key][m.month] = {
      value: m.value_numeric,
      delta_pct: m.delta_pct,
      mode: (m.input_mode as 'value' | 'delta_pct') ?? 'value',
    }
  }

  // Resolve key values (handles delta_pct mode)
  const keyValues: KeyValues = {}
  for (const key of KEY_METRICS) {
    keyValues[key] = {}
    for (const month of MONTHS) {
      keyValues[key][month] = resolveValue(key, month, rawCells)
    }
  }

  // Calculate all result metrics
  const results = calcAllMonths(keyValues)

  // Map to Sales Forecast format — permissive: import any month with any data
  const byMonth: Record<number, { faturamento_bruto: number; pedidos: number; investimento_midia: number }> = {}
  for (const month of MONTHS) {
    const r = results[month]
    if (!r) continue

    // Check if this month has ANY key metric filled (not just computed results)
    const hasKeyData = KEY_METRICS.some(k => (keyValues[k]?.[month] ?? 0) !== 0)
    const hasResultData = r.REV_BILLED !== 0 || r.ORD_BILLED !== 0 || r.SPEND_TOTAL !== 0

    if (!hasKeyData && !hasResultData) continue

    byMonth[month] = {
      faturamento_bruto: r.REV_BILLED,
      pedidos: Math.round(r.ORD_BILLED),
      investimento_midia: r.SPEND_TOTAL,
    }
  }

  if (Object.keys(byMonth).length === 0) {
    return NextResponse.json({ error: 'Midia Plan não tem dados preenchidos (preencha métricas primeiro)' }, { status: 404 })
  }

  // Upsert each month into sales_forecast (ecommerce channel)
  let imported = 0
  for (const [monthStr, values] of Object.entries(byMonth)) {
    const month = parseInt(monthStr)
    if (isNaN(month)) continue

    // Get existing data to preserve imposto_pct, cmv_pct, taxas_pct
    const { data: existing } = await adminSupabase
      .from('sales_forecast')
      .select('imposto_pct, cmv_pct, taxas_pct')
      .eq('workspace_id', workspace_id)
      .eq('year', year)
      .eq('month', month)
      .eq('channel', 'ecommerce')
      .single()

    const { error } = await adminSupabase
      .from('sales_forecast')
      .upsert({
        workspace_id,
        year,
        month,
        channel: 'ecommerce',
        faturamento_bruto: values.faturamento_bruto,
        pedidos: values.pedidos,
        investimento_midia: values.investimento_midia,
        imposto_pct: existing?.imposto_pct ?? null,
        cmv_pct: existing?.cmv_pct ?? null,
        taxas_pct: (existing as any)?.taxas_pct ?? null,
        imported_from_midia_plan: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'workspace_id,year,month,channel' })

    if (!error) imported++
  }

  return NextResponse.json({ imported, months: Object.keys(byMonth).length })
}
