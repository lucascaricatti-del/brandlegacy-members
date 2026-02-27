import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ViewAsMentoradoClient from './ViewAsMentoradoClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ViewAsMentoradoPage({ params }: Props) {
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

  // Workspace
  const { data: ws } = await adminSupabase
    .from('workspaces')
    .select('id, name, slug, plan_type, is_active')
    .eq('id', id)
    .single()

  if (!ws) notFound()

  // Deliveries
  const { data: deliveries } = await adminSupabase
    .from('deliveries')
    .select('id, title, status, scheduled_date, completed_date, link_call, order_index')
    .eq('workspace_id', id)
    .order('order_index')

  // Tasks
  const { data: tasks } = await adminSupabase
    .from('tasks')
    .select('id, title, status, priority, due_date, responsible, is_archived')
    .eq('workspace_id', id)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })

  // Sessions
  const { data: sessions } = await adminSupabase
    .from('sessions')
    .select('id, title, session_date, status, summary, created_at')
    .eq('workspace_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <ViewAsMentoradoClient
      workspace={ws}
      deliveries={deliveries ?? []}
      tasks={tasks ?? []}
      sessions={sessions ?? []}
    />
  )
}
