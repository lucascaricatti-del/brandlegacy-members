import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import StudentLayoutShell from './StudentLayoutShell'

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const adminSupabase = createAdminClient()

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase
      .from('profiles')
      .select('name, role')
      .eq('id', user.id)
      .single(),
    adminSupabase
      .from('workspace_members')
      .select('workspace_id, workspaces(name)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .single(),
  ])

  const workspaceName = (membership as any)?.workspaces?.name || null

  return (
    <StudentLayoutShell profile={profile} workspaceName={workspaceName}>
      {children}
    </StudentLayoutShell>
  )
}
