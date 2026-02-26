'use client'

import { useState, useTransition } from 'react'
import { scheduleDeliveryDate } from '@/app/actions/deliveries'

type DeliveryItem = {
  id: string
  title: string
  status: 'pending' | 'scheduled' | 'completed'
  scheduled_date: string | null
  link_call: string | null
  order_index: number
}

interface Props {
  deliveries: DeliveryItem[]
}

const STATUS_CONFIG = {
  pending:   { label: 'Pendente',  badge: 'bg-bg-surface text-text-muted border border-border' },
  scheduled: { label: 'Agendada',  badge: 'bg-brand-gold/15 text-brand-gold border border-brand-gold/30' },
  completed: { label: 'Concluída', badge: 'bg-success/15 text-success border border-success/30' },
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

function groupByMonth(deliveries: DeliveryItem[]) {
  const groups: Record<string, DeliveryItem[]> = {}
  for (const d of deliveries) {
    if (!d.scheduled_date) continue
    const key = d.scheduled_date.slice(0, 7)
    if (!groups[key]) groups[key] = []
    groups[key].push(d)
  }
  return groups
}

export default function AgendaClient({ deliveries }: Props) {
  const today = new Date().toISOString().split('T')[0]

  const scheduled = deliveries.filter((d) => d.scheduled_date)
  const unscheduled = deliveries.filter((d) => !d.scheduled_date)

  const upcoming = scheduled.filter((d) => d.scheduled_date! >= today)
  const past = scheduled.filter((d) => d.scheduled_date! < today)

  const upcomingGroups = groupByMonth(upcoming)
  const pastGroups = groupByMonth([...past].reverse())

  const hasAny = deliveries.length > 0

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Agenda</h1>
        <p className="text-text-secondary mt-1">Próximas sessões e entregas agendadas.</p>
      </div>

      {!hasAny ? (
        <div className="bg-bg-card border border-border rounded-xl p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-brand-gold/15 flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-gold">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <p className="text-text-primary font-medium mb-1">Nenhuma entrega cadastrada</p>
          <p className="text-text-muted text-sm">Seu mentor irá cadastrar as entregas em breve.</p>
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

          {/* Sem data agendada */}
          {unscheduled.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
                Sem data agendada ({unscheduled.length})
              </h2>
              <div className="space-y-3">
                {unscheduled.map((d) => (
                  <UnscheduledCard key={d.id} delivery={d} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function DeliveryCard({ delivery, isUpcoming }: { delivery: DeliveryItem; isUpcoming: boolean }) {
  const cfg = STATUS_CONFIG[delivery.status]

  return (
    <div className={`flex items-start gap-4 p-4 bg-bg-card border rounded-xl ${isUpcoming ? 'border-border hover:border-brand-gold/30' : 'border-border opacity-70'} transition-colors`}>
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
        {delivery.scheduled_date && (
          <p className="text-xs text-text-muted capitalize">{formatDate(delivery.scheduled_date)}</p>
        )}
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

function UnscheduledCard({ delivery }: { delivery: DeliveryItem }) {
  const [showPicker, setShowPicker] = useState(false)
  const [date, setDate] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const cfg = STATUS_CONFIG[delivery.status]

  function handleSchedule() {
    if (!date) return
    setError(null)
    startTransition(async () => {
      const res = await scheduleDeliveryDate(delivery.id, date)
      if (res.error) setError(res.error)
      else setShowPicker(false)
    })
  }

  return (
    <div className="flex items-start gap-4 p-4 bg-bg-card border border-border rounded-xl">
      <div className="w-10 h-10 rounded-lg bg-bg-surface flex items-center justify-center shrink-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
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
        <p className="text-xs text-text-muted mb-2">Sem data agendada</p>

        {!showPicker ? (
          <button
            onClick={() => setShowPicker(true)}
            className="text-xs text-brand-gold hover:text-brand-gold-light transition-colors flex items-center gap-1"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Agendar
          </button>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-bg-surface border border-border text-text-primary text-xs focus:outline-none focus:border-brand-gold"
            />
            <button
              onClick={handleSchedule}
              disabled={isPending || !date}
              className="px-3 py-1.5 rounded-lg bg-brand-gold text-bg-base text-xs font-medium hover:bg-brand-gold-light transition-colors disabled:opacity-60"
            >
              {isPending ? '...' : 'Confirmar'}
            </button>
            <button
              onClick={() => { setShowPicker(false); setError(null) }}
              className="px-3 py-1.5 rounded-lg text-text-muted text-xs hover:bg-bg-hover transition-colors"
            >
              Cancelar
            </button>
            {error && <p className="text-error text-xs w-full">{error}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
