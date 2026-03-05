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
  const { workspace_id, force } = await req.json()

  if (!workspace_id) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
  }

  try {
    const accessToken = await getMlToken(workspace_id)

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

    // Smart sync: if last_finance_sync exists, fetch last 2 days only; otherwise 6 months
    // force: true bypasses smart sync and pulls full 6 months
    const lastFinanceSync = force ? null : integration.metadata.last_finance_sync
    let monthChunks: { from: string; to: string; label: string }[]

    if (lastFinanceSync) {
      const twoDaysAgo = new Date(Date.now() - 2 * 86400000)
      const now = new Date()
      monthChunks = [{
        from: twoDaysAgo.toISOString().split('T')[0] + 'T00:00:00.000-00:00',
        to: now.toISOString().split('T')[0] + 'T23:59:59.999-00:00',
        label: 'last-2-days',
      }]
    } else {
      monthChunks = getMonthChunks(6)
    }

    // Use collections/search (only endpoint that works without special permissions)
    // No date filters supported — fetch all and filter client-side
    console.log(`[ml/finance-sync] fetching collections for seller ${sellerId}`)

    const allCollections: any[] = []
    let offset = 0
    const limit = 50
    let debugInfo: any = null

    while (true) {
      const url =
        `https://api.mercadolibre.com/collections/search` +
        `?seller_id=${sellerId}` +
        `&offset=${offset}&limit=${limit}`

      const res: Response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(15000),
      })

      if (!res.ok) {
        const errText = await res.text()
        console.error(`[ml/finance-sync] offset=${offset} error:`, res.status, errText)
        break
      }

      const json = await res.json()

      if (offset === 0) {
        debugInfo = {
          paging: json.paging,
          first_result_keys: json.results?.[0] ? Object.keys(json.results[0]) : [],
          first_collection_keys: json.results?.[0]?.collection ? Object.keys(json.results[0].collection) : [],
        }
      }

      const results = json.results || []
      for (const r of results) {
        const col = r.collection || r
        allCollections.push(col)
      }

      const total = json.paging?.total ?? 0
      if (offset + limit >= total || offset + limit >= 10000 || results.length === 0) break
      offset += limit

      await delay(200)
    }

    console.log(`[ml/finance-sync] fetched ${allCollections.length} collections total`)

    // Filter by date range and group by month chunks
    let totalSynced = 0
    const monthResults: { month: string; operations: number }[] = []

    for (const chunk of monthChunks) {
      const chunkFrom = chunk.from.split('T')[0]
      const chunkTo = chunk.to.split('T')[0]

      const monthOps = allCollections.filter((col: any) => {
        const createdAt = col.date_created || col.date_approved || ''
        const date = createdAt.split('T')[0]
        return date >= chunkFrom && date <= chunkTo
      })

      const opRows = monthOps.map((col: any) => {
        const createdAt = col.date_created || col.date_approved || ''
        const date = createdAt ? createdAt.split('T')[0] : chunk.from.split('T')[0]

        return {
          workspace_id,
          operation_id: String(col.id),
          date,
          type: col.payment_type || col.operation_type || 'payment',
          status: col.status || 'approved',
          amount: Number(col.transaction_amount || col.total_paid_amount || 0),
          net_amount: Number(col.net_received_amount || col.transaction_amount || 0),
          fee_amount: Number(col.marketplace_fee || 0),
          description: col.reason || col.description || '',
          reference_id: col.external_reference ? String(col.external_reference) : null,
          currency: col.currency_id || 'BRL',
        }
      }).filter((r: any) => r.operation_id)

      let monthSynced = 0
      if (opRows.length > 0) {
        for (let i = 0; i < opRows.length; i += 200) {
          const batch = opRows.slice(i, i + 200)
          const { error: upsertErr } = await (adminSupabase as any)
            .from('ml_finance_operations')
            .upsert(batch, { onConflict: 'workspace_id,operation_id' })
          if (upsertErr) {
            console.error(`[ml/finance-sync] ${chunk.label} upsert error:`, upsertErr.message)
          } else {
            monthSynced += batch.length
          }
        }
      }

      totalSynced += monthSynced
      monthResults.push({ month: chunk.label, operations: monthSynced })
      console.log(`[ml/finance-sync] month ${chunk.label}: ${monthSynced} operations`)
    }

    // Update last_finance_sync in metadata
    await (adminSupabase as any)
      .from('workspace_integrations')
      .update({
        metadata: { ...integration.metadata, last_finance_sync: new Date().toLocaleDateString('sv-SE') },
      })
      .eq('workspace_id', workspace_id)
      .eq('provider', 'mercadolivre')

    return NextResponse.json({
      synced: totalSynced,
      months_processed: monthResults.length,
      months: monthResults,
      smart: !!lastFinanceSync,
      total_collections_fetched: allCollections.length,
      ...(debugInfo && { _debug: debugInfo }),
    })
  } catch (err: any) {
    console.error('[ml/finance-sync] error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
