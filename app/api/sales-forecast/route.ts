import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWorkspaceAccess } from '@/lib/api-auth'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest) {
  const workspace_id = req.nextUrl.searchParams.get('workspace_id')
  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const year = parseInt(req.nextUrl.searchParams.get('year') || '')
  if (!year) return NextResponse.json({ error: 'year required' }, { status: 400 })

  const { data, error } = await (adminSupabase as any)
    .from('sales_forecast')
    .select('*')
    .eq('workspace_id', workspace_id)
    .eq('year', year)
    .order('channel')
    .order('month')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ forecasts: data || [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { workspace_id, year, month, channel } = body

  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (!year || !month || !channel) {
    return NextResponse.json({ error: 'year, month, channel required' }, { status: 400 })
  }

  const isRealizado = body.is_realizado ?? false

  // Get existing data to preserve fields not being updated
  const existingQuery = (adminSupabase as any)
    .from('sales_forecast')
    .select('faturamento_bruto, pedidos, investimento_midia, imposto_pct, cmv_pct, taxas_pct, comissao_marketplace_pct, cancelamento_pct, logistica_rs, imported_from_midia_plan')
    .eq('workspace_id', workspace_id)
    .eq('year', year)
    .eq('month', month)
    .eq('channel', channel)
    .eq('is_realizado', isRealizado)

  const { data: existing } = await existingQuery.single()

  const upsertData: Record<string, any> = {
    workspace_id,
    year,
    month,
    channel,
    is_realizado: isRealizado,
    faturamento_bruto: body.faturamento_bruto ?? existing?.faturamento_bruto ?? null,
    pedidos: body.pedidos ?? existing?.pedidos ?? null,
    investimento_midia: body.investimento_midia ?? existing?.investimento_midia ?? null,
    imposto_pct: body.imposto_pct ?? existing?.imposto_pct ?? null,
    cmv_pct: body.cmv_pct ?? existing?.cmv_pct ?? null,
    taxas_pct: body.taxas_pct ?? existing?.taxas_pct ?? null,
    comissao_marketplace_pct: body.comissao_marketplace_pct ?? existing?.comissao_marketplace_pct ?? null,
    cancelamento_pct: body.cancelamento_pct ?? existing?.cancelamento_pct ?? null,
    logistica_rs: body.logistica_rs ?? existing?.logistica_rs ?? null,
    imported_from_midia_plan: body.imported_from_midia_plan ?? existing?.imported_from_midia_plan ?? false,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await (adminSupabase as any)
    .from('sales_forecast')
    .upsert(upsertData, { onConflict: 'workspace_id,year,month,channel,is_realizado' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ forecast: data })
}

/** DELETE a channel's data for a workspace/year */
export async function DELETE(req: NextRequest) {
  const body = await req.json()
  const { workspace_id, year, channel } = body

  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (!year || !channel || channel === 'ecommerce' || channel === 'consolidado') {
    return NextResponse.json({ error: 'Cannot delete this channel' }, { status: 400 })
  }

  const { error } = await (adminSupabase as any)
    .from('sales_forecast')
    .delete()
    .eq('workspace_id', workspace_id)
    .eq('year', year)
    .eq('channel', channel)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
