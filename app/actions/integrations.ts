'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { IntegrationPlatform, Json } from '@/lib/types/database'

// ============================================================
// AUTH HELPER — mesmo padrão de kanban.ts
// ============================================================

async function requireWorkspaceMember(workspaceId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' as const, user: null, adminSupabase: null }

  const adminSupabase = createAdminClient()
  const { data: membership } = await adminSupabase
    .from('workspace_members')
    .select('id, role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership) return { error: 'Acesso negado ao workspace' as const, user: null, adminSupabase: null }

  return { error: null, user, adminSupabase }
}

// ============================================================
// SAVE INTEGRATION (upsert)
// ============================================================

export async function saveIntegration(
  workspaceId: string,
  platform: IntegrationPlatform,
  fields: Record<string, string>,
) {
  const { error, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !adminSupabase) return { error: error ?? 'Erro de autenticação' }

  const accessToken = fields.access_token?.trim()
  if (!accessToken) return { error: 'Access token é obrigatório' }

  const accountId = fields.account_id?.trim() || null

  // Extra config: tudo que não é access_token/account_id
  const extraConfig: Record<string, string> = {}
  for (const [k, v] of Object.entries(fields)) {
    if (k !== 'access_token' && k !== 'account_id' && v?.trim()) {
      extraConfig[k] = v.trim()
    }
  }

  const { error: dbError } = await adminSupabase
    .from('integrations')
    .upsert(
      {
        workspace_id: workspaceId,
        platform,
        access_token: accessToken,
        account_id: accountId,
        extra_config: extraConfig as unknown as Json,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id,platform' },
    )

  if (dbError) return { error: dbError.message }

  revalidatePath('/integracoes')
  return { success: true }
}

// ============================================================
// GET INTEGRATIONS (sem expor access_token)
// ============================================================

export async function getIntegrations(workspaceId: string) {
  const { error, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !adminSupabase) return []

  const { data } = await adminSupabase
    .from('integrations')
    .select('id, workspace_id, platform, account_id, extra_config, is_active, last_sync, created_at, updated_at')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)

  return data ?? []
}

// ============================================================
// DELETE INTEGRATION (soft delete)
// ============================================================

export async function deleteIntegration(workspaceId: string, platform: IntegrationPlatform) {
  const { error, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !adminSupabase) return { error: error ?? 'Erro de autenticação' }

  const { error: dbError } = await adminSupabase
    .from('integrations')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('platform', platform)

  if (dbError) return { error: dbError.message }

  revalidatePath('/integracoes')
  return { success: true }
}

// ============================================================
// TEST INTEGRATION — chama API mínima para validar token
// ============================================================

export async function testIntegration(workspaceId: string, platform: IntegrationPlatform) {
  const { error, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !adminSupabase) return { error: error ?? 'Erro de autenticação' }

  const { data: integration } = await adminSupabase
    .from('integrations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('platform', platform)
    .eq('is_active', true)
    .single()

  if (!integration) return { error: 'Integração não encontrada' }

  try {
    switch (platform) {
      case 'meta_ads': {
        const res = await fetch(
          `https://graph.facebook.com/v18.0/me?access_token=${integration.access_token}`,
        )
        if (!res.ok) return { error: 'Token inválido do Meta Ads' }
        return { success: true, message: 'Conexão Meta Ads OK' }
      }
      case 'google_ads': {
        // Valida que o refresh token e developer token existem
        const extra = integration.extra_config as Record<string, string> | null
        if (!extra?.developer_token) return { error: 'Developer token ausente' }
        return { success: true, message: 'Credenciais Google Ads salvas' }
      }
      case 'ga4': {
        // Valida que o service account JSON base64 decodifica
        try {
          const decoded = Buffer.from(integration.access_token, 'base64').toString('utf-8')
          JSON.parse(decoded)
          return { success: true, message: 'Credenciais GA4 OK' }
        } catch {
          return { error: 'Service Account JSON inválido (deve ser base64)' }
        }
      }
      case 'shopify': {
        const domain = integration.account_id
        if (!domain) return { error: 'Domínio da loja não configurado' }
        const res = await fetch(
          `https://${domain}/admin/api/2024-01/shop.json`,
          { headers: { 'X-Shopify-Access-Token': integration.access_token } },
        )
        if (!res.ok) return { error: 'Token Shopify inválido ou domínio incorreto' }
        return { success: true, message: 'Conexão Shopify OK' }
      }
      default:
        return { error: 'Plataforma não suportada' }
    }
  } catch (e) {
    return { error: `Erro ao testar conexão: ${e instanceof Error ? e.message : 'Desconhecido'}` }
  }
}

// ============================================================
// SYNC — Meta Ads (Graph API v18.0)
// ============================================================

export async function syncMetaAds(workspaceId: string, days = 30) {
  const { error, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !adminSupabase) return { error: error ?? 'Erro de autenticação' }

  const { data: integration } = await adminSupabase
    .from('integrations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('platform', 'meta_ads')
    .eq('is_active', true)
    .single()

  if (!integration) return { error: 'Meta Ads não conectado' }

  const accountId = integration.account_id
  if (!accountId) return { error: 'Account ID não configurado' }

  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().split('T')[0]
  const untilStr = new Date().toISOString().split('T')[0]

  try {
    const url = `https://graph.facebook.com/v18.0/${accountId}/insights?` +
      `fields=spend,impressions,clicks,actions,cpc,cpm,ctr` +
      `&time_range={"since":"${sinceStr}","until":"${untilStr}"}` +
      `&time_increment=1` +
      `&access_token=${integration.access_token}` +
      `&limit=100`

    const res = await fetch(url)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return { error: `Meta API: ${(body as Record<string, Record<string, string>>)?.error?.message ?? res.statusText}` }
    }

    const json = await res.json() as { data: Array<Record<string, unknown>> }
    const rows = json.data ?? []

    for (const row of rows) {
      const dateStr = row.date_start as string
      const actions = (row.actions as Array<{ action_type: string; value: string }>) ?? []
      const conversions = actions
        .filter((a) => a.action_type === 'offsite_conversion.fb_pixel_purchase' || a.action_type === 'purchase')
        .reduce((sum, a) => sum + Number(a.value), 0)

      await adminSupabase
        .from('integration_metrics')
        .upsert(
          {
            workspace_id: workspaceId,
            platform: 'meta_ads' as const,
            metric_date: dateStr,
            data: {
              spend: Number(row.spend ?? 0),
              impressions: Number(row.impressions ?? 0),
              clicks: Number(row.clicks ?? 0),
              cpc: Number(row.cpc ?? 0),
              cpm: Number(row.cpm ?? 0),
              ctr: Number(row.ctr ?? 0),
              conversions,
            } as unknown as Json,
          },
          { onConflict: 'workspace_id,platform,metric_date' },
        )
    }

    // Atualiza last_sync
    await adminSupabase
      .from('integrations')
      .update({ last_sync: new Date().toISOString() })
      .eq('id', integration.id)

    revalidatePath('/integracoes')
    revalidatePath('/metricas')
    return { success: true, synced: rows.length }
  } catch (e) {
    return { error: `Erro ao sincronizar Meta Ads: ${e instanceof Error ? e.message : 'Desconhecido'}` }
  }
}

// ============================================================
// SYNC — Google Ads (googleapis)
// ============================================================

export async function syncGoogleAds(workspaceId: string, days = 30) {
  const { error, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !adminSupabase) return { error: error ?? 'Erro de autenticação' }

  const { data: integration } = await adminSupabase
    .from('integrations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('platform', 'google_ads')
    .eq('is_active', true)
    .single()

  if (!integration) return { error: 'Google Ads não conectado' }

  const extra = integration.extra_config as Record<string, string> | null
  if (!extra?.developer_token) return { error: 'Developer token ausente' }

  const customerId = (integration.account_id ?? '').replace(/-/g, '')
  if (!customerId) return { error: 'Customer ID não configurado' }

  try {
    const { google } = await import('googleapis')

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_ADS_CLIENT_ID,
      process.env.GOOGLE_ADS_CLIENT_SECRET,
    )
    oauth2Client.setCredentials({ refresh_token: integration.access_token })

    const { token } = await oauth2Client.getAccessToken()
    if (!token) return { error: 'Não foi possível obter access token do Google' }

    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toISOString().split('T')[0]
    const untilStr = new Date().toISOString().split('T')[0]

    const query = `
      SELECT
        segments.date,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.average_cpc
      FROM campaign
      WHERE segments.date BETWEEN '${sinceStr}' AND '${untilStr}'
      ORDER BY segments.date
    `

    const res = await fetch(
      `https://googleads.googleapis.com/v15/customers/${customerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'developer-token': extra.developer_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      },
    )

    if (!res.ok) {
      const body = await res.text()
      return { error: `Google Ads API: ${body.slice(0, 200)}` }
    }

    const json = await res.json() as Array<{ results: Array<{ segments: { date: string }; metrics: Record<string, string> }> }>

    // Agregar por dia
    const dailyMap = new Map<string, { spend: number; impressions: number; clicks: number; conversions: number; cpc: number }>()

    for (const batch of json) {
      for (const row of batch.results ?? []) {
        const date = row.segments.date
        const existing = dailyMap.get(date) ?? { spend: 0, impressions: 0, clicks: 0, conversions: 0, cpc: 0 }
        existing.spend += Number(row.metrics.cost_micros ?? 0) / 1_000_000
        existing.impressions += Number(row.metrics.impressions ?? 0)
        existing.clicks += Number(row.metrics.clicks ?? 0)
        existing.conversions += Number(row.metrics.conversions ?? 0)
        existing.cpc = Number(row.metrics.average_cpc ?? 0) / 1_000_000
        dailyMap.set(date, existing)
      }
    }

    let synced = 0
    for (const [dateStr, data] of dailyMap.entries()) {
      await adminSupabase
        .from('integration_metrics')
        .upsert(
          {
            workspace_id: workspaceId,
            platform: 'google_ads' as const,
            metric_date: dateStr,
            data: data as unknown as Json,
          },
          { onConflict: 'workspace_id,platform,metric_date' },
        )
      synced++
    }

    await adminSupabase
      .from('integrations')
      .update({ last_sync: new Date().toISOString() })
      .eq('id', integration.id)

    revalidatePath('/integracoes')
    revalidatePath('/metricas')
    return { success: true, synced }
  } catch (e) {
    return { error: `Erro ao sincronizar Google Ads: ${e instanceof Error ? e.message : 'Desconhecido'}` }
  }
}

// ============================================================
// SYNC — GA4 (google-analytics-data)
// ============================================================

export async function syncGA4(workspaceId: string, days = 30) {
  const { error, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !adminSupabase) return { error: error ?? 'Erro de autenticação' }

  const { data: integration } = await adminSupabase
    .from('integrations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('platform', 'ga4')
    .eq('is_active', true)
    .single()

  if (!integration) return { error: 'GA4 não conectado' }

  const propertyId = integration.account_id
  if (!propertyId) return { error: 'Property ID não configurado' }

  try {
    let credentials: Record<string, string>
    try {
      credentials = JSON.parse(Buffer.from(integration.access_token, 'base64').toString('utf-8'))
    } catch {
      return { error: 'Service Account JSON inválido' }
    }

    const { BetaAnalyticsDataClient } = await import('@google-analytics/data')
    const client = new BetaAnalyticsDataClient({ credentials })

    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toISOString().split('T')[0]
    const untilStr = new Date().toISOString().split('T')[0]

    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: sinceStr, endDate: untilStr }],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'screenPageViews' },
        { name: 'conversions' },
        { name: 'bounceRate' },
      ],
    })

    let synced = 0
    for (const row of response.rows ?? []) {
      const rawDate = row.dimensionValues?.[0]?.value ?? ''
      // GA4 retorna no formato YYYYMMDD
      const dateStr = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`

      await adminSupabase
        .from('integration_metrics')
        .upsert(
          {
            workspace_id: workspaceId,
            platform: 'ga4' as const,
            metric_date: dateStr,
            data: {
              sessions: Number(row.metricValues?.[0]?.value ?? 0),
              users: Number(row.metricValues?.[1]?.value ?? 0),
              pageviews: Number(row.metricValues?.[2]?.value ?? 0),
              conversions: Number(row.metricValues?.[3]?.value ?? 0),
              bounce_rate: Number(row.metricValues?.[4]?.value ?? 0),
            } as unknown as Json,
          },
          { onConflict: 'workspace_id,platform,metric_date' },
        )
      synced++
    }

    await adminSupabase
      .from('integrations')
      .update({ last_sync: new Date().toISOString() })
      .eq('id', integration.id)

    revalidatePath('/integracoes')
    revalidatePath('/metricas')
    return { success: true, synced }
  } catch (e) {
    return { error: `Erro ao sincronizar GA4: ${e instanceof Error ? e.message : 'Desconhecido'}` }
  }
}

// ============================================================
// SYNC — Shopify (REST Admin API)
// ============================================================

export async function syncShopify(workspaceId: string, days = 30) {
  const { error, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !adminSupabase) return { error: error ?? 'Erro de autenticação' }

  const { data: integration } = await adminSupabase
    .from('integrations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('platform', 'shopify')
    .eq('is_active', true)
    .single()

  if (!integration) return { error: 'Shopify não conectado' }

  const domain = integration.account_id
  if (!domain) return { error: 'Domínio da loja não configurado' }

  const since = new Date()
  since.setDate(since.getDate() - days)

  try {
    type ShopifyOrder = {
      created_at: string
      total_price: string
      line_items: Array<{ quantity: number }>
    }

    let allOrders: ShopifyOrder[] = []
    let nextUrl: string | null =
      `https://${domain}/admin/api/2024-01/orders.json?` +
      `status=any&created_at_min=${since.toISOString()}&limit=250`

    while (nextUrl) {
      const fetchUrl = nextUrl
      nextUrl = null
      const res: Response = await fetch(fetchUrl, {
        headers: { 'X-Shopify-Access-Token': integration.access_token },
      })
      if (!res.ok) {
        return { error: `Shopify API: ${res.statusText}` }
      }
      const json = await res.json() as { orders: ShopifyOrder[] }
      allOrders = allOrders.concat(json.orders ?? [])

      // Paginação via Link header
      const linkHeader = res.headers.get('link')
      const nextMatch = linkHeader?.match(/<([^>]+)>;\s*rel="next"/)
      if (nextMatch) nextUrl = nextMatch[1]
    }

    // Agregar por dia
    const dailyMap = new Map<string, { revenue: number; orders: number; items: number }>()
    for (const order of allOrders) {
      const dateStr = order.created_at.split('T')[0]
      const existing = dailyMap.get(dateStr) ?? { revenue: 0, orders: 0, items: 0 }
      existing.revenue += Number(order.total_price ?? 0)
      existing.orders += 1
      existing.items += (order.line_items ?? []).reduce((sum, li) => sum + li.quantity, 0)
      dailyMap.set(dateStr, existing)
    }

    let synced = 0
    for (const [dateStr, data] of dailyMap.entries()) {
      const avgTicket = data.orders > 0 ? data.revenue / data.orders : 0
      await adminSupabase
        .from('integration_metrics')
        .upsert(
          {
            workspace_id: workspaceId,
            platform: 'shopify' as const,
            metric_date: dateStr,
            data: {
              revenue: data.revenue,
              orders: data.orders,
              items_sold: data.items,
              avg_ticket: Math.round(avgTicket * 100) / 100,
            } as unknown as Json,
          },
          { onConflict: 'workspace_id,platform,metric_date' },
        )
      synced++
    }

    await adminSupabase
      .from('integrations')
      .update({ last_sync: new Date().toISOString() })
      .eq('id', integration.id)

    revalidatePath('/integracoes')
    revalidatePath('/metricas')
    return { success: true, synced }
  } catch (e) {
    return { error: `Erro ao sincronizar Shopify: ${e instanceof Error ? e.message : 'Desconhecido'}` }
  }
}

// ============================================================
// SYNC ALL (dispatch por plataforma)
// ============================================================

export async function syncIntegration(workspaceId: string, platform: IntegrationPlatform) {
  switch (platform) {
    case 'meta_ads': return syncMetaAds(workspaceId)
    case 'google_ads': return syncGoogleAds(workspaceId)
    case 'ga4': return syncGA4(workspaceId)
    case 'shopify': return syncShopify(workspaceId)
    default: return { error: 'Plataforma não suportada' }
  }
}

// ============================================================
// GET METRICS — busca por período
// ============================================================

export async function getMetrics(workspaceId: string, days = 30) {
  const { error, adminSupabase } = await requireWorkspaceMember(workspaceId)
  if (error || !adminSupabase) return []

  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().split('T')[0]

  const { data } = await adminSupabase
    .from('integration_metrics')
    .select('*')
    .eq('workspace_id', workspaceId)
    .gte('metric_date', sinceStr)
    .order('metric_date', { ascending: true })

  return data ?? []
}

// ============================================================
// GET METRICS SUMMARY — para injetar no contexto dos agentes
// ============================================================

export async function getMetricsSummary(workspaceId: string, days = 30) {
  const adminSupabase = createAdminClient()

  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().split('T')[0]

  const { data } = await adminSupabase
    .from('integration_metrics')
    .select('platform, data')
    .eq('workspace_id', workspaceId)
    .gte('metric_date', sinceStr)

  if (!data || data.length === 0) return null

  const summary: Record<string, Record<string, number>> = {}

  for (const row of data) {
    const platform = row.platform as string
    if (!summary[platform]) summary[platform] = {}
    const d = row.data as Record<string, number>
    for (const [key, value] of Object.entries(d)) {
      if (typeof value === 'number') {
        summary[platform][key] = (summary[platform][key] ?? 0) + value
      }
    }
  }

  return summary
}
