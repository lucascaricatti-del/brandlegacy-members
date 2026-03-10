import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveWorkspace } from '@/lib/resolve-workspace'
import AgendaClient from './AgendaClient'

export const metadata = { title: 'Agenda — BrandLegacy' }

export default async function AgendaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = createAdminClient()

  // Encontra workspace ativo do usuário (com suporte a impersonação admin)
  const resolvedWs = await resolveWorkspace(user.id)

  if (!resolvedWs) {
    return (
      <div className="animate-fade-in">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-primary">Agenda</h1>
          <p className="text-text-secondary mt-1">Próximas sessões e entregas agendadas.</p>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-12 text-center">
          <p className="text-text-muted text-sm">Você não está vinculado a nenhum workspace.</p>
        </div>
      </div>
    )
  }

  // Busca TODAS as entregas do workspace via adminClient
  const { data: rawDeliveries } = await adminSupabase
    .from('deliveries')
    .select('id, title, status, scheduled_date, link_call, order_index')
    .eq('workspace_id', resolvedWs.id)
    .order('order_index', { ascending: true })

  const deliveries = (rawDeliveries ?? []) as {
    id: string
    title: string
    status: 'pending' | 'scheduled' | 'completed'
    scheduled_date: string | null
    link_call: string | null
    order_index: number
  }[]

  return <AgendaClient deliveries={deliveries} />
}
