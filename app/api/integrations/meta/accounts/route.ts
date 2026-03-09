import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWorkspaceAccess } from '@/lib/api-auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const { workspace_id, account_id, account_name } = await req.json()

    if (!workspace_id || !account_id) {
      return NextResponse.json({ error: 'workspace_id and account_id required' }, { status: 400 })
    }

    const auth = await verifyWorkspaceAccess(workspace_id)
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { error } = await supabase
      .from('workspace_integrations')
      .update({ account_id, account_name, updated_at: new Date().toISOString() })
      .eq('workspace_id', workspace_id)
      .eq('provider', 'meta_ads')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[meta/accounts] POST error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const workspaceId = req.nextUrl.searchParams.get('workspace_id')
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
    }

    const auth = await verifyWorkspaceAccess(workspaceId)
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { data } = await supabase
      .from('workspace_integrations')
      .select('metadata')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'meta_ads')
      .single()

    return NextResponse.json({ accounts: data?.metadata?.accounts ?? [] })
  } catch (e: any) {
    console.error('[meta/accounts] GET error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
