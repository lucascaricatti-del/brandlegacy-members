import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InternalTeamSection from './InternalTeamSection'

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    companiesRes,
    modulesRes,
    lessonsRes,
    financialRes,
    contractsRes,
    internalTeamRes,
  ] = await Promise.all([
    supabase.from('workspaces').select('id', { count: 'exact' }).eq('is_active', true),
    supabase.from('modules').select('id, title, is_published, lessons(id)', { count: 'exact' }),
    supabase.from('lessons').select('id', { count: 'exact' }).eq('is_published', true),
    supabase.from('financial_records').select('amount_brl, status, workspace_id'),
    supabase
      .from('mentoring_contracts')
      .select('renewal_date, status')
      .eq('status', 'active')
      .not('renewal_date', 'is', null),
    supabase
      .from('profiles')
      .select('id, name, email, role, is_active')
      .in('role', ['cx', 'financial', 'mentor'])
      .order('name'),
  ])

  const totalCompanies = companiesRes.count ?? 0
  const totalModules = modulesRes.count ?? 0
  const publishedModules = modulesRes.data?.filter((m) => m.is_published).length ?? 0
  const totalLessons = lessonsRes.count ?? 0

  const financials = financialRes.data ?? []
  const paidRevenue = financials
    .filter((f) => f.status === 'paid')
    .reduce((sum, f) => sum + (f.amount_brl ?? 0), 0)
  const pendingRevenue = financials
    .filter((f) => f.status === 'pending')
    .reduce((sum, f) => sum + (f.amount_brl ?? 0), 0)
  const overdueCompanies = new Set(
    financials.filter((f) => f.status === 'overdue').map((f) => f.workspace_id)
  ).size

  const today = new Date()
  const in30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
  const renewalsSoon = (contractsRes.data ?? []).filter((c) => {
    if (!c.renewal_date) return false
    const d = new Date(c.renewal_date)
    return d >= today && d <= in30
  }).length

  const recentModules = modulesRes.data?.slice(0, 5) ?? []
  const internalTeam = internalTeamRes.data ?? []

  function fmtBrl(value: number) {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Visão Geral</h1>
        <p className="text-text-secondary mt-1">Painel administrativo BrandLegacy</p>
      </div>

      {/* Alerta de renovações */}
      {renewalsSoon > 0 && (
        <div className="mb-6 bg-brand-gold/10 border border-brand-gold/30 rounded-xl px-5 py-3 flex items-center gap-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-gold shrink-0">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className="text-brand-gold text-sm">
            <strong>{renewalsSoon}</strong> contrato{renewalsSoon !== 1 ? 's' : ''} com renovação nos próximos 30 dias.
          </p>
          <Link href="/admin/workspaces" className="ml-auto text-xs text-brand-gold hover:text-brand-gold-light transition-colors shrink-0">
            Ver empresas →
          </Link>
        </div>
      )}

      {/* Métricas — Empresas */}
      <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Empresas</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard label="Empresas ativas" value={String(totalCompanies)} icon={<IconBuilding />} />
        <StatCard label="Receita paga" value={`R$ ${fmtBrl(paidRevenue)}`} icon={<IconCheck />} color="text-success" />
        <StatCard label="A receber" value={`R$ ${fmtBrl(pendingRevenue)}`} icon={<IconClock />} color="text-info" />
        <StatCard
          label="Em atraso"
          value={String(overdueCompanies)}
          sub="empresas"
          icon={<IconAlert />}
          color={overdueCompanies > 0 ? 'text-error' : 'text-text-muted'}
        />
      </div>

      {/* Métricas — Conteúdo */}
      <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Conteúdo</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard label="Módulos" value={`${publishedModules}/${totalModules}`} sub="publicados/total" icon={<IconBook />} />
        <StatCard label="Aulas publicadas" value={String(totalLessons)} icon={<IconPlay />} />
      </div>

      {/* Ações rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        <Link
          href="/admin/workspaces"
          className="bg-bg-card border border-border rounded-xl p-6 hover:border-brand-gold/40 hover:bg-bg-surface transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-gold/15 flex items-center justify-center">
              <IconBuilding className="text-brand-gold w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary group-hover:text-brand-gold transition-colors">Gerenciar Empresas</h3>
              <p className="text-text-muted text-sm mt-0.5">Ver empresas, acessos e entregas</p>
            </div>
          </div>
        </Link>

        <Link
          href="/admin/modulos"
          className="bg-bg-card border border-border rounded-xl p-6 hover:border-brand-gold/40 hover:bg-bg-surface transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-gold/15 flex items-center justify-center">
              <IconBook className="text-brand-gold w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary group-hover:text-brand-gold transition-colors">Gerenciar Módulos</h3>
              <p className="text-text-muted text-sm mt-0.5">Criar e editar módulos e aulas</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Equipe Interna */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Equipe Interna</h2>
            <p className="text-text-muted text-xs mt-0.5">Colaboradores com acesso ao painel interno</p>
          </div>
          <span className="text-xs text-text-muted">{internalTeam.length} membro{internalTeam.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <InternalTeamSection members={internalTeam} />
        </div>
      </div>

      {/* Módulos recentes */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Módulos</h2>
          <Link href="/admin/modulos" className="text-sm text-brand-gold hover:text-brand-gold-light transition-colors">
            Ver todos →
          </Link>
        </div>

        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          {recentModules.length === 0 ? (
            <div className="p-10 text-center text-text-muted text-sm">
              Nenhum módulo criado ainda.{' '}
              <Link href="/admin/modulos" className="text-brand-gold hover:underline">Criar primeiro módulo</Link>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs text-text-muted font-medium px-5 py-3 uppercase tracking-wider">Módulo</th>
                  <th className="text-left text-xs text-text-muted font-medium px-5 py-3 uppercase tracking-wider">Aulas</th>
                  <th className="text-left text-xs text-text-muted font-medium px-5 py-3 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentModules.map((mod) => (
                  <tr key={mod.id} className="border-b border-border last:border-0 hover:bg-bg-hover transition-colors">
                    <td className="px-5 py-3.5">
                      <Link href={`/admin/modulos/${mod.id}`} className="font-medium text-text-primary hover:text-brand-gold transition-colors text-sm">
                        {mod.title}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-text-muted">
                      {mod.lessons?.length ?? 0} aulas
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${mod.is_published ? 'bg-success/15 text-success' : 'bg-bg-surface text-text-muted'}`}>
                        {mod.is_published ? 'Publicado' : 'Rascunho'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  sub,
  color = 'text-text-primary',
}: {
  label: string
  value: string
  icon: React.ReactNode
  sub?: string
  color?: string
}) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-text-muted text-xs font-medium uppercase tracking-wider">{label}</p>
        <span className="text-text-muted">{icon}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-text-muted text-xs mt-1">{sub}</p>}
    </div>
  )
}

function IconBuilding({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  )
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

function IconClock({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  )
}

function IconAlert({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}

function IconBook({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  )
}

function IconPlay({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
    </svg>
  )
}
