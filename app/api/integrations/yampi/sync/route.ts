import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWorkspaceAccess } from '@/lib/api-auth'
import { parseYampiOrder, aggregateOrdersToMetrics } from '@/lib/yampi/parser'

export const maxDuration = 300 // 5 min (Vercel Pro)

const ALIAS = 'denavita-vitaminas-e-suplementos-ltda'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const yampiHeaders = {
  'User-Token': process.env.YAMPI_TOKEN!,
  'User-Secret-Key': process.env.YAMPI_SECRET_KEY!,
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'User-Agent': 'BrandLegacy/1.0',
}

export async function POST(req: NextRequest) {
  const { workspace_id, date_from, date_to } = await req.json()

  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data: integration } = await (supabase as any)
    .from('workspace_integrations')
    .select('status')
    .eq('workspace_id', workspace_id)
    .eq('provider', 'yampi')
    .eq('status', 'active')
    .single()

  if (!integration) {
    return NextResponse.json({ error: 'Yampi not connected' }, { status: 404 })
  }

  const fallbackSince = new Date(Date.now() - 180 * 86400000)
  const since = date_from || fallbackSince.toLocaleDateString('sv-SE')
  const until = date_to || new Date().toLocaleDateString('sv-SE')

  // yampi sync started

  try {
    // ── 1. Fetch all orders paginated ──
    const allOrders: any[] = []
    let page = 1
    const MAX_PAGES = 200

    while (page <= MAX_PAGES) {
      const url =
        `https://api.yampi.io/v2/${ALIAS}/orders?limit=100&page=${page}` +
        `&created_at_gteq=${since}&created_at_lteq=${until}` +
        `&include=items,transactions`

      const res: Response = await fetch(url, {
        headers: yampiHeaders,
        signal: AbortSignal.timeout(15000),
      })

      if (!res.ok) {
        const errText = await res.text()
        console.error(`[yampi/sync] page ${page} error:`, res.status, errText)
        break
      }

      const json = await res.json()
      const orders = json.data || []
      allOrders.push(...orders)

      // Check if there are more pages
      const lastPage = json.meta?.pagination?.last_page ?? json.meta?.last_page ?? page
      if (page >= lastPage || orders.length === 0) break
      page++
    }

    // ── Guard: if API returned nothing, preserve existing metrics ──
    if (allOrders.length === 0) {
      console.warn('[yampi/sync] API returned 0 orders — skipping metrics update to preserve data')
      return NextResponse.json({
        synced: 0,
        total_orders: 0,
        period: { since, until },
        message: 'API unavailable or returned 0 orders — metrics preserved',
      })
    }

    // ── 2. Parse and upsert individual orders ──
    const orderRows = allOrders.map((order: any) => parseYampiOrder(order, workspace_id))

    // Upsert orders in batches
    if (orderRows.length > 0) {
      for (let i = 0; i < orderRows.length; i += 200) {
        const batch = orderRows.slice(i, i + 200)
        const { error: upsertErr } = await (supabase as any)
          .from('yampi_orders')
          .upsert(batch, { onConflict: 'workspace_id,order_id' })
        if (upsertErr) {
          console.error(`[yampi/sync] upsert orders batch error:`, upsertErr.message)
        }
      }
    }

    // ── 3. Aggregate by day for yampi_metrics ──
    const metricRows = aggregateOrdersToMetrics(orderRows, workspace_id)

    // Delete then insert metrics
    await (supabase as any)
      .from('yampi_metrics')
      .delete()
      .eq('workspace_id', workspace_id)
      .gte('date', since)
      .lte('date', until)

    if (metricRows.length > 0) {
      for (let i = 0; i < metricRows.length; i += 500) {
        const batch = metricRows.slice(i, i + 500)
        const { error: insertErr } = await (supabase as any)
          .from('yampi_metrics')
          .insert(batch)
        if (insertErr) {
          console.error(`[yampi/sync] insert metrics error:`, insertErr.message)
        }
      }
    }

    return NextResponse.json({
      synced: metricRows.length,
      total_orders: allOrders.length,
      period: { since, until },
    })
  } catch (err: any) {
    console.error('[yampi/sync] unexpected error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
