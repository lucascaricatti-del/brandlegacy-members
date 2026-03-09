'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  MONTHS, MONTH_LABELS, METRIC_DEFS, SECTIONS, KEY_METRICS,
  isKeyMetric, calcAllMonths, resolveValue, formatMetricValue, calcAnnualSummary,
  type KeyValues, type MetricKey, type ResultMetric, type MetricDef,
} from '@/lib/utils/media-plan-calc'
import { upsertMetrics, upsertMetricsAdmin } from '@/app/actions/media-plan'

// ============================================================
// View mode types
// ============================================================

type TopTab = 'midia_plan' | 'sales_forecast'
type ViewMode = 'completo' | 'quarters' | 'mes'

type ViewColumn = { key: string; label: string; months: number[]; color?: string }

const QUARTERS: { label: string; months: number[]; color: string }[] = [
  { label: 'Q1', months: [1, 2, 3], color: '#3b82f6' },
  { label: 'Q2', months: [4, 5, 6], color: '#22c55e' },
  { label: 'Q3', months: [7, 8, 9], color: '#eab308' },
  { label: 'Q4', months: [10, 11, 12], color: '#ef4444' },
]

// ============================================================
// Types
// ============================================================

interface CellData {
  value: number | null
  delta_pct: number | null
  mode: 'value' | 'delta_pct'
}

interface Props {
  planId: string
  workspaceId: string
  year: number
  initialMetrics: Array<{
    metric_key: string
    month: number
    value_numeric: number | null
    delta_pct: number | null
    input_mode: string
  }>
  isAdmin?: boolean
}

// ============================================================
// Component
// ============================================================

