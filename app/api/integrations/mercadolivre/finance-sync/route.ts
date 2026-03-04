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
  const { workspace_id, months } = await req.json()

  if (!workspace_id) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
  }

  const syncMonths = months || 6

  try {
    const accessToken = await getMlToken(workspace_id)

    // Get seller_id
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
    const monthChunks = getMonthChunks(syncMonths)
    let totalSynced = 0
    const monthResults: { month: string; operations: number }[] = []

    for (const chunk of monthChunks) {
      const monthOps: any[] = []
      let offset = 0
      const limit = 50

      // Paginate billing charges for this month
      while (true) {
        const url =
          `https://api.mercadolibre.com/billing/integration_charges` +
          `?user_id=${sellerId}` +
          `&date_from=${chunk.from}` +
          `&date_to=${chunk.to}` +
          `&limit=${limit}&offset=${offset}`

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
        const results = json.results || json.data || []
        monthOps.push(...results)

        const total = json.paging?.total ?? json.total ?? 0
        if (offset + limit >= total || results.length === 0) break
        offset += limit

        await delay(200)
      }

      // Parse and upsert
      const opRows = monthOps.map((op: any) => {
        const createdAt = op.date_created || op.created_at || ''
        const date = createdAt.split('T')[0] || ''

        return {
          workspace_id,
          operation_id: String(op.id || op.charge_id || op.operation_id),
          date,
          type: op.type || op.charge_type || 'charge',
          status: op.status || 'processed',
          amount: Number(op.total_amount || op.amount || 0),
          net_amount: Number(op.net_amount || op.total_amount || op.amount || 0),
          fee_amount: Number(op.fee_amount || op.marketplace_fee || 0),
          description: op.description || op.name || op.detail?.description || '',
          reference_id: op.reference_id || op.order_id ? String(op.reference_id || op.order_id) : null,
          currency: op.currency_id || 'BRL',
          synced_at: new Date().toISOString(),
        }
      })

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

    return NextResponse.json({
      synced: totalSynced,
      months_processed: monthResults.length,
      months: monthResults,
    })
  } catch (err: any) {
    console.error('[ml/finance-sync] error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
