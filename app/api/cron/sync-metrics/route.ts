import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export const maxDuration = 300 // 5 min (Vercel Pro)

export async function GET(req: NextRequest) {
  // ── Auth: CRON_SECRET ──
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const threeDaysAgo = new Date(now)
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
  const dateFrom = threeDaysAgo.toISOString().split('T')[0]
  const dateTo = now.toISOString().split('T')[0]

  console.log(`[cron/sync-metrics] starting sync for ${dateFrom} → ${dateTo}`)

  // ── Busca todas as integrações ativas ──
  const { data: integrations, error: fetchErr } = await (supabase as any)
    .from('workspace_integrations')
    .select('workspace_id, provider, access_token, account_id, refresh_token, token_expires_at')
    .eq('status', 'active')

  if (fetchErr || !integrations?.length) {
    console.log('[cron/sync-metrics] no active integrations found', fetchErr?.message)
    return NextResponse.json({ synced: { meta: 0, google: 0, shopify: 0 }, message: 'No active integrations' })
  }

  // Agrupa por workspace
  const byWorkspace = new Map<string, any[]>()
  for (const int of integrations) {
    const list = byWorkspace.get(int.workspace_id) ?? []
    list.push(int)
    byWorkspace.set(int.workspace_id, list)
  }

  const results = { meta: 0, google: 0, shopify: 0, yampi: 0 }
  const errors: string[] = []

  for (const [wsId, wsIntegrations] of byWorkspace) {
    for (const integration of wsIntegrations) {
      try {
        if (integration.provider === 'meta_ads') {
          const synced = await syncMeta(wsId, integration, dateFrom, dateTo)
          results.meta += synced
          console.log(`[cron/sync-metrics] meta OK: ws=${wsId} synced=${synced}`)
        } else if (integration.provider === 'google_ads') {
          const synced = await syncGoogle(wsId, integration, dateFrom, dateTo)
          results.google += synced
          console.log(`[cron/sync-metrics] google OK: ws=${wsId} synced=${synced}`)
        } else if (integration.provider === 'shopify') {
          const synced = await syncShopify(wsId, integration, dateFrom, dateTo)
          results.shopify += synced
          console.log(`[cron/sync-metrics] shopify OK: ws=${wsId} synced=${synced}`)
        } else if (integration.provider === 'yampi') {
          const synced = await syncYampi(wsId, dateFrom, dateTo)
          results.yampi += synced
          console.log(`[cron/sync-metrics] yampi OK: ws=${wsId} synced=${synced}`)
        }
      } catch (err: any) {
        const msg = `${integration.provider} ws=${wsId}: ${err.message}`
        console.error(`[cron/sync-metrics] ERROR`, msg)
        errors.push(msg)
      }
    }
  }

  console.log(`[cron/sync-metrics] done`, results, errors.length ? { errors } : '')
  return NextResponse.json({ synced: results, ...(errors.length ? { errors } : {}) })
}

