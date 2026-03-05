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
    // Smart sync: if last_sync exists, always re-fetch last 3 days; otherwise full 180 days in monthly chunks
    const lastSync = integration.metadata.last_sync
    const useSmartSync = lastSync && !months && !days
    const effectiveMonths = useSmartSync ? 1 : syncMonths

    // For smart sync, override chunks to only cover last 3 days
    let monthChunks: { from: string; to: string; label: string }[]
    if (useSmartSync) {
      const now = new Date()
      const threeDaysAgo = new Date(now)
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
      monthChunks = [{
        from: threeDaysAgo.toISOString().split('T')[0] + 'T00:00:00.000-00:00',
        to: now.toISOString().split('T')[0] + 'T23:59:59.999-00:00',
        label: 'last-3-days',
      }]
    } else {
      monthChunks = getMonthChunks(effectiveMonths)
    }

    console.log(`[ml/sync] smart sync: last_sync=${lastSync || 'none'}, chunks=${monthChunks.length}, smart=${!!useSmartSync}`)
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

      // Fetch payment details in parallel batches (ML API has fee_details only on /v1/payments/{id})
      const paymentCache = new Map<string, any>()
      const shippingCache = new Map<string, any>()

      // Collect unique payment and shipping IDs
      const paymentIds: string[] = []
      const shippingIds: string[] = []
      for (const order of monthOrders) {
        const pid = order.payments?.[0]?.id
        if (pid && !paymentCache.has(String(pid))) {
          paymentIds.push(String(pid))
          paymentCache.set(String(pid), null) // mark as pending
        }
        const sid = order.shipping?.id
        if (sid && !shippingCache.has(String(sid))) {
          shippingIds.push(String(sid))
          shippingCache.set(String(sid), null)
        }
      }

      console.log(`[ml/sync] ${chunk.label}: fetching ${paymentIds.length} payment details + ${shippingIds.length} shipments`)

      // Fetch payment details in batches of 20 concurrently
      for (let b = 0; b < paymentIds.length; b += 20) {
        const batch = paymentIds.slice(b, b + 20)
        const results = await Promise.allSettled(
          batch.map(async (pid) => {
            const res = await fetch(`https://api.mercadopago.com/v1/payments/${pid}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
              signal: AbortSignal.timeout(10000),
            })
            if (!res.ok) return null
            return res.json()
          })
        )
        for (let i = 0; i < batch.length; i++) {
          const r = results[i]
          if (r.status === 'fulfilled' && r.value) {
            paymentCache.set(batch[i], r.value)
          }
        }
        if (b + 20 < paymentIds.length) await delay(300)
      }

      // Fetch shipment details in batches of 20 concurrently
      for (let b = 0; b < shippingIds.length; b += 20) {
        const batch = shippingIds.slice(b, b + 20)
        const results = await Promise.allSettled(
          batch.map(async (sid) => {
            const res = await fetch(`https://api.mercadolibre.com/shipments/${sid}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
              signal: AbortSignal.timeout(10000),
            })
            if (!res.ok) return null
            return res.json()
          })
        )
        for (let i = 0; i < batch.length; i++) {
          const r = results[i]
          if (r.status === 'fulfilled' && r.value) {
            shippingCache.set(batch[i], r.value)
          }
        }
        if (b + 20 < shippingIds.length) await delay(300)
      }

      // (debug logging removed — enrichment verified working)

      // Parse orders with fee breakdown from enriched data
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

        // Use enriched payment data from /v1/payments/{id}
        const paymentId = String(order.payments?.[0]?.id || '')
        const paymentDetail = paymentCache.get(paymentId) || {}
        const feeDetails: any[] = paymentDetail.fee_details || []

        let mlCommission = 0
        let mlFixedFee = 0
        let mlFinancingFee = 0

        if (feeDetails.length > 0) {
          for (const fee of feeDetails) {
            const t = fee.type || ''
            const amount = Math.abs(Number(fee.amount || 0))
            if (t === 'mercadopago_fee' || t === 'ml_fee') mlCommission += amount
            else if (t === 'fixed_fee' || t === 'listing_fee') mlFixedFee += amount
            else if (t === 'financing_fee' || t === 'financing') mlFinancingFee += amount
          }
        } else {
          // Fallback: derive total fee from transaction_details (transaction_amount - net_received_amount)
          const txDetails = paymentDetail.transaction_details
          if (txDetails?.net_received_amount != null && txDetails?.total_paid_amount != null) {
            mlCommission = Math.abs(Number(txDetails.total_paid_amount) - Number(txDetails.net_received_amount))
          } else if (paymentDetail.marketplace_fee) {
            mlCommission = Math.abs(Number(paymentDetail.marketplace_fee || 0))
          }
        }

        // Use enriched shipment data from /shipments/{id}
        const shippingId = String(order.shipping?.id || '')
        const shipmentDetail = shippingCache.get(shippingId) || {}
        const freteCusto = Number(
          shipmentDetail.shipping_option?.cost
          || shipmentDetail.base_cost
          || shipmentDetail.cost
          || 0
        )

        const totalFee = mlCommission + mlFixedFee + mlFinancingFee
        const netRevenueFull = revenue - mlCommission - mlFixedFee - mlFinancingFee - freteCusto

        return {
          workspace_id,
          order_id: String(order.id),
          date,
          status: order.status || 'unknown',
          revenue,
          shipping_cost: freteCusto,
          marketplace_fee: totalFee,
          net_revenue: revenue - totalFee,
          ml_commission: mlCommission,
          ml_fixed_fee: mlFixedFee,
          ml_financing_fee: mlFinancingFee,
          frete_custo: freteCusto,
          net_revenue_full: netRevenueFull,
          payment_method: order.payments?.[0]?.payment_method_id || null,
          payment_status: order.payments?.[0]?.status || null,
          buyer_id: String(order.buyer?.id || ''),
          buyer_nickname: order.buyer?.nickname || '',
          items,
          shipping_id: shippingId || null,
          currency: order.currency_id || 'BRL',
        }
      })

      // Upsert in batches
      let monthSynced = 0
      console.log(`[ml/sync] ${chunk.label}: ${orderRows.length} orders to upsert`)
      if (orderRows.length > 0) {
        for (let i = 0; i < orderRows.length; i += 200) {
          const batch = orderRows.slice(i, i + 200)
          try {
            const { error: upsertErr } = await (adminSupabase as any)
              .from('ml_orders')
              .upsert(batch, { onConflict: 'workspace_id,order_id' })
            if (upsertErr) {
              console.error(`[ml/sync] upsert error ${chunk.label} batch ${i}:`, upsertErr.message)
              upsertErrors.push(`${chunk.label} batch ${i}: ${upsertErr.message}`)
            } else {
              monthSynced += batch.length
            }
          } catch (upsertCatchErr: any) {
            console.error(`[ml/sync] upsert exception:`, upsertCatchErr?.message)
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
