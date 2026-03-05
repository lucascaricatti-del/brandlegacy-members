import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  const { workspace_id, date_from, date_to } = await req.json()
  if (!workspace_id) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })

  let query = supabase
    .from('ml_orders')
    .select('order_id, date, status, revenue, net_revenue, marketplace_fee, ml_commission, ml_fixed_fee, ml_financing_fee, frete_custo, net_revenue_full, buyer_nickname, items, currency')
    .eq('workspace_id', workspace_id)

  if (date_from) query = query.gte('date', date_from)
  if (date_to) query = query.lte('date', date_to)

  const { data, error } = await query
    .order('date', { ascending: false })
    .limit(5000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}
