import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  const { workspace_id, domain, access_token } = await req.json()

  if (!workspace_id || !domain || !access_token) {
    return NextResponse.json(
      { error: 'workspace_id, domain e access_token são obrigatórios' },
      { status: 400 },
    )
  }

  const cleanDomain = domain.includes('.myshopify.com')
    ? domain.replace(/^https?:\/\//, '').replace(/\/$/, '')
    : `${domain.replace(/^https?:\/\//, '').replace(/\/$/, '')}.myshopify.com`

  // Test connection
  try {
    const shopRes = await fetch(
      `https://${cleanDomain}/admin/api/2024-01/shop.json`,
      {
        headers: { 'X-Shopify-Access-Token': access_token },
        signal: AbortSignal.timeout(10000),
      },
    )

    if (!shopRes.ok) {
      const errText = await shopRes.text()
      console.error('[shopify/connect] test failed:', shopRes.status, errText)
      return NextResponse.json(
        { error: `Falha ao conectar: ${shopRes.status}. Verifique domínio e token.` },
        { status: 400 },
      )
    }

    const shopData = await shopRes.json()
    const shopName = shopData.shop?.name || cleanDomain

    // Save integration
    const { error: upsertError } = await supabase
      .from('workspace_integrations')
      .upsert(
        {
          workspace_id,
          provider: 'shopify',
          access_token,
          account_id: cleanDomain,
          account_name: shopName,
          status: 'active',
          metadata: { connected_via: 'token' },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id,provider' },
      )

    if (upsertError) {
      console.error('[shopify/connect] upsert error:', upsertError.message)
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      shop_name: shopName,
      domain: cleanDomain,
    })
  } catch (err: any) {
    console.error('[shopify/connect] error:', err.message)
    return NextResponse.json(
      { error: `Erro ao conectar: ${err.message}` },
      { status: 500 },
    )
  }
}
