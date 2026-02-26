'use server'

import { revalidatePath } from 'next/cache'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { KanbanPriority } from '@/lib/types/database'

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
) {
  await requireAdmin()
  const adminSupabase = createAdminClient()

  if (!title.trim()) return { error: 'Título é obrigatório' }

  const { data, error } = await adminSupabase
    .from('sessions')
    .insert({
      workspace_id: workspaceId,
      title: title.trim(),
      session_date: sessionDate || null,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/admin/workspaces/${workspaceId}/sessoes`)
  return { success: true, sessionId: data.id }
}

// ============================================================
// ANALISAR TRANSCRIÇÃO COM IA
// ============================================================

interface AIAnalysisResult {
  summary: string
  decisions: string[]
  risks: string[]
  tasks: {
    title: string
    responsible: string | null
    due_date: string | null
    priority: 'baixa' | 'media' | 'alta' | 'urgente'
  }[]
}

export async function analyzeTranscript(
  sessionId: string,
  workspaceId: string,
  transcript: string,
) {
  await requireAdmin()
  const adminSupabase = createAdminClient()

  if (!transcript.trim()) return { error: 'Transcrição vazia' }

  // Marca como "analyzing"
  await adminSupabase
    .from('sessions')
    .update({ status: 'analyzing', transcript: transcript.trim() })
    .eq('id', sessionId)

  try {
    const anthropic = new Anthropic()

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: `Você é um assistente especializado em análise de reuniões de mentoria empresarial.
Analise a transcrição e retorne APENAS um JSON válido com esta estrutura exata:
{
  "summary": "resumo executivo em 3-5 frases",
  "decisions": ["decisão 1", "decisão 2"],
  "risks": ["risco ou ponto de atenção 1", "risco 2"],
  "tasks": [
    {
      "title": "título da tarefa clara e acionável",
      "responsible": "nome da pessoa responsável ou null",
      "due_date": "YYYY-MM-DD ou null",
      "priority": "baixa|media|alta|urgente"
    }
  ]
}
Responda SOMENTE com o JSON, sem texto adicional, sem markdown, sem blocos de código.`,
      messages: [
        { role: 'user', content: transcript.trim() },
      ],
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Resposta vazia da IA')
    }

    const result: AIAnalysisResult = JSON.parse(textBlock.text)

    // Salva resultados na sessão
    await adminSupabase
      .from('sessions')
      .update({
        summary: result.summary,
        decisions: JSON.stringify(result.decisions),
        risks: JSON.stringify(result.risks),
        status: 'completed',
      })
      .eq('id', sessionId)

    // Salva tarefas extraídas
    if (result.tasks.length > 0) {
      const taskRows = result.tasks.map((t) => ({
        session_id: sessionId,
        workspace_id: workspaceId,
        title: t.title,
        responsible: t.responsible || null,
        due_date: t.due_date || null,
        priority: t.priority || 'media',
      }))

      await adminSupabase.from('session_tasks').insert(taskRows)
    }

    revalidatePath(`/admin/workspaces/${workspaceId}/sessoes`)
    return { success: true }
  } catch (err) {
    // Marca como erro
    await adminSupabase
      .from('sessions')
      .update({ status: 'error' })
      .eq('id', sessionId)

    revalidatePath(`/admin/workspaces/${workspaceId}/sessoes`)
    return { error: err instanceof Error ? err.message : 'Erro ao analisar transcrição' }
  }
}

// ============================================================
// ADICIONAR TAREFA AO KANBAN
// ============================================================

const PRIORITY_MAP: Record<string, KanbanPriority> = {
  baixa: 'low',
  media: 'medium',
  alta: 'high',
  urgente: 'urgent',
}

export async function addSessionTaskToKanban(taskId: string, workspaceId: string) {
  await requireAdmin()
  const adminSupabase = createAdminClient()

  // Busca a tarefa
  const { data: task } = await adminSupabase
    .from('session_tasks')
    .select('*')
    .eq('id', taskId)
    .single()

  if (!task) return { error: 'Tarefa não encontrada' }
  if (task.kanban_card_id) return { error: 'Tarefa já adicionada ao Kanban' }

  // Busca board + primeira coluna do workspace
  const { data: board } = await adminSupabase
    .from('kanban_boards')
    .select('id')
    .eq('workspace_id', workspaceId)
    .single()

  if (!board) return { error: 'Board Kanban não encontrado. Crie o board primeiro.' }

  const { data: firstCol } = await adminSupabase
    .from('kanban_columns')
    .select('id')
    .eq('board_id', board.id)
    .order('order_index')
    .limit(1)
    .single()

  if (!firstCol) return { error: 'Nenhuma coluna encontrada no board.' }

  // Calcula order_index
  const { data: lastCard } = await adminSupabase
    .from('kanban_cards')
    .select('order_index')
    .eq('column_id', firstCol.id)
    .eq('is_archived', false)
    .order('order_index', { ascending: false })
    .limit(1)
    .single()

  const order_index = (lastCard?.order_index ?? -1) + 1

  // Cria card no kanban
  const { data: card, error: insertError } = await adminSupabase
    .from('kanban_cards')
    .insert({
      column_id: firstCol.id,
      title: task.title,
      description: task.responsible ? `Responsável: ${task.responsible}` : null,
      priority: PRIORITY_MAP[task.priority] || 'medium',
      due_date: task.due_date || null,
      order_index,
    })
    .select('id')
    .single()

  if (insertError || !card) return { error: insertError?.message ?? 'Erro ao criar card' }

  // Vincula card à task
  await adminSupabase
    .from('session_tasks')
    .update({ kanban_card_id: card.id })
    .eq('id', taskId)

  revalidatePath(`/admin/workspaces/${workspaceId}/sessoes`)
  revalidatePath(`/admin/workspaces/${workspaceId}/kanban`)
  revalidatePath('/workspace/kanban')
  return { success: true }
}

// ============================================================
// ADICIONAR TODAS AS TAREFAS AO KANBAN
// ============================================================

export async function addAllSessionTasksToKanban(sessionId: string, workspaceId: string) {
  await requireAdmin()
  const adminSupabase = createAdminClient()

  const { data: tasks } = await adminSupabase
    .from('session_tasks')
    .select('id')
    .eq('session_id', sessionId)
    .is('kanban_card_id', null)

  if (!tasks || tasks.length === 0) return { error: 'Nenhuma tarefa pendente para adicionar' }

  const results: { taskId: string; success: boolean; error?: string }[] = []

  for (const t of tasks) {
    const result = await addSessionTaskToKanban(t.id, workspaceId)
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
