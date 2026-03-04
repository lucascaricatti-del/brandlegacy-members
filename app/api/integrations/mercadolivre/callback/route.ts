import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')

  if (!code || !state) {
    return NextResponse.redirect(new URL('/integracoes?error=missing_params', req.url))
  }

  const workspaceId = state.split(':')[0]

  // Fetch code_verifier from pending row
  const { data: pending } = await (adminSupabase as any)
    .from('workspace_integrations')
    .select('metadata')
    .eq('workspace_id', workspaceId)
    .eq('provider', 'mercadolivre_pending')
    .single()

  if (!pending?.metadata?.code_verifier) {
    return NextResponse.redirect(new URL('/integracoes?error=no_verifier', req.url))
  }

  const codeVerifier = pending.metadata.code_verifier

  // Exchange code for tokens
  const tokenRes: Response = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: process.env.MERCADOLIVRE_CLIENT_ID!,
      client_secret: process.env.MERCADOLIVRE_CLIENT_SECRET!,
      code,
      redirect_uri: process.env.MERCADOLIVRE_REDIRECT_URI!,
      code_verifier: codeVerifier,
    }),
  })

  if (!tokenRes.ok) {
    const errText = await tokenRes.text()
    console.error('[ml/callback] token exchange failed:', tokenRes.status, errText)
    return NextResponse.redirect(new URL('/integracoes?error=token_exchange', req.url))
  }

  const tokens = await tokenRes.json()
  const userId = tokens.user_id
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  // Fetch user/seller info
  let sellerNickname = ''
  try {
    const userRes: Response = await fetch(`https://api.mercadolibre.com/users/${userId}`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    if (userRes.ok) {
      const userInfo = await userRes.json()
      sellerNickname = userInfo.nickname || userInfo.first_name || ''
    }
  } catch (e) {
    console.error('[ml/callback] fetch user info error:', e)
  }

  // Save integration — delete first then insert to avoid constraint issues
  await (adminSupabase as any)
    .from('workspace_integrations')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('provider', 'mercadolivre')

  const { error: saveErr } = await (adminSupabase as any)
    .from('workspace_integrations')
    .insert({
      workspace_id: workspaceId,
      provider: 'mercadolivre',
      status: 'active',
      access_token: tokens.access_token,
      account_id: String(userId),
      account_name: sellerNickname,
      metadata: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        seller_id: String(userId),
        seller_nickname: sellerNickname,
      },
      updated_at: new Date().toISOString(),
    })

  if (saveErr) {
    console.error('[ml/callback] save integration error:', JSON.stringify(saveErr))
    return NextResponse.redirect(new URL('/integracoes?error=save_failed', req.url))
  }

  // Delete pending row
  await (adminSupabase as any)
    .from('workspace_integrations')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('provider', 'mercadolivre_pending')

  return NextResponse.redirect(new URL('/integracoes?success=mercadolivre', req.url))
}
