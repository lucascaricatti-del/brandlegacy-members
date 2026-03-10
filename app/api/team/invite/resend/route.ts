import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://membros.brandlegacy.com.br'

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()
    if (!token) {
      return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    // Find the pending invite
    const { data: invite } = await (adminSupabase as any)
      .from('workspace_invites')
      .select('id, workspace_id, email, role, status, expires_at, invited_by, workspaces(name)')
      .eq('token', token)
      .eq('status', 'pending')
      .single()

    if (!invite) {
      return NextResponse.json({ error: 'Convite não encontrado' }, { status: 404 })
    }

    const workspaceName = invite.workspaces?.name ?? 'Workspace'

    // Get inviter name
    const { data: inviterProfile } = await adminSupabase
      .from('profiles')
      .select('name')
      .eq('id', invite.invited_by)
      .single()

    const inviterName = inviterProfile?.name ?? 'Um membro'

    const ROLE_LABELS: Record<string, string> = {
      manager: 'Manager',
      collaborator: 'Colaborador',
      mentee: 'Mentorado',
    }
    const roleLabel = ROLE_LABELS[invite.role] ?? invite.role

    // Generate magic link
    const acceptUrl = `${baseUrl}/aceitar-convite?token=${token}`
    let ctaUrl = acceptUrl

    const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
      type: 'magiclink',
      email: invite.email,
      options: { redirectTo: acceptUrl },
    })

    if (!linkError && linkData?.properties?.action_link) {
      ctaUrl = linkData.properties.action_link
    }

    // Send email
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY)

      await resend.emails.send({
        from: 'BrandLegacy <noreply@brandlegacy.com.br>',
        to: invite.email,
        subject: `Você foi convidado para ${workspaceName} no BrandLegacy Members`,
        html: `
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
</html>`,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 },
    )
  }
}
