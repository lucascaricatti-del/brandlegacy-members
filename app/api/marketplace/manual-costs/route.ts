import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const workspace_id = searchParams.get('workspace_id')
  const date_from = searchParams.get('date_from')
  const date_to = searchParams.get('date_to')

  if (!workspace_id) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
  if (!date_from || !date_to) return NextResponse.json({ error: 'date_from and date_to required' }, { status: 400 })

  // Get first day of date_from month and first day of date_to month
  const monthFrom = date_from.slice(0, 7) + '-01'
  const monthTo = date_to.slice(0, 7) + '-01'

  const { data, error } = await (adminSupabase as any)
    .from('ml_manual_costs')
    .select('*')
    .eq('workspace_id', workspace_id)
    .gte('month', monthFrom)
    .lte('month', monthTo)
    .order('month', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data || []
  const totals = {
    ml_ads_cost: rows.reduce((s: number, r: any) => s + Number(r.ml_ads_cost || 0), 0),
    ml_fulfillment_cost: rows.reduce((s: number, r: any) => s + Number(r.ml_fulfillment_cost || 0), 0),
    ml_return_fee: rows.reduce((s: number, r: any) => s + Number(r.ml_return_fee || 0), 0),
    ml_other_fees: rows.reduce((s: number, r: any) => s + Number(r.ml_other_fees || 0), 0),
    months: rows,
  }

  return NextResponse.json(totals)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { workspace_id, month, ml_ads_cost, ml_fulfillment_cost, ml_return_fee, ml_other_fees, notes } = body

  if (!workspace_id) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
  if (!month) return NextResponse.json({ error: 'month required (YYYY-MM-01)' }, { status: 400 })

  const { data, error } = await (adminSupabase as any)
    .from('ml_manual_costs')
    .upsert(
      {
        workspace_id,
        month,
        ml_ads_cost: ml_ads_cost ?? 0,
        ml_fulfillment_cost: ml_fulfillment_cost ?? 0,
        ml_return_fee: ml_return_fee ?? 0,
        ml_other_fees: ml_other_fees ?? 0,
        notes: notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id,month' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
