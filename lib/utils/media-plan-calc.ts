// ============================================================
// Media Plan Calculation Engine v3
// ============================================================

export const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const
export const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// KEY metrics = editable by user
export const KEY_METRICS = [
  'RECEITA_META',
  'S_ORG', 'CR', 'AOV', 'APR', 'RET',
  'SPEND_META', 'SPEND_GOOGLE', 'SPEND_INFLUENCER',
  'CPS',
] as const
export type KeyMetric = typeof KEY_METRICS[number]

// RESULT metrics = calculated
export const RESULT_METRICS = [
  'SPEND_TOTAL',
  'ORD_PAID', 'ORD_ORG', 'ORD_CAPTURED', 'ORD_BILLED',
  'REV_CAPTURED', 'REV_BILLED',
  'ROAS_CAPTURED', 'ROAS_BILLED', 'ADCOST',
  'S_PAID_IMPLIED', 'S_TOTAL',
] as const
export type ResultMetric = typeof RESULT_METRICS[number]

export type MetricKey = KeyMetric | ResultMetric

export function isKeyMetric(key: string): key is KeyMetric {
  return (KEY_METRICS as readonly string[]).includes(key)
}

// Metric definitions
export interface MetricDef {
  key: MetricKey
  label: string
  section: 'receita' | 'pedidos' | 'investimentos' | 'trafego' | 'eficiencia'
  format: 'number' | 'currency' | 'percent' | 'decimal'
  isKey: boolean
  decimals?: number
  isHighlight?: boolean
  isSubtotal?: boolean
}

export const METRIC_DEFS: MetricDef[] = [
  // RECEITA
  { key: 'RECEITA_META', label: 'Meta de Receita', section: 'receita', format: 'currency', isKey: true, decimals: 2 },
  { key: 'REV_CAPTURED', label: 'Receita Capturada', section: 'receita', format: 'currency', isKey: false, decimals: 2, isHighlight: true },
  { key: 'REV_BILLED', label: 'Receita Faturada', section: 'receita', format: 'currency', isKey: false, decimals: 2, isHighlight: true },

  // PEDIDOS
  { key: 'ORD_CAPTURED', label: 'Pedidos Capturados', section: 'pedidos', format: 'number', isKey: false, isHighlight: true },
  { key: 'ORD_BILLED', label: 'Pedidos Faturados', section: 'pedidos', format: 'number', isKey: false },
  { key: 'ORD_PAID', label: 'Pedidos Pagos (Mídia)', section: 'pedidos', format: 'number', isKey: false, isSubtotal: true },
  { key: 'ORD_ORG', label: 'Pedidos Orgânicos', section: 'pedidos', format: 'number', isKey: false },

  // INVESTIMENTOS
  { key: 'SPEND_META', label: 'Investimento Meta Ads', section: 'investimentos', format: 'currency', isKey: true, decimals: 2 },
  { key: 'SPEND_GOOGLE', label: 'Investimento Google Ads', section: 'investimentos', format: 'currency', isKey: true, decimals: 2 },
  { key: 'SPEND_INFLUENCER', label: 'Investimento Influenciadores', section: 'investimentos', format: 'currency', isKey: true, decimals: 2 },
  { key: 'SPEND_TOTAL', label: 'Investimento Total', section: 'investimentos', format: 'currency', isKey: false, decimals: 2, isSubtotal: true },
  { key: 'CPS', label: 'Custo por Sessão (CPS)', section: 'investimentos', format: 'currency', isKey: true, decimals: 2 },
  { key: 'ADCOST', label: 'Ad Cost %', section: 'investimentos', format: 'percent', isKey: false, decimals: 1 },

  // TRÁFEGO
  { key: 'S_ORG', label: 'Sessões Orgânicas', section: 'trafego', format: 'number', isKey: true },
  { key: 'S_PAID_IMPLIED', label: 'Sessões Pagas (implícito)', section: 'trafego', format: 'number', isKey: false },
  { key: 'S_TOTAL', label: 'Sessões Totais', section: 'trafego', format: 'number', isKey: false },

  // EFICIÊNCIA
  { key: 'CR', label: 'Taxa de Conversão', section: 'eficiencia', format: 'percent', isKey: true, decimals: 2 },
  { key: 'AOV', label: 'Ticket Médio', section: 'eficiencia', format: 'currency', isKey: true, decimals: 2 },
  { key: 'APR', label: 'Taxa de Aprovação', section: 'eficiencia', format: 'percent', isKey: true, decimals: 1 },
  { key: 'RET', label: 'Taxa de Retenção', section: 'eficiencia', format: 'percent', isKey: true, decimals: 1 },
  { key: 'ROAS_CAPTURED', label: 'ROAS Capturado', section: 'eficiencia', format: 'decimal', isKey: false, decimals: 2, isHighlight: true },
  { key: 'ROAS_BILLED', label: 'ROAS Faturado', section: 'eficiencia', format: 'decimal', isKey: false, decimals: 2, isHighlight: true },
]

