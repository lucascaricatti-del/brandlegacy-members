import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  const { workspace_id, date_from, date_to } = await req.json()

  if (!workspace_id) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
  }

  const { data: integration } = await supabase
    .from('workspace_integrations')
    .select('access_token, account_id')
    .eq('workspace_id', workspace_id)
    .eq('provider', 'meta_ads')
    .eq('status', 'active')
    .single()

  if (!integration?.account_id) {
    return NextResponse.json({ error: 'Meta not connected or no account' }, { status: 404 })
  }

  const since = date_from || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
  const until = date_to || new Date().toISOString().split('T')[0]

  try {
    const accountIdClean = integration.account_id.replace(/^act_/, '')
    console.log('[meta/sync] account_id raw:', integration.account_id, '→ clean:', accountIdClean)
    console.log('[meta/sync] period:', since, '→', until)
    console.log('[meta/sync] token length:', integration.access_token?.length ?? 0)

    // Primeira página
    let url: string | null =
      `https://graph.facebook.com/v21.0/act_${accountIdClean}/insights?` +
      `fields=campaign_id,campaign_name,adset_id,adset_name,spend,impressions,clicks,actions,action_values,cpm,cpc,ctr` +
      `&time_range={"since":"${since}","until":"${until}"}` +
      `&time_increment=1` +
      `&level=campaign` +
      `&limit=500` +
      `&access_token=${integration.access_token}`

    const allRows: any[] = []
    let pageNum = 0

    // Segue paginação até esgotar
    while (url) {
      pageNum++
      console.log(`[meta/sync] fetching page ${pageNum}...`)
      const pageRes: Response = await fetch(url)
      console.log(`[meta/sync] page ${pageNum} status:`, pageRes.status)
      const data: any = await pageRes.json()

      if (data.error) {
        console.error('[meta/sync] API error:', JSON.stringify(data.error))
        return NextResponse.json({ error: data.error.message }, { status: 400 })
      }

      console.log(`[meta/sync] page ${pageNum} data.data length:`, data.data?.length ?? 0, 'has next:', !!data.paging?.next)

      const pageRows = (data.data || []).map((row: any) => {
        const purchases = row.actions?.find((a: any) => a.action_type === 'purchase')
        const purchaseValue = row.action_values?.find((a: any) => a.action_type === 'purchase')
        const spend = parseFloat(row.spend || '0')
        const revenue = parseFloat(purchaseValue?.value || '0')

        return {
          workspace_id,
          provider: 'meta_ads',
          date: row.date_start,
          campaign_id: row.campaign_id,
          campaign_name: row.campaign_name,
          adset_id: row.adset_id || null,
          adset_name: row.adset_name || null,
          spend,
          impressions: parseInt(row.impressions || '0'),
          clicks: parseInt(row.clicks || '0'),
          conversions: parseInt(purchases?.value || '0'),
          revenue,
          cpm: parseFloat(row.cpm || '0'),
          cpc: parseFloat(row.cpc || '0'),
          ctr: parseFloat(row.ctr || '0'),
          roas: spend > 0 ? revenue / spend : 0,
          synced_at: new Date().toISOString(),
        }
      })

      allRows.push(...pageRows)

      // Próxima página via cursor
      url = data.paging?.next ?? null
    }

    if (allRows.length > 0) {
      // Delete dados antigos do período
      await supabase
        .from('ads_metrics')
        .delete()
        .eq('workspace_id', workspace_id)
        .eq('provider', 'meta_ads')
        .gte('date', since)
        .lte('date', until)

      // Insert em batches de 500 (limite seguro do Supabase)
      for (let i = 0; i < allRows.length; i += 500) {
        const batch = allRows.slice(i, i + 500)
        const { error: insertError } = await supabase.from('ads_metrics').insert(batch)
        if (insertError) {
          console.error(`[meta/sync] insert batch ${i}-${i + batch.length} failed:`, insertError.message)
        }
      }
    }

    console.log(`[meta/sync] OK: ${allRows.length} rows synced for workspace ${workspace_id}`)
    return NextResponse.json({ synced: allRows.length, period: { since, until } })
  } catch (err: any) {
    console.error('[meta/sync] unexpected error:', err.message, err.stack)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
