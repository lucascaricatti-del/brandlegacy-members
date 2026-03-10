import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

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

    // Get workspace name
    const { data: workspace } = await adminSupabase
      .from('workspaces')
      .select('name')
      .eq('id', workspace_id)
      .single()

    const workspaceName = workspace?.name ?? 'Workspace'

    // Check for existing pending invite
    const { data: existingInvite } = await adminSupabase
      .from('workspace_invites')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('email', email.trim().toLowerCase())
      .eq('status', 'pending')
      .single()

    let inviteId: string
    let token: string

    if (existingInvite) {
      // Update existing invite
      const newToken = generateToken()
      const { data: updated, error } = await adminSupabase
        .from('workspace_invites')
        .update({
          role,
          permissions: permissions ?? {},
          token: newToken,
          invited_by: user.id,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', existingInvite.id)
        .select('id, token')
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      inviteId = updated!.id
      token = updated!.token
    } else {
      // Create new invite
      const { data: invite, error } = await adminSupabase
        .from('workspace_invites')
        .insert({
          workspace_id,
          email: email.trim().toLowerCase(),
          role,
          permissions: permissions ?? {},
          invited_by: user.id,
        })
        .select('id, token')
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      inviteId = invite!.id
      token = invite!.token
    }

    // Check if user already exists in auth
    const { data: existingProfile } = await adminSupabase
      .from('profiles')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .single()

    // Build invite URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
    const inviteUrl = `${baseUrl}/aceitar-convite?token=${token}`

    // Send email via Resend
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY)

      const ROLE_LABELS: Record<string, string> = {
        manager: 'Manager',
        collaborator: 'Colaborador',
        mentee: 'Mentorado',
      }

      if (existingProfile) {
        // Existing user — simple invite email
        await resend.emails.send({
          from: 'BrandLegacy <noreply@brandlegacy.com.br>',
          to: email.trim().toLowerCase(),
          subject: `Convite para ${workspaceName} — BrandLegacy`,
          html: buildInviteEmail(workspaceName, ROLE_LABELS[role] ?? role, inviteUrl),
        })
      } else {
        // New user — magic link + invite token
        const { data: linkData } = await adminSupabase.auth.admin.generateLink({
          type: 'magiclink',
          email: email.trim().toLowerCase(),
        })

        const magicLink = linkData?.properties?.action_link
        const finalUrl = magicLink
          ? `${magicLink}&redirect_to=${encodeURIComponent(inviteUrl)}`
          : inviteUrl

        await resend.emails.send({
          from: 'BrandLegacy <noreply@brandlegacy.com.br>',
          to: email.trim().toLowerCase(),
          subject: `Convite para ${workspaceName} — BrandLegacy`,
          html: buildInviteEmail(workspaceName, ROLE_LABELS[role] ?? role, finalUrl),
        })
      }
    }

    return NextResponse.json({ success: true, invite_id: inviteId })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 },
    )
  }
}

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

function buildInviteEmail(workspaceName: string, roleLabel: string, inviteUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#050D07;">
  <div style="max-width:520px;margin:40px auto;background:#0F1911;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
    <div style="padding:32px 32px 24px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);">
      <img src="https://brandlegacy.com.br/logo.png" alt="BrandLegacy" style="height:36px;margin-bottom:8px;" />
      <p style="color:rgba(255,255,255,0.45);font-size:12px;margin:0;">Área de Membros</p>
    </div>
    <div style="padding:32px;">
      <h2 style="color:#FFFFFF;font-size:20px;margin:0 0 16px;">Você foi convidado!</h2>
      <p style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.6;margin:0 0 8px;">
        Você recebeu um convite para participar do workspace <strong style="color:#C9971A;">${workspaceName}</strong> como <strong style="color:#FFFFFF;">${roleLabel}</strong>.
      </p>
      <p style="color:rgba(255,255,255,0.5);font-size:13px;line-height:1.5;margin:0 0 24px;">
        Clique no botão abaixo para aceitar o convite e acessar a plataforma.
      </p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${inviteUrl}" style="display:inline-block;padding:12px 32px;background:#C9971A;color:#050D07;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;">
          Aceitar Convite
        </a>
      </div>
      <p style="color:rgba(255,255,255,0.3);font-size:11px;text-align:center;margin:24px 0 0;">
        Este convite expira em 7 dias. Se você não esperava este email, pode ignorá-lo.
      </p>
    </div>
  </div>
</body>
</html>`
}
