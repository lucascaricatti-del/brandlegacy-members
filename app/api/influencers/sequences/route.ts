import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWorkspaceAccess } from '@/lib/api-auth'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest) {
  const influencer_id = req.nextUrl.searchParams.get('influencer_id')
  const workspace_id = req.nextUrl.searchParams.get('workspace_id')
  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (!influencer_id) return NextResponse.json({ error: 'influencer_id required' }, { status: 400 })

  const { data, error } = await (adminSupabase as any)
    .from('influencer_sequences')
    .select('*')
    .eq('influencer_id', influencer_id)
    .order('sequence_number')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sequences: data || [] })
}

// Batch replace: deletes existing sequences for the influencer and inserts new ones
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { influencer_id, workspace_id, sequences } = body

  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (!influencer_id || !sequences) {
    return NextResponse.json({ error: 'influencer_id, sequences required' }, { status: 400 })
  }

  // Delete existing
  await (adminSupabase as any)
    .from('influencer_sequences')
    .delete()
    .eq('influencer_id', influencer_id)

  const toInsert = (sequences as any[])
    .map((s, i) => ({
      influencer_id,
      workspace_id,
      sequence_number: i + 1,
      scheduled_date: s.scheduled_date,
      content_type: s.content_type || null,
      description: s.description || null,
      status: s.status || 'pending',
      published_at: s.published_at || null,
    }))
    .filter(s => s.scheduled_date)

  if (toInsert.length === 0) return NextResponse.json({ sequences: [] })

  const { data, error } = await (adminSupabase as any)
    .from('influencer_sequences')
    .insert(toInsert)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sequences: data || [] })
}

export async function PUT(req: NextRequest) {
  const { id, workspace_id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await (adminSupabase as any)
    .from('influencer_sequences')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sequence: data })
}
