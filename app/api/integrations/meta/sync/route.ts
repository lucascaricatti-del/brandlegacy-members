import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function getWeekChunks(since: string, until: string): { since: string; until: string }[] {
  const chunks: { since: string; until: string }[] = []
  const start = new Date(since)
  const end = new Date(until)

  while (start < end) {
    const chunkEnd = new Date(start)
    chunkEnd.setDate(chunkEnd.getDate() + 6)
    if (chunkEnd > end) chunkEnd.setTime(end.getTime())

    chunks.push({
      since: start.toLocaleDateString('sv-SE'),
      until: chunkEnd.toLocaleDateString('sv-SE'),
    })

    start.setDate(start.getDate() + 7)
  }

  return chunks
}

export async function POST(req: NextRequest) {
  const { workspace_id, date_from, date_to } = await req.json()

  if (!workspace_id) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
  }

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

  // Smart sync: if last_sync exists, only sync last 2 days; otherwise full 180 days
  const lastSync = (integration as any).metadata?.last_sync
  const fallbackSince = new Date(Date.now() - 180 * 86400000).toLocaleDateString('sv-SE')
  const smartSince = lastSync
    ? new Date(Date.now() - 2 * 86400000).toLocaleDateString('sv-SE')
    : fallbackSince
  const since = date_from || smartSince
  const until = date_to || new Date().toLocaleDateString('sv-SE')

  console.log(`[meta/sync] smart sync: last_sync=${lastSync || 'none'}, period=${since}→${until}`)

  try {
    const accountIdClean = integration.account_id.replace(/^act_/, '')
    const allRows: any[] = []

    // Split into weekly chunks to avoid "Please reduce the amount of data" error
    const weekChunks = getWeekChunks(since, until)
    console.log(`[meta/sync] splitting into ${weekChunks.length} weekly chunks`)

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
        const pageRes: Response = await fetch(url)
        const data: any = await pageRes.json()

        if (data.error) {
          console.error(`[meta/sync] API error for chunk ${chunk.since}→${chunk.until}:`, JSON.stringify(data.error))
          // If this chunk still fails, skip it and continue with next
          break
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
          console.error(`[meta/sync] insert batch ${i}-${i + batch.length} failed:`, insertError.message)
        }
      }
    }

    // Update last_sync in metadata
    const existingMeta = (integration as any).metadata || {}
    await supabase
      .from('workspace_integrations')
      .update({ metadata: { ...existingMeta, last_sync: new Date().toLocaleDateString('sv-SE') } })
      .eq('workspace_id', workspace_id)
      .eq('provider', 'meta_ads')

    return NextResponse.json({ synced: allRows.length, period: { since, until }, smart: !!lastSync, chunks: weekChunks.length })
  } catch (err: any) {
    console.error('[meta/sync] unexpected error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
