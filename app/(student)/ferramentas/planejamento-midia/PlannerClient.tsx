'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  MONTHS, MONTH_LABELS, METRIC_DEFS, SECTIONS, KEY_METRICS,
  isKeyMetric, calcAllMonths, resolveValue, formatMetricValue, calcAnnualSummary,
  type KeyValues, type MetricKey, type ResultMetric, type MetricDef,
} from '@/lib/utils/media-plan-calc'
import { upsertMetrics, upsertMetricsAdmin, updateMediaPlanMetadata } from '@/app/actions/media-plan'
import { RealizadoToggle } from '@/components/business-plan/RealizadoToggle'
import { VarianceBadge } from '@/components/business-plan/VarianceBadge'

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

// Per-month minimum investment config
interface MinInvestMonth {
  enabled: boolean
  pct: number        // % of RECEITA_META
  meta_pct: number   // distribution %
  google_pct: number
  influencer_pct: number
}
type MinInvestData = Record<string, MinInvestMonth> // key = "1".."12" (month number)

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
    is_realizado?: boolean
  }>
  isAdmin?: boolean
  initialMetadata?: Record<string, any>
}

// ============================================================
// Component
// ============================================================

export default function PlannerClient({ planId, workspaceId, year, initialMetrics, isAdmin, initialMetadata }: Props) {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') === 'sales_forecast' ? 'sales_forecast' : 'midia_plan'
  const [topTab, setTopTab] = useState<TopTab>(initialTab)
  const [cells, setCells] = useState<Record<string, Record<number, CellData>>>(() => {
    const map: Record<string, Record<number, CellData>> = {}
    for (const m of initialMetrics) {
      if (m.is_realizado) continue
      if (!map[m.metric_key]) map[m.metric_key] = {}
      map[m.metric_key][m.month] = {
        value: m.value_numeric,
        delta_pct: m.delta_pct,
        mode: (m.input_mode as 'value' | 'delta_pct') ?? 'value',
      }
    }
    return map
  })

  // Realizado cells — manual input, stored with is_realizado=true
  const [realizadoCells, setRealizadoCells] = useState<Record<string, Record<number, number | null>>>(() => {
    const map: Record<string, Record<number, number | null>> = {}
    for (const m of initialMetrics) {
      if (!m.is_realizado) continue
      if (!map[m.metric_key]) map[m.metric_key] = {}
      map[m.metric_key][m.month] = m.value_numeric
    }
    return map
  })

  // Min investment state — per month
  const defaultMinMonth: MinInvestMonth = { enabled: false, pct: 10, meta_pct: 50, google_pct: 30, influencer_pct: 20 }
  const [minInvestData, setMinInvestData] = useState<MinInvestData>(() => {
    const stored = initialMetadata?.minimo_investimento as MinInvestData | undefined
    const data: MinInvestData = {}
    for (let m = 1; m <= 12; m++) {
      const s = stored?.[String(m)]
      data[String(m)] = {
        enabled: s?.enabled ?? false,
        pct: s?.pct ?? 10,
        meta_pct: s?.meta_pct ?? 50,
        google_pct: s?.google_pct ?? 30,
        influencer_pct: s?.influencer_pct ?? 20,
      }
    }
    return data
  })
  const minInvestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const saveMinInvestMonth = useCallback((month: number, patch: Partial<MinInvestMonth>) => {
    setMinInvestData(prev => {
      const next = { ...prev }
      next[String(month)] = { ...next[String(month)], ...patch }
      // Debounced save
      if (minInvestTimerRef.current) clearTimeout(minInvestTimerRef.current)
      minInvestTimerRef.current = setTimeout(async () => {
        await updateMediaPlanMetadata(workspaceId, planId, { minimo_investimento: next })
      }, 500)
      return next
    })
  }, [workspaceId, planId])

  // Compute effective min invest R$ for a month
  const getMinInvestForMonth = useCallback((month: number): { total: number; meta: number; google: number; influencer: number } | null => {
    const cfg = minInvestData[String(month)]
    if (!cfg?.enabled) return null
    const receita = resolveValue('RECEITA_META', month, cells)
    const total = receita * cfg.pct / 100
    return {
      total: Math.round(total),
      meta: Math.round(total * cfg.meta_pct / 100),
      google: Math.round(total * cfg.google_pct / 100),
      influencer: Math.round(total * cfg.influencer_pct / 100),
    }
  }, [minInvestData, cells])

  // Realizado (manual input)
  const [showRealizado, setShowRealizado] = useState(false)
  const [showRealizadoBanner, setShowRealizadoBanner] = useState(true)
  const realizadoPendingRef = useRef<Array<{ metric_key: string; month: number; value_numeric: number | null; delta_pct: number | null; input_mode: 'value' | 'delta_pct' }>>([])
  const realizadoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flushRealizadoSave = useCallback(async () => {
    if (realizadoPendingRef.current.length === 0) return
    const batch = [...realizadoPendingRef.current]
    realizadoPendingRef.current = []
    try {
      if (isAdmin) {
        await upsertMetricsAdmin(planId, batch, true)
      } else {
        await upsertMetrics(workspaceId, planId, batch, true)
      }
    } catch (e) {
      console.error('Realizado save error:', e)
    }
  }, [planId, workspaceId, isAdmin])

  const updateRealizadoCell = useCallback((metricKey: string, month: number, value: number | null) => {
    setRealizadoCells(prev => {
      const next = { ...prev }
      if (!next[metricKey]) next[metricKey] = {}
      next[metricKey] = { ...next[metricKey], [month]: value }
      return next
    })
    realizadoPendingRef.current.push({
      metric_key: metricKey,
      month,
      value_numeric: value,
      delta_pct: null,
      input_mode: 'value',
    })
    if (realizadoTimerRef.current) clearTimeout(realizadoTimerRef.current)
    realizadoTimerRef.current = setTimeout(flushRealizadoSave, 800)
  }, [flushRealizadoSave])

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<ViewMode>('completo')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const pendingRef = useRef<Array<{ metric_key: string; month: number; value_numeric: number | null; delta_pct: number | null; input_mode: 'value' | 'delta_pct' }>>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Resolve key values for calculations — with min invest propagation
  const keyValues = useMemo<KeyValues>(() => {
    const kv: KeyValues = {}
    for (const key of KEY_METRICS) {
      kv[key] = {}
      for (const month of MONTHS) {
        let val = resolveValue(key, month, cells)
        // Propagation: if min invest is enabled, use max(entered, minimo)
        const cfg = minInvestData[String(month)]
        if (cfg?.enabled) {
          const receita = resolveValue('RECEITA_META', month, cells)
          const totalMin = receita * cfg.pct / 100
          if (key === 'SPEND_META') val = Math.max(val, Math.round(totalMin * cfg.meta_pct / 100))
          if (key === 'SPEND_GOOGLE') val = Math.max(val, Math.round(totalMin * cfg.google_pct / 100))
          if (key === 'SPEND_INFLUENCER') val = Math.max(val, Math.round(totalMin * cfg.influencer_pct / 100))
        }
        kv[key][month] = val
      }
    }
    return kv
  }, [cells, minInvestData])

  const resultsByMonth = useMemo(() => calcAllMonths(keyValues), [keyValues])
  const annualSummary = useMemo(() => calcAnnualSummary(keyValues, resultsByMonth), [keyValues, resultsByMonth])

  const getCellValue = useCallback((metricKey: string, month: number): number => {
    if (isKeyMetric(metricKey)) {
      return keyValues[metricKey]?.[month] ?? 0
    }
    return resultsByMonth[month]?.[metricKey as ResultMetric] ?? 0
  }, [keyValues, resultsByMonth])

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
        <SalesForecastTab workspaceId={workspaceId} year={year} isAdmin={isAdmin} showRealizado={showRealizado} onToggleRealizado={() => setShowRealizado(v => !v)} showRealizadoBanner={showRealizadoBanner} onDismissBanner={() => setShowRealizadoBanner(false)} />
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

          <RealizadoToggle show={showRealizado} onToggle={() => setShowRealizado(v => !v)} />

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

      {/* Realizado info banner */}
      {showRealizado && showRealizadoBanner && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-brand-gold/20 bg-brand-gold/5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span style={{ fontSize: 14 }}>&#x1F4DD;</span>
            Preencha os valores realizados manualmente. Em breve conectaremos as metricas automaticamente.
          </div>
          <button onClick={() => setShowRealizadoBanner(false)} className="text-text-muted hover:text-text-primary text-xs px-2">&#x2715;</button>
        </div>
      )}

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
                    showRealizado={showRealizado}
                    realizadoCells={realizadoCells}
                    onUpdateRealizadoCell={updateRealizadoCell}
                  >
                    {/* Min Investment toggle after INVESTIMENTOS section */}
                    {section.key === 'investimentos' && !isCollapsed && (
                      <MinInvestSection
                        minInvestData={minInvestData}
                        onUpdateMonth={saveMinInvestMonth}
                        getMinInvestForMonth={getMinInvestForMonth}
                        columns={columns}
                        getCellValue={getCellValue}
                        cells={cells}
                      />
                    )}
                  </SectionGroup>
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
type ForecastRow = {
  key: string
  label: string
  section: string
  editable: boolean
  format: 'currency' | 'number' | 'percent' | 'roas'
  field?: string
  highlight?: boolean
  resultColor?: 'gold' | 'profit'
  imported?: boolean // shows imported badge
  consolidadoOnly?: boolean // only in consolidado
}

