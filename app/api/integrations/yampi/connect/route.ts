import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ALIAS = 'denavita-vitaminas-e-suplementos-ltda'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const yampiHeaders = {
  'User-Token': process.env.YAMPI_TOKEN!,
  'User-Secret-Key': process.env.YAMPI_SECRET_KEY!,
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'User-Agent': 'BrandLegacy/1.0',
}

export async function POST(req: NextRequest) {
  const { workspace_id } = await req.json()

  if (!workspace_id) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
  }

  try {
    // Test connection
    const testRes = await fetch(
      `https://api.yampi.io/v2/${ALIAS}/orders?limit=1`,
      { headers: yampiHeaders, signal: AbortSignal.timeout(10000) },
    )

    if (!testRes.ok) {
      const errText = await testRes.text()
      console.error('[yampi/connect] test failed:', testRes.status, errText)
      return NextResponse.json(
        { error: `Falha ao conectar Yampi: ${testRes.status}` },
        { status: 400 },
      )
    }

    // Save integration
    const { error: upsertError } = await supabase
      .from('workspace_integrations')
      .upsert(
        {
          workspace_id,
          provider: 'yampi',
          access_token: process.env.YAMPI_TOKEN!,
          account_id: ALIAS,
          account_name: 'Denavita',
          status: 'active',
          metadata: { connected_via: 'env_token' },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id,provider' },
      )

    if (upsertError) {
      console.error('[yampi/connect] upsert error:', upsertError.message)
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[yampi/connect] error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
