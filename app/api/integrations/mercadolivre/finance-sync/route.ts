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

    console.log(`[ml/finance-sync] smart sync: last_finance_sync=${lastFinanceSync || 'none'}, chunks=${monthChunks.length}`)
    let totalSynced = 0
    const monthResults: { month: string; operations: number }[] = []

    let isFirstRequest = true

    for (const chunk of monthChunks) {
      const monthOps: any[] = []
      let offset = 0
      const limit = 50

      // Paginate money_movements for this period
      while (true) {
        const url =
          `https://api.mercadolibre.com/mercadopago_account/movements/search` +
          `?range=date_created` +
          `&begin_date=${encodeURIComponent(chunk.from)}` +
          `&end_date=${encodeURIComponent(chunk.to)}` +
          `&offset=${offset}&limit=${limit}`

        const res: Response = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(15000),
        })

        if (!res.ok) {
          const errText = await res.text()
          console.error(`[ml/finance-sync] ${chunk.label} offset=${offset} error:`, res.status, errText)
          break
        }

        const json = await res.json()

        // Log first raw response
        if (isFirstRequest) {
          console.log(`[ml/finance-sync] RAW FIRST RESPONSE:`, JSON.stringify(json).slice(0, 2000))
          isFirstRequest = false
        }

        const results = json.results || json.data || []
        monthOps.push(...results)

        const total = json.paging?.total ?? json.total ?? 0
        // ML API limits offset to 10000
        if (offset + limit >= total || offset + limit >= 10000 || results.length === 0) break
        offset += limit

        await delay(200)
      }

      // Parse and upsert
      const opRows = monthOps.map((op: any) => {
        const createdAt = op.date_created || op.date || ''
        const date = createdAt ? createdAt.split('T')[0] : null

        return {
          workspace_id,
          operation_id: String(op.id || op.movement_id || op.reference_id || `${chunk.label}-${offset}`),
          date: date || chunk.from.split('T')[0],
          type: op.type || op.movement_type || 'movement',
          status: op.status || 'processed',
          amount: Number(op.amount || op.transaction_amount || op.total_amount || 0),
          net_amount: Number(op.net_amount || op.amount || 0),
          fee_amount: Number(op.fee_amount || op.marketplace_fee || 0),
          description: op.description || op.detail?.description || op.reason || '',
          reference_id: op.reference_id ? String(op.reference_id) : null,
          currency: op.currency_id || 'BRL',
        }
      }).filter((r: any) => r.date)

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

      await delay(200)
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
    })
  } catch (err: any) {
    console.error('[ml/finance-sync] error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
