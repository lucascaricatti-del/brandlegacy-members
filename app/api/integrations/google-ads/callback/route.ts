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
      console.error('Token not JSON:', tokenText.slice(0, 300))
      return NextResponse.redirect(`${req.nextUrl.origin}/integracoes?error=token_parse`)
    }

    if (tokenData.error) {
      console.error('Token error:', JSON.stringify(tokenData))
      return NextResponse.redirect(`${req.nextUrl.origin}/integracoes?error=oauth_failed`)
    }

    const accessToken = tokenData.access_token
    const mccId = process.env.GOOGLE_ADS_MCC_ID
    // Token exchanged successfully

    // 2. List accessible customers
    let accounts: any[] = []
    const customersRes = await fetch(
      'https://googleads.googleapis.com/v23/customers:listAccessibleCustomers',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
        },
      }
    )
    const customersText = await customersRes.text()

    let resourceNames: string[] = []
    try {
      const customersData = JSON.parse(customersText)
      resourceNames = customersData.resourceNames ?? []
      if (customersData.error) {
        console.error('API error:', JSON.stringify(customersData.error))
      }
    } catch {
      console.error('Not JSON:', customersText.slice(0, 300))
    }

    // 3. Try to get details using MCC as login-customer-id
    for (const rn of resourceNames.slice(0, 10)) {
      const customerId = rn.replace('customers/', '')
      const loginId = mccId || customerId
      try {
        const detailRes = await fetch(
          `https://googleads.googleapis.com/v23/customers/${customerId}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
              'login-customer-id': loginId,
            },
          }
        )
        const detailText = await detailRes.text()
        if (detailRes.ok) {
          const detail = JSON.parse(detailText)
          accounts.push({
            customer_id: customerId,
            name: detail.descriptiveName || `Account ${customerId}`,
            currency: detail.currencyCode || 'BRL',
            is_manager: detail.manager || false,
          })
        }
      } catch (e: any) {
        console.error(`Customer ${customerId} error:`, e.message)
      }
    }

    // 4. If MCC found but no sub-accounts, try GAQL to list child accounts
    if (mccId && accounts.length <= 1) {
      try {
        const gaqlRes = await fetch(
          `https://googleads.googleapis.com/v23/customers/${mccId}/googleAds:search`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
              'login-customer-id': mccId,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: `SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code, customer_client.manager FROM customer_client WHERE customer_client.status = 'ENABLED'`,
            }),
          }
        )
        const gaqlText = await gaqlRes.text()
        if (gaqlRes.ok) {
          const gaqlData = JSON.parse(gaqlText)
          const results = gaqlData.results ?? []
          for (const r of results) {
            const cc = r.customerClient
            if (cc && !accounts.find((a: any) => a.customer_id === cc.id?.toString())) {
              accounts.push({
                customer_id: cc.id?.toString(),
                name: cc.descriptiveName || `Account ${cc.id}`,
                currency: cc.currencyCode || 'BRL',
                is_manager: cc.manager || false,
              })
            }
          }
        }
      } catch (e: any) {
        console.error('GAQL error:', e.message)
      }
    }

    const firstAccount = accounts.find(a => !a.is_manager) || accounts[0]

    // 5. Try to list GA4 properties (analytics.readonly scope)
    let ga4Properties: { property_id: string; display_name: string; account_name: string }[] = []
    let ga4Connected = false
    console.log('[GA4-DEBUG] attempting accountSummaries with token:', accessToken?.slice(0, 15) + '...')
    console.log('[GA4-DEBUG] token scopes from response:', tokenData.scope)
    try {
      const ga4Res = await fetch(
        'https://analyticsadmin.googleapis.com/v1beta/accountSummaries',
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      )
      console.log('[GA4-DEBUG] accountSummaries response status:', ga4Res.status)
      if (ga4Res.ok) {
        const ga4Data = await ga4Res.json()
        console.log('[GA4-DEBUG] accountSummaries body:', JSON.stringify(ga4Data).slice(0, 500))
        ga4Connected = true
        for (const acct of ga4Data.accountSummaries ?? []) {
          for (const prop of acct.propertySummaries ?? []) {
            ga4Properties.push({
              property_id: prop.property?.replace('properties/', '') || '',
              display_name: prop.displayName || 'Unknown',
              account_name: acct.displayName || 'Unknown',
            })
          }
        }
        console.log('[GA4-DEBUG] found properties:', ga4Properties.length, ga4Properties.map(p => `${p.property_id}:${p.display_name}`))
      } else {
        const errText = await ga4Res.text()
        console.error('[GA4-DEBUG] accountSummaries FAILED:', ga4Res.status, errText.slice(0, 800))
      }
    } catch (e: any) {
      console.error('[GA4-DEBUG] listing exception:', e.message)
    }
    console.log('[GA4-DEBUG] final state: ga4Connected=', ga4Connected, 'properties=', ga4Properties.length)

    // Auto-select first property (or only property)
    const ga4PropertyId = ga4Properties.length > 0 ? ga4Properties[0].property_id : null
    const ga4PropertyName = ga4Properties.length > 0 ? ga4Properties[0].display_name : null

    await supabase.from('workspace_integrations').upsert({
      workspace_id: workspaceId,
      provider: 'google_ads',
      access_token: accessToken,
      refresh_token: tokenData.refresh_token || null,
      token_expires_at: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString(),
      account_id: firstAccount?.customer_id || null,
      account_name: firstAccount?.name || null,
      status: firstAccount ? 'active' : 'pending_account',
      metadata: {
        accounts,
        currency: firstAccount?.currency || 'BRL',
        ga4_connected: ga4Connected,
        ga4_properties: ga4Properties,
        ga4_property_id: ga4PropertyId,
        ga4_property_name: ga4PropertyName,
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id,provider' })

    return NextResponse.redirect(`${req.nextUrl.origin}/integracoes?google=connected`)
  } catch (err: any) {
    console.error('Google callback error:', err.message, err.stack)
    return NextResponse.redirect(`${req.nextUrl.origin}/integracoes?error=callback_failed`)
  }
}
