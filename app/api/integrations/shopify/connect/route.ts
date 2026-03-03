import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get('workspace_id')
  const shop = req.nextUrl.searchParams.get('shop')

  if (!workspaceId || !shop) {
    return NextResponse.json({ error: 'workspace_id and shop required' }, { status: 400 })
  }

  const domain = shop.includes('.myshopify.com') ? shop : `${shop}.myshopify.com`

  const params = new URLSearchParams({
    client_id: process.env.SHOPIFY_CLIENT_ID!,
    scope: 'read_orders,read_analytics',
    redirect_uri: `${req.nextUrl.origin}/api/integrations/shopify/callback`,
    state: workspaceId,
  })

  return NextResponse.redirect(
    `https://${domain}/admin/oauth/authorize?${params.toString()}`
  )
}
