'use client'

import { useState, useMemo } from 'react'

type Order = {
  order_id: string
  date: string
  status: string
  revenue: number
  net_revenue: number
  marketplace_fee: number
  buyer_nickname: string
  items: any[]
  currency: string
}

type Claim = {
  claim_id: string
  order_id: string | null
  type: string
  status: string
  reason: string
  amount: number
  created_at_ml: string | null
}

type InventorySummary = {
  total_items: number
  total_stock: number
}

type Tab = 'mercadolivre' | 'shopee' | 'magalu' | 'netshoes'

const TABS: { id: Tab; name: string; color: string; textColor: string; icon: string; enabled: boolean }[] = [
  { id: 'mercadolivre', name: 'Mercado Livre', color: '#FFE600', textColor: '#2D3277', icon: 'ML', enabled: true },
  { id: 'shopee', name: 'Shopee', color: '#EE4D2D', textColor: '#fff', icon: 'SP', enabled: false },
  { id: 'magalu', name: 'Magalu', color: '#0086FF', textColor: '#fff', icon: 'MG', enabled: false },
  { id: 'netshoes', name: 'Netshoes', color: '#000000', textColor: '#fff', icon: 'NS', enabled: false },
]

const PERIODS = [
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function MarketplacesClient({
  workspaceId,
  orders,
  claims,
  inventory,
  isConnected,
}: {
  workspaceId: string
  orders: Order[]
  claims: Claim[]
  inventory: InventorySummary
  isConnected: boolean
}) {
  const [activeTab, setActiveTab] = useState<Tab>('mercadolivre')
  const [period, setPeriod] = useState(30)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const cutoff = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - period)
    return d.toISOString().split('T')[0]
  }, [period])

  const filtered = useMemo(() => {
    return orders.filter((o) => o.date >= cutoff)
  }, [orders, cutoff])

  const kpis = useMemo(() => {
    const totalRevenue = filtered.reduce((s, o) => s + o.revenue, 0)
    const totalOrders = filtered.length
    const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0
    const totalFee = filtered.reduce((s, o) => s + (o.marketplace_fee || 0), 0)
    const netRevenue = filtered.reduce((s, o) => s + (o.net_revenue || o.revenue), 0)
    return { totalRevenue, totalOrders, avgTicket, totalFee, netRevenue }
  }, [filtered])

  async function handleSync() {
    setSyncing(true); setSyncMsg(null)
    try {
      const res = await fetch('/api/integrations/mercadolivre/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId }),
      })
      const data = await res.json()
      if (data.error) setSyncMsg({ type: 'error', text: data.error })
      else {
        setSyncMsg({ type: 'success', text: `${data.synced} pedidos sincronizados!` })
        setTimeout(() => window.location.reload(), 1500)
      }
    } catch {
      setSyncMsg({ type: 'error', text: 'Erro ao sincronizar.' })
    }
    setSyncing(false)
  }

  const tab = TABS.find((t) => t.id === activeTab)!

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => t.enabled && setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === t.id
                ? 'bg-bg-surface text-text-primary border border-border'
                : t.enabled
                  ? 'text-text-muted hover:text-text-secondary hover:bg-bg-card'
                  : 'text-text-muted/50 cursor-not-allowed'
            }`}
            disabled={!t.enabled}
          >
            <span
              className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold"
              style={{ backgroundColor: t.color, color: t.textColor }}
            >
              {t.icon}
            </span>
            {t.name}
            {!t.enabled && <span className="text-[10px] bg-bg-surface px-1.5 py-0.5 rounded-full border border-border">Em breve</span>}
          </button>
        ))}
      </div>

      {/* ML Tab Content */}
      {activeTab === 'mercadolivre' && (
        <>
          {!isConnected ? (
            <div className="bg-bg-card border border-border rounded-xl p-12 text-center">
              <div className="w-16 h-16 rounded-xl flex items-center justify-center font-bold text-2xl mx-auto mb-4"
                style={{ backgroundColor: '#FFE600', color: '#2D3277' }}>ML</div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">Mercado Livre não conectado</h3>
              <p className="text-text-muted text-sm mb-4">
                Conecte sua conta na página de <a href="/integracoes" className="text-brand-gold hover:underline">Integrações</a> para visualizar métricas.
              </p>
            </div>
          ) : (
            <>
              {/* Period Filter + Sync */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex gap-1 bg-bg-card border border-border rounded-lg p-1">
                  {PERIODS.map((p) => (
                    <button
                      key={p.days}
                      onClick={() => setPeriod(p.days)}
                      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                        period === p.days
                          ? 'bg-brand-gold text-bg-base font-medium'
                          : 'text-text-muted hover:text-text-secondary'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  {syncMsg && (
                    <span className={`text-xs ${syncMsg.type === 'success' ? 'text-success' : 'text-error'}`}>
                      {syncMsg.text}
                    </span>
                  )}
                  <button onClick={handleSync} disabled={syncing}
                    className="px-3 py-1.5 text-sm rounded-lg border border-border text-text-secondary hover:bg-bg-hover transition-colors disabled:opacity-50">
                    {syncing ? 'Sincronizando...' : 'Atualizar dados'}
                  </button>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <KPICard label="Receita Bruta" value={formatBRL(kpis.totalRevenue)} />
                <KPICard label="Pedidos" value={kpis.totalOrders.toLocaleString('pt-BR')} />
                <KPICard label="Ticket Médio" value={formatBRL(kpis.avgTicket)} />
                <KPICard label="Taxas ML" value={formatBRL(kpis.totalFee)} />
                <KPICard label="Receita Líquida" value={formatBRL(kpis.netRevenue)} highlight />
              </div>

              {/* Inventory + Claims Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Inventory Card */}
                <div className="bg-bg-card border border-border rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-text-primary mb-3">Estoque</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-text-muted">Anúncios Ativos</p>
                      <p className="text-xl font-bold text-text-primary">{inventory.total_items.toLocaleString('pt-BR')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-text-muted">Unidades em Estoque</p>
                      <p className="text-xl font-bold text-text-primary">{inventory.total_stock.toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                </div>

                {/* Claims Card */}
                <div className="bg-bg-card border border-border rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-text-primary mb-3">Reclamações</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-text-muted">Total</p>
                      <p className="text-xl font-bold text-red-400">{claims.length.toLocaleString('pt-BR')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-text-muted">Valor Total</p>
                      <p className="text-xl font-bold text-red-400">
                        {formatBRL(claims.reduce((s, c) => s + (c.amount || 0), 0))}
                      </p>
                    </div>
                  </div>
                  {claims.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="flex flex-wrap gap-2 text-xs">
                        {Object.entries(
                          claims.reduce<Record<string, number>>((acc, c) => {
                            const s = c.status || 'unknown'
                            acc[s] = (acc[s] || 0) + 1
                            return acc
                          }, {})
                        ).map(([status, count]) => (
                          <span key={status} className="px-2 py-0.5 rounded-full bg-bg-surface text-text-muted border border-border">
                            {status}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Other tabs */}
      {activeTab !== 'mercadolivre' && (
        <div className="bg-bg-card border border-border rounded-xl p-12 text-center">
          <div className="w-16 h-16 rounded-xl flex items-center justify-center font-bold text-2xl mx-auto mb-4"
            style={{ backgroundColor: tab.color, color: tab.textColor }}>{tab.icon}</div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">{tab.name}</h3>
          <p className="text-text-muted text-sm">Integração em breve.</p>
        </div>
      )}
    </div>
  )
}

function KPICard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-4 border ${highlight ? 'bg-brand-gold/10 border-brand-gold/30' : 'bg-bg-card border-border'}`}>
      <p className="text-xs text-text-muted mb-1">{label}</p>
      <p className={`text-lg font-bold ${highlight ? 'text-brand-gold' : 'text-text-primary'}`}>{value}</p>
    </div>
  )
}
