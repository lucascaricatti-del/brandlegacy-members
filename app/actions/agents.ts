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

  if (ctx) {
    if (ctx.business_type) parts.push(`Tipo de negócio: ${BUSINESS_TYPE_LABELS[ctx.business_type] ?? ctx.business_type}`)
    if (ctx.business_description) parts.push(`Descrição: ${ctx.business_description}`)
    if (ctx.monthly_revenue) parts.push(`Faturamento: ${REVENUE_LABELS[ctx.monthly_revenue] ?? ctx.monthly_revenue}`)
    if (ctx.team_size) parts.push(`Tamanho da equipe: ${ctx.team_size}`)
    if (ctx.main_goal) parts.push(`Objetivo principal: ${ctx.main_goal}`)
    if (ctx.main_challenge) parts.push(`Principal desafio: ${ctx.main_challenge}`)
    if (ctx.mentorship_stage) parts.push(`Estágio da mentoria: ${ctx.mentorship_stage}`)
    if (ctx.extra_context) parts.push(`Contexto extra: ${ctx.extra_context}`)
  }

  // Injetar métricas de integrações (últimos 30 dias)
  const { getMetricsSummary } = await import('@/app/actions/integrations')
  const metricsSummary = await getMetricsSummary(workspaceId, 30)

  if (metricsSummary) {
    const PLATFORM_NAMES: Record<string, string> = {
      meta_ads: 'Meta Ads',
      google_ads: 'Google Ads',
      ga4: 'Google Analytics 4',
      shopify: 'Shopify',
    }

    const METRIC_LABELS: Record<string, string> = {
      spend: 'Gasto (R$)',
      impressions: 'Impressões',
      clicks: 'Cliques',
      cpc: 'CPC médio (R$)',
      cpm: 'CPM médio (R$)',
      ctr: 'CTR (%)',
      conversions: 'Conversões',
      sessions: 'Sessões',
      users: 'Usuários',
      pageviews: 'Pageviews',
      bounce_rate: 'Taxa de rejeição (%)',
      revenue: 'Receita (R$)',
      orders: 'Pedidos',
      items_sold: 'Itens vendidos',
      avg_ticket: 'Ticket médio (R$)',
    }

    parts.push('\n--- Métricas de Plataformas (últimos 30 dias) ---')
    for (const [platform, metrics] of Object.entries(metricsSummary)) {
      const platformName = PLATFORM_NAMES[platform] ?? platform
      const metricLines = Object.entries(metrics)
        .map(([key, value]) => `  ${METRIC_LABELS[key] ?? key}: ${typeof value === 'number' ? value.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : value}`)
        .join('\n')
      parts.push(`${platformName}:\n${metricLines}`)
    }
  }

  return parts.length > 0 ? parts.join('\n') : '[sem contexto cadastrado]'
}

