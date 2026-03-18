import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWorkspaceAccess } from '@/lib/api-auth'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const workspace_id = searchParams.get('workspace_id')
  const date_from = searchParams.get('date_from')
  const date_to = searchParams.get('date_to')
  const marketplace = searchParams.get('marketplace')

  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!date_from || !date_to) return NextResponse.json({ error: 'date_from and date_to required' }, { status: 400 })

  let query = (adminSupabase as any)
    .from('marketplace_manual_metrics')
    .select('*')
    .eq('workspace_id', workspace_id)
    .lte('period_start', date_to)
    .gte('period_end', date_from)
    .order('period_start', { ascending: true })

  if (marketplace) {
    query = query.eq('marketplace', marketplace)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    workspace_id, marketplace, period_start, period_end,
    gross_revenue, net_revenue, orders_count, units_sold,
    ad_spend, shipping_cost, returns_count, returns_value, notes,
  } = body

  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (!marketplace || !period_start || !period_end) {
    return NextResponse.json({ error: 'marketplace, period_start, period_end required' }, { status: 400 })
  }

  const validMarketplaces = ['shopee', 'magalu', 'netshoes', 'tiktok_shop']
  if (!validMarketplaces.includes(marketplace)) {
    return NextResponse.json({ error: 'Invalid marketplace' }, { status: 400 })
  }

  const { data, error } = await (adminSupabase as any)
    .from('marketplace_manual_metrics')
    .upsert(
      {
        workspace_id,
        marketplace,
        period_start,
        period_end,
        gross_revenue: gross_revenue ?? 0,
        net_revenue: net_revenue ?? 0,
        orders_count: orders_count ?? 0,
        units_sold: units_sold ?? 0,
        ad_spend: ad_spend ?? 0,
        shipping_cost: shipping_cost ?? 0,
        returns_count: returns_count ?? 0,
        returns_value: returns_value ?? 0,
        notes: notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id,marketplace,period_start,period_end' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
