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
  if (data.error) return null
  await supabase.from('workspace_integrations').update({
    access_token: data.access_token,
    token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  }).eq('workspace_id', integration.workspace_id).eq('provider', 'google_ads')
  return data.access_token
}

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get('workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })

  const { data: integration } = await supabase
    .from('workspace_integrations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('provider', 'google_ads')
    .single()

  if (!integration) return NextResponse.json({ error: 'Google not connected' }, { status: 404 })

  const accessToken = await getAccessToken(integration)
  if (!accessToken) return NextResponse.json({ error: 'Token expired, reconnect Google' }, { status: 401 })

  try {
    const res = await fetch(
      'https://analyticsadmin.googleapis.com/v1beta/accountSummaries',
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      if (res.status === 403) {
        return NextResponse.json({
          error: 'Analytics scope not authorized. Reconnect Google to grant GA4 access.',
          needs_reconnect: true,
        }, { status: 403 })
      }
      return NextResponse.json({ error: (err as any).error?.message || 'GA4 API error' }, { status: res.status })
    }

    const data = await res.json()
    const properties: { property_id: string; display_name: string; account_name: string }[] = []

    for (const acct of data.accountSummaries ?? []) {
      for (const prop of acct.propertySummaries ?? []) {
        properties.push({
          property_id: prop.property?.replace('properties/', '') || '',
          display_name: prop.displayName || 'Unknown',
          account_name: acct.displayName || 'Unknown',
        })
      }
    }

    return NextResponse.json({ properties })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
