// ============================================================
// Financial Plan (DRE) Calculation Engine v1
// Connects to Media Planner via ROAS Faturado
// ============================================================

export const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const
export const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export const FIN_KEY_METRICS = [
  'FATURAMENTO',
  'IMPOSTOS_PCT',
  'CANCELAMENTOS_PCT',
  'CMV_PCT',
  'LOGISTICA_PCT',
  'TAXA_CHECKOUT_PCT',
  'GATEWAY_PCT',
  'MIDIA_PCT',
  'COMISSOES_PCT',
  'ROYALTIES_PCT',
  'FERRAMENTAS_MKT_PCT',
  'DESP_FIXAS',
  'DESP_VARIAVEIS',
  'IRPJ_CSLL_PCT',
] as const
export type FinKeyMetric = typeof FIN_KEY_METRICS[number]

export const FIN_RESULT_METRICS = [
  'IMPOSTOS_VAL',
  'CANCELAMENTOS_VAL',
  'FAT_LIQUIDO',
  'CMV_VAL',
  'LOGISTICA_VAL',
  'TAXA_CHECKOUT_VAL',
  'GATEWAY_VAL',
  'MARGEM_CONTRIB',
  'MIDIA_VAL',
  'COMISSOES_VAL',
  'ROYALTIES_VAL',
  'FERRAMENTAS_MKT_VAL',
  'LUCRO_AQUISICAO',
  'EBITDA',
  'IRPJ_CSLL_VAL',
  'LUCRO_LIQUIDO',
  'MARGEM_CONTRIB_PCT',
  'MARGEM_AQUISICAO_PCT',
  'MARGEM_EBITDA_PCT',
  'MARGEM_LIQUIDA_PCT',
] as const
export type FinResultMetric = typeof FIN_RESULT_METRICS[number]

export type FinMetricKey = FinKeyMetric | FinResultMetric

export function isFinKeyMetric(key: string): key is FinKeyMetric {
  return (FIN_KEY_METRICS as readonly string[]).includes(key)
}

export interface FinMetricDef {
  key: FinMetricKey
  label: string
  section: 'faturamento' | 'deducoes' | 'custos_variaveis' | 'aquisicao' | 'despesas' | 'resultado'
  format: 'number' | 'currency' | 'percent' | 'decimal'
  isKey: boolean
  decimals?: number
  isHighlight?: boolean
  isSubtotal?: boolean
  isNegative?: boolean
  tooltip?: string
}

