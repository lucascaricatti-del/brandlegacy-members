'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { PLATFORM_LABELS, PLATFORM_COLORS } from '@/lib/constants/integrations'

type MetricRow = {
  id: string
  platform: string
  metric_date: string
  data: Record<string, number>
}

type Period = '7d' | '30d' | '90d'

const PERIOD_LABELS: Record<Period, string> = {
  '7d': '7 dias',
  '30d': '30 dias',
  '90d': '90 dias',
}

const PERIOD_DAYS: Record<Period, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

export default function MetricsClient({
  connectedPlatforms,
  metrics,
}: {
  connectedPlatforms: string[]
  metrics: MetricRow[]
}) {
  const [period, setPeriod] = useState<Period>('30d')

  const filteredMetrics = useMemo(() => {
    const since = new Date()
    since.setDate(since.getDate() - PERIOD_DAYS[period])
    const sinceStr = since.toISOString().split('T')[0]
    return metrics.filter((m) => m.metric_date >= sinceStr)
  }, [metrics, period])

  // Agrupar por plataforma
  const byPlatform = useMemo(() => {
    const map = new Map<string, MetricRow[]>()
    for (const m of filteredMetrics) {
      const existing = map.get(m.platform) ?? []
      existing.push(m)
      map.set(m.platform, existing)
    }
    return map
  }, [filteredMetrics])

  // Summary cards
  const summary = useMemo(() => {
    let totalSpend = 0
    let totalRevenue = 0
    let totalSessions = 0
    let totalClicks = 0

    for (const m of filteredMetrics) {
      const d = m.data
      if (m.platform === 'meta_ads' || m.platform === 'google_ads') {
        totalSpend += d.spend ?? 0
        totalClicks += d.clicks ?? 0
      }
      if (m.platform === 'shopify') {
        totalRevenue += d.revenue ?? 0
      }
      if (m.platform === 'ga4') {
        totalSessions += d.sessions ?? 0
      }
    }

    const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0

    return { totalSpend, totalRevenue, roas, totalSessions, totalClicks }
  }, [filteredMetrics])

  const hasAnyData = filteredMetrics.length > 0
  const disconnected = (['meta_ads', 'google_ads', 'ga4', 'shopify'] as const).filter(
    (p) => !connectedPlatforms.includes(p),
  )

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex gap-2">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              period === p
                ? 'bg-brand-gold text-bg-base'
                : 'bg-bg-card border border-border text-text-secondary hover:bg-bg-hover'
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      {hasAnyData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard label="Gasto total" value={formatCurrency(summary.totalSpend)} />
          <SummaryCard label="Receita total" value={formatCurrency(summary.totalRevenue)} />
          <SummaryCard label="ROAS" value={summary.roas.toFixed(2) + 'x'} />
          <SummaryCard label="Sessões" value={formatNumber(summary.totalSessions)} />
        </div>
      )}

      {/* Charts per platform */}
      {connectedPlatforms.includes('meta_ads') && (
        <PlatformSection
          title="Meta Ads"
          platform="meta_ads"
          data={byPlatform.get('meta_ads') ?? []}
          lines={[
            { key: 'spend', label: 'Gasto (R$)', color: '#1877F2' },
            { key: 'clicks', label: 'Cliques', color: '#42A5F5' },
            { key: 'conversions', label: 'Conversões', color: '#66BB6A' },
          ]}
        />
      )}

      {connectedPlatforms.includes('google_ads') && (
        <PlatformSection
          title="Google Ads"
          platform="google_ads"
          data={byPlatform.get('google_ads') ?? []}
          lines={[
            { key: 'spend', label: 'Gasto (R$)', color: '#4285F4' },
            { key: 'clicks', label: 'Cliques', color: '#FBBC04' },
            { key: 'conversions', label: 'Conversões', color: '#34A853' },
          ]}
        />
      )}

      {connectedPlatforms.includes('ga4') && (
        <PlatformSection
          title="Google Analytics 4"
          platform="ga4"
          data={byPlatform.get('ga4') ?? []}
          lines={[
            { key: 'sessions', label: 'Sessões', color: '#E37400' },
            { key: 'users', label: 'Usuários', color: '#FF9800' },
            { key: 'pageviews', label: 'Pageviews', color: '#FFB74D' },
          ]}
        />
      )}

      {connectedPlatforms.includes('shopify') && (
        <PlatformSection
          title="Shopify"
          platform="shopify"
          data={byPlatform.get('shopify') ?? []}
          lines={[
            { key: 'revenue', label: 'Receita (R$)', color: '#96BF48' },
            { key: 'orders', label: 'Pedidos', color: '#5C6BC0' },
            { key: 'avg_ticket', label: 'Ticket Médio', color: '#ECA206' },
          ]}
        />
      )}

      {/* Disconnected platforms CTA */}
      {disconnected.length > 0 && (
        <div className="bg-bg-card border border-border rounded-xl p-6">
          <h3 className="text-text-primary font-semibold mb-3">Plataformas não conectadas</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {disconnected.map((p) => (
              <Link
                key={p}
                href="/integracoes"
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-bg-hover transition-colors"
              >
                <div
                  className="w-8 h-8 rounded-md flex items-center justify-center text-white font-bold text-xs"
                  style={{ backgroundColor: PLATFORM_COLORS[p] }}
                >
                  {PLATFORM_LABELS[p][0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">{PLATFORM_LABELS[p]}</p>
                  <p className="text-xs text-text-muted">Conectar para ver métricas</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {!hasAnyData && connectedPlatforms.length > 0 && (
        <div className="bg-bg-card border border-border rounded-xl p-16 text-center">
          <p className="text-text-muted">Nenhuma métrica encontrada neste período.</p>
          <p className="text-text-muted text-sm mt-1">
            Vá em <Link href="/integracoes" className="text-brand-gold hover:underline">Integrações</Link> e clique em &quot;Sincronizar&quot;.
          </p>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Sub-components
// ============================================================

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-4">
      <p className="text-text-muted text-xs font-medium mb-1">{label}</p>
      <p className="text-text-primary text-xl font-bold">{value}</p>
    </div>
  )
}

function PlatformSection({
  title,
  platform,
  data,
  lines,
}: {
  title: string
  platform: string
  data: MetricRow[]
  lines: Array<{ key: string; label: string; color: string }>
}) {
  if (data.length === 0) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-6">
        <h3 className="text-text-primary font-semibold mb-2">{title}</h3>
        <p className="text-text-muted text-sm">
          Nenhuma métrica ainda. Sincronize em{' '}
          <Link href="/integracoes" className="text-brand-gold hover:underline">Integrações</Link>.
        </p>
      </div>
    )
  }

  const chartData = data.map((m) => ({
    date: m.metric_date.slice(5), // MM-DD
    ...m.data,
  }))

  return (
    <div className="bg-bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: PLATFORM_COLORS[platform as keyof typeof PLATFORM_COLORS] }}
        />
        <h3 className="text-text-primary font-semibold">{title}</h3>
        <span className="text-text-muted text-xs ml-auto">{data.length} dias</span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-4">
        {lines.map((line) => (
          <div key={line.key} className="flex items-center gap-1.5 text-xs text-text-secondary">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: line.color }} />
            {line.label}
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1F3D25" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#8B9A8F', fontSize: 11 }}
              axisLine={{ stroke: '#1F3D25' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#8B9A8F', fontSize: 11 }}
              axisLine={{ stroke: '#1F3D25' }}
              tickLine={false}
              width={50}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#122014',
                border: '1px solid #1F3D25',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelStyle={{ color: '#8B9A8F' }}
            />
            {lines.map((line) => (
              <Line
                key={line.key}
                type="monotone"
                dataKey={line.key}
                stroke={line.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ============================================================
// Formatters
// ============================================================

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value)
}
