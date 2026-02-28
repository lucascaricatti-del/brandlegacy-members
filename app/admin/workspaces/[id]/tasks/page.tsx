import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import TaskFlowClient from '@/app/(student)/workspace/tasks/TaskFlowClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AdminWorkspaceTasksPage({ params }: Props) {
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

  const [{ data: tasks }, { data: wsMembers }] = await Promise.all([
    adminSupabase
      .from('tasks')
      .select('*, sessions:session_id(title), creator:profiles!tasks_created_by_fkey(id, name)')
      .eq('workspace_id', id)
      .order('created_at', { ascending: false }),
    adminSupabase
      .from('workspace_members')
      .select('user_id, role, profiles:user_id(id, name, email)')
      .eq('workspace_id', id)
      .eq('is_active', true),
  ])

  type MemberRow = { user_id: string; role: string; profiles: { id: string; name: string; email: string } | null }
  const members = ((wsMembers ?? []) as unknown as MemberRow[])
    .filter((m) => m.profiles)
    .map((m) => ({ id: m.profiles!.id, name: m.profiles!.name, email: m.profiles!.email }))

  return (
    <div className="animate-fade-in">
      <nav className="flex items-center gap-2 text-sm text-text-muted mb-6">
        <Link href="/admin/workspaces" className="hover:text-text-primary transition-colors">Empresas</Link>
        <span>/</span>
        <Link href={`/admin/workspaces/${id}`} className="hover:text-text-primary transition-colors">{workspace.name}</Link>
        <span>/</span>
        <span className="text-text-secondary">Tarefas</span>
      </nav>

      <TaskFlowClient
        workspaceId={id}
        tasks={(tasks ?? []) as Parameters<typeof TaskFlowClient>[0]['tasks']}
        members={members}
        isAdmin
      />
    </div>
  )
}
