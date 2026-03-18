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

  const { data: workspace, error } = await (adminSupabase as any)
    .from('workspaces')
    .select('marketplace_tax_config')
    .eq('id', workspace_id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(workspace?.marketplace_tax_config || {})
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { workspace_id, config } = body

  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (!config || typeof config !== 'object') {
    return NextResponse.json({ error: 'config object required' }, { status: 400 })
  }

  // Update workspace marketplace_tax_config
  const { error: updateError } = await (adminSupabase as any)
    .from('workspaces')
    .update({
      marketplace_tax_config: config,
      updated_at: new Date().toISOString(),
    })
    .eq('id', workspace_id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Update tax_rate_percent and shipping_rate_percent on existing manual metrics
  // for current month entries
  const currentMonth = new Date().toISOString().slice(0, 7) + '-01'
  for (const [marketplace, mkConfig] of Object.entries(config)) {
    const cfg = mkConfig as any
    if (cfg.tax_rate_percent !== undefined || cfg.shipping_rate_percent !== undefined) {
      const updateFields: any = { updated_at: new Date().toISOString() }
      if (cfg.tax_rate_percent !== undefined) updateFields.tax_rate_percent = cfg.tax_rate_percent
      if (cfg.shipping_rate_percent !== undefined) updateFields.shipping_rate_percent = cfg.shipping_rate_percent

      await (adminSupabase as any)
        .from('marketplace_manual_metrics')
        .update(updateFields)
        .eq('workspace_id', workspace_id)
        .eq('marketplace', marketplace)
        .gte('date', currentMonth)
    }
  }

  return NextResponse.json({ success: true, config })
}
