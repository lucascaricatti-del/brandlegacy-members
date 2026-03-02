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
    // 1. Exchange code for tokens
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
    const tokenText = await tokenRes.text()
    let tokenData: any
    try { tokenData = JSON.parse(tokenText) } catch {
      console.error('Token response not JSON:', tokenText.slice(0, 500))
      return NextResponse.redirect(`${req.nextUrl.origin}/integracoes?error=token_parse_failed`)
    }

    if (tokenData.error) {
      console.error('Google OAuth token error:', tokenData)
      return NextResponse.redirect(`${req.nextUrl.origin}/integracoes?error=oauth_failed`)
    }

    console.log('Google OAuth token obtained successfully')

    // 2. List accessible customers
    let accounts: any[] = []
    try {
      const customersRes = await fetch(
        'https://googleads.googleapis.com/v18/customers:listAccessibleCustomers',
        {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
          },
        }
      )
      const customersText = await customersRes.text()
      console.log('Customers response status:', customersRes.status)
      console.log('Customers response:', customersText.slice(0, 500))

      let customersData: any
      try { customersData = JSON.parse(customersText) } catch {
        console.error('Customers response not JSON:', customersText.slice(0, 500))
        // Save token anyway without accounts
        customersData = { resourceNames: [] }
      }

      const resourceNames: string[] = customersData.resourceNames ?? []

      for (const rn of resourceNames.slice(0, 10)) {
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
          if (detailRes.ok) {
            const detail = await detailRes.json()
            accounts.push({
              customer_id: customerId,
              name: detail.descriptiveName || `Account ${customerId}`,
              currency: detail.currencyCode || 'BRL',
              is_manager: detail.manager || false,
            })
          }
        } catch (e) {
          console.error(`Error fetching customer ${customerId}:`, e)
        }
      }
    } catch (e) {
      console.error('Error listing customers:', e)
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
      status: firstAccount ? 'active' : 'pending_account',
      metadata: { accounts, currency: firstAccount?.currency || 'BRL' },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id,provider' })

    return NextResponse.redirect(`${req.nextUrl.origin}/integracoes?google=connected`)
  } catch (err) {
    console.error('Google callback error:', err)
    return NextResponse.redirect(`${req.nextUrl.origin}/integracoes?error=callback_failed`)
  }
}
