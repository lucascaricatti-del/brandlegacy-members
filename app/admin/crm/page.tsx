import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import CrmPipelineClient from './CrmPipelineClient'

export default async function CrmPage() {
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

  const [funnelsRes, adminsRes] = await Promise.all([
    adminSupabase.from('funnels').select('*').eq('is_active', true).order('created_at'),
    adminSupabase.from('profiles').select('id, name, email').eq('role', 'admin').order('name'),
  ])

  const funnels = funnelsRes.data ?? []
  const admins = adminsRes.data ?? []
  const defaultFunnel = funnels[0] ?? null

  // Pre-fetch leads + stats for default funnel
  let initialLeads: Array<Record<string, unknown>> = []
  let initialStats = { total: 0, novos_hoje: 0, por_status: { novo: 0, contatado: 0, qualificado: 0, fechado: 0, perdido: 0 }, conversao: 0 }

  if (defaultFunnel) {
    const [leadsRes, statsLeadsRes] = await Promise.all([
      adminSupabase
        .from('crm_leads')
        .select('*, profiles!crm_leads_assigned_to_fkey(name)')
        .eq('funnel_id', defaultFunnel.id)
        .order('created_at', { ascending: false }),
      adminSupabase
        .from('crm_leads')
        .select('status, created_at')
        .eq('funnel_id', defaultFunnel.id),
    ])

    initialLeads = (leadsRes.data ?? []) as Array<Record<string, unknown>>

    const all = statsLeadsRes.data ?? []
    const today = new Date().toISOString().slice(0, 10)
    initialStats = {
      total: all.length,
      novos_hoje: all.filter((l) => l.created_at.slice(0, 10) === today).length,
      por_status: {
        novo: all.filter((l) => l.status === 'novo').length,
        contatado: all.filter((l) => l.status === 'contatado').length,
        qualificado: all.filter((l) => l.status === 'qualificado').length,
        fechado: all.filter((l) => l.status === 'fechado').length,
        perdido: all.filter((l) => l.status === 'perdido').length,
      },
      conversao: all.length > 0
        ? Math.round((all.filter((l) => l.status === 'fechado').length / all.length) * 100)
        : 0,
    }
  }

  return (
    <CrmPipelineClient
      funnels={funnels}
      admins={admins}
      initialLeads={initialLeads}
      initialStats={initialStats}
      defaultFunnelId={defaultFunnel?.id ?? null}
    />
  )
}
