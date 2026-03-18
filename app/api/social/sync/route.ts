import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWorkspaceAccess } from '@/lib/api-auth'
import { callInstagramGraph } from '@/lib/instagram-graph'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const SIX_HOURS_MS = 6 * 60 * 60 * 1000

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { workspace_id } = body

  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  // 1. Get access_token and ig_user_id from workspace_integrations
  const { data: integration, error: intError } = await (adminSupabase as any)
    .from('workspace_integrations')
    .select('access_token, metadata, status')
    .eq('workspace_id', workspace_id)
    .eq('provider', 'meta_ads')
    .single()

  if (intError || !integration) {
    return NextResponse.json({ error: 'Meta Ads integration not found' }, { status: 404 })
  }
  if (integration.status !== 'active') {
    return NextResponse.json({ error: 'Integration is disconnected' }, { status: 400 })
  }

  const accessToken = integration.access_token
  const igUserId = integration.metadata?.ig_user_id
  if (!igUserId) {
    return NextResponse.json({
      error: 'IG Business Account not found. Reconnect Meta integration.',
    }, { status: 400 })
  }

  // 2. Get social listening config
  const { data: config } = await (adminSupabase as any)
    .from('social_listening_config')
    .select('*')
    .eq('workspace_id', workspace_id)
    .single()

  // 3. Smart sync: skip if last sync < 6h ago
  const now = new Date()
  if (config?.last_sync_mentions) {
    const lastSync = new Date(config.last_sync_mentions)
    if (now.getTime() - lastSync.getTime() < SIX_HOURS_MS) {
      return NextResponse.json({
        message: 'Sync skipped — last sync was less than 6 hours ago',
        last_sync: config.last_sync_mentions,
      })
    }
  }

  const mentionsToUpsert: any[] = []
  let syncError: string | null = null

  try {
    // 4. Fetch mentions by @handle (tagged media)
    try {
      const taggedRes = await callInstagramGraph(
        `/${igUserId}/tags`,
        accessToken,
        {
          fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,username,like_count,comments_count',
        }
      )
      const taggedMedia = taggedRes.data || []
      for (const media of taggedMedia) {
        mentionsToUpsert.push({
          workspace_id,
          platform: 'instagram',
          media_id: media.id,
          media_type: media.media_type?.toLowerCase() || null,
          media_url: media.media_url || null,
          thumbnail_url: media.thumbnail_url || null,
          permalink: media.permalink || null,
          caption: media.caption || null,
          username: media.username || null,
          mention_type: 'tag',
          hashtag: null,
          like_count: media.like_count || 0,
          comments_count: media.comments_count || 0,
          timestamp: media.timestamp || now.toISOString(),
          updated_at: now.toISOString(),
        })
      }
    } catch (err: any) {
      if (err.message === 'TOKEN_EXPIRED') throw err
      if (err.message === 'PERMISSIONS_PENDING') {
        syncError = 'PERMISSIONS_PENDING'
      } else {
        console.warn('[sync] Error fetching tagged media:', err.message)
      }
    }

    // 5. Fetch hashtag mentions
    const igHashtags = config?.ig_hashtags || []
    for (const hashtag of igHashtags) {
      try {
        // Search for hashtag ID
        const hashSearch = await callInstagramGraph(
          '/ig_hashtag_search',
          accessToken,
          { q: hashtag, user_id: igUserId }
        )
        const hashtagId = hashSearch.data?.[0]?.id
        if (!hashtagId) continue

        // Get recent media for this hashtag
        const recentRes = await callInstagramGraph(
          `/${hashtagId}/recent_media`,
          accessToken,
          {
            user_id: igUserId,
            fields: 'id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count',
          }
        )
        const recentMedia = recentRes.data || []
        for (const media of recentMedia) {
          mentionsToUpsert.push({
            workspace_id,
            platform: 'instagram',
            media_id: media.id,
            media_type: media.media_type?.toLowerCase() || null,
            media_url: media.media_url || null,
            thumbnail_url: media.thumbnail_url || null,
            permalink: media.permalink || null,
            caption: media.caption || null,
            username: media.username || null,
            mention_type: 'hashtag',
            hashtag,
            like_count: media.like_count || 0,
            comments_count: media.comments_count || 0,
            timestamp: media.timestamp || now.toISOString(),
            updated_at: now.toISOString(),
          })
        }
      } catch (err: any) {
        if (err.message === 'TOKEN_EXPIRED') throw err
        console.warn(`[sync] Error fetching hashtag #${hashtag}:`, err.message)
      }
    }

    // 6. Upsert mentions (batch)
    if (mentionsToUpsert.length > 0) {
      const { error: upsertError } = await (adminSupabase as any)
        .from('social_mentions')
        .upsert(mentionsToUpsert, {
          onConflict: 'workspace_id,platform,media_id',
          ignoreDuplicates: false,
        })

      if (upsertError) {
        console.error('[sync] Upsert error:', upsertError.message)
      }
    }

    // 7. Update last sync timestamps
    await (adminSupabase as any)
      .from('social_listening_config')
      .upsert({
        workspace_id,
        last_sync_mentions: now.toISOString(),
        last_sync_hashtags: igHashtags.length > 0 ? now.toISOString() : (config?.last_sync_hashtags || null),
        updated_at: now.toISOString(),
      }, { onConflict: 'workspace_id' })

    if (syncError === 'PERMISSIONS_PENDING') {
      return NextResponse.json({
        error: 'PERMISSIONS_PENDING',
        synced: mentionsToUpsert.length,
      }, { status: 403 })
    }

    return NextResponse.json({
      message: 'Sync completed',
      synced: mentionsToUpsert.length,
    })
  } catch (err: any) {
    // Token expired — mark integration as disconnected
    if (err.message === 'TOKEN_EXPIRED') {
      await (adminSupabase as any)
        .from('workspace_integrations')
        .update({ status: 'disconnected', updated_at: now.toISOString() })
        .eq('workspace_id', workspace_id)
        .eq('provider', 'meta_ads')

      return NextResponse.json({ error: 'TOKEN_EXPIRED' }, { status: 401 })
    }

    console.error('[sync] Unexpected error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