// ── Meta Ads ──
async function syncMeta(workspaceId: string, integration: any, since: string, until: string): Promise<number> {
  const accountIdClean = integration.account_id.replace(/^act_/, '')

  let url: string | null =
    `https://graph.facebook.com/v21.0/act_${accountIdClean}/insights?` +
    `fields=campaign_id,campaign_name,adset_id,adset_name,spend,impressions,clicks,actions,action_values,cpm,cpc,ctr` +
    `&time_range={"since":"${since}","until":"${until}"}` +
    `&time_increment=1&level=campaign&limit=500` +
    `&access_token=${integration.access_token}`

  const allRows: any[] = []

  while (url) {
    const res: Response = await fetch(url, { signal: AbortSignal.timeout(30000) })
    const data = await res.json()
    if (data.error) throw new Error(data.error.message)

    for (const row of data.data || []) {
      const actions = row.actions || []
      const purchases = actions.find((a: any) => a.action_type === 'purchase')
      const purchaseValue = row.action_values?.find((a: any) => a.action_type === 'purchase')
      const pageViews = actions.find((a: any) => a.action_type === 'landing_page_view') || actions.find((a: any) => a.action_type === 'page_view')
      const outboundClicks = actions.find((a: any) => a.action_type === 'link_click')
      const addToCart = actions.find((a: any) => a.action_type === 'add_to_cart')
      const initiateCheckout = actions.find((a: any) => a.action_type === 'initiate_checkout')
      const addPaymentInfo = actions.find((a: any) => a.action_type === 'add_payment_info')
      const spend = parseFloat(row.spend || '0')
      const revenue = parseFloat(purchaseValue?.value || '0')

      allRows.push({
        workspace_id: workspaceId, provider: 'meta_ads', date: row.date_start,
        campaign_id: row.campaign_id, campaign_name: row.campaign_name,
        adset_id: row.adset_id || null, adset_name: row.adset_name || null,
        spend, impressions: parseInt(row.impressions || '0'), clicks: parseInt(row.clicks || '0'),
        conversions: parseInt(purchases?.value || '0'), revenue,
        cpm: parseFloat(row.cpm || '0'), cpc: parseFloat(row.cpc || '0'), ctr: parseFloat(row.ctr || '0'),
        roas: spend > 0 ? revenue / spend : 0,
        page_views: parseInt(pageViews?.value || '0'),
        outbound_clicks: parseInt(outboundClicks?.value || '0'),
        add_to_cart: parseInt(addToCart?.value || '0'),
        initiate_checkout: parseInt(initiateCheckout?.value || '0'),
        add_payment_info: parseInt(addPaymentInfo?.value || '0'),
        synced_at: new Date().toISOString(),
      })
    }

    url = data.paging?.next ?? null
  }

  if (allRows.length > 0) {
    await supabase.from('ads_metrics').delete()
      .eq('workspace_id', workspaceId).eq('provider', 'meta_ads')
      .gte('date', since).lte('date', until)

    for (let i = 0; i < allRows.length; i += 500) {
      await supabase.from('ads_metrics').insert(allRows.slice(i, i + 500))
    }
  }

  return allRows.length
}

// ── Google Ads ──
async function syncGoogle(workspaceId: string, integration: any, since: string, until: string): Promise<number> {
  // Refresh token if needed
  let accessToken = integration.access_token
  if (integration.token_expires_at && new Date(integration.token_expires_at) <= new Date()) {
    if (!integration.refresh_token) throw new Error('Token expired, no refresh_token')
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: integration.refresh_token,
        client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
        client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
        grant_type: 'refresh_token',
      }),
    })
    const data = await res.json()
    if (data.error) throw new Error(`Token refresh failed: ${JSON.stringify(data.error)}`)
    accessToken = data.access_token
    await supabase.from('workspace_integrations').update({
      access_token: data.access_token,
      token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    }).eq('workspace_id', workspaceId).eq('provider', 'google_ads')
  }

  const customerId = integration.account_id.replace(/-/g, '')
  const loginCustomerId = process.env.GOOGLE_ADS_MCC_ID?.replace(/-/g, '') || customerId

  const query = `SELECT campaign.id, campaign.name, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value, metrics.ctr, metrics.average_cpc, metrics.average_cpm, segments.date FROM campaign WHERE segments.date BETWEEN '${since}' AND '${until}' AND campaign.status != 'REMOVED' ORDER BY segments.date`

  const searchRes = await fetch(
    `https://googleads.googleapis.com/v23/customers/${customerId}/googleAds:searchStream`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
        'login-customer-id': loginCustomerId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(30000),
    },
  )
  const searchData = await searchRes.json()
  if (searchData.error) throw new Error(searchData.error.message)

  const results = searchData[0]?.results ?? searchData.results ?? []
  const rows = results.map((r: any) => {
    const spend = (r.metrics?.costMicros || 0) / 1_000_000
    const revenue = parseFloat(r.metrics?.conversionsValue || '0')
    return {
      workspace_id: workspaceId, provider: 'google_ads', date: r.segments?.date,
      campaign_id: r.campaign?.id?.toString(), campaign_name: r.campaign?.name,
      adset_id: null, adset_name: null, spend,
      impressions: parseInt(r.metrics?.impressions || '0'),
      clicks: parseInt(r.metrics?.clicks || '0'),
      conversions: Math.round(parseFloat(r.metrics?.conversions || '0')),
      revenue, cpm: (r.metrics?.averageCpm || 0) / 1_000_000,
      cpc: (r.metrics?.averageCpc || 0) / 1_000_000,
      ctr: parseFloat(r.metrics?.ctr || '0') * 100,
      roas: spend > 0 ? revenue / spend : 0,
      synced_at: new Date().toISOString(),
    }
  }).filter((r: any) => r.date && r.campaign_id)

  if (rows.length > 0) {
    await supabase.from('ads_metrics').delete()
      .eq('workspace_id', workspaceId).eq('provider', 'google_ads')
      .gte('date', since).lte('date', until)
    await supabase.from('ads_metrics').insert(rows)
  }

  return rows.length
}

