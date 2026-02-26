import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CreateWorkspaceForm from './CreateWorkspaceForm'

const PLAN_LABELS = { free: 'Free', tracao: 'Tração', club: 'Club' }
const PLAN_COLORS = {
  free: 'bg-bg-surface text-text-muted border border-border',
  tracao: 'bg-info/15 text-info',
  club: 'bg-brand-gold/15 text-brand-gold',
}

export default async function AdminWorkspacesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('*, workspace_members(id, is_active), mentoring_contracts(id, status, plan_type)')
    .order('created_at', { ascending: false })

  const ws = workspaces ?? []
  const active = ws.filter((w) => w.is_active)

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Empresas</h1>
          <p className="text-text-secondary mt-1">
            {active.length} empresa{active.length !== 1 ? 's' : ''} ativa{active.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Formulário de criação */}
      <div className="bg-bg-card border border-border rounded-xl p-6 mb-8">
        <h2 className="font-semibold text-text-primary mb-4">Nova Empresa</h2>
        <CreateWorkspaceForm />
      </div>

      {/* Lista */}
      {ws.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-xl p-12 text-center text-text-muted text-sm">
          Nenhuma empresa criada.
        </div>
      ) : (
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs text-text-muted font-medium px-5 py-3 uppercase tracking-wider">Empresa</th>
                <th className="text-left text-xs text-text-muted font-medium px-5 py-3 uppercase tracking-wider">Plano</th>
                <th className="text-left text-xs text-text-muted font-medium px-5 py-3 uppercase tracking-wider">Membros</th>
                <th className="text-left text-xs text-text-muted font-medium px-5 py-3 uppercase tracking-wider">Contrato</th>
                <th className="text-left text-xs text-text-muted font-medium px-5 py-3 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {ws.map((w) => {
                const activeMembers = (w.workspace_members ?? []).filter((m) => m.is_active).length
                const activeContract = (w.mentoring_contracts ?? []).find((c) => c.status === 'active')

                return (
                  <tr key={w.id} className="border-b border-border last:border-0 hover:bg-bg-hover transition-colors">
                    <td className="px-5 py-4">
                      <Link href={`/admin/workspaces/${w.id}`} className="font-medium text-text-primary hover:text-brand-gold transition-colors text-sm">
                        {w.name}
                      </Link>
                      <p className="text-xs text-text-muted">{w.slug}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${PLAN_COLORS[w.plan_type as keyof typeof PLAN_COLORS]}`}>
                        {PLAN_LABELS[w.plan_type as keyof typeof PLAN_LABELS]}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-text-muted">{activeMembers}</td>
                    <td className="px-5 py-4">
                      {activeContract ? (
                        <span className="text-xs text-text-secondary capitalize">{activeContract.plan_type}</span>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${w.is_active ? 'bg-success/15 text-success' : 'bg-error/15 text-error'}`}>
                        {w.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <Link href={`/admin/workspaces/${w.id}`} className="text-xs text-brand-gold hover:text-brand-gold-light transition-colors">
                        Gerenciar →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
