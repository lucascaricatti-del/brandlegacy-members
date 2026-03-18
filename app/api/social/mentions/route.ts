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
  const platform = searchParams.get('platform')
  const status = searchParams.get('status')
  const limit = parseInt(searchParams.get('limit') || '20')
  const cursor = searchParams.get('cursor') // ISO timestamp for keyset pagination

  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  // Fetch mentions
  let query = (adminSupabase as any)
    .from('social_mentions')
    .select('*')
    .eq('workspace_id', workspace_id)
    .order('timestamp', { ascending: false })
    .limit(limit)

  if (platform) query = query.eq('platform', platform)
  if (status) query = query.eq('status', status)
  if (cursor) query = query.lt('timestamp', cursor)

  const { data: mentions, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch counts by status for Kanban
  const { data: countRows, error: countError } = await (adminSupabase as any)
    .from('social_mentions')
    .select('status')
    .eq('workspace_id', workspace_id)

  const counts: Record<string, number> = { new: 0, analyzing: 0, editing: 0, testing: 0 }
  if (!countError && countRows) {
    for (const row of countRows) {
      const s = row.status as string
      if (s in counts) counts[s]++
    }
  }

  return NextResponse.json({
    mentions: mentions ?? [],
    counts,
  })
}
