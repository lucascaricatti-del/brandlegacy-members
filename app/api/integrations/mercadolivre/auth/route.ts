import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function base64urlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return base64urlEncode(array.buffer)
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64urlEncode(digest)
}

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get('workspace_id')
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
  }

  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  // Save code_verifier temporarily — delete first then insert to avoid constraint issues
  const { error: deleteErr } = await (adminSupabase as any)
    .from('workspace_integrations')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('provider', 'mercadolivre_pending')

  if (deleteErr) {
    console.error('[ml/auth] delete pending error:', JSON.stringify(deleteErr))
  }

  const state = `${workspaceId}:${Date.now()}`

  const { error: insertErr } = await (adminSupabase as any)
    .from('workspace_integrations')
    .insert({
      workspace_id: workspaceId,
      provider: 'mercadolivre_pending',
      status: 'pending',
      access_token: 'pending',
      metadata: { code_verifier: codeVerifier, state },
      updated_at: new Date().toISOString(),
    })

  if (insertErr) {
    console.error('[ml/auth] insert pending error:', JSON.stringify(insertErr))
    return NextResponse.json({ error: 'Failed to save code_verifier', detail: insertErr.message }, { status: 500 })
  }

  console.log('[ml/auth] code_verifier saved for workspace:', workspaceId)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.MERCADOLIVRE_CLIENT_ID!,
    redirect_uri: process.env.MERCADOLIVRE_REDIRECT_URI!,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  return NextResponse.redirect(
    `https://auth.mercadolivre.com.br/authorization?${params.toString()}`
  )
}
