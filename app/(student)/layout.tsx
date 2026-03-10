import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolvePermissions } from '@/lib/permissions'
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

  // Check for admin impersonation cookie
  const cookieStore = await cookies()
  const impersonateWsId = cookieStore.get('admin_viewing_workspace_id')?.value

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  let workspaceName: string | null = null
  let memberRole: string | null = null
  let resolvedPermissions: ReturnType<typeof resolvePermissions> | null = null
  let adminImpersonating: string | null = null

  if (isAdmin && impersonateWsId) {
    // Admin impersonation: use the specified workspace
    const { data: ws } = await adminSupabase
      .from('workspaces')
      .select('name')
      .eq('id', impersonateWsId)
      .single()

    workspaceName = ws?.name || null
    memberRole = 'owner' // Admin gets full owner permissions
    resolvedPermissions = resolvePermissions('owner', null)
    adminImpersonating = workspaceName
  } else {
    // Normal flow: get user's own membership
    const { data: membership } = await adminSupabase
      .from('workspace_members')
      .select('workspace_id, role, permissions, workspaces(name)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .single()

    workspaceName = (membership as any)?.workspaces?.name || null
    memberRole = membership?.role || null
    resolvedPermissions = memberRole
      ? resolvePermissions(memberRole, membership?.permissions as Record<string, unknown> | null)
      : null
  }

  return (
    <StudentLayoutShell
      profile={profile}
      workspaceName={workspaceName}
      memberRole={memberRole}
      permissions={resolvedPermissions}
      adminImpersonating={adminImpersonating}
    >
      {children}
    </StudentLayoutShell>
  )
}
