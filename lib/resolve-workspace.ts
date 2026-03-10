import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Resolves the current workspace for a user.
 * Checks admin impersonation cookie first, then falls back to workspace_members lookup.
 * Returns workspace info or null if no workspace found.
 */
export async function resolveWorkspace(userId: string): Promise<{
  id: string
  name: string
  plan_type: string
  slug: string
  is_active: boolean
} | null> {
  const cookieStore = await cookies()
  const impersonateWsId = cookieStore.get('admin_viewing_workspace_id')?.value

  const adminSupabase = createAdminClient()

  if (impersonateWsId) {
    const { data: ws } = await adminSupabase
      .from('workspaces')
      .select('id, name, plan_type, slug, is_active')
      .eq('id', impersonateWsId)
      .single()
    if (ws) return ws
  }

  // Normal flow: get from workspace_members
  const { data: membership } = await adminSupabase
    .from('workspace_members')
    .select('workspace_id, workspaces(id, name, plan_type, slug, is_active)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .single()

  return (membership as any)?.workspaces ?? null
}