export const FIN_METRIC_DEFS: FinMetricDef[] = [
  // FATURAMENTO
  { key: 'FATURAMENTO', label: 'Faturamento Bruto', section: 'faturamento', format: 'currency', isKey: true, decimals: 2, isHighlight: true },

  // DEDUCOES DA VENDA BRUTA
  { key: 'IMPOSTOS_PCT', label: 'Impostos sobre Venda', section: 'deducoes', format: 'percent', isKey: true, decimals: 1, isNegative: true, tooltip: '% sobre faturamento bruto' },
  { key: 'IMPOSTOS_VAL', label: 'Impostos (R$)', section: 'deducoes', format: 'currency', isKey: false, decimals: 2, isNegative: true },
  { key: 'CANCELAMENTOS_PCT', label: 'Cancelamentos e Reembolsos', section: 'deducoes', format: 'percent', isKey: true, decimals: 1, isNegative: true, tooltip: '% sobre faturamento bruto' },
  { key: 'CANCELAMENTOS_VAL', label: 'Cancelamentos (R$)', section: 'deducoes', format: 'currency', isKey: false, decimals: 2, isNegative: true },
  { key: 'FAT_LIQUIDO', label: 'Faturamento Líquido', section: 'deducoes', format: 'currency', isKey: false, decimals: 2, isSubtotal: true },

  // CUSTOS VARIAVEIS DIRETOS
  { key: 'CMV_PCT', label: 'CMV', section: 'custos_variaveis', format: 'percent', isKey: true, decimals: 1, isNegative: true, tooltip: '% sobre faturamento bruto' },
  { key: 'CMV_VAL', label: 'CMV (R$)', section: 'custos_variaveis', format: 'currency', isKey: false, decimals: 2, isNegative: true },
  { key: 'LOGISTICA_PCT', label: 'Logística / Fulfillment', section: 'custos_variaveis', format: 'percent', isKey: true, decimals: 1, isNegative: true, tooltip: '% sobre faturamento bruto' },
  { key: 'LOGISTICA_VAL', label: 'Logística (R$)', section: 'custos_variaveis', format: 'currency', isKey: false, decimals: 2, isNegative: true },
  { key: 'TAXA_CHECKOUT_PCT', label: 'Taxa Checkout', section: 'custos_variaveis', format: 'percent', isKey: true, decimals: 1, isNegative: true, tooltip: '% sobre faturamento bruto' },
  { key: 'TAXA_CHECKOUT_VAL', label: 'Taxa Checkout (R$)', section: 'custos_variaveis', format: 'currency', isKey: false, decimals: 2, isNegative: true },
  { key: 'GATEWAY_PCT', label: 'Gateway', section: 'custos_variaveis', format: 'percent', isKey: true, decimals: 1, isNegative: true, tooltip: '% sobre faturamento bruto' },
  { key: 'GATEWAY_VAL', label: 'Gateway (R$)', section: 'custos_variaveis', format: 'currency', isKey: false, decimals: 2, isNegative: true },
  { key: 'MARGEM_CONTRIB', label: 'Margem de Contribuição', section: 'custos_variaveis', format: 'currency', isKey: false, decimals: 2, isSubtotal: true },
  { key: 'MARGEM_CONTRIB_PCT', label: 'Margem de Contribuição %', section: 'custos_variaveis', format: 'percent', isKey: false, decimals: 1 },

  // CUSTOS DE AQUISICAO
  { key: 'MIDIA_PCT', label: 'Mídia (Meta, Google, Influ...)', section: 'aquisicao', format: 'percent', isKey: true, decimals: 1, isNegative: true, tooltip: 'Auto: 100 / ROAS Faturado do Planejador de Mídia' },
  { key: 'MIDIA_VAL', label: 'Mídia (R$)', section: 'aquisicao', format: 'currency', isKey: false, decimals: 2, isNegative: true },
  { key: 'COMISSOES_PCT', label: 'Comissões / Agências', section: 'aquisicao', format: 'percent', isKey: true, decimals: 1, isNegative: true, tooltip: '% sobre faturamento bruto' },
  { key: 'COMISSOES_VAL', label: 'Comissões (R$)', section: 'aquisicao', format: 'currency', isKey: false, decimals: 2, isNegative: true },
  { key: 'ROYALTIES_PCT', label: 'Royalties', section: 'aquisicao', format: 'percent', isKey: true, decimals: 1, isNegative: true, tooltip: '% sobre faturamento bruto' },
  { key: 'ROYALTIES_VAL', label: 'Royalties (R$)', section: 'aquisicao', format: 'currency', isKey: false, decimals: 2, isNegative: true },
  { key: 'FERRAMENTAS_MKT_PCT', label: 'Ferramentas MKT', section: 'aquisicao', format: 'percent', isKey: true, decimals: 1, isNegative: true, tooltip: '% sobre faturamento bruto' },
  { key: 'FERRAMENTAS_MKT_VAL', label: 'Ferramentas MKT (R$)', section: 'aquisicao', format: 'currency', isKey: false, decimals: 2, isNegative: true },
  { key: 'LUCRO_AQUISICAO', label: 'Lucro após Aquisição', section: 'aquisicao', format: 'currency', isKey: false, decimals: 2, isSubtotal: true },
  { key: 'MARGEM_AQUISICAO_PCT', label: 'Margem após Aquisição %', section: 'aquisicao', format: 'percent', isKey: false, decimals: 1 },

  // DESPESAS E EBITDA
  { key: 'DESP_FIXAS', label: 'Despesas Fixas (Time/Aluguel)', section: 'despesas', format: 'currency', isKey: true, decimals: 2, isNegative: true },
  { key: 'DESP_VARIAVEIS', label: 'Despesas Variáveis (Bônus/Ações)', section: 'despesas', format: 'currency', isKey: true, decimals: 2, isNegative: true },
  { key: 'EBITDA', label: 'EBITDA', section: 'despesas', format: 'currency', isKey: false, decimals: 2, isHighlight: true },
  { key: 'MARGEM_EBITDA_PCT', label: 'Margem EBITDA %', section: 'despesas', format: 'percent', isKey: false, decimals: 1 },

  // RESULTADO FINAL
  { key: 'IRPJ_CSLL_PCT', label: 'IRPJ / CSLL', section: 'resultado', format: 'percent', isKey: true, decimals: 1, isNegative: true, tooltip: '% sobre EBITDA' },
  { key: 'IRPJ_CSLL_VAL', label: 'IRPJ / CSLL (R$)', section: 'resultado', format: 'currency', isKey: false, decimals: 2, isNegative: true },
  { key: 'LUCRO_LIQUIDO', label: 'Lucro Líquido', section: 'resultado', format: 'currency', isKey: false, decimals: 2, isHighlight: true },
  { key: 'MARGEM_LIQUIDA_PCT', label: 'Margem Líquida %', section: 'resultado', format: 'percent', isKey: false, decimals: 1, isHighlight: true },
]

