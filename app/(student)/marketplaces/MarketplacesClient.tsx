'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'

type Order = {
  order_id: string
  date: string
  status: string
  revenue: number
  net_revenue: number
  marketplace_fee: number
  ml_commission: number
  ml_fixed_fee: number
  ml_financing_fee: number
  frete_custo: number
  net_revenue_full: number
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

type Period = 'today' | 'yesterday' | '7d' | '14d' | '30d' | '90d' | 'mes_atual' | 'custom'
const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: 'yesterday', label: 'Ontem' },
  { key: '7d', label: '7 dias' },
  { key: '14d', label: '14 dias' },
  { key: '30d', label: '30 dias' },
  { key: '90d', label: '90 dias' },
  { key: 'mes_atual', label: 'Mês Atual' },
  { key: 'custom', label: 'Personalizado' },
]

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function getDateRange(period: Period, customFrom?: string, customTo?: string): { date_from: string; date_to: string } {
  const today = toYMD(new Date())
  if (period === 'today') return { date_from: today, date_to: today }
  if (period === 'yesterday') {
    const y = new Date(); y.setDate(y.getDate() - 1)
    const yd = toYMD(y)
    return { date_from: yd, date_to: yd }
  }
  if (period === 'mes_atual') {
    return { date_from: today.slice(0, 7) + '-01', date_to: today }
  }
  if (period === 'custom' && customFrom && customTo) {
    return { date_from: customFrom, date_to: customTo }
  }
  const daysMap: Record<string, number> = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 }
  const days = daysMap[period] ?? 30
  const since = new Date(); since.setDate(since.getDate() - days)
  return { date_from: toYMD(since), date_to: today }
}

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function MarketplacesClient({
  workspaceId,
  claims,
  inventory,
  isConnected,
}: {
  workspaceId: string
  claims: Claim[]
  inventory: InventorySummary
  isConnected: boolean
}) {
  const [activeTab, setActiveTab] = useState<Tab>('mercadolivre')
  const [period, setPeriod] = useState<Period>('mes_atual')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [appliedFrom, setAppliedFrom] = useState('')
  const [appliedTo, setAppliedTo] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [ordersData, setOrdersData] = useState<Order[]>([])
  const [loadingOrders, setLoadingOrders] = useState(true)

  const fetchOrders = useCallback(async (p: Period, cFrom?: string, cTo?: string) => {
    setLoadingOrders(true)
    try {
      const range = getDateRange(p, cFrom, cTo)
      const res = await fetch('/api/marketplace/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, ...range }),
      })
      const data = await res.json()
      if (Array.isArray(data)) setOrdersData(data)
    } catch (err) {
      console.error('[marketplaces] fetch orders error:', err)
    }
    setLoadingOrders(false)
  }, [workspaceId])

  useEffect(() => {
    if (!isConnected) return
    if (period === 'custom') {
      if (appliedFrom && appliedTo) fetchOrders(period, appliedFrom, appliedTo)
    } else {
      fetchOrders(period)
    }
  }, [period, appliedFrom, appliedTo, isConnected, fetchOrders])

  const kpis = useMemo(() => {
    const totalRevenue = ordersData.reduce((s, o) => s + (o.revenue || 0), 0)
    const totalOrders = ordersData.length
    const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0
    const totalCommission = ordersData.reduce((s, o) => s + (o.ml_commission || 0), 0)
    const totalFixedFee = ordersData.reduce((s, o) => s + (o.ml_fixed_fee || 0), 0)
    const totalFinancingFee = ordersData.reduce((s, o) => s + (o.ml_financing_fee || 0), 0)
    const totalFrete = ordersData.reduce((s, o) => s + (o.frete_custo || 0), 0)
    // Always recalculate net revenue on frontend
    const netRevenueFull = totalRevenue - totalCommission - totalFixedFee - totalFinancingFee - totalFrete
    const margin = totalRevenue > 0 ? (netRevenueFull / totalRevenue) * 100 : 0
    return { totalRevenue, totalOrders, avgTicket, totalCommission, totalFixedFee, totalFinancingFee, totalFrete, netRevenueFull, margin }
  }, [ordersData])

  // Top 5 products by order count
  const topProducts = useMemo(() => {
    const productMap = new Map<string, { title: string; orders: number; revenue: number }>()
    for (const o of ordersData) {
      const items = o.items || []
      for (const item of items) {
        const title = item.title || item.name || 'Sem título'
        const existing = productMap.get(title) ?? { title, orders: 0, revenue: 0 }
        existing.orders += Number(item.quantity || 1)
        existing.revenue += Number(item.unit_price || item.price || 0) * Number(item.quantity || 1)
        productMap.set(title, existing)
      }
    }
    return Array.from(productMap.values())
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5)
  }, [ordersData])

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
        fetchOrders(period, appliedFrom, appliedTo)
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
              {/* Period Filter */}
              <div className="flex flex-wrap gap-1.5 md:gap-2">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setPeriod(p.key)}
                    className={`px-2 py-1 md:px-3 md:py-1.5 text-xs md:text-sm rounded-lg font-medium transition-all cursor-pointer ${
                      period === p.key
                        ? 'bg-brand-gold text-bg-base shadow-sm'
                        : 'bg-bg-card border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {period === 'custom' && (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-text-muted text-xs md:text-sm">De:</span>
                  <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="bg-bg-card border border-border rounded-lg px-2 py-1 md:px-3 md:py-1.5 text-xs md:text-sm text-text-primary flex-1 min-w-[130px]" />
                  <span className="text-text-muted text-xs md:text-sm">Até:</span>
                  <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="bg-bg-card border border-border rounded-lg px-2 py-1 md:px-3 md:py-1.5 text-xs md:text-sm text-text-primary flex-1 min-w-[130px]" />
                  <button onClick={() => { setAppliedFrom(customFrom); setAppliedTo(customTo) }} disabled={!customFrom || !customTo}
                    className="w-full sm:w-auto px-4 py-1.5 text-sm rounded-lg font-medium bg-brand-gold text-bg-base hover:opacity-90 transition-opacity disabled:opacity-40 cursor-pointer">Buscar</button>
                </div>
              )}
              {/* Sync */}
              <div className="flex items-center gap-2">
                {loadingOrders && <span className="text-xs text-text-muted">Carregando...</span>}
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

              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <KPICard label="Receita Bruta" value={formatBRL(kpis.totalRevenue)} />
                <KPICard label="Pedidos" value={kpis.totalOrders.toLocaleString('pt-BR')} />
                <KPICard label="Ticket Médio" value={formatBRL(kpis.avgTicket)} />
                <KPICard label="Comissão ML" value={`-${formatBRL(kpis.totalCommission)}`} negative />
                <KPICard label="Tarifa Fixa" value={`-${formatBRL(kpis.totalFixedFee)}`} negative />
                <KPICard label="Frete" value={`-${formatBRL(kpis.totalFrete)}`} negative />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <KPICard label="Receita Líquida" value={formatBRL(kpis.netRevenueFull)} highlight />
                <KPICard label="Margem" value={kpis.totalRevenue > 0 ? `${kpis.margin.toFixed(1)}%` : '—'} highlight />
              </div>

              {/* Top 5 Products */}
              {topProducts.length > 0 && (
                <div className="bg-bg-card border border-border rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-text-primary mb-3">Top 5 Produtos Mais Vendidos</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-text-muted text-left">
                          <th className="pb-2 pr-4 w-10">#</th>
                          <th className="pb-2 pr-4">Produto</th>
                          <th className="pb-2 pr-4 text-right">Pedidos</th>
                          <th className="pb-2 pr-4 text-right">Receita</th>
                          <th className="pb-2 text-right">Ticket Médio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topProducts.map((p, i) => (
                          <tr key={i} className="border-b border-border/50 last:border-0">
                            <td className="py-2 pr-4 text-text-muted">{i + 1}</td>
                            <td className="py-2 pr-4 text-text-primary truncate max-w-[300px]">{p.title}</td>
                            <td className="py-2 pr-4 text-right text-text-secondary">{p.orders}</td>
                            <td className="py-2 pr-4 text-right text-text-secondary">{formatBRL(p.revenue)}</td>
                            <td className="py-2 text-right text-text-secondary">{formatBRL(p.orders > 0 ? p.revenue / p.orders : 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

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

function KPICard({ label, value, highlight, negative }: { label: string; value: string; highlight?: boolean; negative?: boolean }) {
  return (
    <div className={`rounded-xl p-4 border ${highlight ? 'bg-brand-gold/10 border-brand-gold/30' : 'bg-bg-card border-border'}`}>
      <p className="text-xs text-text-muted mb-1">{label}</p>
      <p className={`text-lg font-bold ${highlight ? 'text-brand-gold' : negative ? 'text-red-400' : 'text-text-primary'}`}>{value}</p>
    </div>
  )
}
