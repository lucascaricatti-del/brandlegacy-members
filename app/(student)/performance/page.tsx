import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PerformanceDashboardClient from './PerformanceDashboardClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Performance — BrandLegacy' }

export default async function PerformancePage() {
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
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-primary">Performance</h1>
          <p className="text-text-secondary mt-1">Dashboard executivo.</p>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-16 text-center">
          <p className="text-text-muted">Você ainda não está vinculado a um workspace.</p>
        </div>
      </div>
    )
  }

  const ws = workspaces[0]

  const now = new Date()
  const brNow = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  const currentDay = brNow.getUTCDate()
  const daysInMonth = new Date(brNow.getUTCFullYear(), brNow.getUTCMonth() + 1, 0).getDate()
  const currentMonthLabel = brNow.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Performance</h1>
        <p className="text-text-secondary mt-1">
          Dashboard executivo — {ws.name}
        </p>
      </div>
      <PerformanceDashboardClient
        workspaceId={ws.id}
        currentDay={currentDay}
        daysInMonth={daysInMonth}
        currentMonthLabel={currentMonthLabel}
      />
    </div>
  )
}
