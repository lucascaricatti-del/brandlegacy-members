import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get('workspace_id')
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
  }

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
    redirect_uri: `${req.nextUrl.origin}/api/integrations/google-ads/callback`,
    scope: 'https://www.googleapis.com/auth/adwords',
    state: workspaceId,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
  })

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  )
}
