import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { WorkspaceRole } from '@/lib/types/database'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { token } = await request.json()
    if (!token) {
      return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    // Find invite
    const { data: invite } = await (adminSupabase as any)
      .from('workspace_invites')
      .select('id, workspace_id, email, role, permissions, status, expires_at, created_at')
      .eq('token', token)
      .eq('status', 'pending')
      .single()

    if (!invite) {
      return NextResponse.json({ error: 'Convite não encontrado ou já utilizado' }, { status: 404 })
    }

    // Check not expired
    if (new Date(invite.expires_at) < new Date()) {
      await (adminSupabase as any)
        .from('workspace_invites')
        .update({ status: 'expired' })
        .eq('id', invite.id)
      return NextResponse.json({ error: 'Convite expirado' }, { status: 410 })
    }

    // Verify email matches (case-insensitive)
    if (invite.email.toLowerCase() !== user.email?.toLowerCase()) {
      return NextResponse.json({ error: 'Este convite foi enviado para outro email' }, { status: 403 })
    }

    // Upsert workspace member
    const { data: existingMember } = await adminSupabase
      .from('workspace_members')
      .select('id, is_active')
      .eq('workspace_id', invite.workspace_id)
      .eq('user_id', user.id)
      .single()

    if (existingMember) {
      if (!existingMember.is_active) {
        await adminSupabase
          .from('workspace_members')
          .update({
            is_active: true,
            role: invite.role as WorkspaceRole,
            permissions: invite.permissions,
            accepted_at: new Date().toISOString(),
          })
          .eq('id', existingMember.id)
      }
    } else {
      await adminSupabase.from('workspace_members').insert({
        workspace_id: invite.workspace_id,
        user_id: user.id,
        role: invite.role as WorkspaceRole,
        permissions: invite.permissions,
        invited_at: invite.created_at,
        accepted_at: new Date().toISOString(),
        is_active: true,
      })
    }

    // Mark invite as accepted
    await (adminSupabase as any)
      .from('workspace_invites')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', invite.id)

    return NextResponse.json({
      success: true,
      workspace_id: invite.workspace_id,
      role: invite.role,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 },
    )
  }
}
