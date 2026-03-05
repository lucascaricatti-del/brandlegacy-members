'use client'

import { useState, useEffect, useCallback } from 'react'

type Metrics = {
  total_revenue: number
  total_orders: number
  total_cancelled: number
  total_units: number
  avg_ticket: number
  total_commission: number
  total_fixed_fee: number
  total_financing_fee: number
  total_frete: number
  total_fees: number
  total_net: number
}

type TopProduct = {
  title: string
  order_count: number
  total_units: number
  total_revenue: number
  avg_ticket: number
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
    return { date_from: toYMD(y), date_to: toYMD(y) }
  }
  if (period === 'mes_atual') return { date_from: today.slice(0, 7) + '-01', date_to: today }
  if (period === 'custom' && customFrom && customTo) return { date_from: customFrom, date_to: customTo }
  const daysMap: Record<string, number> = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 }
  const days = daysMap[period] ?? 30
  const since = new Date(); since.setDate(since.getDate() - days)
  return { date_from: toYMD(since), date_to: today }
}

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const EMPTY_METRICS: Metrics = {
  total_revenue: 0, total_orders: 0, total_cancelled: 0, total_units: 0,
  avg_ticket: 0, total_commission: 0, total_fixed_fee: 0, total_financing_fee: 0,
  total_frete: 0, total_fees: 0, total_net: 0,
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
  const [metrics, setMetrics] = useState<Metrics>(EMPTY_METRICS)
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async (p: Period, cFrom?: string, cTo?: string) => {
    setLoading(true)
    try {
      const range = getDateRange(p, cFrom, cTo)
      const res = await fetch('/api/marketplace/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, ...range }),
      })
      const data = await res.json()
      if (data.error) {
        console.error('[marketplaces] API error:', data.error)
        setMetrics(EMPTY_METRICS)
        setTopProducts([])
      } else {
        setMetrics(data.metrics ?? EMPTY_METRICS)
        setTopProducts(data.top_products ?? [])
      }
    } catch (err) {
      console.error('[marketplaces] fetch error:', err)
    }
    setLoading(false)
  }, [workspaceId])

  useEffect(() => {
    if (!isConnected) return
    if (period === 'custom') {
      if (appliedFrom && appliedTo) fetchData(period, appliedFrom, appliedTo)
    } else {
      fetchData(period)
    }
  }, [period, appliedFrom, appliedTo, isConnected, fetchData])

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
        fetchData(period, appliedFrom, appliedTo)
      }
    } catch {
      setSyncMsg({ type: 'error', text: 'Erro ao sincronizar.' })
    }
    setSyncing(false)
  }

  const margin = metrics.total_revenue > 0
    ? (metrics.total_net / metrics.total_revenue) * 100
    : 0

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
              <div className="flex items-center gap-2">
                {loading && <span className="text-xs text-text-muted">Carregando...</span>}
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

              {/* ═══════════════ SECTION 1: VISÃO GERAL ═══════════════ */}
              <SectionTitle title="Visão Geral" />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <KPICard label="Vendas Brutas" value={formatBRL(metrics.total_revenue)} />
                <KPICard label="Qtd Vendas" value={metrics.total_orders.toLocaleString('pt-BR')} />
                <KPICard label="Unidades Vendidas" value={metrics.total_units.toLocaleString('pt-BR')} />
                <KPICard label="Preço Médio" value={formatBRL(metrics.avg_ticket)} />
                <KPICard label="Canceladas" value={metrics.total_cancelled.toLocaleString('pt-BR')} negative />
              </div>

              {/* ═══════════════ SECTION 2: CUSTOS ═══════════════ */}
              <SectionTitle title="Custos" />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                <CostCard label="Tarifas de Vendas" value={metrics.total_commission} />
                <CostCard label="Tarifa Envios" value={metrics.total_frete} />
                <CostCard label="Tarifa Fixa" value={metrics.total_fixed_fee} />
                <LockedCard label="Custo Ads" />
                <LockedCard label="Custo Produto" />
                <LockedCard label="Impostos" />
                <CostCard label="CUSTO TOTAL" value={metrics.total_fees} highlight />
              </div>

              {/* ═══════════════ SECTION 3: RESULTADO ═══════════════ */}
              <SectionTitle title="Resultado" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ResultCard
                  label="Vendas Líquidas"
                  value={formatBRL(metrics.total_net)}
                  color="green"
                />
                <ResultCard
                  label="Margem de Contribuição"
                  value={metrics.total_revenue > 0 ? `${margin.toFixed(1)}%` : '—'}
                  color={margin >= 30 ? 'green' : margin >= 15 ? 'yellow' : 'red'}
                />
              </div>

              {/* ═══════════════ SECTION 4: TOP 10 ANÚNCIOS ═══════════════ */}
              <SectionTitle title="Top 10 Anúncios" />
              {topProducts.length > 0 ? (
                <div className="bg-bg-card border border-border rounded-xl p-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-text-muted text-left">
                          <th className="pb-2 pr-4 w-10">#</th>
                          <th className="pb-2 pr-4">Produto</th>
                          <th className="pb-2 pr-4 text-right">Unidades</th>
                          <th className="pb-2 pr-4 text-right">Pedidos</th>
                          <th className="pb-2 pr-4 text-right">Receita Bruta</th>
                          <th className="pb-2 text-right">Ticket Médio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topProducts.map((p, i) => (
                          <tr key={i} className="border-b border-border/50 last:border-0">
                            <td className="py-2 pr-4 text-text-muted">{i + 1}</td>
                            <td className="py-2 pr-4 text-text-primary truncate max-w-[300px]">{p.title}</td>
                            <td className="py-2 pr-4 text-right text-text-secondary">{p.total_units?.toLocaleString('pt-BR') ?? '—'}</td>
                            <td className="py-2 pr-4 text-right text-text-secondary">{p.order_count?.toLocaleString('pt-BR') ?? '—'}</td>
                            <td className="py-2 pr-4 text-right text-text-secondary">{formatBRL(p.total_revenue ?? 0)}</td>
                            <td className="py-2 text-right text-text-secondary">{formatBRL(p.avg_ticket ?? 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-bg-card border border-border rounded-xl p-6 text-center text-text-muted text-sm">
                  {loading ? 'Carregando...' : 'Nenhum produto encontrado no período.'}
                </div>
              )}

              {/* Inventory + Claims Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

/* ═══════════════ Subcomponents ═══════════════ */

function SectionTitle({ title }: { title: string }) {
  return (
    <h2 className="text-base font-semibold text-text-primary mt-2">{title}</h2>
  )
}

function KPICard({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-4">
      <p className="text-xs text-text-muted mb-1">{label}</p>
      <p className={`text-lg font-bold ${negative ? 'text-red-400' : 'text-text-primary'}`}>{value}</p>
    </div>
  )
}

function CostCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-4 border ${highlight ? 'bg-red-500/10 border-red-500/30' : 'bg-bg-card border-border'}`}>
      <p className="text-xs text-text-muted mb-1">{label}</p>
      <p className={`text-lg font-bold ${highlight ? 'text-red-400' : 'text-red-400'}`}>
        -{formatBRL(value)}
      </p>
    </div>
  )
}

function LockedCard({ label }: { label: string }) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 opacity-50">
      <p className="text-xs text-text-muted mb-1">{label}</p>
      <div className="flex items-center gap-1.5">
        <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span className="text-sm text-text-muted">Em breve</span>
      </div>
    </div>
  )
}

function ResultCard({ label, value, color }: { label: string; value: string; color: 'green' | 'yellow' | 'red' }) {
  const colorMap = {
    green: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
    yellow: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400' },
    red: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400' },
  }
  const c = colorMap[color]
  return (
    <div className={`rounded-xl p-5 border ${c.bg} ${c.border}`}>
      <p className="text-xs text-text-muted mb-1">{label}</p>
      <p className={`text-2xl font-bold ${c.text}`}>{value}</p>
    </div>
  )
}
