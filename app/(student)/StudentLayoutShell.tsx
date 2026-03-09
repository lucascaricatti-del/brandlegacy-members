'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

type Profile = { name: string | null; role: string | null } | null

export default function StudentLayoutShell({
  profile,
  workspaceName,
  children,
}: {
  profile: Profile
  workspaceName?: string | null
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [midiaOpen, setMidiaOpen] = useState(true)
  const router = useRouter()

  async function handleLogout() {
    try {
      setLoggingOut(true)
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      await supabase.auth.signOut()
      router.push('/login')
    } catch {
      router.push('/login')
    }
  }

  return (
    <div className="flex min-h-screen bg-bg-base">
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 w-60 flex flex-col bg-bg-card border-r border-border',
          'transition-transform duration-200 ease-in-out',
          open ? 'translate-x-0' : '-translate-x-full',
          'md:relative md:translate-x-0 md:shrink-0',
        ].join(' ')}
      >
        {/* Logo */}
        <div className="px-6 py-6 border-b border-border flex items-center justify-between">
          <Link href="/dashboard" onClick={() => setOpen(false)}>
            <img src="/logo.png" alt="BrandLegacy" className="h-8 w-auto" />
            <p className="text-text-muted text-xs mt-1">Área de Membros</p>
          </Link>
          <button
            className="md:hidden p-1.5 rounded-lg hover:bg-bg-hover text-text-muted"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
          >
            <IconX />
          </button>
        </div>

        {/* Workspace name */}
        {workspaceName && (
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Workspace</p>
            <p className="text-sm font-semibold truncate" style={{ color: '#C9971A' }}>{workspaceName}</p>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <NavItem href="/academy" icon={<IconAcademy />} label="Academy" onNavigate={() => setOpen(false)} />

          <div className="pt-2 mt-2 border-t border-border space-y-1">
            <NavItem href="/dashboard" icon={<IconDashboard />} label="Dashboard" onNavigate={() => setOpen(false)} />
            <NavItem href="/entregas" icon={<IconEntregas />} label="Controle de Entregas" onNavigate={() => setOpen(false)} />
            <NavItem href="/workspace/tasks" icon={<IconTasks />} label="Tarefas" onNavigate={() => setOpen(false)} />

            {/* Collapsible: Métricas de Mídia */}
            <CollapsibleSection title="Métricas de Mídia" icon={<IconMetricasMidia />} isOpen={midiaOpen} onToggle={() => setMidiaOpen(!midiaOpen)} href="/metricas" onNavigate={() => setOpen(false)}>
              <SubNavItem href="/metricas?tab=meta" label="Meta Ads" icon={<IconSubMeta />} onNavigate={() => setOpen(false)} />
              <SubNavItem href="/metricas?tab=google" label="Google Ads" icon={<IconSubGoogle />} onNavigate={() => setOpen(false)} />
              <SubNavItem href="/metricas?tab=yampi" label="Yampi" icon={<IconSubYampi />} onNavigate={() => setOpen(false)} />
              <SubNavItem href="/metricas?tab=influenciadores" label="Influenciadores" icon={<IconSubInflu />} onNavigate={() => setOpen(false)} />
            </CollapsibleSection>

            <NavItem href="/marketplaces" icon={<IconMarketplaces />} label="Marketplaces" onNavigate={() => setOpen(false)} />
            <NavItem href="/performance" icon={<IconPerformance />} label="Performance" onNavigate={() => setOpen(false)} />
            <NavItem href="/ferramentas/calculadora-cenarios" icon={<IconCalc />} label="Calculadora Estratégica" onNavigate={() => setOpen(false)} />
            <NavItem href="/ferramentas/planejamento-midia" icon={<IconPlanMidia />} label="Midia Plan" onNavigate={() => setOpen(false)} />
            <NavItem href="/ferramentas/planejamento-financeiro" icon={<IconForecasting />} label="Forecasting" onNavigate={() => setOpen(false)} />
          </div>

          <div className="pt-2 mt-2 border-t border-border">
            <p className="text-text-muted text-[10px] font-medium px-3 mb-1.5 uppercase tracking-wider">Em breve</p>
            <NavItemSoon href="/ferramentas/sales-forecasting" label="Sales Forecasting" onNavigate={() => setOpen(false)} />
            <NavItemSoon href="/ferramentas/gerador-lp" label="Gerador de LP" onNavigate={() => setOpen(false)} />
            <NavItemSoon href="/ferramentas/funil-vendas" label="Funil de Vendas" onNavigate={() => setOpen(false)} />
          </div>

          <div className="pt-2 mt-2 border-t border-border space-y-1">
            <NavItem href="/team" icon={<IconTeam />} label="Equipe" onNavigate={() => setOpen(false)} />
            <NavItem href="/integracoes" icon={<IconIntegracoes />} label="Integrações" onNavigate={() => setOpen(false)} />
          </div>

          {profile?.role === 'admin' && (
            <div className="pt-3 mt-3 border-t border-border">
              <p className="text-text-muted text-xs font-medium px-3 mb-2 uppercase tracking-wider">Admin</p>
              <NavItem href="/admin" icon={<IconAdmin />} label="Painel Admin" onNavigate={() => setOpen(false)} />
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg mb-1">
            <div className="w-8 h-8 rounded-full bg-brand-gold/20 flex items-center justify-center shrink-0">
              <span className="text-brand-gold text-sm font-semibold">
                {profile?.name?.[0]?.toUpperCase() ?? 'A'}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-text-primary text-sm font-medium truncate">{profile?.name ?? 'Aluno'}</p>
              <p className="text-text-muted text-xs capitalize">{profile?.role === 'admin' ? 'Admin' : 'Aluno'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-text-muted hover:text-error hover:bg-error/10 transition-colors text-left disabled:opacity-50"
          >
            <IconLogout />
            {loggingOut ? 'Saindo...' : 'Sair'}
          </button>
        </div>
      </aside>

      {/* Right side */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="flex md:hidden sticky top-0 z-30 items-center gap-3 px-4 h-14 bg-bg-card border-b border-border shrink-0">
          <button
            onClick={() => setOpen(true)}
            className="p-2 -ml-1 rounded-lg hover:bg-bg-hover text-text-muted"
            aria-label="Abrir menu"
          >
            <IconMenu />
          </button>
          <Link href="/dashboard">
            <img src="/logo.png" alt="BrandLegacy" className="h-7 w-auto" />
          </Link>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

function NavItem({
  href,
  icon,
  label,
  onNavigate,
}: {
  href: string
  icon: React.ReactNode
  label: string
  onNavigate: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors group"
    >
      <span className="text-text-muted group-hover:text-brand-gold transition-colors">{icon}</span>
      {label}
    </Link>
  )
}

function SubNavItem({ href, label, icon, onNavigate }: { href: string; label: string; icon?: React.ReactNode; onNavigate: () => void }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center gap-2.5 px-3 py-2 ml-6 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover border-l-2 border-transparent hover:border-brand-gold transition-all group"
    >
      {icon && <span className="text-text-muted group-hover:text-brand-gold transition-colors">{icon}</span>}
      {label}
    </Link>
  )
}

function CollapsibleSection({
  title,
  icon,
  isOpen,
  onToggle,
  href,
  onNavigate,
  children,
}: {
  title: string
  icon: React.ReactNode
  isOpen: boolean
  onToggle: () => void
  href?: string
  onNavigate?: () => void
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center rounded-lg hover:bg-bg-hover transition-colors group">
        {href ? (
          <Link
            href={href}
            onClick={onNavigate}
            className="flex-1 flex items-center gap-3 px-3 py-2.5"
          >
            <span className="text-text-muted group-hover:text-brand-gold transition-colors">{icon}</span>
            <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
              {title}
            </span>
          </Link>
        ) : (
          <button
            onClick={onToggle}
            className="flex-1 flex items-center gap-3 px-3 py-2.5 cursor-pointer"
          >
            <span className="text-text-muted group-hover:text-brand-gold transition-colors">{icon}</span>
            <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors text-left">
              {title}
            </span>
          </button>
        )}
        <button
          onClick={onToggle}
          className="px-2 py-2.5 cursor-pointer"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-text-muted transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          isOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="space-y-0.5 py-0.5">
          {children}
        </div>
      </div>
    </div>
  )
}

function IconMenu() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}
function IconX() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
function IconDashboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  )
}
function IconAcademy() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}
function IconTasks() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  )
}
function IconEntregas() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  )
}
function IconAgenda() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}
function IconTeam() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
function IconAdmin() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}
function IconIntegracoes() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}
function IconMetricasMidia() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}
function IconPerformance() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" /><path d="M12 12l3-3" /><circle cx="12" cy="12" r="1" />
    </svg>
  )
}
function IconCalc() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="8" y1="10" x2="10" y2="10" /><line x1="14" y1="10" x2="16" y2="10" /><line x1="8" y1="14" x2="10" y2="14" /><line x1="14" y1="14" x2="16" y2="14" /><line x1="8" y1="18" x2="16" y2="18" />
    </svg>
  )
}

