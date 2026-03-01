'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import {
  MONTHS, MONTH_LABELS, FIN_METRIC_DEFS as METRIC_DEFS, FIN_SECTIONS as SECTIONS, FIN_KEY_METRICS as KEY_METRICS,
  isFinKeyMetric as isKeyMetric, calcFinAllMonths, resolveFinValue as resolveValue, formatFinValue as formatMetricValue, calcFinAnnualSummary as calcAnnualSummary,
  type FinKeyValues as KeyValues, type FinMetricKey as MetricKey, type FinResultMetric as ResultMetric, type FinMetricDef as MetricDef,
} from '@/lib/utils/financial-plan-calc'
import { upsertMetrics, upsertMetricsAdmin } from '@/app/actions/media-plan'

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

export default function FinancialPlannerClient({ planId, workspaceId, year, initialMetrics, isAdmin }: Props) {
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

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Planejamento Financeiro (DRE) {year}</h1>
          <p className="text-sm text-text-muted mt-1">
            DRE projetada conectada ao Planejador de Midia via ROAS, sessões e receita mês a mês
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

          <div className="flex items-center gap-1 bg-bg-card border border-border rounded-lg">
            <a
              href={isAdmin ? `?year=${year - 1}` : `/ferramentas/planejamento-financeiro/${year - 1}`}
              className="p-2 hover:bg-bg-hover rounded-l-lg transition-colors text-text-muted hover:text-text-primary"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            </a>
            <span className="px-3 py-1.5 text-sm font-semibold text-text-primary">{year}</span>
            <a
              href={isAdmin ? `?year=${year + 1}` : `/ferramentas/planejamento-financeiro/${year + 1}`}
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
                  Linha DRE
                </th>
                {MONTH_LABELS.map((label, i) => (
                  <th key={i} className="px-3 py-3 text-center font-medium text-text-muted min-w-[115px]" style={{ fontSize: 12 }}>
                    {label}
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
          colSpan={14}
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
  cells,
  annual,
  onUpdateCell,
  onToggleMode,
}: {
  def: MetricDef
  getCellValue: (key: string, month: number) => number
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

      {/* Month cells */}
      {MONTHS.map((month) => {
        const value = getCellValue(def.key, month)
        const cell = cells[def.key]?.[month]
        const isDeltaMode = cell?.mode === 'delta_pct' && month > 1

        return (
          <td key={month} className="px-1 py-0 text-center">
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

  const startEdit = () => {
    if (isDeltaMode) {
      setInputValue(rawCell?.delta_pct?.toString() ?? '')
    } else {
      setInputValue(rawCell?.value?.toString() ?? value.toString())
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
    return (
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitEdit()
            if (e.key === 'Escape') setEditing(false)
          }}
          className="w-full border rounded px-2 py-1.5 text-center outline-none tabular-nums"
          style={{
            fontSize: 12,
            background: 'rgba(201,168,76,0.08)',
            borderColor: 'rgba(201,168,76,0.4)',
            color: '#e8e0d0',
          }}
        />
        {isDeltaMode && (
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-brand-gold" style={{ fontSize: 10 }}>%</span>
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
