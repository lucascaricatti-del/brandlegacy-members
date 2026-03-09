'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getMediaPlanGoals } from '@/app/actions/media-plan'

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
    // Compare same N days of previous month
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

  // For all other periods: previous period of same length
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
    checkout_conversion: n(r.orders_captados) > 0 ? (n(r.orders_faturados) / n(r.orders_captados)) * 100 : 0,
    cancellation_rate: n(r.orders_captados) > 0 ? (n(r.orders_cancelled) / n(r.orders_captados)) * 100 : 0,
    total_sessions: totalSessions,
    ga4_organic: n(r.organic_sessions),
    ga4_paid: n(r.paid_sessions),
    conversion_rate: totalSessions > 0 ? (n(r.orders_faturados) / totalSessions) * 100 : 0,
    coupon_orders: n(r.coupon_orders),
    total_conversions: n(r.total_conversions),
    has_ga4: r.has_ga4,
    recurrence: n(r.recurrence),
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

  const [revenueGoal, setRevenueGoal] = useState(0)
  const [investmentGoal, setInvestmentGoal] = useState(0)
  const [showGoalsModal, setShowGoalsModal] = useState(false)
  const [tempRevenue, setTempRevenue] = useState('')
  const [tempInvestment, setTempInvestment] = useState('')
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [planError, setPlanError] = useState('')

  const [showSyncModal, setShowSyncModal] = useState(false)
  const [isStale, setIsStale] = useState(false)

  const fetchIdRef = useRef(0)

  useEffect(() => {
    const saved = localStorage.getItem('bl_performance_goals')
    if (saved) {
      try {
        const { revenue, investment } = JSON.parse(saved)
        setRevenueGoal(Number(revenue) || 0)
        setInvestmentGoal(Number(investment) || 0)
      } catch { /* ignore */ }
    }
    // Check stale
    const lastSync = localStorage.getItem(`bl_perf_last_sync_${workspaceId}`)
    if (lastSync) {
      const elapsed = Date.now() - Number(lastSync)
      if (elapsed > 10 * 60 * 1000) setIsStale(true)
    } else {
      setIsStale(true)
    }
  }, [workspaceId])

  const fetchMetrics = useCallback(async () => {
    const id = ++fetchIdRef.current
    setLoading(true)

    const range = getDateRange(period, appliedFrom, appliedTo)
    const compRange = getComparisonRange(period, range)

    const headers = { 'Content-Type': 'application/json' }
    const body = (r: { date_from: string; date_to: string }) =>
      JSON.stringify({ workspace_id: workspaceId, ...r })

    try {
      // Always fetch current + comparison in parallel
      // If period is not mes_atual, also fetch MTD separately
      const isMtd = period === 'mes_atual'
      const today = toDateStr(new Date())
      const mtdRange = { date_from: today.slice(0, 7) + '-01', date_to: today }

      const fetches: Promise<Response>[] = [
        fetch('/api/performance/metrics', { method: 'POST', headers, body: body(range) }),
        fetch('/api/performance/metrics', { method: 'POST', headers, body: body(compRange) }),
      ]
      if (!isMtd) {
        fetches.push(fetch('/api/performance/metrics', { method: 'POST', headers, body: body(mtdRange) }))
      }

      const responses = await Promise.all(fetches)
      const results = await Promise.all(responses.map(r => r.json()))

      if (id !== fetchIdRef.current) return // stale

      const currentData = results[0]
      const compData = results[1]
      const mtdData = isMtd ? results[0] : results[2]

      setCurrent(deriveMetrics(currentData.metrics ?? EMPTY_RAW))
      setPrevious(deriveMetrics(compData.metrics ?? EMPTY_RAW))
      setMtdMetrics(deriveMetrics(mtdData.metrics ?? EMPTY_RAW))
      setIntegrations(currentData.integrations ?? [])
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

  const openGoalsModal = () => {
    setTempRevenue(revenueGoal > 0 ? String(revenueGoal) : '')
    setTempInvestment(investmentGoal > 0 ? String(investmentGoal) : '')
    setPlanError('')
    setShowGoalsModal(true)
  }

  const saveGoals = () => {
    const r = Number(tempRevenue) || 0
    const i = Number(tempInvestment) || 0
    setRevenueGoal(r)
    setInvestmentGoal(i)
    localStorage.setItem('bl_performance_goals', JSON.stringify({ revenue: r, investment: i }))
    setShowGoalsModal(false)
  }

  async function fetchFromMediaPlan() {
    setLoadingPlan(true)
    setPlanError('')
    const now2 = new Date()
    const result = await getMediaPlanGoals(workspaceId, now2.getFullYear(), now2.getMonth() + 1)
    setLoadingPlan(false)
    if ('error' in result && result.error) { setPlanError(result.error); return }
    if ('revenueGoal' in result && result.revenueGoal) setTempRevenue(String(result.revenueGoal))
    if ('investmentGoal' in result && result.investmentGoal) setTempInvestment(String(result.investmentGoal))
  }

  // Gauges (always based on MTD)
  const dailyRevenueTarget = revenueGoal > 0 ? revenueGoal / daysInMonth : 0
  const dailyInvestmentTarget = investmentGoal > 0 ? investmentGoal / daysInMonth : 0
  const dailyRevenueAvg = currentDay > 0 ? mtdMetrics.receita_faturada / currentDay : 0
  const dailyInvestmentAvg = currentDay > 0 ? mtdMetrics.investimento_total / currentDay : 0
  const projectedRevenue = dailyRevenueAvg * daysInMonth
  const projectedInvestment = dailyInvestmentAvg * daysInMonth

  // KPI rows
  const kpiRows: { label: string; value: string; curr: number; prev: number; invertColor?: boolean; source?: string }[][] = [
    [
      { label: 'Receita Captada', value: fmtCurrency(current.receita_captada, 0), curr: current.receita_captada, prev: previous.receita_captada, source: 'Yampi' },
      { label: 'Receita Faturada', value: fmtCurrency(current.receita_faturada, 0), curr: current.receita_faturada, prev: previous.receita_faturada, source: 'Yampi' },
      { label: 'Taxa Aprovação', value: `${current.approval_rate.toFixed(1)}%`, curr: current.approval_rate, prev: previous.approval_rate, source: 'Calculado' },
      { label: 'Investimento', value: fmtCurrency(current.investimento_total, 0), curr: current.investimento_total, prev: previous.investimento_total, source: 'Meta+Google', invertColor: true },
      { label: 'ROAS', value: `${current.roas.toFixed(2)}x`, curr: current.roas, prev: previous.roas, source: 'Calculado' },
      { label: 'Ticket Médio', value: fmtCurrency(current.avg_ticket), curr: current.avg_ticket, prev: previous.avg_ticket, source: 'Calculado' },
    ],
    [
      { label: 'Pedidos Captados', value: fmtNumber(current.orders_captados), curr: current.orders_captados, prev: previous.orders_captados, source: 'Yampi' },
      { label: 'Pedidos Faturados', value: fmtNumber(current.orders_faturados), curr: current.orders_faturados, prev: previous.orders_faturados, source: 'Yampi' },
      { label: 'Aprovação PIX', value: `${current.pix_approval.toFixed(1)}%`, curr: current.pix_approval, prev: previous.pix_approval, source: 'Yampi' },
      { label: 'Conv. Checkout', value: `${current.checkout_conversion.toFixed(1)}%`, curr: current.checkout_conversion, prev: previous.checkout_conversion, source: 'Calculado' },
      { label: 'Pedidos c/ Cupom', value: fmtNumber(current.coupon_orders), curr: current.coupon_orders, prev: previous.coupon_orders, source: 'Yampi' },
      { label: 'Cancelamento', value: `${current.cancellation_rate.toFixed(1)}%`, curr: current.cancellation_rate, prev: previous.cancellation_rate, invertColor: true, source: 'Yampi' },
    ],
    [
      { label: current.has_ga4 ? 'Sessões (GA4)' : 'Sessões', value: fmtNumber(current.total_sessions), curr: current.total_sessions, prev: previous.total_sessions, source: current.has_ga4 ? 'GA4' : 'Shopify' },
      { label: 'Sessões Orgânicas', value: current.has_ga4 ? fmtNumber(current.ga4_organic) : '—', curr: current.ga4_organic, prev: previous.ga4_organic, source: 'GA4' },
      { label: 'Sessões Pagas', value: current.has_ga4 ? fmtNumber(current.ga4_paid) : '—', curr: current.ga4_paid, prev: previous.ga4_paid, source: 'GA4' },
      { label: 'Taxa Conversão', value: `${current.conversion_rate.toFixed(2)}%`, curr: current.conversion_rate, prev: previous.conversion_rate, source: 'Calculado' },
      { label: 'Recorrência', value: `${current.recurrence.toFixed(1)}%`, curr: current.recurrence, prev: previous.recurrence, source: 'Yampi' },
      { label: 'CAC', value: fmtCurrency(current.cac), curr: current.cac, prev: previous.cac, invertColor: true, source: 'Calculado' },
    ],
  ]

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
            onClick={openGoalsModal}
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="kpi-card animate-pulse">
              <div className="h-3 w-16 bg-bg-hover rounded mb-2" />
              <div className="h-5 w-20 bg-bg-hover rounded mb-1" />
              <div className="h-3 w-12 bg-bg-hover rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Gauge charts */}
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
            />
          )}
        </div>
      )}

      {/* KPI Grid */}
      {!loading && kpiRows.map((row, rowIdx) => (
        <div key={rowIdx} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {row.map((kpi, i) => (
            <KpiCardMtd
              key={i}
              label={kpi.label}
              value={kpi.value}
              current={kpi.curr}
              previous={kpi.prev}
              invertColor={kpi.invertColor}
              source={kpi.source}
            />
          ))}
        </div>
      ))}

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
            <MiniStat label="ROAS Projetado" value={projectedInvestment > 0 ? `${(projectedRevenue / projectedInvestment).toFixed(2)}x` : '—'} />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowGoalsModal(false)} />
          <div className="relative bg-bg-card border border-border-gold rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="font-sans text-text-primary font-semibold text-lg mb-1">Definir Metas Mensais</h3>
            <p className="text-text-muted text-xs mb-4">As metas são salvas localmente no seu navegador.</p>

            <button
              onClick={fetchFromMediaPlan}
              disabled={loadingPlan}
              className="w-full px-3 py-2 text-xs rounded-lg border border-brand-gold/30 text-brand-gold hover:bg-brand-gold/10 transition-colors disabled:opacity-50 mb-4 cursor-pointer"
            >
              {loadingPlan ? 'Buscando...' : 'Buscar do Planejamento de Mídia'}
            </button>
            {planError && <p className="text-red-400 text-xs mb-3">{planError}</p>}

            <div className="space-y-4">
              <div>
                <label className="block text-text-secondary text-xs font-medium mb-1.5">Meta de Receita Mensal (R$)</label>
                <input
                  type="number"
                  value={tempRevenue}
                  onChange={e => setTempRevenue(e.target.value)}
                  placeholder="Ex: 500000"
                  className="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-brand-gold/50"
                />
              </div>
              <div>
                <label className="block text-text-secondary text-xs font-medium mb-1.5">Meta de Investimento Mensal (R$)</label>
                <input
                  type="number"
                  value={tempInvestment}
                  onChange={e => setTempInvestment(e.target.value)}
                  placeholder="Ex: 50000"
                  className="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-brand-gold/50"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowGoalsModal(false)}
                className="flex-1 px-4 py-2 text-sm rounded-lg border border-border text-text-secondary hover:bg-bg-hover transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={saveGoals}
                className="flex-1 px-4 py-2 text-sm rounded-lg bg-brand-gold text-bg-base font-semibold hover:opacity-90 transition-opacity cursor-pointer"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
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

