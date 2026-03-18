'use client'

import { useState, useEffect, useCallback } from 'react'

// --- Types ---
type Period = '7d' | '30d' | 'mes_atual' | 'custom'
type MarketplaceKey = 'mercadolivre' | 'shopee' | 'magalu' | 'netshoes' | 'tiktok_shop'

type MarketplaceMetrics = {
  marketplace: MarketplaceKey
  gross_revenue: number
  net_revenue: number
  orders_count: number
  units_sold: number
  avg_ticket: number
  ad_spend?: number
  shipping_cost?: number
  returns_count?: number
  returns_value?: number
  commission?: number
  shipping?: number
}

type TaxConfig = {
  marketplace: string
  effective_tax_pct: number
  simples_nacional_pct: number
  icms_pct: number
  pis_cofins_pct: number
}

type ConsolidatedData = {
  mercadolivre: MarketplaceMetrics
  manual_marketplaces: MarketplaceMetrics[]
  tax_config: TaxConfig[]
}

// --- Constants ---
const PERIODS: { key: Period; label: string }[] = [
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: 'mes_atual', label: 'Mês Atual' },
  { key: 'custom', label: 'Personalizado' },
]

const MARKETPLACE_CONFIG: Record<MarketplaceKey, { name: string; color: string; textColor: string; icon: string; auto: boolean }> = {
  mercadolivre: { name: 'Mercado Livre', color: '#FFE600', textColor: '#2D3277', icon: 'ML', auto: true },
  shopee: { name: 'Shopee', color: '#EE4D2D', textColor: '#fff', icon: 'SP', auto: false },
  magalu: { name: 'Magalu', color: '#0086FF', textColor: '#fff', icon: 'MG', auto: false },
  netshoes: { name: 'Netshoes', color: '#000000', textColor: '#fff', icon: 'NS', auto: false },
  tiktok_shop: { name: 'TikTok Shop', color: '#000000', textColor: '#69C9D0', icon: 'TK', auto: false },
}

const MANUAL_MARKETPLACES: MarketplaceKey[] = ['shopee', 'magalu', 'netshoes', 'tiktok_shop']

function toYMD(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}

