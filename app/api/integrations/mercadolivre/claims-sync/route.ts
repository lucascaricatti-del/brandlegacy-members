import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMlToken } from '@/lib/ml-token'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

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
    const lastSync = force ? null : integration.metadata.last_claims_sync

    console.log(`[ml/claims-sync] start: last_claims_sync=${lastSync || 'none'}`)

    // Paginate claims
    const allClaims: any[] = []
    let offset = 0
    const limit = 50
    let isFirstRequest = true

    while (true) {
      const url =
        `https://api.mercadolibre.com/claims/search` +
        `?seller_id=${sellerId}` +
        `&offset=${offset}&limit=${limit}`

      const res: Response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(15000),
      })

      if (!res.ok) {
        const errText = await res.text()
        console.error(`[ml/claims-sync] offset=${offset} error:`, res.status, errText)
        break
      }

      const json = await res.json()

      if (isFirstRequest) {
        console.log(`[ml/claims-sync] RAW FIRST RESPONSE:`, JSON.stringify(json).slice(0, 2000))
        isFirstRequest = false
      }

      const results = json.data || json.results || []
      allClaims.push(...results)

      const total = json.paging?.total ?? json.total ?? 0
      console.log(`[ml/claims-sync] fetched ${allClaims.length}/${total} claims`)

      if (offset + limit >= total || offset + limit >= 10000 || results.length === 0) break
      offset += limit

      await delay(200)
    }

    // Parse and upsert
    const claimRows = allClaims.map((claim: any) => {
      const createdAt = claim.date_created || claim.created_at || ''

      return {
        workspace_id,
        claim_id: String(claim.id || claim.claim_id),
        order_id: claim.resource_id ? String(claim.resource_id) : null,
        type: claim.type || claim.claim_type || 'unknown',
        status: claim.status || 'unknown',
        reason: claim.reason || claim.reason_id || '',
        amount: Number(claim.amount || claim.claim_amount || 0),
        resolution_type: claim.resolution?.reason || claim.resolution_type || null,
        resolution_status: claim.resolution?.status || claim.resolution_status || null,
        created_at_ml: createdAt || null,
      }
    }).filter((r: any) => r.claim_id)

    let totalSynced = 0
    if (claimRows.length > 0) {
      for (let i = 0; i < claimRows.length; i += 200) {
        const batch = claimRows.slice(i, i + 200)
        const { error: upsertErr } = await (adminSupabase as any)
          .from('ml_claims')
          .upsert(batch, { onConflict: 'workspace_id,claim_id' })
        if (upsertErr) {
          console.error(`[ml/claims-sync] upsert error:`, upsertErr.message)
        } else {
          totalSynced += batch.length
        }
      }
    }

    // Update last_claims_sync
    await (adminSupabase as any)
      .from('workspace_integrations')
      .update({
        metadata: { ...integration.metadata, last_claims_sync: new Date().toLocaleDateString('sv-SE') },
      })
      .eq('workspace_id', workspace_id)
      .eq('provider', 'mercadolivre')

    console.log(`[ml/claims-sync] done: ${totalSynced} claims synced`)

    return NextResponse.json({
      synced: totalSynced,
      total_found: allClaims.length,
      smart: !!lastSync,
    })
  } catch (err: any) {
    console.error('[ml/claims-sync] error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
