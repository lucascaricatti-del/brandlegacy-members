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
  const date_from = req.nextUrl.searchParams.get('date_from')
  const date_to = req.nextUrl.searchParams.get('date_to')

  if (!coupon_code) {
    return NextResponse.json({ error: 'coupon_code required' }, { status: 400 })
  }

  let query = (adminSupabase as any)
    .from('yampi_orders')
    .select('order_id, date, revenue, status')
    .eq('workspace_id', workspace_id)
    .ilike('coupon_code', coupon_code)
    .in('status', ['paid', 'invoiced', 'shipped', 'delivered'])
    .order('date', { ascending: false })
    .limit(10)

  if (date_from) query = query.gte('date', date_from)
  if (date_to) query = query.lte('date', date_to)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ orders: data || [] })
}
