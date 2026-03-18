/**
 * Instagram Graph API helper via Facebook Graph API
 * Uses the same token as Meta Ads (workspace_integrations.provider = 'meta_ads')
 */

export async function callInstagramGraph(
  endpoint: string,
  accessToken: string,
  params?: Record<string, string>
) {
  const url = new URL(`https://graph.facebook.com/v21.0${endpoint}`)
  url.searchParams.set('access_token', accessToken)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }

  const res = await fetch(url.toString())

  // Check rate limit headers
  const usage = res.headers.get('x-business-use-case-usage')
  if (usage) {
    try {
      const parsed = JSON.parse(usage)
      const values = Object.values(parsed) as any[]
      const callCount = values[0]?.[0]?.call_count
      if (callCount > 80) {
        console.warn(`[Instagram API] Rate limit at ${callCount}%`)
      }
    } catch { /* ignore parse errors */ }
  }

  if (!res.ok) {
    const error = await res.json()
    // Token expired or invalid
    if (error?.error?.code === 190 || error?.error?.code === 102) {
      throw new Error('TOKEN_EXPIRED')
    }
    // Permission error
    if (error?.error?.code === 10 || error?.error?.code === 200 || res.status === 403) {
      throw new Error('PERMISSIONS_PENDING')
    }
    throw new Error(`Instagram API error: ${JSON.stringify(error)}`)
  }

  return res.json()
}
