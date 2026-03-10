import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import EditWorkspaceForm from './EditWorkspaceForm'
import MentoradoAccessManager from './MentoradoAccessManager'
import FinancialInfoForm from './FinancialInfoForm'
import ImpersonateButton from './ImpersonateButton'

interface Props {
  params: Promise<{ id: string }>
}

const PLAN_LABELS = { free: 'Free', tracao: 'Tração', club: 'Club' }
const PLAN_COLORS = {
  free: 'bg-bg-surface text-text-muted border border-border',
  tracao: 'bg-info/15 text-info',
  club: 'bg-brand-gold/15 text-brand-gold',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  inadimplente: 'Inadimplente',
  cancelled: 'Cancelado',
  completed: 'Concluído',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'text-success',
  inadimplente: 'text-error',
  cancelled: 'text-text-muted',
  completed: 'text-info',
}

export default async function AdminWorkspacePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = createAdminClient()

  const { data: wsData } = await supabase
    .from('workspaces')
    .select('*, workspace_members(*)')
    .eq('id', id)
    .single()

  if (!wsData) notFound()

  const ws = wsData
  const members = ws.workspace_members ?? []

  // Busca profiles dos membros separadamente
  const memberIds = members.map((m) => m.user_id)
  const profilesRes = memberIds.length > 0
    ? await supabase.from('profiles').select('id, name, email, avatar_url').in('id', memberIds)
    : { data: [] as { id: string; name: string; email: string; avatar_url: string | null }[] }

  const profileMap = Object.fromEntries(
    (profilesRes.data ?? []).map((p) => [p.id, p])
  )

  // Busca financial info via adminClient
  const [{ data: financialInfo }, { data: pendingInvites }] = await Promise.all([
    adminSupabase
      .from('financial_info')
      .select('*')
      .eq('workspace_id', id)
      .single(),
    adminSupabase
      .from('workspace_invites')
      .select('id, email, role, status, created_at')
      .eq('workspace_id', id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
  ])

  return (
    <div className="animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-text-muted mb-6">
        <Link href="/admin/workspaces" className="hover:text-text-primary transition-colors">Empresas</Link>
        <span>/</span>
        <span className="text-text-secondary">{ws.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-gold/15 flex items-center justify-center text-xl font-bold text-brand-gold">
            {ws.name[0]?.toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{ws.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${PLAN_COLORS[ws.plan_type as keyof typeof PLAN_COLORS]}`}>
                {PLAN_LABELS[ws.plan_type as keyof typeof PLAN_LABELS]}
              </span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full ${ws.is_active ? 'bg-success/15 text-success' : 'bg-error/15 text-error'}`}>
                {ws.is_active ? 'Ativo' : 'Inativo'}
              </span>
              <span className="text-xs text-text-muted">{ws.slug}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <ImpersonateButton workspaceId={id} />
          <Link
            href={`/admin/agentes/config/${id}`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-surface text-text-secondary border border-border hover:bg-bg-hover hover:text-text-primary text-sm font-medium transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Agentes IA
          </Link>
          <Link
            href={`/admin/workspaces/${id}/sessoes`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-surface text-text-secondary border border-border hover:bg-bg-hover hover:text-text-primary text-sm font-medium transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a4 4 0 0 0-4 4v6a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4z" />
              <path d="M12 18.5V22" /><path d="M7 22h10" />
            </svg>
            Sessões IA
          </Link>
          <Link
            href={`/admin/workspaces/${id}/tasks`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-surface text-text-secondary border border-border hover:bg-bg-hover hover:text-text-primary text-sm font-medium transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            Tarefas
          </Link>
          <Link
            href={`/admin/workspaces/${id}/entregas`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-gold/15 text-brand-gold border border-brand-gold/30 hover:bg-brand-gold/25 text-sm font-medium transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            Entregas
          </Link>
          <Link
            href={`/admin/workspaces/${id}/planner`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-surface text-text-secondary border border-border hover:bg-bg-hover hover:text-text-primary text-sm font-medium transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            Planejador
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coluna esquerda: edição + info financeira */}
        <div className="space-y-6">
          <div className="bg-bg-card border border-border rounded-xl p-6">
            <h2 className="font-semibold text-text-primary mb-4">Editar Empresa</h2>
            <EditWorkspaceForm workspace={ws} />
          </div>

          {/* Informações Financeiras */}
          <div className="bg-bg-card border border-border rounded-xl p-6">
            <h2 className="font-semibold text-text-primary mb-1">Informações Financeiras</h2>
            {financialInfo && (
              <div className="mb-4 p-3 bg-bg-surface rounded-lg border border-border text-xs text-text-secondary space-y-1">
                <p className="font-medium text-text-primary capitalize">
                  {financialInfo.plan_name} — <span className={STATUS_COLORS[financialInfo.status] ?? ''}>{STATUS_LABELS[financialInfo.status] ?? financialInfo.status}</span>
                </p>
                {financialInfo.total_value && (
                  <p className="font-medium">
                    R$ {Number(financialInfo.total_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                )}
                {financialInfo.installments && financialInfo.installment_value && (
                  <p>{financialInfo.installments}x de R$ {Number(financialInfo.installment_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                )}
                {financialInfo.entry_value && Number(financialInfo.entry_value) > 0 && (
                  <p>Entrada: R$ {Number(financialInfo.entry_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                )}
                {financialInfo.first_payment_date && (
                  <p>1° pagamento: {new Date(financialInfo.first_payment_date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                )}
                {financialInfo.start_date && (
                  <p>Início: {new Date(financialInfo.start_date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                )}
                {financialInfo.renewal_date && (() => {
                  const today = new Date()
                  const renewal = new Date(financialInfo.renewal_date + 'T12:00:00')
                  const diffDays = Math.ceil((renewal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                  const badgeColor = diffDays < 15 ? 'text-red-400 bg-red-400/15' : diffDays <= 30 ? 'text-yellow-400 bg-yellow-400/15' : 'text-green-400 bg-green-400/15'
                  return (
                    <p className="flex items-center gap-1.5">
                      Renovação: {renewal.toLocaleDateString('pt-BR')}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badgeColor}`}>
                        {diffDays <= 0 ? 'Vencido' : `${diffDays}d`}
                      </span>
                    </p>
                  )
                })()}
              </div>
            )}
            <FinancialInfoForm workspaceId={ws.id} existingInfo={financialInfo ?? null} />
          </div>
        </div>

        {/* Coluna central: acessos */}
        <div className="space-y-6">
          <div className="bg-bg-card border border-border rounded-xl p-6">
            <h2 className="font-semibold text-text-primary mb-4">Acessos</h2>
            <MentoradoAccessManager
              workspaceId={ws.id}
              members={members.map((m) => ({
                id: m.id,
                userId: m.user_id,
                name: profileMap[m.user_id]?.name ?? '',
                email: profileMap[m.user_id]?.email ?? '',
                role: m.role,
                isActive: m.is_active,
              }))}
              pendingInvites={(pendingInvites ?? []).map((inv) => ({
                id: inv.id,
                email: inv.email,
                role: inv.role,
                createdAt: inv.created_at,
              }))}
            />
          </div>
        </div>

      </div>
    </div>
  )
}
