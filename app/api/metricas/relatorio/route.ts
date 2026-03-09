import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { verifyWorkspaceAccess } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  const { workspace_id, totals, funnel, campaigns, period } = await req.json()

  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (!totals) {
    return NextResponse.json({ error: 'totals required' }, { status: 400 })
  }

  const dataContext = JSON.stringify({ totals, funnel, campaigns, period }, null, 2)

  const systemPrompt = `Você é um analista sênior de mídia especializado em e-commerce brasileiro.
Analise os dados de Meta Ads e gere um relatório executivo com:

## VISÃO GERAL DO PERÍODO

## MÉTRICAS PRINCIPAIS
| Métrica | Valor | Avaliação |
Inclui: Valor Gasto, Receita, ROAS, CPA, Conversões, Taxa de Conversão, CTR, CPM, CPS, CPC, Connect Rate
Use benchmarks reais de e-commerce BR. Avaliação: 🟢 Bom | 🟡 Atenção | 🔴 Crítico

## FUNIL DE CONVERSÃO
Cliques no Link → Visualização da Página de Destino (Connect Rate%) → Checkout → Pagamento → Compra
Para cada etapa: total de eventos | custo por evento | % conversão para próxima etapa
Destaque em negrito a etapa com maior queda.

## CAMPANHAS POR GASTO
| Campanha | Gasto | Receita | ROAS | CPA | Conv. |

## TOP 3 INSIGHTS
1. insight crítico
2. oportunidade
3. tendência

## AÇÕES RECOMENDADAS
3 a 5 ações por ordem de impacto.

Regras:
- Use valores em R$ (BRL)
- Benchmarks e-commerce BR: ROAS bom ≥3x, CTR bom ≥2%, CPM bom ≤R$20, CPA bom ≤R$50
- Seja direto e prático, sem enrolação
- Markdown puro, sem blocos de código`

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Analise os dados de performance do período "${period}" e gere o relatório executivo:\n\n${dataContext}`,
        },
      ],
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'Resposta vazia da IA' }, { status: 500 })
    }

    return NextResponse.json({ report: textBlock.text })
  } catch (err: any) {
    console.error('[metricas/relatorio] error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
