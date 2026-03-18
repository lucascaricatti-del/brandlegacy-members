import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWorkspaceAccess } from '@/lib/api-auth'
import { callInstagramGraph } from '@/lib/instagram-graph'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Get the mention
  const { data: mention, error: fetchError } = await (adminSupabase as any)
    .from('social_mentions')
    .select('workspace_id, media_id, platform')
    .eq('id', id)
    .single()

  if (fetchError || !mention) {
    return NextResponse.json({ error: 'Mention not found' }, { status: 404 })
  }

  const auth = await verifyWorkspaceAccess(mention.workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (mention.platform !== 'instagram') {
    return NextResponse.json({ error: 'Only Instagram media refresh is supported' }, { status: 400 })
  }

  // Get access token
  const { data: integration } = await (adminSupabase as any)
    .from('workspace_integrations')
    .select('access_token, status')
    .eq('workspace_id', mention.workspace_id)
    .eq('provider', 'meta_ads')
    .single()

  if (!integration || integration.status !== 'active') {
    return NextResponse.json({ error: 'Meta integration not active' }, { status: 400 })
  }

  try {
    const mediaData = await callInstagramGraph(
      `/${mention.media_id}`,
      integration.access_token,
      { fields: 'media_url,thumbnail_url' }
    )

    // Update stored URLs
    await (adminSupabase as any)
      .from('social_mentions')
      .update({
        media_url: mediaData.media_url || null,
        thumbnail_url: mediaData.thumbnail_url || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    return NextResponse.json({
      media_url: mediaData.media_url || null,
      thumbnail_url: mediaData.thumbnail_url || null,
    })
  } catch (err: any) {
    if (err.message === 'TOKEN_EXPIRED') {
      await (adminSupabase as any)
        .from('workspace_integrations')
        .update({ status: 'disconnected', updated_at: new Date().toISOString() })
        .eq('workspace_id', mention.workspace_id)
        .eq('provider', 'meta_ads')

      return NextResponse.json({ error: 'TOKEN_EXPIRED' }, { status: 401 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