function getDateRange(period: Period, customFrom?: string, customTo?: string): { date_from: string; date_to: string } {
  const today = toYMD(new Date())
  if (period === 'mes_atual') return { date_from: today.slice(0, 7) + '-01', date_to: today }
  if (period === 'custom' && customFrom && customTo) return { date_from: customFrom, date_to: customTo }
  const daysMap: Record<string, number> = { '7d': 7, '30d': 30 }
  const days = daysMap[period] ?? 30
  const since = new Date(); since.setDate(since.getDate() - days)
  return { date_from: toYMD(since), date_to: today }
}

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// --- Component ---
export default function MarketplaceConsolidated({
  workspaceId,
  mlConnected,
}: {
  workspaceId: string
  mlConnected: boolean
}) {
  const [period, setPeriod] = useState<Period>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [consolidatedData, setConsolidatedData] = useState<ConsolidatedData | null>(null)
  const [loading, setLoading] = useState(false)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [showTaxConfig, setShowTaxConfig] = useState(false)
  const [taxConfig, setTaxConfig] = useState<TaxConfig>({
    marketplace: '_all',
    effective_tax_pct: 0,
    simples_nacional_pct: 0,
    icms_pct: 0,
    pis_cofins_pct: 0,
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { date_from, date_to } = getDateRange(period, customFrom, customTo)
      const res = await fetch(
        `/api/marketplace/consolidated?workspace_id=${workspaceId}&date_from=${date_from}&date_to=${date_to}`
      )
      if (res.ok) {
        const data = await res.json()
        setConsolidatedData(data)
      }
    } catch (e) {
      console.error('Failed to fetch consolidated data', e)
    } finally {
      setLoading(false)
    }
  }, [workspaceId, period, customFrom, customTo])

  const fetchTaxConfig = useCallback(async () => {
    try {
      const res = await fetch(`/api/marketplace/tax-config?workspace_id=${workspaceId}`)
      if (res.ok) {
        const data = await res.json()
        setTaxConfig(data)
      }
    } catch (e) {
      console.error('Failed to fetch tax config', e)
    }
  }, [workspaceId])

  useEffect(() => {
    fetchData()
    fetchTaxConfig()
  }, [fetchData, fetchTaxConfig])

  // Build all marketplace metrics for cards
  const allMarketplaces: MarketplaceMetrics[] = []
  if (consolidatedData) {
    // ML data
    if (consolidatedData.mercadolivre) {
      allMarketplaces.push({ ...consolidatedData.mercadolivre, marketplace: 'mercadolivre' })
    }
    // Manual marketplaces — ensure all 4 show even if no data
    for (const mk of MANUAL_MARKETPLACES) {
      const found = consolidatedData.manual_marketplaces?.find((m) => m.marketplace === mk)
      allMarketplaces.push(
        found || {
          marketplace: mk,
          gross_revenue: 0,
          net_revenue: 0,
          orders_count: 0,
          units_sold: 0,
          avg_ticket: 0,
        }
      )
    }
  }

  // Totals
  const totals = allMarketplaces.reduce(
    (acc, m) => ({
      gross_revenue: acc.gross_revenue + Number(m.gross_revenue || 0),
      net_revenue: acc.net_revenue + Number(m.net_revenue || 0),
      orders_count: acc.orders_count + Number(m.orders_count || 0),
      units_sold: acc.units_sold + Number(m.units_sold || 0),
    }),
    { gross_revenue: 0, net_revenue: 0, orders_count: 0, units_sold: 0 }
  )
  const totalAvgTicket = totals.orders_count > 0 ? totals.gross_revenue / totals.orders_count : 0

  return (
    <div className="mt-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-text-primary">Consolidado Marketplaces</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowManualEntry(true)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-gold/10 text-brand-gold hover:bg-brand-gold/20 transition-colors"
          >
            Lancar Dados
          </button>
          <button
            onClick={() => setShowTaxConfig(true)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-bg-surface text-text-secondary hover:bg-bg-surface/80 transition-colors border border-border"
          >
            Configurar Impostos
          </button>
        </div>
      </div>

      {/* Period Filter */}
      <PeriodFilter
        period={period}
        setPeriod={setPeriod}
        customFrom={customFrom}
        setCustomFrom={setCustomFrom}
        customTo={customTo}
        setCustomTo={setCustomTo}
        onSearch={fetchData}
      />

      {/* Cards Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {allMarketplaces.map((m) => {
            const config = MARKETPLACE_CONFIG[m.marketplace]
            return (
              <MarketplaceCard
                key={m.marketplace}
                metrics={m}
                config={config}
                mlConnected={mlConnected}
                onEdit={config.auto ? undefined : () => setShowManualEntry(true)}
              />
            )
          })}
          {/* Total Card */}
          <div className="bg-bg-card border border-brand-gold/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-brand-gold/20 flex items-center justify-center">
                <span className="text-xs font-bold text-brand-gold">ALL</span>
              </div>
              <span className="text-sm font-semibold text-text-primary">Total</span>
            </div>
            <div className="space-y-2">
              <MetricRow label="Fat. Bruto" value={formatBRL(totals.gross_revenue)} />
              <MetricRow label="Fat. Liquido" value={formatBRL(totals.net_revenue)} />
              <MetricRow label="Pedidos" value={String(totals.orders_count)} />
              <MetricRow label="Ticket Medio" value={formatBRL(totalAvgTicket)} />
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showManualEntry && (
        <ManualEntryModal
          workspaceId={workspaceId}
          onClose={() => setShowManualEntry(false)}
          onSaved={() => {
            setShowManualEntry(false)
            fetchData()
          }}
        />
      )}
      {showTaxConfig && (
        <TaxConfigModal
          workspaceId={workspaceId}
          taxConfig={taxConfig}
          onClose={() => setShowTaxConfig(false)}
          onSaved={() => {
            setShowTaxConfig(false)
            fetchTaxConfig()
            fetchData()
          }}
        />
      )}
    </div>
  )
}

// --- Sub-components ---

