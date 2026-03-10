'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import {
  MONTHS, MONTH_LABELS, FIN_METRIC_DEFS as METRIC_DEFS, FIN_SECTIONS as SECTIONS, FIN_KEY_METRICS as KEY_METRICS,
  isFinKeyMetric as isKeyMetric, calcFinAllMonths, resolveFinValue as resolveValue, formatFinValue as formatMetricValue, calcFinAnnualSummary as calcAnnualSummary,
  type FinKeyValues as KeyValues, type FinMetricKey as MetricKey, type FinResultMetric as ResultMetric, type FinMetricDef as MetricDef,
} from '@/lib/utils/financial-plan-calc'
import { upsertMetrics, upsertMetricsAdmin } from '@/app/actions/media-plan'
import { RealizadoToggle } from '@/components/business-plan/RealizadoToggle'
import { VarianceBadge } from '@/components/business-plan/VarianceBadge'

// ============================================================
// View mode types
// ============================================================

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
    is_realizado?: boolean
  }>
  isAdmin?: boolean
}

// ============================================================
// Component
// ============================================================

export default function FinancialPlannerClient({ planId, workspaceId, year, initialMetrics, isAdmin }: Props) {
  const [showRealizado, setShowRealizado] = useState(false)
  const [showRealizadoBanner, setShowRealizadoBanner] = useState(true)

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

  // Realizado cells — manual input
  const [realizadoCells, setRealizadoCells] = useState<Record<string, Record<number, number | null>>>(() => {
    const map: Record<string, Record<number, number | null>> = {}
    for (const m of initialMetrics) {
      if (!m.is_realizado) continue
      if (!map[m.metric_key]) map[m.metric_key] = {}
      map[m.metric_key][m.month] = m.value_numeric
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

  const resultsByMonth = useMemo(() => calcFinAllMonths(keyValues), [keyValues])
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

  // Realizado save handlers
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
    const header = ['Linha DRE', ...MONTH_LABELS, 'Total/Média']
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
    a.download = `dre-${year}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [getCellValue, annualSummary, year])

  // Sales Forecast import
  const [sfImporting, setSfImporting] = useState(false)
  const [sfImportMsg, setSfImportMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const importFromSalesForecast = useCallback(async () => {
    setSfImporting(true)
    setSfImportMsg(null)
    try {
      const res = await fetch(`/api/sales-forecast?workspace_id=${workspaceId}&year=${year}`)
      const json = await res.json()
      const forecasts = json.forecasts || []

      if (forecasts.length === 0) {
        setSfImportMsg({ type: 'err', text: 'Configure o Sales Forecast primeiro →' })
        setSfImporting(false)
        return
      }

      // Build data per channel per month (previsto only)
      const byChannel: Record<string, Record<number, Record<string, number | null>>> = {}
      for (const f of forecasts) {
        if (f.is_realizado) continue
        if (!byChannel[f.channel]) byChannel[f.channel] = {}
        byChannel[f.channel][f.month] = {
          faturamento_bruto: f.faturamento_bruto != null ? Number(f.faturamento_bruto) : null,
          pedidos: f.pedidos != null ? Number(f.pedidos) : null,
          investimento_midia: f.investimento_midia != null ? Number(f.investimento_midia) : null,
          imposto_pct: f.imposto_pct != null ? Number(f.imposto_pct) : null,
          cmv_pct: f.cmv_pct != null ? Number(f.cmv_pct) : null,
          taxas_pct: f.taxas_pct != null ? Number(f.taxas_pct) : null,
          cancelamento_pct: f.cancelamento_pct != null ? Number(f.cancelamento_pct) : null,
          logistica_rs: f.logistica_rs != null ? Number(f.logistica_rs) : null,
          comissao_marketplace_pct: f.comissao_marketplace_pct != null ? Number(f.comissao_marketplace_pct) : null,
        }
      }

      const allChannels = Object.keys(byChannel).filter(c => c !== 'consolidado')
      let imported = 0

      for (const month of MONTHS) {
        // Aggregate consolidado
        let totalFat = 0
        let totalInvMidia = 0
        let totalLogistica = 0
        for (const ch of allChannels) {
          const d = byChannel[ch]?.[month]
          if (d) {
            totalFat += d.faturamento_bruto ?? 0
            totalInvMidia += d.investimento_midia ?? 0
            totalLogistica += d.logistica_rs ?? 0
          }
        }

        if (totalFat <= 0) continue

        // Get ecommerce channel data for pct fields
        const ecom = byChannel['ecommerce']?.[month]
        const consolData = byChannel['consolidado']?.[month]

        // Map to DRE keys
        updateCell('FATURAMENTO', month, Math.round(totalFat * 100) / 100, 'value')
        if (ecom?.imposto_pct != null) updateCell('IMPOSTOS_PCT', month, ecom.imposto_pct, 'value')
        if (consolData?.cancelamento_pct != null) updateCell('CANCELAMENTOS_PCT', month, consolData.cancelamento_pct, 'value')
        if (ecom?.cmv_pct != null) updateCell('CMV_PCT', month, ecom.cmv_pct, 'value')

        // Logistica as % of faturamento
        if (totalLogistica > 0 && totalFat > 0) {
          updateCell('LOGISTICA_PCT', month, Math.round(totalLogistica / totalFat * 100 * 10) / 10, 'value')
        }

        // Midia as % of faturamento
        if (totalInvMidia > 0 && totalFat > 0) {
          updateCell('MIDIA_PCT', month, Math.round(totalInvMidia / totalFat * 100 * 10) / 10, 'value')
        }

        // Taxa checkout from ecommerce taxas_pct
        if (ecom?.taxas_pct != null) updateCell('TAXA_CHECKOUT_PCT', month, ecom.taxas_pct, 'value')

        imported++
      }

      if (imported > 0) {
        setSfImportMsg({ type: 'ok', text: `${imported} meses importados do Sales Forecast` })
      } else {
        setSfImportMsg({ type: 'err', text: 'Nenhum dado encontrado no Sales Forecast para este ano' })
      }
    } catch {
      setSfImportMsg({ type: 'err', text: 'Erro ao importar do Sales Forecast' })
    }
    setSfImporting(false)
    setTimeout(() => setSfImportMsg(null), 5000)
  }, [workspaceId, year, updateCell])

  // Set of metric keys that are locked (synced from Midia Plan)
  const lockedKeys = useMemo(() => {
    const set = new Set<string>()
    // MIDIA_PCT is locked when it has a value from sync
    for (const m of MONTHS) {
      const cell = cells['MIDIA_PCT']?.[m]
      if (cell?.value != null && cell.value > 0) {
        set.add('MIDIA_PCT')
        break
      }
    }
    return set
  }, [cells])

  return (
    <div className="animate-fade-in">
      {/* Connection banner */}
      <div className="mb-4 px-4 py-3 rounded-lg border border-brand-gold/20 bg-brand-gold/5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C9971A" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
          <span className="text-text-secondary">
            <a href="/ferramentas/planejamento-midia" className="font-medium text-brand-gold hover:underline">Passo 1: Midia Plan</a> → <a href="/ferramentas/planejamento-midia?tab=sales_forecast" className="font-medium text-brand-gold hover:underline">Passo 2: Sales Forecast</a> → <span className="font-medium text-brand-gold">Passo 3: Forecast</span>
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Forecast (DRE) {year}</h1>
          <p className="text-sm text-text-muted mt-1">
            DRE projetada conectada ao Sales Forecast via receita, investimento e margens
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
              href={isAdmin ? `?year=${year - 1}` : `/ferramentas/forecast/${year - 1}`}
              className="p-2 hover:bg-bg-hover rounded-l-lg transition-colors text-text-muted hover:text-text-primary"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            </a>
            <span className="px-3 py-1.5 text-sm font-semibold text-text-primary">{year}</span>
            <a
              href={isAdmin ? `?year=${year + 1}` : `/ferramentas/forecast/${year + 1}`}
              className="p-2 hover:bg-bg-hover rounded-r-lg transition-colors text-text-muted hover:text-text-primary"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            </a>
          </div>

          <RealizadoToggle show={showRealizado} onToggle={() => setShowRealizado(v => !v)} />

          {!isAdmin && (
            <button
              onClick={importFromSalesForecast}
              disabled={sfImporting}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-gold/10 border border-brand-gold/30 text-sm text-brand-gold hover:bg-brand-gold/20 transition-colors disabled:opacity-60"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {sfImporting ? 'Importando...' : 'Importar do Sales Forecast'}
            </button>
          )}
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

      {/* Sales Forecast import message */}
      {sfImportMsg && (
        <div className={`mb-4 px-4 py-3 rounded-lg border flex items-center justify-between ${
          sfImportMsg.type === 'ok'
            ? 'border-success/30 bg-success/10 text-success'
            : 'border-error/30 bg-error/10 text-error'
        }`}>
          <span className="text-sm">{sfImportMsg.text}</span>
          <button onClick={() => setSfImportMsg(null)} className="text-xs px-2 opacity-70 hover:opacity-100">&#x2715;</button>
        </div>
      )}

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

      {/* Aderência banner */}
      {showRealizado && (() => {
        const previstoTotal = MONTHS.reduce((s, m) => s + getCellValue('FATURAMENTO', m), 0)
        const realizadoTotal = MONTHS.reduce((s, m) => s + (realizadoCells['FATURAMENTO']?.[m] ?? 0), 0)
        const aderencia = previstoTotal > 0 ? Math.round(realizadoTotal / previstoTotal * 100) : 0
        const color = aderencia >= 90 ? '#4ade80' : aderencia >= 70 ? '#eab308' : '#ef4444'
        const bg = aderencia >= 90 ? 'rgba(34,197,94,0.08)' : aderencia >= 70 ? 'rgba(234,179,8,0.08)' : 'rgba(239,68,68,0.08)'
        const border = aderencia >= 90 ? 'rgba(34,197,94,0.2)' : aderencia >= 70 ? 'rgba(234,179,8,0.2)' : 'rgba(239,68,68,0.2)'
        return realizadoTotal > 0 ? (
          <div className="mb-4 px-4 py-3 rounded-lg flex items-center gap-3 text-sm" style={{ background: bg, border: `1px solid ${border}` }}>
            <span style={{ fontSize: 16 }}>{aderencia >= 90 ? '\u2705' : aderencia >= 70 ? '\u26A0\uFE0F' : '\u274C'}</span>
            <span className="text-text-secondary">
              Aderencia ao cenario base: <span className="font-bold" style={{ color }}>{aderencia}%</span>
            </span>
            <span className="text-text-muted text-xs">
              (Realizado {realizadoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })} / Previsto {previstoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })})
            </span>
          </div>
        ) : null
      })()}

      {/* Spreadsheet */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border" style={{ background: 'linear-gradient(90deg, #0a1a0f, #0d2015)' }}>
                <th className="sticky left-0 z-10 text-left px-4 py-3 font-semibold text-text-secondary min-w-[220px] border-r border-border" style={{ fontSize: 13, background: '#0a1a0f' }}>
                  Linha DRE
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
                    lockedKeys={lockedKeys}
                    showRealizado={showRealizado}
                    realizadoCells={realizadoCells}
                    onUpdateRealizadoCell={updateRealizadoCell}
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
    </div>
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
  lockedKeys,
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
  lockedKeys: Set<string>
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
          isLocked={lockedKeys.has(def.key)}
          showRealizado={showRealizado}
          realizadoCells={realizadoCells}
          onUpdateRealizadoCell={onUpdateRealizadoCell}
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
  isLocked,
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
  isLocked?: boolean
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

  const getRealVal = (month: number): number => {
    return realizadoCells?.[def.key]?.[month] ?? 0
  }

  const getRealAgg = (months: number[]): number => {
    if (def.format === 'percent' || def.format === 'decimal') {
      const vals = months.map(m => getRealVal(m)).filter(v => v !== 0)
      return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
    }
    return months.reduce((s, m) => s + getRealVal(m), 0)
  }

  const annualReal = hasRealizado ? getRealAgg([...MONTHS]) : 0

  // Variance types
  const varType = def.format === 'currency' ? 'currency' as const : def.format === 'percent' || def.format === 'decimal' ? 'pct' as const : 'number' as const
  const invertColor = def.key.includes('MIDIA') || def.key.includes('IMPOSTO') || def.key.includes('TAXA')

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
          {isLocked ? (
            <span className="shrink-0 text-brand-gold" title="Preenchido automaticamente pelo Midia Plan">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            </span>
          ) : def.isKey ? (
            <span className="w-1.5 h-1.5 rounded-full bg-brand-gold shrink-0" title="Editável" />
          ) : null}
          <span
            className={def.isKey ? 'text-text-primary' : (def.isHighlight || def.isSubtotal) ? 'font-bold' : 'text-text-secondary'}
            style={{
              fontSize: isResult ? 13 : 12,
              color: isLocked ? '#c9a84c' : def.isHighlight ? '#c9a84c' : def.isSubtotal ? '#e0d5b8' : undefined,
            }}
          >
            {def.label}
          </span>
          {hasRealizado && <span className="italic text-text-muted" style={{ fontSize: 9 }}>Prev</span>}
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
              {isLocked ? (
                <LockedCell value={value} def={def} />
              ) : def.isKey ? (
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
            return (
              <td key={col.key} className="px-1 py-0 text-center">
                <FinRealizadoCell value={realVal || null} format={def.format} decimals={def.decimals}
                  onSave={v => onUpdateRealizadoCell?.(def.key, m, v)} />
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
// Locked Cell (synced from Midia Plan, read-only, gold)
// ============================================================

function LockedCell({ value, def }: { value: number; def: MetricDef }) {
  return (
    <div className="group relative">
      <span
        className="tabular-nums px-2 py-2 block cursor-default"
        style={{ fontSize: 12, color: value === 0 ? '#6b7c6f' : '#c9a84c' }}
        title="Preenchido automaticamente pelo Midia Plan"
      >
        {value === 0 ? '-' : formatMetricValue(value, def.format, def.decimals)}
      </span>
      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: '#0d2015', border: '1px solid #1f3d25' }}>
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="3"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
      </span>
    </div>
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

// ============================================================
// Realizado Editable Cell (for DRE)
// ============================================================

function FinRealizadoCell({ value, format, decimals, onSave }: {
  value: number | null; format: string; decimals?: number; onSave: (v: number | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const isCurrency = format === 'currency'
  const isPct = format === 'percent' || format === 'decimal'

  function startEdit() {
    setInputValue(value != null ? String(value).replace('.', ',') : '')
    setEditing(true)
  }

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

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
          onChange={e => setInputValue(e.target.value.replace(/[^0-9,.\-]/g, ''))}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
          className="w-full border rounded py-1 text-center outline-none tabular-nums"
          style={{ fontSize: 11, background: 'rgba(201,168,76,0.08)', borderColor: 'rgba(201,168,76,0.4)', color: '#e8e0d0', paddingLeft: isCurrency ? 24 : 8, paddingRight: isPct ? 20 : 8 }} />
        {isPct && <span className="absolute right-1.5 text-brand-gold/60" style={{ fontSize: 10 }}>%</span>}
      </div>
    )
  }

  function fmtDisplay(v: number | null): string {
    if (v === null || v === undefined) return '\u2014'
    return formatMetricValue(v, format as any, decimals)
  }

  return (
    <button onClick={startEdit}
      className="w-full tabular-nums px-2 py-1 rounded hover:bg-bg-hover transition-colors cursor-text text-center block"
      style={{ fontSize: 11, color: value ? 'rgba(255,255,255,0.55)' : '#4a5a4f' }}>
      {fmtDisplay(value)}
    </button>
  )
}
