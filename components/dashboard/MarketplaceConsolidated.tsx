'use client'

import { useState, useEffect, useCallback } from 'react'

// --- Types ---
type Period = 'today' | 'yesterday' | '7d' | 'month'
type MarketplaceKey = 'mercadolivre' | 'shopee' | 'magalu' | 'netshoes' | 'tiktok_shop'

type MarketplaceData = {
  marketplace: MarketplaceKey
  grossRevenue: number
  netRevenue: number
  orders: number
  avgTicket: number
  totalCosts: number
  contributionMargin: number
  auto: boolean
}

type TaxConfig = Record<string, { tax_rate_percent: number; shipping_rate_percent: number }>

type ConsolidatedResponse = {
  marketplaces: MarketplaceData[]
  totals: {
    grossRevenue: number
    netRevenue: number
    orders: number
    avgTicket: number
    totalCosts: number
    contributionMargin: number
  }
  taxConfig: TaxConfig
  period: string
  date_from: string
  date_to: string
}

// --- Constants ---
const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: 'yesterday', label: 'Ontem' },
  { key: '7d', label: '7 dias' },
  { key: 'month', label: 'Mes Atual' },
]

const MARKETPLACE_CONFIG: Record<MarketplaceKey, { name: string; color: string; textColor: string; icon: string }> = {
  mercadolivre: { name: 'Mercado Livre', color: '#FFE600', textColor: '#2D3277', icon: 'ML' },
  shopee: { name: 'Shopee', color: '#EE4D2D', textColor: '#fff', icon: 'SP' },
  magalu: { name: 'Magalu', color: '#0086FF', textColor: '#fff', icon: 'MG' },
  netshoes: { name: 'Netshoes', color: '#000000', textColor: '#fff', icon: 'NS' },
  tiktok_shop: { name: 'TikTok Shop', color: '#000000', textColor: '#69C9D0', icon: 'TK' },
}

