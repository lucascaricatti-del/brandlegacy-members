import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminDashboardClient from './AdminDashboardClient'

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = createAdminClient()

  const [wsRes, membersRes] = await Promise.all([
    adminSupabase
      .from('workspaces')
      .select('id, name, is_active, created_at')
      .order('name'),
    adminSupabase
      .from('workspace_members')
      .select('workspace_id, role, is_active, profiles(name)')
      .eq('is_active', true),
  ])

  const workspaces = wsRes.data ?? []
  const members = membersRes.data ?? []

  // Compute member count + owner name per workspace
  const memberCountMap: Record<string, number> = {}
  const ownerMap: Record<string, string> = {}

  for (const m of members) {
    const wsId = m.workspace_id
    memberCountMap[wsId] = (memberCountMap[wsId] ?? 0) + 1
    if (m.role === 'owner') {
      ownerMap[wsId] = (m as any).profiles?.name ?? ''
    }
  }

  const enriched = workspaces.map((ws) => ({
    id: ws.id,
    name: ws.name,
    is_active: ws.is_active,
    created_at: ws.created_at,
    member_count: memberCountMap[ws.id] ?? 0,
    owner_name: ownerMap[ws.id] ?? '',
  }))

  return <AdminDashboardClient workspaces={enriched} />
}
