import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const PLAN_LABELS = { free: 'Free', tracao: 'Tração', club: 'Club' }
const PLAN_COLORS = {
  free: 'bg-bg-surface text-text-muted border border-border',
  tracao: 'bg-info/15 text-info',
  club: 'bg-brand-gold/15 text-brand-gold',
}

export default async function InternoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().slice(0, 10)
  const in30days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [workspacesRes, overduePmtsRes, renewingSoonRes] = await Promise.all([
    supabase
      .from('workspaces')
      .select('id, name, plan_type, is_active, workspace_members(id, is_active)')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('financial_records')
      .select('id, amount_brl, due_date, workspace_id, workspaces(name)')
      .eq('status', 'overdue')
      .order('due_date'),
    supabase
      .from('mentoring_contracts')
      .select('id, workspace_id, renewal_date, plan_type, workspaces(name)')
      .eq('status', 'active')
      .gte('renewal_date', today)
      .lte('renewal_date', in30days)
      .order('renewal_date'),
  ])

  const workspaces = workspacesRes.data ?? []
  const overduePmts = overduePmtsRes.data ?? []
  const renewingSoon = renewingSoonRes.data ?? []

  const activeCount = workspaces.length
  const totalMembers = workspaces.reduce((acc, ws) => acc + (ws.workspace_members?.filter((m) => m.is_active).length ?? 0), 0)

  type RawWs = { name: string } | null
  type RawPayment = { id: string; amount_brl: number; due_date: string | null; workspace_id: string; workspaces: RawWs }
  type RawContract = { id: string; workspace_id: string; renewal_date: string | null; plan_type: string; workspaces: RawWs }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Visão Geral</h1>
        <p className="text-text-secondary mt-1">Painel interno BrandLegacy</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Workspaces ativos" value={activeCount} />
        <StatCard label="Membros totais" value={totalMembers} />
        <StatCard label="Pagamentos em atraso" value={overduePmts.length} highlight={overduePmts.length > 0} />
        <StatCard label="Renovações em 30 dias" value={renewingSoon.length} highlight={renewingSoon.length > 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pagamentos atrasados */}
        <div className="bg-bg-card border border-border rounded-xl p-6">
          <h2 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-error inline-block" />
            Pagamentos em Atraso
          </h2>
          {overduePmts.length === 0 ? (
            <p className="text-text-muted text-sm">Nenhum pagamento em atraso.</p>
          ) : (
            <div className="space-y-2">
              {(overduePmts as unknown as RawPayment[]).map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-error/5 border border-error/20 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{p.workspaces?.name ?? '—'}</p>
                    {p.due_date && <p className="text-xs text-text-muted">Venceu: {new Date(p.due_date).toLocaleDateString('pt-BR')}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-error">
                      R$ {Number(p.amount_brl).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <Link href={`/interno/mentorados/${p.workspace_id}`} className="text-xs text-text-muted hover:text-text-primary transition-colors">
                      Ver ficha →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Renovações próximas */}
        <div className="bg-bg-card border border-border rounded-xl p-6">
          <h2 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-warning inline-block" />
            Renovações em 30 Dias
          </h2>
          {renewingSoon.length === 0 ? (
            <p className="text-text-muted text-sm">Nenhuma renovação próxima.</p>
          ) : (
            <div className="space-y-2">
              {(renewingSoon as unknown as RawContract[]).map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 bg-warning/5 border border-warning/20 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{c.workspaces?.name ?? '—'}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${PLAN_COLORS[c.plan_type as keyof typeof PLAN_COLORS] ?? ''}`}>
                      {PLAN_LABELS[c.plan_type as keyof typeof PLAN_LABELS] ?? c.plan_type}
                    </span>
                  </div>
                  <div className="text-right">
                    {c.renewal_date && (
                      <p className="text-sm font-semibold text-warning">
                        {new Date(c.renewal_date).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                    <Link href={`/interno/mentorados/${c.workspace_id}`} className="text-xs text-text-muted hover:text-text-primary transition-colors">
                      Ver ficha →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Workspaces ativos */}
      <div className="mt-6 bg-bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-text-primary">Todos os Workspaces</h2>
          <Link href="/interno/mentorados" className="text-sm text-brand-gold hover:text-brand-gold-light transition-colors">
            Ver todos →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {workspaces.slice(0, 9).map((ws) => {
            const planKey = ws.plan_type as keyof typeof PLAN_LABELS
            const activeMembers = ws.workspace_members?.filter((m) => m.is_active).length ?? 0
            return (
              <Link
                key={ws.id}
                href={`/interno/mentorados/${ws.id}`}
                className="flex items-center gap-3 p-3 bg-bg-surface border border-border rounded-lg hover:border-brand-gold/30 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-brand-gold/15 flex items-center justify-center text-sm font-bold text-brand-gold shrink-0">
                  {ws.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{ws.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${PLAN_COLORS[planKey] ?? ''}`}>
                      {PLAN_LABELS[planKey] ?? ws.plan_type}
                    </span>
                    <span className="text-xs text-text-muted">{activeMembers} membros</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`bg-bg-card border rounded-xl p-5 ${highlight && value > 0 ? 'border-warning/40' : 'border-border'}`}>
      <p className="text-3xl font-bold text-text-primary mb-1">{value}</p>
      <p className="text-sm text-text-muted">{label}</p>
    </div>
  )
}
