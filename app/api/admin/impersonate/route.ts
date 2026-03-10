import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST: Set admin_viewing_workspace_id cookie
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminSupabase = createAdminClient()
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { workspace_id } = await request.json()
  if (!workspace_id) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })

  // Verify workspace exists
  const { data: ws } = await adminSupabase
    .from('workspaces')
    .select('id, name')
    .eq('id', workspace_id)
    .single()

  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const cookieStore = await cookies()
  cookieStore.set('admin_viewing_workspace_id', workspace_id, {
    path: '/',
    httpOnly: false,
    maxAge: 60 * 60 * 4, // 4 hours
    sameSite: 'lax',
  })

  return NextResponse.json({ success: true, workspace: ws })
}

// DELETE: Clear the impersonation cookie
export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete('admin_viewing_workspace_id')
  return NextResponse.json({ success: true })
}
