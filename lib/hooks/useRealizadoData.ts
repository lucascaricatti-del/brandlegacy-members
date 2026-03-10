'use client'

// Legacy type export — kept for backwards compatibility
// Realizado is now manual input stored in media_plan_metrics (is_realizado=true)
// and sales_forecast (is_realizado=true)
export interface MonthRealizado {
  receita_captada: number
  receita_faturada: number
  pedidos_captados: number
  pedidos_faturados: number
  ticket_medio: number
  meta_spend: number
  google_spend: number
  influencer_spend: number
  investimento_total: number
  ga4_sessions: number
  organic_sessions: number
  paid_sessions: number
  roas: number
  cac: number
}
