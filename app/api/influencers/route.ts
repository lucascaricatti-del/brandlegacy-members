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

  const { data, error } = await (adminSupabase as any)
    .from('influencers')
    .select('*')
    .eq('workspace_id', workspace_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ influencers: data || [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { workspace_id, name, instagram, category, coupon_code, fee_type, monthly_fee, commission_pct, start_date, end_date, notes, is_active, tier, contract_status, followers_count, niche, utm_url, utm_source, utm_medium, utm_campaign, utm_full_url } = body

  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (!name || !coupon_code) {
    return NextResponse.json({ error: 'name, coupon_code required' }, { status: 400 })
  }

  const { data, error } = await (adminSupabase as any)
    .from('influencers')
    .insert({
      workspace_id, name, instagram, category,
      coupon_code: coupon_code.toUpperCase(),
      fee_type: fee_type || 'fixed',
      monthly_fee: monthly_fee || 0,
      commission_pct: commission_pct || 0,
      start_date: start_date || null,
      end_date: end_date || null,
      notes: notes || null,
      is_active: is_active !== false,
      tier: tier || 'micro',
      contract_status: contract_status || 'active',
      followers_count: followers_count || null,
      niche: niche || null,
      total_sequences: body.total_sequences || 3,
      utm_url: utm_url || null,
      utm_source: utm_source || null,
      utm_medium: utm_medium || 'influencer',
      utm_campaign: utm_campaign || null,
      utm_full_url: utm_full_url || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ influencer: data })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { id, workspace_id, ...updates } = body

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (updates.coupon_code) updates.coupon_code = updates.coupon_code.toUpperCase()
  updates.updated_at = new Date().toISOString()

  const { data, error } = await (adminSupabase as any)
    .from('influencers')
    .update(updates)
    .eq('id', id)
    .eq('workspace_id', workspace_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ influencer: data })
}

export async function DELETE(req: NextRequest) {
  const { id, workspace_id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { error } = await (adminSupabase as any)
    .from('influencers')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspace_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