export const FIN_METRIC_MAP = Object.fromEntries(FIN_METRIC_DEFS.map((d) => [d.key, d])) as Record<FinMetricKey, FinMetricDef>

export const FIN_SECTIONS = [
  { key: 'faturamento', label: 'Faturamento', icon: '💰', color: 'text-green-400', bgColor: 'bg-green-400/10' },
  { key: 'deducoes', label: 'Deduções da Venda Bruta', icon: '📉', color: 'text-red-400', bgColor: 'bg-red-400/10' },
  { key: 'custos_variaveis', label: 'Custos Variáveis Diretos', icon: '📦', color: 'text-orange-400', bgColor: 'bg-orange-400/10' },
  { key: 'aquisicao', label: 'Custos de Aquisição', icon: '📢', color: 'text-purple-400', bgColor: 'bg-purple-400/10' },
  { key: 'despesas', label: 'Despesas e EBITDA', icon: '🏢', color: 'text-blue-400', bgColor: 'bg-blue-400/10' },
  { key: 'resultado', label: 'Resultado Final', icon: '🏆', color: 'text-brand-gold', bgColor: 'bg-brand-gold/10' },
] as const

export type FinKeyValues = Record<string, Record<number, number>>

const round2 = (v: number) => Math.round(v * 100) / 100

export function calcFinMonth(
  keys: FinKeyValues,
  month: number,
  roas_billed?: number,
): Record<FinResultMetric, number> {
  const get = (k: string) => keys[k]?.[month] ?? 0

  const faturamento = get('FATURAMENTO')

  // Deducoes da venda bruta
  const impostosPct = get('IMPOSTOS_PCT') / 100
  const cancelPct = get('CANCELAMENTOS_PCT') / 100
  const impostosVal = faturamento * impostosPct
  const cancelVal = faturamento * cancelPct
  const fatLiquido = faturamento - impostosVal - cancelVal

  // Custos variaveis diretos (% sobre faturamento bruto)
  const cmvPct = get('CMV_PCT') / 100
  const logisticaPct = get('LOGISTICA_PCT') / 100
  const checkoutPct = get('TAXA_CHECKOUT_PCT') / 100
  const gatewayPct = get('GATEWAY_PCT') / 100
  const cmvVal = faturamento * cmvPct
  const logisticaVal = faturamento * logisticaPct
  const checkoutVal = faturamento * checkoutPct
  const gatewayVal = faturamento * gatewayPct
  const margemContrib = fatLiquido - cmvVal - logisticaVal - checkoutVal - gatewayVal
  const margemContribPct = faturamento > 0 ? (margemContrib / faturamento) * 100 : 0

  // Custos de aquisicao
  let midiaPct = get('MIDIA_PCT') / 100
  if (midiaPct === 0 && roas_billed && roas_billed > 0) {
    midiaPct = 1 / roas_billed
  }
  const comissoesPct = get('COMISSOES_PCT') / 100
  const royaltiesPct = get('ROYALTIES_PCT') / 100
  const ferramentasPct = get('FERRAMENTAS_MKT_PCT') / 100
  const midiaVal = faturamento * midiaPct
  const comissoesVal = faturamento * comissoesPct
  const royaltiesVal = faturamento * royaltiesPct
  const ferramentasVal = faturamento * ferramentasPct
  const lucroAquisicao = margemContrib - midiaVal - comissoesVal - royaltiesVal - ferramentasVal
  const margemAquisicaoPct = faturamento > 0 ? (lucroAquisicao / faturamento) * 100 : 0

  // Despesas
  const despFixas = get('DESP_FIXAS')
  const despVariaveis = get('DESP_VARIAVEIS')
  const ebitda = lucroAquisicao - despFixas - despVariaveis
  const margemEbitdaPct = faturamento > 0 ? (ebitda / faturamento) * 100 : 0

  // Resultado final
  const irpjPct = get('IRPJ_CSLL_PCT') / 100
  const irpjVal = ebitda > 0 ? ebitda * irpjPct : 0
  const lucroLiquido = ebitda - irpjVal
  const margemLiquidaPct = faturamento > 0 ? (lucroLiquido / faturamento) * 100 : 0

  return {
    IMPOSTOS_VAL: round2(impostosVal),
    CANCELAMENTOS_VAL: round2(cancelVal),
    FAT_LIQUIDO: round2(fatLiquido),
    CMV_VAL: round2(cmvVal),
    LOGISTICA_VAL: round2(logisticaVal),
    TAXA_CHECKOUT_VAL: round2(checkoutVal),
    GATEWAY_VAL: round2(gatewayVal),
    MARGEM_CONTRIB: round2(margemContrib),
    MARGEM_CONTRIB_PCT: round2(margemContribPct),
    MIDIA_VAL: round2(midiaVal),
    COMISSOES_VAL: round2(comissoesVal),
    ROYALTIES_VAL: round2(royaltiesVal),
    FERRAMENTAS_MKT_VAL: round2(ferramentasVal),
    LUCRO_AQUISICAO: round2(lucroAquisicao),
    MARGEM_AQUISICAO_PCT: round2(margemAquisicaoPct),
    EBITDA: round2(ebitda),
    MARGEM_EBITDA_PCT: round2(margemEbitdaPct),
    IRPJ_CSLL_VAL: round2(irpjVal),
    LUCRO_LIQUIDO: round2(lucroLiquido),
    MARGEM_LIQUIDA_PCT: round2(margemLiquidaPct),
  }
}