export default function PlannerClient({ planId, workspaceId, year, initialMetrics, isAdmin }: Props) {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') === 'sales_forecast' ? 'sales_forecast' : 'midia_plan'
  const [topTab, setTopTab] = useState<TopTab>(initialTab)
  const [cells, setCells] = useState<Record<string, Record<number, CellData>>>(() => {
    const map: Record<string, Record<number, CellData>> = {}
    for (const m of initialMetrics) {
      if (!map[m.metric_key]) map[m.metric_key] = {}
      map[m.metric_key][m.month] = {
        value: m.value_numeric,
        delta_pct: m.delta_pct,
        mode: (m.input_mode as 'value' | 'delta_pct') ?? 'value',
      }
    }
    return map
  })

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<ViewMode>('completo')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const pendingRef = useRef<Array<{ metric_key: string; month: number; value_numeric: number | null; delta_pct: number | null; input_mode: 'value' | 'delta_pct' }>>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Resolve key values for calculations
  const keyValues = useMemo<KeyValues>(() => {
    const kv: KeyValues = {}
    for (const key of KEY_METRICS) {
      kv[key] = {}
      for (const month of MONTHS) {
        kv[key][month] = resolveValue(key, month, cells)
      }
    }
    return kv
  }, [cells])

  const resultsByMonth = useMemo(() => calcAllMonths(keyValues), [keyValues])
  const annualSummary = useMemo(() => calcAnnualSummary(keyValues, resultsByMonth), [keyValues, resultsByMonth])

  const getCellValue = useCallback((metricKey: string, month: number): number => {
    if (isKeyMetric(metricKey)) {
      return resolveValue(metricKey, month, cells)
    }
    return resultsByMonth[month]?.[metricKey as ResultMetric] ?? 0
  }, [cells, resultsByMonth])

  // View columns
  const columns = useMemo<ViewColumn[]>(() => {
    if (viewMode === 'quarters') {
      return QUARTERS.map(q => ({ key: q.label, label: q.label, months: q.months, color: q.color }))
    }
    if (viewMode === 'mes') {
      return [{ key: `m${selectedMonth}`, label: MONTH_LABELS[selectedMonth - 1], months: [selectedMonth] }]
    }
    return MONTHS.map((m, i) => ({ key: `m${m}`, label: MONTH_LABELS[i], months: [m] }))
  }, [viewMode, selectedMonth])

  const getColumnValue = useCallback((metricKey: string, months: number[], format: MetricDef['format']): number => {
    if (months.length === 1) return getCellValue(metricKey, months[0])
    const values = months.map(m => getCellValue(metricKey, m))
    if (format === 'percent' || format === 'decimal') {
      const nonZero = values.filter(v => v !== 0)
      return nonZero.length > 0 ? nonZero.reduce((s, v) => s + v, 0) / nonZero.length : 0
    }
    return values.reduce((s, v) => s + v, 0)
  }, [getCellValue])

  // Auto-save with debounce
  const flushSave = useCallback(async () => {
    if (pendingRef.current.length === 0) return
    const batch = [...pendingRef.current]
    pendingRef.current = []
    setSaving(true)
    try {
      if (isAdmin) {
        await upsertMetricsAdmin(planId, batch)
      } else {
        await upsertMetrics(workspaceId, planId, batch)
      }
      setLastSaved(new Date())
    } catch (e) {
      console.error('Save error:', e)
    } finally {
      setSaving(false)
    }
  }, [planId, workspaceId, isAdmin])

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(flushSave, 800)
  }, [flushSave])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (pendingRef.current.length > 0) {
        const batch = [...pendingRef.current]
        pendingRef.current = []
        if (isAdmin) {
          upsertMetricsAdmin(planId, batch)
        } else {
          upsertMetrics(workspaceId, planId, batch)
        }
      }
    }
  }, [planId, workspaceId, isAdmin])

  const updateCell = useCallback((metricKey: string, month: number, value: number | null, mode: 'value' | 'delta_pct' = 'value') => {
    setCells((prev) => {
      const next = { ...prev }
      if (!next[metricKey]) next[metricKey] = {}
      next[metricKey] = { ...next[metricKey] }
      if (mode === 'delta_pct') {
        next[metricKey][month] = { value: prev[metricKey]?.[month]?.value ?? null, delta_pct: value, mode: 'delta_pct' }
      } else {
        next[metricKey][month] = { value, delta_pct: prev[metricKey]?.[month]?.delta_pct ?? null, mode: 'value' }
      }
      return next
    })

    const cell = cells[metricKey]?.[month]
    pendingRef.current.push({
      metric_key: metricKey,
      month,
      value_numeric: mode === 'value' ? value : (cell?.value ?? null),
      delta_pct: mode === 'delta_pct' ? value : (cell?.delta_pct ?? null),
      input_mode: mode,
    })
    scheduleSave()
  }, [cells, scheduleSave])

  const toggleMode = useCallback((metricKey: string, month: number) => {
    if (month === 1) return
    const cell = cells[metricKey]?.[month]
    const newMode = cell?.mode === 'delta_pct' ? 'value' : 'delta_pct'
    setCells((prev) => {
      const next = { ...prev }
      if (!next[metricKey]) next[metricKey] = {}
      next[metricKey] = { ...next[metricKey] }
      next[metricKey][month] = { ...next[metricKey][month], mode: newMode }
      return next
    })
    pendingRef.current.push({
      metric_key: metricKey,
      month,
      value_numeric: cell?.value ?? null,
      delta_pct: cell?.delta_pct ?? null,
      input_mode: newMode,
    })
    scheduleSave()
  }, [cells, scheduleSave])

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // CSV export
  const exportCSV = useCallback(() => {
    const header = ['Métrica', ...MONTH_LABELS, 'Total/Média']
    const rows = METRIC_DEFS.map((def) => {
      const values = MONTHS.map((m) => getCellValue(def.key, m))
      const annual = annualSummary[def.key] ?? 0
      return [def.label, ...values.map((v) => v.toString()), annual.toString()]
    })
    const csv = [header, ...rows].map((r) => r.join(';')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `midia-plan-${year}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [getCellValue, annualSummary, year])

  return (
    <div className="animate-fade-in">
      {/* Top tab selector */}
      <div className="flex gap-1 bg-bg-card border border-border rounded-xl p-1 mb-6">
        <button onClick={() => setTopTab('midia_plan')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${topTab === 'midia_plan' ? 'bg-brand-gold text-bg-base shadow-sm' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'}`}>
          Midia Plan
        </button>
        <button onClick={() => setTopTab('sales_forecast')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${topTab === 'sales_forecast' ? 'bg-brand-gold text-bg-base shadow-sm' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'}`}>
          Sales Forecast
        </button>
      </div>

      {topTab === 'sales_forecast' && (
        <SalesForecastTab workspaceId={workspaceId} year={year} isAdmin={isAdmin} />
      )}

      {topTab === 'midia_plan' && (<>
      {/* Connection banner */}
      <div className="mb-4 px-4 py-3 rounded-lg border border-brand-gold/20 bg-brand-gold/5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C9971A" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
          <span className="text-text-secondary">
            <span className="font-medium text-brand-gold">Passo 1: Midia Plan</span> → <button onClick={() => setTopTab('sales_forecast')} className="font-medium text-brand-gold hover:underline cursor-pointer">Passo 2: Sales Forecast →</button>
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Midia Plan {year}</h1>
          <p className="text-sm text-text-muted mt-1">
            Planeje seu investimento, sessões e receita mês a mês
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted">
            {saving ? (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-brand-gold animate-pulse" />
                Salvando...
              </span>
            ) : lastSaved ? (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-success" />
                Salvo {lastSaved.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            ) : null}
          </span>

          {/* View mode toggle */}
          <div className="flex gap-0.5 bg-bg-card border border-border rounded-lg p-0.5">
            {(['completo', 'quarters', 'mes'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  viewMode === mode
                    ? 'bg-brand-gold text-bg-base font-medium'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {mode === 'completo' ? 'Completo' : mode === 'quarters' ? 'Quarters' : 'Mês'}
              </button>
            ))}
          </div>

          {viewMode === 'mes' && (
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="bg-bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary"
            >
              {MONTH_LABELS.map((l, i) => <option key={i} value={i + 1}>{l}</option>)}
            </select>
          )}

          <div className="flex items-center gap-1 bg-bg-card border border-border rounded-lg">
            <a
              href={isAdmin ? `?year=${year - 1}` : `/ferramentas/planejamento-midia/${year - 1}`}
              className="p-2 hover:bg-bg-hover rounded-l-lg transition-colors text-text-muted hover:text-text-primary"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            </a>
            <span className="px-3 py-1.5 text-sm font-semibold text-text-primary">{year}</span>
            <a
              href={isAdmin ? `?year=${year + 1}` : `/ferramentas/planejamento-midia/${year + 1}`}
              className="p-2 hover:bg-bg-hover rounded-r-lg transition-colors text-text-muted hover:text-text-primary"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            </a>
          </div>

          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-card border border-border text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            CSV
          </button>
        </div>
      </div>

      {/* Spreadsheet */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border" style={{ background: 'linear-gradient(90deg, #0a1a0f, #0d2015)' }}>
                <th className="sticky left-0 z-10 text-left px-4 py-3 font-semibold text-text-secondary min-w-[220px] border-r border-border" style={{ fontSize: 13, background: '#0a1a0f' }}>
                  Métrica
                </th>
                {columns.map((col) => (
                  <th key={col.key} className="px-3 py-3 text-center font-medium min-w-[115px]" style={{ fontSize: 12, color: col.color || undefined }}>
                    {col.label}
                  </th>
                ))}
                <th className="px-3 py-3 text-center font-bold min-w-[130px] border-l border-border" style={{ fontSize: 13, color: '#c9a84c' }}>
                  Total/Média
                </th>
              </tr>
            </thead>

            <tbody>
              {SECTIONS.map((section) => {
                const sectionMetrics = METRIC_DEFS.filter((d) => d.section === section.key)
                const isCollapsed = collapsedSections.has(section.key)

                return (
                  <SectionGroup
                    key={section.key}
                    section={section}
                    metrics={sectionMetrics}
                    isCollapsed={isCollapsed}
                    onToggle={() => toggleSection(section.key)}
                    getCellValue={getCellValue}
                    getColumnValue={getColumnValue}
                    columns={columns}
                    cells={cells}
                    annualSummary={annualSummary}
                    onUpdateCell={updateCell}
                    onToggleMode={toggleMode}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 text-xs text-text-muted flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-gold" />
          Editável
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 rounded" style={{ background: '#c9a84c' }} />
          Destaque
        </span>
        <span>Clique no &Delta;% para alternar entre valor absoluto e variação percentual</span>
      </div>
      </>)}
    </div>
  )
}

// ============================================================
// Sales Forecast Tab
// ============================================================

type SFColumn = { key: string; label: string; months: number[]; color?: string }
type ForecastChannel = 'ecommerce' | 'marketplaces' | 'consolidado'
type ForecastRow = {
  key: string
  label: string
  section: string
  editable: boolean
  format: 'currency' | 'number' | 'percent' | 'roas'
  field?: string // maps to DB column for editable fields
  highlight?: boolean
  resultColor?: 'gold' | 'profit'
}

const SF_MONTHS = [1,2,3,4,5,6,7,8,9,10,11,12]
const SF_MONTH_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const FORECAST_ROWS: ForecastRow[] = [
  // FATURAMENTO
  { key: 'faturamento_bruto', label: 'Faturamento Bruto', section: 'faturamento', editable: true, format: 'currency', field: 'faturamento_bruto' },
  { key: 'pedidos', label: 'Pedidos', section: 'faturamento', editable: true, format: 'number', field: 'pedidos' },
  { key: 'ticket_medio', label: 'Ticket Médio', section: 'faturamento', editable: false, format: 'currency', resultColor: 'gold' },
  // TAXAS & COMISSÕES
  { key: 'imposto_pct', label: 'Impostos %', section: 'taxas', editable: true, format: 'percent', field: 'imposto_pct' },
  { key: 'imposto_rs', label: 'Impostos R$', section: 'taxas', editable: false, format: 'currency', resultColor: 'gold' },
  { key: 'cmv_pct', label: 'CMV %', section: 'taxas', editable: true, format: 'percent', field: 'cmv_pct' },
  { key: 'cmv_rs', label: 'CMV R$', section: 'taxas', editable: false, format: 'currency', resultColor: 'gold' },
  // MÍDIA
  { key: 'investimento_midia', label: 'Investimento Mídia', section: 'midia', editable: true, format: 'currency', field: 'investimento_midia' },
  { key: 'roas', label: 'ROAS', section: 'midia', editable: false, format: 'roas', resultColor: 'gold' },
  // RESULTADO
  { key: 'faturamento_liquido', label: 'Faturamento Líquido', section: 'resultado', editable: false, format: 'currency', resultColor: 'gold', highlight: true },
  { key: 'lucro_apos_aquisicao', label: 'Lucro Após Aquisição', section: 'resultado', editable: false, format: 'currency', resultColor: 'profit', highlight: true },
]

const SF_SECTIONS = [
  { key: 'faturamento', label: 'FATURAMENTO', icon: '💰', color: 'text-brand-gold' },
  { key: 'taxas', label: 'TAXAS & COMISSÕES', icon: '📊', color: 'text-yellow-400' },
  { key: 'midia', label: 'MÍDIA', icon: '📢', color: 'text-blue-400' },
  { key: 'resultado', label: 'RESULTADO', icon: '🎯', color: 'text-emerald-400' },
]

type ForecastData = Record<string, Record<number, Record<string, number | null>>>
// channel -> month -> field -> value

function SalesForecastTab({ workspaceId, year, isAdmin }: { workspaceId: string; year: number; isAdmin?: boolean }) {
  const [channel, setChannel] = useState<ForecastChannel>('ecommerce')
  const [data, setData] = useState<ForecastData>({})
  const [loading, setLoading] = useState(true)
  const [savingCell, setSavingCell] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [sfViewMode, setSfViewMode] = useState<'completo' | 'quarters'>('completo')
  const [sfSelectedMonth, setSfSelectedMonth] = useState(new Date().getMonth() + 1)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/sales-forecast?workspace_id=${workspaceId}&year=${year}`)
      .then(r => r.json())
      .then(json => {
        const map: ForecastData = {}
        for (const f of json.forecasts || []) {
          if (!map[f.channel]) map[f.channel] = {}
          map[f.channel][f.month] = {
            faturamento_bruto: f.faturamento_bruto != null ? Number(f.faturamento_bruto) : null,
            pedidos: f.pedidos != null ? Number(f.pedidos) : null,
            investimento_midia: f.investimento_midia != null ? Number(f.investimento_midia) : null,
            imposto_pct: f.imposto_pct != null ? Number(f.imposto_pct) : null,
            cmv_pct: f.cmv_pct != null ? Number(f.cmv_pct) : null,
            ticket_medio: f.ticket_medio != null ? Number(f.ticket_medio) : null,
            imposto_rs: f.imposto_rs != null ? Number(f.imposto_rs) : null,
            cmv_rs: f.cmv_rs != null ? Number(f.cmv_rs) : null,
            faturamento_liquido: f.faturamento_liquido != null ? Number(f.faturamento_liquido) : null,
            lucro_apos_aquisicao: f.lucro_apos_aquisicao != null ? Number(f.lucro_apos_aquisicao) : null,
            roas: f.roas != null ? Number(f.roas) : null,
          }
        }
        setData(map)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [workspaceId, year])

  async function handleImportMidia() {
    setImporting(true)
    setImportMsg(null)
    try {
      const res = await fetch('/api/sales-forecast/import-midia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, year }),
      })
      const json = await res.json()
      if (!res.ok) {
        setImportMsg({ type: 'err', text: json.error || 'Erro ao importar' })
      } else {
        setImportMsg({ type: 'ok', text: `${json.imported} meses importados do Midia Plan!` })
        // Reload data
        const r2 = await fetch(`/api/sales-forecast?workspace_id=${workspaceId}&year=${year}`)
        const j2 = await r2.json()
        const map: ForecastData = {}
        for (const f of j2.forecasts || []) {
          if (!map[f.channel]) map[f.channel] = {}
          map[f.channel][f.month] = {
            faturamento_bruto: f.faturamento_bruto != null ? Number(f.faturamento_bruto) : null,
            pedidos: f.pedidos != null ? Number(f.pedidos) : null,
            investimento_midia: f.investimento_midia != null ? Number(f.investimento_midia) : null,
            imposto_pct: f.imposto_pct != null ? Number(f.imposto_pct) : null,
            cmv_pct: f.cmv_pct != null ? Number(f.cmv_pct) : null,
            ticket_medio: f.ticket_medio != null ? Number(f.ticket_medio) : null,
            imposto_rs: f.imposto_rs != null ? Number(f.imposto_rs) : null,
            cmv_rs: f.cmv_rs != null ? Number(f.cmv_rs) : null,
            faturamento_liquido: f.faturamento_liquido != null ? Number(f.faturamento_liquido) : null,
            lucro_apos_aquisicao: f.lucro_apos_aquisicao != null ? Number(f.lucro_apos_aquisicao) : null,
            roas: f.roas != null ? Number(f.roas) : null,
          }
        }
        setData(map)
      }
    } catch {
      setImportMsg({ type: 'err', text: 'Erro ao importar' })
    }
    setImporting(false)
    setTimeout(() => setImportMsg(null), 4000)
  }

  const sfColumns = useMemo<SFColumn[]>(() => {
    if (sfViewMode === 'quarters') {
      return [
        { key: 'Q1', label: 'Q1', months: [1, 2, 3], color: '#3b82f6' },
        { key: 'Q2', label: 'Q2', months: [4, 5, 6], color: '#22c55e' },
        { key: 'Q3', label: 'Q3', months: [7, 8, 9], color: '#eab308' },
        { key: 'Q4', label: 'Q4', months: [10, 11, 12], color: '#ef4444' },
      ]
    }
    return SF_MONTHS.map((m, i) => ({ key: `m${m}`, label: SF_MONTH_LABELS[i], months: [m] }))
  }, [sfViewMode])

  // Get value for a cell — for consolidado, sum ecommerce + marketplaces
  function getValue(ch: ForecastChannel, month: number, field: string): number | null {
    if (ch === 'consolidado') {
      const e = data['ecommerce']?.[month]?.[field] ?? null
      const m = data['marketplaces']?.[month]?.[field] ?? null
      if (e === null && m === null) return null
      // For % fields, compute weighted average
      if (field === 'imposto_pct' || field === 'cmv_pct') {
        const eRev = data['ecommerce']?.[month]?.['faturamento_bruto'] ?? 0
        const mRev = data['marketplaces']?.[month]?.['faturamento_bruto'] ?? 0
        const total = eRev + mRev
        if (total === 0) return null
        return Math.round(((e ?? 0) * eRev + (m ?? 0) * mRev) / total * 100) / 100
      }
      // For ticket_medio, recalculate from sums
      if (field === 'ticket_medio') {
        const totalRev = (data['ecommerce']?.[month]?.['faturamento_bruto'] ?? 0) + (data['marketplaces']?.[month]?.['faturamento_bruto'] ?? 0)
        const totalOrd = (data['ecommerce']?.[month]?.['pedidos'] ?? 0) + (data['marketplaces']?.[month]?.['pedidos'] ?? 0)
        return totalOrd > 0 ? Math.round(totalRev / totalOrd * 100) / 100 : null
      }
      // For ROAS, recalculate from sums
      if (field === 'roas') {
        const totalRev = (data['ecommerce']?.[month]?.['faturamento_bruto'] ?? 0) + (data['marketplaces']?.[month]?.['faturamento_bruto'] ?? 0)
        const totalSpend = (data['ecommerce']?.[month]?.['investimento_midia'] ?? 0) + (data['marketplaces']?.[month]?.['investimento_midia'] ?? 0)
        return totalSpend > 0 ? Math.round(totalRev / totalSpend * 100) / 100 : null
      }
      return (e ?? 0) + (m ?? 0)
    }
    return data[ch]?.[month]?.[field] ?? null
  }

  // Compute derived values client-side for immediate feedback
  function getDisplayValue(ch: ForecastChannel, month: number, field: string): number | null {
    if (ch === 'consolidado') return getValue(ch, month, field)

    const raw = data[ch]?.[month]
    if (!raw) return null

    const fb = raw.faturamento_bruto ?? 0
    const ped = raw.pedidos ?? 0
    const imp = raw.imposto_pct ?? 0
    const cmv = raw.cmv_pct ?? 0
    const inv = raw.investimento_midia ?? 0

    switch (field) {
      case 'ticket_medio': return ped > 0 ? Math.round(fb / ped * 100) / 100 : null
      case 'imposto_rs': return Math.round(fb * imp / 100 * 100) / 100
      case 'cmv_rs': return Math.round(fb * cmv / 100 * 100) / 100
      case 'faturamento_liquido': return Math.round(fb * (1 - imp / 100) * 100) / 100
      case 'lucro_apos_aquisicao': return Math.round((fb * (1 - imp / 100 - cmv / 100) - inv) * 100) / 100
      case 'roas': return inv > 0 ? Math.round(fb / inv * 100) / 100 : null
      default: return raw[field] ?? null
    }
  }

  // Annual total for a row
  function getAnnual(ch: ForecastChannel, field: string, format: string): number | null {
    const values = SF_MONTHS.map(m => getDisplayValue(ch, m, field))
    const nonNull = values.filter(v => v !== null) as number[]
    if (nonNull.length === 0) return null
    if (format === 'percent' || format === 'roas') {
      return Math.round(nonNull.reduce((s, v) => s + v, 0) / nonNull.length * 100) / 100
    }
    return Math.round(nonNull.reduce((s, v) => s + v, 0) * 100) / 100
  }

  async function saveCell(ch: ForecastChannel, month: number, field: string, value: number | null) {
    const cellKey = `${ch}-${month}-${field}`
    setSavingCell(cellKey)

    // Update local state immediately
    setData(prev => {
      const next = { ...prev }
      if (!next[ch]) next[ch] = {}
      next[ch] = { ...next[ch] }
      next[ch][month] = { ...(next[ch][month] || {}), [field]: value }
      return next
    })

    try {
      const body: any = { workspace_id: workspaceId, year, month, channel: ch }
      // Send all editable fields for this cell's month/channel
      const current = data[ch]?.[month] || {}
      body.faturamento_bruto = field === 'faturamento_bruto' ? value : (current.faturamento_bruto ?? null)
      body.pedidos = field === 'pedidos' ? value : (current.pedidos ?? null)
      body.investimento_midia = field === 'investimento_midia' ? value : (current.investimento_midia ?? null)
      body.imposto_pct = field === 'imposto_pct' ? value : (current.imposto_pct ?? null)
      body.cmv_pct = field === 'cmv_pct' ? value : (current.cmv_pct ?? null)

      await fetch('/api/sales-forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch {}
    setSavingCell(null)
  }

  function fmtVal(v: number | null, format: string): string {
    if (v === null || v === undefined) return '-'
    if (format === 'currency') return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })
    if (format === 'percent') return `${v}%`
    if (format === 'roas') return v > 0 ? `${v.toFixed(1)}x` : '-'
    if (format === 'number') return v.toLocaleString('pt-BR')
    return String(v)
  }

  const isConsolidado = channel === 'consolidado'

  return (
    <>
      {/* Connection banner: Midia Plan → Sales Forecast */}
      <div className="mb-4 px-4 py-3 rounded-lg border border-brand-gold/20 bg-brand-gold/5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C9971A" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
          <span className="text-text-secondary">
            <span className="font-medium text-brand-gold">Passo 1: Midia Plan</span> → <span className="font-medium text-brand-gold">Passo 2: Sales Forecast</span> → <a href="/ferramentas/forecast" className="font-medium text-brand-gold hover:underline">Passo 3: Forecast →</a>
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Sales Forecast {year}</h1>
          <p className="text-sm text-text-muted mt-1">Projeção de faturamento, custos e lucro por canal</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex gap-0.5 bg-bg-card border border-border rounded-lg p-0.5">
            {(['completo', 'quarters'] as const).map((mode) => (
              <button key={mode} onClick={() => setSfViewMode(mode)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${sfViewMode === mode ? 'bg-brand-gold text-bg-base font-medium' : 'text-text-muted hover:text-text-secondary'}`}>
                {mode === 'completo' ? 'Completo' : 'Quarters'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-bg-card border border-border rounded-lg">
            <a href={isAdmin ? `?year=${year - 1}` : `/ferramentas/planejamento-midia/${year - 1}?tab=sales_forecast`}
              className="p-2 hover:bg-bg-hover rounded-l-lg transition-colors text-text-muted hover:text-text-primary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            </a>
            <span className="px-3 py-1.5 text-sm font-semibold text-text-primary">{year}</span>
            <a href={isAdmin ? `?year=${year + 1}` : `/ferramentas/planejamento-midia/${year + 1}?tab=sales_forecast`}
              className="p-2 hover:bg-bg-hover rounded-r-lg transition-colors text-text-muted hover:text-text-primary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            </a>
          </div>

          <button onClick={handleImportMidia} disabled={importing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-sm text-purple-400 hover:bg-purple-500/20 transition-colors disabled:opacity-50">
            {importing ? (
              <span className="w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
            )}
            Importar do Midia Plan
          </button>
        </div>
      </div>

      {importMsg && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm ${importMsg.type === 'ok' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
          {importMsg.text}
        </div>
      )}

      {/* Channel sub-tabs */}
      <div className="flex gap-1 bg-bg-card border border-border rounded-xl p-1 mb-4">
        {([['ecommerce', 'E-commerce'], ['marketplaces', 'Marketplaces'], ['consolidado', 'Consolidado']] as [ForecastChannel, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setChannel(k)}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${
              channel === k ? 'bg-brand-gold text-bg-base shadow-sm' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
            }`}>{l}{k === 'consolidado' && <span className="text-[10px] ml-1 opacity-70">(soma)</span>}</button>
        ))}
      </div>

      {loading ? (
        <div className="bg-bg-card border border-border rounded-xl p-16 text-center">
          <div className="w-6 h-6 border-2 border-brand-gold border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : (
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border" style={{ background: 'linear-gradient(90deg, #0a1a0f, #0d2015)' }}>
                  <th className="sticky left-0 z-10 text-left px-4 py-3 font-semibold text-text-secondary min-w-[200px] border-r border-border" style={{ fontSize: 13, background: '#0a1a0f' }}>
                    Métrica
                  </th>
                  {sfColumns.map((col) => (
                    <th key={col.key} className="px-2 py-3 text-center font-medium min-w-[100px]" style={{ fontSize: 12, color: col.color || undefined }}>{col.label}</th>
                  ))}
                  <th className="px-3 py-3 text-center font-bold min-w-[120px] border-l border-border" style={{ fontSize: 13, color: '#c9a84c' }}>
                    Total/Média
                  </th>
                </tr>
              </thead>
              <tbody>
                {SF_SECTIONS.map(section => {
                  const rows = FORECAST_ROWS.filter(r => r.section === section.key)
                  return (
                    <SFSectionGroup key={section.key} section={section} rows={rows} channel={channel}
                      getDisplayValue={getDisplayValue} getAnnual={getAnnual} fmtVal={fmtVal}
                      isConsolidado={isConsolidado} saveCell={saveCell} savingCell={savingCell}
                      columns={sfColumns} />
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-6 text-xs text-text-muted flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-brand-gold" /> Editável</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded text-emerald-400" style={{ fontSize: 10 }}>●</span> Verde = lucro positivo</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded text-red-400" style={{ fontSize: 10 }}>●</span> Vermelho = prejuízo</span>
        {isConsolidado && <span>Consolidado = soma de E-commerce + Marketplaces (somente leitura)</span>}
      </div>
    </>
  )
}

// ============================================================
// Sales Forecast Section Group
// ============================================================

function SFSectionGroup({ section, rows, channel, getDisplayValue, getAnnual, fmtVal, isConsolidado, saveCell, savingCell, columns }: {
  section: { key: string; label: string; icon: string; color: string }
  rows: ForecastRow[]
  channel: ForecastChannel
  getDisplayValue: (ch: ForecastChannel, m: number, field: string) => number | null
  getAnnual: (ch: ForecastChannel, field: string, format: string) => number | null
  fmtVal: (v: number | null, format: string) => string
  isConsolidado: boolean
  saveCell: (ch: ForecastChannel, m: number, field: string, v: number | null) => void
  savingCell: string | null
  columns: SFColumn[]
}) {
  return (
    <>
      <tr className="border-t-2 border-border">
        <td colSpan={columns.length + 2} className="sticky left-0 z-10 px-4 py-3" style={{ background: '#0a1a0f' }}>
          <div className="flex items-center gap-2.5">
            <span style={{ fontSize: 16 }}>{section.icon}</span>
            <span className={`font-bold uppercase tracking-wider ${section.color}`} style={{ fontSize: 13 }}>{section.label}</span>
          </div>
        </td>
      </tr>
      {rows.map(row => (
        <SFRow key={row.key} row={row} channel={channel} getDisplayValue={getDisplayValue}
          getAnnual={getAnnual} fmtVal={fmtVal} isConsolidado={isConsolidado} saveCell={saveCell} savingCell={savingCell}
          columns={columns} />
      ))}
    </>
  )
}

// ============================================================
// Sales Forecast Row
// ============================================================

function SFRow({ row, channel, getDisplayValue, getAnnual, fmtVal, isConsolidado, saveCell, savingCell, columns }: {
  row: ForecastRow
  channel: ForecastChannel
  getDisplayValue: (ch: ForecastChannel, m: number, field: string) => number | null
  getAnnual: (ch: ForecastChannel, field: string, format: string) => number | null
  fmtVal: (v: number | null, format: string) => string
  isConsolidado: boolean
  saveCell: (ch: ForecastChannel, m: number, field: string, v: number | null) => void
  savingCell: string | null
  columns: SFColumn[]
}) {
  const canEdit = row.editable && !isConsolidado
  const annual = getAnnual(channel, row.key, row.format)
  const isProfit = row.resultColor === 'profit'

  function getQuarterValue(months: number[]): number | null {
    const values = months.map(m => getDisplayValue(channel, m, row.key)).filter(v => v !== null) as number[]
    if (values.length === 0) return null
    if (row.format === 'percent' || row.format === 'roas') {
      return Math.round(values.reduce((s, v) => s + v, 0) / values.length * 100) / 100
    }
    return Math.round(values.reduce((s, v) => s + v, 0) * 100) / 100
  }

  return (
    <tr className={`border-t transition-colors ${canEdit ? 'hover:bg-bg-hover/30' : ''} ${row.highlight ? 'border-border' : 'border-border/40'}`}
      style={row.highlight ? { background: 'linear-gradient(90deg, #0a1a0f, #0d2015)' } : undefined}>
      <td className="sticky left-0 z-10 px-4 py-0 border-r border-border"
        style={{ background: row.highlight ? '#0a1a0f' : undefined, borderLeft: row.highlight ? '3px solid #c9a84c' : undefined }}>
        <div className="flex items-center gap-2">
          {canEdit && <span className="w-1.5 h-1.5 rounded-full bg-brand-gold shrink-0" />}
          <span className={row.highlight ? 'font-bold' : canEdit ? 'text-text-primary' : 'text-text-secondary'}
            style={{ fontSize: row.highlight ? 13 : 12, color: row.highlight && !isProfit ? '#c9a84c' : undefined }}>
            {row.label}
          </span>
        </div>
      </td>
      {columns.map(col => {
        if (col.months.length === 1) {
          const m = col.months[0]
          const val = getDisplayValue(channel, m, row.key)
          const cellKey = `${channel}-${m}-${row.key}`
          const isSaving = savingCell === cellKey

          if (canEdit) {
            return (
              <td key={col.key} className="px-1 py-0 text-center">
                <SFEditableCell value={val} format={row.format} isSaving={isSaving}
                  onSave={v => saveCell(channel, m, row.field!, v)} />
              </td>
            )
          }

          const color = isProfit
            ? (val === null ? '#6b7c6f' : val >= 0 ? '#4ade80' : '#ef4444')
            : (val === null || val === 0 ? '#6b7c6f' : '#c9a84c')

          return (
            <td key={col.key} className="px-1 py-0 text-center">
              <span className="tabular-nums px-2 py-2 block" style={{ fontSize: row.highlight ? 13 : 12, color, fontWeight: row.highlight ? 700 : 600 }}>
                {fmtVal(val, row.format)}
              </span>
            </td>
          )
        }

        // Quarter view — aggregated read-only
        const qVal = getQuarterValue(col.months)
        const color = isProfit
          ? (qVal === null ? '#6b7c6f' : qVal >= 0 ? '#4ade80' : '#ef4444')
          : (qVal === null || qVal === 0 ? '#6b7c6f' : col.color || '#c9a84c')

        return (
          <td key={col.key} className="px-1 py-0 text-center">
            <span className="tabular-nums px-2 py-2 block font-semibold" style={{ fontSize: 13, color }}>
              {fmtVal(qVal, row.format)}
            </span>
          </td>
        )
      })}
      <td className="px-3 py-2 text-center border-l border-border">
        <span className="tabular-nums font-bold" style={{
          fontSize: 14,
          color: isProfit
            ? (annual === null ? '#6b7c6f' : annual >= 0 ? '#4ade80' : '#ef4444')
            : '#c9a84c',
        }}>
          {fmtVal(annual, row.format)}
        </span>
      </td>
    </tr>
  )
}

// ============================================================
// Sales Forecast Editable Cell
// ============================================================

function SFEditableCell({ value, format, isSaving, onSave }: {
  value: number | null; format: string; isSaving: boolean
  onSave: (v: number | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const isCurrency = format === 'currency'
  const isPct = format === 'percent'

  function fmtDisplay(v: number | null): string {
    if (v === null) return '-'
    if (isCurrency) return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })
    if (isPct) return `${v.toFixed(1).replace('.', ',')}%`
    if (format === 'number') return v.toLocaleString('pt-BR')
    return String(v)
  }

  function startEdit() {
    setInputValue(value != null ? String(value).replace('.', ',') : '')
    setEditing(true)
  }

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function commit() {
    setEditing(false)
    const trimmed = inputValue.trim()
    const num = trimmed === '' ? null : parseFloat(trimmed.replace(',', '.'))
    if (num !== null && isNaN(num)) return
    onSave(num)
  }

  if (editing) {
    return (
      <div className="relative flex items-center">
        {isCurrency && <span className="absolute left-1.5 text-brand-gold/60" style={{ fontSize: 10 }}>R$</span>}
        <input ref={inputRef} type="text" value={inputValue}
          onChange={e => {
            const v = e.target.value.replace(/[^0-9,.\-]/g, '')
            setInputValue(v)
          }}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
          className="w-full border rounded py-1.5 text-center outline-none tabular-nums"
          style={{
            fontSize: 12,
            background: 'rgba(201,168,76,0.08)',
            borderColor: 'rgba(201,168,76,0.4)',
            color: '#e8e0d0',
            paddingLeft: isCurrency ? 24 : 8,
            paddingRight: isPct ? 20 : 8,
          }} />
        {isPct && <span className="absolute right-1.5 text-brand-gold/60" style={{ fontSize: 10 }}>%</span>}
      </div>
    )
  }

  return (
    <button onClick={startEdit}
      className="w-full tabular-nums px-2 py-2 rounded hover:bg-bg-hover transition-colors text-text-primary cursor-text text-center block relative"
      style={{ fontSize: 12 }}>
      {fmtDisplay(value)}
      {isSaving && <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-brand-gold animate-pulse" />}
    </button>
  )
}

// ============================================================
// Section Group
// ============================================================

function SectionGroup({
  section,
  metrics,
  isCollapsed,
  onToggle,
  getCellValue,
  getColumnValue,
  columns,
  cells,
  annualSummary,
  onUpdateCell,
  onToggleMode,
}: {
  section: typeof SECTIONS[number]
  metrics: MetricDef[]
  isCollapsed: boolean
  onToggle: () => void
  getCellValue: (key: string, month: number) => number
  getColumnValue: (key: string, months: number[], format: MetricDef['format']) => number
  columns: ViewColumn[]
  cells: Record<string, Record<number, CellData>>
  annualSummary: Record<MetricKey, number>
  onUpdateCell: (key: string, month: number, value: number | null, mode?: 'value' | 'delta_pct') => void
  onToggleMode: (key: string, month: number) => void
}) {
  return (
    <>
      {/* Section header — emoji + label, larger padding */}
      <tr
        className="cursor-pointer hover:bg-bg-hover/50 transition-colors border-t-2 border-border"
        onClick={onToggle}
      >
        <td
          className="sticky left-0 z-10 px-4 py-3.5 border-r border-border"
          colSpan={columns.length + 2}
          style={{ background: '#0a1a0f' }}
        >
          <div className="flex items-center gap-2.5">
            <span style={{ fontSize: 16 }}>{section.icon}</span>
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              className={`${section.color} transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span className={`font-bold uppercase tracking-wider ${section.color}`} style={{ fontSize: 13 }}>
              {section.label}
            </span>
            <span className="text-text-muted" style={{ fontSize: 10 }}>
              ({metrics.length})
            </span>
          </div>
        </td>
      </tr>

      {!isCollapsed && metrics.map((def) => (
        <MetricRow
          key={def.key}
          def={def}
          getCellValue={getCellValue}
          getColumnValue={getColumnValue}
          columns={columns}
          cells={cells}
          annual={annualSummary[def.key] ?? 0}
          onUpdateCell={onUpdateCell}
          onToggleMode={onToggleMode}
        />
      ))}
    </>
  )
}

// ============================================================
// Metric Row
// ============================================================

function MetricRow({
  def,
  getCellValue,
  getColumnValue,
  columns,
  cells,
  annual,
  onUpdateCell,
  onToggleMode,
}: {
  def: MetricDef
  getCellValue: (key: string, month: number) => number
  getColumnValue: (key: string, months: number[], format: MetricDef['format']) => number
  columns: ViewColumn[]
  cells: Record<string, Record<number, CellData>>
  annual: number
  onUpdateCell: (key: string, month: number, value: number | null, mode?: 'value' | 'delta_pct') => void
  onToggleMode: (key: string, month: number) => void
}) {
  const isResult = !def.isKey

  // Row background: result rows get gradient
  const rowBg = isResult
    ? 'linear-gradient(90deg, #0a1a0f, #0d2015)'
    : undefined

  // Left border for highlight rows
  const leftBorder = def.isHighlight
    ? '3px solid #c9a84c'
    : def.isSubtotal
      ? '3px solid rgba(201,168,76,0.3)'
      : undefined

  return (
    <tr
      className={`border-t transition-colors ${
        def.isSubtotal ? 'border-border' : 'border-border/40'
      } ${def.isKey ? 'hover:bg-bg-hover/30' : ''}`}
      style={{ background: rowBg }}
    >
      {/* Metric label — sticky */}
      <td
        className="sticky left-0 z-10 px-4 py-0 border-r border-border"
        style={{
          background: isResult ? '#0a1a0f' : undefined,
          borderLeft: leftBorder,
        }}
      >
        <div className="flex items-center gap-2">
          {def.isKey && (
            <span className="w-1.5 h-1.5 rounded-full bg-brand-gold shrink-0" title="Editável" />
          )}
          <span
            className={def.isKey ? 'text-text-primary' : (def.isHighlight || def.isSubtotal) ? 'font-bold' : 'text-text-secondary'}
            style={{
              fontSize: isResult ? 13 : 12,
              color: def.isHighlight ? '#c9a84c' : def.isSubtotal ? '#e0d5b8' : undefined,
            }}
          >
            {def.label}
          </span>
        </div>
      </td>

      {/* Column cells */}
      {columns.map((col) => {
        const isSingleMonth = col.months.length === 1
        const month = col.months[0]

        if (isSingleMonth) {
          const value = getCellValue(def.key, month)
          const cell = cells[def.key]?.[month]
          const isDeltaMode = cell?.mode === 'delta_pct' && month > 1

          return (
            <td key={col.key} className="px-1 py-0 text-center">
              {def.isKey ? (
                <EditableCell
                  value={value}
                  rawCell={cell}
                  month={month}
                  metricKey={def.key}
                  format={def.format}
                  decimals={def.decimals}
                  isDeltaMode={isDeltaMode}
                  onUpdate={(v, mode) => onUpdateCell(def.key, month, v, mode)}
                  onToggleMode={() => onToggleMode(def.key, month)}
                />
              ) : (
                <ResultCell value={value} def={def} />
              )}
            </td>
          )
        }

        // Multi-month (quarter) — read-only aggregated value
        const aggValue = getColumnValue(def.key, col.months, def.format)
        const isNeg = aggValue < 0
        const color = aggValue === 0 ? '#6b7c6f' : isNeg ? '#ef4444' : col.color || '#c9a84c'

        return (
          <td key={col.key} className="px-1 py-0 text-center">
            <span
              className="tabular-nums px-2 py-2 block font-semibold"
              style={{ fontSize: 13, color }}
            >
              {aggValue === 0 ? '-' : formatMetricValue(aggValue, def.format, def.decimals)}
            </span>
          </td>
        )
      })}

      {/* Annual total/average */}
      <td className="px-3 py-2 text-center border-l border-border">
        <span
          className="tabular-nums font-bold"
          style={{
            fontSize: 14,
            color: def.isHighlight
              ? (annual >= 0 ? '#c9a84c' : '#ef4444')
              : isResult
                ? (annual >= 0 ? '#c9a84c' : '#ef4444')
                : '#c9a84c',
          }}
        >
          {annual === 0 ? '-' : formatMetricValue(annual, def.format, def.decimals)}
        </span>
      </td>
    </tr>
  )
}

// ============================================================
// Result Cell (read-only, styled)
// ============================================================

function ResultCell({ value, def }: { value: number; def: MetricDef }) {
  const isNeg = value < 0
  const color = value === 0 ? '#6b7c6f' : isNeg ? '#ef4444' : '#c9a84c'

  return (
    <span
      className="tabular-nums px-2 py-2 block font-semibold"
      style={{ fontSize: 13, color }}
    >
      {value === 0 ? '-' : formatMetricValue(value, def.format, def.decimals)}
    </span>
  )
}

// ============================================================
// Editable Cell
// ============================================================

function EditableCell({
  value,
  rawCell,
  month,
  metricKey,
  format,
  decimals,
  isDeltaMode,
  onUpdate,
  onToggleMode,
}: {
  value: number
  rawCell: CellData | undefined
  month: number
  metricKey: string
  format: MetricDef['format']
  decimals?: number
  isDeltaMode: boolean
  onUpdate: (v: number | null, mode?: 'value' | 'delta_pct') => void
  onToggleMode: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const isCurrency = format === 'currency'
  const isPct = format === 'percent' || format === 'decimal'

  const startEdit = () => {
    if (isDeltaMode) {
      setInputValue(rawCell?.delta_pct?.toString().replace('.', ',') ?? '')
    } else {
      setInputValue((rawCell?.value?.toString() ?? value.toString()).replace('.', ','))
    }
    setEditing(true)
  }

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commitEdit = () => {
    setEditing(false)
    const num = inputValue.trim() === '' ? null : parseFloat(inputValue.replace(',', '.'))
    if (num !== null && isNaN(num)) return
    if (isDeltaMode) {
      onUpdate(num, 'delta_pct')
    } else {
      onUpdate(num, 'value')
    }
  }

  if (editing) {
    const showPctSuffix = isDeltaMode || isPct
    return (
      <div className="relative flex items-center">
        {isCurrency && !isDeltaMode && <span className="absolute left-1.5 text-brand-gold/60 z-10" style={{ fontSize: 10 }}>R$</span>}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9,.\-]/g, '')
            setInputValue(v)
          }}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitEdit()
            if (e.key === 'Escape') setEditing(false)
          }}
          className="w-full border rounded py-1.5 text-center outline-none tabular-nums"
          style={{
            fontSize: 12,
            background: 'rgba(201,168,76,0.08)',
            borderColor: 'rgba(201,168,76,0.4)',
            color: '#e8e0d0',
            paddingLeft: isCurrency && !isDeltaMode ? 24 : 8,
            paddingRight: showPctSuffix ? 20 : 8,
          }}
        />
        {showPctSuffix && (
          <span className="absolute right-1.5 text-brand-gold/60" style={{ fontSize: 10 }}>%</span>
        )}
      </div>
    )
  }

  const displayValue = isDeltaMode
    ? (rawCell?.delta_pct != null ? `${rawCell.delta_pct > 0 ? '+' : ''}${rawCell.delta_pct}%` : '-')
    : (value === 0 && !rawCell?.value ? '-' : formatMetricValue(value, format, decimals))

  return (
    <div className="group relative">
      <button
        onClick={startEdit}
        className="w-full tabular-nums px-2 py-2 rounded hover:bg-bg-hover transition-colors text-text-primary cursor-text text-center block"
        style={{ fontSize: 12 }}
      >
        {isDeltaMode ? (
          <span style={{ color: (rawCell?.delta_pct ?? 0) > 0 ? '#4ade80' : (rawCell?.delta_pct ?? 0) < 0 ? '#ef4444' : '#6b7c6f' }}>
            {displayValue}
          </span>
        ) : (
          displayValue
        )}
      </button>
      {month > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleMode() }}
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full border font-bold transition-colors opacity-0 group-hover:opacity-100 z-10"
          style={{
            fontSize: 8,
            background: '#0d2015',
            borderColor: '#1f3d25',
            color: '#6b7c6f',
          }}
          onMouseOver={(e) => { e.currentTarget.style.color = '#c9a84c'; e.currentTarget.style.borderColor = '#c9a84c' }}
          onMouseOut={(e) => { e.currentTarget.style.color = '#6b7c6f'; e.currentTarget.style.borderColor = '#1f3d25' }}
          title={isDeltaMode ? 'Mudar para valor absoluto' : 'Mudar para variação %'}
        >
          {isDeltaMode ? 'V' : '%'}
        </button>
      )}
    </div>
  )
}
