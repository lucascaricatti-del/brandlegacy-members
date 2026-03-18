import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWorkspaceAccess } from '@/lib/api-auth'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { workspace_id, marketplace, date, revenue, orders } = body

  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (!marketplace || !date) {
    return NextResponse.json({ error: 'marketplace and date required' }, { status: 400 })
  }

  const validMarketplaces = ['shopee', 'magalu', 'netshoes', 'tiktok_shop']
  if (!validMarketplaces.includes(marketplace)) {
    return NextResponse.json({ error: 'Invalid marketplace' }, { status: 400 })
  }

  // Get tax config from workspace to apply rates
  const { data: workspace } = await (adminSupabase as any)
    .from('workspaces')
    .select('marketplace_tax_config')
    .eq('id', workspace_id)
    .single()

  const taxConfig = workspace?.marketplace_tax_config || {}
  const mkConfig = taxConfig[marketplace] || {}
  const taxRatePct = Number(mkConfig.tax_rate_percent || 0)
  const shippingRatePct = Number(mkConfig.shipping_rate_percent || 0)

  const { data, error } = await (adminSupabase as any)
    .from('marketplace_manual_metrics')
    .upsert(
      {
        workspace_id,
        marketplace,
        date,
        revenue: revenue ?? 0,
        orders: orders ?? 0,
        tax_rate_percent: taxRatePct,
        shipping_rate_percent: shippingRatePct,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id,marketplace,date' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
