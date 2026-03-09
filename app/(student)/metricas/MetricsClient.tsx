'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import InfluencersTab from './InfluencersTab'

type AdsRow = {
  id: string; date: string; campaign_id: string; campaign_name: string;
  spend: number; impressions: number; clicks: number; conversions: number;
  revenue: number; cpm: number; cpc: number; ctr: number; roas: number;
  page_views?: number; outbound_clicks?: number; add_to_cart?: number;
  initiate_checkout?: number; add_payment_info?: number;
}

type EcomRow = {
  id?: string; date: string; revenue: number; orders: number;
  items_sold: number; avg_ticket: number; sessions: number; conversion_rate: number;
}

type YampiMetricRow = {
  date: string; revenue: number; orders: number; avg_ticket: number;
  checkout_conversion: number; pix_approval_rate: number; cancellation_rate: number;
}

type YampiOrderRow = {
  order_id: string; date: string; status: string; payment_method: string | null;
  coupon_code: string | null; state: string | null; revenue: number;
  items: { product_id: string; name: string; quantity: number; price: number }[];
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

type Tab = 'meta' | 'google' | 'yampi' | 'influenciadores'

function normalize(d: string) { return d?.slice(0, 10) ?? '' }
function toDateStr(d: Date) {
  const brazil = new Date(d.getTime() - 3 * 60 * 60 * 1000)
  return brazil.toISOString().slice(0, 10)
}

/* ── SVG Icons ── */
function MetaIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M12 2.04C6.5 2.04 2 6.53 2 12.06C2 17.06 5.66 21.21 10.44 21.96V14.96H7.9V12.06H10.44V9.85C10.44 7.34 11.93 5.96 14.22 5.96C15.31 5.96 16.45 6.15 16.45 6.15V8.62H15.19C13.95 8.62 13.56 9.39 13.56 10.18V12.06H16.34L15.89 14.96H13.56V21.96C18.34 21.21 22 17.06 22 12.06C22 6.53 17.5 2.04 12 2.04Z"/>
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function ShopifyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M15.34 3.03c-.04 0-.08.03-.12.03-.04 0-.48.12-.48.12s-.64-.64-.72-.72a.5.5 0 0 0-.36-.12h-.04c-.04-.04-.12-.12-.2-.16-.52-.52-1.2-.76-2.04-.72-.04 0-.12 0-.16.04A2.67 2.67 0 0 0 9.7 0c-1.52.2-2.28 1.88-2.52 2.84l-1.76.56c0 .04-.84.88-.84 3.16 0 5.36 3.6 11.4 3.6 11.4l6.04-2.08S15.5 3.35 15.5 3.15c0-.08-.08-.12-.16-.12z" fill="#95BF47"/>
    </svg>
  )
}

function SparklesIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M10 1l2.39 5.75L18 9.27l-4.55 3.56L14.76 19 10 15.67 5.24 19l1.31-6.17L2 9.27l5.61-2.52L10 1z"/>
    </svg>
  )
}

function LoadingSpinner() {
  return (
    <svg className="w-4 h-4 animate-spin-slow" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="10" cy="10" r="8" strokeOpacity="0.3" />
      <path d="M10 2a8 8 0 0 1 8 8" strokeLinecap="round" />
    </svg>
  )
}

