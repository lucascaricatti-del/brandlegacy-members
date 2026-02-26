import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata = { title: 'Agenda — BrandLegacy' }

type ScheduledDelivery = {
  id: string
  title: string
  status: 'pending' | 'scheduled' | 'completed'
  scheduled_date: string
  link_call: string | null
}

function formatDate(date: string) {
  return new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })
}

function formatMonth(date: string) {
  return new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', {
    month: 'long', year: 'numeric',
  })
}

function groupByMonth(deliveries: ScheduledDelivery[]) {
  const groups: Record<string, ScheduledDelivery[]> = {}
  for (const d of deliveries) {
    const key = d.scheduled_date.slice(0, 7) // YYYY-MM
    if (!groups[key]) groups[key] = []
    groups[key].push(d)
  }
  return groups
}

const STATUS_CONFIG = {
  scheduled: { label: 'Agendada', badge: 'bg-brand-gold/15 text-brand-gold border border-brand-gold/30' },
  completed: { label: 'Concluída', badge: 'bg-success/15 text-success border border-success/30' },
  pending:   { label: 'Pendente',  badge: 'bg-bg-surface text-text-muted border border-border' },
}

export default async function AgendaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Encontra workspace ativo do usuário
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .single()

  if (!membership) {
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

  // Busca entregas com data agendada usando adminClient (bypass RLS)
  const adminSupabase = createAdminClient()
  const { data: rawDeliveries } = await adminSupabase
    .from('deliveries')
    .select('id, title, status, scheduled_date, link_call')
    .eq('workspace_id', membership.workspace_id)
    .not('scheduled_date', 'is', null)
    .order('scheduled_date', { ascending: true })

  const deliveries = (rawDeliveries ?? []) as ScheduledDelivery[]
  const today = new Date().toISOString().split('T')[0]

  const upcoming = deliveries.filter((d) => d.scheduled_date >= today)
  const past = deliveries.filter((d) => d.scheduled_date < today)

  const upcomingGroups = groupByMonth(upcoming)
  const pastGroups = groupByMonth(past.reverse()) // mais recentes primeiro

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Agenda</h1>
        <p className="text-text-secondary mt-1">Próximas sessões e entregas agendadas.</p>
      </div>

      {deliveries.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-xl p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-brand-gold/15 flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-gold">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <p className="text-text-primary font-medium mb-1">Nenhuma sessão agendada</p>
          <p className="text-text-muted text-sm">Seu mentor irá agendar as próximas sessões em breve.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Próximas */}
          {upcoming.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">
                Próximas ({upcoming.length})
              </h2>
              <div className="space-y-6">
                {Object.entries(upcomingGroups).map(([monthKey, items]) => (
                  <div key={monthKey}>
                    <p className="text-xs font-medium text-text-muted capitalize mb-3 px-1">
                      {formatMonth(monthKey + '-01')}
                    </p>
                    <div className="space-y-3">
                      {items.map((d) => (
                        <DeliveryCard key={d.id} delivery={d} isUpcoming />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Passadas */}
          {past.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
                Histórico ({past.length})
              </h2>
              <div className="space-y-6">
                {Object.entries(pastGroups).map(([monthKey, items]) => (
                  <div key={monthKey}>
                    <p className="text-xs font-medium text-text-muted capitalize mb-3 px-1">
                      {formatMonth(monthKey + '-01')}
                    </p>
                    <div className="space-y-3">
                      {items.map((d) => (
                        <DeliveryCard key={d.id} delivery={d} isUpcoming={false} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function DeliveryCard({ delivery, isUpcoming }: { delivery: ScheduledDelivery; isUpcoming: boolean }) {
  const cfg = STATUS_CONFIG[delivery.status]

  return (
    <div className={`flex items-start gap-4 p-4 bg-bg-card border rounded-xl ${isUpcoming ? 'border-border hover:border-brand-gold/30' : 'border-border opacity-70'} transition-colors`}>
      {/* Ícone de calendário */}
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isUpcoming ? 'bg-brand-gold/15' : 'bg-bg-surface'}`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isUpcoming ? 'text-brand-gold' : 'text-text-muted'}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h3 className="font-medium text-text-primary text-sm">{delivery.title}</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border shrink-0 ${cfg.badge}`}>
            {cfg.label}
          </span>
        </div>
        <p className="text-xs text-text-muted capitalize">{formatDate(delivery.scheduled_date)}</p>

        {/* Link da call */}
        {delivery.link_call && (
          <a
            href={delivery.link_call}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-2 text-xs text-brand-gold hover:text-brand-gold-light transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.845v6.31a1 1 0 0 1-1.447.894L15 14M3 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z"/>
            </svg>
            Entrar na call
          </a>
        )}
      </div>
    </div>
  )
}
