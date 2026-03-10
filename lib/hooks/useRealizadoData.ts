'use client'

import { useState, useEffect } from 'react'

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

export function useRealizadoData(workspaceId: string, year: number) {
  const [data, setData] = useState<Record<string, MonthRealizado>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch('/api/business-plan/realizado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: workspaceId, year }),
    })
      .then(r => r.json())
      .then(d => { if (d && !d.error) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [workspaceId, year])

  return { realizado: data, loadingRealizado: loading }
}
