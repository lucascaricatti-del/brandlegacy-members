import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWorkspaceAccess } from '@/lib/api-auth'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  const { workspace_id, coupon_code, discount_type, discount_value, max_uses } = await req.json()

  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (!coupon_code || !discount_type || !discount_value) {
    return NextResponse.json({ error: 'coupon_code, discount_type, discount_value required' }, { status: 400 })
  }

  // Get Yampi credentials from workspace_integrations
  const { data: integration } = await (adminSupabase as any)
    .from('workspace_integrations')
    .select('access_token, metadata')
    .eq('workspace_id', workspace_id)
    .eq('provider', 'yampi')
    .single()

  if (!integration) {
    return NextResponse.json({ error: 'Yampi não conectada neste workspace' }, { status: 400 })
  }

  const alias = integration.metadata?.alias || integration.metadata?.shop_alias
  if (!alias) {
    return NextResponse.json({ error: 'Alias da loja Yampi não encontrado' }, { status: 400 })
  }

  try {
    const res = await fetch(`https://api.dooki.com.br/v2/${alias}/catalog/discount-coupons`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Token': process.env.YAMPI_TOKEN!,
        'User-Secret-Key': process.env.YAMPI_SECRET_KEY!,
      },
      body: JSON.stringify({
        token: coupon_code.toUpperCase(),
        type: discount_type === 'percent' ? 'p' : 'f',
        value: String(discount_value),
        max_uses: max_uses || null,
        is_active: true,
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (res.status === 403) {
      return NextResponse.json({ success: false, cloudflare_blocked: true })
    }

    if (!res.ok) {
      const errText = await res.text()
      console.error('Yampi coupon error:', res.status, errText.slice(0, 500))
      return NextResponse.json({ error: `Yampi retornou ${res.status}` }, { status: 500 })
    }

    const data = await res.json()
    return NextResponse.json({ success: true, coupon_id: data.data?.id })
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      return NextResponse.json({ success: false, cloudflare_blocked: true })
    }
    console.error('Yampi coupon error:', err.message)
    return NextResponse.json({ error: 'Erro ao criar cupom na Yampi' }, { status: 500 })
  }
}
