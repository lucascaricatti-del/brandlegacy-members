import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWorkspaceAccess } from '@/lib/api-auth'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/**
 * Import data from Midia Plan into Sales Forecast (ecommerce channel).
 * Maps: REV_BILLED → faturamento_bruto, ORD_BILLED → pedidos, SPEND_TOTAL → investimento_midia
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { workspace_id, year } = body

  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (!year) return NextResponse.json({ error: 'year required' }, { status: 400 })

  // Find the media plan for this workspace/year
  const { data: mediaPlan } = await (adminSupabase as any)
    .from('media_plans')
    .select('id')
    .eq('workspace_id', workspace_id)
    .eq('year', year)
    .eq('plan_type', 'media')
    .single()

  if (!mediaPlan) {
    return NextResponse.json({ error: 'Midia Plan não encontrado para este ano' }, { status: 404 })
  }

  // Get all metrics from the media plan
  const { data: metrics } = await (adminSupabase as any)
    .from('media_plan_metrics')
    .select('metric_key, month, value_numeric')
    .eq('media_plan_id', mediaPlan.id)
    .in('metric_key', ['REV_BILLED', 'ORD_BILLED', 'SPEND_TOTAL'])

  if (!metrics || metrics.length === 0) {
    return NextResponse.json({ error: 'Nenhum dado encontrado no Midia Plan' }, { status: 404 })
  }

  // Group by month
  const byMonth: Record<number, { faturamento_bruto?: number; pedidos?: number; investimento_midia?: number }> = {}
  for (const m of metrics) {
    if (!byMonth[m.month]) byMonth[m.month] = {}
    if (m.metric_key === 'REV_BILLED' && m.value_numeric) byMonth[m.month].faturamento_bruto = m.value_numeric
    if (m.metric_key === 'ORD_BILLED' && m.value_numeric) byMonth[m.month].pedidos = Math.round(m.value_numeric)
    if (m.metric_key === 'SPEND_TOTAL' && m.value_numeric) byMonth[m.month].investimento_midia = m.value_numeric
  }

  // Upsert each month into sales_forecast (ecommerce channel)
  let imported = 0
  for (const [monthStr, values] of Object.entries(byMonth)) {
    const month = parseInt(monthStr)
    if (isNaN(month)) continue

    // Get existing data to preserve imposto_pct and cmv_pct
    const { data: existing } = await (adminSupabase as any)
      .from('sales_forecast')
      .select('imposto_pct, cmv_pct')
      .eq('workspace_id', workspace_id)
      .eq('year', year)
      .eq('month', month)
      .eq('channel', 'ecommerce')
      .single()

    const { error } = await (adminSupabase as any)
      .from('sales_forecast')
      .upsert({
        workspace_id,
        year,
        month,
        channel: 'ecommerce',
        faturamento_bruto: values.faturamento_bruto ?? null,
        pedidos: values.pedidos ?? null,
        investimento_midia: values.investimento_midia ?? null,
        imposto_pct: existing?.imposto_pct ?? null,
        cmv_pct: existing?.cmv_pct ?? null,
        imported_from_midia_plan: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'workspace_id,year,month,channel' })

    if (!error) imported++
  }

  return NextResponse.json({ imported, months: Object.keys(byMonth).length })
}
