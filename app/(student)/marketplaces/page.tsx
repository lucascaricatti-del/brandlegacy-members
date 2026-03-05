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

  // Fetch claims and inventory (orders are fetched client-side with period filter)
  let claims: any[] = []
  let inventory = { total_items: 0, total_stock: 0 }

  if (isConnected) {
    const [claimsRes, inventoryRes] = await Promise.all([
      (adminSupabase as any)
        .from('ml_claims')
        .select('claim_id, order_id, type, status, reason, amount, created_at_ml')
        .eq('workspace_id', ws.id),
      (adminSupabase as any)
        .from('ml_inventory')
        .select('available_qty, total_qty')
        .eq('workspace_id', ws.id),
    ])

    claims = claimsRes.data ?? []

    const invItems = inventoryRes.data ?? []
    inventory = {
      total_items: invItems.length,
      total_stock: invItems.reduce((s: number, i: any) => s + (i.available_qty || 0), 0),
    }
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
        claims={claims}
        inventory={inventory}
        isConnected={isConnected}
      />
    </div>
  )
}