function IconPlanMidia() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
    </svg>
  )
}

function IconForecasting() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

function NavItemSoon({ href, label, onNavigate }: { href: string; label: string; onNavigate: () => void }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-muted/60 hover:text-text-muted hover:bg-bg-hover/50 transition-colors"
    >
      <span className="w-[18px] h-[18px] flex items-center justify-center text-text-muted/40">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
      </span>
      <span>{label}</span>
      <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-text-muted/50">em breve</span>
    </Link>
  )
}
function IconMarketplaces() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}
function IconLogout() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}
function IconSubMeta() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M12 2.04C6.5 2.04 2 6.53 2 12.06C2 17.06 5.66 21.21 10.44 21.96V14.96H7.9V12.06H10.44V9.85C10.44 7.34 11.93 5.96 14.22 5.96C15.31 5.96 16.45 6.15 16.45 6.15V8.62H15.19C13.95 8.62 13.56 9.39 13.56 10.18V12.06H16.34L15.89 14.96H13.56V21.96C18.34 21.21 22 17.06 22 12.06C22 6.53 17.5 2.04 12 2.04Z"/>
    </svg>
  )
}
function IconSubGoogle() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}
function IconSubYampi() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-green-400">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IconSubInflu() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M10 1l2.39 5.75L18 9.27l-4.55 3.56L14.76 19 10 15.67 5.24 19l1.31-6.17L2 9.27l5.61-2.52L10 1z"/>
    </svg>
  )
}
