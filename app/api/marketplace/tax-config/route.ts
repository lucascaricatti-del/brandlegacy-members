import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWorkspaceAccess } from '@/lib/api-auth'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const workspace_id = searchParams.get('workspace_id')

  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await (adminSupabase as any)
    .from('workspace_tax_config')
    .select('*')
    .eq('workspace_id', workspace_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Return default config if none exists
  if (!data || data.length === 0) {
    return NextResponse.json({
      marketplace: '_all',
      effective_tax_pct: 0,
      simples_nacional_pct: 0,
      icms_pct: 0,
      pis_cofins_pct: 0,
    })
  }

  // Return the _all config or first found
  const allConfig = data.find((c: any) => c.marketplace === '_all') || data[0]
  return NextResponse.json(allConfig)
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { workspace_id, marketplace, effective_tax_pct, simples_nacional_pct, icms_pct, pis_cofins_pct } = body

  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await (adminSupabase as any)
    .from('workspace_tax_config')
    .upsert(
      {
        workspace_id,
        marketplace: marketplace ?? '_all',
        effective_tax_pct: effective_tax_pct ?? 0,
        simples_nacional_pct: simples_nacional_pct ?? 0,
        icms_pct: icms_pct ?? 0,
        pis_cofins_pct: pis_cofins_pct ?? 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id,marketplace' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
