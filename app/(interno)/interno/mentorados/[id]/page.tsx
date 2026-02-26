import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ContactLogForm from './ContactLogForm'

interface Props {
  params: Promise<{ id: string }>
}

const PLAN_LABELS = { free: 'Free', tracao: 'Tração', club: 'Club' }
const PLAN_COLORS = {
  free: 'bg-bg-surface text-text-muted border border-border',
  tracao: 'bg-info/15 text-info',
  club: 'bg-brand-gold/15 text-brand-gold',
}
const CONTACT_LABELS: Record<string, string> = {
  call: 'Ligação', whatsapp: 'WhatsApp', email: 'Email', meeting: 'Reunião', note: 'Nota',
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
const FIN_COLORS: Record<string, string> = {
  pending: 'bg-bg-surface text-text-muted border border-border',
  paid: 'bg-success/15 text-success',
  overdue: 'bg-error/15 text-error',
  cancelled: 'bg-bg-surface text-text-muted border border-border',
}
const FIN_LABELS: Record<string, string> = {
  pending: 'Pendente', paid: 'Pago', overdue: 'Atrasado', cancelled: 'Cancelado',
}

export default async function MentoradoFichaPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [wsRes, contractsRes, financialRes, contactsRes] = await Promise.all([
    supabase
      .from('workspaces')
      .select('*, workspace_members(*, profiles(id, name, email, role))')
      .eq('id', id)
      .single(),
    supabase
      .from('mentoring_contracts')
      .select('*')
      .eq('workspace_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('financial_records')
      .select('*')
      .eq('workspace_id', id)
      .order('due_date', { ascending: false }),
    supabase
      .from('internal_contacts')
      .select('*, profiles:recorded_by(name)')
      .eq('workspace_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!wsRes.data) notFound()

  const ws = wsRes.data
  const contracts = contractsRes.data ?? []
  const financial = financialRes.data ?? []
  const contacts = contactsRes.data ?? []
  const activeContract = contracts.find((c) => c.status === 'active')

  const planKey = ws.plan_type as keyof typeof PLAN_LABELS

  type Contact = {
    id: string
    contact_type: string
    content: string
    next_action: string | null
    next_action_date: string | null
    created_at: string
    profiles: { name: string } | null
  }

  return (
    <div className="animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-text-muted mb-6">
        <Link href="/interno/mentorados" className="hover:text-text-primary transition-colors">Mentorados</Link>
        <span>/</span>
        <span className="text-text-secondary">{ws.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-xl bg-brand-gold/15 flex items-center justify-center text-xl font-bold text-brand-gold">
          {ws.name[0]?.toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{ws.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${PLAN_COLORS[planKey] ?? ''}`}>
              {PLAN_LABELS[planKey] ?? ws.plan_type}
            </span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full ${ws.is_active ? 'bg-success/15 text-success' : 'bg-error/15 text-error'}`}>
              {ws.is_active ? 'Ativo' : 'Inativo'}
            </span>
            {activeContract && (
              <span className={`text-xs px-2.5 py-0.5 rounded-full ${STATUS_COLORS[activeContract.status] ?? ''}`}>
                Contrato: {STATUS_LABELS[activeContract.status] ?? activeContract.status}
              </span>
            )}
          </div>
        </div>
        <div className="ml-auto">
          <Link
            href={`/admin/workspaces/${ws.id}`}
            className="text-sm text-text-muted hover:text-brand-gold transition-colors"
          >
            Editar no Admin →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna esq: contrato + financeiro */}
        <div className="space-y-6">
          {/* Contrato ativo */}
          {activeContract ? (
            <div className="bg-bg-card border border-border rounded-xl p-5">
              <h2 className="font-semibold text-text-primary mb-3">Contrato Ativo</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Plano</span>
                  <span className="text-text-primary font-medium capitalize">{activeContract.plan_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Valor</span>
                  <span className="text-text-primary font-medium">
                    R$ {Number(activeContract.contract_value_brl).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Parcelas</span>
                  <span className="text-text-primary">{activeContract.installments}x</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Início</span>
                  <span className="text-text-primary">{new Date(activeContract.start_date).toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Duração</span>
                  <span className="text-text-primary">{activeContract.duration_months} meses</span>
                </div>
                {activeContract.renewal_date && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">Renovação</span>
                    <span className="text-text-primary">{new Date(activeContract.renewal_date).toLocaleDateString('pt-BR')}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-border">
                  <div className="flex justify-between mb-1">
                    <span className="text-text-muted text-xs">Entregas</span>
                    <span className="text-text-primary text-xs font-medium">
                      {activeContract.deliveries_completed}/{activeContract.total_deliveries_promised}
                    </span>
                  </div>
                  <div className="h-1.5 bg-bg-surface rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-gold rounded-full transition-all"
                      style={{ width: `${activeContract.total_deliveries_promised > 0 ? Math.round((activeContract.deliveries_completed / activeContract.total_deliveries_promised) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-bg-card border border-border rounded-xl p-5">
              <h2 className="font-semibold text-text-primary mb-2">Contrato</h2>
              <p className="text-text-muted text-sm">Nenhum contrato ativo.</p>
            </div>
          )}

          {/* Financeiro */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-text-primary mb-3">Financeiro</h2>
            {financial.length === 0 ? (
              <p className="text-text-muted text-sm">Nenhum registro financeiro.</p>
            ) : (
              <div className="space-y-2">
                {financial.slice(0, 8).map((f) => (
                  <div key={f.id} className="flex items-center justify-between p-2.5 bg-bg-surface rounded-lg border border-border">
                    <div>
                      <p className="text-xs font-medium text-text-primary capitalize">{f.type}</p>
                      {f.due_date && <p className="text-xs text-text-muted">{new Date(f.due_date).toLocaleDateString('pt-BR')}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-text-primary">
                        R$ {Number(f.amount_brl).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${FIN_COLORS[f.status] ?? ''}`}>
                        {FIN_LABELS[f.status] ?? f.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Coluna central: membros */}
        <div className="space-y-6">
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-text-primary mb-3">
              Membros ({ws.workspace_members?.filter((m) => m.is_active)?.length ?? 0})
            </h2>
            <div className="space-y-2">
              {(ws.workspace_members ?? []).map((m) => {
                type MemberProfile = { name: string; email: string; role: string } | null
                const profile = m.profiles as unknown as MemberProfile
                return (
                  <div key={m.id} className={`flex items-center gap-3 p-3 rounded-lg border ${m.is_active ? 'bg-bg-surface border-border' : 'bg-error/5 border-error/20 opacity-60'}`}>
                    <div className="w-8 h-8 rounded-full bg-brand-gold/15 flex items-center justify-center shrink-0">
                      <span className="text-brand-gold text-xs font-bold">{profile?.name?.[0]?.toUpperCase() ?? '?'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{profile?.name ?? '—'}</p>
                      <p className="text-xs text-text-muted truncate">{profile?.email}</p>
                    </div>
                    <span className="text-xs text-text-muted capitalize shrink-0">{m.role}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Coluna dir: log de contatos */}
        <div className="space-y-6">
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-text-primary mb-3">Registrar Contato</h2>
            <ContactLogForm workspaceId={ws.id} />
          </div>

          <div className="bg-bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-text-primary mb-3">Histórico de Contatos</h2>
            {contacts.length === 0 ? (
              <p className="text-text-muted text-sm">Nenhum contato registrado.</p>
            ) : (
              <div className="space-y-3">
                {(contacts as unknown as Contact[]).map((c) => (
                  <div key={c.id} className="p-3 bg-bg-surface rounded-lg border border-border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-text-secondary">
                        {CONTACT_LABELS[c.contact_type] ?? c.contact_type}
                      </span>
                      <span className="text-xs text-text-muted">
                        {new Date(c.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-sm text-text-primary mb-1">{c.content}</p>
                    {c.next_action && (
                      <div className="flex items-center gap-1 text-xs text-info">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                        {c.next_action}
                        {c.next_action_date && ` — ${new Date(c.next_action_date).toLocaleDateString('pt-BR')}`}
                      </div>
                    )}
                    <p className="text-xs text-text-muted mt-1">por {c.profiles?.name ?? '?'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
