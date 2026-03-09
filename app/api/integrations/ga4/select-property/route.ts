import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWorkspaceAccess } from '@/lib/api-auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const { workspace_id, property_id, property_name } = await req.json()
    if (!workspace_id || !property_id) {
      return NextResponse.json({ error: 'workspace_id and property_id required' }, { status: 400 })
    }

    const auth = await verifyWorkspaceAccess(workspace_id)
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { data: integration } = await supabase
      .from('workspace_integrations')
      .select('metadata')
      .eq('workspace_id', workspace_id)
      .eq('provider', 'google_ads')
      .single()

    if (!integration) {
      return NextResponse.json({ error: 'Google not connected' }, { status: 404 })
    }

    const metadata = (integration as any).metadata || {}

    await supabase
      .from('workspace_integrations')
      .update({
        metadata: {
          ...metadata,
          ga4_property_id: property_id,
          ga4_property_name: property_name || property_id,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', workspace_id)
      .eq('provider', 'google_ads')

    return NextResponse.json({ success: true, property_id })
  } catch (e: any) {
    console.error('[ga4/select-property] error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
