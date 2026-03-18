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

  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await (adminSupabase as any)
    .from('social_listening_config')
    .select('*')
    .eq('workspace_id', workspace_id)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Return default if none exists
  return NextResponse.json(data || {
    workspace_id,
    ig_hashtags: [],
    tiktok_hashtags: [],
    last_sync_mentions: null,
    last_sync_hashtags: null,
  })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { workspace_id, ig_hashtags, tiktok_hashtags } = body

  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  // Validate hashtag limits
  if (ig_hashtags && ig_hashtags.length > 30) {
    return NextResponse.json({ error: 'Maximum 30 Instagram hashtags allowed' }, { status: 400 })
  }
  if (tiktok_hashtags && tiktok_hashtags.length > 30) {
    return NextResponse.json({ error: 'Maximum 30 TikTok hashtags allowed' }, { status: 400 })
  }

  // Clean hashtags: remove # prefix, lowercase, trim
  const cleanHashtags = (tags: string[]) =>
    tags.map((t: string) => t.replace(/^#/, '').toLowerCase().trim()).filter(Boolean)

  const { data, error } = await (adminSupabase as any)
    .from('social_listening_config')
    .upsert({
      workspace_id,
      ig_hashtags: cleanHashtags(ig_hashtags || []),
      tiktok_hashtags: cleanHashtags(tiktok_hashtags || []),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
