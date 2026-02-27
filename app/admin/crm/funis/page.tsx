import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import FunisClient from './FunisClient'

export default async function FunisPage() {
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

  const { data: funnels } = await adminSupabase
    .from('funnels')
    .select('*')
    .order('created_at')

  // Count leads per funnel
  const { data: leadCounts } = await adminSupabase
    .from('crm_leads')
    .select('funnel_id')

  const countMap: Record<string, number> = {}
  for (const l of leadCounts ?? []) {
    if (l.funnel_id) countMap[l.funnel_id] = (countMap[l.funnel_id] ?? 0) + 1
  }

  const enriched = (funnels ?? []).map((f) => ({
    ...f,
    lead_count: countMap[f.id] ?? 0,
  }))

  return <FunisClient funnels={enriched} />
}
