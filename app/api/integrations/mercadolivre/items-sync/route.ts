import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMlToken } from '@/lib/ml-token'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function POST(req: NextRequest) {
  const { workspace_id } = await req.json()

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

    // Step 1: Get all active item IDs (paginated)
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
        console.error(`[ml/items-sync] items/search error:`, res.status)
        break
      }

      const json = await res.json()
      const results = json.results || []
      allItemIds.push(...results)

      const total = json.paging?.total ?? 0
      if (offset + limit >= total || results.length === 0) break
      offset += limit
      await delay(200)
    }

    console.log(`[ml/items-sync] found ${allItemIds.length} active items`)

    // Step 2: Fetch item details in batches of 20 (ML multi-get)
    const inventoryRows: any[] = []

    for (let i = 0; i < allItemIds.length; i += 20) {
      const batch = allItemIds.slice(i, i + 20)
      const ids = batch.join(',')

      const res: Response = await fetch(
        `https://api.mercadolibre.com/items?ids=${ids}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(15000),
        },
      )

      if (!res.ok) {
        console.error(`[ml/items-sync] multiget error:`, res.status)
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
              inventoryRows.push(parseItem(workspace_id, item))
            }
          } catch (e: any) {
            console.error(`[ml/items-sync] single item ${itemId} error:`, e.message)
          }
          await delay(100)
        }
        continue
      }

      const items = await res.json()
      for (const wrapper of items) {
        const item = wrapper.body || wrapper
        if (!item?.id) continue
        inventoryRows.push(parseItem(workspace_id, item))
      }

      await delay(300)
    }

    console.log(`[ml/items-sync] parsed ${inventoryRows.length} items`)

    // Step 3: Upsert into ml_inventory
    let totalSynced = 0
    if (inventoryRows.length > 0) {
      for (let i = 0; i < inventoryRows.length; i += 200) {
        const batch = inventoryRows.slice(i, i + 200)
        const { error: upsertErr } = await (adminSupabase as any)
          .from('ml_inventory')
          .upsert(batch, { onConflict: 'workspace_id,item_id' })
        if (upsertErr) {
          console.error(`[ml/items-sync] upsert error:`, upsertErr.message)
        } else {
          totalSynced += batch.length
        }
      }
    }

    // Update last_inventory_sync timestamp
    await (adminSupabase as any)
      .from('workspace_integrations')
      .update({
        metadata: { ...integration.metadata, last_inventory_sync: new Date().toISOString() },
      })
      .eq('workspace_id', workspace_id)
      .eq('provider', 'mercadolivre')

    console.log(`[ml/items-sync] done: ${totalSynced} items synced`)

    return NextResponse.json({
      synced: totalSynced,
      total_found: allItemIds.length,
    })
  } catch (err: any) {
    console.error('[ml/items-sync] error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function parseItem(workspace_id: string, item: any) {
  // Extract SKU from attributes array
  const skuAttr = (item.attributes || []).find((a: any) => a.id === 'SELLER_SKU')
  const sku = skuAttr?.value_name || item.seller_sku || null

  return {
    workspace_id,
    item_id: String(item.id),
    sku,
    title: (item.title || '').slice(0, 500),
    available_qty: Number(item.available_quantity || 0),
    sold_qty: Number(item.sold_quantity || 0),
    price: Number(item.price || 0),
    inventory_id: item.inventory_id || null,
    logistic_type: item.shipping?.logistic_type || null,
    health: item.health != null ? Number(item.health) : null,
    listing_type_id: item.listing_type_id || null,
    thumbnail: item.thumbnail || null,
    updated_at: new Date().toISOString(),
  }
}
