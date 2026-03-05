import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function getAccessToken(integration: any) {
  if (integration.token_expires_at && new Date(integration.token_expires_at) > new Date()) {
    return integration.access_token
  }
  if (!integration.refresh_token) return null
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: integration.refresh_token,
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (data.error) {
    console.error('[google-ads/sync] refresh token failed:', JSON.stringify(data.error))
    return null
  }
  await supabase.from('workspace_integrations').update({
    access_token: data.access_token,
    token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  }).eq('workspace_id', integration.workspace_id).eq('provider', 'google_ads')
  return data.access_token
}

export async function POST(req: NextRequest) {
  const { workspace_id, date_from, date_to } = await req.json()
  if (!workspace_id) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })

  const { data: integration } = await supabase
    .from('workspace_integrations')
    .select('*')
    .eq('workspace_id', workspace_id)
    .eq('provider', 'google_ads')
    .eq('status', 'active')
    .single()

  if (!integration?.account_id) return NextResponse.json({ error: 'Google Ads not connected' }, { status: 404 })

  const accessToken = await getAccessToken(integration)
  if (!accessToken) return NextResponse.json({ error: 'Token expired, reconnect' }, { status: 401 })

  // Smart sync: if last_sync exists, always re-fetch last 3 days; otherwise full 180 days
  const lastSync = (integration as any).metadata?.last_sync
  const fallbackSince = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10)
  const smartSince = lastSync
    ? new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10)
    : fallbackSince
  const since = date_from || smartSince
  const until = date_to || new Date().toISOString().slice(0, 10)

  console.log(`[google-ads/sync] smart sync: last_sync=${lastSync || 'none'}, period=${since}→${until}`)

  const customerId = integration.account_id.replace(/-/g, '')
  const loginCustomerId = process.env.GOOGLE_ADS_MCC_ID?.replace(/-/g, '') || customerId

  try {
    const query = `SELECT campaign.id, campaign.name, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value, metrics.ctr, metrics.average_cpc, metrics.average_cpm, segments.date FROM campaign WHERE segments.date BETWEEN '${since}' AND '${until}' AND campaign.status != 'REMOVED' ORDER BY segments.date`

    const searchRes = await fetch(
      `https://googleads.googleapis.com/v23/customers/${customerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
          'login-customer-id': loginCustomerId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      }
    )
    const searchData = await searchRes.json()

    if (searchData.error) {
      console.error('[google-ads/sync] API error:', JSON.stringify(searchData.error), { customerId, loginCustomerId })
      return NextResponse.json({ error: searchData.error.message }, { status: 400 })
    }

    const results = searchData[0]?.results ?? searchData.results ?? []
    const rows = results.map((r: any) => {
      const spend = (r.metrics?.costMicros || 0) / 1_000_000
      const revenue = parseFloat(r.metrics?.conversionsValue || '0')
      return {
        workspace_id, provider: 'google_ads', date: r.segments?.date,
        campaign_id: r.campaign?.id?.toString(), campaign_name: r.campaign?.name,
        adset_id: null, adset_name: null, spend,
        impressions: parseInt(r.metrics?.impressions || '0'),
        clicks: parseInt(r.metrics?.clicks || '0'),
        conversions: Math.round(parseFloat(r.metrics?.conversions || '0')),
        revenue, cpm: (r.metrics?.averageCpm || 0) / 1_000_000,
        cpc: (r.metrics?.averageCpc || 0) / 1_000_000,
        ctr: parseFloat(r.metrics?.ctr || '0') * 100,
        roas: spend > 0 ? revenue / spend : 0,
        synced_at: new Date().toISOString(),
      }
    }).filter((r: any) => r.date && r.campaign_id)

    if (rows.length > 0) {
      await supabase
        .from('ads_metrics')
        .delete()
        .eq('workspace_id', workspace_id)
        .eq('provider', 'google_ads')
        .gte('date', since)
        .lte('date', until)
      await supabase.from('ads_metrics').insert(rows)
    }

    // Update last_sync in metadata
    const existingMeta = (integration as any).metadata || {}
    await supabase
      .from('workspace_integrations')
      .update({ metadata: { ...existingMeta, last_sync: new Date().toLocaleDateString('sv-SE') } })
      .eq('workspace_id', workspace_id)
      .eq('provider', 'google_ads')

    console.log(`[google-ads/sync] OK: ${rows.length} rows synced for workspace ${workspace_id}`)
    return NextResponse.json({ synced: rows.length, period: { since, until }, smart: !!lastSync })
  } catch (err: any) {
    console.error('[google-ads/sync] unexpected error:', err.message, err.stack)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
