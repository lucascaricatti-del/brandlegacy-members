import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get('workspace_id')
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
  }

  const { data: integration } = await supabase
    .from('workspace_integrations')
    .select('access_token, metadata')
    .eq('workspace_id', workspaceId)
    .eq('provider', 'meta_ads')
    .single()

  if (!integration) {
    return NextResponse.json({ error: 'Meta not connected' }, { status: 404 })
  }

  const res = await fetch(
    `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_id,currency,account_status&access_token=${integration.access_token}`
  )
  const data = await res.json()

  return NextResponse.json({ accounts: data.data || [] })
}
