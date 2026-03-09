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

  const coupon_code = req.nextUrl.searchParams.get('coupon_code')

  if (!coupon_code) {
    return NextResponse.json({ error: 'coupon_code required' }, { status: 400 })
  }

  const { data, error } = await (adminSupabase as any)
    .from('yampi_orders')
    .select('revenue')
    .eq('workspace_id', workspace_id)
    .ilike('coupon_code', coupon_code)
    .in('status', ['paid', 'invoiced', 'shipped', 'delivered'])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const orders = (data || []).length
  const revenue = (data || []).reduce((s: number, o: any) => s + Number(o.revenue || 0), 0)

  return NextResponse.json({ orders, revenue: Math.round(revenue * 100) / 100 })
}
