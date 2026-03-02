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
}

type Period = 'today' | 'yesterday' | '7d' | '14d' | '21d' | '30d' | 'custom'
const PERIODS: { key: Period; label: string; days: number }[] = [
  { key: 'today', label: 'Hoje', days: 0 },
  { key: 'yesterday', label: 'Ontem', days: 1 },
  { key: '7d', label: '7 dias', days: 7 },
  { key: '14d', label: '14 dias', days: 14 },
  { key: '21d', label: '21 dias', days: 21 },
  { key: '30d', label: '30 dias', days: 30 },
  { key: 'custom', label: 'Personalizado', days: 0 },
]

type Tab = 'meta' | 'google'

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
  const [period, setPeriod] = useState<Period>('custom')
  const [customFrom, setCustomFrom] = useState('2025-09-01')
  const [customTo, setCustomTo] = useState(new Date().toLocaleDateString('sv-SE'))
  const [appliedFrom, setAppliedFrom] = useState('')
  const [appliedTo, setAppliedTo] = useState('')

  const [metaSyncing, setMetaSyncing] = useState(false)
  const [metaSyncMsg, setMetaSyncMsg] = useState('')
  const [googleSyncing, setGoogleSyncing] = useState(false)
  const [googleSyncMsg, setGoogleSyncMsg] = useState('')

  const syncing = activeTab === 'meta' ? metaSyncing : googleSyncing
  const syncMsg = activeTab === 'meta' ? metaSyncMsg : googleSyncMsg

  const metrics = activeTab === 'meta' ? metaMetrics : googleMetrics
  const isConnected = activeTab === 'meta' ? isMetaConnected : isGoogleConnected

  const filtered = useMemo(() => {
    if (period === 'custom' && appliedFrom && appliedTo) {
      return metrics.filter(m => m.date >= appliedFrom && m.date <= appliedTo)
    }
    const todayStr = new Date().toLocaleDateString('sv-SE')
    if (period === 'today') {
      return metrics.filter(m => m.date === todayStr)
    }
    if (period === 'yesterday') {
      const y = new Date()
      y.setDate(y.getDate() - 1)
      const yesterdayStr = y.toLocaleDateString('sv-SE')
      return metrics.filter(m => m.date === yesterdayStr)
    }
    const days = PERIODS.find(p => p.key === period)?.days ?? 30
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toLocaleDateString('sv-SE')
    return metrics.filter(m => m.date >= sinceStr)
  }, [metrics, period, appliedFrom, appliedTo, activeTab])

  // Aggregate by date
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

  // Campaign breakdown
  const campaignData = useMemo(() => {
    const map = new Map<string, { name: string; spend: number; revenue: number; clicks: number; conversions: number }>()
    for (const m of filtered) {
      const existing = map.get(m.campaign_id) ?? { name: m.campaign_name, spend: 0, revenue: 0, clicks: 0, conversions: 0 }
      existing.spend += Number(m.spend) || 0
      existing.revenue += Number(m.revenue) || 0
      existing.clicks += Number(m.clicks) || 0
      existing.conversions += Number(m.conversions) || 0
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
    const roas = spend > 0 ? revenue / spend : 0
    const cpa = conversions > 0 ? spend / conversions : 0
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
    const cpc = clicks > 0 ? spend / clicks : 0
    return { spend, revenue, impressions, clicks, conversions, roas, cpa, ctr, cpc }
  }, [dailyData])

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
        else {
          setMetaSyncMsg(`${data.synced} registros sincronizados. Recarregando...`)
          window.location.reload()
          return
        }
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
        else {
          setGoogleSyncMsg(`${data.synced} registros sincronizados. Recarregando...`)
          window.location.reload()
          return
        }
      } catch { setGoogleSyncMsg('Erro ao sincronizar.') }
      setGoogleSyncing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-xs text-red-400 bg-red-400/10 p-2 rounded">
        DEBUG: metaMetrics={metaMetrics.length} googleMetrics={googleMetrics.length} filtered={filtered.length} activeTab={activeTab} period={period}
      </div>
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

      {/* Not connected card */}
      {!isConnected && (
        <div className="bg-bg-card border border-border rounded-xl p-16 text-center">
          <p className="text-text-primary font-semibold text-lg mb-2">
            {activeTab === 'meta' ? 'Meta Ads não conectado' : 'Google Ads não conectado'}
          </p>
          <p className="text-text-muted mb-4">
            {activeTab === 'meta'
              ? 'Conecte sua conta do Meta Ads para ver métricas.'
              : 'Conecte sua conta do Google Ads para ver métricas.'}
          </p>
          <Link href="/integracoes" className="inline-block px-4 py-2 bg-brand-gold text-bg-base rounded-lg font-medium hover:opacity-90 transition-opacity">
            {activeTab === 'meta' ? 'Conectar Meta Ads' : 'Conectar Google Ads'}
          </Link>
        </div>
      )}

      {/* Connected content */}
      {isConnected && (
        <>
          {/* Period selector + sync */}
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
              <button
                onClick={() => { setAppliedFrom(customFrom); setAppliedTo(customTo) }}
                disabled={!customFrom || !customTo}
                className="px-4 py-1.5 text-sm rounded-lg font-medium bg-brand-gold text-bg-base hover:opacity-90 transition-opacity disabled:opacity-40">
                Buscar
              </button>
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <KpiCard label="Investimento" value={fmtCurrency(totals.spend)} />
            <KpiCard label="Receita" value={fmtCurrency(totals.revenue)} />
            <KpiCard label="ROAS" value={`${totals.roas.toFixed(2)}x`} color={totals.roas >= 2 ? '#22c55e' : totals.roas >= 1 ? '#eab308' : '#ef4444'} />
            <KpiCard label="CPA" value={fmtCurrency(totals.cpa)} />
            <KpiCard label="Conversões" value={String(totals.conversions)} />
            <KpiCard label="Impressões" value={fmtNumber(totals.impressions)} />
            <KpiCard label="Cliques" value={fmtNumber(totals.clicks)} />
            <KpiCard label="CTR" value={`${totals.ctr.toFixed(2)}%`} />
            <KpiCard label="CPC" value={fmtCurrency(totals.cpc)} />
          </div>

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
                      <th className="text-right py-2">Cliques</th>
                      <th className="text-right py-2">Conv.</th>
                      <th className="text-right py-2">CPA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignData.map((c, i) => {
                      const roas = c.spend > 0 ? c.revenue / c.spend : 0
                      const cpa = c.conversions > 0 ? c.spend / c.conversions : 0
                      return (
                        <tr key={i} className="border-t border-white/5 hover:bg-white/5">
                          <td className="py-2 text-text-primary max-w-[200px] truncate">{c.name}</td>
                          <td className="py-2 text-right text-red-400">{fmtCurrency(c.spend)}</td>
                          <td className="py-2 text-right text-green-400">{fmtCurrency(c.revenue)}</td>
                          <td className={`py-2 text-right font-medium ${roas >= 2 ? 'text-green-400' : roas >= 1 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {roas.toFixed(2)}x
                          </td>
                          <td className="py-2 text-right text-text-secondary">{fmtNumber(c.clicks)}</td>
                          <td className="py-2 text-right text-text-secondary">{c.conversions}</td>
                          <td className="py-2 text-right text-text-secondary">{fmtCurrency(cpa)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
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

function KpiCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-4">
      <p className="text-text-muted text-xs font-medium mb-1">{label}</p>
      <p className="text-xl font-bold" style={{ color: color || 'var(--text-primary)' }}>{value}</p>
    </div>
  )
}

function fmtCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(v)
}
function fmtNumber(v: number) {
  return new Intl.NumberFormat('pt-BR').format(v)
}
