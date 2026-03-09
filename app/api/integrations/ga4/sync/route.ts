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
    console.error('[ga4/sync] refresh token failed:', JSON.stringify(data.error))
    return null
  }
  await supabase.from('workspace_integrations').update({
    access_token: data.access_token,
    token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  }).eq('workspace_id', integration.workspace_id).eq('provider', 'google_ads')
  return data.access_token
}

const CHANNEL_MAP: Record<string, string> = {
  'Organic Search': 'organic_sessions',
  'Paid Search': 'paid_sessions',
  'Direct': 'direct_sessions',
  'Organic Social': 'social_sessions',
  'Paid Social': 'social_sessions',
}

export async function POST(req: NextRequest) {
  const { workspace_id } = await req.json()
  if (!workspace_id) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })

  const { data: integration } = await supabase
    .from('workspace_integrations')
    .select('*')
    .eq('workspace_id', workspace_id)
    .eq('provider', 'google_ads')
    .single()

  if (!integration) return NextResponse.json({ error: 'Google not connected' }, { status: 404 })

  const metadata = (integration as any).metadata || {}
  const propertyId = metadata.ga4_property_id

  if (!propertyId) {
    return NextResponse.json({ error: 'GA4 property not configured. Select a property first.' }, { status: 400 })
  }

  const accessToken = await getAccessToken(integration)
  if (!accessToken) return NextResponse.json({ error: 'Token expired, reconnect Google' }, { status: 401 })

  // Smart sync: if last_ga4_sync exists → last 3 days, else → last 90 days
  const lastSync = metadata.last_ga4_sync
  const since = lastSync
    ? new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10)
    : new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
  const until = new Date().toISOString().slice(0, 10)

  console.log(`[ga4/sync] property=${propertyId}, period=${since}→${until}, smart=${!!lastSync}`)

  try {
    const reportRes = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: since, endDate: until }],
          dimensions: [
            { name: 'date' },
            { name: 'sessionDefaultChannelGrouping' },
          ],
          metrics: [
            { name: 'sessions' },
            { name: 'totalUsers' },
            { name: 'newUsers' },
          ],
          limit: 10000,
        }),
      }
    )

    if (!reportRes.ok) {
      const errData = await reportRes.json().catch(() => ({}))
      const errMsg = (errData as any).error?.message || `GA4 API error (${reportRes.status})`
      console.error('[ga4/sync] API error:', errMsg)
      return NextResponse.json({ error: errMsg }, { status: reportRes.status })
    }

    const reportData = await reportRes.json()
    const rows = reportData.rows ?? []

    // Aggregate by date
    const dateMap = new Map<string, {
      sessions: number; organic_sessions: number; paid_sessions: number
      direct_sessions: number; social_sessions: number; users: number; new_users: number
    }>()

    for (const row of rows) {
      const rawDate = row.dimensionValues?.[0]?.value ?? '' // YYYYMMDD
      const channel = row.dimensionValues?.[1]?.value ?? ''
      const sessions = parseInt(row.metricValues?.[0]?.value ?? '0')
      const users = parseInt(row.metricValues?.[1]?.value ?? '0')
      const newUsers = parseInt(row.metricValues?.[2]?.value ?? '0')

      // Convert YYYYMMDD to YYYY-MM-DD
      const date = rawDate.length === 8
        ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
        : rawDate

      if (!date || date.length !== 10) continue

      const existing = dateMap.get(date) || {
        sessions: 0, organic_sessions: 0, paid_sessions: 0,
        direct_sessions: 0, social_sessions: 0, users: 0, new_users: 0,
      }

      existing.sessions += sessions
      existing.users += users
      existing.new_users += newUsers

      const field = CHANNEL_MAP[channel]
      if (field) {
        (existing as any)[field] += sessions
      }

      dateMap.set(date, existing)
    }

    // Upsert into ga4_metrics
    const upsertRows = Array.from(dateMap.entries()).map(([date, data]) => ({
      workspace_id,
      date,
      ...data,
      updated_at: new Date().toISOString(),
    }))

    if (upsertRows.length > 0) {
      // Delete existing rows for the period, then insert
      await supabase
        .from('ga4_metrics')
        .delete()
        .eq('workspace_id', workspace_id)
        .gte('date', since)
        .lte('date', until)

      const { error: insertErr } = await supabase.from('ga4_metrics').insert(upsertRows)
      if (insertErr) {
        console.error('[ga4/sync] insert error:', insertErr.message)
        return NextResponse.json({ error: insertErr.message }, { status: 500 })
      }
    }

    // Update last_ga4_sync in metadata
    await supabase
      .from('workspace_integrations')
      .update({
        metadata: { ...metadata, last_ga4_sync: new Date().toLocaleDateString('sv-SE') },
      })
      .eq('workspace_id', workspace_id)
      .eq('provider', 'google_ads')

    console.log(`[ga4/sync] OK: ${upsertRows.length} days synced for workspace ${workspace_id}`)
    return NextResponse.json({
      synced_days: upsertRows.length,
      date_range: { since, until },
      smart: !!lastSync,
    })
  } catch (err: any) {
    console.error('[ga4/sync] unexpected error:', err.message, err.stack)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
