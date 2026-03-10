'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { maskBRL, unmaskBRL, numberToBRL, maskPct, unmaskPct, numberToPct } from '@/lib/masks'

type Props = {
  workspaceId: string
  currentDay: number
  daysInMonth: number
  currentMonthLabel: string
}

type Period = 'today' | 'yesterday' | '7d' | '14d' | '21d' | '30d' | 'mes_atual' | 'custom'
const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: 'yesterday', label: 'Ontem' },
  { key: '7d', label: '7 dias' },
  { key: '14d', label: '14 dias' },
  { key: '21d', label: '21 dias' },
  { key: '30d', label: '30 dias' },
  { key: 'mes_atual', label: 'Mês Atual' },
  { key: 'custom', label: 'Personalizado' },
]

type RawMetrics = {
  orders_captados: number; receita_captada: number; orders_faturados: number
  receita_faturada: number; orders_cancelled: number; pix_total: number
  pix_paid: number; coupon_orders: number; total_spend: number
  total_impressions: number; total_clicks: number; total_conversions: number
  meta_spend: number; meta_impressions: number; google_spend: number
  ga4_sessions: number; organic_sessions: number; paid_sessions: number
  direct_sessions: number; social_sessions: number; has_ga4: boolean
  shopify_sessions: number; influencer_spend: number; influencer_commission: number
  recurrence: number
}

type Goals = {
  meta_receita: number
  meta_investimento: number
  meta_cps: number
  meta_conversao: number
  meta_ticket: number
  meta_roas: number
  days_in_month: number
  current_day: number
} | null

type Integration = {
  provider: string; is_active: boolean; has_ga4: boolean; last_sync: string | null
}

type SyncSourceStatus = 'idle' | 'syncing' | 'success' | 'error'
type SyncSource = {
  key: string; label: string; provider: string
  connected: boolean; status: SyncSourceStatus; error?: string
  isWebhook?: boolean
}