const SF_MONTHS = [1,2,3,4,5,6,7,8,9,10,11,12]
const SF_MONTH_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

// E-commerce rows
const ECOM_ROWS: ForecastRow[] = [
  { key: 'faturamento_bruto', label: 'Receita Faturada', section: 'faturamento', editable: true, format: 'currency', field: 'faturamento_bruto', imported: true },
  { key: 'pedidos', label: 'Pedidos Faturados', section: 'faturamento', editable: true, format: 'number', field: 'pedidos', imported: true },
  { key: 'ticket_medio', label: 'Ticket Medio', section: 'faturamento', editable: false, format: 'currency', resultColor: 'gold' },
  { key: 'imposto_pct', label: 'Impostos %', section: 'taxas', editable: true, format: 'percent', field: 'imposto_pct' },
  { key: 'imposto_rs', label: 'Impostos R$', section: 'taxas', editable: false, format: 'currency', resultColor: 'gold' },
  { key: 'taxas_pct', label: 'Taxas %', section: 'taxas', editable: true, format: 'percent', field: 'taxas_pct' },
  { key: 'taxas_rs', label: 'Taxas R$', section: 'taxas', editable: false, format: 'currency', resultColor: 'gold' },
  { key: 'cmv_pct', label: 'CMV %', section: 'cmv', editable: true, format: 'percent', field: 'cmv_pct' },
  { key: 'cmv_rs', label: 'CMV R$', section: 'cmv', editable: false, format: 'currency', resultColor: 'gold' },
  { key: 'investimento_midia', label: 'Investimento Midia', section: 'midia', editable: false, format: 'currency', resultColor: 'gold', imported: true },
  { key: 'roas', label: 'ROAS', section: 'midia', editable: false, format: 'roas', resultColor: 'gold' },
  { key: 'faturamento_liquido', label: 'Faturamento Liquido', section: 'resultado', editable: false, format: 'currency', resultColor: 'gold', highlight: true },
  { key: 'lucro_apos_aquisicao', label: 'Lucro Apos Aquisicao', section: 'resultado', editable: false, format: 'currency', resultColor: 'profit', highlight: true },
]

// Marketplace rows (custom channels)
const MARKETPLACE_ROWS: ForecastRow[] = [
  { key: 'faturamento_bruto', label: 'Faturamento Bruto', section: 'faturamento', editable: true, format: 'currency', field: 'faturamento_bruto' },
  { key: 'pedidos', label: 'Pedidos', section: 'faturamento', editable: true, format: 'number', field: 'pedidos' },
  { key: 'ticket_medio', label: 'Ticket Medio', section: 'faturamento', editable: false, format: 'currency', resultColor: 'gold' },
  { key: 'comissao_marketplace_pct', label: 'Comissao Marketplace %', section: 'taxas', editable: true, format: 'percent', field: 'comissao_marketplace_pct' },
  { key: 'comissao_marketplace_rs', label: 'Comissao R$', section: 'taxas', editable: false, format: 'currency', resultColor: 'gold' },
  { key: 'imposto_pct', label: 'Impostos %', section: 'taxas', editable: true, format: 'percent', field: 'imposto_pct' },
  { key: 'imposto_rs', label: 'Impostos R$', section: 'taxas', editable: false, format: 'currency', resultColor: 'gold' },
  { key: 'cmv_pct', label: 'CMV %', section: 'taxas', editable: true, format: 'percent', field: 'cmv_pct' },
  { key: 'cmv_rs', label: 'CMV R$', section: 'taxas', editable: false, format: 'currency', resultColor: 'gold' },
  { key: 'faturamento_liquido', label: 'Faturamento Liquido', section: 'resultado', editable: false, format: 'currency', resultColor: 'gold', highlight: true },
  { key: 'lucro_apos_aquisicao', label: 'Lucro Apos Aquisicao', section: 'resultado', editable: false, format: 'currency', resultColor: 'profit', highlight: true },
]

// Consolidado rows
const CONSOLIDADO_ROWS: ForecastRow[] = [
  { key: 'faturamento_bruto', label: 'Faturamento Bruto Total', section: 'faturamento', editable: false, format: 'currency', resultColor: 'gold' },
  { key: 'pedidos', label: 'Pedidos Total', section: 'faturamento', editable: false, format: 'number', resultColor: 'gold' },
  { key: 'ticket_medio', label: 'Ticket Medio', section: 'faturamento', editable: false, format: 'currency', resultColor: 'gold' },
  { key: 'imposto_rs', label: 'Impostos R$', section: 'taxas', editable: false, format: 'currency', resultColor: 'gold' },
  { key: 'taxas_rs', label: 'Taxas R$', section: 'taxas', editable: false, format: 'currency', resultColor: 'gold' },
  { key: 'comissao_marketplace_rs', label: 'Comissoes Marketplace R$', section: 'taxas', editable: false, format: 'currency', resultColor: 'gold' },
  { key: 'cmv_rs', label: 'CMV R$', section: 'cmv', editable: false, format: 'currency', resultColor: 'gold' },
  { key: 'cmv_pct', label: 'CMV %', section: 'cmv', editable: false, format: 'percent', resultColor: 'gold' },
  { key: 'cancelamento_pct', label: 'Cancelamentos %', section: 'cancelamento', editable: true, format: 'percent', field: 'cancelamento_pct', consolidadoOnly: true },
  { key: 'cancelamento_rs', label: 'Cancelamentos R$', section: 'cancelamento', editable: false, format: 'currency', resultColor: 'gold' },
  { key: 'logistica_rs', label: 'Logistica R$', section: 'logistica', editable: true, format: 'currency', field: 'logistica_rs', consolidadoOnly: true },
  { key: 'investimento_midia', label: 'Investimento Midia Total', section: 'midia', editable: false, format: 'currency', resultColor: 'gold' },
  { key: 'roas', label: 'ROAS Consolidado', section: 'midia', editable: false, format: 'roas', resultColor: 'gold' },
  { key: 'faturamento_liquido', label: 'Faturamento Liquido', section: 'resultado', editable: false, format: 'currency', resultColor: 'gold', highlight: true },
  { key: 'lucro_apos_aquisicao', label: 'Lucro Apos Aquisicao', section: 'resultado', editable: false, format: 'currency', resultColor: 'profit', highlight: true },
]

