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

  // Verificação de autenticação e papel admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  // Dados via adminClient (bypass RLS)
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

  return (
    <div className="animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-text-muted mb-6">
        <Link href="/admin/workspaces" className="hover:text-text-primary transition-colors">Empresas</Link>
        <span>/</span>
        <Link href={`/admin/workspaces/${id}`} className="hover:text-text-primary transition-colors">{workspace.name}</Link>
        <span>/</span>
        <span className="text-text-secondary">Sessões</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Sessões de Mentoria</h1>
          <p className="text-sm text-text-muted">{workspace.name} — Análise de transcrições com IA</p>
        </div>
        <Link
          href={`/admin/workspaces/${id}`}
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Voltar
        </Link>
      </div>

      {/* New session form */}
      <div className="mb-6">
        <NewSessionForm workspaceId={id} />
      </div>

      {/* Sessions list */}
      <SessionAnalysis sessions={sessions} workspaceId={id} />
    </div>
  )
}
