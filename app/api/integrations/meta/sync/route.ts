import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWorkspaceAccess } from '@/lib/api-auth'

export const maxDuration = 300 // 5 min (Vercel Pro)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function getDateChunks(since: string, until: string): { since: string; until: string }[] {
  const chunks: { since: string; until: string }[] = []
  const start = new Date(since + 'T00:00:00Z')
  const end = new Date(until + 'T00:00:00Z')
  const chunkDays = 30

  while (start <= end) {
    const chunkEnd = new Date(start)
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + chunkDays - 1)
    if (chunkEnd > end) chunkEnd.setTime(end.getTime())

    chunks.push({
      since: toYMD(start),
      until: toYMD(chunkEnd),
    })

    start.setUTCDate(start.getUTCDate() + chunkDays)
  }

  return chunks
}

// Fetch all pages for a single date chunk from Meta API
async function fetchChunk(
  chunk: { since: string; until: string },
  accountIdClean: string,
  accessToken: string,
  workspace_id: string,
): Promise<any[]> {
  const rows: any[] = []
  let url: string | null =
    `https://graph.facebook.com/v22.0/act_${accountIdClean}/insights?` +
    `fields=campaign_id,campaign_name,adset_id,adset_name,spend,impressions,clicks,actions,action_values` +
    `&time_range={"since":"${chunk.since}","until":"${chunk.until}"}` +
    `&time_increment=1` +
    `&level=campaign` +
    `&limit=500` +
    `&access_token=${accessToken}`

  while (url) {
    const pageRes: Response = await fetch(url)
    const data: any = await pageRes.json()

    if (data.error) {
      const urlForLog = url.replace(/access_token=[^&]+/, 'access_token=REDACTED')
      const metaError = {
        url_called: urlForLog,
        http_status: pageRes.status,
        chunk: `${chunk.since}→${chunk.until}`,
        error_type: data.error.type,
        error_code: data.error.code,
        error_subcode: data.error.error_subcode,
        message: data.error.message,
        fbtrace_id: data.error.fbtrace_id,
      }
      console.error(`[meta/sync] META API ERROR:`, JSON.stringify(metaError, null, 2))
      throw metaError
    }

    rows.push(...(data.data || []).map((row: any) => {
      const actions = row.actions || []
      const purchases = actions.find((a: any) => a.action_type === 'purchase')
      const purchaseValue = row.action_values?.find((a: any) => a.action_type === 'purchase')
      const pageViews = actions.find((a: any) => a.action_type === 'landing_page_view') || actions.find((a: any) => a.action_type === 'page_view')
      const outboundClicks = actions.find((a: any) => a.action_type === 'link_click')
      const addToCart = actions.find((a: any) => a.action_type === 'add_to_cart')
      const initiateCheckout = actions.find((a: any) => a.action_type === 'initiate_checkout')
      const addPaymentInfo = actions.find((a: any) => a.action_type === 'add_payment_info')
      const spend = parseFloat(row.spend || '0')
      const impressions = parseInt(row.impressions || '0')
      const clicks = parseInt(row.clicks || '0')
      const revenue = parseFloat(purchaseValue?.value || '0')

      return {
        workspace_id,
        provider: 'meta_ads',
        date: row.date_start,
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name,
        adset_id: row.adset_id || null,
        adset_name: row.adset_name || null,
        spend,
        impressions,
        clicks,
        conversions: parseInt(purchases?.value || '0'),
        revenue,
        cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
        cpc: clicks > 0 ? spend / clicks : 0,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        roas: spend > 0 ? revenue / spend : 0,
        page_views: parseInt(pageViews?.value || '0'),
        outbound_clicks: parseInt(outboundClicks?.value || '0'),
        add_to_cart: parseInt(addToCart?.value || '0'),
        initiate_checkout: parseInt(initiateCheckout?.value || '0'),
        add_payment_info: parseInt(addPaymentInfo?.value || '0'),
        synced_at: new Date().toISOString(),
      }
    }))

    url = data.paging?.next ?? null
  }

  return rows
}

export async function POST(req: NextRequest) {
  const { workspace_id, date_from, date_to, force } = await req.json()

  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data: integration } = await supabase
    .from('workspace_integrations')
    .select('access_token, account_id, metadata')
    .eq('workspace_id', workspace_id)
    .eq('provider', 'meta_ads')
    .eq('status', 'active')
    .single()

  if (!integration?.account_id) {
    return NextResponse.json({ error: 'Meta not connected or no account' }, { status: 404 })
  }

  // 2-hour cache: skip sync if last sync was recent (unless force=true or custom dates)
  const lastSyncTs = (integration as any).metadata?.last_sync_ts
  if (!force && !date_from && lastSyncTs && Date.now() - Number(lastSyncTs) < 2 * 60 * 60 * 1000) {
    return NextResponse.json({
      cached: true,
      last_sync: (integration as any).metadata?.last_sync,
      message: 'Last sync was less than 2 hours ago',
    })
  }

  // Smart sync: re-fetch last 3 days if previously synced, else full 180 days
  const lastSync = (integration as any).metadata?.last_sync
  const fallbackSince = toYMD(new Date(Date.now() - 180 * 86400000))
  const smartSince = lastSync
    ? toYMD(new Date(Date.now() - 3 * 86400000))
    : fallbackSince
  const since = date_from || smartSince
  const until = date_to || toYMD(new Date())

  console.log(`[meta/sync] smart sync: last_sync=${lastSync || 'none'}, period=${since}→${until}`)

  try {
    const accountIdClean = integration.account_id.replace(/^act_/, '')
    const chunks = getDateChunks(since, until)

    // Fetch all chunks in parallel
    const results = await Promise.all(
      chunks.map(chunk => fetchChunk(chunk, accountIdClean, integration.access_token, workspace_id))
    )
    const allRows = results.flat()

    if (allRows.length > 0) {
      // Delete existing rows in range then insert
      await supabase
        .from('ads_metrics')
        .delete()
        .eq('workspace_id', workspace_id)
        .eq('provider', 'meta_ads')
        .gte('date', since)
        .lte('date', until)

      for (let i = 0; i < allRows.length; i += 500) {
        const batch = allRows.slice(i, i + 500)
        const { error: insertError } = await supabase.from('ads_metrics').insert(batch)
        if (insertError) {
          console.error(`[meta/sync] insert batch error:`, insertError.message)
        }
      }
    }

    // Update last_sync + last_sync_ts in metadata
    const existingMeta = (integration as any).metadata || {}
    await supabase
      .from('workspace_integrations')
      .update({ metadata: { ...existingMeta, last_sync: toYMD(new Date()), last_sync_ts: Date.now() } })
      .eq('workspace_id', workspace_id)
      .eq('provider', 'meta_ads')

    return NextResponse.json({ synced: allRows.length, period: { since, until }, smart: !!lastSync, chunks: chunks.length })
  } catch (err: any) {
    // If it's a Meta API error object (thrown from fetchChunk)
    if (err.error_type) {
      return NextResponse.json({ error: 'Meta API error', meta_error: err }, { status: 502 })
    }
    console.error('[meta/sync] unexpected error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
