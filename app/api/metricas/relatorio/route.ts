import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  const { totals, funnel, campaigns, period } = await req.json()

  if (!totals) {
    return NextResponse.json({ error: 'totals required' }, { status: 400 })
  }

  const dataContext = JSON.stringify({ totals, funnel, campaigns, period }, null, 2)

  const systemPrompt = `Você é um analista sênior de tráfego pago e e-commerce brasileiro.
Receba os dados de performance e gere um relatório executivo em Markdown.

Estrutura obrigatória:
## Resumo Executivo
Parágrafo curto com visão geral do período.

## KPIs Principais
Tabela markdown com: Investimento, Receita, ROAS, CPA, CPM, CTR, Conversões, Taxa de Conversão, Connect Rate, CPS.
Inclua se cada KPI está bom (🟢), aceitável (🟡) ou ruim (🔴) para e-commerce BR.

## Análise do Funil
Se houver dados de funil, analise cada etapa, identifique o maior gargalo e sugira melhorias.

## Performance por Campanha
Destaque as 3 melhores e 3 piores campanhas por ROAS. Sugira ações para cada.

## Recomendações
3-5 ações práticas e específicas para melhorar resultados no próximo período.

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
