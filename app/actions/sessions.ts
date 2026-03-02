'use server'

import { revalidatePath } from 'next/cache'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAgentConfig, buildContextString } from './agents'
import { DEFAULT_PROMPTS } from '@/lib/constants/agents'

function extractJSON(text: string): string {
  return text.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim()
}

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
// CRIAR SESSÃO
// ============================================================

export async function createSession(
  workspaceId: string,
  title: string,
  sessionDate: string | null,
  agentType: string,
  diagnosisSessionId: string | null,
) {
  await requireAdmin()
  const adminSupabase = createAdminClient()

  if (!title.trim()) return { error: 'Título é obrigatório' }
  if (!agentType) return { error: 'Tipo de agente é obrigatório' }

  const { data, error } = await adminSupabase
    .from('sessions')
    .insert({
      workspace_id: workspaceId,
      title: title.trim(),
      session_date: sessionDate || null,
      agent_type: agentType,
      diagnosis_session_id: diagnosisSessionId || null,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/admin/workspaces/${workspaceId}/sessoes`)
  return { success: true, sessionId: data.id }
}

// ============================================================
// RESOLVE SYSTEM PROMPT
// Busca config customizada → fallback para default do tipo
// Injeta {{context}} e {{diagnosis}}
// ============================================================

async function resolveSystemPrompt(
  workspaceId: string,
  agentType: string,
  diagnosisSessionId: string | null,
  adminSupabase: ReturnType<typeof createAdminClient>,
): Promise<string> {
  // 1. Tenta config customizada do workspace para este tipo
  const config = await getAgentConfig(workspaceId, agentType)
  let basePrompt = config?.system_prompt ?? DEFAULT_PROMPTS[agentType] ?? DEFAULT_PROMPTS.mentoring

  // 2. Injeta {{context}}
  if (basePrompt.includes('{{context}}')) {
    const contextStr = await buildContextString(workspaceId)
    basePrompt = basePrompt.replace('{{context}}', contextStr)
  }

  // 3. Injeta {{diagnosis}} (para performance — antigo plano de ação)
  if (basePrompt.includes('{{diagnosis}}') && diagnosisSessionId) {
    const { data: diagSession } = await adminSupabase
      .from('sessions')
      .select('result_json, summary')
      .eq('id', diagnosisSessionId)
      .single()

    let diagnosisStr = '[sem diagnóstico anterior]'
    if (diagSession?.result_json) {
      try {
        const parsed = JSON.parse(diagSession.result_json)
        const parts: string[] = []
        if (parsed.summary) parts.push(`Resumo: ${parsed.summary}`)
        if (parsed.strengths?.length) parts.push(`Pontos fortes: ${parsed.strengths.join('; ')}`)
        if (parsed.bottlenecks?.length) parts.push(`Gargalos: ${parsed.bottlenecks.join('; ')}`)
        if (parsed.opportunities?.length) parts.push(`Oportunidades: ${parsed.opportunities.join('; ')}`)
        if (parsed.risks?.length) parts.push(`Riscos: ${parsed.risks.join('; ')}`)
        if (parsed.recommendations?.length) parts.push(`Recomendações: ${parsed.recommendations.join('; ')}`)
        diagnosisStr = parts.join('\n')
      } catch {
        diagnosisStr = diagSession.summary ?? '[sem diagnóstico anterior]'
      }
    } else if (diagSession?.summary) {
      diagnosisStr = diagSession.summary
    }

    basePrompt = basePrompt.replace('{{diagnosis}}', diagnosisStr)
  } else if (basePrompt.includes('{{diagnosis}}')) {
    basePrompt = basePrompt.replace('{{diagnosis}}', '[sem diagnóstico anterior]')
  }

  return basePrompt
}

// ============================================================
// ANALISAR TRANSCRIÇÃO COM IA
// ============================================================

export async function analyzeTranscript(
  sessionId: string,
  workspaceId: string,
  transcript: string,
) {
  await requireAdmin()
  const adminSupabase = createAdminClient()

  if (!transcript.trim()) return { error: 'Transcrição vazia' }

  // Busca agent_type da sessão
  const { data: session } = await adminSupabase
    .from('sessions')
    .select('agent_type, diagnosis_session_id')
    .eq('id', sessionId)
    .single()

  const agentType = session?.agent_type ?? 'mentoring'
  const diagnosisSessionId = session?.diagnosis_session_id ?? null

  // Marca como "analyzing"
  await adminSupabase
    .from('sessions')
    .update({ status: 'analyzing', transcript: transcript.trim() })
    .eq('id', sessionId)

  try {
    const systemPrompt = await resolveSystemPrompt(workspaceId, agentType, diagnosisSessionId, adminSupabase)

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [
        { role: 'user', content: transcript.trim() },
      ],
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Resposta vazia da IA')
    }

    const result = JSON.parse(extractJSON(textBlock.text))

    // Salva resultado bruto como JSON
    await adminSupabase
      .from('sessions')
      .update({
        summary: result.summary ?? null,
        decisions: result.decisions ? JSON.stringify(result.decisions) : null,
        risks: result.risks ? JSON.stringify(result.risks) : null,
        result_json: textBlock.text,
        status: 'completed',
      })
      .eq('id', sessionId)

    // Salva tarefas (apenas para plan e mentoring)
    if (agentType !== 'diagnostic' && result.tasks?.length > 0) {
      const taskRows = result.tasks.map((t: { title: string; responsible?: string; due_date?: string; priority?: string }) => ({
        session_id: sessionId,
        workspace_id: workspaceId,
        title: t.title,
        responsible: t.responsible || null,
        due_date: t.due_date || null,
        priority: t.priority || 'media',
      }))

      const { error: tasksInsertError } = await adminSupabase.from('session_tasks').insert(taskRows)
      if (tasksInsertError) {
        console.error('[analyzeTranscript] insert session_tasks failed:', tasksInsertError, { sessionId, workspaceId })
      }
    }

    revalidatePath(`/admin/workspaces/${workspaceId}/sessoes`)
    return { success: true }
  } catch (err) {
    await adminSupabase
      .from('sessions')
      .update({ status: 'error' })
      .eq('id', sessionId)

    revalidatePath(`/admin/workspaces/${workspaceId}/sessoes`)
    return { error: err instanceof Error ? err.message : 'Erro ao analisar transcrição' }
  }
}

// ============================================================
// ADICIONAR TAREFA AO TASKFLOW
// ============================================================

export async function addSessionTaskToTaskFlow(taskId: string, workspaceId: string) {
  const { user } = await requireAdmin()
  const adminSupabase = createAdminClient()

  const { data: sessionTask } = await adminSupabase
    .from('session_tasks')
    .select('*')
    .eq('id', taskId)
    .single()

  if (!sessionTask) return { error: 'Tarefa não encontrada' }
  if (sessionTask.task_id || sessionTask.kanban_card_id) return { error: 'Tarefa já adicionada' }

  const { data: task, error: insertError } = await adminSupabase
    .from('tasks')
    .insert({
      workspace_id: workspaceId,
      session_id: sessionTask.session_id,
      title: sessionTask.title,
      responsible: sessionTask.responsible || null,
      due_date: sessionTask.due_date || null,
      priority: (sessionTask.priority || 'media') as 'baixa' | 'media' | 'alta' | 'urgente',
      status: 'pendente',
      is_archived: false,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (insertError || !task) {
    console.error('[addSessionTaskToTaskFlow] insert tasks failed:', insertError, { workspaceId, sessionId: sessionTask.session_id, userId: user.id })
    return { error: insertError?.message ?? 'Erro ao criar tarefa' }
  }

  // Marca como adicionada via task_id
  await adminSupabase
    .from('session_tasks')
    .update({ task_id: task.id })
    .eq('id', taskId)

  revalidatePath(`/admin/workspaces/${workspaceId}/sessoes`)
  revalidatePath(`/admin/workspaces/${workspaceId}/tasks`)
  revalidatePath('/workspace/tasks', 'page')
  return { success: true }
}

// ============================================================
// ADICIONAR TODAS AS TAREFAS AO TASKFLOW
// ============================================================

export async function addAllSessionTasksToTaskFlow(sessionId: string, workspaceId: string) {
  await requireAdmin()
  const adminSupabase = createAdminClient()

  const { data: tasks } = await adminSupabase
    .from('session_tasks')
    .select('id')
    .eq('session_id', sessionId)
    .is('task_id', null)

  if (!tasks || tasks.length === 0) return { error: 'Nenhuma tarefa pendente para adicionar' }

  const results: { taskId: string; success: boolean; error?: string }[] = []

  for (const t of tasks) {
    const result = await addSessionTaskToTaskFlow(t.id, workspaceId)
    results.push({
      taskId: t.id,
      success: !('error' in result),
      error: 'error' in result ? result.error : undefined,
    })
  }

  const failed = results.filter((r) => !r.success)
  if (failed.length > 0) {
    return { error: `${failed.length} tarefa(s) não puderam ser adicionadas` }
  }

  revalidatePath(`/admin/workspaces/${workspaceId}/sessoes`)
  return { success: true, count: results.length }
}

// ============================================================
// UPDATE SESSION TASK (edição inline)
// ============================================================

export async function updateSessionTask(
  taskId: string,
  workspaceId: string,
  data: {
    title?: string
    responsible?: string | null
    due_date?: string | null
    priority?: string
  },
) {
  await requireAdmin()
  const adminSupabase = createAdminClient()

  const updateData: Record<string, unknown> = {}
  if (data.title !== undefined) updateData.title = data.title.trim()
  if (data.responsible !== undefined) updateData.responsible = data.responsible
  if (data.due_date !== undefined) updateData.due_date = data.due_date
  if (data.priority !== undefined) updateData.priority = data.priority

  const { error } = await adminSupabase
    .from('session_tasks')
    .update(updateData)
    .eq('id', taskId)

  if (error) return { error: error.message }

  revalidatePath(`/admin/workspaces/${workspaceId}/sessoes`)
  return { success: true }
}

// ============================================================
// CREATE MANUAL SESSION TASK
// ============================================================

export async function createSessionTask(
  sessionId: string,
  workspaceId: string,
  data: {
    title: string
    responsible?: string | null
    due_date?: string | null
    priority?: string
  },
) {
  await requireAdmin()
  const adminSupabase = createAdminClient()

  if (!data.title?.trim()) return { error: 'Título é obrigatório' }

  const { error } = await adminSupabase
    .from('session_tasks')
    .insert({
      session_id: sessionId,
      workspace_id: workspaceId,
      title: data.title.trim(),
      responsible: data.responsible || null,
      due_date: data.due_date || null,
      priority: data.priority || 'media',
    })

  if (error) return { error: error.message }

  revalidatePath(`/admin/workspaces/${workspaceId}/sessoes`)
  return { success: true }
}

// ============================================================
// DELETAR SESSÃO
// ============================================================

export async function deleteSession(sessionId: string, workspaceId: string) {
  await requireAdmin()
  const adminSupabase = createAdminClient()

  const { error } = await adminSupabase
    .from('sessions')
    .delete()
    .eq('id', sessionId)

  if (error) return { error: error.message }

  revalidatePath(`/admin/workspaces/${workspaceId}/sessoes`)
  return { success: true }
}
