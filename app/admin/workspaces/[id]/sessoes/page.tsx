import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import SessionAnalysis from './SessionAnalysis'
import NewSessionForm from './NewSessionForm'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AdminWorkspaceSessionsPage({ params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const adminSupabase = createAdminClient()

  const { data: workspace } = await adminSupabase
    .from('workspaces')
    .select('id, name')
    .eq('id', id)
    .single()

  if (!workspace) notFound()

  // Busca sessões com tarefas
  const { data: sessionsRaw } = await adminSupabase
    .from('sessions')
    .select('*, session_tasks(*)')
    .eq('workspace_id', id)
    .order('created_at', { ascending: false })

  type RawSession = {
    id: string
    workspace_id: string
    title: string
    session_date: string | null
    transcript: string | null
    summary: string | null
    decisions: string | null
    risks: string | null
    agent_type: string | null
    diagnosis_session_id: string | null
    result_json: string | null
    status: string
    created_at: string
    session_tasks: {
      id: string
      session_id: string
      workspace_id: string | null
      title: string
      responsible: string | null
      due_date: string | null
      priority: string
      kanban_card_id: string | null
      created_at: string
    }[]
  }

  const sessions = (sessionsRaw as unknown as RawSession[] ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    session_date: s.session_date,
    transcript: s.transcript,
    summary: s.summary,
    decisions: s.decisions,
    risks: s.risks,
    agent_type: s.agent_type,
    result_json: s.result_json,
    status: s.status,
    created_at: s.created_at,
    session_tasks: (s.session_tasks ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      responsible: t.responsible,
      due_date: t.due_date,
      priority: t.priority,
      kanban_card_id: t.kanban_card_id,
    })),
  }))

  // Sessões de diagnóstico completas (para selector no Plano de Ação)
  const diagnosisSessions = sessions
    .filter((s) => s.agent_type === 'diagnostic' && s.status === 'completed')
    .map((s) => ({
      id: s.id,
      title: s.title,
      session_date: s.session_date,
    }))

  return (
    <div className="animate-fade-in">
      <nav className="flex items-center gap-2 text-sm text-text-muted mb-6">
        <Link href="/admin/workspaces" className="hover:text-text-primary transition-colors">Empresas</Link>
        <span>/</span>
        <Link href={`/admin/workspaces/${id}`} className="hover:text-text-primary transition-colors">{workspace.name}</Link>
        <span>/</span>
        <span className="text-text-secondary">Sessões</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Sessões de Mentoria</h1>
          <p className="text-sm text-text-muted">{workspace.name} — 3 agentes IA especializados</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/agentes/config/${id}`}
            className="flex items-center gap-1.5 text-sm text-text-muted hover:text-brand-gold transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Config. Agentes
          </Link>
          <Link
            href={`/admin/workspaces/${id}`}
            className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Voltar
          </Link>
        </div>
      </div>

      <div className="mb-6">
        <NewSessionForm workspaceId={id} diagnosisSessions={diagnosisSessions} />
      </div>

      <SessionAnalysis sessions={sessions} workspaceId={id} />
    </div>
  )
}
