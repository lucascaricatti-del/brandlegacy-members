import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-bg-surface text-text-muted border border-border',
  paid: 'bg-success/15 text-success',
  overdue: 'bg-error/15 text-error',
  cancelled: 'bg-bg-surface text-text-muted border border-border',
}
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente', paid: 'Pago', overdue: 'Atrasado', cancelled: 'Cancelado',
}

export default async function FinanceiroPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: records } = await supabase
    .from('financial_records')
    .select('*, workspaces(id, name)')
    .order('due_date', { ascending: false })

  type RawRecord = {
    id: string
    type: string
    amount_brl: number
    due_date: string | null
    paid_at: string | null
    status: string
    description: string | null
    workspace_id: string
    workspaces: { id: string; name: string } | null
  }

  const allRecords = (records as unknown as RawRecord[] ?? [])

  const totalPaid = allRecords
    .filter((r) => r.status === 'paid')
    .reduce((acc, r) => acc + Number(r.amount_brl), 0)

  const totalPending = allRecords
    .filter((r) => r.status === 'pending')
    .reduce((acc, r) => acc + Number(r.amount_brl), 0)

  const totalOverdue = allRecords
    .filter((r) => r.status === 'overdue')
    .reduce((acc, r) => acc + Number(r.amount_brl), 0)

  const fmtBrl = (v: number) =>
    v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Financeiro</h1>
        <p className="text-text-secondary mt-1">Receita, pagamentos e inadimplência</p>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <p className="text-sm text-text-muted mb-1">Recebido</p>
          <p className="text-2xl font-bold text-success">R$ {fmtBrl(totalPaid)}</p>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <p className="text-sm text-text-muted mb-1">A receber</p>
          <p className="text-2xl font-bold text-text-primary">R$ {fmtBrl(totalPending)}</p>
        </div>
        <div className={`bg-bg-card border rounded-xl p-5 ${totalOverdue > 0 ? 'border-error/40' : 'border-border'}`}>
          <p className="text-sm text-text-muted mb-1">Em atraso</p>
          <p className={`text-2xl font-bold ${totalOverdue > 0 ? 'text-error' : 'text-text-primary'}`}>
            R$ {fmtBrl(totalOverdue)}
          </p>
        </div>
      </div>

      {/* Tabela de registros */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-text-primary">Todos os Registros</h2>
        </div>

        {allRecords.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-text-muted">Nenhum registro financeiro ainda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-6 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Workspace</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Tipo</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Valor</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Vencimento</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Pagamento</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-bg-surface transition-colors">
                    <td className="px-6 py-3">
                      <Link href={`/interno/mentorados/${r.workspace_id}`} className="font-medium text-text-primary hover:text-brand-gold transition-colors">
                        {r.workspaces?.name ?? '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text-secondary capitalize">{r.type}</td>
                    <td className="px-4 py-3 text-right font-semibold text-text-primary">
                      R$ {fmtBrl(Number(r.amount_brl))}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {r.due_date ? new Date(r.due_date).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {r.paid_at ? new Date(r.paid_at).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] ?? ''}`}>
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
