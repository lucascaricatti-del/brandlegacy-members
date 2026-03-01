'use client'

import { useMemo } from 'react'
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

type FinancialRow = {
  id: string
  workspace_id: string
  workspace_name: string
  plan_name: string | null
  status: string
  total_value: number | null
  installments: number | null
  entry_value: number | null
  installment_value: number | null
  first_payment_date: string | null
  is_active: boolean
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-400 bg-green-400/15',
  inadimplente: 'text-red-400 bg-red-400/15',
  cancelled: 'text-text-muted bg-bg-surface',
  completed: 'text-blue-400 bg-blue-400/15',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  inadimplente: 'Inadimplente',
  cancelled: 'Cancelado',
  completed: 'Concluído',
}

export default function FinanceiroClient({ records }: { records: FinancialRow[] }) {
  const summary = useMemo(() => {
    const active = records.filter((r) => r.status === 'active')
    const totalRevenue = records.reduce((sum, r) => sum + (r.total_value ?? 0), 0)
    const inadimplentes = records.filter((r) => r.status === 'inadimplente').length

    // Estimate received: entry + installments paid based on time
    let received = 0
    const today = new Date()
    for (const r of records) {
      if (r.status === 'cancelled') continue
      received += r.entry_value ?? 0
      if (r.first_payment_date && r.installment_value && r.installments) {
        const start = new Date(r.first_payment_date)
        const monthsElapsed = Math.max(0, (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth()))
        const paidInstallments = Math.min(monthsElapsed, r.installments)
        received += paidInstallments * r.installment_value
      }
    }

    return {
      totalActive: active.length,
      totalRevenue,
      received: Math.min(received, totalRevenue),
      pending: Math.max(0, totalRevenue - received),
      inadimplentes,
    }
  }, [records])

  // Monthly chart data
  const chartData = useMemo(() => {
    const monthMap = new Map<string, number>()
    for (const r of records) {
      if (!r.first_payment_date || !r.installment_value || !r.installments) continue
      const start = new Date(r.first_payment_date)
      // Add entry value to first month
      if (r.entry_value) {
        const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
        monthMap.set(key, (monthMap.get(key) ?? 0) + r.entry_value)
      }
      // Add installments
      for (let i = 0; i < r.installments; i++) {
        const d = new Date(start)
        d.setMonth(d.getMonth() + i)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        monthMap.set(key, (monthMap.get(key) ?? 0) + r.installment_value)
      }
    }

    return Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([month, value]) => ({ month: month.slice(2), value: Math.round(value) }))
  }, [records])

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard label="Contratos Ativos" value={String(summary.totalActive)} />
        <MetricCard label="Receita Total" value={formatCurrency(summary.totalRevenue)} />
        <MetricCard label="Recebido" value={formatCurrency(summary.received)} />
        <MetricCard label="A Receber" value={formatCurrency(summary.pending)} />
        <MetricCard label="Inadimplentes" value={String(summary.inadimplentes)} highlight={summary.inadimplentes > 0} />
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-bg-card border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Receita Mensal Prevista</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F3D25" />
                <XAxis dataKey="month" tick={{ fill: '#8B9A8F', fontSize: 11 }} axisLine={{ stroke: '#1F3D25' }} tickLine={false} />
                <YAxis tick={{ fill: '#8B9A8F', fontSize: 11 }} axisLine={{ stroke: '#1F3D25' }} tickLine={false} width={60} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#122014', border: '1px solid #1F3D25', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(value?: number) => [formatCurrency(value ?? 0), 'Receita']}
                />
                <Line type="monotone" dataKey="value" stroke="#ECA206" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-text-muted font-medium">Empresa</th>
                <th className="text-left px-4 py-3 text-text-muted font-medium">Plano</th>
                <th className="text-left px-4 py-3 text-text-muted font-medium">Status</th>
                <th className="text-right px-4 py-3 text-text-muted font-medium">Valor Total</th>
                <th className="text-right px-4 py-3 text-text-muted font-medium">Parcelas</th>
                <th className="text-left px-4 py-3 text-text-muted font-medium">Início</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                    Nenhum registro financeiro cadastrado.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-bg-surface/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/admin/workspaces/${r.workspace_id}`} className="text-text-primary hover:text-brand-gold transition-colors font-medium">
                        {r.workspace_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{r.plan_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] ?? STATUS_COLORS.active}`}>
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-text-primary font-medium">
                      {r.total_value ? formatCurrency(r.total_value) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-text-secondary">
                      {r.installments ? `${r.installments}x` : '—'}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {r.first_payment_date
                        ? new Date(r.first_payment_date + 'T12:00:00').toLocaleDateString('pt-BR')
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-4">
      <p className="text-text-muted text-xs font-medium mb-1">{label}</p>
      <p className={`text-xl font-bold ${highlight ? 'text-error' : 'text-text-primary'}`}>{value}</p>
    </div>
  )
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}
