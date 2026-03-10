import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveWorkspace } from '@/lib/resolve-workspace'
import DeliveryTimeline from './DeliveryTimeline'

export const metadata = { title: 'Controle de Entregas — BrandLegacy' }

export default async function EntregasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Busca o workspace ativo do usuário (com suporte a impersonação admin)
  const resolvedWs = await resolveWorkspace(user.id)
  const workspaces = resolvedWs ? [{ id: resolvedWs.id, name: resolvedWs.name, plan_type: resolvedWs.plan_type }] : []

  if (workspaces.length === 0) {
    return (
      <div className="animate-fade-in">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-primary">Controle de Entregas</h1>
          <p className="text-text-secondary mt-1">Acompanhe o progresso das suas sessões de mentoria.</p>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-16 text-center">
          <div className="text-4xl mb-4">📋</div>
          <p className="text-text-muted">Você ainda não está vinculado a um workspace.</p>
          <p className="text-text-muted text-sm mt-1">Entre em contato com seu mentor para ser adicionado.</p>
        </div>
      </div>
    )
  }

  // Usa o primeiro workspace ativo
  const ws = workspaces[0]

  // Busca entregas com materiais
  const { data: deliveries } = await supabase
    .from('deliveries')
    .select(`
      id, title, order_index, status, scheduled_date, completed_date, notes, link_call,
      delivery_materials(id, title, type, url, file_url)
    `)
    .eq('workspace_id', ws.id)
    .order('order_index')

  const PLAN_LABELS: Record<string, string> = { free: 'Free', tracao: 'Tração', club: 'Club' }
  const PLAN_COLORS: Record<string, string> = {
    free: 'bg-bg-surface text-text-muted border border-border',
    tracao: 'bg-info/15 text-info',
    club: 'bg-brand-gold/15 text-brand-gold',
  }

  const completed = (deliveries ?? []).filter((d) => d.status === 'completed').length
  const total = (deliveries ?? []).length

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-text-primary">Controle de Entregas</h1>
          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${PLAN_COLORS[ws.plan_type] ?? PLAN_COLORS.free}`}>
            {PLAN_LABELS[ws.plan_type] ?? ws.plan_type}
          </span>
        </div>
        <p className="text-text-secondary">
          {ws.name}
          {total > 0 && (
            <span className="ml-2 text-text-muted">
              — {completed}/{total} entrega{total !== 1 ? 's' : ''} concluída{completed !== 1 ? 's' : ''}
            </span>
          )}
        </p>
      </div>

      {/* Barra de progresso */}
      {total > 0 && (
        <div className="mb-8 bg-bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-text-secondary">Progresso geral</span>
            <span className="text-sm font-semibold text-text-primary">{Math.round((completed / total) * 100)}%</span>
          </div>
          <div className="h-2 bg-bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-gold rounded-full transition-all"
              style={{ width: `${(completed / total) * 100}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-text-muted">
            <span>{completed} concluída{completed !== 1 ? 's' : ''}</span>
            <span>{total - completed} restante{(total - completed) !== 1 ? 's' : ''}</span>
          </div>
        </div>
      )}

      {/* Timeline */}
      <DeliveryTimeline deliveries={(deliveries ?? []) as Parameters<typeof DeliveryTimeline>[0]['deliveries']} />
    </div>
  )
}
