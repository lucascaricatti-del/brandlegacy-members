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
  const { workspace_id, year, month, channel, faturamento_bruto, pedidos, investimento_midia, imposto_pct, cmv_pct } = body

  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (!year || !month || !channel) {
    return NextResponse.json({ error: 'year, month, channel required' }, { status: 400 })
  }

  const { data, error } = await (adminSupabase as any)
    .from('sales_forecast')
    .upsert({
      workspace_id,
      year,
      month,
      channel,
      faturamento_bruto: faturamento_bruto ?? null,
      pedidos: pedidos ?? null,
      investimento_midia: investimento_midia ?? null,
      imposto_pct: imposto_pct ?? null,
      cmv_pct: cmv_pct ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id,year,month,channel' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ forecast: data })
}
