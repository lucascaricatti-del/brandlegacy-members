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
    const res = await fetch(
      `https://graph.facebook.com/v21.0/act_${integration.account_id.replace(/^act_/, '')}/insights?` +
      `fields=campaign_id,campaign_name,adset_id,adset_name,spend,impressions,clicks,actions,action_values,cpm,cpc,ctr` +
      `&time_range={"since":"${since}","until":"${until}"}` +
      `&time_increment=1` +
      `&level=campaign` +
      `&limit=500` +
      `&access_token=${integration.access_token}`
    )
    const data = await res.json()

    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 400 })
    }

    const rows = (data.data || []).map((row: any) => {
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

    if (rows.length > 0) {
      await supabase
        .from('ads_metrics')
        .delete()
        .eq('workspace_id', workspace_id)
        .eq('provider', 'meta_ads')
        .gte('date', since)
        .lte('date', until)
      await supabase.from('ads_metrics').insert(rows)
    }

    return NextResponse.json({ synced: rows.length, period: { since, until } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
