'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') throw new Error('Acesso negado')
  return { supabase, user }
}

// ============================================================
// WORKSPACE CONTEXT — CRUD
// ============================================================

export async function getWorkspaceContext(workspaceId: string) {
  const adminSupabase = createAdminClient()

  const { data } = await adminSupabase
    .from('workspace_context')
    .select('*')
    .eq('workspace_id', workspaceId)
    .single()

  return data
}

export async function saveWorkspaceContext(
  workspaceId: string,
  fields: {
    business_type: string
    business_description: string
    monthly_revenue: string
    team_size: string
    main_goal: string
    main_challenge: string
    mentorship_stage: string
    extra_context: string
  },
) {
  await requireAdmin()
  const adminSupabase = createAdminClient()

  const { data: existing } = await adminSupabase
    .from('workspace_context')
    .select('id')
    .eq('workspace_id', workspaceId)
    .single()

  if (existing) {
    const { error } = await adminSupabase
      .from('workspace_context')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', existing.id)

    if (error) return { error: error.message }
  } else {
    const { error } = await adminSupabase
      .from('workspace_context')
      .insert({ workspace_id: workspaceId, ...fields })

    if (error) return { error: error.message }
  }

  revalidatePath(`/admin/agentes/config/${workspaceId}`)
  return { success: true }
}

// ============================================================
// AGENT CONFIG — por tipo (diagnostic, plan, mentoring)
// ============================================================

export async function getAgentConfig(workspaceId: string, agentType: string) {
  const adminSupabase = createAdminClient()

  const { data } = await adminSupabase
    .from('agent_configs')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('agent_type', agentType)
    .single()

  return data
}

export async function getAgentConfigs(workspaceId: string) {
  const adminSupabase = createAdminClient()

  const { data } = await adminSupabase
    .from('agent_configs')
    .select('*')
    .eq('workspace_id', workspaceId)

  return data ?? []
}

