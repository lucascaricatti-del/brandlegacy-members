import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWorkspaceAccess } from '@/lib/api-auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const { workspace_id, provider } = await req.json()

    if (!workspace_id || !provider) {
      return NextResponse.json({ error: 'workspace_id and provider required' }, { status: 400 })
    }

    const auth = await verifyWorkspaceAccess(workspace_id)
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { error } = await supabase
      .from('workspace_integrations')
      .delete()
      .eq('workspace_id', workspace_id)
      .eq('provider', provider)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Limpa métricas também
    await supabase
      .from('ads_metrics')
      .delete()
      .eq('workspace_id', workspace_id)
      .eq('provider', provider)

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[disconnect] error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
