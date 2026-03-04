import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMlToken } from '@/lib/ml-token'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

function getMonthChunks(months: number): { from: string; to: string; label: string }[] {
  const chunks: { from: string; to: string; label: string }[] = []
  const now = new Date()

  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = i === 0
      ? now
      : new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59)

    const from = start.toISOString().split('T')[0] + 'T00:00:00.000-00:00'
    const to = end.toISOString().split('T')[0] + 'T23:59:59.999-00:00'
    const label = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`

    chunks.push({ from, to, label })
  }

  return chunks
}

export async function POST(req: NextRequest) {
  const { workspace_id, months, days } = await req.json()

  if (!workspace_id) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
  }

  // Support both months and days params
  const syncMonths = days ? Math.max(1, Math.ceil(days / 30)) : (months || 6)

  try {
    const accessToken = await getMlToken(workspace_id)

    // Get seller_id and check last_sync
    const { data: integration } = await (adminSupabase as any)
      .from('workspace_integrations')
      .select('metadata')
      .eq('workspace_id', workspace_id)
      .eq('provider', 'mercadolivre')
      .eq('status', 'active')
      .single()

    if (!integration?.metadata?.seller_id) {
      return NextResponse.json({ error: 'Seller ID not found' }, { status: 404 })
    }

    const sellerId = integration.metadata.seller_id
    // Smart sync: if last_sync exists, only sync last 1 month; otherwise use requested months
    const lastSync = integration.metadata.last_sync
    const effectiveMonths = lastSync && !months && !days ? 1 : syncMonths
    const monthChunks = getMonthChunks(effectiveMonths)

    console.log(`[ml/sync] smart sync: last_sync=${lastSync || 'none'}, months=${effectiveMonths}`)
    let totalSynced = 0
    const monthResults: { month: string; orders: number }[] = []
    const upsertErrors: string[] = []

    for (const chunk of monthChunks) {
      const monthOrders: any[] = []
      let offset = 0
      const limit = 50

      // Paginate orders for this month
      while (true) {
        const url =
          `https://api.mercadolibre.com/orders/search?seller=${sellerId}` +
          `&order.date_created.from=${chunk.from}` +
          `&order.date_created.to=${chunk.to}` +
          `&sort=date_desc&limit=${limit}&offset=${offset}`

        const res: Response = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(15000),
        })

        if (!res.ok) {
          const errText = await res.text()
          console.error(`[ml/sync] ${chunk.label} offset=${offset} error:`, res.status, errText)
          break
        }

        const json = await res.json()
        const orders = json.results || []
        monthOrders.push(...orders)

        const total = json.paging?.total ?? 0
        if (offset + limit >= total || orders.length === 0) break
        offset += limit

        await delay(200)
      }

      // Parse orders (no billing_info — fees come from finance-sync)
      const orderRows = monthOrders.map((order: any) => {
        const revenue = Number(order.total_amount || 0)
        const createdAt = order.date_created || ''
        const date = createdAt.split('T')[0] || ''

        const items = (order.order_items || []).map((item: any) => ({
          item_id: String(item.item?.id || ''),
          title: item.item?.title || '',
          quantity: Number(item.quantity || 1),
          unit_price: Number(item.unit_price || 0),
          sku: item.item?.seller_sku || null,
        }))

        const payment = order.payments?.[0] || {}

        return {
          workspace_id,
          order_id: String(order.id),
          date,
          status: order.status || 'unknown',
          revenue,
          shipping_cost: 0,
          marketplace_fee: 0,
          net_revenue: revenue,
          payment_method: payment.payment_method_id || null,
          payment_status: payment.status || null,
          buyer_id: String(order.buyer?.id || ''),
          buyer_nickname: order.buyer?.nickname || '',
          items,
          shipping_id: order.shipping?.id ? String(order.shipping.id) : null,
          currency: order.currency_id || 'BRL',
        }
      })

      // Upsert in batches
      let monthSynced = 0
      console.log(`[ml/sync] ${chunk.label}: ${orderRows.length} orders to upsert`)
      if (orderRows.length > 0) {
        console.log(`[ml/sync] sample row:`, JSON.stringify(orderRows[0], null, 2))
        for (let i = 0; i < orderRows.length; i += 200) {
          const batch = orderRows.slice(i, i + 200)
          try {
            const { data: upsertData, error: upsertErr } = await (adminSupabase as any)
              .from('ml_orders')
              .upsert(batch, { onConflict: 'workspace_id,order_id' })
              .select('order_id')
            if (upsertErr) {
              console.error(`[ml/sync] UPSERT ERROR full object:`, JSON.stringify(upsertErr, null, 2))
              console.error(`[ml/sync] UPSERT ERROR details:`, {
                month: chunk.label,
                batchStart: i,
                batchSize: batch.length,
                message: upsertErr.message,
                code: upsertErr.code,
                details: upsertErr.details,
                hint: upsertErr.hint,
                status: upsertErr.status,
              })
              console.error(`[ml/sync] sample row keys:`, Object.keys(batch[0]))
              console.error(`[ml/sync] sample row values:`, JSON.stringify(batch[0], null, 2))
              upsertErrors.push(`${chunk.label} batch ${i}: ${upsertErr.message} | code: ${upsertErr.code} | details: ${upsertErr.details} | hint: ${upsertErr.hint}`)
            } else {
              console.log(`[ml/sync] ${chunk.label} batch ${i}: upserted ${upsertData?.length ?? batch.length} rows`)
              monthSynced += batch.length
            }
          } catch (upsertCatchErr: any) {
            console.error(`[ml/sync] UPSERT EXCEPTION:`, upsertCatchErr)
            console.error(`[ml/sync] UPSERT EXCEPTION stack:`, upsertCatchErr?.stack)
            upsertErrors.push(`${chunk.label} batch ${i}: EXCEPTION: ${upsertCatchErr?.message}`)
          }
        }
      }

      totalSynced += monthSynced
      monthResults.push({ month: chunk.label, orders: monthSynced })
      console.log(`[ml/sync] month ${chunk.label}: ${monthSynced} orders`)

      await delay(200)
    }

    // Update last_sync in metadata
    await (adminSupabase as any)
      .from('workspace_integrations')
      .update({
        metadata: { ...integration.metadata, last_sync: new Date().toLocaleDateString('sv-SE') },
      })
      .eq('workspace_id', workspace_id)
      .eq('provider', 'mercadolivre')

    return NextResponse.json({
      synced: totalSynced,
      months_processed: monthResults.length,
      months: monthResults,
      smart: !!lastSync,
      ...(upsertErrors.length > 0 && { upsert_errors: upsertErrors }),
    })
  } catch (err: any) {
    console.error('[ml/sync] error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