// ── Shopify ──
async function syncShopify(workspaceId: string, integration: any, since: string, until: string): Promise<number> {
  const domain = integration.account_id
  const allOrders: any[] = []
  let pageUrl: string | null =
    `https://${domain}/admin/api/2026-01/orders.json?status=any&financial_status=paid&created_at_min=${since}T00:00:00Z&created_at_max=${until}T23:59:59Z&limit=250`

  while (pageUrl) {
    const res: Response = await fetch(pageUrl, {
      headers: { 'X-Shopify-Access-Token': integration.access_token },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`Shopify API ${res.status}`)

    const data = await res.json()
    allOrders.push(...(data.orders || []))

    const linkHeader = res.headers.get('link')
    const nextMatch = linkHeader?.match(/<([^>]+)>;\s*rel="next"/)
    pageUrl = nextMatch ? nextMatch[1] : null
  }

  const dailyMap = new Map<string, { revenue: number; orders: number; items_sold: number }>()
  for (const order of allOrders) {
    const date = order.created_at?.slice(0, 10)
    if (!date) continue
    const existing = dailyMap.get(date) ?? { revenue: 0, orders: 0, items_sold: 0 }
    existing.revenue += parseFloat(order.subtotal_price || order.total_price || '0')
    existing.orders += 1
    existing.items_sold += (order.line_items || []).reduce((sum: number, li: any) => sum + (li.quantity || 0), 0)
    dailyMap.set(date, existing)
  }

  const rows = Array.from(dailyMap.entries()).map(([date, d]) => ({
    workspace_id: workspaceId, provider: 'shopify', date,
    revenue: d.revenue, orders: d.orders, items_sold: d.items_sold,
    avg_ticket: d.orders > 0 ? d.revenue / d.orders : 0,
    sessions: 0, conversion_rate: 0,
    synced_at: new Date().toISOString(),
  }))

  await supabase.from('ecommerce_metrics').delete()
    .eq('workspace_id', workspaceId).eq('provider', 'shopify')
    .gte('date', since).lte('date', until)

  if (rows.length > 0) {
    for (let i = 0; i < rows.length; i += 500) {
      await supabase.from('ecommerce_metrics').insert(rows.slice(i, i + 500))
    }
  }

  return rows.length
}

// ── Yampi ──
const YAMPI_ALIAS = 'denavita-vitaminas-e-suplementos-ltda'
const yampiHeaders = {
  'User-Token': process.env.YAMPI_TOKEN!,
  'User-Secret-Key': process.env.YAMPI_SECRET_KEY!,
  'Accept': 'application/json',
}

async function syncYampi(workspaceId: string, since: string, until: string): Promise<number> {
  const allOrders: any[] = []
  let page = 1

  while (page <= 200) {
    const url =
      `https://api.yampi.io/v2/${YAMPI_ALIAS}/orders?limit=100&page=${page}` +
      `&created_at_gteq=${since}&created_at_lteq=${until}` +
      `&include=items,transactions`

    const res: Response = await fetch(url, {
      headers: yampiHeaders,
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`Yampi API ${res.status}`)

    const json = await res.json()
    const orders = json.data || []
    allOrders.push(...orders)

    const lastPage = json.meta?.pagination?.last_page ?? json.meta?.last_page ?? page
    if (page >= lastPage || orders.length === 0) break
    page++
  }

  const orderRows = allOrders.map((order: any) => {
    const statusAlias = order.status?.data?.alias ?? order.status_alias ?? 'unknown'
    const paymentMethod = order.transactions?.data?.[0]?.payment?.data?.alias ?? null
    const couponCode = order.promocode?.data?.code ?? order.search?.data?.discount_names?.[0] ?? null
    const state = order.shipping_address?.data?.state ?? order.shipping_address?.data?.uf ?? null
    const createdAtRaw = order.created_at?.date ?? order.created_at ?? ''
    const date = typeof createdAtRaw === 'string' ? createdAtRaw.split(' ')[0].split('T')[0] : ''
    const free_shipping = Number(order.value_shipment ?? 1) === 0
    const items = (order.items?.data ?? []).map((item: any) => ({
      product_id: String(item.product_id ?? item.id ?? ''),
      name: item.sku?.data?.title ?? item.item_sku ?? item.name ?? '',
      quantity: Number(item.quantity) || 1,
      price: Number(item.price) || 0,
    }))

    return {
      workspace_id: workspaceId,
      order_id: String(order.number ?? order.id),
      date,
      status: statusAlias,
      payment_method: paymentMethod,
      coupon_code: couponCode,
      state,
      revenue: Number(order.value_total) || 0,
      items,
      free_shipping,
      synced_at: new Date().toISOString(),
    }
  })

  if (orderRows.length > 0) {
    for (let i = 0; i < orderRows.length; i += 200) {
      await (supabase as any).from('yampi_orders').upsert(
        orderRows.slice(i, i + 200),
        { onConflict: 'workspace_id,order_id' },
      )
    }
  }

  const dailyMap = new Map<string, {
    paid_revenue: number; paid_count: number; cancelled_count: number;
    pending_count: number; total_count: number; pix_total: number; pix_paid: number;
  }>()

  for (const o of orderRows) {
    if (!o.date) continue
    const d = dailyMap.get(o.date) ?? { paid_revenue: 0, paid_count: 0, cancelled_count: 0, pending_count: 0, total_count: 0, pix_total: 0, pix_paid: 0 }
    d.total_count++
    const isPaid = o.status === 'paid' || o.status === 'invoiced' || o.status === 'shipped' || o.status === 'delivered'
    if (isPaid) { d.paid_revenue += o.revenue; d.paid_count++ }
    else if (o.status === 'cancelled' || o.status === 'refused') { d.cancelled_count++ }
    else { d.pending_count++ }
    if (o.payment_method === 'pix') { d.pix_total++; if (isPaid) d.pix_paid++ }
    dailyMap.set(o.date, d)
  }

  const metricRows = Array.from(dailyMap.entries()).map(([date, d]) => ({
    workspace_id: workspaceId, date,
    revenue: d.paid_revenue, orders: d.paid_count,
    avg_ticket: d.paid_count > 0 ? d.paid_revenue / d.paid_count : 0,
    checkout_conversion: d.total_count > 0 ? Math.round((d.paid_count / d.total_count) * 100 * 100) / 100 : 0,
    pix_approval_rate: d.pix_total > 0 ? Math.round((d.pix_paid / d.pix_total) * 100 * 100) / 100 : 0,
    cancellation_rate: d.total_count > 0 ? Math.round((d.cancelled_count / d.total_count) * 100 * 100) / 100 : 0,
    synced_at: new Date().toISOString(),
  }))

  await (supabase as any).from('yampi_metrics').delete()
    .eq('workspace_id', workspaceId).gte('date', since).lte('date', until)

  if (metricRows.length > 0) {
    for (let i = 0; i < metricRows.length; i += 500) {
      await (supabase as any).from('yampi_metrics').insert(metricRows.slice(i, i + 500))
    }
  }

  return metricRows.length
}
