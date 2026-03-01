import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  const { workspace_id, account_id, account_name } = await req.json()
  if (!workspace_id || !account_id) {
    return NextResponse.json({ error: 'workspace_id and account_id required' }, { status: 400 })
  }
  const { error } = await supabase
    .from('workspace_integrations')
    .update({ account_id, account_name, updated_at: new Date().toISOString() })
    .eq('workspace_id', workspace_id)
    .eq('provider', 'google_ads')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
