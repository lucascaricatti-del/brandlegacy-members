'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

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

type ManualCosts = {
  ml_ads_cost: number
  ml_fulfillment_cost: number
  ml_return_fee: number
  ml_other_fees: number
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

const EMPTY_MANUAL: ManualCosts = {
  ml_ads_cost: 0, ml_fulfillment_cost: 0, ml_return_fee: 0, ml_other_fees: 0,
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
  const [manualCosts, setManualCosts] = useState<ManualCosts>(EMPTY_MANUAL)
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  // Current date range ref for manual cost saves
  const currentRangeRef = useRef<{ date_from: string; date_to: string }>({ date_from: '', date_to: '' })

  const fetchData = useCallback(async (p: Period, cFrom?: string, cTo?: string) => {
    setLoading(true)
    try {
      const range = getDateRange(p, cFrom, cTo)
      currentRangeRef.current = range

      const [ordersRes, manualRes] = await Promise.all([
        fetch('/api/marketplace/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspace_id: workspaceId, ...range }),
        }),
        fetch(`/api/marketplace/manual-costs?workspace_id=${workspaceId}&date_from=${range.date_from}&date_to=${range.date_to}`),
      ])

      const ordersData = await ordersRes.json()
      const manualData = await manualRes.json()

      if (ordersData.error) {
        console.error('[marketplaces] API error:', ordersData.error)
        setMetrics(EMPTY_METRICS)
        setTopProducts([])
      } else {
        setMetrics(ordersData.metrics ?? EMPTY_METRICS)
        setTopProducts(ordersData.top_products ?? [])
      }

      if (!manualData.error) {
        setManualCosts({
          ml_ads_cost: manualData.ml_ads_cost ?? 0,
          ml_fulfillment_cost: manualData.ml_fulfillment_cost ?? 0,
          ml_return_fee: manualData.ml_return_fee ?? 0,
          ml_other_fees: manualData.ml_other_fees ?? 0,
        })
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

  async function saveManualCost(field: keyof ManualCosts, value: number) {
    const range = currentRangeRef.current
    const month = range.date_from.slice(0, 7) + '-01'
    const body = { workspace_id: workspaceId, month, ...manualCosts, [field]: value }

    try {
      const res = await fetch('/api/marketplace/manual-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) {
        console.error('[manual-costs] save error:', data.error)
        return
      }
      setManualCosts(prev => ({ ...prev, [field]: value }))
      setToast('Salvo!')
      setTimeout(() => setToast(null), 2000)
    } catch (err) {
      console.error('[manual-costs] save error:', err)
    }
  }

  // Computed values
  const totalManualCosts = manualCosts.ml_ads_cost + manualCosts.ml_fulfillment_cost + manualCosts.ml_return_fee + manualCosts.ml_other_fees
  const totalAutoFees = metrics.total_fees
  const totalAllCosts = totalAutoFees + totalManualCosts
  const vendasLiquidas = metrics.total_revenue - totalAllCosts
  const hasManualCosts = totalManualCosts > 0
  const margin = metrics.total_revenue > 0 ? (vendasLiquidas / metrics.total_revenue) * 100 : 0

  const tab = TABS.find((t) => t.id === activeTab)!

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

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

              {/* ═══════════════ SECTION 1: VISAO GERAL ═══════════════ */}
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
                {/* Automatic costs */}
                <AutoCostCard
                  label="Tarifas de Venda Totais"
                  value={metrics.total_commission}
                  tooltip="Comissão cobrada pelo Mercado Livre por cada venda realizada. Varia entre 10% e 16% dependendo da categoria e tipo de anúncio."
                />
                <AutoCostCard
                  label="Tarifas de Envio"
                  value={metrics.total_frete}
                  tooltip="Custo do frete pago pelo vendedor. Inclui envios por sua conta e desconto por reputação já aplicado pelo ML."
                />
                <AutoCostCard
                  label="Tarifa Fixa"
                  value={metrics.total_fixed_fee}
                  tooltip="Tarifa fixa de R$6,00 cobrada por unidade vendida em anúncios Premium (Gold Pro)."
                />

                {/* Manual costs */}
                <ManualCostCard
                  label="Investimento por Campanha de Publicidade"
                  value={manualCosts.ml_ads_cost}
                  tooltip="Investimento em ML Ads (Product Ads). Não disponível via API — preencha manualmente consultando Mercado Livre > Publicidade > Relatórios."
                  onSave={(v) => saveManualCost('ml_ads_cost', v)}
                />
                <ManualCostCard
                  label="Custos do Mercado Envios Full"
                  value={manualCosts.ml_fulfillment_cost}
                  tooltip="Custo de armazenamento e operação no fulfillment do Mercado Livre. Não disponível via API — consulte Mercado Livre > Envios Full > Custos."
                  onSave={(v) => saveManualCost('ml_fulfillment_cost', v)}
                />
                <ManualCostCard
                  label="Tarifas de Devolução"
                  value={manualCosts.ml_return_fee}
                  tooltip="Custos gerados por devoluções e estornos. Não disponível via API — consulte Mercado Livre > Vendas > Devoluções."
                  onSave={(v) => saveManualCost('ml_return_fee', v)}
                />
                <ManualCostCard
                  label="Outras Tarifas"
                  value={manualCosts.ml_other_fees}
                  tooltip="Outras cobranças diversas do Mercado Livre não categorizadas acima."
                  onSave={(v) => saveManualCost('ml_other_fees', v)}
                />

                {/* Total */}
                <TotalCostCard
                  totalAll={totalAllCosts}
                  totalAuto={totalAutoFees}
                  totalManual={totalManualCosts}
                />
              </div>
              <p className="text-[11px] text-text-muted/60 -mt-1">Valores referentes ao período selecionado</p>

              {/* ═══════════════ SECTION 3: RESULTADO ═══════════════ */}
              <SectionTitle title="Resultado" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ResultCard
                  label="Vendas Líquidas"
                  value={formatBRL(vendasLiquidas)}
                  color="green"
                  note={hasManualCosts ? '* Inclui custos manuais' : undefined}
                />
                <ResultCard
                  label="Margem de Contribuição"
                  value={metrics.total_revenue > 0 ? `${margin.toFixed(1)}%` : '—'}
                  color={margin >= 30 ? 'green' : margin >= 15 ? 'yellow' : 'red'}
                  note={hasManualCosts ? '* Inclui custos manuais' : undefined}
                />
              </div>

              {/* ═══════════════ SECTION 4: TOP 10 ANUNCIOS ═══════════════ */}
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
  return <h2 className="text-base font-semibold text-text-primary mt-2">{title}</h2>
}

function KPICard({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-4">
      <p className="text-xs text-text-muted mb-1">{label}</p>
      <p className={`text-lg font-bold ${negative ? 'text-red-400' : 'text-text-primary'}`}>{value}</p>
    </div>
  )
}

function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-block">
      <span
        className="cursor-help text-text-muted/60 hover:text-text-muted transition-colors"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        <svg className="w-3.5 h-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      </span>
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#1a1a1a] text-white text-[11px] leading-snug rounded-lg shadow-xl max-w-[250px] w-max z-50 pointer-events-none">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1a1a1a]" />
        </span>
      )}
    </span>
  )
}

