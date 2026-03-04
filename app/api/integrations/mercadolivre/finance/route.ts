import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMlToken } from '@/lib/ml-token'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  const { workspace_id, days } = await req.json()

  if (!workspace_id) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
  }

  const syncDays = days || 90
  const dateFrom = new Date(Date.now() - syncDays * 86400000).toISOString()

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
    const allOperations: any[] = []

    // ── 1. Fetch billing integration charges ──
    try {
      const chargesRes: Response = await fetch(
        `https://api.mercadolibre.com/billing/integration_charges?user_id=${sellerId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(15000),
        }
      )
      if (chargesRes.ok) {
        const chargesData = await chargesRes.json()
        const charges = chargesData.results || chargesData.data || []
        for (const charge of charges) {
          allOperations.push({
            workspace_id,
            operation_id: `charge_${charge.id || charge.charge_id}`,
            date: (charge.date_created || charge.created_at || '').split('T')[0],
            type: 'charge',
            status: charge.status || 'processed',
            amount: Number(charge.total_amount || charge.amount || 0),
            net_amount: Number(charge.net_amount || charge.total_amount || 0),
            fee_amount: Number(charge.fee_amount || 0),
            description: charge.description || charge.name || 'Integration charge',
            reference_id: charge.reference_id ? String(charge.reference_id) : null,
            currency: charge.currency_id || 'BRL',
            synced_at: new Date().toISOString(),
          })
        }
        console.log(`[ml/finance] ${charges.length} charges fetched`)
      }
    } catch (err: any) {
      console.error('[ml/finance] charges fetch error:', err.message)
    }

    // ── 2. Fetch finance operations (receivable) with pagination ──
    let offset = 0
    const limit = 50
    const MAX_RESULTS = 5000

    while (offset < MAX_RESULTS) {
      try {
        const url =
          `https://api.mercadolibre.com/account/finance/operations` +
          `?type=receivable&limit=${limit}&offset=${offset}` +
          `&date_from=${dateFrom}`

        const res: Response = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(15000),
        })

        if (!res.ok) {
          const errText = await res.text()
          console.error(`[ml/finance] operations offset=${offset} error:`, res.status, errText)
          break
        }

        const json = await res.json()
        const operations = json.results || []

        for (const op of operations) {
          allOperations.push({
            workspace_id,
            operation_id: String(op.id || op.operation_id),
            date: (op.date_created || op.created_at || '').split('T')[0],
            type: op.type || 'receivable',
            status: op.status || 'approved',
            amount: Number(op.amount || 0),
            net_amount: Number(op.net_credit_amount || op.net_amount || op.amount || 0),
            fee_amount: Number(op.fee_amount || op.marketplace_fee || 0),
            description: op.detail?.description || op.reason || '',
            reference_id: op.reference_id ? String(op.reference_id) : null,
            currency: op.currency_id || 'BRL',
            synced_at: new Date().toISOString(),
          })
        }

        console.log(`[ml/finance] offset=${offset}: ${operations.length} operations, total: ${allOperations.length}`)

        const total = json.paging?.total ?? 0
        if (offset + limit >= total || operations.length === 0) break
        offset += limit
      } catch (err: any) {
        console.error(`[ml/finance] operations fetch error at offset=${offset}:`, err.message)
        break
      }
    }

    // ── 3. Upsert in batches ──
    let synced = 0
    if (allOperations.length > 0) {
      for (let i = 0; i < allOperations.length; i += 200) {
        const batch = allOperations.slice(i, i + 200)
        const { error: upsertErr } = await (adminSupabase as any)
          .from('ml_finance_operations')
          .upsert(batch, { onConflict: 'workspace_id,operation_id' })
        if (upsertErr) {
          console.error('[ml/finance] upsert error:', upsertErr.message)
        } else {
          synced += batch.length
        }
      }
    }

    return NextResponse.json({
      synced,
      total_operations: allOperations.length,
      days: syncDays,
    })
  } catch (err: any) {
    console.error('[ml/finance] error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