/* ---------- Sub-components ---------- */

function KpiCardMtd({
  label, value, current, previous, invertColor, source,
}: {
  label: string; value: string; current: number; previous: number; invertColor?: boolean; source?: string
}) {
  const hasVariation = previous > 0 || current > 0
  let pct = 0
  let direction: 'up' | 'down' | 'neutral' = 'neutral'

  if (hasVariation) {
    if (previous === 0 && current > 0) {
      pct = 100; direction = 'up'
    } else if (previous > 0) {
      pct = ((current - previous) / previous) * 100
      direction = pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral'
    }
  }

  const isPositive = invertColor ? direction === 'down' : direction === 'up'
  const isNegative = invertColor ? direction === 'up' : direction === 'down'

  return (
    <div className="kpi-card">
      <p className="text-text-muted text-[10px] font-medium tracking-wide uppercase mb-1.5 truncate">{label}</p>
      <p className="font-data text-lg font-semibold text-text-primary leading-none mb-1.5">{value}</p>
      <div className="flex items-center justify-between">
        {hasVariation && direction !== 'neutral' ? (
          <span className={`text-[11px] flex items-center gap-0.5 font-medium ${
            isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-text-muted'
          }`}>
            {direction === 'up' ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}%
          </span>
        ) : <span />}
        {source && <span className="text-[9px] text-text-muted/50">{source}</span>}
      </div>
    </div>
  )
}

function GaugeCard({
  label, current, target, totalCurrent, totalTarget, projected, unit,
}: {
  label: string; current: number; target: number
  totalCurrent: number; totalTarget: number; projected: number; unit: string
}) {
  const pct = target > 0 ? Math.min(current / target, 1.5) : 0
  const totalPct = totalTarget > 0 ? Math.min(totalCurrent / totalTarget, 1) : 0

  const r = 55
  const circumference = Math.PI * r
  const offset = circumference * (1 - Math.min(pct, 1))
  const gaugeColor = pct >= 1 ? '#22c55e' : pct >= 0.7 ? '#ECA206' : '#ef4444'

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
          <span className={`font-data font-medium ${projected >= totalTarget ? 'text-green-400' : 'text-red-400'}`}>
            {fmtCurrency(projected, 0)}
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