function SourceBadge({ type }: { type: 'auto' | 'manual' }) {
  return type === 'auto' ? (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
      Automático
    </span>
  ) : (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
      Manual
    </span>
  )
}

function AutoCostCard({ label, value, tooltip }: { label: string; value: number; tooltip: string }) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-4">
      <div className="flex items-start justify-between gap-1 mb-1">
        <p className="text-xs text-text-muted leading-tight">{label}</p>
        <div className="flex items-center gap-1 shrink-0">
          <InfoTooltip text={tooltip} />
          <SourceBadge type="auto" />
        </div>
      </div>
      <p className="text-lg font-bold text-red-400">-{formatBRL(value)}</p>
    </div>
  )
}

function ManualCostCard({
  label,
  value,
  tooltip,
  onSave,
}: {
  label: string
  value: number
  tooltip: string
  onSave: (v: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit() {
    setInput(value > 0 ? value.toString() : '')
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function handleSave() {
    const parsed = parseFloat(input.replace(',', '.')) || 0
    onSave(parsed)
    setEditing(false)
  }

  function handleCancel() {
    setEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') handleCancel()
  }

  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 group">
      <div className="flex items-start justify-between gap-1 mb-1">
        <p className="text-xs text-text-muted leading-tight">{label}</p>
        <div className="flex items-center gap-1 shrink-0">
          <InfoTooltip text={tooltip} />
          <SourceBadge type="manual" />
        </div>
      </div>

      {editing ? (
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-sm text-text-muted">R$</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-bg-surface border border-border rounded px-2 py-1 text-sm text-text-primary outline-none focus:border-brand-gold"
            placeholder="0,00"
          />
          <button onClick={handleSave} className="text-emerald-400 hover:text-emerald-300 shrink-0" title="Salvar">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </button>
          <button onClick={handleCancel} className="text-red-400 hover:text-red-300 shrink-0" title="Cancelar">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          {value > 0 ? (
            <p className="text-lg font-bold text-red-400">-{formatBRL(value)}</p>
          ) : (
            <button onClick={startEdit} className="text-sm text-text-muted/60 hover:text-text-muted flex items-center gap-1 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Clique para adicionar
            </button>
          )}
          {value > 0 && (
            <button
              onClick={startEdit}
              className="opacity-0 group-hover:opacity-100 text-text-muted/60 hover:text-text-muted transition-all"
              title="Editar"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function TotalCostCard({ totalAll, totalAuto, totalManual }: { totalAll: number; totalAuto: number; totalManual: number }) {
  const [showBreakdown, setShowBreakdown] = useState(false)
  return (
    <div
      className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 relative"
      onMouseEnter={() => setShowBreakdown(true)}
      onMouseLeave={() => setShowBreakdown(false)}
    >
      <p className="text-xs text-text-muted mb-1 font-semibold">CUSTO TOTAL</p>
      <p className="text-lg font-bold text-red-400">-{formatBRL(totalAll)}</p>
      {showBreakdown && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#1a1a1a] text-white text-[11px] rounded-lg shadow-xl w-max z-50 pointer-events-none space-y-0.5">
          <div className="flex justify-between gap-4">
            <span className="text-emerald-400">Automático:</span>
            <span>-{formatBRL(totalAuto)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-yellow-400">Manual:</span>
            <span>-{formatBRL(totalManual)}</span>
          </div>
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1a1a1a]" />
        </div>
      )}
    </div>
  )
}

function ResultCard({ label, value, color, note }: { label: string; value: string; color: 'green' | 'yellow' | 'red'; note?: string }) {
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
      {note && <p className="text-[10px] text-text-muted/60 mt-1">{note}</p>}
    </div>
  )
}
