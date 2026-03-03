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
          <p className="text-text-secondary mt-1">Dashboard executivo MTD.</p>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-16 text-center">
          <p className="text-text-muted">Você ainda não está vinculado a um workspace.</p>
        </div>
      </div>
    )
  }

  const ws = workspaces[0]

  // ── Date ranges for MTD comparison ──
  const today = new Date()
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toLocaleDateString('sv-SE')
  const todayStr = today.toLocaleDateString('sv-SE')
  const currentDay = today.getDate()

  // Previous month same period (e.g., today is Mar 3 → prev is Feb 1–3)
  const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const prevMonthStart = prevMonthDate.toLocaleDateString('sv-SE')
  const daysInPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0).getDate()
  const prevMonthSameDay = new Date(
    today.getFullYear(),
    today.getMonth() - 1,
    Math.min(currentDay, daysInPrevMonth),
  ).toLocaleDateString('sv-SE')

  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()

  // ── Fetch data for both periods ──
  const [
    { data: currentYampiOrders },
    { data: prevYampiOrders },
    { data: currentMetaAds },
    { data: prevMetaAds },
    { data: currentGoogleAds },
    { data: prevGoogleAds },
    { data: currentShopify },
    { data: prevShopify },
  ] = await Promise.all([
    (adminSupabase as any)
      .from('yampi_orders').select('*')
      .eq('workspace_id', ws.id)
      .gte('date', currentMonthStart).lte('date', todayStr)
      .limit(10000),
    (adminSupabase as any)
      .from('yampi_orders').select('*')
      .eq('workspace_id', ws.id)
      .gte('date', prevMonthStart).lte('date', prevMonthSameDay)
      .limit(10000),
    (adminSupabase as any)
      .from('ads_metrics').select('*')
      .eq('workspace_id', ws.id).eq('provider', 'meta_ads')
      .gte('date', currentMonthStart).lte('date', todayStr)
      .limit(5000),
    (adminSupabase as any)
      .from('ads_metrics').select('*')
      .eq('workspace_id', ws.id).eq('provider', 'meta_ads')
      .gte('date', prevMonthStart).lte('date', prevMonthSameDay)
      .limit(5000),
    (adminSupabase as any)
      .from('ads_metrics').select('*')
      .eq('workspace_id', ws.id).eq('provider', 'google_ads')
      .gte('date', currentMonthStart).lte('date', todayStr)
      .limit(5000),
    (adminSupabase as any)
      .from('ads_metrics').select('*')
      .eq('workspace_id', ws.id).eq('provider', 'google_ads')
      .gte('date', prevMonthStart).lte('date', prevMonthSameDay)
      .limit(5000),
    (adminSupabase as any)
      .from('ecommerce_metrics').select('*')
      .eq('workspace_id', ws.id).eq('provider', 'shopify')
      .gte('date', currentMonthStart).lte('date', todayStr)
      .limit(2000),
    (adminSupabase as any)
      .from('ecommerce_metrics').select('*')
      .eq('workspace_id', ws.id).eq('provider', 'shopify')
      .gte('date', prevMonthStart).lte('date', prevMonthSameDay)
      .limit(2000),
  ])

  const currentMonthLabel = today.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const prevMonthLabel = prevMonthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Performance</h1>
        <p className="text-text-secondary mt-1">
          Dashboard executivo MTD — {ws.name}
        </p>
      </div>
      <PerformanceDashboardClient
        workspaceId={ws.id}
        currentDay={currentDay}
        daysInMonth={daysInMonth}
        currentMonthLabel={currentMonthLabel}
        prevMonthLabel={prevMonthLabel}
        currentYampiOrders={(currentYampiOrders ?? []) as any[]}
        prevYampiOrders={(prevYampiOrders ?? []) as any[]}
        currentMetaAds={(currentMetaAds ?? []) as any[]}
        prevMetaAds={(prevMetaAds ?? []) as any[]}
        currentGoogleAds={(currentGoogleAds ?? []) as any[]}
        prevGoogleAds={(prevGoogleAds ?? []) as any[]}
        currentShopify={(currentShopify ?? []) as any[]}
        prevShopify={(prevShopify ?? []) as any[]}
      />
    </div>
  )
}