function toDateStr(d: Date) {
  return new Date(d.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function getDateRange(period: Period, customFrom: string, customTo: string) {
  const now = new Date()
  const today = toDateStr(now)
  if (period === 'today') return { date_from: today, date_to: today }
  if (period === 'yesterday') {
    const y = new Date(); y.setDate(y.getDate() - 1)
    const ys = toDateStr(y)
    return { date_from: ys, date_to: ys }
  }
  if (period === 'mes_atual') return { date_from: today.slice(0, 7) + '-01', date_to: today }
  if (period === 'custom' && customFrom && customTo) return { date_from: customFrom, date_to: customTo }
  const daysMap: Record<string, number> = { '7d': 7, '14d': 14, '21d': 21, '30d': 30 }
  const days = daysMap[period] ?? 30
  const since = new Date(); since.setDate(since.getDate() - days)
  return { date_from: toDateStr(since), date_to: today }
}

function getComparisonRange(period: Period, range: { date_from: string; date_to: string }) {
  const from = new Date(range.date_from + 'T12:00:00Z')
  const to = new Date(range.date_to + 'T12:00:00Z')
  const spanMs = to.getTime() - from.getTime()
  const spanDays = Math.round(spanMs / 86400000) + 1

  if (period === 'mes_atual') {
    const now = new Date()
    const brNow = new Date(now.getTime() - 3 * 60 * 60 * 1000)
    const currentDay = brNow.getUTCDate()
    const prevMonth = new Date(Date.UTC(brNow.getUTCFullYear(), brNow.getUTCMonth() - 1, 1))
    const daysInPrev = new Date(Date.UTC(prevMonth.getUTCFullYear(), prevMonth.getUTCMonth() + 1, 0)).getUTCDate()
    const compDay = Math.min(currentDay, daysInPrev)
    const compFrom = `${prevMonth.getUTCFullYear()}-${String(prevMonth.getUTCMonth() + 1).padStart(2, '0')}-01`
    const compTo = `${prevMonth.getUTCFullYear()}-${String(prevMonth.getUTCMonth() + 1).padStart(2, '0')}-${String(compDay).padStart(2, '0')}`
    return { date_from: compFrom, date_to: compTo }
  }

  const prevTo = new Date(from.getTime() - 86400000)
  const prevFrom = new Date(prevTo.getTime() - (spanDays - 1) * 86400000)
  return { date_from: prevFrom.toISOString().slice(0, 10), date_to: prevTo.toISOString().slice(0, 10) }
}

function deriveMetrics(raw: RawMetrics) {
  const r = raw
  const investimento_total = n(r.meta_spend) + n(r.google_spend) + n(r.influencer_spend) + n(r.influencer_commission)
  const totalSessions = r.has_ga4 ? n(r.ga4_sessions) : n(r.shopify_sessions)
  return {
    receita_captada: n(r.receita_captada),
    receita_faturada: n(r.receita_faturada),
    orders_captados: n(r.orders_captados),
    orders_faturados: n(r.orders_faturados),
    orders_cancelled: n(r.orders_cancelled),
    approval_rate: n(r.orders_captados) > 0 ? (n(r.orders_faturados) / n(r.orders_captados)) * 100 : 0,
    avg_ticket: n(r.orders_faturados) > 0 ? n(r.receita_faturada) / n(r.orders_faturados) : 0,
    investimento_total: investimento_total,
    roas: investimento_total > 0 ? n(r.receita_faturada) / investimento_total : 0,
    cac: n(r.orders_faturados) > 0 ? investimento_total / n(r.orders_faturados) : 0,
    cpm: n(r.meta_impressions) > 0 ? (n(r.meta_spend) / n(r.meta_impressions)) * 1000 : 0,
    pix_approval: n(r.pix_total) > 0 ? (n(r.pix_paid) / n(r.pix_total)) * 100 : 0,
    total_sessions: totalSessions,
    ga4_organic: n(r.organic_sessions),
    conversion_rate: totalSessions > 0 ? (n(r.orders_faturados) / totalSessions) * 100 : 0,
    coupon_orders: n(r.coupon_orders),
    coupon_pct: n(r.orders_faturados) > 0 ? (n(r.coupon_orders) / n(r.orders_faturados)) * 100 : 0,
    cps: totalSessions > 0 ? investimento_total / totalSessions : 0,
    has_ga4: r.has_ga4,
  }
}

function n(v: any): number { return Number(v) || 0 }

const EMPTY_RAW: RawMetrics = {
  orders_captados: 0, receita_captada: 0, orders_faturados: 0, receita_faturada: 0,
  orders_cancelled: 0, pix_total: 0, pix_paid: 0, coupon_orders: 0,
  total_spend: 0, total_impressions: 0, total_clicks: 0, total_conversions: 0,
  meta_spend: 0, meta_impressions: 0, google_spend: 0,
  ga4_sessions: 0, organic_sessions: 0, paid_sessions: 0, direct_sessions: 0,
  social_sessions: 0, has_ga4: false, shopify_sessions: 0,
  influencer_spend: 0, influencer_commission: 0, recurrence: 0,
}

type DerivedMetrics = ReturnType<typeof deriveMetrics>

export default function PerformanceDashboardClient(props: Props) {
  const { workspaceId, currentDay, daysInMonth, currentMonthLabel } = props

  const [period, setPeriod] = useState<Period>('mes_atual')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [appliedFrom, setAppliedFrom] = useState('')
  const [appliedTo, setAppliedTo] = useState('')

  const [loading, setLoading] = useState(true)
  const [current, setCurrent] = useState<DerivedMetrics>(() => deriveMetrics(EMPTY_RAW))
  const [previous, setPrevious] = useState<DerivedMetrics>(() => deriveMetrics(EMPTY_RAW))
  const [mtdMetrics, setMtdMetrics] = useState<DerivedMetrics>(() => deriveMetrics(EMPTY_RAW))
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [goals, setGoals] = useState<Goals>(null)

  const [showSyncModal, setShowSyncModal] = useState(false)
  const [showGoalsModal, setShowGoalsModal] = useState(false)
  const [isStale, setIsStale] = useState(false)
  const [showInsights, setShowInsights] = useState(false)
  const [planGoals, setPlanGoals] = useState<Goals>(null) // from Mídia Plan API (for import suggestion)

  const fetchIdRef = useRef(0)

  // Current month key for localStorage
  const brNowInit = new Date(Date.now() - 3 * 60 * 60 * 1000)
  const goalsYear = brNowInit.getUTCFullYear()
  const goalsMonth = brNowInit.getUTCMonth() + 1
  const goalsLsKey = `goals_${workspaceId}_${goalsYear}_${goalsMonth}`

  // Load goals from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(goalsLsKey)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setGoals({
          meta_receita: Number(parsed.meta_receita) || 0,
          meta_investimento: Number(parsed.meta_investimento) || 0,
          meta_cps: Number(parsed.meta_cps) || 0,
          meta_conversao: Number(parsed.meta_conversao) || 0,
          meta_ticket: Number(parsed.meta_ticket) || 0,
          meta_roas: Number(parsed.meta_roas) || 0,
          days_in_month: daysInMonth,
          current_day: currentDay,
        })
      } catch { /* ignore */ }
    }

    const lastSync = localStorage.getItem(`bl_perf_last_sync_${workspaceId}`)
    if (lastSync) {
      const elapsed = Date.now() - Number(lastSync)
      if (elapsed > 10 * 60 * 1000) setIsStale(true)
    } else {
      setIsStale(true)
    }
  }, [workspaceId, goalsLsKey, daysInMonth, currentDay])

  const fetchMetrics = useCallback(async () => {
    const id = ++fetchIdRef.current
    setLoading(true)

    const range = getDateRange(period, appliedFrom, appliedTo)
    const compRange = getComparisonRange(period, range)

    const headers = { 'Content-Type': 'application/json' }
    const body = (r: { date_from: string; date_to: string }, extra?: Record<string, any>) =>
      JSON.stringify({ workspace_id: workspaceId, ...r, ...extra })

    try {
      const isMtd = period === 'mes_atual'
      const today = toDateStr(new Date())
      const mtdRange = { date_from: today.slice(0, 7) + '-01', date_to: today }

      const fetches: Promise<Response>[] = [
        fetch('/api/performance/metrics', { method: 'POST', headers, body: body(range, { include_goals: true }) }),
        fetch('/api/performance/metrics', { method: 'POST', headers, body: body(compRange) }),
      ]
      if (!isMtd) {
        fetches.push(fetch('/api/performance/metrics', { method: 'POST', headers, body: body(mtdRange) }))
      }

      const responses = await Promise.all(fetches)
      const results = await Promise.all(responses.map(r => r.json()))

      if (id !== fetchIdRef.current) return

      const currentData = results[0]
      const compData = results[1]
      const mtdData = isMtd ? results[0] : results[2]

      setCurrent(deriveMetrics(currentData.metrics ?? EMPTY_RAW))
      setPrevious(deriveMetrics(compData.metrics ?? EMPTY_RAW))
      setMtdMetrics(deriveMetrics(mtdData.metrics ?? EMPTY_RAW))
      setIntegrations(currentData.integrations ?? [])
      // Store API goals for import suggestion only — don't overwrite localStorage goals
      if (currentData.goals) setPlanGoals(currentData.goals)
    } catch {
      // Keep previous state on error
    } finally {
      if (id === fetchIdRef.current) setLoading(false)
    }
  }, [workspaceId, period, appliedFrom, appliedTo])

  useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  // Prev month label
  const now = new Date()
  const brNow = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  const prevMonthDate = new Date(Date.UTC(brNow.getUTCFullYear(), brNow.getUTCMonth() - 1, 1))
  const prevMonthLabel = prevMonthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })

  // Gauges (always based on MTD)
  const revenueGoal = goals?.meta_receita ?? 0
  const investmentGoal = goals?.meta_investimento ?? 0
  const dailyRevenueTarget = revenueGoal > 0 ? revenueGoal / daysInMonth : 0
  const dailyInvestmentTarget = investmentGoal > 0 ? investmentGoal / daysInMonth : 0
  const dailyRevenueAvg = currentDay > 0 ? mtdMetrics.receita_faturada / currentDay : 0
  const dailyInvestmentAvg = currentDay > 0 ? mtdMetrics.investimento_total / currentDay : 0
  const projectedRevenue = dailyRevenueAvg * daysInMonth
  const projectedInvestment = dailyInvestmentAvg * daysInMonth

  // Pace indicators for KPI cards
  function getPace(currentVal: number, goalVal: number, isAccum: boolean): { emoji: string; label: string; color: string } | null {
    if (!goals || goalVal <= 0) return null
    let ratio: number
    if (isAccum) {
      // Daily pace: (current/day) vs (goal/days_in_month)
      const dailyCurrent = currentDay > 0 ? currentVal / currentDay : 0
      const dailyGoal = goalVal / daysInMonth
      ratio = dailyGoal > 0 ? dailyCurrent / dailyGoal : 0
    } else {
      // Average metric: direct comparison
      ratio = goalVal > 0 ? currentVal / goalVal : 0
    }
    if (ratio >= 1) return { emoji: '\u{1F7E2}', label: `+${((ratio - 1) * 100).toFixed(0)}% acima`, color: 'text-green-400' }
    if (ratio >= 0.8) return { emoji: '\u{1F7E1}', label: `${((1 - ratio) * 100).toFixed(0)}% abaixo`, color: 'text-yellow-400' }
    return { emoji: '\u{1F534}', label: `${((1 - ratio) * 100).toFixed(0)}% abaixo`, color: 'text-red-400' }
  }

  // Pace for cost metrics (inverted: lower is better)
  function getPaceInverted(currentVal: number, goalVal: number): { emoji: string; label: string; color: string } | null {
    if (!goals || goalVal <= 0 || currentVal <= 0) return null
    const ratio = currentVal / goalVal
    if (ratio <= 1) return { emoji: '\u{1F7E2}', label: `${((1 - ratio) * 100).toFixed(0)}% abaixo`, color: 'text-green-400' }
    if (ratio <= 1.2) return { emoji: '\u{1F7E1}', label: `+${((ratio - 1) * 100).toFixed(0)}% acima`, color: 'text-yellow-400' }
    return { emoji: '\u{1F534}', label: `+${((ratio - 1) * 100).toFixed(0)}% acima`, color: 'text-red-400' }
  }

  // Use MTD metrics for pace when period is mes_atual, otherwise use current
  const paceMetrics = period === 'mes_atual' ? current : mtdMetrics

  type KpiDef = {
    label: string; value: string; curr: number; prev: number
    invertColor?: boolean; source?: string
    goalLabel?: string; pace?: { emoji: string; label: string; color: string } | null
  }

  // KPI cards — 3 rows x 5
  const kpiRows: KpiDef[][] = [
    // Row 1: Revenue + efficiency
    [
      {
        label: 'Receita Captada', value: fmtCurrency(current.receita_captada, 0),
        curr: current.receita_captada, prev: previous.receita_captada, source: 'Yampi',
      },
      {
        label: 'Receita Faturada', value: fmtCurrency(current.receita_faturada, 0),
        curr: current.receita_faturada, prev: previous.receita_faturada, source: 'Yampi',
        goalLabel: goals && goals.meta_receita > 0 ? `Meta: ${fmtCompact(goals.meta_receita)}/mês` : undefined,
        pace: getPace(paceMetrics.receita_faturada, revenueGoal, true),
      },
      {
        label: 'Taxa Aprovação', value: `${current.approval_rate.toFixed(1)}%`,
        curr: current.approval_rate, prev: previous.approval_rate, source: 'Calculado',
      },
      {
        label: 'Investimento', value: fmtCurrency(current.investimento_total, 0),
        curr: current.investimento_total, prev: previous.investimento_total, source: 'Meta+Google', invertColor: true,
        goalLabel: goals && goals.meta_investimento > 0 ? `Meta: ${fmtCompact(goals.meta_investimento)}/mês` : undefined,
        pace: getPaceInverted(paceMetrics.investimento_total, investmentGoal),
      },
      {
        label: 'ROAS', value: `${current.roas.toFixed(2)}x`,
        curr: current.roas, prev: previous.roas, source: 'Calculado',
        goalLabel: goals && goals.meta_roas > 0 ? `Meta: ${goals.meta_roas.toFixed(2)}x` : undefined,
        pace: getPace(paceMetrics.roas, goals?.meta_roas ?? 0, false),
      },
    ],
    // Row 2: Orders
    [
      {
        label: 'Pedidos Captados', value: fmtNumber(current.orders_captados),
        curr: current.orders_captados, prev: previous.orders_captados, source: 'Yampi',
      },
      {
        label: 'Pedidos Faturados', value: fmtNumber(current.orders_faturados),
        curr: current.orders_faturados, prev: previous.orders_faturados, source: 'Yampi',
      },
      {
        label: 'Ticket Médio', value: fmtCurrency(current.avg_ticket),
        curr: current.avg_ticket, prev: previous.avg_ticket, source: 'Calculado',
        goalLabel: goals && goals.meta_ticket > 0 ? `Meta: ${fmtCurrency(goals.meta_ticket, 0)}` : undefined,
        pace: getPace(paceMetrics.avg_ticket, goals?.meta_ticket ?? 0, false),
      },
      {
        label: 'CAC', value: fmtCurrency(current.cac),
        curr: current.cac, prev: previous.cac, invertColor: true, source: 'Calculado',
      },
      {
        label: 'Pedidos c/ Cupom', value: `${current.coupon_pct.toFixed(1)}%`,
        curr: current.coupon_pct, prev: previous.coupon_pct, source: 'Yampi',
      },
    ],
    // Row 3: Traffic + conversion
    [
      {
        label: current.has_ga4 ? 'Sessões GA4' : 'Sessões', value: fmtNumber(current.total_sessions),
        curr: current.total_sessions, prev: previous.total_sessions, source: current.has_ga4 ? 'GA4' : 'Shopify',
      },
      {
        label: 'Sessões Orgânicas', value: current.has_ga4 ? fmtNumber(current.ga4_organic) : '\u2014',
        curr: current.ga4_organic, prev: previous.ga4_organic, source: 'GA4',
      },
      {
        label: 'Taxa Conversão', value: `${current.conversion_rate.toFixed(2)}%`,
        curr: current.conversion_rate, prev: previous.conversion_rate, source: 'Calculado',
        goalLabel: goals && goals.meta_conversao > 0 ? `Meta: ${goals.meta_conversao.toFixed(2)}%` : undefined,
        pace: getPace(paceMetrics.conversion_rate, goals?.meta_conversao ?? 0, false),
      },
      {
        label: 'CPS', value: fmtCurrency(current.cps),
        curr: current.cps, prev: previous.cps, invertColor: true, source: 'Calculado',
        goalLabel: goals && goals.meta_cps > 0 ? `Meta: ${fmtCurrency(goals.meta_cps, 2)}` : undefined,
        pace: getPaceInverted(paceMetrics.cps, goals?.meta_cps ?? 0),
      },
      {
        label: 'Aprovação PIX', value: `${current.pix_approval.toFixed(1)}%`,
        curr: current.pix_approval, prev: previous.pix_approval, source: 'Yampi',
      },
    ],
  ]

  // Smart insights
  const insights = generateInsights(paceMetrics, goals)

  return (
    <div className="space-y-6">
      {/* Period filters + MTD info bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 bg-brand-gold/10 text-brand-gold text-xs font-semibold rounded-lg border border-brand-gold/20">
            MTD
          </span>
          <span className="text-text-secondary text-sm">
            Dia {currentDay} de {daysInMonth} — <span className="capitalize">{currentMonthLabel}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-text-muted text-xs">
            vs <span className="capitalize">{prevMonthLabel}</span> (mesmos {currentDay} dias)
          </span>
          <button
            onClick={() => setShowSyncModal(true)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-bg-card border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <SyncIcon />
              Sincronizar
            </span>
          </button>
          <button
            onClick={() => setShowGoalsModal(true)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-bg-card border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <TargetIcon />
              Metas
            </span>
          </button>
        </div>
      </div>

      {/* Stale data banner */}
      {isStale && (
        <div className="px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs flex items-center justify-between">
          <span>Dados podem estar desatualizados.</span>
          <button onClick={() => setShowSyncModal(true)} className="underline hover:no-underline cursor-pointer">
            Sincronizar agora
          </button>
        </div>
      )}

      {/* No goals banner */}
      {!loading && !goals && (
        <div className="px-4 py-3 rounded-lg bg-brand-gold/5 border border-brand-gold/20 text-brand-gold text-xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <TargetIcon />
            Defina suas metas mensais para ver insights, pace diário e projeções.
          </span>
          <button onClick={() => setShowGoalsModal(true)} className="underline hover:no-underline font-medium cursor-pointer flex-shrink-0 ml-2">
            Definir metas
          </button>
        </div>
      )}

      {/* Data source labels */}
      <div className="flex flex-wrap gap-2">
        <span className="px-2 py-1 rounded-md bg-bg-card border border-border text-[10px] text-text-muted font-medium">Vendas: Yampi</span>
        <span className="px-2 py-1 rounded-md bg-bg-card border border-border text-[10px] text-text-muted font-medium">Ads: Meta + Google</span>
        <span className={`px-2 py-1 rounded-md bg-bg-card border text-[10px] font-medium ${current.has_ga4 ? 'border-orange-500/30 text-orange-400' : 'border-border text-text-muted'}`}>
          Sessões: {current.has_ga4 ? 'GA4' : 'Shopify'}
        </span>
      </div>

      {/* Period filter pills */}
      <div className="flex flex-wrap gap-1.5 md:gap-2">
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={`px-2 py-1 md:px-3 md:py-1.5 text-xs md:text-sm rounded-lg font-medium transition-all cursor-pointer ${
              period === p.key
                ? 'bg-brand-gold text-bg-base shadow-sm'
                : 'bg-bg-card border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary'
            }`}>{p.label}</button>
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

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="kpi-card animate-pulse">
              <div className="h-3 w-16 bg-bg-hover rounded mb-2" />
              <div className="h-5 w-20 bg-bg-hover rounded mb-1" />
              <div className="h-3 w-12 bg-bg-hover rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Gauge charts — Revenue + Investment side by side */}
      {!loading && (revenueGoal > 0 || investmentGoal > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {revenueGoal > 0 && (
            <GaugeCard
              label="Meta de Receita Diária"
              current={dailyRevenueAvg}
              target={dailyRevenueTarget}
              totalCurrent={mtdMetrics.receita_faturada}
              totalTarget={revenueGoal}
              projected={projectedRevenue}
              unit="R$"
            />
          )}
          {investmentGoal > 0 && (
            <GaugeCard
              label="Meta de Investimento Diário"
              current={dailyInvestmentAvg}
              target={dailyInvestmentTarget}
              totalCurrent={mtdMetrics.investimento_total}
              totalTarget={investmentGoal}
              projected={projectedInvestment}
              unit="R$"
              invertProjection
            />
          )}
        </div>
      )}

      {/* KPI Grid — 3 rows x 5 columns */}
      {!loading && kpiRows.map((row, rowIdx) => (
        <div key={rowIdx} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {row.map((kpi, i) => (
            <KpiCard
              key={i}
              label={kpi.label}
              value={kpi.value}
              current={kpi.curr}
              previous={kpi.prev}
              invertColor={kpi.invertColor}
              source={kpi.source}
              goalLabel={kpi.goalLabel}
              pace={kpi.pace}
            />
          ))}
        </div>
      ))}

      {/* Smart Insights */}
      {!loading && insights.length > 0 && (
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setShowInsights(!showInsights)}
            className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-bg-hover/50 transition-colors cursor-pointer"
          >
            <span className="text-text-primary font-semibold text-sm flex items-center gap-2">
              <InsightIcon />
              Insights
              <span className="px-1.5 py-0.5 rounded-full bg-brand-gold/15 text-brand-gold text-[10px] font-bold">
                {insights.length}
              </span>
            </span>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className={`text-text-muted transition-transform duration-200 ${showInsights ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showInsights && (
            <div className="px-5 pb-5 space-y-3">
              {insights.map((insight, idx) => (
                <div key={idx} className={`p-4 rounded-lg border ${
                  insight.type === 'success' ? 'bg-green-500/5 border-green-500/20' : 'bg-yellow-500/5 border-yellow-500/20'
                }`}>
                  <p className="font-semibold text-sm text-text-primary mb-1">{insight.title}</p>
                  <p className="text-text-secondary text-xs mb-2">{insight.body}</p>
                  {insight.bullets.length > 0 && (
                    <ul className="space-y-1">
                      {insight.bullets.map((b, bi) => (
                        <li key={bi} className="text-text-muted text-xs flex items-start gap-1.5">
                          <span className="mt-1 w-1 h-1 rounded-full bg-text-muted/50 flex-shrink-0" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Projected summary */}
      {!loading && (revenueGoal > 0 || mtdMetrics.receita_faturada > 0) && (
        <div className="bg-bg-card border border-border-gold rounded-xl p-5 card-premium">
          <h3 className="font-sans text-text-primary font-semibold text-sm mb-4 flex items-center gap-2">
            <ProjectionIcon />
            Projeção para fim do mês
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MiniStat label="Receita Projetada" value={fmtCurrency(projectedRevenue, 0)} />
            <MiniStat label="Investimento Projetado" value={fmtCurrency(projectedInvestment, 0)} />
            <MiniStat label="ROAS Projetado" value={projectedInvestment > 0 ? `${(projectedRevenue / projectedInvestment).toFixed(2)}x` : '\u2014'} />
            <MiniStat label="Pedidos Projetados" value={fmtNumber(Math.round((mtdMetrics.orders_faturados / Math.max(currentDay, 1)) * daysInMonth))} />
          </div>
        </div>
      )}

      {/* Sync Modal */}
      {showSyncModal && (
        <SyncModal
          workspaceId={workspaceId}
          integrations={integrations}
          onClose={() => setShowSyncModal(false)}
          onSyncComplete={() => {
            localStorage.setItem(`bl_perf_last_sync_${workspaceId}`, String(Date.now()))
            setIsStale(false)
            fetchMetrics()
          }}
        />
      )}

      {/* Goals Modal */}
      {showGoalsModal && (
        <GoalsModal
          currentGoals={goals}
          planGoals={planGoals}
          daysInMonth={daysInMonth}
          currentDay={currentDay}
          onSave={(g) => {
            setGoals(g)
            localStorage.setItem(goalsLsKey, JSON.stringify(g))
            setShowGoalsModal(false)
          }}
          onClose={() => setShowGoalsModal(false)}
        />
      )}
    </div>
  )
}

/* ---------- Insight generation ---------- */

type Insight = {
  title: string; body: string; bullets: string[]; type: 'warning' | 'success'; priority: number
}

function generateInsights(metrics: DerivedMetrics, goals: Goals): Insight[] {
  if (!goals) return []
  const all: Insight[] = []

  // Insight: CPS alto
  if (goals.meta_cps > 0 && metrics.cps > goals.meta_cps * 1.15) {
    const pct = ((metrics.cps / goals.meta_cps - 1) * 100).toFixed(0)
    all.push({
      title: `CPS ${pct}% acima da meta`,
      body: `Custo por sessão de ${fmtCurrency(metrics.cps)} vs meta de ${fmtCurrency(goals.meta_cps)}. Considere:`,
      bullets: ['Reequilibrar investimento entre canais', 'Testar novos criativos', 'Focar em produtos âncora com maior volume'],
      type: 'warning', priority: 2,
    })
  }

  // Insight: Taxa conversão baixa
  if (goals.meta_conversao > 0 && metrics.conversion_rate < goals.meta_conversao * 0.85) {
    const pct = ((1 - metrics.conversion_rate / goals.meta_conversao) * 100).toFixed(0)
    all.push({
      title: `Taxa de conversão ${pct}% abaixo da meta`,
      body: `Conversão de ${metrics.conversion_rate.toFixed(2)}% vs meta de ${goals.meta_conversao.toFixed(2)}%. Verifique:`,
      bullets: ['Páginas de produto e checkout', 'Funil de abandono de carrinho', 'Oferta e urgência', 'Connect rate dos anúncios'],
      type: 'warning', priority: 1,
    })
  }

  // Insight: Ticket médio baixo
  if (goals.meta_ticket > 0 && metrics.avg_ticket < goals.meta_ticket * 0.9) {
    const pct = ((1 - metrics.avg_ticket / goals.meta_ticket) * 100).toFixed(0)
    all.push({
      title: `Ticket médio ${pct}% abaixo da meta`,
      body: `Ticket de ${fmtCurrency(metrics.avg_ticket)} vs meta de ${fmtCurrency(goals.meta_ticket)}. Possíveis causas:`,
      bullets: ['Excesso de cupons de desconto', 'Mix de produtos inadequado', 'Oportunidade de order bump / upsell', 'Revisar kits e combos'],
      type: 'warning', priority: 3,
    })
  }

  // Insight: ROAS abaixo
  if (goals.meta_roas > 0 && metrics.roas < goals.meta_roas * 0.9) {
    const pct = ((1 - metrics.roas / goals.meta_roas) * 100).toFixed(0)
    all.push({
      title: `ROAS ${pct}% abaixo da meta`,
      body: 'CPS x Taxa de Conversão x Ticket Médio = Receita Faturada. Com ROAS baixo, o problema está em:',
      bullets: ['CPS muito alto \u2192 criativos ou segmentação', 'Conversão baixa \u2192 página ou oferta', 'Ticket baixo \u2192 mix de produtos'],
      type: 'warning', priority: 0,
    })
  }

  // Insight: Cupom excessivo
  if (metrics.coupon_pct > 40) {
    all.push({
      title: `Alto uso de cupons (${metrics.coupon_pct.toFixed(1)}%)`,
      body: 'Mais de 40% dos pedidos usam cupom. Avalie impacto no ticket médio e margem.',
      bullets: [],
      type: 'warning', priority: 4,
    })
  }

  // Insight: Tudo no ritmo
  if (all.length === 0 && goals.meta_receita > 0) {
    all.push({
      title: 'Operação no ritmo',
      body: 'Receita e investimento no pace diário. Continue monitorando conversão e ticket.',
      bullets: [],
      type: 'success', priority: 10,
    })
  }

  // Sort by priority (lower = more important), limit to 3
  all.sort((a, b) => a.priority - b.priority)
  return all.slice(0, 3)
}

/* ---------- Sync Modal ---------- */

function SyncModal({
  workspaceId, integrations, onClose, onSyncComplete,
}: {
  workspaceId: string; integrations: Integration[]; onClose: () => void; onSyncComplete: () => void
}) {
  const isConnected = (provider: string) => integrations.some(i => i.provider === provider && i.is_active)
  const hasGa4 = integrations.some(i => i.has_ga4)

  const [sources, setSources] = useState<SyncSource[]>([
    { key: 'meta', label: 'Meta Ads', provider: 'meta_ads', connected: isConnected('meta_ads'), status: 'idle' },
    { key: 'google', label: 'Google Ads', provider: 'google_ads', connected: isConnected('google_ads'), status: 'idle' },
    { key: 'ga4', label: 'GA4', provider: 'ga4', connected: hasGa4, status: 'idle' },
    { key: 'yampi', label: 'Yampi', provider: 'yampi', connected: isConnected('yampi'), status: 'idle', isWebhook: true },
  ])
  const [selected, setSelected] = useState<Set<string>>(() => {
    const s = new Set<string>()
    if (isConnected('meta_ads')) s.add('meta')
    if (isConnected('google_ads')) s.add('google')
    if (hasGa4) s.add('ga4')
    return s
  })
  const [anySyncing, setAnySyncing] = useState(false)

  const toggleSource = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  const syncEndpoints: Record<string, string> = {
    meta: '/api/integrations/meta/sync',
    google: '/api/integrations/google-ads/sync',
    ga4: '/api/integrations/ga4/sync',
  }

  async function handleSync() {
    const toSync = sources.filter(s => selected.has(s.key) && !s.isWebhook && s.connected)
    if (toSync.length === 0) return

    setAnySyncing(true)
    const dateFrom = new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0]
    const dateTo = new Date().toISOString().split('T')[0]

    const updates = [...sources]
    for (const src of toSync) {
      const idx = updates.findIndex(s => s.key === src.key)
      updates[idx] = { ...updates[idx], status: 'syncing' }
    }
    setSources(updates)

    await Promise.allSettled(
      toSync.map(async (src) => {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 60000)
        try {
          const body = src.key === 'ga4'
            ? JSON.stringify({ workspace_id: workspaceId })
            : JSON.stringify({ workspace_id: workspaceId, date_from: dateFrom, date_to: dateTo })

          const res = await fetch(syncEndpoints[src.key], {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            signal: controller.signal,
          })
          clearTimeout(timeout)

          setSources(prev => prev.map(s =>
            s.key === src.key
              ? { ...s, status: res.ok ? 'success' : 'error', error: res.ok ? undefined : `HTTP ${res.status}` }
              : s
          ))
        } catch (err: any) {
          clearTimeout(timeout)
          setSources(prev => prev.map(s =>
            s.key === src.key
              ? { ...s, status: 'error', error: err?.name === 'AbortError' ? 'Timeout (60s)' : 'Erro de conexão' }
              : s
          ))
        }
      })
    )

    setAnySyncing(false)
    onSyncComplete()
  }

  const statusIcon = (status: SyncSourceStatus) => {
    if (status === 'syncing') return <span className="inline-block w-3.5 h-3.5 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" />
    if (status === 'success') return <span className="text-green-400 text-sm">&#10003;</span>
    if (status === 'error') return <span className="text-red-400 text-sm">&#10007;</span>
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="font-sans text-text-primary font-semibold text-lg mb-1">Sincronizar Dados</h3>
        <p className="text-text-muted text-xs mb-5">Selecione as fontes para atualizar.</p>

        <div className="space-y-3">
          {sources.map(src => (
            <div key={src.key} className="flex items-center justify-between p-3 rounded-lg bg-bg-base border border-border">
              <div className="flex items-center gap-3">
                {!src.isWebhook && (
                  <input
                    type="checkbox"
                    checked={selected.has(src.key)}
                    onChange={() => toggleSource(src.key)}
                    disabled={!src.connected || anySyncing}
                    className="accent-brand-gold w-4 h-4"
                  />
                )}
                <div>
                  <p className="text-text-primary text-sm font-medium">{src.label}</p>
                  {src.isWebhook ? (
                    <p className="text-text-muted text-[10px]">Atualiza via webhook em tempo real</p>
                  ) : !src.connected ? (
                    <p className="text-red-400/70 text-[10px]">Não conectado</p>
                  ) : (
                    <p className="text-green-400/70 text-[10px]">Conectado</p>
                  )}
                  {src.status === 'error' && src.error && (
                    <p className="text-red-400 text-[10px]">{src.error}</p>
                  )}
                </div>
              </div>
              {statusIcon(src.status)}
            </div>
          ))}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm rounded-lg border border-border text-text-secondary hover:bg-bg-hover transition-colors cursor-pointer"
          >
            Fechar
          </button>
          <button
            onClick={handleSync}
            disabled={selected.size === 0 || anySyncing}
            className="flex-1 px-4 py-2 text-sm rounded-lg bg-brand-gold text-bg-base font-semibold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40"
          >
            {anySyncing ? 'Sincronizando...' : 'Sincronizar'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------- Goals Modal ---------- */

function GoalsModal({
  currentGoals, planGoals, daysInMonth, currentDay, onSave, onClose,
}: {
  currentGoals: Goals; planGoals: Goals
  daysInMonth: number; currentDay: number
  onSave: (g: Goals) => void; onClose: () => void
}) {
  // Store display strings (masked)
  const [receita, setReceita] = useState(() => numberToBRL(currentGoals?.meta_receita ?? 0))
  const [investimento, setInvestimento] = useState(() => numberToBRL(currentGoals?.meta_investimento ?? 0))
  const [roas, setRoas] = useState(() => { const v = currentGoals?.meta_roas ?? 0; return v > 0 ? String(v).replace('.', ',') : '' })
  const [ticket, setTicket] = useState(() => numberToBRL(currentGoals?.meta_ticket ?? 0))
  const [conversao, setConversao] = useState(() => numberToPct(currentGoals?.meta_conversao ?? 0))
  const [cps, setCps] = useState(() => numberToBRL(currentGoals?.meta_cps ?? 0))
  const [imported, setImported] = useState(false)

  const hasPlan = planGoals && (planGoals.meta_receita > 0 || planGoals.meta_investimento > 0)

  function importFromPlan() {
    if (!planGoals) return
    if (planGoals.meta_receita > 0) setReceita(numberToBRL(planGoals.meta_receita))
    if (planGoals.meta_investimento > 0) setInvestimento(numberToBRL(planGoals.meta_investimento))
    if (planGoals.meta_roas > 0) setRoas(String(planGoals.meta_roas).replace('.', ','))
    if (planGoals.meta_ticket > 0) setTicket(numberToBRL(planGoals.meta_ticket))
    if (planGoals.meta_conversao > 0) setConversao(numberToPct(planGoals.meta_conversao))
    if (planGoals.meta_cps > 0) setCps(numberToBRL(planGoals.meta_cps))
    setImported(true)
  }

  function handleSave() {
    onSave({
      meta_receita: unmaskBRL(receita),
      meta_investimento: unmaskBRL(investimento),
      meta_roas: unmaskPct(roas),
      meta_ticket: unmaskBRL(ticket),
      meta_conversao: unmaskPct(conversao),
      meta_cps: unmaskBRL(cps),
      days_in_month: daysInMonth,
      current_day: currentDay,
    })
  }

  type FieldDef = { label: string; value: string; onChange: (v: string) => void; placeholder: string; type: 'brl' | 'pct' | 'decimal'; planKey: keyof NonNullable<Goals> }
  const fields: FieldDef[] = [
    { label: 'Meta Receita', value: receita, onChange: v => setReceita(maskBRL(v)), placeholder: 'R$ 0,00', type: 'brl', planKey: 'meta_receita' },
    { label: 'Meta Investimento', value: investimento, onChange: v => setInvestimento(maskBRL(v)), placeholder: 'R$ 0,00', type: 'brl', planKey: 'meta_investimento' },
    { label: 'Meta ROAS', value: roas, onChange: v => setRoas(maskPct(v)), placeholder: '0,00x', type: 'decimal', planKey: 'meta_roas' },
    { label: 'Meta Ticket Médio', value: ticket, onChange: v => setTicket(maskBRL(v)), placeholder: 'R$ 0,00', type: 'brl', planKey: 'meta_ticket' },
    { label: 'Meta Taxa Conversão', value: conversao, onChange: v => setConversao(maskPct(v)), placeholder: '0,0%', type: 'pct', planKey: 'meta_conversao' },
    { label: 'Meta CPS', value: cps, onChange: v => setCps(maskBRL(v)), placeholder: 'R$ 0,00', type: 'brl', planKey: 'meta_cps' },
  ]

  const suffixLabel = (type: FieldDef['type']) => type === 'brl' ? 'R$' : type === 'pct' ? '%' : 'x'

  function isPlanValue(f: FieldDef): boolean {
    if (!imported || !planGoals) return false
    const planVal = Number(planGoals[f.planKey]) || 0
    if (planVal <= 0) return false
    const currentNum = f.type === 'brl' ? unmaskBRL(f.value) : unmaskPct(f.value)
    return Math.abs(currentNum - planVal) < 0.01
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-bg-card border border-border-gold rounded-xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="font-sans text-text-primary font-semibold text-lg mb-1">Definir Metas Mensais</h3>
        <p className="text-text-muted text-xs mb-4">As metas são salvas localmente no seu navegador, por mês.</p>

        {hasPlan && (
          <button
            onClick={importFromPlan}
            className="w-full px-3 py-2.5 text-xs rounded-lg border border-brand-gold/30 text-brand-gold hover:bg-brand-gold/10 transition-colors mb-4 cursor-pointer flex items-center justify-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Importar do Planejamento de Mídia
          </button>
        )}

        <div className="space-y-3">
          {fields.map(f => (
            <div key={f.label}>
              <label className="flex items-center gap-2 text-text-secondary text-xs font-medium mb-1.5">
                {f.label} <span className="text-text-muted/50">({suffixLabel(f.type)})</span>
                {isPlanValue(f) && (
                  <span className="text-brand-gold/60 text-[10px]">(do Mídia Plan)</span>
                )}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={f.value}
                onChange={e => f.onChange(e.target.value)}
                placeholder={f.placeholder}
                className="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-brand-gold/50"
              />
            </div>
          ))}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm rounded-lg border border-border text-text-secondary hover:bg-bg-hover transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 text-sm rounded-lg bg-brand-gold text-bg-base font-semibold hover:opacity-90 transition-opacity cursor-pointer"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------- Sub-components ---------- */

function KpiCard({
  label, value, current, previous, invertColor, source, goalLabel, pace,
}: {
  label: string; value: string; current: number; previous: number
  invertColor?: boolean; source?: string
  goalLabel?: string; pace?: { emoji: string; label: string; color: string } | null
}) {
  // Fix: don't show "↑ 100%" when comparison period has 0 data
  const bothHaveData = current > 0 && previous > 0
  let pct = 0
  let direction: 'up' | 'down' | 'neutral' = 'neutral'

  if (bothHaveData) {
    pct = ((current - previous) / previous) * 100
    direction = pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral'
  }

  const isPositive = invertColor ? direction === 'down' : direction === 'up'
  const isNegative = invertColor ? direction === 'up' : direction === 'down'
  const hasPace = pace && goalLabel

  return (
    <div className={`kpi-card ${hasPace ? 'pb-2' : ''}`}>
      <div className="flex items-start justify-between mb-1.5">
        <p className="text-text-muted text-[10px] font-medium tracking-wide uppercase truncate flex-1">{label}</p>
        {source && <span className="text-[8px] text-text-muted/40 ml-1 flex-shrink-0">{source}</span>}
      </div>
      <p className="font-data text-lg font-semibold text-text-primary leading-none mb-1.5">{value}</p>
      {bothHaveData && direction !== 'neutral' ? (
        <span className={`text-[11px] flex items-center gap-0.5 font-medium ${
          isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-text-muted'
        }`}>
          {direction === 'up' ? '\u2191' : '\u2193'} {Math.abs(pct).toFixed(1)}% vs anterior
        </span>
      ) : (
        <span className="text-[11px] text-text-muted/40">{current === 0 && previous === 0 ? '\u2014' : '\u2014'}</span>
      )}
      {hasPace && (
        <>
          <div className="border-t border-border/40 mt-2 pt-1.5">
            <p className="text-[9px] text-text-muted/60 mb-0.5">{goalLabel}</p>
            <p className={`text-[10px] font-medium ${pace.color}`}>
              {pace.emoji} {pace.label}
            </p>
          </div>
        </>
      )}
    </div>
  )
}

function GaugeCard({
  label, current, target, totalCurrent, totalTarget, projected, unit, invertProjection,
}: {
  label: string; current: number; target: number
  totalCurrent: number; totalTarget: number; projected: number; unit: string
  invertProjection?: boolean
}) {
  const pct = target > 0 ? Math.min(current / target, 1.5) : 0
  const totalPct = totalTarget > 0 ? Math.min(totalCurrent / totalTarget, 1) : 0

  const r = 55
  const circumference = Math.PI * r
  const offset = circumference * (1 - Math.min(pct, 1))
  const gaugeColor = pct >= 1 ? '#22c55e' : pct >= 0.7 ? '#ECA206' : '#ef4444'

  // For investment: under budget is good (green), over is bad (red)
  const projectionOnTrack = invertProjection
    ? projected <= totalTarget * 1.05
    : projected >= totalTarget
  const projectionDiff = Math.abs(projected - totalTarget)

  return (
    <div className="bg-bg-card border border-border-gold rounded-xl p-5 card-premium">
      <p className="text-text-muted text-xs font-medium tracking-wide uppercase mb-3 text-center">{label}</p>

      <div className="flex justify-center mb-3">
        <svg viewBox="0 0 130 75" className="w-full max-w-[180px]">
          <path d="M 10 65 A 55 55 0 0 1 120 65" fill="none" stroke="rgba(42,82,51,0.3)" strokeWidth="10" strokeLinecap="round" />
          <path d="M 10 65 A 55 55 0 0 1 120 65" fill="none" stroke={gaugeColor} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-700 ease-out" />
          <text x="65" y="50" textAnchor="middle" fill="white" fontSize="18" fontWeight="600" className="font-data">
            {(Math.min(pct, 1.5) * 100).toFixed(0)}%
          </text>
          <text x="65" y="66" textAnchor="middle" fill="#5a6b5e" fontSize="8">
            {unit} {fmtCompact(current)}/dia vs {unit} {fmtCompact(target)}/dia
          </text>
        </svg>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-[11px]">
          <span className="text-text-muted">Acumulado</span>
          <span className="font-data text-text-secondary">{fmtCurrency(totalCurrent, 0)} / {fmtCurrency(totalTarget, 0)}</span>
        </div>
        <div className="h-1.5 bg-bg-base rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${Math.min(totalPct * 100, 100)}%`, backgroundColor: gaugeColor }} />
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-text-muted">Projeção</span>
          <span className={`font-data font-medium ${projectionOnTrack ? 'text-green-400' : 'text-red-400'}`}>
            {fmtCurrency(projected, 0)}
            {projectionOnTrack
              ? ' \u2713'
              : ` (${invertProjection ? '+' : '-'}${fmtCurrency(projectionDiff, 0)})`
            }
          </span>
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-text-muted text-[10px] font-medium tracking-wide uppercase mb-1">{label}</p>
      <p className="font-data text-sm font-semibold text-text-primary">{value}</p>
    </div>
  )
}

function TargetIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  )
}

function ProjectionIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  )
}

function SyncIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

function InsightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6" /><path d="M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
    </svg>
  )
}

function fmtCurrency(v: number, decimals = 2) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }).format(v)
}

function fmtNumber(v: number) {
  return new Intl.NumberFormat('pt-BR').format(v)
}

function fmtCompact(v: number) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
  return v.toFixed(0)
}
