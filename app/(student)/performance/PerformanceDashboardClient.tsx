'use client'

import { useState, useMemo, useEffect } from 'react'
import { getMediaPlanGoals } from '@/app/actions/media-plan'

type YampiOrder = {
  order_id: string; date: string; status: string; payment_method: string | null
  coupon_code: string | null; state: string | null; revenue: number; items: any[]
}
type AdsRow = {
  date: string; spend: number; impressions: number; clicks: number
  conversions: number; revenue: number; page_views?: number; outbound_clicks?: number
}
type ShopifyRow = { date: string; sessions: number; orders: number; revenue: number }

type Props = {
  workspaceId: string
  currentDay: number
  daysInMonth: number
  currentMonthLabel: string
  yampiOrders: YampiOrder[]
  metaAds: AdsRow[]
  googleAds: AdsRow[]
  shopifyMetrics: ShopifyRow[]
}

type Period = 'today' | 'yesterday' | '7d' | '14d' | '21d' | '30d' | 'mes_atual' | 'custom'
const PERIODS: { key: Period; label: string; days: number }[] = [
  { key: 'today', label: 'Hoje', days: 0 },
  { key: 'yesterday', label: 'Ontem', days: 1 },
  { key: '7d', label: '7 dias', days: 7 },
  { key: '14d', label: '14 dias', days: 14 },
  { key: '21d', label: '21 dias', days: 21 },
  { key: '30d', label: '30 dias', days: 30 },
  { key: 'mes_atual', label: 'Mês Atual', days: 0 },
  { key: 'custom', label: 'Personalizado', days: 0 },
]

const PAID = ['paid', 'invoiced', 'shipped', 'delivered']
const CANCELLED = ['cancelled', 'refused']

function normalize(d: string) { return d?.slice(0, 10) ?? '' }

function calcMetrics(orders: YampiOrder[], meta: AdsRow[], google: AdsRow[], shopify: ShopifyRow[]) {
  const paid = orders.filter(o => PAID.includes(o.status))
  const cancelled = orders.filter(o => CANCELLED.includes(o.status))
  const pix = orders.filter(o => (o.payment_method ?? '').toLowerCase() === 'pix')
  const pixPaid = pix.filter(o => PAID.includes(o.status))
  const coupon = paid.filter(o => !!o.coupon_code)

  const revenueCaptada = orders.reduce((s, o) => s + (Number(o.revenue) || 0), 0)
  const revenueFaturada = paid.reduce((s, o) => s + (Number(o.revenue) || 0), 0)
  const ordersCaptados = orders.length
  const ordersFaturados = paid.length
  const approvalRate = ordersCaptados > 0 ? (ordersFaturados / ordersCaptados) * 100 : 0
  const avgTicket = ordersFaturados > 0 ? revenueFaturada / ordersFaturados : 0
  const pixApproval = pix.length > 0 ? (pixPaid.length / pix.length) * 100 : 0
  const checkoutConversion = ordersCaptados > 0 ? (ordersFaturados / ordersCaptados) * 100 : 0
  const cancellationRate = ordersCaptados > 0 ? (cancelled.length / ordersCaptados) * 100 : 0

  const ads = [...meta, ...google]
  const totalSpend = ads.reduce((s, a) => s + (Number(a.spend) || 0), 0)
  const totalImpressions = ads.reduce((s, a) => s + (Number(a.impressions) || 0), 0)
  const totalConversions = ads.reduce((s, a) => s + (Number(a.conversions) || 0), 0)

  const roas = totalSpend > 0 ? revenueFaturada / totalSpend : 0
  const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0
  const cac = ordersFaturados > 0 ? totalSpend / ordersFaturados : 0

  const sessions = shopify.reduce((s, m) => s + (Number(m.sessions) || 0), 0)
  const cps = sessions > 0 ? totalSpend / sessions : 0
  const conversionRate = sessions > 0 ? (ordersFaturados / sessions) * 100 : 0

  return {
    revenueCaptada, revenueFaturada, approvalRate, totalSpend, roas, avgTicket,
    sessions, cps, cac, conversionRate, pixApproval, checkoutConversion,
    ordersCaptados, ordersFaturados, couponOrders: coupon.length,
    cancellationRate, cpm, totalConversions,
  }
}

