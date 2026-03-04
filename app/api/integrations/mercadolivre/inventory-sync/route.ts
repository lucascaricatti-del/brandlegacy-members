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
    const lastSync = force ? null : integration.metadata.last_inventory_sync

    console.log(`[ml/inventory-sync] start: last_inventory_sync=${lastSync || 'none'}`)

    // Step 1: Get all active item IDs
    const allItemIds: string[] = []
    let offset = 0
    const limit = 50

    while (true) {
      const url =
        `https://api.mercadolibre.com/users/${sellerId}/items/search` +
        `?status=active&limit=${limit}&offset=${offset}`

      const res: Response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(15000),
      })

      if (!res.ok) {
        const errText = await res.text()
        console.error(`[ml/inventory-sync] items/search error:`, res.status, errText)
        break
      }

      const json = await res.json()
      const results = json.results || []
      allItemIds.push(...results)

      const total = json.paging?.total ?? 0
      console.log(`[ml/inventory-sync] fetched ${allItemIds.length}/${total} item IDs`)

      if (offset + limit >= total || results.length === 0) break
      offset += limit

      await delay(200)
    }

    console.log(`[ml/inventory-sync] total active items: ${allItemIds.length}`)

    // Step 2: Fetch item details in batches of 20 (ML multiget)
    const inventoryRows: any[] = []

    for (let i = 0; i < allItemIds.length; i += 20) {
      const batch = allItemIds.slice(i, i + 20)
      const ids = batch.join(',')

      const res: Response = await fetch(
        `https://api.mercadolibre.com/items?ids=${ids}&attributes=id,title,seller_sku,available_quantity,initial_quantity,status`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(15000),
        },
      )

      if (!res.ok) {
        // Fallback: fetch one by one
        for (const itemId of batch) {
          try {
            const singleRes: Response = await fetch(
              `https://api.mercadolibre.com/items/${itemId}`,
              {
                headers: { Authorization: `Bearer ${accessToken}` },
                signal: AbortSignal.timeout(10000),
              },
            )
            if (singleRes.ok) {
              const item = await singleRes.json()
              inventoryRows.push({
                workspace_id,
                item_id: String(item.id),
                sku: item.seller_sku || null,
                title: (item.title || '').slice(0, 500),
                available_qty: Number(item.available_quantity || 0),
                total_qty: Number(item.initial_quantity || item.available_quantity || 0),
              })
            }
          } catch (e: any) {
            console.error(`[ml/inventory-sync] single item ${itemId} error:`, e.message)
          }
          await delay(100)
        }
        continue
      }

      const items = await res.json()

      for (const wrapper of items) {
        const item = wrapper.body || wrapper
        if (!item?.id) continue

        inventoryRows.push({
          workspace_id,
          item_id: String(item.id),
          sku: item.seller_sku || null,
          title: (item.title || '').slice(0, 500),
          available_qty: Number(item.available_quantity || 0),
          total_qty: Number(item.initial_quantity || item.available_quantity || 0),
        })
      }

      await delay(200)
    }

    // Step 3: Upsert into ml_inventory
    let totalSynced = 0
    if (inventoryRows.length > 0) {
      for (let i = 0; i < inventoryRows.length; i += 200) {
        const batch = inventoryRows.slice(i, i + 200)
        const { error: upsertErr } = await (adminSupabase as any)
          .from('ml_inventory')
          .upsert(batch, { onConflict: 'workspace_id,item_id' })
        if (upsertErr) {
          console.error(`[ml/inventory-sync] upsert error:`, upsertErr.message)
        } else {
          totalSynced += batch.length
        }
      }
    }

    // Update last_inventory_sync
    await (adminSupabase as any)
      .from('workspace_integrations')
      .update({
        metadata: { ...integration.metadata, last_inventory_sync: new Date().toLocaleDateString('sv-SE') },
      })
      .eq('workspace_id', workspace_id)
      .eq('provider', 'mercadolivre')

    console.log(`[ml/inventory-sync] done: ${totalSynced} items synced`)

    return NextResponse.json({
      synced: totalSynced,
      total_items_found: allItemIds.length,
      smart: !!lastSync,
    })
  } catch (err: any) {
    console.error('[ml/inventory-sync] error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
