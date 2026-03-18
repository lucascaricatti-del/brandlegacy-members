import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const workspaceId = req.nextUrl.searchParams.get('state')

  if (!code || !workspaceId) {
    return NextResponse.redirect(`${req.nextUrl.origin}/metricas?error=missing_params`)
  }

  try {
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
      `client_id=${process.env.FACEBOOK_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(req.nextUrl.origin + '/api/integrations/meta/callback')}` +
      `&client_secret=${process.env.FACEBOOK_APP_SECRET}` +
      `&code=${code}`
    )
    const tokenData = await tokenRes.json()

    if (tokenData.error) {
      console.error('Meta OAuth error:', tokenData.error)
      return NextResponse.redirect(`${req.nextUrl.origin}/metricas?error=oauth_failed`)
    }

    const longTokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
      `grant_type=fb_exchange_token` +
      `&client_id=${process.env.FACEBOOK_APP_ID}` +
      `&client_secret=${process.env.FACEBOOK_APP_SECRET}` +
      `&fb_exchange_token=${tokenData.access_token}`
    )
    const longTokenData = await longTokenRes.json()
    const accessToken = longTokenData.access_token || tokenData.access_token
    const expiresIn = longTokenData.expires_in || 5184000

    const accountsRes = await fetch(
      `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_id,currency&access_token=${accessToken}`
    )
    const accountsData = await accountsRes.json()
    const firstAccount = accountsData.data?.[0]

    // Buscar IG Business Account ID via Pages
    let igUserId: string | null = null
    try {
      const pagesRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?access_token=${accessToken}`
      )
      const pagesData = await pagesRes.json()
      const pages = pagesData.data || []

      for (const page of pages) {
        const igRes = await fetch(
          `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account&access_token=${accessToken}`
        )
        const igData = await igRes.json()
        if (igData.instagram_business_account?.id) {
          igUserId = igData.instagram_business_account.id
          break
        }
      }
    } catch (igErr) {
      console.warn('Failed to fetch IG Business Account:', igErr)
    }

    await supabase.from('workspace_integrations').upsert({
      workspace_id: workspaceId,
      provider: 'meta_ads',
      access_token: accessToken,
      token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      account_id: firstAccount?.account_id || null,
      account_name: firstAccount?.name || null,
      status: 'active',
      metadata: {
        accounts: accountsData.data || [],
        currency: firstAccount?.currency || 'BRL',
        ig_user_id: igUserId,
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id,provider' })

    return NextResponse.redirect(`${req.nextUrl.origin}/metricas?meta=connected`)
  } catch (err) {
    console.error('Meta callback error:', err)
    return NextResponse.redirect(`${req.nextUrl.origin}/metricas?error=callback_failed`)
  }
}
