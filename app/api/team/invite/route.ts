import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { sendWorkspaceInvite } from '@/lib/invite'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { workspace_id, email, role, permissions } = await request.json()

    if (!workspace_id || !email || !role) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
    }

    if (!['manager', 'collaborator', 'mentee'].includes(role)) {
      return NextResponse.json({ error: 'Papel inválido' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    // Check caller is owner/manager of workspace
    const { data: callerMembership } = await adminSupabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!callerMembership || !['owner', 'manager'].includes(callerMembership.role)) {
      return NextResponse.json({ error: 'Sem permissão para convidar membros' }, { status: 403 })
    }

    // Get workspace name + inviter name
    const [{ data: workspace }, { data: inviterProfile }] = await Promise.all([
      adminSupabase.from('workspaces').select('name').eq('id', workspace_id).single(),
      adminSupabase.from('profiles').select('name').eq('id', user.id).single(),
    ])

    const result = await sendWorkspaceInvite({
      workspace_id,
      email,
      role,
      invited_by: user.id,
      workspace_name: workspace?.name ?? 'Workspace',
      inviter_name: inviterProfile?.name ?? 'Um membro',
      permissions,
    })

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true, invite_id: result.invite_id })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 },
    )
  }
}