function PeriodFilter({
  period,
  setPeriod,
  customFrom,
  setCustomFrom,
  customTo,
  setCustomTo,
  onSearch,
}: {
  period: Period
  setPeriod: (p: Period) => void
  customFrom: string
  setCustomFrom: (v: string) => void
  customTo: string
  setCustomTo: (v: string) => void
  onSearch: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PERIODS.map((p) => (
        <button
          key={p.key}
          onClick={() => setPeriod(p.key)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            period === p.key
              ? 'bg-brand-gold text-bg-base'
              : 'bg-bg-surface text-text-secondary hover:text-text-primary'
          }`}
        >
          {p.label}
        </button>
      ))}
      {period === 'custom' && (
        <>
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="px-2 py-1 text-xs rounded-lg bg-bg-surface border border-border text-text-primary"
          />
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="px-2 py-1 text-xs rounded-lg bg-bg-surface border border-border text-text-primary"
          />
          <button
            onClick={onSearch}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-gold text-bg-base"
          >
            Buscar
          </button>
        </>
      )}
    </div>
  )
}

function MarketplaceCard({
  metrics,
  config,
  mlConnected,
  onEdit,
}: {
  metrics: MarketplaceMetrics
  config: { name: string; color: string; textColor: string; icon: string; auto: boolean }
  mlConnected: boolean
  onEdit?: () => void
}) {
  const avgTicket = Number(metrics.avg_ticket || 0) ||
    (Number(metrics.orders_count) > 0 ? Number(metrics.gross_revenue) / Number(metrics.orders_count) : 0)

  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 hover:border-brand-gold/20 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: config.color, color: config.textColor }}
          >
            {config.icon}
          </div>
          <span className="text-sm font-semibold text-text-primary">{config.name}</span>
        </div>
        {config.auto ? (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${mlConnected ? 'bg-success/10 text-success' : 'bg-bg-surface text-text-muted'}`}>
            {mlConnected ? 'Automatico' : 'Desconectado'}
          </span>
        ) : onEdit ? (
          <button onClick={onEdit} className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-brand-gold/10 text-brand-gold hover:bg-brand-gold/20 transition-colors">
            Editar
          </button>
        ) : null}
      </div>
      <div className="space-y-2">
        <MetricRow label="Fat. Bruto" value={formatBRL(Number(metrics.gross_revenue || 0))} />
        <MetricRow label="Fat. Liquido" value={formatBRL(Number(metrics.net_revenue || 0))} />
        <MetricRow label="Pedidos" value={String(Number(metrics.orders_count || 0))} />
        <MetricRow label="Ticket Medio" value={formatBRL(avgTicket)} />
      </div>
    </div>
  )
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-xs font-semibold text-text-primary">{value}</span>
    </div>
  )
}