export const METRIC_MAP = Object.fromEntries(METRIC_DEFS.map((d) => [d.key, d])) as Record<MetricKey, MetricDef>

export const SECTIONS = [
  { key: 'receita', label: 'Receita', icon: '\uD83D\uDCCA', color: 'text-green-400', bgColor: 'bg-green-400/10' },
  { key: 'pedidos', label: 'Pedidos', icon: '\uD83D\uDED2', color: 'text-blue-400', bgColor: 'bg-blue-400/10' },
  { key: 'investimentos', label: 'Investimentos', icon: '\uD83D\uDCB0', color: 'text-red-400', bgColor: 'bg-red-400/10' },
  { key: 'trafego', label: 'Tráfego', icon: '\uD83D\uDCC8', color: 'text-purple-400', bgColor: 'bg-purple-400/10' },
  { key: 'eficiencia', label: 'Eficiência', icon: '\u26A1', color: 'text-brand-gold', bgColor: 'bg-brand-gold/10' },
] as const

// Map of key values per month
export type KeyValues = Record<string, Record<number, number>>

const round2 = (v: number) => Math.round(v * 100) / 100

// Calculate all result metrics for a given month
export function calcMonth(keys: KeyValues, month: number): Record<ResultMetric, number> {
  const get = (k: string) => keys[k]?.[month] ?? 0

  const sOrg = get('S_ORG')
  const cr = get('CR') / 100        // stored as %, e.g. 3 → 0.03
  const aov = get('AOV')
  const apr = get('APR') / 100       // stored as %, e.g. 85 → 0.85

  const spendMeta = get('SPEND_META')
  const spendGoogle = get('SPEND_GOOGLE')
  const spendInfluencer = get('SPEND_INFLUENCER')
  const cps = get('CPS')

  // Investimentos
  const spendTotal = spendMeta + spendGoogle + spendInfluencer

  // Tráfego (calcula primeiro - CPS é custo por sessão)
  const sPaidImplied = cps > 0 ? spendTotal / cps : 0
  const sTotal = sOrg + sPaidImplied

  // Pedidos
  const ordPaid = sPaidImplied * cr
  const ordOrg = sOrg * cr
  const ordCaptured = ordOrg + ordPaid
  const ordBilled = ordCaptured * apr

  // Receita
  const revCaptured = ordCaptured * aov
  const revBilled = revCaptured * apr

  // Eficiência
  const roasCaptured = spendTotal > 0 ? revCaptured / spendTotal : 0
  const roasBilled = spendTotal > 0 ? revBilled / spendTotal : 0
  const adcost = revBilled > 0 ? (spendTotal / revBilled) * 100 : 0  // as %

  return {
    SPEND_TOTAL: round2(spendTotal),
    ORD_PAID: Math.round(ordPaid),
    ORD_ORG: Math.round(ordOrg),
    ORD_CAPTURED: Math.round(ordCaptured),
    ORD_BILLED: Math.round(ordBilled),
    REV_CAPTURED: round2(revCaptured),
    REV_BILLED: round2(revBilled),
    ROAS_CAPTURED: round2(roasCaptured),
    ROAS_BILLED: round2(roasBilled),
    ADCOST: round2(adcost),
    S_PAID_IMPLIED: Math.round(sPaidImplied),
    S_TOTAL: Math.round(sTotal),
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

// Resolve delta_pct mode
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

  const prevValue = resolveValue(metric, month - 1, rawValues)
  const delta = cell.delta_pct ?? 0
  return prevValue * (1 + delta / 100)
}

// Format a value for display — R$ prefix for currency
export function formatMetricValue(value: number, format: MetricDef['format'], decimals?: number): string {
  if (format === 'currency') {
    const formatted = value.toLocaleString('pt-BR', {
      minimumFractionDigits: decimals ?? 2,
      maximumFractionDigits: decimals ?? 2,
    })
    return `R$ ${formatted}`
  }
  if (format === 'percent') {
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: decimals ?? 1,
      maximumFractionDigits: decimals ?? 1,
    }) + '%'
  }
  if (format === 'decimal') {
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: decimals ?? 2,
      maximumFractionDigits: decimals ?? 2,
    })
  }
  return Math.round(value).toLocaleString('pt-BR')
}

// Calculate annual totals/averages
export function calcAnnualSummary(
  keys: KeyValues,
  results: Record<number, Record<ResultMetric, number>>,
): Record<MetricKey, number> {
  const summary: Record<string, number> = {}

  // Rate/efficiency metrics use average; volume metrics use sum
  const avgMetrics = new Set([
    'CR', 'RET', 'AOV', 'APR', 'CPS',
    'ROAS_CAPTURED', 'ROAS_BILLED', 'ADCOST',
  ])

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
      summary[def.key] = count > 0 ? round2(total / count) : 0
    } else {
      summary[def.key] = round2(total)
    }
  }

  return summary as Record<MetricKey, number>
}