type Metrics = ReturnType<typeof calcMetrics>

export default function PerformanceDashboardClient(props: Props) {
  const {
    workspaceId, currentDay, daysInMonth, currentMonthLabel,
    yampiOrders, metaAds, googleAds, shopifyMetrics,
  } = props

  const [period, setPeriod] = useState<Period>('mes_atual')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [appliedFrom, setAppliedFrom] = useState('')
  const [appliedTo, setAppliedTo] = useState('')

  const [revenueGoal, setRevenueGoal] = useState(0)
  const [investmentGoal, setInvestmentGoal] = useState(0)
  const [showGoalsModal, setShowGoalsModal] = useState(false)
  const [tempRevenue, setTempRevenue] = useState('')
  const [tempInvestment, setTempInvestment] = useState('')
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [planError, setPlanError] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('bl_performance_goals')
    if (saved) {
      try {
        const { revenue, investment } = JSON.parse(saved)
        setRevenueGoal(Number(revenue) || 0)
        setInvestmentGoal(Number(investment) || 0)
      } catch { /* ignore */ }
    }
  }, [])

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
    const now = new Date()
    const result = await getMediaPlanGoals(workspaceId, now.getFullYear(), now.getMonth() + 1)
    setLoadingPlan(false)
    if ('error' in result && result.error) {
      setPlanError(result.error)
      return
    }
    if ('revenueGoal' in result && result.revenueGoal) setTempRevenue(String(result.revenueGoal))
    if ('investmentGoal' in result && result.investmentGoal) setTempInvestment(String(result.investmentGoal))
  }

  function filterByPeriod<T extends { date: string }>(data: T[]): T[] {
    const today = new Date().toLocaleDateString('sv-SE')
    if (period === 'today') return data.filter(m => normalize(m.date) === today)
    if (period === 'yesterday') {
      const y = new Date(); y.setDate(y.getDate() - 1)
      return data.filter(m => normalize(m.date) === y.toLocaleDateString('sv-SE'))
    }
    if (period === 'mes_atual') {
      const firstDay = today.slice(0, 7) + '-01'
      return data.filter(m => normalize(m.date) >= firstDay && normalize(m.date) <= today)
    }
    if (period === 'custom' && appliedFrom && appliedTo) {
      return data.filter(m => normalize(m.date) >= appliedFrom && normalize(m.date) <= appliedTo)
    }
    const days = PERIODS.find(p => p.key === period)?.days ?? 30
    const since = new Date(); since.setDate(since.getDate() - days)
    const sinceStr = since.toLocaleDateString('sv-SE')
    return data.filter(m => normalize(m.date) >= sinceStr && normalize(m.date) <= today)
  }

  const filteredYampi = useMemo(() => filterByPeriod(yampiOrders), [yampiOrders, period, appliedFrom, appliedTo])
  const filteredMeta = useMemo(() => filterByPeriod(metaAds), [metaAds, period, appliedFrom, appliedTo])
  const filteredGoogle = useMemo(() => filterByPeriod(googleAds), [googleAds, period, appliedFrom, appliedTo])
  const filteredShopify = useMemo(() => filterByPeriod(shopifyMetrics), [shopifyMetrics, period, appliedFrom, appliedTo])

  const current = useMemo(() =>
    calcMetrics(filteredYampi, filteredMeta, filteredGoogle, filteredShopify),
    [filteredYampi, filteredMeta, filteredGoogle, filteredShopify])

  // MTD — always compute for the MTD section
  const todayStr = new Date().toLocaleDateString('sv-SE')
  const mtdStart = todayStr.slice(0, 7) + '-01'
  const mtdYampi = useMemo(() => yampiOrders.filter(o => normalize(o.date) >= mtdStart && normalize(o.date) <= todayStr), [yampiOrders, mtdStart, todayStr])
  const mtdMeta = useMemo(() => metaAds.filter(m => normalize(m.date) >= mtdStart && normalize(m.date) <= todayStr), [metaAds, mtdStart, todayStr])
  const mtdGoogle = useMemo(() => googleAds.filter(m => normalize(m.date) >= mtdStart && normalize(m.date) <= todayStr), [googleAds, mtdStart, todayStr])
  const mtdShopify = useMemo(() => shopifyMetrics.filter(m => normalize(m.date) >= mtdStart && normalize(m.date) <= todayStr), [shopifyMetrics, mtdStart, todayStr])
  const mtdMetrics = useMemo(() => calcMetrics(mtdYampi, mtdMeta, mtdGoogle, mtdShopify), [mtdYampi, mtdMeta, mtdGoogle, mtdShopify])

  // Prev month same-period comparison
  const today2 = new Date()
  const prevMonthDate = new Date(today2.getFullYear(), today2.getMonth() - 1, 1)
  const prevMonthStart = prevMonthDate.toLocaleDateString('sv-SE')
  const daysInPrevMonth = new Date(today2.getFullYear(), today2.getMonth(), 0).getDate()
  const prevMonthSameDay = new Date(today2.getFullYear(), today2.getMonth() - 1, Math.min(currentDay, daysInPrevMonth)).toLocaleDateString('sv-SE')
  const prevMonthLabel = prevMonthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const prevYampi = useMemo(() => yampiOrders.filter(o => normalize(o.date) >= prevMonthStart && normalize(o.date) <= prevMonthSameDay), [yampiOrders, prevMonthStart, prevMonthSameDay])
  const prevMeta = useMemo(() => metaAds.filter(m => normalize(m.date) >= prevMonthStart && normalize(m.date) <= prevMonthSameDay), [metaAds, prevMonthStart, prevMonthSameDay])
  const prevGoogle = useMemo(() => googleAds.filter(m => normalize(m.date) >= prevMonthStart && normalize(m.date) <= prevMonthSameDay), [googleAds, prevMonthStart, prevMonthSameDay])
  const prevShopify = useMemo(() => shopifyMetrics.filter(m => normalize(m.date) >= prevMonthStart && normalize(m.date) <= prevMonthSameDay), [shopifyMetrics, prevMonthStart, prevMonthSameDay])
  const previous = useMemo(() => calcMetrics(prevYampi, prevMeta, prevGoogle, prevShopify), [prevYampi, prevMeta, prevGoogle, prevShopify])

  // Daily targets for gauges (always based on MTD)
  const dailyRevenueTarget = revenueGoal > 0 ? revenueGoal / daysInMonth : 0
  const dailyInvestmentTarget = investmentGoal > 0 ? investmentGoal / daysInMonth : 0
  const dailyRevenueAvg = currentDay > 0 ? mtdMetrics.revenueFaturada / currentDay : 0
  const dailyInvestmentAvg = currentDay > 0 ? mtdMetrics.totalSpend / currentDay : 0
  const projectedRevenue = dailyRevenueAvg * daysInMonth
  const projectedInvestment = dailyInvestmentAvg * daysInMonth

  const kpiRows: { label: string; value: string; prev: number; curr: number; invertColor?: boolean }[][] = [
    [
      { label: 'Receita Captada', value: fmtCurrency(current.revenueCaptada, 0), curr: current.revenueCaptada, prev: previous.revenueCaptada },
      { label: 'Receita Faturada', value: fmtCurrency(current.revenueFaturada, 0), curr: current.revenueFaturada, prev: previous.revenueFaturada },
      { label: 'Taxa Aprovação', value: `${current.approvalRate.toFixed(1)}%`, curr: current.approvalRate, prev: previous.approvalRate },
      { label: 'Investimento', value: fmtCurrency(current.totalSpend, 0), curr: current.totalSpend, prev: previous.totalSpend },
      { label: 'ROAS', value: `${current.roas.toFixed(2)}x`, curr: current.roas, prev: previous.roas },
      { label: 'Ticket Médio', value: fmtCurrency(current.avgTicket), curr: current.avgTicket, prev: previous.avgTicket },
    ],
    [
      { label: 'Conversões Ads', value: fmtNumber(current.totalConversions), curr: current.totalConversions, prev: previous.totalConversions },
      { label: 'CAC', value: fmtCurrency(current.cac), curr: current.cac, prev: previous.cac, invertColor: true },
      { label: 'CPM', value: fmtCurrency(current.cpm), curr: current.cpm, prev: previous.cpm, invertColor: true },
      { label: 'Sessões', value: fmtNumber(current.sessions), curr: current.sessions, prev: previous.sessions },
      { label: 'CPS', value: fmtCurrency(current.cps), curr: current.cps, prev: previous.cps, invertColor: true },
      { label: 'Taxa Conversão', value: `${current.conversionRate.toFixed(2)}%`, curr: current.conversionRate, prev: previous.conversionRate },
    ],
    [
      { label: 'Pedidos Captados', value: fmtNumber(current.ordersCaptados), curr: current.ordersCaptados, prev: previous.ordersCaptados },
      { label: 'Pedidos Faturados', value: fmtNumber(current.ordersFaturados), curr: current.ordersFaturados, prev: previous.ordersFaturados },
      { label: 'Aprovação PIX', value: `${current.pixApproval.toFixed(1)}%`, curr: current.pixApproval, prev: previous.pixApproval },
      { label: 'Conv. Checkout', value: `${current.checkoutConversion.toFixed(1)}%`, curr: current.checkoutConversion, prev: previous.checkoutConversion },
      { label: 'Pedidos c/ Cupom', value: fmtNumber(current.couponOrders), curr: current.couponOrders, prev: previous.couponOrders },
      { label: 'Cancelamento', value: `${current.cancellationRate.toFixed(1)}%`, curr: current.cancellationRate, prev: previous.cancellationRate, invertColor: true },
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

      {/* Gauge charts */}
      {(revenueGoal > 0 || investmentGoal > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {revenueGoal > 0 && (
            <GaugeCard
              label="Meta de Receita Diária"
              current={dailyRevenueAvg}
              target={dailyRevenueTarget}
              totalCurrent={mtdMetrics.revenueFaturada}
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
              totalCurrent={mtdMetrics.totalSpend}
              totalTarget={investmentGoal}
              projected={projectedInvestment}
              unit="R$"
            />
          )}
        </div>
      )}

      {/* KPI Grid */}
      {kpiRows.map((row, rowIdx) => (
        <div key={rowIdx} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {row.map((kpi, i) => (
            <KpiCardMtd
              key={i}
              label={kpi.label}
              value={kpi.value}
              current={kpi.curr}
              previous={kpi.prev}
              invertColor={kpi.invertColor}
            />
          ))}
        </div>
      ))}

      {/* Projected summary */}
      {(revenueGoal > 0 || mtdMetrics.revenueFaturada > 0) && (
        <div className="bg-bg-card border border-border-gold rounded-xl p-5 card-premium">
          <h3 className="font-sans text-text-primary font-semibold text-sm mb-4 flex items-center gap-2">
            <ProjectionIcon />
            Projeção para fim do mês
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MiniStat label="Receita Projetada" value={fmtCurrency(projectedRevenue, 0)} />
            <MiniStat label="Investimento Projetado" value={fmtCurrency(projectedInvestment, 0)} />
            <MiniStat label="ROAS Projetado" value={projectedInvestment > 0 ? `${(projectedRevenue / projectedInvestment).toFixed(2)}x` : '—'} />
            <MiniStat label="Pedidos Projetados" value={fmtNumber(Math.round((mtdMetrics.ordersFaturados / Math.max(currentDay, 1)) * daysInMonth))} />
          </div>
        </div>
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

function KpiCardMtd({
  label, value, current, previous, invertColor,
}: {
  label: string; value: string; current: number; previous: number; invertColor?: boolean
}) {
  const hasVariation = previous > 0 || current > 0
  let pct = 0
  let direction: 'up' | 'down' | 'neutral' = 'neutral'

  if (hasVariation) {
    if (previous === 0 && current > 0) {
      pct = 100
      direction = 'up'
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
      {hasVariation && direction !== 'neutral' && (
        <span className={`text-[11px] flex items-center gap-0.5 font-medium ${
          isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-text-muted'
        }`}>
          {direction === 'up' ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}%
        </span>
      )}
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
