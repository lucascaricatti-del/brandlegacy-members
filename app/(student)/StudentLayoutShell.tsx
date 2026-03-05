'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

type Profile = { name: string | null; role: string | null } | null

export default function StudentLayoutShell({
  profile,
  children,
}: {
  profile: Profile
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

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <NavItem href="/academy" icon={<IconAcademy />} label="Academy" onNavigate={() => setOpen(false)} />

          <div className="pt-2 mt-2 border-t border-border space-y-1">
            <NavItem href="/dashboard" icon={<IconDashboard />} label="Dashboard" onNavigate={() => setOpen(false)} />
            <NavItem href="/entregas" icon={<IconEntregas />} label="Controle de Entregas" onNavigate={() => setOpen(false)} />
            <NavItem href="/workspace/tasks" icon={<IconTasks />} label="Tarefas" onNavigate={() => setOpen(false)} />

            {/* Collapsible: Métricas de Mídia */}
            <CollapsibleSection title="Métricas de Mídia" icon={<IconMetricasMidia />} isOpen={midiaOpen} onToggle={() => setMidiaOpen(!midiaOpen)} href="/metricas" onNavigate={() => setOpen(false)}>
              <SubNavItem href="/metricas?tab=meta" label="Meta" onNavigate={() => setOpen(false)} />
              <SubNavItem href="/metricas?tab=google" label="Google" onNavigate={() => setOpen(false)} />
              <SubNavItem href="/metricas?tab=yampi" label="Yampi" onNavigate={() => setOpen(false)} />
              <div className="flex items-center gap-2 px-3 py-2 pl-9 text-xs text-text-muted/60">
                <span>Influenciadores</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-text-muted/50">em breve</span>
              </div>
            </CollapsibleSection>

            <NavItem href="/marketplaces" icon={<IconMarketplaces />} label="Marketplaces" onNavigate={() => setOpen(false)} />
            <NavItem href="/performance" icon={<IconPerformance />} label="Performance" onNavigate={() => setOpen(false)} />
            <NavItem href="/ferramentas/calculadora-cenarios" icon={<IconCalc />} label="Calculadora Estratégica" onNavigate={() => setOpen(false)} />
            <NavItem href="/ferramentas/planejamento-midia" icon={<IconPlanMidia />} label="Mídia Plan" onNavigate={() => setOpen(false)} />
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

function SubNavItem({ href, label, onNavigate }: { href: string; label: string; onNavigate: () => void }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center gap-2 px-3 py-2 pl-9 rounded-lg text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
    >
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
          isOpen ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'
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
