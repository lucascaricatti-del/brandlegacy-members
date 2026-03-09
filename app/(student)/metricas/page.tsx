import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import MetricsClient from './MetricsClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Métricas — BrandLegacy' }

export default async function MetricasPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
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
          <h1 className="text-2xl font-bold text-text-primary">Métricas</h1>
          <p className="text-text-secondary mt-1">Dashboard de performance.</p>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-16 text-center">
          <p className="text-text-muted">Você ainda não está vinculado a um workspace.</p>
        </div>
      </div>
    )
  }

  const ws = workspaces[0]

  // Busca integrações ativas
  const { data: metaIntegration } = await (adminSupabase as any)
    .from('workspace_integrations')
    .select('status, account_id, account_name')
    .eq('workspace_id', ws.id)
    .eq('provider', 'meta_ads')
    .eq('status', 'active')
    .single()

  const { data: googleIntegration } = await (adminSupabase as any)
    .from('workspace_integrations')
    .select('status, account_id, account_name')
    .eq('workspace_id', ws.id)
    .eq('provider', 'google_ads')
    .eq('status', 'active')
    .single()

  const { data: shopifyIntegration } = await (adminSupabase as any)
    .from('workspace_integrations')
    .select('status, account_id, account_name')
    .eq('workspace_id', ws.id)
    .eq('provider', 'shopify')
    .eq('status', 'active')
    .single()

  const { data: yampiIntegration } = await (adminSupabase as any)
    .from('workspace_integrations')
    .select('status, account_id, account_name')
    .eq('workspace_id', ws.id)
    .eq('provider', 'yampi')
    .eq('status', 'active')
    .single()

  const isMetaConnected = !!metaIntegration?.account_id
  const isGoogleConnected = !!googleIntegration?.account_id
  const isShopifyConnected = !!shopifyIntegration?.account_id
  const isYampiConnected = !!yampiIntegration?.account_id

  // Busca 180 dias de métricas
  const since = new Date()
  since.setDate(since.getDate() - 180)
  const sinceStr = since.toISOString().slice(0, 10)

  const [
    { data: metaMetrics },
    { data: googleMetrics },
    { data: shopifyMetrics },
    { data: yampiMetrics },
    { data: yampiOrders },
  ] = await Promise.all([
    (adminSupabase as any)
      .from('ads_metrics')
      .select('*')
      .eq('workspace_id', ws.id)
      .eq('provider', 'meta_ads')
      .gte('date', sinceStr)
      .order('date', { ascending: false })
      .limit(5000),
    (adminSupabase as any)
      .from('ads_metrics')
      .select('*')
      .eq('workspace_id', ws.id)
      .eq('provider', 'google_ads')
      .gte('date', sinceStr)
      .order('date', { ascending: false })
      .limit(5000),
    (adminSupabase as any)
      .from('ecommerce_metrics')
      .select('*')
      .eq('workspace_id', ws.id)
      .eq('provider', 'shopify')
      .gte('date', sinceStr)
      .order('date', { ascending: false })
      .limit(2000),
    (adminSupabase as any)
      .from('yampi_metrics')
      .select('*')
      .eq('workspace_id', ws.id)
      .gte('date', sinceStr)
      .order('date', { ascending: false })
      .limit(365),
    (adminSupabase as any)
      .from('yampi_orders')
      .select('*')
      .eq('workspace_id', ws.id)
      .gte('date', sinceStr)
      .order('date', { ascending: false })
      .limit(10000),
  ])

  const accountNames = [...new Set(
    [metaIntegration?.account_name, googleIntegration?.account_name, shopifyIntegration?.account_name, yampiIntegration?.account_name]
      .filter((name): name is string => !!name && name !== ws.name)
  )].join(' · ')

  // DEBUG SERVER — check Vercel logs
  console.log('[METRICAS]', {
    ws: ws.id,
    sinceStr,
    isYampiConnected,
    yampiIntegration: yampiIntegration ? { account_id: yampiIntegration.account_id, status: yampiIntegration.status } : null,
    yampiMetrics: yampiMetrics?.length ?? 0,
    yampiOrders: yampiOrders?.length ?? 0,
    meta: metaMetrics?.length ?? 0,
    google: googleMetrics?.length ?? 0,
    shopify: shopifyMetrics?.length ?? 0,
  })

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Métricas</h1>
        <p className="text-text-secondary mt-1">
          Dashboard de performance — {ws.name}
          {accountNames && ` · ${accountNames}`}
        </p>
      </div>
      <MetricsClient
        workspaceId={ws.id}
        isMetaConnected={isMetaConnected}
        isGoogleConnected={isGoogleConnected}
        isShopifyConnected={isShopifyConnected}
        isYampiConnected={isYampiConnected}
        metaMetrics={(metaMetrics ?? []) as any[]}
        googleMetrics={(googleMetrics ?? []) as any[]}
        shopifyMetrics={(shopifyMetrics ?? []) as any[]}
        yampiMetrics={(yampiMetrics ?? []) as any[]}
        yampiOrders={(yampiOrders ?? []) as any[]}
        initialTab={(tab as 'meta' | 'google' | 'yampi' | 'influenciadores') || undefined}
      />
    </div>
  )
}
