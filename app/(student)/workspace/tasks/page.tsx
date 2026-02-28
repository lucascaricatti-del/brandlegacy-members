import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import TaskFlowClient from './TaskFlowClient'

export const metadata = { title: 'Tarefas — BrandLegacy' }

export default async function TasksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = createAdminClient()

  const { data: memberships } = await adminSupabase
    .from('workspace_members')
    .select('workspace_id, workspaces(id, name)')
    .eq('user_id', user.id)
    .eq('is_active', true)

  type WsMembership = {
    workspace_id: string
    workspaces: { id: string; name: string } | null
  }

  const workspaces = ((memberships ?? []) as unknown as WsMembership[])
    .map((m) => m.workspaces)
    .filter(Boolean) as { id: string; name: string }[]

  if (workspaces.length === 0) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-xl font-bold text-text-primary mb-2">Minhas Tarefas</h1>
        <div className="bg-bg-card border border-border rounded-xl p-16 text-center">
          <p className="text-text-muted">Você ainda não está vinculado a um workspace.</p>
        </div>
      </div>
    )
  }

  const ws = workspaces[0]

  const [{ data: tasks }, { data: wsMembers }] = await Promise.all([
    adminSupabase
      .from('tasks')
      .select('*, sessions:session_id(title), creator:profiles!tasks_created_by_fkey(id, name)')
      .eq('workspace_id', ws.id)
      .order('created_at', { ascending: false }),
    adminSupabase
      .from('workspace_members')
      .select('user_id, role, profiles:user_id(id, name, email)')
      .eq('workspace_id', ws.id)
      .eq('is_active', true),
  ])

  type MemberRow = { user_id: string; role: string; profiles: { id: string; name: string; email: string } | null }
  const members = ((wsMembers ?? []) as unknown as MemberRow[])
    .filter((m) => m.profiles)
    .map((m) => ({ id: m.profiles!.id, name: m.profiles!.name, email: m.profiles!.email }))

  return (
    <div className="animate-fade-in">
      <TaskFlowClient
        workspaceId={ws.id}
        tasks={(tasks ?? []) as Parameters<typeof TaskFlowClient>[0]['tasks']}
        members={members}
      />
    </div>
  )
}
