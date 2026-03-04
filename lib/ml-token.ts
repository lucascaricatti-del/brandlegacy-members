import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function getMlToken(workspaceId: string): Promise<string> {
  const { data: integration, error } = await (adminSupabase as any)
    .from('workspace_integrations')
    .select('metadata')
    .eq('workspace_id', workspaceId)
    .eq('provider', 'mercadolivre')
    .eq('status', 'active')
    .single()

  if (error || !integration) {
    throw new Error('Mercado Livre integration not found')
  }

  const meta = integration.metadata
  const expiresAt = new Date(meta.expires_at).getTime()
  const now = Date.now()
  const TEN_MINUTES = 10 * 60 * 1000

  // Token still valid
  if (expiresAt - now > TEN_MINUTES) {
    return meta.access_token
  }

  // Refresh token
  console.log('[ml-token] refreshing token for workspace', workspaceId)

  const res: Response = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: process.env.MERCADOLIVRE_CLIENT_ID!,
      client_secret: process.env.MERCADOLIVRE_CLIENT_SECRET!,
      refresh_token: meta.refresh_token,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('[ml-token] refresh failed:', res.status, errText)
    throw new Error(`ML token refresh failed: ${res.status}`)
  }

  const tokens = await res.json()
  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  await (adminSupabase as any)
    .from('workspace_integrations')
    .update({
      metadata: {
        ...meta,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: newExpiresAt,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('workspace_id', workspaceId)
    .eq('provider', 'mercadolivre')

  console.log('[ml-token] token refreshed, expires_at:', newExpiresAt)
  return tokens.access_token
}
