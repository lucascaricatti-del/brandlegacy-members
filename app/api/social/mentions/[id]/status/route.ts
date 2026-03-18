import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWorkspaceAccess } from '@/lib/api-auth'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const { status } = body

  if (!status) {
    return NextResponse.json({ error: 'status required' }, { status: 400 })
  }

  const validStatuses = ['new', 'analyzing', 'editing', 'testing', 'published', 'discarded']
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  // Get the mention to verify workspace access
  const { data: mention, error: fetchError } = await (adminSupabase as any)
    .from('social_mentions')
    .select('workspace_id')
    .eq('id', id)
    .single()

  if (fetchError || !mention) {
    return NextResponse.json({ error: 'Mention not found' }, { status: 404 })
  }

  const auth = await verifyWorkspaceAccess(mention.workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  // Update status
  const { data, error } = await (adminSupabase as any)
    .from('social_mentions')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If status = 'analyzing', trigger analysis
  if (status === 'analyzing') {
    try {
      const origin = req.nextUrl.origin
      fetch(`${origin}/api/social/mentions/${id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: mention.workspace_id }),
      }).catch(() => {}) // fire-and-forget
    } catch { /* ignore */ }
  }

  return NextResponse.json(data)
}
