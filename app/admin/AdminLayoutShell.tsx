'use client'

import { useState } from 'react'
import Link from 'next/link'
import { logout } from '@/app/actions/auth'

type Profile = { name: string | null; admin_role: string | null } | null

const ADMIN_ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  mentor: 'Mentor',
  lideranca: 'Liderança',
  cx: 'CX',
  financeiro: 'Financeiro',
}

const ADMIN_ROLE_COLORS: Record<string, string> = {
  admin: 'bg-brand-gold/15 text-brand-gold',
  mentor: 'bg-info/15 text-info',
  lideranca: 'bg-purple-400/15 text-purple-400',
  cx: 'bg-green-400/15 text-green-400',
  financeiro: 'bg-yellow-400/15 text-yellow-400',
}

export default function AdminLayoutShell({
  profile,
  children,
}: {
  profile: Profile
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [crmOpen, setCrmOpen] = useState(false)

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
          <Link href="/admin" onClick={() => setOpen(false)}>
            <img src="/logo.png" alt="BrandLegacy" className="h-8 w-auto" />
            <p className="text-xs mt-1 text-brand-gold/70 font-medium">Painel Admin</p>
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
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavItem href="/admin/modulos" icon={<IconModulos />} label="Módulos" onNavigate={() => setOpen(false)} />
          <NavItem href="/admin/workspaces" icon={<IconWorkspaces />} label="Empresas" onNavigate={() => setOpen(false)} />
          <NavItem href="/admin/agentes" icon={<IconAgentes />} label="Agentes" onNavigate={() => setOpen(false)} />
          <NavItem href="/admin/financeiro" icon={<IconFinanceiro />} label="Financeiro" onNavigate={() => setOpen(false)} />
          <NavItem href="/admin/cx" icon={<IconCx />} label="CX" onNavigate={() => setOpen(false)} />
          {/* CRM — submenu expansível */}
          <div>
            <button
              onClick={() => setCrmOpen((v) => !v)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors group"
            >
              <span className="text-text-muted group-hover:text-brand-gold transition-colors"><IconCrm /></span>
              <span className="flex-1 text-left">CRM</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-text-muted transition-transform duration-200 ${crmOpen ? 'rotate-180' : ''}`}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            <div className={`overflow-hidden transition-all duration-200 ${crmOpen ? 'max-h-36' : 'max-h-0'}`}>
              <div className="ml-3 pl-3 border-l border-border space-y-0.5 py-1">
                <Link href="/admin/crm" onClick={() => setOpen(false)} className="flex items-center px-3 py-2 rounded-lg text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors">Pipeline</Link>
                <Link href="/admin/crm/funis" onClick={() => setOpen(false)} className="flex items-center px-3 py-2 rounded-lg text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors">Funis</Link>
                <Link href="/admin/leads" onClick={() => setOpen(false)} className="flex items-center px-3 py-2 rounded-lg text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors">Leads</Link>
              </div>
            </div>
          </div>
          <NavItem href="/admin/equipe" icon={<IconEquipe />} label="Equipe" onNavigate={() => setOpen(false)} />
          <div className="pt-3 mt-3 border-t border-border">
            <NavItem href="/dashboard" icon={<IconArea />} label="Área do Mentorado" onNavigate={() => setOpen(false)} />
          </div>
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
              <p className="text-text-primary text-sm font-medium truncate">{profile?.name ?? 'Admin'}</p>
              <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ADMIN_ROLE_COLORS[profile?.admin_role ?? 'admin'] ?? ADMIN_ROLE_COLORS.admin}`}>
                {ADMIN_ROLE_LABELS[profile?.admin_role ?? 'admin'] ?? 'Admin'}
              </span>
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
          <Link href="/admin">
            <img src="/logo.png" alt="BrandLegacy" className="h-7 w-auto" />
          </Link>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8">
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
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
}
function IconModulos() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
}
function IconArea() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
}
function IconWorkspaces() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg>
}
function IconAgentes() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
}
function IconFinanceiro() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
}
function IconCx() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
}
function IconEquipe() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
}
function IconCrm() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
}
function IconLeads() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /><line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" /></svg>
}
function IconLogout() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
}
