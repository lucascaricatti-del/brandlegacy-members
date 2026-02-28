// ============================================================
// Media Plan Calculation Engine
// ============================================================

export const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const
export const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// KEY metrics = editable by user
export const KEY_METRICS = ['S_ORG', 'CR', 'AOV', 'CPC', 'SPEND', 'RET', 'RECEITA_META'] as const
export type KeyMetric = typeof KEY_METRICS[number]

// RESULT metrics = calculated
export const RESULT_METRICS = [
  'S_PAGAS', 'S_TOTAL',
  'PEDIDOS_ORG', 'PEDIDOS_PAGOS', 'PEDIDOS_TOTAL',
  'RECEITA', 'RECEITA_NOVOS', 'RECEITA_RET',
  'ROAS', 'CAC', 'CPP', 'MARGEM',
] as const
export type ResultMetric = typeof RESULT_METRICS[number]

export type MetricKey = KeyMetric | ResultMetric

export function isKeyMetric(key: string): key is KeyMetric {
  return (KEY_METRICS as readonly string[]).includes(key)
}

// Metric definitions with labels, format, and section
export interface MetricDef {
  key: MetricKey
  label: string
  section: 'receita' | 'pedidos' | 'investimentos' | 'trafego' | 'eficiencia'
  format: 'number' | 'currency' | 'percent' | 'decimal'
  isKey: boolean
  decimals?: number
}

export const METRIC_DEFS: MetricDef[] = [
  // RECEITA
  { key: 'RECEITA_META', label: 'Meta de Receita', section: 'receita', format: 'currency', isKey: true },
  { key: 'RECEITA', label: 'Receita Projetada', section: 'receita', format: 'currency', isKey: false },
  { key: 'RECEITA_NOVOS', label: 'Receita Novos', section: 'receita', format: 'currency', isKey: false },
  { key: 'RECEITA_RET', label: 'Receita Retenção', section: 'receita', format: 'currency', isKey: false },
  { key: 'MARGEM', label: 'Margem', section: 'receita', format: 'currency', isKey: false },

  // PEDIDOS
  { key: 'PEDIDOS_TOTAL', label: 'Pedidos Totais', section: 'pedidos', format: 'number', isKey: false },
  { key: 'PEDIDOS_PAGOS', label: 'Pedidos Pagos', section: 'pedidos', format: 'number', isKey: false },
  { key: 'PEDIDOS_ORG', label: 'Pedidos Orgânicos', section: 'pedidos', format: 'number', isKey: false },

  // INVESTIMENTOS
  { key: 'SPEND', label: 'Investimento em Mídia', section: 'investimentos', format: 'currency', isKey: true },
  { key: 'CPC', label: 'Custo por Clique', section: 'investimentos', format: 'currency', isKey: true, decimals: 2 },
  { key: 'CAC', label: 'CAC', section: 'investimentos', format: 'currency', isKey: false, decimals: 2 },
  { key: 'CPP', label: 'Custo por Pedido', section: 'investimentos', format: 'currency', isKey: false, decimals: 2 },

  // TRÁFEGO
  { key: 'S_TOTAL', label: 'Sessões Totais', section: 'trafego', format: 'number', isKey: false },
  { key: 'S_PAGAS', label: 'Sessões Pagas', section: 'trafego', format: 'number', isKey: false },
  { key: 'S_ORG', label: 'Sessões Orgânicas', section: 'trafego', format: 'number', isKey: true },

  // EFICIÊNCIA
  { key: 'CR', label: 'Taxa de Conversão', section: 'eficiencia', format: 'percent', isKey: true, decimals: 2 },
  { key: 'AOV', label: 'Ticket Médio', section: 'eficiencia', format: 'currency', isKey: true, decimals: 2 },
  { key: 'ROAS', label: 'ROAS', section: 'eficiencia', format: 'decimal', isKey: false, decimals: 2 },
  { key: 'RET', label: 'Taxa de Retenção', section: 'eficiencia', format: 'percent', isKey: true, decimals: 1 },
]

export const METRIC_MAP = Object.fromEntries(METRIC_DEFS.map((d) => [d.key, d])) as Record<MetricKey, MetricDef>

export const SECTIONS = [
  { key: 'receita', label: 'Receita', color: 'text-green-400', bgColor: 'bg-green-400/10' },
  { key: 'pedidos', label: 'Pedidos', color: 'text-blue-400', bgColor: 'bg-blue-400/10' },
  { key: 'investimentos', label: 'Investimentos', color: 'text-red-400', bgColor: 'bg-red-400/10' },
  { key: 'trafego', label: 'Tráfego', color: 'text-purple-400', bgColor: 'bg-purple-400/10' },
  { key: 'eficiencia', label: 'Eficiência', color: 'text-brand-gold', bgColor: 'bg-brand-gold/10' },
] as const