// --- Manual Entry Modal ---
function ManualEntryModal({
  workspaceId,
  onClose,
  onSaved,
}: {
  workspaceId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [marketplace, setMarketplace] = useState<string>('shopee')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [grossRevenue, setGrossRevenue] = useState('')
  const [netRevenue, setNetRevenue] = useState('')
  const [ordersCount, setOrdersCount] = useState('')
  const [unitsSold, setUnitsSold] = useState('')
  const [adSpend, setAdSpend] = useState('')
  const [shippingCost, setShippingCost] = useState('')
  const [returnsCount, setReturnsCount] = useState('')
  const [returnsValue, setReturnsValue] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!periodStart || !periodEnd) {
      setError('Preencha as datas do periodo.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/marketplace/manual-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          marketplace,
          period_start: periodStart,
          period_end: periodEnd,
          gross_revenue: parseFloat(grossRevenue) || 0,
          net_revenue: parseFloat(netRevenue) || 0,
          orders_count: parseInt(ordersCount) || 0,
          units_sold: parseInt(unitsSold) || 0,
          ad_spend: parseFloat(adSpend) || 0,
          shipping_cost: parseFloat(shippingCost) || 0,
          returns_count: parseInt(returnsCount) || 0,
          returns_value: parseFloat(returnsValue) || 0,
          notes: notes || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Erro ao salvar.')
        return
      }
      onSaved()
    } catch {
      setError('Erro de conexao.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-text-primary">Lancar Dados Manual</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-lg">&times;</button>
        </div>

        {error && <p className="text-xs text-error mb-3">{error}</p>}

        <div className="space-y-3">
          {/* Marketplace selector */}
          <div>
            <label className="text-xs text-text-muted block mb-1">Marketplace</label>
            <select
              value={marketplace}
              onChange={(e) => setMarketplace(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-bg-surface border border-border text-text-primary"
            >
              {MANUAL_MARKETPLACES.map((mk) => (
                <option key={mk} value={mk}>{MARKETPLACE_CONFIG[mk].name}</option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted block mb-1">Data Inicio</label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-bg-surface border border-border text-text-primary"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">Data Fim</label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-bg-surface border border-border text-text-primary"
              />
            </div>
          </div>

          {/* Revenue */}
          <div className="grid grid-cols-2 gap-3">
            <NumericField label="Faturamento Bruto (R$)" value={grossRevenue} onChange={setGrossRevenue} />
            <NumericField label="Faturamento Liquido (R$)" value={netRevenue} onChange={setNetRevenue} />
          </div>

          {/* Orders / Units */}
          <div className="grid grid-cols-2 gap-3">
            <NumericField label="Pedidos" value={ordersCount} onChange={setOrdersCount} />
            <NumericField label="Unidades Vendidas" value={unitsSold} onChange={setUnitsSold} />
          </div>

          {/* Costs */}
          <div className="grid grid-cols-2 gap-3">
            <NumericField label="Gasto Ads (R$)" value={adSpend} onChange={setAdSpend} />
            <NumericField label="Custo Frete (R$)" value={shippingCost} onChange={setShippingCost} />
          </div>

          {/* Returns */}
          <div className="grid grid-cols-2 gap-3">
            <NumericField label="Devoluções (qtd)" value={returnsCount} onChange={setReturnsCount} />
            <NumericField label="Valor Devoluções (R$)" value={returnsValue} onChange={setReturnsValue} />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-text-muted block mb-1">Observações</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-lg bg-bg-surface border border-border text-text-primary resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg bg-bg-surface text-text-secondary hover:text-text-primary border border-border transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-gold text-bg-base hover:bg-brand-gold-light transition-colors disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Tax Config Modal ---
function TaxConfigModal({
  workspaceId,
  taxConfig,
  onClose,
  onSaved,
}: {
  workspaceId: string
  taxConfig: TaxConfig
  onClose: () => void
  onSaved: () => void
}) {
  const [effectiveTax, setEffectiveTax] = useState(String(taxConfig.effective_tax_pct || ''))
  const [simplesNacional, setSimplesNacional] = useState(String(taxConfig.simples_nacional_pct || ''))
  const [icms, setIcms] = useState(String(taxConfig.icms_pct || ''))
  const [pisCofins, setPisCofins] = useState(String(taxConfig.pis_cofins_pct || ''))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/marketplace/tax-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          effective_tax_pct: parseFloat(effectiveTax) || 0,
          simples_nacional_pct: parseFloat(simplesNacional) || 0,
          icms_pct: parseFloat(icms) || 0,
          pis_cofins_pct: parseFloat(pisCofins) || 0,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Erro ao salvar.')
        return
      }
      onSaved()
    } catch {
      setError('Erro de conexao.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-bg-card border border-border rounded-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-text-primary">Configurar Impostos</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-lg">&times;</button>
        </div>

        {error && <p className="text-xs text-error mb-3">{error}</p>}

        <p className="text-xs text-text-muted mb-4">
          Configure as aliquotas de impostos aplicadas ao faturamento. A taxa efetiva sera usada para calculos gerais.
        </p>

        <div className="space-y-3">
          <NumericField label="Taxa Efetiva (%)" value={effectiveTax} onChange={setEffectiveTax} />
          <NumericField label="Simples Nacional (%)" value={simplesNacional} onChange={setSimplesNacional} />
          <NumericField label="ICMS (%)" value={icms} onChange={setIcms} />
          <NumericField label="PIS/COFINS (%)" value={pisCofins} onChange={setPisCofins} />
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg bg-bg-surface text-text-secondary hover:text-text-primary border border-border transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-gold text-bg-base hover:bg-brand-gold-light transition-colors disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Shared field ---
function NumericField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="text-xs text-text-muted block mb-1">{label}</label>
      <input
        type="number"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm rounded-lg bg-bg-surface border border-border text-text-primary"
        placeholder="0"
      />
    </div>
  )
}
