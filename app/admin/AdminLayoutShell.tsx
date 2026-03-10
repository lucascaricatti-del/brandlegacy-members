'use client'

import { useState, useEffect, createContext, useContext } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

type Profile = { name: string | null; admin_role: string | null } | null

const NavCtx = createContext<(v: boolean) => void>(() => {})

// ── Design tokens (same as StudentLayoutShell) ──
const T = {
  bg: '#050D07',
  gold: '#C9971A',
  goldHover: '#E5B82A',
  surface: 'rgba(255,255,255,0.03)',
  border: 'rgba(255,255,255,0.08)',
  divider: 'rgba(255,255,255,0.06)',
  textPrimary: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.45)',
  textNav: 'rgba(255,255,255,0.6)',
  sectionLabel: 'rgba(255,255,255,0.3)',
  hoverBg: 'rgba(255,255,255,0.05)',
  activeBg: 'rgba(201,151,26,0.12)',
}

const ADMIN_ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', mentor: 'Mentor', lideranca: 'Lideranca', cx: 'CX', financeiro: 'Financeiro',
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
  const [loggingOut, setLoggingOut] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const nav = () => setOpen(false)
  const [navigating, setNavigating] = useState(false)
  useEffect(() => { setNavigating(false) }, [pathname])

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

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
    <div className="flex min-h-screen" style={{ background: T.bg }}>
      {/* Progress bar */}
      {navigating && (
        <div className="fixed top-0 left-0 right-0 z-[100] h-0.5 overflow-hidden" style={{ background: 'rgba(201,151,26,0.15)' }}>
          <div className="h-full" style={{ background: T.gold, animation: 'navProgress 1.5s ease-in-out infinite', width: '40%' }} />
        </div>
      )}
      <style>{`@keyframes navProgress{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>

      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={nav} />
      )}

      {/* Sidebar */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex flex-col',
          'transition-transform duration-200 ease-in-out',
          open ? 'translate-x-0' : '-translate-x-full',
          'md:relative md:translate-x-0 md:shrink-0',
        ].join(' ')}
        style={{
          width: 220,
          background: T.bg,
          borderRight: `1px solid ${T.border}`,
        }}
      >
        {/* Logo */}
        <div className="px-4 py-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${T.border}` }}>
          <Link href="/admin" onClick={nav}>
            <img src="/logo.png" alt="BrandLegacy" className="h-7 w-auto" />
            <p className="text-xs mt-0.5" style={{ color: T.gold, opacity: 0.7 }}>Painel Admin</p>
          </Link>
          <button className="md:hidden p-1.5 rounded-lg" onClick={nav} aria-label="Fechar menu" style={{ color: T.textMuted }}>
            <IconX />
          </button>
        </div>

        {/* Nav */}
        <NavCtx.Provider value={setNavigating}>
        <nav className="flex-1 overflow-y-auto py-3" style={{ scrollbarWidth: 'none' } as React.CSSProperties}>
          <div className="px-2 space-y-0.5">
            <SidebarItem href="/admin" icon={<IconDashboard />} label="Dashboard" active={pathname === '/admin'} onClick={nav} />
          </div>

          <Divider />
          <SectionLabel>Gestao</SectionLabel>
          <div className="px-2 space-y-0.5">
            <SidebarItem href="/admin/workspaces" icon={<IconWorkspaces />} label="Empresas" active={isActive('/admin/workspaces')} onClick={nav} />
            <SidebarItem href="/admin/modulos" icon={<IconModulos />} label="Modulos" active={isActive('/admin/modulos')} onClick={nav} />
            <SidebarItem href="/admin/alunos" icon={<IconCx />} label="Usuarios" active={isActive('/admin/alunos')} onClick={nav} />
          </div>

          <Divider />
          <SectionLabel>Operacoes</SectionLabel>
          <div className="px-2 space-y-0.5">
            <SidebarItem href="/admin/financeiro" icon={<IconFinanceiro />} label="Financeiro" active={isActive('/admin/financeiro')} onClick={nav} />
            <SidebarItem href="/admin/agentes" icon={<IconAgentes />} label="Agentes" active={isActive('/admin/agentes')} onClick={nav} />
          </div>

          <Divider />
          <SectionLabel>CRM</SectionLabel>
          <div className="px-2 space-y-0.5">
            <SidebarItem href="/admin/crm" icon={<IconCrm />} label="Pipeline" active={pathname === '/admin/crm'} onClick={nav} />
            <SidebarSub href="/admin/crm/funis" label="Funis" active={isActive('/admin/crm/funis')} onClick={nav} />
            <SidebarSub href="/admin/leads" label="Leads" active={isActive('/admin/leads')} onClick={nav} />
          </div>

          <Divider />
          <div className="px-2 space-y-0.5">
            <SidebarItem href="/admin/equipe" icon={<IconEquipe />} label="Equipe Interna" active={isActive('/admin/equipe')} onClick={nav} />
          </div>

          <Divider />
          <div className="px-2 space-y-0.5">
            <SidebarItem href="/dashboard" icon={<IconArea />} label="Area do Mentorado" active={false} onClick={nav} />
          </div>
        </nav>
        </NavCtx.Provider>

        {/* Footer */}
        <div className="px-3 py-3" style={{ borderTop: `1px solid ${T.border}` }}>
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg mb-1">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: T.activeBg }}>
              <span className="text-xs font-semibold" style={{ color: T.gold }}>
                {profile?.name?.[0]?.toUpperCase() ?? 'A'}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: T.textPrimary }}>{profile?.name ?? 'Admin'}</p>
              <p className="capitalize" style={{ fontSize: 10, color: T.gold }}>
                {ADMIN_ROLE_LABELS[profile?.admin_role ?? 'admin'] ?? 'Admin'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors disabled:opacity-50"
            style={{ fontSize: 13, color: T.textMuted }}
            onMouseOver={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)' }}
            onMouseOut={e => { e.currentTarget.style.color = T.textMuted; e.currentTarget.style.background = 'transparent' }}
          >
            <IconLogout />
            {loggingOut ? 'Saindo...' : 'Sair'}
          </button>
        </div>
      </aside>

      {/* Right side */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header
          className="flex md:hidden sticky top-0 z-30 items-center gap-3 px-4 h-14 shrink-0"
          style={{ background: T.bg, borderBottom: `1px solid ${T.border}` }}
        >
          <button onClick={() => setOpen(true)} className="p-2 -ml-1 rounded-lg" aria-label="Abrir menu" style={{ color: T.textMuted }}>
            <IconMenu />
          </button>
          <Link href="/admin">
            <img src="/logo.png" alt="BrandLegacy" className="h-7 w-auto" />
          </Link>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div key={pathname} className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8" style={{ animation: 'fadeIn 0.15s ease-out' }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

// ── Nav components (same pattern as StudentLayoutShell) ──

function SidebarItem({ href, icon, label, active, onClick }: {
  href: string; icon: React.ReactNode; label: string; active: boolean; onClick: () => void
}) {
  const setNav = useContext(NavCtx)
  return (
    <Link
      href={href}
      onClick={() => { onClick(); if (!active) setNav(true) }}
      className="flex items-center rounded-lg transition-all"
      style={{
        height: 36,
        padding: '0 12px 0 16px',
        gap: 10,
        fontSize: 13,
        fontWeight: 500,
        color: active ? T.gold : T.textNav,
        background: active ? T.activeBg : 'transparent',
      }}
      onMouseOver={e => {
        if (!active) { e.currentTarget.style.background = T.hoverBg; e.currentTarget.style.color = T.textPrimary }
      }}
      onMouseOut={e => {
        if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.textNav }
      }}
    >
      <span style={{ opacity: active ? 1 : 0.6, color: active ? T.gold : 'inherit', display: 'flex' }}>{icon}</span>
      {label}
    </Link>
  )
}

function SidebarSub({ href, label, active, onClick }: {
  href: string; label: string; active: boolean; onClick: () => void
}) {
  const setNav = useContext(NavCtx)
  return (
    <Link
      href={href}
      onClick={() => { onClick(); if (!active) setNav(true) }}
      className="flex items-center rounded-lg transition-all"
      style={{
        height: 34,
        paddingLeft: 42,
        paddingRight: 12,
        gap: 10,
        fontSize: 12.5,
        fontWeight: 500,
        color: active ? T.gold : T.textNav,
        background: active ? T.activeBg : 'transparent',
      }}
      onMouseOver={e => {
        if (!active) { e.currentTarget.style.background = T.hoverBg; e.currentTarget.style.color = T.textPrimary }
      }}
      onMouseOut={e => {
        if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.textNav }
      }}
    >
      {label}
    </Link>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="uppercase select-none" style={{ fontSize: 9, letterSpacing: '0.18em', color: T.sectionLabel, padding: '16px 16px 4px' }}>
      {children}
    </p>
  )
}

function Divider() {
  return <div style={{ height: 1, background: T.divider, margin: '8px 16px' }} />
}

// ── Icons ──
function IconMenu() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
}
function IconX() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
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
function IconLogout() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
}