const ECOM_SECTIONS = [
  { key: 'faturamento', label: 'FATURAMENTO', color: 'text-brand-gold' },
  { key: 'taxas', label: 'TAXAS & COMISSOES', color: 'text-yellow-400' },
  { key: 'cmv', label: 'CMV', color: 'text-orange-400' },
  { key: 'midia', label: 'MIDIA', color: 'text-blue-400' },
  { key: 'resultado', label: 'RESULTADO', color: 'text-emerald-400' },
]

const MARKETPLACE_SECTIONS = [
  { key: 'faturamento', label: 'FATURAMENTO', color: 'text-brand-gold' },
  { key: 'taxas', label: 'TAXAS & COMISSOES', color: 'text-yellow-400' },
  { key: 'resultado', label: 'RESULTADO', color: 'text-emerald-400' },
]

const CONSOLIDADO_SECTIONS = [
  { key: 'faturamento', label: 'FATURAMENTO', color: 'text-brand-gold' },
  { key: 'taxas', label: 'TAXAS & COMISSOES', color: 'text-yellow-400' },
  { key: 'cmv', label: 'CMV', color: 'text-orange-400' },
  { key: 'cancelamento', label: 'CANCELAMENTOS', color: 'text-red-400' },
  { key: 'logistica', label: 'LOGISTICA', color: 'text-purple-400' },
  { key: 'midia', label: 'MIDIA', color: 'text-blue-400' },
  { key: 'resultado', label: 'RESULTADO', color: 'text-emerald-400' },
]

type ForecastData = Record<string, Record<number, Record<string, number | null>>>

const ALL_FIELDS = [
  'faturamento_bruto', 'pedidos', 'investimento_midia', 'imposto_pct', 'cmv_pct',
  'taxas_pct', 'comissao_marketplace_pct', 'cancelamento_pct', 'logistica_rs',
  'ticket_medio', 'imposto_rs', 'cmv_rs', 'taxas_rs', 'comissao_marketplace_rs',
  'cancelamento_rs', 'faturamento_liquido', 'lucro_apos_aquisicao', 'roas',
  'imported_from_midia_plan',
]

function parseForecast(f: any): Record<string, number | null> {
  const r: Record<string, number | null> = {}
  for (const k of ALL_FIELDS) {
    r[k] = f[k] != null ? Number(f[k]) : null
  }
  return r
}

