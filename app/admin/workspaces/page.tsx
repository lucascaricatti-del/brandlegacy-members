import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import CreateWorkspaceForm from './CreateWorkspaceForm'
import WorkspaceListClient from './WorkspaceListClient'

export default async function AdminWorkspacesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = createAdminClient()

  // Batch queries
  const [wsRes, fiRes, tasksRes, sessionsRes] = await Promise.all([
    adminSupabase
      .from('workspaces')
      .select('id, name, slug, plan_type, is_active, created_at')
      .order('name'),
    adminSupabase
      .from('financial_info')
      .select('workspace_id, status'),
    adminSupabase
      .from('tasks')
      .select('workspace_id, status, due_date, is_archived')
      .eq('is_archived', false),
    adminSupabase
      .from('sessions')
      .select('workspace_id, created_at, status')
      .eq('status', 'completed')
      .order('created_at', { ascending: false }),
  ])

  const workspaces = wsRes.data ?? []
  const allTasks = tasksRes.data ?? []
  const allSessions = sessionsRes.data ?? []
  const financialInfos = fiRes.data ?? []

  const fiMap = Object.fromEntries(financialInfos.map((fi) => [fi.workspace_id, fi]))

  // Group tasks by workspace
  const tasksByWs: Record<string, typeof allTasks> = {}
  for (const t of allTasks) {
    if (!tasksByWs[t.workspace_id]) tasksByWs[t.workspace_id] = []
    tasksByWs[t.workspace_id].push(t)
  }

  // Find last session per workspace
  const lastSessionByWs: Record<string, string> = {}
  for (const s of allSessions) {
    if (!lastSessionByWs[s.workspace_id]) {
      lastSessionByWs[s.workspace_id] = s.created_at
    }
  }

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const enriched = workspaces.map((ws) => {
    const wsTasks = tasksByWs[ws.id] ?? []
    const total = wsTasks.length
    const completed = wsTasks.filter((t) => t.status === 'concluida').length
    const overdue = wsTasks.filter((t) => t.status !== 'concluida' && t.due_date && t.due_date < todayStr).length
    const taskProgress = total > 0 ? Math.round((completed / total) * 100) : 0

    const lastSessionDate = lastSessionByWs[ws.id] ?? null
    let daysInactive = -1
    if (lastSessionDate) {
      daysInactive = Math.floor((today.getTime() - new Date(lastSessionDate).getTime()) / (1000 * 60 * 60 * 24))
    }

    let health: 'em_dia' | 'atencao' | 'churn' = 'em_dia'
    if (daysInactive > 15 || overdue > 3) health = 'churn'
    else if (daysInactive > 7 || overdue > 1) health = 'atencao'

    const fi = fiMap[ws.id]
    const financialStatus = fi?.status ?? null

    return {
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      plan_type: ws.plan_type,
      is_active: ws.is_active,
      task_progress: taskProgress,
      total_tasks: total,
      completed_tasks: completed,
      overdue_tasks: overdue,
      last_session_date: lastSessionDate,
      days_inactive: daysInactive,
      health,
      financial_status: financialStatus,
    }
  })

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Mentorados</h1>
          <p className="text-text-secondary mt-1">
            {workspaces.filter((w) => w.is_active).length} mentorado{workspaces.filter((w) => w.is_active).length !== 1 ? 's' : ''} ativo{workspaces.filter((w) => w.is_active).length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Formulário de criação colapsável */}
      <details className="bg-bg-card border border-border rounded-xl mb-8 group">
        <summary className="px-6 py-4 cursor-pointer text-sm font-semibold text-text-primary hover:text-brand-gold transition-colors list-none flex items-center justify-between">
          Nova Empresa
          <svg className="w-4 h-4 text-text-muted transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </summary>
        <div className="px-6 pb-6">
          <CreateWorkspaceForm />
        </div>
      </details>

      <WorkspaceListClient workspaces={enriched} />
    </div>
  )
}