export function calcFinAllMonths(
  keys: FinKeyValues,
  roasByMonth?: Record<number, number>,
): Record<number, Record<FinResultMetric, number>> {
  const result: Record<number, Record<FinResultMetric, number>> = {}
  for (const m of MONTHS) {
    result[m] = calcFinMonth(keys, m, roasByMonth?.[m])
  }
  return result
}

export function resolveFinValue(
  metric: string,
  month: number,
  rawValues: Record<string, Record<number, { value: number | null; delta_pct: number | null; mode: 'value' | 'delta_pct' }>>,
): number {
  const cell = rawValues[metric]?.[month]
  if (!cell) return 0
  if (cell.mode === 'value' || month === 1) {
    return cell.value ?? 0
  }
  const prevValue = resolveFinValue(metric, month - 1, rawValues)
  const delta = cell.delta_pct ?? 0
  return prevValue * (1 + delta / 100)
}

export function formatFinValue(value: number, format: FinMetricDef['format'], decimals?: number): string {
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

export function calcFinAnnualSummary(
  keys: FinKeyValues,
  results: Record<number, Record<FinResultMetric, number>>,
): Record<FinMetricKey, number> {
  const summary: Record<string, number> = {}

  const avgMetrics = new Set([
    'IMPOSTOS_PCT', 'CANCELAMENTOS_PCT',
    'CMV_PCT', 'LOGISTICA_PCT', 'TAXA_CHECKOUT_PCT', 'GATEWAY_PCT',
    'MIDIA_PCT', 'COMISSOES_PCT', 'ROYALTIES_PCT', 'FERRAMENTAS_MKT_PCT',
    'IRPJ_CSLL_PCT',
    'MARGEM_CONTRIB_PCT', 'MARGEM_AQUISICAO_PCT', 'MARGEM_EBITDA_PCT', 'MARGEM_LIQUIDA_PCT',
  ])

  for (const def of FIN_METRIC_DEFS) {
    let total = 0
    let count = 0
    for (const m of MONTHS) {
      const v = def.isKey
        ? (keys[def.key]?.[m] ?? 0)
        : (results[m]?.[def.key as FinResultMetric] ?? 0)
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

  const fatTotal = summary['FATURAMENTO'] ?? 0
  if (fatTotal > 0) {
    summary['MARGEM_CONTRIB_PCT'] = round2(((summary['MARGEM_CONTRIB'] ?? 0) / fatTotal) * 100)
    summary['MARGEM_AQUISICAO_PCT'] = round2(((summary['LUCRO_AQUISICAO'] ?? 0) / fatTotal) * 100)
    summary['MARGEM_EBITDA_PCT'] = round2(((summary['EBITDA'] ?? 0) / fatTotal) * 100)
    summary['MARGEM_LIQUIDA_PCT'] = round2(((summary['LUCRO_LIQUIDO'] ?? 0) / fatTotal) * 100)
  }

  return summary as Record<FinMetricKey, number>
}