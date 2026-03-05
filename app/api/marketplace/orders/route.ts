import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  const { workspace_id, date_from, date_to } = await req.json()
  if (!workspace_id) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
  if (!date_from || !date_to) return NextResponse.json({ error: 'date_from and date_to required' }, { status: 400 })

  const [metricsRes, topRes] = await Promise.all([
    supabase.rpc('get_ml_metrics', {
      p_workspace_id: workspace_id,
      p_date_from: date_from,
      p_date_to: date_to,
    }),
    supabase.rpc('get_ml_top_products', {
      p_workspace_id: workspace_id,
      p_date_from: date_from,
      p_date_to: date_to,
    }),
  ])

  if (metricsRes.error) return NextResponse.json({ error: metricsRes.error.message }, { status: 500 })
  if (topRes.error) return NextResponse.json({ error: topRes.error.message }, { status: 500 })

  return NextResponse.json({
    metrics: metricsRes.data,
    top_products: topRes.data ?? [],
  })
}
