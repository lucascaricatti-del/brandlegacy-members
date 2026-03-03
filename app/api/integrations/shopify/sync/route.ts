import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  const { workspace_id, date_from, date_to } = await req.json()

  if (!workspace_id) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
  }

  const { data: integration } = await supabase
    .from('workspace_integrations')
    .select('access_token, account_id')
    .eq('workspace_id', workspace_id)
    .eq('provider', 'shopify')
    .eq('status', 'active')
    .single()

  if (!integration?.account_id) {
    return NextResponse.json({ error: 'Shopify not connected' }, { status: 404 })
  }

  const domain = integration.account_id
  const since = date_from || new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0]
  const until = date_to || new Date().toISOString().split('T')[0]

  console.log('[shopify/sync] workspace_id:', workspace_id, 'domain:', domain)

  try {
    const allOrders: any[] = []
    let pageUrl: string | null =
      `https://${domain}/admin/api/2026-01/orders.json?status=any&financial_status=paid&created_at_min=${since}T00:00:00Z&created_at_max=${until}T23:59:59Z&limit=250`
    let pageNum = 0
    const MAX_PAGES = 100

    console.log('[shopify/sync] first URL:', pageUrl)

    while (pageUrl && pageNum < MAX_PAGES) {
      pageNum++
      const pageRes: Response = await fetch(pageUrl, {
        headers: { 'X-Shopify-Access-Token': integration.access_token },
        signal: AbortSignal.timeout(10000),
      })

      console.log(`[shopify/sync] page ${pageNum} status:`, pageRes.status, 'orders so far:', allOrders.length)

      if (!pageRes.ok) {
        const errText = await pageRes.text()
        console.error('[shopify/sync] API error:', pageRes.status, errText)
        return NextResponse.json({ error: `Shopify API error: ${pageRes.status}` }, { status: 400 })
      }

      const data: any = await pageRes.json()
      allOrders.push(...(data.orders || []))

      // Parse Link header for pagination
      const linkHeader: string | null = pageRes.headers.get('link')
      const nextMatch = linkHeader?.match(/<([^>]+)>;\s*rel="next"/)
      pageUrl = nextMatch ? nextMatch[1] : null
    }

    if (pageNum >= MAX_PAGES) {
      console.warn(`[shopify/sync] hit MAX_PAGES (${MAX_PAGES}), stopping pagination`)
    }

    // Aggregate orders by day
    const dailyMap = new Map<string, { revenue: number; orders: number; items_sold: number }>()

    for (const order of allOrders) {
      const date = order.created_at?.slice(0, 10)
      if (!date) continue

      const existing = dailyMap.get(date) ?? { revenue: 0, orders: 0, items_sold: 0 }
      existing.revenue += parseFloat(order.total_price || '0')
      existing.orders += 1
      existing.items_sold += (order.line_items || []).reduce((sum: number, li: any) => sum + (li.quantity || 0), 0)
      dailyMap.set(date, existing)
    }

    const rows = Array.from(dailyMap.entries()).map(([date, d]) => ({
      workspace_id,
      provider: 'shopify',
      date,
      revenue: d.revenue,
      orders: d.orders,
      items_sold: d.items_sold,
      avg_ticket: d.orders > 0 ? d.revenue / d.orders : 0,
      sessions: 0,
      conversion_rate: 0,
      synced_at: new Date().toISOString(),
    }))

    if (rows.length > 0) {
      await supabase
        .from('ecommerce_metrics')
        .delete()
        .eq('workspace_id', workspace_id)
        .eq('provider', 'shopify')
        .gte('date', since)
        .lte('date', until)

      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500)
        const { error: insertError } = await supabase.from('ecommerce_metrics').insert(batch)
        if (insertError) {
          console.error(`[shopify/sync] insert batch failed:`, insertError.message)
        }
      }
    }

    return NextResponse.json({ synced: rows.length, total_orders: allOrders.length, period: { since, until } })
  } catch (err: any) {
    console.error('[shopify/sync] unexpected error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
