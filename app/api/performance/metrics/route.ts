import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWorkspaceAccess } from '@/lib/api-auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  const { workspace_id, date_from, date_to } = await req.json()

  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!date_from || !date_to) return NextResponse.json({ error: 'date_from and date_to required' }, { status: 400 })

  const [metricsRes, integrationsRes] = await Promise.all([
    supabase.rpc('get_performance_metrics', {
      p_workspace_id: workspace_id,
      p_date_from: date_from,
      p_date_to: date_to,
    }),
    supabase
      .from('workspace_integrations')
      .select('provider, is_active, metadata, last_sync')
      .eq('workspace_id', workspace_id),
  ])

  if (metricsRes.error) return NextResponse.json({ error: metricsRes.error.message }, { status: 500 })

  return NextResponse.json({
    metrics: metricsRes.data,
    integrations: (integrationsRes.data ?? []).map((i: any) => ({
      provider: i.provider,
      is_active: i.is_active,
      has_ga4: i.provider === 'google_ads' && !!i.metadata?.ga4_property_id,
      last_sync: i.last_sync,
    })),
  })
}
