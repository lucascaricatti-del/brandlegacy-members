import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { WorkspaceRole } from '@/lib/types/database'
import AcceptInviteClient from './AcceptInviteClient'

export const metadata = { title: 'Aceitar Convite — BrandLegacy' }

interface Props {
  searchParams: Promise<{ token?: string }>
}

export default async function AcceptInvitePage({ searchParams }: Props) {
  const { token } = await searchParams

  if (!token) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-8 text-center">
        <p className="text-error font-medium mb-2">Convite inválido</p>
        <p className="text-text-muted text-sm">O link do convite não contém um token válido.</p>
      </div>
    )
  }

  const adminSupabase = createAdminClient()

  // Validate invite
  const { data: invite } = await adminSupabase
    .from('workspace_invites')
    .select('id, workspace_id, email, role, permissions, status, expires_at, created_at, workspaces(name)')
    .eq('token', token)
    .single()

  if (!invite) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-8 text-center">
        <p className="text-error font-medium mb-2">Convite não encontrado</p>
        <p className="text-text-muted text-sm">Este link de convite é inválido ou já foi utilizado.</p>
      </div>
    )
  }

  if (invite.status !== 'pending') {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-8 text-center">
        <p className="text-text-primary font-medium mb-2">
          {invite.status === 'accepted' ? 'Convite já aceito' : 'Convite expirado'}
        </p>
        <p className="text-text-muted text-sm">
          {invite.status === 'accepted'
            ? 'Este convite já foi utilizado. Faça login para acessar.'
            : 'Peça ao responsável do workspace para enviar um novo convite.'}
        </p>
        <a href="/login" className="inline-block mt-4 px-6 py-2 bg-brand-gold text-bg-base rounded-lg text-sm font-medium hover:bg-brand-gold-light transition-colors">
          Ir para Login
        </a>
      </div>
    )
  }

  if (new Date(invite.expires_at) < new Date()) {
    // Mark as expired
    await adminSupabase
      .from('workspace_invites')
      .update({ status: 'expired' })
      .eq('id', invite.id)

    return (
      <div className="bg-bg-card border border-border rounded-xl p-8 text-center">
        <p className="text-error font-medium mb-2">Convite expirado</p>
        <p className="text-text-muted text-sm">Este convite expirou. Peça ao responsável do workspace para enviar um novo.</p>
      </div>
    )
  }

  const workspaceName = (invite as any).workspaces?.name ?? 'Workspace'

  // Check if user is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Authenticated — accept invite immediately
    // Check if already a member
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
    await adminSupabase
      .from('workspace_invites')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', invite.id)

    // Clear permissions cookie so it's re-fetched
    redirect('/dashboard')
  }

  // Not authenticated — show login/signup form
  return (
    <AcceptInviteClient
      token={token}
      workspaceName={workspaceName}
      email={invite.email}
      role={invite.role}
    />
  )
}
