import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const shop = req.nextUrl.searchParams.get('shop')
  const workspaceId = req.nextUrl.searchParams.get('state')

  if (!code || !shop || !workspaceId) {
    return NextResponse.redirect(`${req.nextUrl.origin}/integracoes?error=missing_params`)
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_CLIENT_ID,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET,
        code,
      }),
    })
    const tokenData = await tokenRes.json()

    if (!tokenData.access_token) {
      console.error('[shopify/callback] token exchange failed:', tokenData)
      return NextResponse.redirect(`${req.nextUrl.origin}/integracoes?error=oauth_failed`)
    }

    // Fetch shop name
    let shopName = shop
    try {
      const shopRes = await fetch(`https://${shop}/admin/api/2026-01/shop.json`, {
        headers: { 'X-Shopify-Access-Token': tokenData.access_token },
      })
      const shopData = await shopRes.json()
      shopName = shopData.shop?.name || shop
    } catch {
      // fallback to shop domain
    }

    // Save integration
    await supabase.from('workspace_integrations').upsert({
      workspace_id: workspaceId,
      provider: 'shopify',
      access_token: tokenData.access_token,
      account_id: shop,
      account_name: shopName,
      status: 'active',
      metadata: { scope: tokenData.scope },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id,provider' })

    return NextResponse.redirect(`${req.nextUrl.origin}/integracoes?shopify=connected`)
  } catch (err) {
    console.error('[shopify/callback] error:', err)
    return NextResponse.redirect(`${req.nextUrl.origin}/integracoes?error=callback_failed`)
  }
}