export async function saveAgentConfig(
  workspaceId: string,
  agentType: string,
  systemPrompt: string,
) {
  await requireAdmin()
  const adminSupabase = createAdminClient()

  if (!systemPrompt.trim()) return { error: 'System prompt é obrigatório' }

  const { data: existing } = await adminSupabase
    .from('agent_configs')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('agent_type', agentType)
    .single()

  if (existing) {
    const { error } = await adminSupabase
      .from('agent_configs')
      .update({
        system_prompt: systemPrompt.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (error) return { error: error.message }
  } else {
    const { error } = await adminSupabase
      .from('agent_configs')
      .insert({
        workspace_id: workspaceId,
        agent_type: agentType,
        system_prompt: systemPrompt.trim(),
      })

    if (error) return { error: error.message }
  }

  revalidatePath(`/admin/agentes/config/${workspaceId}`)
  return { success: true }
}

// ============================================================
// BUILD CONTEXT STRING — helper para injetar nos prompts
// ============================================================

export async function buildContextString(workspaceId: string): Promise<string> {
  const ctx = await getWorkspaceContext(workspaceId)
  if (!ctx) return '[sem contexto cadastrado]'

  const BUSINESS_TYPE_LABELS: Record<string, string> = {
    ecommerce: 'E-commerce',
    servicos: 'Serviços',
    saas: 'SaaS',
    infoproduto: 'Infoproduto',
    agencia: 'Agência',
    consultoria: 'Consultoria',
    varejo: 'Varejo',
    outro: 'Outro',
  }

  const REVENUE_LABELS: Record<string, string> = {
    ate_50k: 'Até R$ 50k/mês',
    '50k_200k': 'R$ 50k - 200k/mês',
    '200k_1m': 'R$ 200k - 1M/mês',
    acima_1m: 'Acima de R$ 1M/mês',
  }

  const parts: string[] = []
  if (ctx.business_type) parts.push(`Tipo de negócio: ${BUSINESS_TYPE_LABELS[ctx.business_type] ?? ctx.business_type}`)
  if (ctx.business_description) parts.push(`Descrição: ${ctx.business_description}`)
  if (ctx.monthly_revenue) parts.push(`Faturamento: ${REVENUE_LABELS[ctx.monthly_revenue] ?? ctx.monthly_revenue}`)
  if (ctx.team_size) parts.push(`Tamanho da equipe: ${ctx.team_size}`)
  if (ctx.main_goal) parts.push(`Objetivo principal: ${ctx.main_goal}`)
  if (ctx.main_challenge) parts.push(`Principal desafio: ${ctx.main_challenge}`)
  if (ctx.mentorship_stage) parts.push(`Estágio da mentoria: ${ctx.mentorship_stage}`)
  if (ctx.extra_context) parts.push(`Contexto extra: ${ctx.extra_context}`)

  return parts.length > 0 ? parts.join('\n') : '[sem contexto cadastrado]'
}

// ============================================================
// DEFAULT PROMPTS — os 3 agentes
// ============================================================

export const DEFAULT_PROMPTS: Record<string, string> = {
  diagnostic: `Você é um consultor sênior especializado em diagnóstico de negócios digitais brasileiros.

CONTEXTO DO NEGÓCIO:
{{context}}

Analise a transcrição da reunião de diagnóstico e gere um relatório executivo completo. Identifique:
1. RESUMO EXECUTIVO — visão geral do estado atual do negócio
2. PONTOS FORTES — o que está funcionando bem
3. GARGALOS — problemas operacionais, de marketing, vendas ou gestão
4. OPORTUNIDADES — áreas de crescimento identificadas
5. RISCOS — ameaças ao negócio que precisam de atenção
6. RECOMENDAÇÕES — próximos passos sugeridos

IMPORTANTE: Este é um agente de DIAGNÓSTICO. NÃO gere tarefas. O objetivo é mapear a situação atual.

Retorne APENAS JSON válido:
{
  "summary": "resumo executivo em 3-5 frases",
  "strengths": ["ponto forte 1", "ponto forte 2"],
  "bottlenecks": ["gargalo 1", "gargalo 2"],
  "opportunities": ["oportunidade 1"],
  "risks": ["risco 1"],
  "recommendations": ["recomendação 1"]
}
Responda SOMENTE com o JSON, sem texto adicional, sem markdown, sem blocos de código.`,

  plan: `Você é um consultor especialista em execução e crescimento de negócios digitais.

CONTEXTO DO NEGÓCIO:
{{context}}

DIAGNÓSTICO ANTERIOR (se disponível):
{{diagnosis}}

Analise a transcrição da reunião e crie um plano de ação completo. Extraia TODAS as tarefas discutidas, sem limitar quantidade.

Para cada tarefa, defina a prioridade:
- URGENTE: deve ser feita esta semana
- ALTA: próximas 2 semanas
- MÉDIA: próximo mês
- BAIXA: quando possível

Retorne APENAS JSON válido:
{
  "summary": "resumo executivo do plano",
  "decisions": ["decisão 1", "decisão 2"],
  "risks": ["risco ou ponto de atenção 1"],
  "tasks": [
    {
      "title": "tarefa clara e acionável (começa com verbo)",
      "responsible": "nome da pessoa ou null",
      "due_date": "YYYY-MM-DD ou null",
      "priority": "baixa|media|alta|urgente"
    }
  ]
}
Responda SOMENTE com o JSON, sem texto adicional, sem markdown, sem blocos de código.`,

  mentoring: `Você é um assistente de mentoria especializado em acompanhamento de negócios digitais brasileiros.

CONTEXTO DO NEGÓCIO:
{{context}}

Analise a transcrição da reunião de mentoria/acompanhamento e extraia:
1. Resumo do que foi discutido
2. Decisões tomadas
3. Riscos identificados
4. Tópicos para a próxima sessão
5. TODAS as tarefas mencionadas — extraia tudo, sem limitar quantidade

Para cada tarefa, defina prioridade:
- URGENTE: esta semana
- ALTA: próximas 2 semanas
- MÉDIA: próximo mês
- BAIXA: quando possível

Retorne APENAS JSON válido:
{
  "summary": "resumo da sessão em 3-5 frases",
  "decisions": ["decisão 1"],
  "risks": ["risco 1"],
  "next_session_topics": ["tópico 1"],
  "tasks": [
    {
      "title": "tarefa clara e acionável",
      "responsible": "nome ou null",
      "due_date": "YYYY-MM-DD ou null",
      "priority": "baixa|media|alta|urgente"
    }
  ]
}
Responda SOMENTE com o JSON, sem texto adicional, sem markdown, sem blocos de código.`,
}

export const AGENT_TYPE_LABELS: Record<string, string> = {
  diagnostic: 'Diagnóstico',
  plan: 'Plano de Ação',
  mentoring: 'Mentoria',
}
