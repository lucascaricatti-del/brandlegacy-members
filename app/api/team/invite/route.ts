import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://membros.brandlegacy.com.br'

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
    const { data: workspace } = await adminSupabase
      .from('workspaces')
      .select('name')
      .eq('id', workspace_id)
      .single()

    const workspaceName = workspace?.name ?? 'Workspace'

    const { data: inviterProfile } = await adminSupabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single()

    const inviterName = inviterProfile?.name ?? 'Um membro'

    // Check for existing pending invite
    const normalizedEmail = email.trim().toLowerCase()
    const { data: existingInvite } = await adminSupabase
      .from('workspace_invites')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('email', normalizedEmail)
      .eq('status', 'pending')
      .single()

    let inviteId: string
    let token: string

    if (existingInvite) {
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
      const { data: invite, error } = await adminSupabase
        .from('workspace_invites')
        .insert({
          workspace_id,
          email: normalizedEmail,
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

    const ROLE_LABELS: Record<string, string> = {
      manager: 'Manager',
      collaborator: 'Colaborador',
      mentee: 'Mentorado',
    }
    const roleLabel = ROLE_LABELS[role] ?? role

    // Generate magic link server-side (works for existing and new users)
    const acceptUrl = `${baseUrl}/aceitar-convite?token=${token}`
    let ctaUrl = acceptUrl

    const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedEmail,
      options: {
        redirectTo: acceptUrl,
      },
    })

    if (!linkError && linkData?.properties?.action_link) {
      // Magic link auto-authenticates, then redirects to acceptUrl
      ctaUrl = linkData.properties.action_link
    }

    // Send ONE branded email via Resend
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY)

      await resend.emails.send({
        from: 'BrandLegacy <noreply@brandlegacy.com.br>',
        to: normalizedEmail,
        subject: `Você foi convidado para ${workspaceName} no BrandLegacy Members`,
        html: buildInviteEmail(workspaceName, inviterName, roleLabel, ctaUrl),
      })
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

function buildInviteEmail(workspaceName: string, inviterName: string, roleLabel: string, ctaUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#050D07;">
  <div style="max-width:520px;margin:40px auto;background:#0F1911;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
    <div style="padding:32px 32px 24px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);">
      <p style="color:#C9971A;font-size:22px;font-weight:700;margin:0 0 4px;letter-spacing:0.5px;">BrandLegacy</p>
      <p style="color:rgba(255,255,255,0.45);font-size:12px;margin:0;">Área de Membros</p>
    </div>
    <div style="padding:32px;">
      <h2 style="color:#FFFFFF;font-size:20px;margin:0 0 16px;">Você foi convidado!</h2>
      <p style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.6;margin:0 0 8px;">
        Olá! <strong style="color:#FFFFFF;">${inviterName}</strong> convidou você para acessar
        <strong style="color:#C9971A;">${workspaceName}</strong> como <strong style="color:#FFFFFF;">${roleLabel}</strong>.
      </p>
      <p style="color:rgba(255,255,255,0.5);font-size:13px;line-height:1.5;margin:0 0 24px;">
        Clique no botão abaixo para aceitar o convite e acessar a plataforma.
      </p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${ctaUrl}" style="display:inline-block;padding:14px 36px;background:#C9971A;color:#050D07;font-size:15px;font-weight:700;border-radius:8px;text-decoration:none;">
          Aceitar Convite &rarr;
        </a>
      </div>
      <p style="color:rgba(255,255,255,0.3);font-size:11px;text-align:center;margin:24px 0 0;">
        Este link expira em 7 dias. Se você não esperava este email, pode ignorá-lo.
      </p>
    </div>
    <div style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
      <p style="color:rgba(255,255,255,0.25);font-size:11px;margin:0;">BrandLegacy Members &middot; membros.brandlegacy.com.br</p>
    </div>
  </div>
</body>
</html>`
}
