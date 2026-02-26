import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DeliveryManager from './DeliveryManager'

interface Props {
  params: Promise<{ id: string }>
}

const PLAN_LABELS: Record<string, string> = { free: 'Free', tracao: 'Tração', club: 'Club' }
const PLAN_COLORS: Record<string, string> = {
  free: 'bg-bg-surface text-text-muted border border-border',
  tracao: 'bg-info/15 text-info',
  club: 'bg-brand-gold/15 text-brand-gold',
}

export default async function AdminWorkspaceEntregasPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [wsRes, contractsRes] = await Promise.all([
    supabase
      .from('workspaces')
      .select('id, name, slug, plan_type')
      .eq('id', id)
      .single(),
    supabase
      .from('mentoring_contracts')
      .select('id, plan_type, status')
      .eq('workspace_id', id)
      .eq('status', 'active')
      .limit(1),
  ])

  if (!wsRes.data) notFound()

  const ws = wsRes.data
  const activeContract = contractsRes.data?.[0] ?? null

  const { data: deliveries } = await supabase
    .from('deliveries')
    .select(`
      id, title, order_index, status, scheduled_date, completed_date, notes,
      delivery_materials(id, title, type, url, file_url)
    `)
    .eq('workspace_id', id)
    .order('order_index')

  const completed = (deliveries ?? []).filter((d) => d.status === 'completed').length
  const total = (deliveries ?? []).length

  return (
    <div className="animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-text-muted mb-6">
        <Link href="/admin/workspaces" className="hover:text-text-primary transition-colors">Workspaces</Link>
        <span>/</span>
        <Link href={`/admin/workspaces/${id}`} className="hover:text-text-primary transition-colors">{ws.name}</Link>
        <span>/</span>
        <span className="text-text-secondary">Entregas</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-text-primary">Controle de Entregas</h1>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${PLAN_COLORS[ws.plan_type] ?? PLAN_COLORS.free}`}>
              {PLAN_LABELS[ws.plan_type] ?? ws.plan_type}
            </span>
          </div>
          <p className="text-text-secondary">{ws.name}</p>
          {activeContract && (
            <p className="text-text-muted text-xs mt-1">Contrato ativo: {activeContract.id.slice(0, 8)}…</p>
          )}
        </div>

        {/* Progresso */}
        {total > 0 && (
          <div className="bg-bg-card border border-border rounded-xl px-5 py-4 text-center shrink-0">
            <p className="text-3xl font-bold text-text-primary">{completed}/{total}</p>
            <p className="text-xs text-text-muted mt-0.5">concluídas</p>
            <div className="w-24 h-1.5 bg-bg-surface rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-brand-gold rounded-full"
                style={{ width: `${(completed / total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Manager */}
      <DeliveryManager
        workspaceId={id}
        planType={ws.plan_type as 'free' | 'tracao' | 'club'}
        contractId={activeContract?.id ?? null}
        deliveries={(deliveries ?? []) as Parameters<typeof DeliveryManager>[0]['deliveries']}
      />
    </div>
  )
}
