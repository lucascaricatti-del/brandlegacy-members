import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await request.json()
  const { workspace_id, member_id, permissions } = body as {
    workspace_id: string
    member_id: string
    permissions: Record<string, unknown>
  }

  if (!workspace_id || !member_id || !permissions) {
    return NextResponse.json({ error: 'Campos obrigatórios: workspace_id, member_id, permissions' }, { status: 400 })
  }

  const adminSupabase = createAdminClient()

  // Verify caller is owner or manager
  const { data: callerMembership } = await adminSupabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspace_id)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!callerMembership || !['owner', 'manager'].includes(callerMembership.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  // Update target member's permissions
  const { error } = await adminSupabase
    .from('workspace_members')
    .update({ permissions: permissions as unknown as import('@/lib/types/database').Json })
    .eq('id', member_id)
    .eq('workspace_id', workspace_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
