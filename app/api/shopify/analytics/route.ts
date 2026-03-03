import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  ShopifyIntegration,
  ShopifyQLResponse,
  ShopifyOrder,
  ShopifyProduct,
  ShopifyAnalyticsResponse,
} from '@/types/shopify'

export async function GET() {
  try {
    // ── Auth ──
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Shop credentials ──
    const admin = createAdminClient()
    const { data: integration } = await (admin as any)
      .from('shopify_integrations')
      .select('shop_domain, access_token')
      .eq('user_id', user.id)
      .single()

    if (!integration) {
      return NextResponse.json(
        { error: 'Shopify not connected' },
        { status: 401 },
      )
    }

    const { shop_domain, access_token } = integration as ShopifyIntegration

    const now = new Date()
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const periodStart = thirtyDaysAgo.toISOString().split('T')[0]
    const periodEnd = now.toISOString().split('T')[0]

    let sessions: number | null = null
    let warning: string | undefined

    // ── 1. Sessions via ShopifyQL GraphQL ──
    try {
      const gqlRes = await fetch(
        `https://${shop_domain}/admin/api/2024-01/graphql.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': access_token,
          },
          body: JSON.stringify({
            query: `{
              shopifyqlQuery(query: "FROM sessions SHOW sessions SINCE -30d UNTIL today") {
                tableData { rowData columns { name dataType } }
                parseErrors { code message field }
              }
            }`,
          }),
          signal: AbortSignal.timeout(15000),
        },
      )

      const gqlData: ShopifyQLResponse = await gqlRes.json()

      if (gqlData.errors?.length) {
        console.error('[shopify/analytics] GraphQL errors:', gqlData.errors)
      } else if (gqlData.data?.shopifyqlQuery.parseErrors?.length) {
        console.error(
          '[shopify/analytics] ShopifyQL parseErrors:',
          gqlData.data.shopifyqlQuery.parseErrors,
        )
      } else if (gqlData.data?.shopifyqlQuery.tableData) {
        const { columns, rowData } = gqlData.data.shopifyqlQuery.tableData
        const sessionsIdx = columns.findIndex(
          (c) => c.name.toLowerCase() === 'sessions',
        )
        if (sessionsIdx !== -1 && rowData.length > 0) {
          sessions = rowData.reduce(
            (sum, row) => sum + (parseInt(row[sessionsIdx], 10) || 0),
            0,
          )
        }
      }
    } catch (err: any) {
      console.error('[shopify/analytics] sessions error:', err.message)
    }

    // ── 2. Paid orders via REST with cursor pagination ──
    const allOrders: ShopifyOrder[] = []

    try {
      let pageUrl: string | null =
        `https://${shop_domain}/admin/api/2024-01/orders.json?` +
        `financial_status=paid&status=any&limit=250` +
        `&fields=id,created_at,total_price,total_line_items_price,line_items,customer` +
        `&created_at_min=${periodStart}T00:00:00Z&created_at_max=${periodEnd}T23:59:59Z`

      while (pageUrl) {
        const res: Response = await fetch(pageUrl, {
          headers: { 'X-Shopify-Access-Token': access_token },
          signal: AbortSignal.timeout(15000),
        })

        if (!res.ok) {
          const errText = await res.text()
          console.error(
            '[shopify/analytics] orders error:',
            res.status,
            errText,
          )
          warning = `Orders pagination stopped at ${allOrders.length} orders (HTTP ${res.status})`
          break
        }

        const data = await res.json()
        allOrders.push(...(data.orders || []))

        // Cursor pagination via Link header
        const linkHeader = res.headers.get('link')
        const nextMatch = linkHeader?.match(/<([^>]+)>;\s*rel="next"/)
        pageUrl = nextMatch ? nextMatch[1] : null
      }
    } catch (err: any) {
      console.error('[shopify/analytics] orders pagination error:', err.message)
      warning = `Orders pagination error: ${err.message}`
    }

    // ── 3. Products report from line_items ──
    const productMap = new Map<
      string,
      {
        product_id: string
        title: string
        variant: string
        quantity_sold: number
        revenue: number
        order_ids: Set<string>
      }
    >()

    for (const order of allOrders) {
      for (const item of order.line_items || []) {
        const key = `${item.product_id ?? 'unknown'}-${item.variant_title ?? ''}`
        const existing = productMap.get(key)

        if (existing) {
          existing.quantity_sold += item.quantity
          existing.revenue += parseFloat(item.price) * item.quantity
          existing.order_ids.add(String(order.id))
        } else {
          productMap.set(key, {
            product_id: String(item.product_id ?? 'unknown'),
            title: item.title,
            variant: item.variant_title ?? '',
            quantity_sold: item.quantity,
            revenue: parseFloat(item.price) * item.quantity,
            order_ids: new Set([String(order.id)]),
          })
        }
      }
    }

    const top_products: ShopifyProduct[] = Array.from(productMap.values())
      .map((p) => ({
        product_id: p.product_id,
        title: p.title,
        variant: p.variant,
        quantity_sold: p.quantity_sold,
        revenue: Math.round(p.revenue * 100) / 100,
        orders_count: p.order_ids.size,
      }))
      .sort((a, b) => b.revenue - a.revenue)

    // ── 4. Metrics + conversion rate ──
    const paidCount = allOrders.length
    const revenue = allOrders.reduce(
      (sum, o) => sum + parseFloat(o.total_price || '0'),
      0,
    )
    const average_order_value =
      paidCount > 0 ? Math.round((revenue / paidCount) * 100) / 100 : 0
    const conversion_rate =
      sessions !== null && sessions > 0
        ? Math.round((paidCount / sessions) * 100 * 100) / 100
        : null

    // ── 5. Unified response ──
    const response: ShopifyAnalyticsResponse = {
      period: { start: periodStart, end: periodEnd },
      sessions,
      orders: { total: paidCount, paid: paidCount },
      revenue: Math.round(revenue * 100) / 100,
      average_order_value,
      conversion_rate,
      top_products,
      ...(warning ? { warning } : {}),
    }

    return NextResponse.json(response)
  } catch (err: any) {
    console.error('[shopify/analytics] unexpected error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
