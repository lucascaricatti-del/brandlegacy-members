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
    return NextResponse.redirect(`${req.nextUrl.origin}/integracoes?error=missing_params`)
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
        client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
        redirect_uri: `${req.nextUrl.origin}/api/integrations/google-ads/callback`,
        grant_type: 'authorization_code',
      }),
    })
    const tokenData = await tokenRes.json()

    if (tokenData.error) {
      console.error('Google OAuth error:', tokenData)
      return NextResponse.redirect(`${req.nextUrl.origin}/integracoes?error=oauth_failed`)
    }

    const customersRes = await fetch(
      'https://googleads.googleapis.com/v18/customers:listAccessibleCustomers',
      {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
        },
      }
    )
    const customersData = await customersRes.json()
    const resourceNames: string[] = customersData.resourceNames ?? []

    const accounts: any[] = []
    for (const rn of resourceNames.slice(0, 20)) {
      const customerId = rn.replace('customers/', '')
      try {
        const detailRes = await fetch(
          `https://googleads.googleapis.com/v18/customers/${customerId}`,
          {
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
              'login-customer-id': customerId,
            },
          }
        )
        const detail = await detailRes.json()
        if (detail.descriptiveName) {
          accounts.push({
            customer_id: customerId,
            name: detail.descriptiveName,
            currency: detail.currencyCode || 'BRL',
            is_manager: detail.manager || false,
          })
        }
      } catch {}
    }

    const firstAccount = accounts.find(a => !a.is_manager) || accounts[0]

    await supabase.from('workspace_integrations').upsert({
      workspace_id: workspaceId,
      provider: 'google_ads',
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      token_expires_at: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString(),
      account_id: firstAccount?.customer_id || null,
      account_name: firstAccount?.name || null,
      status: 'active',
      metadata: { accounts, currency: firstAccount?.currency || 'BRL' },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id,provider' })

    return NextResponse.redirect(`${req.nextUrl.origin}/integracoes?google=connected`)
  } catch (err) {
    console.error('Google callback error:', err)
    return NextResponse.redirect(`${req.nextUrl.origin}/integracoes?error=callback_failed`)
  }
}
