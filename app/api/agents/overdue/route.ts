import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// ── Types ────────────────────────────────────────────────────

interface OverdueCard {
  id: string
  title: string
  due_date: string
  priority: string
  column_title: string
  assignee_name: string | null
}

interface WorkspaceOverdue {
  workspaceId: string
  workspaceName: string
  ownerEmail: string | null
  cards: OverdueCard[]
}

// ── Priority labels ──────────────────────────────────────────

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
}

// ── GET handler ──────────────────────────────────────────────

export async function GET(request: Request) {
  // Verifica autenticação via CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminSupabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  try {
    // 1. Busca todos os workspaces ativos
    const { data: workspaces } = await adminSupabase
      .from('workspaces')
      .select('id, name')
      .eq('is_active', true)

    if (!workspaces || workspaces.length === 0) {
      return NextResponse.json({ message: 'Nenhum workspace ativo', processed: 0 })
    }

    const results: { workspaceId: string; cardsFound: number; emailSent: boolean }[] = []

    for (const ws of workspaces) {
      // 2. Busca board do workspace
      const { data: board } = await adminSupabase
        .from('kanban_boards')
        .select('id')
        .eq('workspace_id', ws.id)
        .single()

      if (!board) continue

      // 3. Busca colunas + cards vencidos (excluindo coluna "Concluído")
      type RawCol = {
        id: string
        title: string
        kanban_cards: {
          id: string
          title: string
          due_date: string | null
          priority: string
          is_archived: boolean
          assignee_id: string | null
          profiles: { name: string } | null
        }[]
      }

      const { data: columns } = await adminSupabase
        .from('kanban_columns')
        .select(`
          id, title,
          kanban_cards(
            id, title, due_date, priority, is_archived, assignee_id,
            profiles:assignee_id(name)
          )
        `)
        .eq('board_id', board.id)

      const rawCols = (columns as unknown as RawCol[]) ?? []

      const overdueCards: OverdueCard[] = []

      for (const col of rawCols) {
        // Exclui colunas de conclusão
        const colLower = col.title.toLowerCase()
        if (colLower === 'concluído' || colLower === 'concluido' || colLower === 'done') continue

        for (const card of col.kanban_cards ?? []) {
          if (card.is_archived) continue
          if (!card.due_date) continue
          if (card.due_date >= today) continue

          overdueCards.push({
            id: card.id,
            title: card.title,
            due_date: card.due_date,
            priority: card.priority,
            column_title: col.title,
            assignee_name: card.profiles?.name ?? null,
          })
        }
      }

      if (overdueCards.length === 0) continue

      // 4. Busca email do owner do workspace
      const { data: ownerMember } = await adminSupabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', ws.id)
        .eq('role', 'owner')
        .eq('is_active', true)
        .limit(1)
        .single()

      let ownerEmail: string | null = null

      if (ownerMember) {
        const { data: ownerProfile } = await adminSupabase
          .from('profiles')
          .select('email')
          .eq('id', ownerMember.user_id)
          .single()

        ownerEmail = ownerProfile?.email ?? null
      }

      // Se não tem owner, tenta buscar qualquer admin do workspace
      if (!ownerEmail) {
        const { data: adminMember } = await adminSupabase
          .from('workspace_members')
          .select('user_id')
          .eq('workspace_id', ws.id)
          .eq('role', 'admin')
          .eq('is_active', true)
          .limit(1)
          .single()

        if (adminMember) {
          const { data: adminProfile } = await adminSupabase
            .from('profiles')
            .select('email')
            .eq('id', adminMember.user_id)
            .single()

          ownerEmail = adminProfile?.email ?? null
        }
      }

      // 5. Gera email com Claude e envia via Resend
      let emailSent = false
      let summary = `${overdueCards.length} card(s) vencido(s) encontrado(s)`

      if (ownerEmail && process.env.ANTHROPIC_API_KEY && process.env.RESEND_API_KEY) {
        try {
          const emailHtml = await generateEmailWithAI(ws.name, overdueCards)
          await sendEmail(ownerEmail, ws.name, emailHtml)
          emailSent = true
          summary += ` — email enviado para ${ownerEmail}`
        } catch (emailError) {
          summary += ` — erro ao enviar email: ${emailError instanceof Error ? emailError.message : 'desconhecido'}`
        }
      } else {
        if (!ownerEmail) summary += ' — sem email de destinatário'
        if (!process.env.ANTHROPIC_API_KEY) summary += ' — ANTHROPIC_API_KEY ausente'
        if (!process.env.RESEND_API_KEY) summary += ' — RESEND_API_KEY ausente'
      }

      // 6. Salva log
      await adminSupabase.from('agent_logs').insert({
        workspace_id: ws.id,
        agent_type: 'overdue_checker',
        summary,
        cards_found: overdueCards.length,
        email_sent: emailSent,
      })

      results.push({
        workspaceId: ws.id,
        cardsFound: overdueCards.length,
        emailSent,
      })
    }

    return NextResponse.json({
      message: 'Agente executado com sucesso',
      processed: results.length,
      results,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 },
    )
  }
}

// ── AI Email Generation ──────────────────────────────────────

async function generateEmailWithAI(
  workspaceName: string,
  cards: OverdueCard[],
): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const cardList = cards
    .map((c) => {
      const date = new Date(c.due_date + 'T12:00:00').toLocaleDateString('pt-BR')
      const priority = PRIORITY_LABELS[c.priority] ?? c.priority
      const assignee = c.assignee_name ? ` (${c.assignee_name})` : ''
      return `- "${c.title}" — vencido em ${date} — prioridade ${priority} — coluna: ${c.column_title}${assignee}`
    })
    .join('\n')

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: `Você é um assistente de mentoria empresarial. Gere um email em português, profissional mas motivador, informando que os seguintes cards do kanban estão com prazo vencido. Seja direto, empático e termine com uma frase de incentivo. Retorne apenas o HTML do corpo do email (sem <html>, <head>, <body> — apenas o conteúdo interno). Use estilos inline simples.`,
    messages: [
      {
        role: 'user',
        content: `Cards vencidos:\n${cardList}\n\nWorkspace: ${workspaceName}`,
      },
    ],
  })

  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Resposta vazia da IA')
  }

  return textBlock.text
}

// ── Email Sending ────────────────────────────────────────────

async function sendEmail(
  to: string,
  workspaceName: string,
  htmlBody: string,
): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY)

  await resend.emails.send({
    from: 'BrandLegacy <noreply@brandlegacy.com.br>',
    to,
    subject: `[BrandLegacy] Cards vencidos — ${workspaceName}`,
    html: htmlBody,
  })
}