const MANUAL_MARKETPLACES: MarketplaceKey[] = ['shopee', 'magalu', 'netshoes', 'tiktok_shop']

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
  const [period, setPeriod] = useState<Period>('7d')
  const [data, setData] = useState<ConsolidatedResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [showTaxConfig, setShowTaxConfig] = useState(false)
  const [taxConfig, setTaxConfig] = useState<TaxConfig>({})

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/marketplaces/consolidated?workspace_id=${workspaceId}&period=${period}`
      )
      if (res.ok) {
        const json = await res.json()
        setData(json)
        setTaxConfig(json.taxConfig || {})
      }
    } catch (e) {
      console.error('Failed to fetch consolidated data', e)
    } finally {
      setLoading(false)
    }
  }, [workspaceId, period])

  useEffect(() => { fetchData() }, [fetchData])

  const marketplaces = data?.marketplaces || []
  const totals = data?.totals || { grossRevenue: 0, netRevenue: 0, orders: 0, avgTicket: 0, totalCosts: 0, contributionMargin: 0 }

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
            Configurar Taxas
          </button>
        </div>
      </div>

      {/* Period Filter */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
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
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {marketplaces.map((m) => {
            const config = MARKETPLACE_CONFIG[m.marketplace]
            return (
              <MarketplaceCard
                key={m.marketplace}
                data={m}
                config={config}
                mlConnected={mlConnected}
                onEdit={m.auto ? undefined : () => setShowManualEntry(true)}
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
              <MetricRow label="Fat. Bruto" value={formatBRL(totals.grossRevenue)} />
              <MetricRow label="Fat. Liquido" value={formatBRL(totals.netRevenue)} />
              <MetricRow label="Pedidos" value={String(totals.orders)} />
              <MetricRow label="Ticket Medio" value={formatBRL(totals.avgTicket)} />
              <MetricRow
                label="Margem"
                value={`${totals.contributionMargin.toFixed(1)}%`}
                highlight={totals.contributionMargin > 0}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showManualEntry && (
        <ManualEntryModal
          workspaceId={workspaceId}
          onClose={() => setShowManualEntry(false)}
          onSaved={() => { setShowManualEntry(false); fetchData() }}
        />
      )}
      {showTaxConfig && (
        <TaxConfigModal
          workspaceId={workspaceId}
          taxConfig={taxConfig}
          onClose={() => setShowTaxConfig(false)}
          onSaved={() => { setShowTaxConfig(false); fetchData() }}
        />
      )}
    </div>
  )
}

// --- Sub-components ---

function MarketplaceCard({
  data,
  config,
  mlConnected,
  onEdit,
}: {
  data: MarketplaceData
  config: { name: string; color: string; textColor: string; icon: string }
  mlConnected: boolean
  onEdit?: () => void
}) {
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
        {data.auto ? (
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
        <MetricRow label="Fat. Bruto" value={formatBRL(data.grossRevenue)} />
        <MetricRow label="Fat. Liquido" value={formatBRL(data.netRevenue)} />
        <MetricRow label="Pedidos" value={String(data.orders)} />
        <MetricRow label="Ticket Medio" value={formatBRL(data.avgTicket)} />
        <MetricRow
          label="Margem"
          value={`${data.contributionMargin.toFixed(1)}%`}
          highlight={data.contributionMargin > 0}
        />
      </div>
    </div>
  )
}

function MetricRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-text-muted">{label}</span>
      <span className={`text-xs font-semibold ${highlight ? 'text-success' : 'text-text-primary'}`}>{value}</span>
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
  const [date, setDate] = useState('')
  const [revenue, setRevenue] = useState('')
  const [orders, setOrders] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!date) { setError('Preencha a data.'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/marketplaces/manual-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          marketplace,
          date,
          revenue: parseFloat(revenue) || 0,
          orders: parseInt(orders) || 0,
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
          <h3 className="text-base font-semibold text-text-primary">Lancar Dados</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-lg">&times;</button>
        </div>

        {error && <p className="text-xs text-error mb-3">{error}</p>}

        <div className="space-y-3">
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
          <div>
            <label className="text-xs text-text-muted block mb-1">Data</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-bg-surface border border-border text-text-primary"
            />
          </div>
          <NumericField label="Faturamento (R$)" value={revenue} onChange={setRevenue} />
          <NumericField label="Pedidos" value={orders} onChange={setOrders} />
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
  const [config, setConfig] = useState<TaxConfig>(() => {
    const initial: TaxConfig = {}
    for (const mk of MANUAL_MARKETPLACES) {
      initial[mk] = {
        tax_rate_percent: taxConfig[mk]?.tax_rate_percent || 0,
        shipping_rate_percent: taxConfig[mk]?.shipping_rate_percent || 0,
      }
    }
    return initial
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const updateField = (mk: string, field: 'tax_rate_percent' | 'shipping_rate_percent', value: string) => {
    setConfig((prev) => ({
      ...prev,
      [mk]: { ...prev[mk], [field]: parseFloat(value) || 0 },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/marketplaces/tax-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, config }),
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
          <h3 className="text-base font-semibold text-text-primary">Configurar Taxas</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-lg">&times;</button>
        </div>

        {error && <p className="text-xs text-error mb-3">{error}</p>}

        <p className="text-xs text-text-muted mb-4">
          Configure as taxas de cada marketplace. Serao aplicadas automaticamente nos lancamentos.
        </p>

        <div className="space-y-4">
          {MANUAL_MARKETPLACES.map((mk) => {
            const mkCfg = MARKETPLACE_CONFIG[mk]
            return (
              <div key={mk} className="bg-bg-surface rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold"
                    style={{ backgroundColor: mkCfg.color, color: mkCfg.textColor }}
                  >
                    {mkCfg.icon}
                  </div>
                  <span className="text-xs font-semibold text-text-primary">{mkCfg.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <NumericField
                    label="Taxa plataforma (%)"
                    value={String(config[mk]?.tax_rate_percent || '')}
                    onChange={(v) => updateField(mk, 'tax_rate_percent', v)}
                  />
                  <NumericField
                    label="Taxa frete (%)"
                    value={String(config[mk]?.shipping_rate_percent || '')}
                    onChange={(v) => updateField(mk, 'shipping_rate_percent', v)}
                  />
                </div>
              </div>
            )
          })}
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
