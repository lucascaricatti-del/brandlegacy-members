import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import MarketplacesClient from './MarketplacesClient'

export const metadata = { title: 'Marketplaces — BrandLegacy' }

export default async function MarketplacesPage() {
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
          <h1 className="text-2xl font-bold text-text-primary">Marketplaces</h1>
          <p className="text-text-secondary mt-1">Dashboard de vendas nos marketplaces.</p>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-16 text-center">
          <p className="text-text-muted">Você ainda não está vinculado a um workspace.</p>
        </div>
      </div>
    )
  }

  const ws = workspaces[0]

  // Check if ML is connected
  const { data: mlIntegration } = await (adminSupabase as any)
    .from('workspace_integrations')
    .select('id, status')
    .eq('workspace_id', ws.id)
    .eq('provider', 'mercadolivre')
    .eq('status', 'active')
    .single()

  const isConnected = !!mlIntegration

  // Fetch last 90 days of orders (client will filter by period)
  let orders: any[] = []
  if (isConnected) {
    const since = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]
    const { data } = await (adminSupabase as any)
      .from('ml_orders')
      .select('order_id, date, status, revenue, net_revenue, marketplace_fee, buyer_nickname, items, currency')
      .eq('workspace_id', ws.id)
      .gte('date', since)
      .order('date', { ascending: false })
    orders = data ?? []
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Marketplaces</h1>
        <p className="text-text-secondary mt-1">
          Dashboard de vendas e métricas dos marketplaces.
        </p>
      </div>
      <MarketplacesClient
        workspaceId={ws.id}
        orders={orders}
        isConnected={isConnected}
      />
    </div>
  )
}
