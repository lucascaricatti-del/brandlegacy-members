import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const PLAN_LABELS = { free: 'Free', tracao: 'Tração', club: 'Club' }
const PLAN_COLORS = {
  free: 'bg-bg-surface text-text-muted border border-border',
  tracao: 'bg-info/15 text-info',
  club: 'bg-brand-gold/15 text-brand-gold',
}
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-success/15 text-success',
  paused: 'bg-warning/15 text-warning',
  cancelled: 'bg-error/15 text-error',
  completed: 'bg-bg-surface text-text-muted border border-border',
  renewing: 'bg-info/15 text-info',
}
const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo', paused: 'Pausado', cancelled: 'Cancelado', completed: 'Concluído', renewing: 'Renovando',
}

export default async function MentoradosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspaces } = await supabase
    .from('workspaces')
    .select(`
      id, name, slug, plan_type, is_active,
      workspace_members(id, is_active),
      mentoring_contracts(id, status, plan_type, contract_value_brl, start_date, duration_months, deliveries_completed, total_deliveries_promised)
    `)
    .order('name')

  type RawMember = { id: string; is_active: boolean }
  type RawContract = {
    id: string; status: string; plan_type: string; contract_value_brl: number
    start_date: string; duration_months: number
    deliveries_completed: number; total_deliveries_promised: number
  }
  type RawWorkspace = {
    id: string; name: string; slug: string; plan_type: string; is_active: boolean
    workspace_members: RawMember[]
    mentoring_contracts: RawContract[]
  }

  const wsList = (workspaces as unknown as RawWorkspace[] ?? [])

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Mentorados</h1>
        <p className="text-text-secondary mt-1">{wsList.length} workspace{wsList.length !== 1 ? 's' : ''} cadastrado{wsList.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="space-y-3">
        {wsList.map((ws) => {
          const planKey = ws.plan_type as keyof typeof PLAN_LABELS
          const activeMembers = ws.workspace_members?.filter((m) => m.is_active).length ?? 0
          const activeContract = ws.mentoring_contracts?.find((c) => c.status === 'active')

          return (
            <Link
              key={ws.id}
              href={`/interno/mentorados/${ws.id}`}
              className="flex items-center gap-4 p-4 bg-bg-card border border-border rounded-xl hover:border-brand-gold/40 transition-all card-glow"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-gold/15 flex items-center justify-center text-lg font-bold text-brand-gold shrink-0">
                {ws.name[0]?.toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-semibold text-text-primary truncate">{ws.name}</p>
                  {!ws.is_active && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-error/15 text-error shrink-0">Inativo</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${PLAN_COLORS[planKey] ?? ''}`}>
                    {PLAN_LABELS[planKey] ?? ws.plan_type}
                  </span>
                  <span className="text-xs text-text-muted">{activeMembers} membros</span>
                  {activeContract && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[activeContract.status] ?? ''}`}>
                      {STATUS_LABELS[activeContract.status] ?? activeContract.status}
                    </span>
                  )}
                </div>
              </div>

              {activeContract && (
                <div className="text-right shrink-0 hidden md:block">
                  <p className="text-sm font-semibold text-text-primary">
                    R$ {Number(activeContract.contract_value_brl).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-text-muted">
                    {activeContract.deliveries_completed}/{activeContract.total_deliveries_promised} entregas
                  </p>
                </div>
              )}

              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted shrink-0">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
