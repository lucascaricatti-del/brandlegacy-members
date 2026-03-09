import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWorkspaceAccess } from '@/lib/api-auth'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest) {
  const workspace_id = req.nextUrl.searchParams.get('workspace_id')
  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const date_from = req.nextUrl.searchParams.get('date_from')
  const date_to = req.nextUrl.searchParams.get('date_to')
  if (!date_from || !date_to) {
    return NextResponse.json({ error: 'date_from, date_to required' }, { status: 400 })
  }

  // Get Google integration with GA4 property
  const { data: integration } = await (adminSupabase as any)
    .from('workspace_integrations')
    .select('access_token, refresh_token, token_expires_at, metadata')
    .eq('workspace_id', workspace_id)
    .eq('provider', 'google_ads')
    .single()

  if (!integration) {
    return NextResponse.json({ error: 'Google not connected' }, { status: 404 })
  }

  const ga4PropertyId = integration.metadata?.ga4_property_id
  if (!ga4PropertyId) {
    return NextResponse.json({ error: 'GA4 property not configured' }, { status: 404 })
  }

  // Get influencers with utm_source
  const { data: influencers } = await (adminSupabase as any)
    .from('influencers')
    .select('id, name, utm_source, coupon_code')
    .eq('workspace_id', workspace_id)
    .not('utm_source', 'is', null)

  if (!influencers || influencers.length === 0) {
    return NextResponse.json({ attribution: [] })
  }

  // Refresh token if expired
  let accessToken = integration.access_token
  if (integration.token_expires_at && new Date(integration.token_expires_at) < new Date()) {
    if (integration.refresh_token) {
      try {
        const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
            client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
            refresh_token: integration.refresh_token,
            grant_type: 'refresh_token',
          }),
        })
        const refreshData = await refreshRes.json()
        if (refreshData.access_token) {
          accessToken = refreshData.access_token
          await (adminSupabase as any)
            .from('workspace_integrations')
            .update({
              access_token: accessToken,
              token_expires_at: new Date(Date.now() + (refreshData.expires_in || 3600) * 1000).toISOString(),
            })
            .eq('workspace_id', workspace_id)
            .eq('provider', 'google_ads')
        }
      } catch (e: any) {
        console.error('[GA4-Attribution] Token refresh error:', e.message)
      }
    }
  }

  // Collect unique utm_source values
  const sources = [...new Set(influencers.map((i: any) => i.utm_source as string))]

  // Run GA4 report with sessionSource dimension
  try {
    const reportRes = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${ga4PropertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: date_from, endDate: date_to }],
          dimensions: [{ name: 'sessionSource' }],
          metrics: [
            { name: 'sessions' },
            { name: 'conversions' },
          ],
          dimensionFilter: {
            filter: {
              fieldName: 'sessionSource',
              inListFilter: {
                values: sources,
              },
            },
          },
        }),
      }
    )

    if (!reportRes.ok) {
      const errText = await reportRes.text()
      console.error('[GA4-Attribution] Report error:', reportRes.status, errText.slice(0, 500))
      return NextResponse.json({ attribution: [], error: 'ga4_report_failed' })
    }

    const reportData = await reportRes.json()
    const rows = reportData.rows || []

    // Map GA4 data back to influencers
    const sourceMap = new Map<string, { sessions: number; conversions: number }>()
    for (const row of rows) {
      const source = row.dimensionValues?.[0]?.value
      const sessions = parseInt(row.metricValues?.[0]?.value || '0')
      const conversions = parseInt(row.metricValues?.[1]?.value || '0')
      if (source) {
        sourceMap.set(source, { sessions, conversions })
      }
    }

    const attribution = influencers.map((inf: any) => {
      const ga4 = sourceMap.get(inf.utm_source) || { sessions: 0, conversions: 0 }
      return {
        influencer_id: inf.id,
        utm_source: inf.utm_source,
        sessions: ga4.sessions,
        conversions: ga4.conversions,
        conversion_rate: ga4.sessions > 0 ? Math.round((ga4.conversions / ga4.sessions) * 10000) / 100 : 0,
      }
    })

    return NextResponse.json({ attribution })
  } catch (e: any) {
    console.error('[GA4-Attribution] Exception:', e.message)
    return NextResponse.json({ attribution: [], error: e.message })
  }
}
