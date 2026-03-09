import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Verify that the current user is authenticated and has access to the given workspace.
 * Use in API route handlers that accept workspace_id.
 */
export async function verifyWorkspaceAccess(workspaceId: string | null | undefined) {
  if (!workspaceId) {
    return { error: 'workspace_id required' as const, status: 400 }
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() { /* read-only in API routes */ },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' as const, status: 401 }
  }

  // Check workspace membership using admin client (bypasses RLS)
  const adminSupabase = createAdminClient()
  const { data: member } = await adminSupabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)
    .single()

  // Also allow admins to access any workspace
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  if (!member && !isAdmin) {
    return { error: 'Forbidden' as const, status: 403 }
  }

  return { user, workspaceId }
}