// Map of key values per month → { metricKey: { month: value } }
export type KeyValues = Record<string, Record<number, number>>

// Calculate all result metrics for a given month based on key values
export function calcMonth(keys: KeyValues, month: number): Record<ResultMetric, number> {
  const get = (k: string) => keys[k]?.[month] ?? 0

  const sOrg = get('S_ORG')
  const cr = get('CR') / 100 // stored as percentage
  const aov = get('AOV')
  const cpc = get('CPC')
  const spend = get('SPEND')
  const ret = get('RET') / 100 // stored as percentage

  const sPagas = cpc > 0 ? spend / cpc : 0
  const sTotal = sOrg + sPagas
  const pedidosOrg = sOrg * cr
  const pedidosPagos = sPagas * cr
  const pedidosTotal = pedidosOrg + pedidosPagos
  const receita = pedidosTotal * aov
  const receitaRet = receita * ret
  const receitaNovos = receita * (1 - ret)
  const roas = spend > 0 ? receita / spend : 0
  const cac = pedidosPagos > 0 ? spend / pedidosPagos : 0
  const cpp = pedidosTotal > 0 ? spend / pedidosTotal : 0
  const margem = receita - spend

  return {
    S_PAGAS: Math.round(sPagas),
    S_TOTAL: Math.round(sTotal),
    PEDIDOS_ORG: Math.round(pedidosOrg),
    PEDIDOS_PAGOS: Math.round(pedidosPagos),
    PEDIDOS_TOTAL: Math.round(pedidosTotal),
    RECEITA: Math.round(receita * 100) / 100,
    RECEITA_NOVOS: Math.round(receitaNovos * 100) / 100,
    RECEITA_RET: Math.round(receitaRet * 100) / 100,
    ROAS: Math.round(roas * 100) / 100,
    CAC: Math.round(cac * 100) / 100,
    CPP: Math.round(cpp * 100) / 100,
    MARGEM: Math.round(margem * 100) / 100,
  }
}

// Calculate all 12 months
export function calcAllMonths(keys: KeyValues): Record<number, Record<ResultMetric, number>> {
  const result: Record<number, Record<ResultMetric, number>> = {}
  for (const m of MONTHS) {
    result[m] = calcMonth(keys, m)
  }
  return result
}

// Resolve delta_pct mode: for month N, value = previous_month_value * (1 + delta_pct/100)
export function resolveValue(
  metric: string,
  month: number,
  rawValues: Record<string, Record<number, { value: number | null; delta_pct: number | null; mode: 'value' | 'delta_pct' }>>,
): number {
  const cell = rawValues[metric]?.[month]
  if (!cell) return 0

  if (cell.mode === 'value' || month === 1) {
    return cell.value ?? 0
  }

  // delta_pct mode: resolve previous month first
  const prevValue = resolveValue(metric, month - 1, rawValues)
  const delta = cell.delta_pct ?? 0
  return prevValue * (1 + delta / 100)
}

// Format a value for display
export function formatMetricValue(value: number, format: MetricDef['format'], decimals?: number): string {
  if (format === 'currency') {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: decimals ?? 0, maximumFractionDigits: decimals ?? 0 })
  }
  if (format === 'percent') {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: decimals ?? 1, maximumFractionDigits: decimals ?? 1 }) + '%'
  }
  if (format === 'decimal') {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: decimals ?? 2, maximumFractionDigits: decimals ?? 2 })
  }
  // number
  return Math.round(value).toLocaleString('pt-BR')
}

// Calculate annual totals/averages
export function calcAnnualSummary(
  keys: KeyValues,
  results: Record<number, Record<ResultMetric, number>>,
): Record<MetricKey, number> {
  const summary: Record<string, number> = {}

  // For rate metrics (CR, RET, ROAS, AOV, CPC, CAC, CPP), use average
  // For volume metrics (sessions, orders, revenue, spend), use sum
  const avgMetrics = new Set(['CR', 'RET', 'ROAS', 'AOV', 'CPC', 'CAC', 'CPP'])

  for (const def of METRIC_DEFS) {
    let total = 0
    let count = 0
    for (const m of MONTHS) {
      const v = def.isKey ? (keys[def.key]?.[m] ?? 0) : (results[m]?.[def.key as ResultMetric] ?? 0)
      if (v !== 0 || (keys[def.key]?.[m] !== undefined)) {
        total += v
        count++
      }
    }
    if (avgMetrics.has(def.key)) {
      summary[def.key] = count > 0 ? Math.round((total / count) * 100) / 100 : 0
    } else {
      summary[def.key] = Math.round(total * 100) / 100
    }
  }

  return summary as Record<MetricKey, number>
}
