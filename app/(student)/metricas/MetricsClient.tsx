'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

type AdsRow = {
  id: string; date: string; campaign_id: string; campaign_name: string;
  spend: number; impressions: number; clicks: number; conversions: number;
  revenue: number; cpm: number; cpc: number; ctr: number; roas: number;
  page_views?: number; outbound_clicks?: number; add_to_cart?: number;
  initiate_checkout?: number; add_payment_info?: number;
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

type Tab = 'meta' | 'google'

function normalize(d: string) { return d?.slice(0, 10) ?? '' }

export default function MetricsClient({
  workspaceId, isMetaConnected, isGoogleConnected, metaMetrics, googleMetrics,
}: {
  workspaceId: string
  isMetaConnected: boolean
  isGoogleConnected: boolean
  metaMetrics: AdsRow[]
  googleMetrics: AdsRow[]
}) {
  const [activeTab, setActiveTab] = useState<Tab>('meta')
  const [period, setPeriod] = useState<Period>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [appliedFrom, setAppliedFrom] = useState('')
  const [appliedTo, setAppliedTo] = useState('')

  const [metaSyncing, setMetaSyncing] = useState(false)
  const [metaSyncMsg, setMetaSyncMsg] = useState('')
  const [googleSyncing, setGoogleSyncing] = useState(false)
  const [googleSyncMsg, setGoogleSyncMsg] = useState('')

  const [reportLoading, setReportLoading] = useState(false)
  const [reportMarkdown, setReportMarkdown] = useState('')

  const syncing = activeTab === 'meta' ? metaSyncing : googleSyncing
  const syncMsg = activeTab === 'meta' ? metaSyncMsg : googleSyncMsg

  const metrics = activeTab === 'meta' ? metaMetrics : googleMetrics
  const isConnected = activeTab === 'meta' ? isMetaConnected : isGoogleConnected

  const filtered = useMemo(() => {
    const today = new Date().toLocaleDateString('sv-SE')

    if (period === 'today') return metrics.filter(m => normalize(m.date) === today)

    if (period === 'yesterday') {
      const y = new Date()
      y.setDate(y.getDate() - 1)
      return metrics.filter(m => normalize(m.date) === y.toLocaleDateString('sv-SE'))
    }

    if (period === 'mes_atual') {
      const firstDay = today.slice(0, 7) + '-01'
      return metrics.filter(m => normalize(m.date) >= firstDay && normalize(m.date) <= today)
    }

    if (period === 'custom' && appliedFrom && appliedTo) {
      return metrics.filter(m => normalize(m.date) >= appliedFrom && normalize(m.date) <= appliedTo)
    }

    const days = PERIODS.find(p => p.key === period)?.days ?? 30
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toLocaleDateString('sv-SE')
    return metrics.filter(m => normalize(m.date) >= sinceStr && normalize(m.date) <= today)
  }, [metrics, period, appliedFrom, appliedTo, activeTab])

  const dailyData = useMemo(() => {
    const map = new Map<string, { date: string; spend: number; revenue: number; impressions: number; clicks: number; conversions: number }>()
    for (const m of filtered) {
      const existing = map.get(m.date) ?? { date: m.date, spend: 0, revenue: 0, impressions: 0, clicks: 0, conversions: 0 }
      existing.spend += Number(m.spend) || 0
      existing.revenue += Number(m.revenue) || 0
      existing.impressions += Number(m.impressions) || 0
      existing.clicks += Number(m.clicks) || 0
      existing.conversions += Number(m.conversions) || 0
      map.set(m.date, existing)
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [filtered])

  const campaignData = useMemo(() => {
    const map = new Map<string, { name: string; spend: number; revenue: number; impressions: number; clicks: number; conversions: number; outbound_clicks: number }>()
    for (const m of filtered) {
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
  }, [filtered])

  const totals = useMemo(() => {
    const spend = dailyData.reduce((s, d) => s + d.spend, 0)
    const revenue = dailyData.reduce((s, d) => s + d.revenue, 0)
    const impressions = dailyData.reduce((s, d) => s + d.impressions, 0)
    const clicks = dailyData.reduce((s, d) => s + d.clicks, 0)
    const conversions = dailyData.reduce((s, d) => s + d.conversions, 0)
    const page_views = filtered.reduce((s, m) => s + (Number(m.page_views) || 0), 0)
    const outbound_clicks = filtered.reduce((s, m) => s + (Number(m.outbound_clicks) || 0), 0)
    const initiate_checkout = filtered.reduce((s, m) => s + (Number(m.initiate_checkout) || 0), 0)
    const add_payment_info = filtered.reduce((s, m) => s + (Number(m.add_payment_info) || 0), 0)
    const roas = spend > 0 ? revenue / spend : 0
    const cpa = conversions > 0 ? spend / conversions : 0
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
    const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0
    const cpc = outbound_clicks > 0 ? spend / outbound_clicks : 0
    const cps = page_views > 0 ? spend / page_views : 0
    const connect_rate = outbound_clicks > 0 ? (page_views / outbound_clicks) * 100 : 0
    const conversion_rate = page_views > 0 ? (conversions / page_views) * 100 : 0
    return { spend, revenue, impressions, clicks, conversions, roas, cpa, ctr, cpm, cpc, cps, connect_rate, conversion_rate, page_views, outbound_clicks, initiate_checkout, add_payment_info }
  }, [dailyData, filtered])

  // Funnel — 5 steps (Meta only)
  const funnel = useMemo(() => {
    if (activeTab !== 'meta') return null
    const { outbound_clicks, page_views, initiate_checkout, add_payment_info, conversions, spend } = totals
    if (outbound_clicks === 0 && page_views === 0 && initiate_checkout === 0 && add_payment_info === 0 && conversions === 0) return null
    const steps = [
      { label: 'Cliques no Link', value: outbound_clicks, cost: outbound_clicks > 0 ? spend / outbound_clicks : 0, costLabel: 'CPC' },
      { label: 'Visualização da Página de Destino', value: page_views, cost: page_views > 0 ? spend / page_views : 0, costLabel: 'CPS' },
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

  const handleSync = async () => {
    const dateFrom = new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0]
    const dateTo = new Date().toISOString().split('T')[0]

    if (activeTab === 'meta') {
      setMetaSyncing(true); setMetaSyncMsg('')
      try {
        const res = await fetch('/api/integrations/meta/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspace_id: workspaceId, date_from: dateFrom, date_to: dateTo }),
        })
        const data = await res.json()
        if (data.error) { setMetaSyncMsg(`Erro: ${data.error}`) }
        else { setMetaSyncMsg(`${data.synced} registros sincronizados. Recarregando...`); window.location.reload(); return }
      } catch { setMetaSyncMsg('Erro ao sincronizar.') }
      setMetaSyncing(false)
    } else {
      setGoogleSyncing(true); setGoogleSyncMsg('')
      try {
        const res = await fetch('/api/integrations/google-ads/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspace_id: workspaceId, date_from: dateFrom, date_to: dateTo }),
        })
        const data = await res.json()
        if (data.error) { setGoogleSyncMsg(`Erro: ${data.error}`) }
        else { setGoogleSyncMsg(`${data.synced} registros sincronizados. Recarregando...`); window.location.reload(); return }
      } catch { setGoogleSyncMsg('Erro ao sincronizar.') }
      setGoogleSyncing(false)
    }
  }

  const handleReport = async () => {
    setReportLoading(true); setReportMarkdown('')
    try {
      const res = await fetch('/api/metricas/relatorio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totals,
          funnel: funnel?.steps ?? [],
          campaigns: campaignData.slice(0, 15).map(c => {
            const cpc = c.outbound_clicks > 0 ? c.spend / c.outbound_clicks : 0
            return {
              name: c.name, spend: c.spend, revenue: c.revenue,
              roas: c.spend > 0 ? c.revenue / c.spend : 0,
              cpa: c.conversions > 0 ? c.spend / c.conversions : 0,
              cpc, conversions: c.conversions,
            }
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

  return (
    <div className="space-y-6">
      {/* Tab selector */}
      <div className="flex gap-1 bg-bg-card border border-border rounded-xl p-1">
        <button onClick={() => setActiveTab('meta')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'meta' ? 'bg-brand-gold text-bg-base' : 'text-text-secondary hover:bg-bg-hover'
          }`}>
          Meta Ads
        </button>
        <button onClick={() => setActiveTab('google')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'google' ? 'bg-brand-gold text-bg-base' : 'text-text-secondary hover:bg-bg-hover'
          }`}>
          Google Ads
        </button>
      </div>

      {/* Not connected */}
      {!isConnected && (
        <div className="bg-bg-card border border-border rounded-xl p-16 text-center">
          <p className="text-text-primary font-semibold text-lg mb-2">
            {activeTab === 'meta' ? 'Meta Ads não conectado' : 'Google Ads não conectado'}
          </p>
          <p className="text-text-muted mb-4">
            {activeTab === 'meta' ? 'Conecte sua conta do Meta Ads para ver métricas.' : 'Conecte sua conta do Google Ads para ver métricas.'}
          </p>
          <Link href="/integracoes" className="inline-block px-4 py-2 bg-brand-gold text-bg-base rounded-lg font-medium hover:opacity-90 transition-opacity">
            {activeTab === 'meta' ? 'Conectar Meta Ads' : 'Conectar Google Ads'}
          </Link>
        </div>
      )}

      {/* Connected content */}
      {isConnected && (
        <>
          {/* Period selector + sync + report */}
          <div className="flex flex-wrap items-center gap-2">
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  period === p.key ? 'bg-brand-gold text-bg-base' : 'bg-bg-card border border-border text-text-secondary hover:bg-bg-hover'
                }`}>
                {p.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              {syncMsg && <span className="text-xs text-text-muted">{syncMsg}</span>}
              <button onClick={handleSync} disabled={syncing}
                className="px-3 py-1.5 text-sm rounded-lg font-medium bg-bg-card border border-border text-text-secondary hover:bg-bg-hover disabled:opacity-50">
                {syncing ? 'Sincronizando...' : 'Sincronizar'}
              </button>
              <button onClick={handleReport} disabled={reportLoading || filtered.length === 0}
                className="px-3 py-1.5 text-sm rounded-lg font-medium bg-brand-gold/20 border border-brand-gold/40 text-brand-gold hover:bg-brand-gold/30 disabled:opacity-50 transition-colors">
                {reportLoading ? 'Gerando...' : 'Gerar Relatório IA'}
              </button>
            </div>
          </div>

          {/* Custom date range */}
          {period === 'custom' && (
            <div className="flex gap-3 items-center">
              <span className="text-text-muted text-sm">De:</span>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="bg-bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary" />
              <span className="text-text-muted text-sm">Até:</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="bg-bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary" />
              <button onClick={() => { setAppliedFrom(customFrom); setAppliedTo(customTo) }}
                disabled={!customFrom || !customTo}
                className="px-4 py-1.5 text-sm rounded-lg font-medium bg-brand-gold text-bg-base hover:opacity-90 transition-opacity disabled:opacity-40">
                Buscar
              </button>
            </div>
          )}

          {/* KPI Row 1: Investimento | Receita | ROAS | CPA | CPS */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <KpiCard label="Investimento" value={fmtCurrency(totals.spend, 0)} />
            <KpiCard label="Receita" value={fmtCurrency(totals.revenue, 0)} />
            <KpiCard label="ROAS" value={`${totals.roas.toFixed(2)}x`}
              color={totals.roas >= 3 ? '#22c55e' : totals.roas >= 1.5 ? '#eab308' : '#ef4444'}
              indicator={totals.roas >= 3 ? 'green' : totals.roas >= 1.5 ? 'yellow' : 'red'} />
            <KpiCard label="CPA" value={fmtCurrency(totals.cpa)}
              color={totals.cpa > 0 && totals.cpa <= 50 ? '#22c55e' : totals.cpa <= 100 ? '#eab308' : '#ef4444'}
              indicator={totals.cpa > 0 && totals.cpa <= 50 ? 'green' : totals.cpa <= 100 ? 'yellow' : 'red'} />
            <KpiCard label="CPS" value={fmtCurrency(totals.cps)} />
          </div>

          {/* KPI Row 2: Conversões | Taxa de Conversão | CTR | Connect Rate | CPM */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <KpiCard label="Conversões" value={fmtNumber(totals.conversions)} />
            <KpiCard label="Taxa de Conversão" value={`${totals.conversion_rate.toFixed(2)}%`} />
            <KpiCard label="CTR" value={`${totals.ctr.toFixed(2)}%`}
              color={totals.ctr >= 2 ? '#22c55e' : totals.ctr >= 1 ? '#eab308' : '#ef4444'}
              indicator={totals.ctr >= 2 ? 'green' : totals.ctr >= 1 ? 'yellow' : 'red'} />
            <KpiCard label="Connect Rate" value={`${totals.connect_rate.toFixed(1)}%`} />
            <KpiCard label="CPM" value={fmtCurrency(totals.cpm)}
              color={totals.cpm > 0 && totals.cpm <= 20 ? '#22c55e' : totals.cpm <= 40 ? '#eab308' : '#ef4444'}
              indicator={totals.cpm > 0 && totals.cpm <= 20 ? 'green' : totals.cpm <= 40 ? 'yellow' : 'red'} />
          </div>

          {/* Funnel — 5 steps, Meta only */}
          {funnel && (
            <div className="bg-bg-card border border-border rounded-xl p-6">
              <h3 className="text-text-primary font-semibold mb-5">Funil de Conversão</h3>
              <div className="space-y-1">
                {funnel.steps.map((step, i) => {
                  const maxVal = Math.max(...funnel.steps.map(s => s.value))
                  const widthPct = maxVal > 0 ? Math.max((step.value / maxVal) * 100, 4) : 4
                  const prevValue = i > 0 ? funnel.steps[i - 1].value : 0
                  const isBiggestDrop = i === funnel.maxDropIdx

                  // Label for conversion between steps
                  let convLabel: string | null = null
                  if (i > 0 && prevValue > 0) {
                    const pct = ((step.value / prevValue) * 100).toFixed(1)
                    if (i === 1) convLabel = `Connect Rate ${pct}%`
                    else convLabel = `${pct}% converteram`
                  }

                  return (
                    <div key={i}>
                      {convLabel && (
                        <div className="flex items-center gap-2 py-1.5 pl-4">
                          <span className="text-text-muted text-xs">↓</span>
                          <span className={`text-xs font-medium ${isBiggestDrop ? 'text-red-400 font-bold' : 'text-text-secondary'}`}>
                            {convLabel}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-sm font-medium ${isBiggestDrop ? 'text-red-400' : 'text-text-primary'}`}>{step.label}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-text-muted">{step.costLabel}: {fmtCurrency(step.cost)}</span>
                              <span className="text-sm font-bold text-text-primary">{fmtNumber(step.value)}</span>
                            </div>
                          </div>
                          <div className="h-7 bg-bg-surface rounded-lg overflow-hidden">
                            <div
                              className={`h-full rounded-lg transition-all ${isBiggestDrop ? 'bg-red-500/70' : 'bg-brand-gold/60'}`}
                              style={{ width: `${widthPct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Spend vs Revenue chart */}
          {dailyData.length > 0 && (
            <div className="bg-bg-card border border-border rounded-xl p-6">
              <h3 className="text-text-primary font-semibold mb-4">Investimento vs Receita</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyData}>
                    <defs>
                      <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F3D25" />
                    <XAxis dataKey="date" tick={{ fill: '#8B9A8F', fontSize: 10 }} axisLine={false} tickLine={false}
                      tickFormatter={(v: string) => v.slice(5)} />
                    <YAxis tick={{ fill: '#8B9A8F', fontSize: 10 }} axisLine={false} tickLine={false} width={60}
                      tickFormatter={(v: number) => `R$${(v/1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ backgroundColor: '#122014', border: '1px solid #1F3D25', borderRadius: 8 }}
                      formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']}
                      labelStyle={{ color: '#94a3b8' }} />
                    <Area type="monotone" dataKey="spend" stroke="#ef4444" fill="url(#gSpend)" strokeWidth={2} name="Investimento" />
                    <Area type="monotone" dataKey="revenue" stroke="#22c55e" fill="url(#gRevenue)" strokeWidth={2} name="Receita" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Campaign breakdown */}
          {campaignData.length > 0 && (
            <div className="bg-bg-card border border-border rounded-xl p-6">
              <h3 className="text-text-primary font-semibold mb-4">Por Campanha</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs text-text-muted uppercase">
                      <th className="text-left py-2">Campanha</th>
                      <th className="text-right py-2">Gasto</th>
                      <th className="text-right py-2">Receita</th>
                      <th className="text-right py-2">ROAS</th>
                      <th className="text-right py-2">CPC</th>
                      <th className="text-right py-2">CPA</th>
                      <th className="text-right py-2">Conv.</th>
                      <th className="text-right py-2">CTR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignData.map((c, i) => {
                      const roas = c.spend > 0 ? c.revenue / c.spend : 0
                      const cpa = c.conversions > 0 ? c.spend / c.conversions : 0
                      const cpc = c.outbound_clicks > 0 ? c.spend / c.outbound_clicks : 0
                      const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0
                      return (
                        <tr key={i} className="border-t border-white/5 hover:bg-white/5">
                          <td className="py-2 text-text-primary max-w-[200px] truncate">{c.name}</td>
                          <td className="py-2 text-right text-red-400">{fmtCurrency(c.spend)}</td>
                          <td className="py-2 text-right text-green-400">{fmtCurrency(c.revenue)}</td>
                          <td className={`py-2 text-right font-medium ${roas >= 3 ? 'text-green-400' : roas >= 1.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {roas.toFixed(2)}x
                          </td>
                          <td className="py-2 text-right text-text-secondary">{fmtCurrency(cpc)}</td>
                          <td className="py-2 text-right text-text-secondary">{fmtCurrency(cpa)}</td>
                          <td className="py-2 text-right text-text-secondary">{c.conversions}</td>
                          <td className={`py-2 text-right ${ctr >= 2 ? 'text-green-400' : ctr >= 1 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {ctr.toFixed(2)}%
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AI Report */}
          {reportMarkdown && (
            <div className="bg-bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-text-primary font-semibold">Relatório IA</h3>
                <button onClick={() => setReportMarkdown('')} className="text-xs text-text-muted hover:text-text-secondary">Fechar</button>
              </div>
              <div className="prose prose-invert prose-sm max-w-none text-text-secondary
                [&_h2]:text-text-primary [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-2
                [&_h3]:text-text-primary [&_h3]:text-sm [&_h3]:font-semibold
                [&_table]:w-full [&_th]:text-left [&_th]:py-1 [&_th]:text-xs [&_th]:text-text-muted [&_th]:uppercase
                [&_td]:py-1 [&_td]:text-sm [&_strong]:text-text-primary [&_li]:text-sm"
                dangerouslySetInnerHTML={{ __html: markdownToHtml(reportMarkdown) }}
              />
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
    </div>
  )
}

const INDICATOR_DOTS: Record<string, string> = { green: '🟢', yellow: '🟡', red: '🔴' }

function KpiCard({ label, value, color, indicator }: { label: string; value: string; color?: string; indicator?: 'green' | 'yellow' | 'red' }) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-4">
      <p className="text-text-muted text-xs font-medium mb-1">{label} {indicator && INDICATOR_DOTS[indicator]}</p>
      <p className="text-xl font-bold" style={{ color: color || 'var(--text-primary)' }}>{value}</p>
    </div>
  )
}

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
