'use client'

import { useState } from 'react'
import Link from 'next/link'
import { logout } from '@/app/actions/auth'

type Profile = { name: string | null; role: string | null } | null

export default function StudentLayoutShell({
  profile,
  children,
}: {
  profile: Profile
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [ferramentasOpen, setFerramentasOpen] = useState(false)

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
          <NavItem href="/dashboard" icon={<IconDashboard />} label="Dashboard" onNavigate={() => setOpen(false)} />
          <NavItem href="/academy" icon={<IconAcademy />} label="Academy" onNavigate={() => setOpen(false)} />
          <NavItem href="/workspace/tasks" icon={<IconTasks />} label="Tarefas" onNavigate={() => setOpen(false)} />
          <NavItem href="/entregas" icon={<IconEntregas />} label="Controle de Entregas" onNavigate={() => setOpen(false)} />
          <NavItem href="/integracoes" icon={<IconIntegracoes />} label="Integrações" onNavigate={() => setOpen(false)} />
          <NavItem href="/metricas" icon={<IconMetricas />} label="Métricas" onNavigate={() => setOpen(false)} />
          <NavItem href="/team" icon={<IconTeam />} label="Equipe" onNavigate={() => setOpen(false)} />

          {/* Ferramentas — submenu expansível */}
          <div>
            <button
              onClick={() => setFerramentasOpen((v) => !v)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors group"
            >
              <span className="text-text-muted group-hover:text-brand-gold transition-colors"><IconFerramentas /></span>
              <span className="flex-1 text-left">Ferramentas</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`text-text-muted transition-transform duration-200 ${ferramentasOpen ? 'rotate-180' : ''}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            <div className={`overflow-hidden transition-all duration-200 ${ferramentasOpen ? 'max-h-60' : 'max-h-0'}`}>
              <div className="ml-3 pl-3 border-l border-border space-y-0.5 py-1">
                <SubNavItem href="/ferramentas/planejamento-financeiro" label="Plan. Financeiro" onNavigate={() => setOpen(false)} />
                <SubNavItem href="/ferramentas/planejamento-midia" label="Plan. de Mídia" onNavigate={() => setOpen(false)} />
                <SubNavItem href="/ferramentas/calculadora-cenarios" label="Calc. de Cenários" onNavigate={() => setOpen(false)} />
                <SubNavItem href="/ferramentas/matriz-criativa" label="Matriz Criativa" onNavigate={() => setOpen(false)} />
                <SubNavItem href="/ferramentas/metricas-criativos" label="Métricas de Criativos" onNavigate={() => setOpen(false)} />
              </div>
            </div>
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
          <form action={logout}>
            <button
              type="submit"
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-text-muted hover:text-error hover:bg-error/10 transition-colors text-left"
            >
              <IconLogout />
              Sair
            </button>
          </form>
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
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
    >
      {label}
    </Link>
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
function IconMetricas() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}
function IconFerramentas() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
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
