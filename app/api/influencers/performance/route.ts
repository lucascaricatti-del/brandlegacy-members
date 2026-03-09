import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const PAID_STATUSES = ['paid', 'invoiced', 'shipped', 'delivered']

function daysBetween(from: string, to: string): number {
  const a = new Date(from + 'T00:00:00Z')
  const b = new Date(to + 'T00:00:00Z')
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

function toYMD(d: Date) { return d.toISOString().slice(0, 10) }

async function fetchOrders(workspace_id: string, date_from: string, date_to: string) {
  let allOrders: any[] = []
  let offset = 0
  const PAGE = 1000
  while (true) {
    const { data: orders, error } = await (adminSupabase as any)
      .from('yampi_orders')
      .select('coupon_code, revenue, order_id, date, status')
      .eq('workspace_id', workspace_id)
      .gte('date', date_from)
      .lte('date', date_to)
      .in('status', PAID_STATUSES)
      .not('coupon_code', 'is', null)
      .range(offset, offset + PAGE - 1)
    if (error) throw new Error(error.message)
    allOrders.push(...(orders || []))
    if (!orders || orders.length < PAGE) break
    offset += PAGE
  }
  return allOrders
}

function groupByCoupon(orders: any[]) {
  const map = new Map<string, any[]>()
  for (const o of orders) {
    const code = (o.coupon_code || '').toUpperCase()
    if (!map.has(code)) map.set(code, [])
    map.get(code)!.push(o)
  }
  return map
}

export async function GET(req: NextRequest) {
  const workspace_id = req.nextUrl.searchParams.get('workspace_id')
  const date_from = req.nextUrl.searchParams.get('date_from')
  const date_to = req.nextUrl.searchParams.get('date_to')
  const include_inactive = req.nextUrl.searchParams.get('include_inactive') === 'true'
  const compare = req.nextUrl.searchParams.get('compare') === 'true'

  if (!workspace_id || !date_from || !date_to) {
    return NextResponse.json({ error: 'workspace_id, date_from, date_to required' }, { status: 400 })
  }

  // 1. Fetch influencers
  let query = (adminSupabase as any).from('influencers').select('*').eq('workspace_id', workspace_id)
  if (!include_inactive) query = query.eq('is_active', true)
  const { data: influencers, error: infErr } = await query

  if (infErr) return NextResponse.json({ error: infErr.message }, { status: 500 })
  if (!influencers || influencers.length === 0) return NextResponse.json({ performance: [] })

  const ids = influencers.map((i: any) => i.id)

  // 2. Fetch sequences & renewals
  const [{ data: allSequences }, { data: allRenewals }] = await Promise.all([
    (adminSupabase as any).from('influencer_sequences').select('*').in('influencer_id', ids).order('sequence_number'),
    (adminSupabase as any).from('influencer_renewals').select('*').in('influencer_id', ids).order('renewal_number'),
  ])

  const seqByInf = new Map<string, any[]>()
  for (const s of allSequences || []) {
    if (!seqByInf.has(s.influencer_id)) seqByInf.set(s.influencer_id, [])
    seqByInf.get(s.influencer_id)!.push(s)
  }
  const renByInf = new Map<string, any[]>()
  for (const r of allRenewals || []) {
    if (!renByInf.has(r.influencer_id)) renByInf.set(r.influencer_id, [])
    renByInf.get(r.influencer_id)!.push(r)
  }

  // 3. Fetch orders for current period
  let allOrders: any[]
  try { allOrders = await fetchOrders(workspace_id, date_from, date_to) }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }

  const ordersByCoupon = groupByCoupon(allOrders)

  // 4. Previous period orders (for trend comparison)
  let prevOrdersByCoupon = new Map<string, any[]>()
  if (compare) {
    const periodDays = daysBetween(date_from, date_to) + 1
    const prevToDate = new Date(date_from + 'T00:00:00Z')
    prevToDate.setDate(prevToDate.getDate() - 1)
    const prevFromDate = new Date(prevToDate)
    prevFromDate.setDate(prevFromDate.getDate() - periodDays + 1)
    try {
      const prevOrders = await fetchOrders(workspace_id, toYMD(prevFromDate), toYMD(prevToDate))
      prevOrdersByCoupon = groupByCoupon(prevOrders)
    } catch { /* ignore compare errors */ }
  }

  // 5. Calculate period_days
  const periodDays = daysBetween(date_from, date_to) + 1

  // 6. Build performance per influencer
  const performance = influencers.map((inf: any) => {
    const renewals = renByInf.get(inf.id) || []
    const currentRenewal = renewals.find((r: any) => r.is_current)

    // Use current renewal terms if exists, else base influencer terms
    const fee_type = currentRenewal?.fee_type || inf.fee_type || 'fixed'
    const monthly_fee = Number(currentRenewal?.monthly_fee ?? inf.monthly_fee) || 0
    const commission_pct = Number(currentRenewal?.commission_pct ?? inf.commission_pct) || 0
    const contract_start = currentRenewal?.start_date || inf.start_date
    const contract_end = currentRenewal?.end_date || inf.end_date

    // Prorated cost: monthly_fee / contract_days * period_days
    const contractDays = contract_end && contract_start
      ? Math.max(daysBetween(contract_start, contract_end) + 1, 1)
      : 30
    const prorated_fee = monthly_fee / contractDays * periodDays

    // Orders
    const code = (inf.coupon_code || '').toUpperCase()
    const orders = ordersByCoupon.get(code) || []
    const total_orders = orders.length
    const total_revenue = orders.reduce((s: number, o: any) => s + Number(o.revenue || 0), 0)
    const avg_ticket = total_orders > 0 ? total_revenue / total_orders : 0

    const commission_cost = total_revenue * commission_pct / 100
    const total_cost = prorated_fee + commission_cost
    // ROAS = revenue / cost (not ROI)
    const roas = total_cost > 0 ? Math.round((total_revenue / total_cost) * 10) / 10 : null

    // Previous period for trend
    let prev_orders: number | undefined
    let prev_revenue: number | undefined
    if (compare) {
      const prevOrd = prevOrdersByCoupon.get(code) || []
      prev_orders = prevOrd.length
      prev_revenue = Math.round(prevOrd.reduce((s: number, o: any) => s + Number(o.revenue || 0), 0) * 100) / 100
    }

    return {
      id: inf.id,
      name: inf.name,
      instagram: inf.instagram,
      coupon_code: inf.coupon_code,
      tier: inf.tier || 'micro',
      fee_type,
      monthly_fee,
      commission_pct,
      start_date: inf.start_date,
      end_date: inf.end_date,
      contract_status: inf.contract_status || 'active',
      niche: inf.niche,
      followers_count: inf.followers_count,
      is_active: inf.is_active,
      notes: inf.notes,
      total_orders,
      total_revenue: Math.round(total_revenue * 100) / 100,
      avg_ticket: Math.round(avg_ticket * 100) / 100,
      total_cost: Math.round(total_cost * 100) / 100,
      roas,
      sequences: seqByInf.get(inf.id) || [],
      renewals,
      prev_orders,
      prev_revenue,
    }
  })

  performance.sort((a: any, b: any) => b.total_revenue - a.total_revenue)
  return NextResponse.json({ performance })
}
