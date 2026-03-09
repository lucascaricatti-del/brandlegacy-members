import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PerformanceDashboardClient from './PerformanceDashboardClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Performance — BrandLegacy' }

export default async function PerformancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = createAdminClient()

  const { data: memberships } = await adminSupabase
    .from('workspace_members')
    .select('workspace_id, workspaces(id, name)')
    .eq('user_id', user.id)
    .eq('is_active', true)

  type WsMembership = {
    workspace_id: string
    workspaces: { id: string; name: string } | null
  }

  const workspaces = ((memberships ?? []) as unknown as WsMembership[])
    .map((m) => m.workspaces)
    .filter(Boolean) as { id: string; name: string }[]

  if (workspaces.length === 0) {
    return (
      <div className="animate-fade-in">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-primary">Performance</h1>
          <p className="text-text-secondary mt-1">Dashboard executivo.</p>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-16 text-center">
          <p className="text-text-muted">Você ainda não está vinculado a um workspace.</p>
        </div>
      </div>
    )
  }

  const ws = workspaces[0]

  const today = new Date()
  const currentDay = today.getDate()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const currentMonthLabel = today.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const since = new Date()
  since.setDate(since.getDate() - 180)
  const sinceStr = new Date(since.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [
    { data: yampiOrders },
    { data: metaAds },
    { data: googleAds },
    { data: shopifyMetrics },
    { data: ga4Metrics },
  ] = await Promise.all([
    (adminSupabase as any).from('yampi_orders').select('*')
      .eq('workspace_id', ws.id).gte('date', sinceStr).limit(10000),
    (adminSupabase as any).from('ads_metrics').select('*')
      .eq('workspace_id', ws.id).eq('provider', 'meta_ads')
      .gte('date', sinceStr).limit(5000),
    (adminSupabase as any).from('ads_metrics').select('*')
      .eq('workspace_id', ws.id).eq('provider', 'google_ads')
      .gte('date', sinceStr).limit(5000),
    (adminSupabase as any).from('ecommerce_metrics').select('*')
      .eq('workspace_id', ws.id).eq('provider', 'shopify')
      .gte('date', sinceStr).limit(2000),
    (adminSupabase as any).from('ga4_metrics').select('*')
      .eq('workspace_id', ws.id).gte('date', sinceStr).limit(2000)
      .then((r: any) => ({ data: r.data ?? [] }))
      .catch(() => ({ data: [] })),
  ])

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Performance</h1>
        <p className="text-text-secondary mt-1">
          Dashboard executivo — {ws.name}
        </p>
      </div>
      <PerformanceDashboardClient
        workspaceId={ws.id}
        currentDay={currentDay}
        daysInMonth={daysInMonth}
        currentMonthLabel={currentMonthLabel}
        yampiOrders={(yampiOrders ?? []) as any[]}
        metaAds={(metaAds ?? []) as any[]}
        googleAds={(googleAds ?? []) as any[]}
        shopifyMetrics={(shopifyMetrics ?? []) as any[]}
        ga4Metrics={(ga4Metrics ?? []) as any[]}
      />
    </div>
  )
}
