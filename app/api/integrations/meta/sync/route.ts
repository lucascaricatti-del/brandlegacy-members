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

  // Use 30-day chunks to stay within Meta API limits while not creating too many requests
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

export async function POST(req: NextRequest) {
  const { workspace_id, date_from, date_to } = await req.json()

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

  // Smart sync: if last_sync exists, always re-fetch last 3 days (Meta has 48h attribution delay);
  // otherwise full 180 days for first sync
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
    const allRows: any[] = []

    // Split into weekly chunks to avoid "Please reduce the amount of data" error
    const weekChunks = getDateChunks(since, until)
    for (const chunk of weekChunks) {
      let url: string | null =
        `https://graph.facebook.com/v22.0/act_${accountIdClean}/insights?` +
        `fields=campaign_id,campaign_name,adset_id,adset_name,spend,impressions,clicks,actions,action_values,cpm,cpc,ctr` +
        `&time_range={"since":"${chunk.since}","until":"${chunk.until}"}` +
        `&time_increment=1` +
        `&level=campaign` +
        `&limit=100` +
        `&access_token=${integration.access_token}`

      while (url) {
        const urlForLog = url.replace(/access_token=[^&]+/, 'access_token=REDACTED')

        const pageRes: Response = await fetch(url)
        const data: any = await pageRes.json()

        if (data.error) {
          const metaError = {
            url_called: urlForLog,
            http_status: pageRes.status,
            chunk: `${chunk.since}→${chunk.until}`,
            error_type: data.error.type,
            error_code: data.error.code,
            error_subcode: data.error.error_subcode,
            message: data.error.message,
            error_user_title: data.error.error_user_title,
            error_user_msg: data.error.error_user_msg,
            fbtrace_id: data.error.fbtrace_id,
            full_error: data.error,
          }
          console.error(`[meta/sync] META API ERROR:`, JSON.stringify(metaError, null, 2))
          return NextResponse.json({ error: 'Meta API error', meta_error: metaError }, { status: 502 })
        }

        const pageRows = (data.data || []).map((row: any) => {
          const actions = row.actions || []
          const purchases = actions.find((a: any) => a.action_type === 'purchase')
          const purchaseValue = row.action_values?.find((a: any) => a.action_type === 'purchase')
          const pageViews = actions.find((a: any) => a.action_type === 'landing_page_view') || actions.find((a: any) => a.action_type === 'page_view')
          const outboundClicks = actions.find((a: any) => a.action_type === 'link_click')
          const addToCart = actions.find((a: any) => a.action_type === 'add_to_cart')
          const initiateCheckout = actions.find((a: any) => a.action_type === 'initiate_checkout')
          const addPaymentInfo = actions.find((a: any) => a.action_type === 'add_payment_info')
          const spend = parseFloat(row.spend || '0')
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
            impressions: parseInt(row.impressions || '0'),
            clicks: parseInt(row.clicks || '0'),
            conversions: parseInt(purchases?.value || '0'),
            revenue,
            cpm: parseFloat(row.cpm || '0'),
            cpc: parseFloat(row.cpc || '0'),
            ctr: parseFloat(row.ctr || '0'),
            roas: spend > 0 ? revenue / spend : 0,
            page_views: parseInt(pageViews?.value || '0'),
            outbound_clicks: parseInt(outboundClicks?.value || '0'),
            add_to_cart: parseInt(addToCart?.value || '0'),
            initiate_checkout: parseInt(initiateCheckout?.value || '0'),
            add_payment_info: parseInt(addPaymentInfo?.value || '0'),
            synced_at: new Date().toISOString(),
          }
        })

        allRows.push(...pageRows)
        url = data.paging?.next ?? null
      }
    }

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

    // Update last_sync in metadata
    const existingMeta = (integration as any).metadata || {}
    await supabase
      .from('workspace_integrations')
      .update({ metadata: { ...existingMeta, last_sync: toYMD(new Date()) } })
      .eq('workspace_id', workspace_id)
      .eq('provider', 'meta_ads')

    return NextResponse.json({ synced: allRows.length, period: { since, until }, smart: !!lastSync, chunks: weekChunks.length })
  } catch (err: any) {
    console.error('[meta/sync] unexpected error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
