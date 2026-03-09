import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest) {
  const influencer_id = req.nextUrl.searchParams.get('influencer_id')
  if (!influencer_id) return NextResponse.json({ error: 'influencer_id required' }, { status: 400 })

  const { data, error } = await (adminSupabase as any)
    .from('influencer_renewals')
    .select('*')
    .eq('influencer_id', influencer_id)
    .order('renewal_number')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ renewals: data || [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { influencer_id, workspace_id, start_date, end_date, fee_type, monthly_fee, commission_pct, notes } = body

  if (!influencer_id || !workspace_id || !start_date) {
    return NextResponse.json({ error: 'influencer_id, workspace_id, start_date required' }, { status: 400 })
  }

  // Set all existing renewals for this influencer to not current
  await (adminSupabase as any)
    .from('influencer_renewals')
    .update({ is_current: false })
    .eq('influencer_id', influencer_id)

  // Count existing to set renewal_number
  const { data: existing } = await (adminSupabase as any)
    .from('influencer_renewals')
    .select('id')
    .eq('influencer_id', influencer_id)

  const { data, error } = await (adminSupabase as any)
    .from('influencer_renewals')
    .insert({
      influencer_id,
      workspace_id,
      renewal_number: (existing?.length || 0) + 1,
      start_date,
      end_date: end_date || null,
      fee_type: fee_type || 'fixed',
      monthly_fee: monthly_fee || 0,
      commission_pct: commission_pct || 0,
      notes: notes || null,
      is_current: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ renewal: data })
}

export async function PUT(req: NextRequest) {
  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data, error } = await (adminSupabase as any)
    .from('influencer_renewals')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ renewal: data })
}