function SalesForecastTab({ workspaceId, year, isAdmin, showRealizado, onToggleRealizado, showRealizadoBanner, onDismissBanner }: { workspaceId: string; year: number; isAdmin?: boolean; showRealizado: boolean; onToggleRealizado: () => void; showRealizadoBanner?: boolean; onDismissBanner?: () => void }) {
  const [channel, setChannel] = useState('ecommerce')
  const [data, setData] = useState<ForecastData>({})
  const [realizadoData, setRealizadoData] = useState<ForecastData>({})
  const [loading, setLoading] = useState(true)
  const [savingCell, setSavingCell] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [sfViewMode, setSfViewMode] = useState<'completo' | 'quarters'>('completo')
  const [addChannelOpen, setAddChannelOpen] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [renamingChannel, setRenamingChannel] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const loadData = useCallback(async () => {
    const r = await fetch(`/api/sales-forecast?workspace_id=${workspaceId}&year=${year}`)
    const json = await r.json()
    const map: ForecastData = {}
    const realMap: ForecastData = {}
    for (const f of json.forecasts || []) {
      const target = f.is_realizado ? realMap : map
      if (!target[f.channel]) target[f.channel] = {}
      target[f.channel][f.month] = parseForecast(f)
    }
    setData(map)
    setRealizadoData(realMap)
  }, [workspaceId, year])

  useEffect(() => {
    setLoading(true)
    loadData().finally(() => setLoading(false))
  }, [loadData])

  // Discover all channels from data
  const channels = useMemo(() => {
    const all = new Set(Object.keys(data))
    all.add('ecommerce')
    all.delete('consolidado')
    const sorted = ['ecommerce', ...Array.from(all).filter(c => c !== 'ecommerce').sort()]
    sorted.push('consolidado')
    return sorted
  }, [data])

  const isEcommerce = channel === 'ecommerce'
  const isConsolidado = channel === 'consolidado'
  const isMarketplace = !isEcommerce && !isConsolidado
  const otherChannels = channels.filter(c => c !== 'consolidado')

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
        await loadData()
      }
    } catch {
      setImportMsg({ type: 'err', text: 'Erro ao importar' })
    }
    setImporting(false)
    setTimeout(() => setImportMsg(null), 4000)
  }

  async function addChannel() {
    const name = newChannelName.trim()
    if (!name) return
    const slug = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 50)
    if (!slug || slug === 'ecommerce' || slug === 'consolidado') return
    // Create an empty row for month 1 to register the channel
    await fetch('/api/sales-forecast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: workspaceId, year, month: 1, channel: slug }),
    })
    await loadData()
    setChannel(slug)
    setAddChannelOpen(false)
    setNewChannelName('')
  }

  async function deleteChannel(ch: string) {
    if (!confirm(`Remover canal "${ch}" e todos os dados?`)) return
    await fetch('/api/sales-forecast', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: workspaceId, year, channel: ch }),
    })
    if (channel === ch) setChannel('ecommerce')
    await loadData()
  }

  async function renameChannel(oldName: string, newName: string) {
    const slug = newName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 50)
    if (!slug || slug === oldName || slug === 'ecommerce' || slug === 'consolidado') {
      setRenamingChannel(null)
      return
    }
    // Copy all data to new channel, delete old
    const oldData = data[oldName] || {}
    for (const [monthStr, fields] of Object.entries(oldData)) {
      const m = parseInt(monthStr)
      await fetch('/api/sales-forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, year, month: m, channel: slug, ...fields }),
      })
    }
    await fetch('/api/sales-forecast', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: workspaceId, year, channel: oldName }),
    })
    setChannel(slug)
    setRenamingChannel(null)
    await loadData()
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

  // Compute derived value for a single channel (not consolidado)
  function getDisplayValue(ch: string, month: number, field: string): number | null {
    if (ch === 'consolidado') return getConsolidadoValue(month, field)
    const raw = data[ch]?.[month]
    if (!raw) return null
    const fb = raw.faturamento_bruto ?? 0
    const ped = raw.pedidos ?? 0
    const imp = raw.imposto_pct ?? 0
    const cmv = raw.cmv_pct ?? 0
    const inv = raw.investimento_midia ?? 0
    const taxas = raw.taxas_pct ?? 0
    const comMkt = raw.comissao_marketplace_pct ?? 0
    const cancel = raw.cancelamento_pct ?? 0
    const logist = raw.logistica_rs ?? 0

    switch (field) {
      case 'ticket_medio': return ped > 0 ? Math.round(fb / ped * 100) / 100 : null
      case 'imposto_rs': return Math.round(fb * imp / 100 * 100) / 100
      case 'taxas_rs': return Math.round(fb * taxas / 100 * 100) / 100
      case 'comissao_marketplace_rs': return Math.round(fb * comMkt / 100 * 100) / 100
      case 'cmv_rs': return Math.round(fb * cmv / 100 * 100) / 100
      case 'cancelamento_rs': return Math.round(fb * cancel / 100 * 100) / 100
      case 'faturamento_liquido': {
        if (ch === 'ecommerce') return Math.round(fb * (1 - imp/100 - taxas/100) * 100) / 100
        return Math.round(fb * (1 - imp/100 - comMkt/100) * 100) / 100
      }
      case 'lucro_apos_aquisicao': {
        if (ch === 'ecommerce') return Math.round((fb * (1 - imp/100 - taxas/100 - cmv/100) - inv) * 100) / 100
        return Math.round((fb * (1 - imp/100 - comMkt/100 - cmv/100)) * 100) / 100
      }
      case 'roas': return inv > 0 ? Math.round(fb / inv * 100) / 100 : null
      default: return raw[field] ?? null
    }
  }

  // Consolidado: aggregate all other channels
  function getConsolidadoValue(month: number, field: string): number | null {
    const consolData = data['consolidado']?.[month]

    // Manual consolidado-only fields
    if (field === 'cancelamento_pct') return consolData?.cancelamento_pct ?? null
    if (field === 'logistica_rs') return consolData?.logistica_rs ?? null

    // Sum across all non-consolidado channels
    const sumField = (f: string) => {
      let total = 0; let hasAny = false
      for (const ch of otherChannels) {
        const v = getDisplayValue(ch, month, f)
        if (v !== null) { total += v; hasAny = true }
      }
      return hasAny ? total : null
    }

    if (field === 'faturamento_bruto' || field === 'pedidos' || field === 'imposto_rs' ||
        field === 'cmv_rs' || field === 'investimento_midia') {
      return sumField(field)
    }

    if (field === 'taxas_rs') {
      // Only from ecommerce
      return getDisplayValue('ecommerce', month, 'taxas_rs')
    }

    if (field === 'comissao_marketplace_rs') {
      let total = 0; let hasAny = false
      for (const ch of otherChannels) {
        if (ch === 'ecommerce') continue
        const v = getDisplayValue(ch, month, 'comissao_marketplace_rs')
        if (v !== null) { total += v; hasAny = true }
      }
      return hasAny ? total : null
    }

    if (field === 'ticket_medio') {
      const totalRev = sumField('faturamento_bruto')
      const totalOrd = sumField('pedidos')
      return totalOrd && totalOrd > 0 ? Math.round((totalRev ?? 0) / totalOrd * 100) / 100 : null
    }

    if (field === 'cmv_pct') {
      const totalCmvRs = sumField('cmv_rs')
      const totalRev = sumField('faturamento_bruto')
      return totalRev && totalRev > 0 ? Math.round((totalCmvRs ?? 0) / totalRev * 100 * 100) / 100 : null
    }

    if (field === 'cancelamento_rs') {
      const totalRev = sumField('faturamento_bruto')
      const cancelPct = consolData?.cancelamento_pct ?? 0
      return totalRev ? Math.round(totalRev * cancelPct / 100 * 100) / 100 : null
    }

    if (field === 'roas') {
      const totalRev = sumField('faturamento_bruto')
      const totalSpend = sumField('investimento_midia')
      return totalSpend && totalSpend > 0 ? Math.round((totalRev ?? 0) / totalSpend * 100) / 100 : null
    }

    if (field === 'faturamento_liquido') {
      const bruto = sumField('faturamento_bruto') ?? 0
      const impostos = sumField('imposto_rs') ?? 0
      const taxas = getDisplayValue('ecommerce', month, 'taxas_rs') ?? 0
      const comissoes = (() => { let t = 0; for (const ch of otherChannels) { if (ch === 'ecommerce') continue; t += getDisplayValue(ch, month, 'comissao_marketplace_rs') ?? 0 } return t })()
      const cancelPct = consolData?.cancelamento_pct ?? 0
      const cancelRs = Math.round(bruto * cancelPct / 100 * 100) / 100
      return Math.round((bruto - impostos - taxas - comissoes - cancelRs) * 100) / 100
    }

    if (field === 'lucro_apos_aquisicao') {
      const liquido = getConsolidadoValue(month, 'faturamento_liquido') ?? 0
      const cmv = sumField('cmv_rs') ?? 0
      const logistica = consolData?.logistica_rs ?? 0
      const midia = sumField('investimento_midia') ?? 0
      return Math.round((liquido - cmv - logistica - midia) * 100) / 100
    }

    return null
  }

  function getAnnual(ch: string, field: string, format: string): number | null {
    const values = SF_MONTHS.map(m => getDisplayValue(ch, m, field))
    const nonNull = values.filter(v => v !== null) as number[]
    if (nonNull.length === 0) return null
    if (format === 'percent' || format === 'roas') {
      return Math.round(nonNull.reduce((s, v) => s + v, 0) / nonNull.length * 100) / 100
    }
    return Math.round(nonNull.reduce((s, v) => s + v, 0) * 100) / 100
  }

  async function saveCell(ch: string, month: number, field: string, value: number | null) {
    const cellKey = `${ch}-${month}-${field}`
    setSavingCell(cellKey)

    setData(prev => {
      const next = { ...prev }
      if (!next[ch]) next[ch] = {}
      next[ch] = { ...next[ch] }
      next[ch][month] = { ...(next[ch][month] || {}), [field]: value }
      return next
    })

    try {
      await fetch('/api/sales-forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, year, month, channel: ch, [field]: value }),
      })
    } catch {}
    setSavingCell(null)
  }

  async function saveCellRealizado(ch: string, month: number, field: string, value: number | null) {
    setRealizadoData(prev => {
      const next = { ...prev }
      if (!next[ch]) next[ch] = {}
      next[ch] = { ...next[ch] }
      next[ch][month] = { ...(next[ch][month] || {}), [field]: value }
      return next
    })
    try {
      await fetch('/api/sales-forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, year, month, channel: ch, is_realizado: true, [field]: value }),
      })
    } catch {}
  }

  function fmtVal(v: number | null, format: string): string {
    if (v === null || v === undefined) return '-'
    if (format === 'currency') return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })
    if (format === 'percent') return `${v.toFixed(1).replace('.', ',')}%`
    if (format === 'roas') return v > 0 ? `${v.toFixed(1)}x` : '-'
    if (format === 'number') return v.toLocaleString('pt-BR')
    return String(v)
  }

  const currentRows = isConsolidado ? CONSOLIDADO_ROWS : isEcommerce ? ECOM_ROWS : MARKETPLACE_ROWS
  const currentSections = isConsolidado ? CONSOLIDADO_SECTIONS : isEcommerce ? ECOM_SECTIONS : MARKETPLACE_SECTIONS

  const channelLabel = (ch: string) => {
    if (ch === 'ecommerce') return 'E-commerce'
    if (ch === 'consolidado') return 'Consolidado'
    return ch.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  return (
    <>
      {/* Connection banner */}
      <div className="mb-4 px-4 py-3 rounded-lg border border-brand-gold/20 bg-brand-gold/5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C9971A" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
          <span className="text-text-secondary">
            <span className="font-medium text-brand-gold">Passo 1: Midia Plan</span> → <span className="font-medium text-brand-gold">Passo 2: Sales Forecast</span> → <a href="/ferramentas/forecast" className="font-medium text-brand-gold hover:underline">Passo 3: DRE →</a>
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Sales Forecast {year}</h1>
          <p className="text-sm text-text-muted mt-1">Projecao de faturamento, custos e lucro por canal</p>
        </div>
        <div className="flex items-center gap-3">
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

          <RealizadoToggle show={showRealizado} onToggle={onToggleRealizado} />

          {isEcommerce && !isConsolidado && (
            <button onClick={handleImportMidia} disabled={importing}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-sm text-purple-400 hover:bg-purple-500/20 transition-colors disabled:opacity-50">
              {importing ? (
                <span className="w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
              )}
              Importar do Midia Plan
            </button>
          )}
        </div>
      </div>

      {importMsg && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm ${importMsg.type === 'ok' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
          {importMsg.text}
        </div>
      )}

      {/* Realizado info banner */}
      {showRealizado && showRealizadoBanner && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-brand-gold/20 bg-brand-gold/5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span style={{ fontSize: 14 }}>&#x1F4DD;</span>
            Preencha os valores realizados manualmente. Em breve conectaremos as metricas automaticamente.
          </div>
          <button onClick={onDismissBanner} className="text-text-muted hover:text-text-primary text-xs px-2">&#x2715;</button>
        </div>
      )}

      {/* Channel tabs */}
      <div className="flex gap-1 bg-bg-card border border-border rounded-xl p-1 mb-4 flex-wrap">
        {channels.map(ch => (
          <div key={ch} className="relative group flex items-center">
            {renamingChannel === ch ? (
              <input
                autoFocus
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onBlur={() => renameChannel(ch, renameValue)}
                onKeyDown={e => { if (e.key === 'Enter') renameChannel(ch, renameValue); if (e.key === 'Escape') setRenamingChannel(null) }}
                className="px-3 py-2 text-sm rounded-lg bg-bg-hover border border-brand-gold/40 text-text-primary outline-none"
                style={{ minWidth: 80 }}
              />
            ) : (
              <button
                onClick={() => setChannel(ch)}
                onDoubleClick={() => {
                  if (ch !== 'ecommerce' && ch !== 'consolidado') {
                    setRenamingChannel(ch)
                    setRenameValue(ch)
                  }
                }}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${
                  channel === ch ? 'bg-brand-gold text-bg-base shadow-sm' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                }`}
              >
                {channelLabel(ch)}
                {ch === 'consolidado' && <span className="text-[10px] ml-1 opacity-70">(soma)</span>}
              </button>
            )}
            {ch !== 'ecommerce' && ch !== 'consolidado' && channel !== ch && (
              <button
                onClick={() => deleteChannel(ch)}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                style={{ fontSize: 10 }}
                title="Remover canal"
              >
                x
              </button>
            )}
          </div>
        ))}
        <button onClick={() => setAddChannelOpen(true)}
          className="px-3 py-2 text-sm font-medium rounded-lg text-brand-gold hover:bg-brand-gold/10 transition-colors cursor-pointer">
          + Adicionar
        </button>
      </div>

      {/* Add channel modal */}
      {addChannelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setAddChannelOpen(false)}>
          <div className="bg-bg-card border border-border rounded-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-text-primary mb-4">Adicionar Canal</h3>
            <input
              autoFocus
              value={newChannelName}
              onChange={e => setNewChannelName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addChannel() }}
              placeholder="Ex: Mercado Livre, Shopee, Amazon..."
              className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border text-text-primary placeholder:text-text-muted outline-none focus:border-brand-gold/40 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setAddChannelOpen(false)} className="px-4 py-2 text-sm text-text-muted hover:text-text-primary">Cancelar</button>
              <button onClick={addChannel} className="px-4 py-2 text-sm bg-brand-gold text-bg-base rounded-lg font-medium hover:bg-brand-gold-light">Adicionar</button>
            </div>
          </div>
        </div>
      )}

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
                    Metrica
                  </th>
                  {sfColumns.map((col) => (
                    <th key={col.key} className="px-2 py-3 text-center font-medium min-w-[100px]" style={{ fontSize: 12, color: col.color || undefined }}>{col.label}</th>
                  ))}
                  <th className="px-3 py-3 text-center font-bold min-w-[120px] border-l border-border" style={{ fontSize: 13, color: '#c9a84c' }}>
                    Total/Media
                  </th>
                </tr>
              </thead>
              <tbody>
                {currentSections.map(section => {
                  const rows = currentRows.filter(r => r.section === section.key)
                  return (
                    <SFSectionGroup key={section.key} section={section} rows={rows} channel={channel}
                      getDisplayValue={getDisplayValue} getAnnual={getAnnual} fmtVal={fmtVal}
                      isConsolidado={isConsolidado} saveCell={saveCell} savingCell={savingCell}
                      columns={sfColumns} isImported={isEcommerce && data['ecommerce']?.[1]?.imported_from_midia_plan === 1}
                      showRealizado={showRealizado} realizadoData={realizadoData} saveCellRealizado={saveCellRealizado} />
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-6 text-xs text-text-muted flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-brand-gold" /> Editavel</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded text-emerald-400" style={{ fontSize: 10 }}>*</span> Verde = lucro positivo</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded text-red-400" style={{ fontSize: 10 }}>*</span> Vermelho = prejuizo</span>
        {isConsolidado && <span>Consolidado = soma de todos os canais (somente leitura exceto cancelamento e logistica)</span>}
      </div>
    </>
  )
}

// ============================================================
// Sales Forecast Section Group
// ============================================================

function SFSectionGroup({ section, rows, channel, getDisplayValue, getAnnual, fmtVal, isConsolidado, saveCell, savingCell, columns, isImported, showRealizado, realizadoData, saveCellRealizado }: {
  section: { key: string; label: string; color: string }
  rows: ForecastRow[]
  channel: string
  getDisplayValue: (ch: string, m: number, field: string) => number | null
  getAnnual: (ch: string, field: string, format: string) => number | null
  fmtVal: (v: number | null, format: string) => string
  isConsolidado: boolean
  saveCell: (ch: string, m: number, field: string, v: number | null) => void
  savingCell: string | null
  columns: SFColumn[]
  isImported?: boolean
  showRealizado?: boolean
  realizadoData?: ForecastData
  saveCellRealizado?: (ch: string, m: number, field: string, v: number | null) => void
}) {
  return (
    <>
      <tr className="border-t-2 border-border">
        <td colSpan={columns.length + 2} className="sticky left-0 z-10 px-4 py-3" style={{ background: '#0a1a0f' }}>
          <div className="flex items-center gap-2.5">
            <span className={`font-bold uppercase tracking-wider ${section.color}`} style={{ fontSize: 13 }}>{section.label}</span>
          </div>
        </td>
      </tr>
      {rows.map(row => (
        <SFRow key={row.key} row={row} channel={channel} getDisplayValue={getDisplayValue}
          getAnnual={getAnnual} fmtVal={fmtVal} isConsolidado={isConsolidado} saveCell={saveCell} savingCell={savingCell}
          columns={columns} isImported={isImported} showRealizado={showRealizado} realizadoData={realizadoData} saveCellRealizado={saveCellRealizado} />
      ))}
    </>
  )
}

// ============================================================
// Sales Forecast Row
// ============================================================

function SFRow({ row, channel, getDisplayValue, getAnnual, fmtVal, isConsolidado, saveCell, savingCell, columns, isImported, showRealizado, realizadoData, saveCellRealizado }: {
  row: ForecastRow
  channel: string
  getDisplayValue: (ch: string, m: number, field: string) => number | null
  getAnnual: (ch: string, field: string, format: string) => number | null
  fmtVal: (v: number | null, format: string) => string
  isConsolidado: boolean
  saveCell: (ch: string, m: number, field: string, v: number | null) => void
  savingCell: string | null
  columns: SFColumn[]
  isImported?: boolean
  showRealizado?: boolean
  realizadoData?: ForecastData
  saveCellRealizado?: (ch: string, m: number, field: string, v: number | null) => void
}) {
  const canEdit = row.editable && (isConsolidado ? !!row.consolidadoOnly : true)
  const annual = getAnnual(channel, row.key, row.format)
  const isProfit = row.resultColor === 'profit'
  const showImportBadge = row.imported && isImported

  // Manual realizado: value from realizadoData
  const showReal = showRealizado && !isConsolidado

  function getRealVal(month: number): number {
    return (realizadoData?.[channel]?.[month]?.[row.key] as number) ?? 0
  }

  function getRealAgg(months: number[]): number {
    if (row.format === 'percent' || row.format === 'roas') {
      const vals = months.map(m => getRealVal(m)).filter(v => v !== 0)
      return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
    }
    return months.reduce((s, m) => s + getRealVal(m), 0)
  }

  const annualReal = showReal ? getRealAgg(SF_MONTHS) : 0
  const realType = row.format === 'percent' ? 'pct' as const : row.format === 'roas' ? 'roas' as const : row.format === 'number' ? 'number' as const : 'currency' as const
  const realInvert = row.key.includes('imposto') || row.key.includes('taxas') || row.key.includes('cmv') || row.key.includes('investimento') || row.key.includes('comissao')

  function getQuarterValue(months: number[]): number | null {
    const values = months.map(m => getDisplayValue(channel, m, row.key)).filter(v => v !== null) as number[]
    if (values.length === 0) return null
    if (row.format === 'percent' || row.format === 'roas') {
      return Math.round(values.reduce((s, v) => s + v, 0) / values.length * 100) / 100
    }
    return Math.round(values.reduce((s, v) => s + v, 0) * 100) / 100
  }

  // Lucro row bg tint
  const lucroRealBg = row.key === 'lucro_apos_aquisicao' && showReal && annualReal !== 0
    ? (annualReal > 0 ? 'rgba(34,197,94,0.07)' : 'rgba(239,68,68,0.07)')
    : undefined

  return (
    <>
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
          {showImportBadge && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 font-medium whitespace-nowrap">Midia Plan</span>
          )}
          {showReal && <span className="italic text-text-muted" style={{ fontSize: 9 }}>Prev</span>}
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

    {/* SF Realizado sub-row — editable */}
    {showReal && (
      <tr className="border-t border-border/20" style={{ background: lucroRealBg ?? 'rgba(201,151,26,0.02)' }}>
        <td className="sticky left-0 z-10 px-4 py-0 border-r border-border" style={{ background: '#0b1a0f', borderLeft: row.highlight ? '3px solid rgba(201,168,76,0.3)' : undefined }}>
          <span className="italic" style={{ fontSize: 10, color: '#c9a84c' }}>Real</span>
        </td>
        {columns.map(col => {
          if (col.months.length === 1) {
            const m = col.months[0]
            const realVal = getRealVal(m)
            return (
              <td key={col.key} className="px-1 py-0 text-center">
                <SFEditableCell value={realVal || null} format={row.format} isSaving={false}
                  onSave={v => saveCellRealizado?.(channel, m, row.key, v)} isRealizado />
              </td>
            )
          }
          const realVal = getRealAgg(col.months)
          return (
            <td key={col.key} className="px-1 py-0 text-center">
              <span className="tabular-nums px-2 py-1 block" style={{ fontSize: 11, color: realVal === 0 ? '#4a5a4f' : 'rgba(255,255,255,0.55)' }}>
                {realVal === 0 ? '\u2014' : fmtVal(Math.round(realVal * 100) / 100, row.format)}
              </span>
            </td>
          )
        })}
        <td className="px-3 py-1 text-center border-l border-border">
          <span className="tabular-nums" style={{ fontSize: 11, color: annualReal === 0 ? '#4a5a4f' : row.key === 'lucro_apos_aquisicao' ? (annualReal > 0 ? '#4ade80' : '#ef4444') : 'rgba(255,255,255,0.55)' }}>
            {annualReal === 0 ? '\u2014' : fmtVal(Math.round(annualReal * 100) / 100, row.format)}
          </span>
        </td>
      </tr>
    )}

    {/* SF Variance sub-row */}
    {showReal && (
      <tr className="border-t border-border/10" style={{ background: 'rgba(201,151,26,0.02)' }}>
        <td className="sticky left-0 z-10 px-4 py-0 border-r border-border" style={{ background: '#0b1a0f' }}>
          <span className="text-text-muted" style={{ fontSize: 9 }}>&Delta;</span>
        </td>
        {columns.map(col => {
          const prevVal = col.months.length === 1 ? (getDisplayValue(channel, col.months[0], row.key) ?? 0) : (getQuarterValue(col.months) ?? 0)
          const realVal = col.months.length === 1 ? getRealVal(col.months[0]) : getRealAgg(col.months)
          return (
            <td key={col.key} className="px-1 py-0 text-center">
              <VarianceBadge previsto={prevVal} realizado={realVal} type={realType} invertColor={realInvert} />
            </td>
          )
        })}
        <td className="px-3 py-0 text-center border-l border-border">
          <VarianceBadge previsto={annual ?? 0} realizado={annualReal} type={realType} invertColor={realInvert} />
        </td>
      </tr>
    )}
    </>
  )
}

// ============================================================
// Sales Forecast Editable Cell
// ============================================================

function SFEditableCell({ value, format, isSaving, onSave, isRealizado }: {
  value: number | null; format: string; isSaving: boolean
  onSave: (v: number | null) => void; isRealizado?: boolean
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
      className="w-full tabular-nums px-2 py-2 rounded hover:bg-bg-hover transition-colors cursor-text text-center block relative"
      style={{ fontSize: isRealizado ? 11 : 12, color: isRealizado ? (value ? 'rgba(255,255,255,0.55)' : '#4a5a4f') : undefined }}>
      {fmtDisplay(value)}
      {isSaving && <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-brand-gold animate-pulse" />}
    </button>
  )
}

// ============================================================
// Min Investment Section (inside INVESTIMENTOS) — per-month
// ============================================================

function MinInvestSection({ minInvestData, onUpdateMonth, getMinInvestForMonth, columns, getCellValue, cells }: {
  minInvestData: MinInvestData
  onUpdateMonth: (month: number, patch: Partial<MinInvestMonth>) => void
  getMinInvestForMonth: (month: number) => { total: number; meta: number; google: number; influencer: number } | null
  columns: ViewColumn[]
  getCellValue: (key: string, month: number) => number
  cells: Record<string, Record<number, CellData>>
}) {
  const anyEnabled = MONTHS.some(m => minInvestData[String(m)]?.enabled)
  const subRowStyle = { background: 'rgba(201,151,26,0.03)', borderLeft: '3px solid rgba(201,151,26,0.2)' }

  function fmtCurrency(v: number) {
    return v > 0 ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '-'
  }

  // Helper for column aggregation (quarters/annual)
  function sumMonths(months: number[], fn: (m: number) => number): number {
    return months.reduce((s, m) => s + fn(m), 0)
  }

  // Rows definition
  const pctRows: { field: keyof MinInvestMonth; label: string }[] = [
    { field: 'pct', label: '% Investimento Minimo' },
    { field: 'meta_pct', label: '% Meta Ads (min)' },
    { field: 'google_pct', label: '% Google Ads (min)' },
    { field: 'influencer_pct', label: '% Influencers (min)' },
  ]

  const rsRows: { label: string; getValue: (m: number) => number }[] = [
    { label: 'Investimento Minimo R$', getValue: m => getMinInvestForMonth(m)?.total ?? 0 },
    { label: 'Minimo Meta Ads R$', getValue: m => getMinInvestForMonth(m)?.meta ?? 0 },
    { label: 'Minimo Google Ads R$', getValue: m => getMinInvestForMonth(m)?.google ?? 0 },
    { label: 'Minimo Influencers R$', getValue: m => getMinInvestForMonth(m)?.influencer ?? 0 },
  ]

  return (
    <>
      {/* Toggle row with per-month switches */}
      <tr className="border-t border-border/40">
        <td className="sticky left-0 z-10 px-4 py-2 border-r border-border" style={{ background: '#0a1a0f' }}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 14 }}>🎯</span>
            <span className="text-sm font-medium" style={{ color: '#c9a84c' }}>Minimo de Investimento</span>
          </div>
        </td>
        {columns.map(col => {
          if (col.months.length === 1) {
            const m = col.months[0]
            const on = minInvestData[String(m)]?.enabled ?? false
            return (
              <td key={col.key} className="px-1 py-1 text-center">
                <button
                  onClick={() => onUpdateMonth(m, { enabled: !on })}
                  className="relative w-8 h-4 rounded-full transition-colors mx-auto block"
                  style={{ background: on ? '#c9971a' : 'rgba(255,255,255,0.15)' }}
                >
                  <span className="absolute top-0.5 transition-all rounded-full bg-white w-3 h-3"
                    style={{ left: on ? 16 : 2 }} />
                </button>
              </td>
            )
          }
          // Quarter: show count
          const onCount = col.months.filter(m => minInvestData[String(m)]?.enabled).length
          return (
            <td key={col.key} className="px-1 py-1 text-center">
              <span style={{ fontSize: 10, color: onCount > 0 ? '#c9a84c' : '#6b7c6f' }}>{onCount}/{col.months.length}</span>
            </td>
          )
        })}
        <td className="px-3 py-1 text-center border-l border-border">
          <span style={{ fontSize: 10, color: anyEnabled ? '#c9a84c' : '#6b7c6f' }}>
            {MONTHS.filter(m => minInvestData[String(m)]?.enabled).length}/12
          </span>
        </td>
      </tr>

      {anyEnabled && (
        <>
          {/* Editable % rows */}
          {pctRows.map(({ field, label }) => (
            <tr key={field} className="border-t border-border/30" style={subRowStyle}>
              <td className="sticky left-0 z-10 px-4 py-0 border-r border-border" style={{ ...subRowStyle, paddingLeft: field === 'pct' ? 32 : 44 }}>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-gold/50 shrink-0" />
                  <span style={{ fontSize: 11, color: 'rgba(201,151,26,0.7)' }}>{label}</span>
                </div>
              </td>
              {columns.map(col => {
                if (col.months.length === 1) {
                  const m = col.months[0]
                  const cfg = minInvestData[String(m)]
                  if (!cfg?.enabled) return <td key={col.key} className="px-1 py-0 text-center"><span style={{ fontSize: 11, color: '#4a5a4f' }}>-</span></td>
                  return (
                    <td key={col.key} className="px-1 py-0 text-center">
                      <MinPctCell month={m} field={field} value={cfg[field] as number} onUpdateMonth={onUpdateMonth} />
                    </td>
                  )
                }
                // Quarter avg
                const enabled = col.months.filter(m => minInvestData[String(m)]?.enabled)
                if (enabled.length === 0) return <td key={col.key} className="px-1 py-0 text-center"><span style={{ fontSize: 11, color: '#4a5a4f' }}>-</span></td>
                const avg = enabled.reduce((s, m) => s + ((minInvestData[String(m)]?.[field] as number) ?? 0), 0) / enabled.length
                return (
                  <td key={col.key} className="px-1 py-0 text-center">
                    <span className="tabular-nums px-2 py-1 block" style={{ fontSize: 11, color: 'rgba(201,168,76,0.6)' }}>{avg.toFixed(0)}%</span>
                  </td>
                )
              })}
              <td className="px-3 py-1 text-center border-l border-border">
                {(() => {
                  const enabled = MONTHS.filter(m => minInvestData[String(m)]?.enabled)
                  if (enabled.length === 0) return <span style={{ fontSize: 11, color: '#4a5a4f' }}>-</span>
                  const avg = enabled.reduce((s, m) => s + ((minInvestData[String(m)]?.[field] as number) ?? 0), 0) / enabled.length
                  return <span className="tabular-nums" style={{ fontSize: 11, color: 'rgba(201,168,76,0.6)' }}>{avg.toFixed(0)}%</span>
                })()}
              </td>
            </tr>
          ))}

          {/* Sum % check row */}
          <tr className="border-t border-border/30" style={subRowStyle}>
            <td className="sticky left-0 z-10 px-4 py-1 border-r border-border" style={{ ...subRowStyle, paddingLeft: 44 }}>
              <span style={{ fontSize: 10, color: '#6b7c6f' }}>Soma %</span>
            </td>
            {columns.map(col => {
              if (col.months.length === 1) {
                const m = col.months[0]
                const cfg = minInvestData[String(m)]
                if (!cfg?.enabled) return <td key={col.key} className="px-1 py-0" />
                const total = cfg.meta_pct + cfg.google_pct + cfg.influencer_pct
                return (
                  <td key={col.key} className="px-1 py-0 text-center">
                    <span style={{ fontSize: 10, fontWeight: 600, color: total === 100 ? '#4ade80' : '#ef4444' }}>
                      {total === 100 ? '✓ 100%' : `⚠ ${total}%`}
                    </span>
                  </td>
                )
              }
              return <td key={col.key} className="px-1 py-0" />
            })}
            <td className="px-3 py-1 border-l border-border" />
          </tr>

          {/* Calculated R$ rows */}
          {rsRows.map(({ label, getValue }) => (
            <tr key={label} className="border-t border-border/30" style={subRowStyle}>
              <td className="sticky left-0 z-10 px-4 py-0 border-r border-border" style={{ ...subRowStyle, paddingLeft: label.startsWith('Investimento') ? 32 : 44 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: label.startsWith('Investimento') ? 600 : 400 }}>{label}</span>
              </td>
              {columns.map(col => {
                if (col.months.length === 1) {
                  const m = col.months[0]
                  if (!minInvestData[String(m)]?.enabled) return <td key={col.key} className="px-1 py-0 text-center"><span style={{ fontSize: 11, color: '#4a5a4f' }}>-</span></td>
                  const val = getValue(m)
                  return (
                    <td key={col.key} className="px-1 py-0 text-center">
                      <span className="tabular-nums px-2 py-1 block" style={{ fontSize: 11, color: 'rgba(201,168,76,0.6)' }}>{fmtCurrency(val)}</span>
                    </td>
                  )
                }
                const val = sumMonths(col.months.filter(m => minInvestData[String(m)]?.enabled), getValue)
                return (
                  <td key={col.key} className="px-1 py-0 text-center">
                    <span className="tabular-nums px-2 py-1 block" style={{ fontSize: 11, color: val > 0 ? 'rgba(201,168,76,0.6)' : '#4a5a4f' }}>{fmtCurrency(val)}</span>
                  </td>
                )
              })}
              <td className="px-3 py-1 text-center border-l border-border">
                <span className="tabular-nums" style={{ fontSize: 11, color: 'rgba(201,168,76,0.6)' }}>
                  {fmtCurrency(sumMonths(MONTHS.filter(m => minInvestData[String(m)]?.enabled), getValue))}
                </span>
              </td>
            </tr>
          ))}
        </>
      )}
    </>
  )
}

// Per-month % editable cell for MinInvest
function MinPctCell({ month, field, value, onUpdateMonth }: {
  month: number; field: string; value: number
  onUpdateMonth: (month: number, patch: Partial<MinInvestMonth>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  function startEdit() {
    setInputValue(String(value).replace('.', ','))
    setEditing(true)
  }

  function commit() {
    setEditing(false)
    const num = parseFloat(inputValue.replace(',', '.'))
    if (isNaN(num)) return
    onUpdateMonth(month, { [field]: num })
  }

  if (editing) {
    return (
      <div className="relative flex items-center">
        <input ref={inputRef} type="text" value={inputValue}
          onChange={e => setInputValue(e.target.value.replace(/[^0-9,.\-]/g, ''))}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
          className="w-full border rounded py-1 text-center outline-none tabular-nums"
          style={{ fontSize: 11, background: 'rgba(201,168,76,0.08)', borderColor: 'rgba(201,168,76,0.4)', color: '#e8e0d0', paddingRight: 16 }} />
        <span className="absolute right-1.5 text-brand-gold/60" style={{ fontSize: 9 }}>%</span>
      </div>
    )
  }

  return (
    <button onClick={startEdit}
      className="w-full tabular-nums px-1 py-1 rounded hover:bg-bg-hover transition-colors text-text-primary cursor-text text-center block"
      style={{ fontSize: 11 }}>
      {value}%
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
  children,
  showRealizado,
  realizadoCells,
  onUpdateRealizadoCell,
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
  children?: React.ReactNode
  showRealizado?: boolean
  realizadoCells?: Record<string, Record<number, number | null>>
  onUpdateRealizadoCell?: (key: string, month: number, value: number | null) => void
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
          showRealizado={showRealizado}
          realizadoCells={realizadoCells}
          onUpdateRealizadoCell={onUpdateRealizadoCell}
        />
      ))}
      {children}
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
  showRealizado,
  realizadoCells,
  onUpdateRealizadoCell,
}: {
  def: MetricDef
  getCellValue: (key: string, month: number) => number
  getColumnValue: (key: string, months: number[], format: MetricDef['format']) => number
  columns: ViewColumn[]
  cells: Record<string, Record<number, CellData>>
  annual: number
  onUpdateCell: (key: string, month: number, value: number | null, mode?: 'value' | 'delta_pct') => void
  onToggleMode: (key: string, month: number) => void
  showRealizado?: boolean
  realizadoCells?: Record<string, Record<number, number | null>>
  onUpdateRealizadoCell?: (key: string, month: number, value: number | null) => void
}) {
  const isResult = !def.isKey
  const hasRealizado = showRealizado && realizadoCells

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

  // Helper to get realizado value for a single month
  const getRealVal = (month: number): number => {
    return realizadoCells?.[def.key]?.[month] ?? 0
  }

  // Helper to get realizado for multi-month (quarter)
  const getRealAgg = (months: number[]): number => {
    if (def.format === 'percent' || def.format === 'decimal') {
      const vals = months.map(m => getRealVal(m)).filter(v => v !== 0)
      return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
    }
    return months.reduce((s, m) => s + getRealVal(m), 0)
  }

  // Annual realizado
  const annualReal = hasRealizado ? getRealAgg([...MONTHS]) : 0

  // Variance types
  const varType = def.format === 'currency' ? 'currency' as const : def.format === 'percent' || def.format === 'decimal' ? 'pct' as const : 'number' as const
  const invertColor = def.key.startsWith('SPEND') || def.key === 'CPS'

  return (
    <>
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
          {hasRealizado && <span className="text-text-muted italic" style={{ fontSize: 9 }}>Prev</span>}
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

    {/* Realizado sub-row — editable */}
    {hasRealizado && (
      <tr className="border-t border-border/20" style={{ background: 'rgba(201,151,26,0.02)' }}>
        <td className="sticky left-0 z-10 px-4 py-0 border-r border-border" style={{ background: '#0b1a0f', borderLeft: leftBorder }}>
          <span className="italic" style={{ fontSize: 10, paddingLeft: def.isKey ? 14 : 0, color: '#c9a84c' }}>Real</span>
        </td>
        {columns.map(col => {
          if (col.months.length === 1) {
            const m = col.months[0]
            const realVal = getRealVal(m)
            const sfFmt = def.format === 'decimal' ? 'percent' : def.format
            return (
              <td key={col.key} className="px-1 py-0 text-center">
                <SFEditableCell value={realVal || null} format={sfFmt} isSaving={false}
                  onSave={v => onUpdateRealizadoCell?.(def.key, m, v)} isRealizado />
              </td>
            )
          }
          const realVal = getRealAgg(col.months)
          return (
            <td key={col.key} className="px-1 py-0 text-center">
              <span className="tabular-nums px-2 py-1 block" style={{ fontSize: 11, color: realVal === 0 ? '#4a5a4f' : 'rgba(255,255,255,0.55)' }}>
                {realVal === 0 ? '\u2014' : formatMetricValue(realVal, def.format, def.decimals)}
              </span>
            </td>
          )
        })}
        <td className="px-3 py-1 text-center border-l border-border">
          <span className="tabular-nums" style={{ fontSize: 11, color: annualReal === 0 ? '#4a5a4f' : 'rgba(255,255,255,0.55)' }}>
            {annualReal === 0 ? '\u2014' : formatMetricValue(annualReal, def.format, def.decimals)}
          </span>
        </td>
      </tr>
    )}

    {/* Variance sub-row */}
    {hasRealizado && (
      <tr className="border-t border-border/10" style={{ background: 'rgba(201,151,26,0.02)' }}>
        <td className="sticky left-0 z-10 px-4 py-0 border-r border-border" style={{ background: '#0b1a0f', borderLeft: leftBorder }}>
          <span className="text-text-muted" style={{ fontSize: 9, paddingLeft: def.isKey ? 14 : 0 }}>&Delta;</span>
        </td>
        {columns.map(col => {
          const prevVal = col.months.length === 1 ? getCellValue(def.key, col.months[0]) : getColumnValue(def.key, col.months, def.format)
          const realVal = col.months.length === 1 ? getRealVal(col.months[0]) : getRealAgg(col.months)
          return (
            <td key={col.key} className="px-1 py-0 text-center">
              <VarianceBadge previsto={prevVal} realizado={realVal} type={varType} invertColor={invertColor} />
            </td>
          )
        })}
        <td className="px-3 py-0 text-center border-l border-border">
          <VarianceBadge previsto={annual} realizado={annualReal} type={varType} invertColor={invertColor} />
        </td>
      </tr>
    )}
    </>
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
