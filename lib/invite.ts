import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://membros.brandlegacy.com.br'

export async function sendWorkspaceInvite(opts: {
  workspace_id: string
  email: string
  role: string
  invited_by: string
  workspace_name: string
  inviter_name: string
  permissions?: Record<string, any>
}): Promise<{ success: true; invite_id: string } | { error: string }> {
  const adminSupabase = createAdminClient()
  const normalizedEmail = opts.email.trim().toLowerCase()

  // Check for existing pending invite
  const { data: existingInvite } = await adminSupabase
    .from('workspace_invites')
    .select('id')
    .eq('workspace_id', opts.workspace_id)
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
        role: opts.role,
        permissions: (opts.permissions ?? {}) as any,
        token: newToken,
        invited_by: opts.invited_by,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq('id', existingInvite.id)
      .select('id, token')
      .single()

    if (error) return { error: error.message }
    inviteId = updated!.id
    token = updated!.token
  } else {
    const { data: invite, error } = await adminSupabase
      .from('workspace_invites')
      .insert({
        workspace_id: opts.workspace_id,
        email: normalizedEmail,
        role: opts.role,
        permissions: (opts.permissions ?? {}) as any,
        invited_by: opts.invited_by,
      })
      .select('id, token')
      .single()

    if (error) return { error: error.message }
    inviteId = invite!.id
    token = invite!.token
  }

  const ROLE_LABELS: Record<string, string> = {
    owner: 'Owner',
    manager: 'Manager',
    collaborator: 'Colaborador',
    mentee: 'Mentorado',
  }
  const roleLabel = ROLE_LABELS[opts.role] ?? opts.role

  // Generate magic link
  const acceptUrl = `${baseUrl}/aceitar-convite?token=${token}`
  let ctaUrl = acceptUrl

  const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
    type: 'magiclink',
    email: normalizedEmail,
    options: { redirectTo: acceptUrl },
  })

  if (!linkError && linkData?.properties?.action_link) {
    ctaUrl = linkData.properties.action_link
  }

  // Send email via Resend
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'BrandLegacy <noreply@brandlegacy.com.br>',
      to: normalizedEmail,
      subject: `Você foi convidado para ${opts.workspace_name} no BrandLegacy Members`,
      html: buildInviteEmail(opts.workspace_name, opts.inviter_name, roleLabel, ctaUrl),
    })
  }

  return { success: true, invite_id: inviteId }
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