export default function MetricsClient({
  workspaceId, isMetaConnected, isGoogleConnected, isShopifyConnected, isYampiConnected,
  metaMetrics, googleMetrics, shopifyMetrics, yampiMetrics, yampiOrders,
  initialTab,
}: {
  workspaceId: string
  isMetaConnected: boolean
  isGoogleConnected: boolean
  isShopifyConnected: boolean
  isYampiConnected: boolean
  metaMetrics: AdsRow[]
  googleMetrics: AdsRow[]
  shopifyMetrics: EcomRow[]
  yampiMetrics: YampiMetricRow[]
  yampiOrders: YampiOrderRow[]
  initialTab?: Tab
}) {
  const searchParams = useSearchParams()
  const urlTab = searchParams.get('tab') as Tab | null
  const resolvedInitial = urlTab ?? initialTab ?? 'meta'
  const forcedTab = urlTab ?? initialTab // when coming from sidebar submenu (e.g. ?tab=meta)
  const [activeTab, setActiveTab] = useState<Tab>(resolvedInitial)
  const [period, setPeriod] = useState<Period>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [appliedFrom, setAppliedFrom] = useState('')
  const [appliedTo, setAppliedTo] = useState('')

  const [metaSyncing, setMetaSyncing] = useState(false)
  const [metaSyncMsg, setMetaSyncMsg] = useState('')
  const [googleSyncing, setGoogleSyncing] = useState(false)
  const [googleSyncMsg, setGoogleSyncMsg] = useState('')
  const [shopifySyncing, setShopifySyncing] = useState(false)
  const [shopifySyncMsg, setShopifySyncMsg] = useState('')
  const [yampiSyncing, setYampiSyncing] = useState(false)
  const [yampiSyncMsg, setYampiSyncMsg] = useState('')

  // Sync activeTab when URL ?tab= changes (e.g. sidebar navigation)
  useEffect(() => {
    if (urlTab && (urlTab === 'meta' || urlTab === 'google' || urlTab === 'yampi' || urlTab === 'influenciadores')) {
      setActiveTab(urlTab)
    }
  }, [urlTab])

  const [reportLoading, setReportLoading] = useState(false)
  const [reportMarkdown, setReportMarkdown] = useState('')

  // Campaign table sort state
  type CampSortKey = 'name' | 'spend' | 'revenue' | 'roas' | 'conversions' | 'cpr' | 'ctr' | 'cpc'
  const [campSortKey, setCampSortKey] = useState<CampSortKey>('roas')
  const [campSortAsc, setCampSortAsc] = useState(false)

  function toggleCampSort(key: CampSortKey) {
    if (campSortKey === key) setCampSortAsc(!campSortAsc)
    else { setCampSortKey(key); setCampSortAsc(false) }
  }

  const isAdsTab = activeTab === 'meta' || activeTab === 'google'
  const isInfluencersTab = activeTab === 'influenciadores'
  const isConnected = activeTab === 'meta' ? isMetaConnected : activeTab === 'google' ? isGoogleConnected : activeTab === 'influenciadores' ? isYampiConnected : isYampiConnected
  const syncing = activeTab === 'meta' ? metaSyncing : activeTab === 'google' ? googleSyncing : yampiSyncing
  const syncMsg = activeTab === 'meta' ? metaSyncMsg : activeTab === 'google' ? googleSyncMsg : yampiSyncMsg

  // ── Period filter helper ──
  function filterByPeriod<T extends { date: string }>(data: T[]): T[] {
    const today = toDateStr(new Date())
    if (period === 'today') return data.filter(m => normalize(m.date) === today)
    if (period === 'yesterday') {
      const y = new Date(); y.setDate(y.getDate() - 1)
      return data.filter(m => normalize(m.date) === toDateStr(y))
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
    const sinceStr = toDateStr(since)
    return data.filter(m => normalize(m.date) >= sinceStr && normalize(m.date) <= today)
  }

  // ── Ads data (Meta/Google) ──
  const adsMetrics = activeTab === 'meta' ? metaMetrics : googleMetrics
  const filteredAds = useMemo(() => filterByPeriod(adsMetrics), [adsMetrics, period, appliedFrom, appliedTo, activeTab])

  const dailyData = useMemo(() => {
    const map = new Map<string, { date: string; spend: number; revenue: number; impressions: number; clicks: number; conversions: number }>()
    for (const m of filteredAds) {
      const existing = map.get(m.date) ?? { date: m.date, spend: 0, revenue: 0, impressions: 0, clicks: 0, conversions: 0 }
      existing.spend += Number(m.spend) || 0
      existing.revenue += Number(m.revenue) || 0
      existing.impressions += Number(m.impressions) || 0
      existing.clicks += Number(m.clicks) || 0
      existing.conversions += Number(m.conversions) || 0
      map.set(m.date, existing)
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [filteredAds])

  const campaignData = useMemo(() => {
    const map = new Map<string, { name: string; spend: number; revenue: number; impressions: number; clicks: number; conversions: number; outbound_clicks: number }>()
    for (const m of filteredAds) {
      const existing = map.get(m.campaign_id) ?? { name: m.campaign_name, spend: 0, revenue: 0, impressions: 0, clicks: 0, conversions: 0, outbound_clicks: 0 }
      existing.spend += Number(m.spend) || 0
      existing.revenue += Number(m.revenue) || 0
      existing.impressions += Number(m.impressions) || 0
      existing.clicks += Number(m.clicks) || 0
      existing.conversions += Number(m.conversions) || 0
      existing.outbound_clicks += Number(m.outbound_clicks) || 0
      map.set(m.campaign_id, existing)
    }
    return Array.from(map.values()).sort((a, b) => b.spend - a.spend)
  }, [filteredAds])

  const totals = useMemo(() => {
    const spend = dailyData.reduce((s, d) => s + d.spend, 0)
    const revenue = dailyData.reduce((s, d) => s + d.revenue, 0)
    const impressions = dailyData.reduce((s, d) => s + d.impressions, 0)
    const clicks = dailyData.reduce((s, d) => s + d.clicks, 0)
    const conversions = dailyData.reduce((s, d) => s + d.conversions, 0)
    const page_views = filteredAds.reduce((s, m) => s + (Number(m.page_views) || 0), 0)
    const outbound_clicks = filteredAds.reduce((s, m) => s + (Number(m.outbound_clicks) || 0), 0)
    const initiate_checkout = filteredAds.reduce((s, m) => s + (Number(m.initiate_checkout) || 0), 0)
    const add_payment_info = filteredAds.reduce((s, m) => s + (Number(m.add_payment_info) || 0), 0)
    const roas = spend > 0 ? revenue / spend : 0
    const cpa = conversions > 0 ? spend / conversions : 0
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
    const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0
    const cpc = outbound_clicks > 0 ? spend / outbound_clicks : 0
    const cps = page_views > 0 ? spend / page_views : 0
    const connect_rate = outbound_clicks > 0 ? (page_views / outbound_clicks) * 100 : 0
    const conversion_rate = page_views > 0 ? (conversions / page_views) * 100 : 0
    const google_cpc = clicks > 0 ? spend / clicks : 0
    const google_conversion_rate = clicks > 0 ? (conversions / clicks) * 100 : 0
    return { spend, revenue, impressions, clicks, conversions, roas, cpa, ctr, cpm, cpc, cps, connect_rate, conversion_rate, page_views, outbound_clicks, initiate_checkout, add_payment_info, google_cpc, google_conversion_rate }
  }, [dailyData, filteredAds])

  // Funnel — 5 steps (Meta only)
  const funnel = useMemo(() => {
    if (activeTab !== 'meta') return null
    const { outbound_clicks, page_views, initiate_checkout, add_payment_info, conversions, spend } = totals
    if (outbound_clicks === 0 && page_views === 0 && initiate_checkout === 0 && add_payment_info === 0 && conversions === 0) return null
    const steps = [
      { label: 'Cliques no Link', value: outbound_clicks, cost: outbound_clicks > 0 ? spend / outbound_clicks : 0, costLabel: 'CPC' },
      { label: 'Visualização da Página', value: page_views, cost: page_views > 0 ? spend / page_views : 0, costLabel: 'CPS' },
      { label: 'Checkout', value: initiate_checkout, cost: initiate_checkout > 0 ? spend / initiate_checkout : 0, costLabel: 'Custo/Checkout' },
      { label: 'Pagamento', value: add_payment_info, cost: add_payment_info > 0 ? spend / add_payment_info : 0, costLabel: 'Custo/Pgto' },
      { label: 'Compra', value: conversions, cost: conversions > 0 ? spend / conversions : 0, costLabel: 'CPA' },
    ]
    let maxDropIdx = -1
    let maxDrop = 0
    for (let i = 0; i < steps.length - 1; i++) {
      if (steps[i].value > 0) {
        const dropPct = 1 - (steps[i + 1].value / steps[i].value)
        if (dropPct > maxDrop) { maxDrop = dropPct; maxDropIdx = i + 1 }
      }
    }
    return { steps, maxDropIdx }
  }, [totals, activeTab])

  // ── Shopify data ──
  const filteredShopify = useMemo(() => filterByPeriod(shopifyMetrics), [shopifyMetrics, period, appliedFrom, appliedTo, activeTab])

  const shopifyTotals = useMemo(() => {
    const revenue = filteredShopify.reduce((s, m) => s + (Number(m.revenue) || 0), 0)
    const orders = filteredShopify.reduce((s, m) => s + (Number(m.orders) || 0), 0)
    const items_sold = filteredShopify.reduce((s, m) => s + (Number(m.items_sold) || 0), 0)
    const sessions = filteredShopify.reduce((s, m) => s + (Number(m.sessions) || 0), 0)
    const avg_ticket = orders > 0 ? revenue / orders : 0
    const conversion_rate = sessions > 0 ? (orders / sessions) * 100 : 0
    return { revenue, orders, items_sold, avg_ticket, sessions, conversion_rate }
  }, [filteredShopify])

  const shopifyDaily = useMemo(() => {
    return filteredShopify
      .map(m => ({ date: m.date, revenue: Number(m.revenue) || 0, orders: Number(m.orders) || 0 }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [filteredShopify])

  // ── Yampi data ──
  const filteredYampiMetrics = useMemo(() => filterByPeriod(yampiMetrics), [yampiMetrics, period, appliedFrom, appliedTo, activeTab])
  const filteredYampiOrders = useMemo(() => filterByPeriod(yampiOrders), [yampiOrders, period, appliedFrom, appliedTo, activeTab])

  const yampiTotals = useMemo(() => {
    // Use pre-aggregated yampi_metrics instead of recalculating from raw orders
    const revenue = filteredYampiMetrics.reduce((s, m) => s + (Number(m.revenue) || 0), 0)
    const orders = filteredYampiMetrics.reduce((s, m) => s + (Number(m.orders) || 0), 0)
    const avg_ticket = orders > 0 ? revenue / orders : 0

    // Weighted averages for rate metrics
    const totalDays = filteredYampiMetrics.length
    const checkout_conversion = totalDays > 0
      ? Math.round(filteredYampiMetrics.reduce((s, m) => s + (Number(m.checkout_conversion) || 0), 0) / totalDays * 100) / 100
      : 0
    const pix_approval_rate = totalDays > 0
      ? Math.round(filteredYampiMetrics.reduce((s, m) => s + (Number(m.pix_approval_rate) || 0), 0) / totalDays * 100) / 100
      : 0
    const cancellation_rate = totalDays > 0
      ? Math.round(filteredYampiMetrics.reduce((s, m) => s + (Number(m.cancellation_rate) || 0), 0) / totalDays * 100) / 100
      : 0
    return { revenue, orders, avg_ticket, checkout_conversion, pix_approval_rate, cancellation_rate }
  }, [filteredYampiMetrics])

  const yampiDaily = useMemo(() => {
    const PAID = ['paid', 'invoiced', 'shipped', 'delivered']
    const map = new Map<string, number>()
    for (const o of filteredYampiOrders) {
      if (!PAID.includes(o.status)) continue
      const rev = map.get(o.date) ?? 0
      map.set(o.date, rev + (Number(o.revenue) || 0))
    }
    return Array.from(map.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [filteredYampiOrders])

  const yampiTopProducts = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number; revenue: number }>()
    for (const order of filteredYampiOrders) {
      if (order.status !== 'paid' && order.status !== 'invoiced' && order.status !== 'shipped' && order.status !== 'delivered') continue
      for (const item of order.items || []) {
        const key = item.product_id || item.name
        const existing = map.get(key) ?? { name: item.name, quantity: 0, revenue: 0 }
        existing.quantity += item.quantity
        existing.revenue += item.price * item.quantity
        map.set(key, existing)
      }
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5)
  }, [filteredYampiOrders])

  const yampiByState = useMemo(() => {
    const map = new Map<string, { orders: number; revenue: number }>()
    for (const order of filteredYampiOrders) {
      if (order.status !== 'paid' && order.status !== 'invoiced' && order.status !== 'shipped' && order.status !== 'delivered') continue
      const state = order.state || 'N/A'
      const existing = map.get(state) ?? { orders: 0, revenue: 0 }
      existing.orders++
      existing.revenue += order.revenue
      map.set(state, existing)
    }
    return Array.from(map.entries()).map(([state, d]) => ({ state, ...d })).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
  }, [filteredYampiOrders])

  const yampiByPayment = useMemo(() => {
    const map = new Map<string, { orders: number; revenue: number }>()
    let totalOrders = 0
    for (const order of filteredYampiOrders) {
      if (order.status !== 'paid' && order.status !== 'invoiced' && order.status !== 'shipped' && order.status !== 'delivered') continue
      const pm = (order.payment_method ?? '').toLowerCase()
      const method = pm === 'pix' ? 'PIX' : pm === 'credit_card' ? 'Cartão' : pm === 'boleto' ? 'Boleto' : pm === 'debit_card' ? 'Débito' : (order.payment_method || 'Outro')
      const existing = map.get(method) ?? { orders: 0, revenue: 0 }
      existing.orders++
      existing.revenue += order.revenue
      map.set(method, existing)
      totalOrders++
    }
    return Array.from(map.entries()).map(([method, d]) => ({ method, ...d, pct: totalOrders > 0 ? (d.orders / totalOrders) * 100 : 0 })).sort((a, b) => b.revenue - a.revenue)
  }, [filteredYampiOrders])

  // ── Handlers ──
  const handleSync = async () => {
    const dateFrom = toDateStr(new Date(Date.now() - 180 * 86400000))
    const dateTo = toDateStr(new Date())

    if (activeTab === 'meta') {
      setMetaSyncing(true); setMetaSyncMsg('')
      try {
        const res = await fetch('/api/integrations/meta/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace_id: workspaceId, date_from: dateFrom, date_to: dateTo }) })
        const data = await res.json()
        if (data.error) setMetaSyncMsg(`Erro: ${data.error}`)
        else { setMetaSyncMsg(`${data.synced} registros sincronizados. Recarregando...`); window.location.reload(); return }
      } catch { setMetaSyncMsg('Erro ao sincronizar.') }
      setMetaSyncing(false)
    } else if (activeTab === 'google') {
      setGoogleSyncing(true); setGoogleSyncMsg('')
      try {
        const res = await fetch('/api/integrations/google-ads/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace_id: workspaceId, date_from: dateFrom, date_to: dateTo }) })
        const data = await res.json()
        if (data.error) setGoogleSyncMsg(`Erro: ${data.error}`)
        else { setGoogleSyncMsg(`${data.synced} registros sincronizados. Recarregando...`); window.location.reload(); return }
      } catch { setGoogleSyncMsg('Erro ao sincronizar.') }
      setGoogleSyncing(false)
    } else if (activeTab === 'yampi') {
      setYampiSyncing(true); setYampiSyncMsg('')
      try {
        const res = await fetch('/api/integrations/yampi/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace_id: workspaceId, date_from: dateFrom, date_to: dateTo }) })
        const data = await res.json()
        if (data.error) setYampiSyncMsg(`Erro: ${data.error}`)
        else { setYampiSyncMsg(`${data.synced} dias sincronizados. Recarregando...`); window.location.reload(); return }
      } catch { setYampiSyncMsg('Erro ao sincronizar.') }
      setYampiSyncing(false)
    }
  }

  const handleReport = async () => {
    setReportLoading(true); setReportMarkdown('')
    try {
      const res = await fetch('/api/metricas/relatorio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totals,
          funnel: funnel?.steps ?? [],
          campaigns: campaignData.slice(0, 15).map(c => {
            const cpc = activeTab === 'meta'
              ? (c.outbound_clicks > 0 ? c.spend / c.outbound_clicks : 0)
              : (c.clicks > 0 ? c.spend / c.clicks : 0)
            return { name: c.name, spend: c.spend, revenue: c.revenue, roas: c.spend > 0 ? c.revenue / c.spend : 0, cpa: c.conversions > 0 ? c.spend / c.conversions : 0, cpc, conversions: c.conversions }
          }),
          period: PERIODS.find(p => p.key === period)?.label ?? period,
        }),
      })
      const data = await res.json()
      if (data.error) setReportMarkdown(`**Erro:** ${data.error}`)
      else setReportMarkdown(data.report)
    } catch { setReportMarkdown('**Erro ao gerar relatório.**') }
    setReportLoading(false)
  }

  // ── Tab config ──
  const TABS: { key: Tab; label: string; icon: React.ReactNode; connected: boolean }[] = [
    { key: 'meta', label: 'Meta Ads', icon: <MetaIcon />, connected: isMetaConnected },
    { key: 'google', label: 'Google Ads', icon: <GoogleIcon />, connected: isGoogleConnected },
    { key: 'yampi', label: 'Yampi', icon: <ShopifyIcon />, connected: isYampiConnected },
    { key: 'influenciadores', label: 'Influenciadores', icon: <SparklesIcon />, connected: isYampiConnected },
  ]

  // ── Custom tooltip component ──
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="tooltip-glass" style={{ background: 'rgba(15,25,17,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(236,162,6,0.2)', borderRadius: 10, padding: '12px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
        <p className="text-text-muted text-xs mb-2">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} className="font-data text-sm" style={{ color: entry.stroke }}>
            {entry.name}: R$ {Number(entry.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        ))}
      </div>
    )
  }

  // ── Render ──
  return (
    <div className="space-y-6">
      {/* ═══ Tab selector ═══ */}
      {forcedTab ? (
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-bg-card border border-border rounded-xl p-1">
            {TABS.filter(t => t.key === forcedTab).map(({ key, label, icon, connected }) => (
              <div key={key} className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg bg-brand-gold text-bg-base shadow-md">
                {icon}
                <span>{label}</span>
                <span className={`status-dot flex-shrink-0 ${connected ? 'status-dot-connected' : 'status-dot-disconnected'}`} />
              </div>
            ))}
          </div>
          <Link href="/metricas" className="text-xs text-text-muted hover:text-brand-gold transition-colors">
            Ver todas as métricas
          </Link>
        </div>
      ) : (
        <div className="flex gap-1 bg-bg-card border border-border rounded-xl p-1 overflow-x-auto whitespace-nowrap">
          {TABS.map(({ key, label, icon, connected }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 px-3 py-2 md:px-4 md:py-2.5 text-xs md:text-sm font-medium rounded-lg transition-all cursor-pointer ${
                activeTab === key
                  ? 'bg-brand-gold text-bg-base shadow-md'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`}>
              {icon}
              <span className="truncate">{label}</span>
              <span className={`status-dot flex-shrink-0 ${connected ? 'status-dot-connected' : 'status-dot-disconnected'}`} />
            </button>
          ))}
        </div>
      )}

      {/* ═══ Not connected ═══ */}
      {!isConnected && !isInfluencersTab && (
        <div className="bg-bg-card border border-border rounded-xl p-16 text-center">
          <p className="font-sans text-text-primary font-semibold text-lg mb-2">
            {activeTab === 'meta' ? 'Meta Ads não conectado' : activeTab === 'google' ? 'Google Ads não conectado' : 'Yampi não conectado'}
          </p>
          <p className="text-text-muted mb-4">
            {activeTab === 'yampi' ? 'Conecte a Yampi para ver métricas de checkout e vendas.' : 'Conecte sua conta para ver métricas.'}
          </p>
          <Link href="/integracoes" className="inline-block px-5 py-2.5 bg-brand-gold text-bg-base rounded-lg font-semibold hover:opacity-90 transition-opacity cursor-pointer">
            {activeTab === 'yampi' ? 'Conectar Yampi' : activeTab === 'meta' ? 'Conectar Meta Ads' : 'Conectar Google Ads'}
          </Link>
        </div>
      )}

      {/* ═══ Not connected — Influenciadores needs Yampi ═══ */}
      {!isConnected && isInfluencersTab && (
        <div className="bg-bg-card border border-border rounded-xl p-16 text-center">
          <p className="font-sans text-text-primary font-semibold text-lg mb-2">Yampi não conectado</p>
          <p className="text-text-muted mb-4">Conecte a Yampi para rastrear pedidos por cupom de influenciadoras.</p>
          <Link href="/integracoes" className="inline-block px-5 py-2.5 bg-brand-gold text-bg-base rounded-lg font-semibold hover:opacity-90 transition-opacity cursor-pointer">Conectar Yampi</Link>
        </div>
      )}

      {/* ═══ Connected — Ads tabs (Meta/Google) ═══ */}
      {isConnected && isAdsTab && (
        <>
          {/* Period filters */}
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
          {/* Sync + report */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {syncMsg && <span className="text-xs text-text-muted">{syncMsg}</span>}
            <button onClick={handleSync} disabled={syncing}
              className="w-full sm:w-auto px-3 py-1.5 text-sm rounded-lg font-medium bg-bg-card border border-border text-text-secondary hover:bg-bg-hover disabled:opacity-50 cursor-pointer transition-colors">
              {syncing ? 'Sincronizando...' : 'Sincronizar'}
            </button>
            <button onClick={handleReport} disabled={reportLoading || filteredAds.length === 0}
              className={`w-full sm:w-auto btn-ai-report ${reportLoading ? 'loading' : ''}`}>
              {reportLoading ? <LoadingSpinner /> : <SparklesIcon />}
              {reportLoading ? 'Gerando...' : 'Gerar Relatório IA'}
            </button>
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

          {/* ═══ KPI Row 1 ═══ */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <KpiCard label="Investimento" value={fmtCurrency(totals.spend, 0)} />
            <KpiCard label="Receita" value={fmtCurrency(totals.revenue, 0)} />
            <KpiCard label="ROAS" value={`${totals.roas.toFixed(2)}x`}
              badge={totals.roas >= 3 ? 'green' : totals.roas >= 1.5 ? 'yellow' : 'red'} />
            <KpiCard label="CPR" value={fmtCurrency(totals.cpa)}
              badge={totals.cpa > 0 && totals.cpa <= 50 ? 'green' : totals.cpa <= 100 ? 'yellow' : 'red'} />
            {activeTab === 'meta'
              ? <KpiCard label="CPC" value={fmtCurrency(totals.cpc)} />
              : <KpiCard label="CPC" value={fmtCurrency(totals.google_cpc)} />}
          </div>

          {/* ═══ KPI Row 2 ═══ */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <KpiCard label="Conversões" value={fmtNumber(totals.conversions)} />
            <KpiCard label="Taxa Conversão" value={`${(activeTab === 'meta' ? totals.conversion_rate : totals.google_conversion_rate).toFixed(2)}%`} />
            <KpiCard label="CTR" value={`${totals.ctr.toFixed(2)}%`}
              badge={totals.ctr >= 2 ? 'green' : totals.ctr >= 1 ? 'yellow' : 'red'} />
            <KpiCard label="CPM" value={fmtCurrency(totals.cpm)}
              badge={totals.cpm > 0 && totals.cpm <= 20 ? 'green' : totals.cpm <= 40 ? 'yellow' : 'red'} />
            {activeTab === 'meta'
              ? <KpiCard label="Connect Rate" value={`${totals.connect_rate.toFixed(1)}%`} />
              : <KpiCard label="Cliques" value={fmtNumber(totals.clicks)} />}
          </div>

          {/* ═══ Funnel — Meta only ═══ */}
          {funnel && (
            <div className="bg-bg-card border border-border-gold rounded-xl p-6 card-premium">
              <h3 className="font-sans text-text-primary font-semibold text-lg mb-6">Funil de Conversão</h3>
              <div className="space-y-3">
                {funnel.steps.map((step, i) => {
                  const maxVal = Math.max(...funnel.steps.map(s => s.value))
                  const widthPct = maxVal > 0 ? Math.max((step.value / maxVal) * 100, 6) : 6
                  const prevValue = i > 0 ? funnel.steps[i - 1].value : 0
                  const isCritical = i === funnel.maxDropIdx

                  let dropPct: string | null = null
                  let convLabel: string | null = null
                  if (i > 0 && prevValue > 0) {
                    const pct = ((step.value / prevValue) * 100).toFixed(1)
                    dropPct = ((1 - step.value / prevValue) * 100).toFixed(1)
                    convLabel = i === 1 ? `Connect Rate ${pct}%` : `${pct}% converteram`
                  }

                  return (
                    <div key={i}>
                      {/* Drop indicator between steps */}
                      {convLabel && (
                        <div className="flex items-center gap-3 py-2 pl-2">
                          <svg className={`w-4 h-4 ${isCritical ? 'text-red-400' : 'text-text-muted'}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M8 2v10M4 8l4 4 4-4" />
                          </svg>
                          <span className={`text-xs font-medium ${isCritical ? 'text-red-400' : 'text-text-secondary'}`}>
                            {convLabel}
                          </span>
                          {isCritical && dropPct && (
                            <span className="badge badge-red text-xs">-{dropPct}% drop</span>
                          )}
                        </div>
                      )}
                      {/* Funnel step */}
                      <div className={`rounded-xl p-3 ${isCritical ? 'funnel-step-critical' : ''}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-sm font-medium ${isCritical ? 'text-red-400' : 'text-text-primary'}`}>
                            {step.label}
                          </span>
                          <div className="flex items-center gap-4">
                            <span className="text-xs text-text-muted font-data">
                              {step.costLabel}: {fmtCurrency(step.cost)}
                            </span>
                            <span className="font-data text-base font-semibold text-text-primary">
                              {fmtNumber(step.value)}
                            </span>
                          </div>
                        </div>
                        <div className="funnel-bar-track">
                          <div className={`funnel-bar-fill ${isCritical ? 'critical' : 'default'}`}
                            style={{ width: `${widthPct}%` }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ═══ Campaign table (sortable) ═══ */}
          {campaignData.length > 0 && (() => {
            const enriched = campaignData.map(c => {
              const roas = c.spend > 0 ? c.revenue / c.spend : 0
              const cpr = c.conversions > 0 ? c.spend / c.conversions : 0
              const cpc = activeTab === 'meta' ? (c.outbound_clicks > 0 ? c.spend / c.outbound_clicks : 0) : (c.clicks > 0 ? c.spend / c.clicks : 0)
              const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0
              return { ...c, roas, cpr, cpc, ctr }
            })
            const sorted = [...enriched].sort((a, b) => {
              const valA = campSortKey === 'name' ? a.name.toLowerCase() : (a as any)[campSortKey]
              const valB = campSortKey === 'name' ? b.name.toLowerCase() : (b as any)[campSortKey]
              if (valA < valB) return campSortAsc ? -1 : 1
              if (valA > valB) return campSortAsc ? 1 : -1
              return 0
            })
            const SortTh = ({ k, label, align = 'right' }: { k: CampSortKey; label: string; align?: string }) => (
              <th className={`${align === 'left' ? '' : 'text-right'} cursor-pointer select-none hover:text-brand-gold transition-colors`} onClick={() => toggleCampSort(k)}>
                <span className="inline-flex items-center gap-1">
                  {label}
                  {campSortKey === k && <span className="text-brand-gold">{campSortAsc ? '↑' : '↓'}</span>}
                </span>
              </th>
            )
            return (
              <div className="bg-bg-card border border-border-gold rounded-xl p-6 card-premium">
                <h3 className="font-sans text-text-primary font-semibold text-lg mb-5">Por Campanha</h3>
                <div className="overflow-x-auto">
                  <table className="table-premium min-w-[600px]">
                    <thead>
                      <tr>
                        <SortTh k="name" label="Campanha" align="left" />
                        <SortTh k="spend" label="Investimento" />
                        <SortTh k="revenue" label="Receita" />
                        <SortTh k="roas" label="ROAS" />
                        <SortTh k="conversions" label="Conversões" />
                        <SortTh k="cpr" label="CPR" />
                        <SortTh k="ctr" label="CTR" />
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((c, i) => (
                        <tr key={i}>
                          <td className="text-text-primary max-w-[200px] truncate font-medium">{c.name}</td>
                          <td className="text-right font-data text-red-400">{fmtCurrency(c.spend)}</td>
                          <td className="text-right font-data text-green-400">{fmtCurrency(c.revenue)}</td>
                          <td className="text-right">
                            <span className={`badge ${c.roas >= 3 ? 'badge-green' : c.roas >= 1.5 ? 'badge-yellow' : 'badge-red'}`}>
                              {c.roas.toFixed(2)}x
                            </span>
                          </td>
                          <td className="text-right font-data">{c.conversions}</td>
                          <td className="text-right">
                            <span className={`badge ${c.cpr > 0 && c.cpr <= 50 ? 'badge-green' : c.cpr <= 100 ? 'badge-yellow' : 'badge-red'}`}>
                              {fmtCurrency(c.cpr)}
                            </span>
                          </td>
                          <td className="text-right">
                            <span className={`badge ${c.ctr >= 2 ? 'badge-green' : c.ctr >= 1 ? 'badge-yellow' : 'badge-red'}`}>
                              {c.ctr.toFixed(2)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}

          {/* ═══ AI Report ═══ */}
          {reportMarkdown && (
            <div className="bg-bg-card border border-brand-gold/20 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <SparklesIcon />
                  <h3 className="font-sans text-text-primary font-semibold">Relatório IA</h3>
                </div>
                <button onClick={() => setReportMarkdown('')} className="text-xs text-text-muted hover:text-text-secondary cursor-pointer transition-colors">Fechar</button>
              </div>
              <div className="prose prose-invert prose-sm max-w-none text-text-secondary
                [&_h2]:font-sans [&_h2]:text-text-primary [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-2
                [&_h3]:font-sans [&_h3]:text-text-primary [&_h3]:text-sm [&_h3]:font-semibold
                [&_table]:w-full [&_th]:text-left [&_th]:py-1 [&_th]:text-xs [&_th]:text-text-muted [&_th]:uppercase
                [&_td]:py-1 [&_td]:text-sm [&_td]:font-data [&_strong]:text-text-primary [&_li]:text-sm"
                dangerouslySetInnerHTML={{ __html: markdownToHtml(reportMarkdown) }} />
            </div>
          )}

          {dailyData.length === 0 && (
            <div className="bg-bg-card border border-border rounded-xl p-16 text-center">
              <p className="text-text-muted">Nenhuma métrica neste período.</p>
              <p className="text-text-muted text-sm mt-1">Clique em Sincronizar para importar dados.</p>
            </div>
          )}
        </>
      )}

      {/* ═══ Connected — Yampi tab ═══ */}
      {isConnected && activeTab === 'yampi' && (
        <>
          {/* Period + sync */}
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

          {/* Yampi KPIs Row 1 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Receita" value={fmtCurrency(yampiTotals.revenue, 0)} />
            <KpiCard label="Pedidos" value={fmtNumber(yampiTotals.orders)} />
            <KpiCard label="Ticket Médio" value={fmtCurrency(yampiTotals.avg_ticket)} />
            <KpiCard label="Aprovação PIX" value={`${yampiTotals.pix_approval_rate.toFixed(2)}%`}
              badge={yampiTotals.pix_approval_rate >= 85 ? 'green' : yampiTotals.pix_approval_rate >= 70 ? 'yellow' : 'red'} />
          </div>

          {/* Yampi KPIs Row 2 */}
          <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
            <KpiCard label="Conversão Checkout" value={`${yampiTotals.checkout_conversion.toFixed(2)}%`}
              badge={yampiTotals.checkout_conversion >= 70 ? 'green' : yampiTotals.checkout_conversion >= 50 ? 'yellow' : 'red'} />
            <KpiCard label="Taxa Cancelamento" value={`${yampiTotals.cancellation_rate.toFixed(2)}%`}
              badge={yampiTotals.cancellation_rate <= 5 ? 'green' : yampiTotals.cancellation_rate <= 15 ? 'yellow' : 'red'} />
          </div>

          {/* Yampi Revenue chart */}
          {yampiDaily.length > 0 && (
            <div className="bg-bg-card border border-border-gold rounded-xl p-6 card-premium">
              <h3 className="font-sans text-text-primary font-semibold text-lg mb-5">Receita por Dia</h3>
              <div className="h-48 md:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={yampiDaily}>
                    <defs>
                      <linearGradient id="gYampiRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,82,51,0.4)" />
                    <XAxis dataKey="date" tick={{ fill: '#5a6b5e', fontSize: 11, fontFamily: 'var(--font-data)' }} axisLine={false} tickLine={false} tickFormatter={(v: string) => v.slice(5)} />
                    <YAxis tick={{ fill: '#5a6b5e', fontSize: 11, fontFamily: 'var(--font-data)' }} axisLine={false} tickLine={false} width={65} tickFormatter={(v: number) => `R$${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="revenue" stroke="#22c55e" fill="url(#gYampiRevenue)" strokeWidth={2} name="Receita" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Top 5 Produtos */}
          {yampiTopProducts.length > 0 && (
            <div className="bg-bg-card border border-border-gold rounded-xl p-6 card-premium">
              <h3 className="font-sans text-text-primary font-semibold text-lg mb-5">Top 5 Produtos</h3>
              <div className="overflow-x-auto">
                <table className="table-premium min-w-[500px]">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th className="text-right">Qtd Vendida</th>
                      <th className="text-right">Receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yampiTopProducts.map((p, i) => (
                      <tr key={i}>
                        <td className="text-text-primary font-medium max-w-[250px] truncate">{p.name}</td>
                        <td className="text-right font-data">{fmtNumber(p.quantity)}</td>
                        <td className="text-right font-data text-green-400">{fmtCurrency(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Por Estado */}
          {yampiByState.length > 0 && (
            <div className="bg-bg-card border border-border-gold rounded-xl p-6 card-premium">
              <h3 className="font-sans text-text-primary font-semibold text-lg mb-5">Por Estado</h3>
              <div className="overflow-x-auto">
                <table className="table-premium min-w-[500px]">
                  <thead>
                    <tr>
                      <th>Estado</th>
                      <th className="text-right">Pedidos</th>
                      <th className="text-right">Receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yampiByState.map((s, i) => (
                      <tr key={i}>
                        <td className="text-text-primary font-medium">{s.state}</td>
                        <td className="text-right font-data">{fmtNumber(s.orders)}</td>
                        <td className="text-right font-data text-green-400">{fmtCurrency(s.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Forma de Pagamento */}
          {yampiByPayment.length > 0 && (
            <div className="bg-bg-card border border-border-gold rounded-xl p-6 card-premium">
              <h3 className="font-sans text-text-primary font-semibold text-lg mb-5">Forma de Pagamento</h3>
              <div className="overflow-x-auto">
                <table className="table-premium min-w-[500px]">
                  <thead>
                    <tr>
                      <th>Método</th>
                      <th className="text-right">Pedidos</th>
                      <th className="text-right">% do Total</th>
                      <th className="text-right">Receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yampiByPayment.map((p, i) => (
                      <tr key={i}>
                        <td className="text-text-primary font-medium">{p.method}</td>
                        <td className="text-right font-data">{fmtNumber(p.orders)}</td>
                        <td className="text-right font-data">{p.pct.toFixed(1)}%</td>
                        <td className="text-right font-data text-green-400">{fmtCurrency(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {filteredYampiMetrics.length === 0 && (
            <div className="bg-bg-card border border-border rounded-xl p-16 text-center">
              <p className="text-text-muted">Nenhuma métrica neste período.</p>
              <p className="text-text-muted text-sm mt-1">Clique em Sincronizar para importar dados.</p>
            </div>
          )}
        </>
      )}

      {/* ═══ Connected — Influenciadores tab ═══ */}
      {isConnected && isInfluencersTab && (
        <InfluencersTab key={searchParams.get('view') || 'consolidado'} workspaceId={workspaceId} initialView={(searchParams.get('view') as 'consolidado' | 'macro' | 'micro' | 'ranking') || 'consolidado'} />
      )}

    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   KPI Card — premium design with gradient border hover
   ══════════════════════════════════════════════════════════════ */
function KpiCard({ label, value, badge }: {
  label: string
  value: string
  badge?: 'green' | 'yellow' | 'red'
}) {
  return (
    <div className="kpi-card">
      <p className="text-text-muted text-xs font-medium tracking-wide uppercase mb-2">{label}</p>
      <div className="flex items-end gap-2">
        <p className="font-data text-lg font-semibold text-text-primary leading-none">{value}</p>
        {badge && (
          <span className={`status-dot ${
            badge === 'green' ? 'bg-green-400 shadow-[0_0_6px_rgba(34,197,94,0.5)]'
            : badge === 'yellow' ? 'bg-yellow-400 shadow-[0_0_6px_rgba(234,179,8,0.5)]'
            : 'bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.5)]'
          }`} />
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Formatting helpers
   ══════════════════════════════════════════════════════════════ */
function fmtCurrency(v: number, decimals = 2) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v)
}
function fmtNumber(v: number) {
  return new Intl.NumberFormat('pt-BR').format(v)
}

function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n- /g, '</p><ul><li>')
    .replace(/\n(\d+)\. /g, '</p><ol><li>')
    .replace(/\|(.+)\|/g, (match) => {
      const cells = match.split('|').filter(Boolean).map(c => c.trim())
      return '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>'
    })
    .replace(/<\/li>\n?<li>/g, '</li><li>')
}
