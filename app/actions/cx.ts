'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'

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

export type WorkspaceHealth = {
  workspace_id: string
  workspace_name: string
  status: 'em_dia' | 'atencao' | 'churn'
  last_session_date: string | null
  total_tasks: number
  completed_tasks: number
  overdue_tasks: number
  days_inactive: number
  renewal_date: string | null
  summary: string | null
  recommendations: string[]
}

// ============================================================
// GET ALL WORKSPACE HEALTH DATA
// ============================================================

export async function getWorkspacesHealth(): Promise<WorkspaceHealth[]> {
  await requireAdmin()
  const adminSupabase = createAdminClient()

  const { data: workspaces } = await adminSupabase
    .from('workspaces')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  if (!workspaces || workspaces.length === 0) return []

  // Batch fetch financial_info for renewal_date
  const wsIds = workspaces.map((w) => w.id)
  const { data: financialInfos } = await adminSupabase
    .from('financial_info')
    .select('workspace_id, renewal_date')
    .in('workspace_id', wsIds)

  const renewalMap = Object.fromEntries(
    (financialInfos ?? []).map((fi) => [fi.workspace_id, fi.renewal_date])
  )

  const today = new Date()
  const results: WorkspaceHealth[] = []

  for (const ws of workspaces) {
    // Last session
    const { data: lastSession } = await adminSupabase
      .from('sessions')
      .select('session_date, created_at')
      .eq('workspace_id', ws.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const lastSessionDate = lastSession?.session_date ?? lastSession?.created_at ?? null

    // Tasks
    const { data: tasks } = await adminSupabase
      .from('tasks')
      .select('status, due_date')
      .eq('workspace_id', ws.id)
      .eq('is_archived', false)

    const allTasks = tasks ?? []
    const totalTasks = allTasks.length
    const completedTasks = allTasks.filter((t) => t.status === 'concluida').length
    const todayStr = today.toISOString().split('T')[0]
    const overdueTasks = allTasks.filter(
      (t) => t.status !== 'concluida' && t.due_date && t.due_date < todayStr,
    ).length

    // Days inactive
    let daysInactive = 999
    if (lastSessionDate) {
      const lastDate = new Date(lastSessionDate)
      daysInactive = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
    }

    // Classify status
    let status: 'em_dia' | 'atencao' | 'churn' = 'em_dia'
    if (daysInactive > 15 || overdueTasks > 3) {
      status = 'churn'
    } else if (daysInactive > 7 || overdueTasks > 1) {
      status = 'atencao'
    }

    results.push({
      workspace_id: ws.id,
      workspace_name: ws.name,
      status,
      last_session_date: lastSessionDate,
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      overdue_tasks: overdueTasks,
      days_inactive: daysInactive === 999 ? -1 : daysInactive,
      renewal_date: renewalMap[ws.id] ?? null,
      summary: null,
      recommendations: [],
    })
  }

  return results
}

// ============================================================
// ANALYZE WORKSPACE WITH AI
// ============================================================

export async function analyzeWorkspaceHealth(workspaceId: string): Promise<WorkspaceHealth | { error: string }> {
  await requireAdmin()
  const adminSupabase = createAdminClient()

  const { data: ws } = await adminSupabase
    .from('workspaces')
    .select('id, name')
    .eq('id', workspaceId)
    .single()

  if (!ws) return { error: 'Workspace não encontrado' }

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const { data: lastSession } = await adminSupabase
    .from('sessions')
    .select('session_date, created_at')
    .eq('workspace_id', workspaceId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const lastSessionDate = lastSession?.session_date ?? lastSession?.created_at ?? null

  const { data: tasks } = await adminSupabase
    .from('tasks')
    .select('status, due_date')
    .eq('workspace_id', workspaceId)
    .eq('is_archived', false)

  const allTasks = tasks ?? []
  const totalTasks = allTasks.length
  const completedTasks = allTasks.filter((t) => t.status === 'concluida').length
  const overdueTasks = allTasks.filter(
    (t) => t.status !== 'concluida' && t.due_date && t.due_date < todayStr,
  ).length

  let daysInactive = -1
  if (lastSessionDate) {
    daysInactive = Math.floor((today.getTime() - new Date(lastSessionDate).getTime()) / (1000 * 60 * 60 * 24))
  }

  // Fetch renewal_date
  const { data: financialInfo } = await adminSupabase
    .from('financial_info')
    .select('renewal_date')
    .eq('workspace_id', workspaceId)
    .single()

  const renewalDate = financialInfo?.renewal_date ?? null

  const prompt = `Você é um especialista em Customer Success para mentorias empresariais.
Analise os dados do mentorado e classifique o risco de churn.

Dados:
- Última sessão: ${lastSessionDate ? new Date(lastSessionDate).toLocaleDateString('pt-BR') : 'Nunca'}
- Total de tarefas: ${totalTasks}
- Tarefas concluídas: ${completedTasks}
- Tarefas atrasadas: ${overdueTasks}
- Dias sem movimentação: ${daysInactive === -1 ? 'Sem dados' : daysInactive}

Retorne APENAS JSON válido:
{
  "status": "em_dia|atencao|churn",
  "summary": "análise em 2 frases",
  "recommendations": ["ação recomendada 1", "ação 2"]
}
Responda SOMENTE com o JSON, sem texto adicional.`

  try {
    const anthropic = new Anthropic()
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return { error: 'Resposta vazia da IA' }
    }

    const result = JSON.parse(textBlock.text) as {
      status: 'em_dia' | 'atencao' | 'churn'
      summary: string
      recommendations: string[]
    }

    return {
      workspace_id: ws.id,
      workspace_name: ws.name,
      status: result.status,
      last_session_date: lastSessionDate,
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      overdue_tasks: overdueTasks,
      days_inactive: daysInactive,
      renewal_date: renewalDate,
      summary: result.summary,
      recommendations: result.recommendations ?? [],
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao analisar' }
  }
}
