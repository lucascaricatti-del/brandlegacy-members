'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

type Profile = { name: string | null; role: string | null } | null

// ── Design tokens ──
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
  soonBadgeBg: 'rgba(201,151,26,0.15)',
}

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
  const router = useRouter()
  const pathname = usePathname()
  const nav = () => setOpen(false)

  function isActive(href: string) {
    if (href.includes('?')) {
      const [path, qs] = href.split('?')
      return pathname === path && typeof window !== 'undefined' && window.location.search.includes(qs)
    }
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
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={nav}
        />
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
          <Link href="/dashboard" onClick={nav}>
            <img src="/logo.png" alt="BrandLegacy" className="h-7 w-auto" />
            <p className="text-xs mt-0.5" style={{ color: T.textMuted }}>Área de Membros</p>
          </Link>
          <button
            className="md:hidden p-1.5 rounded-lg"
            onClick={nav}
            aria-label="Fechar menu"
            style={{ color: T.textMuted }}
          >
            <IconX />
          </button>
        </div>

        {/* Workspace name */}
        {workspaceName && (
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
            <p className="uppercase tracking-widest" style={{ fontSize: 9, color: T.sectionLabel }}>Workspace</p>
            <p className="text-sm font-semibold truncate" style={{ color: T.gold }}>{workspaceName}</p>
          </div>
        )}

        {/* Nav */}
        <nav
          className="flex-1 overflow-y-auto py-3"
          style={{ scrollbarWidth: 'none' } as React.CSSProperties}
        >
          {/* Top items */}
          <div className="px-2 space-y-0.5">
            <SidebarItem href="/academy" icon={<IcoGraduationCap />} label="Academy" active={isActive('/academy')} onClick={nav} />
            <SidebarItem href="/dashboard" icon={<IcoDashboard />} label="Dashboard" active={isActive('/dashboard')} onClick={nav} />
          </div>

          <Divider />

          {/* OPERATIONS */}
          <SectionLabel>Operations</SectionLabel>
          <div className="px-2 space-y-0.5">
            <SidebarItem href="/entregas" icon={<IcoGitBranch />} label="Workflow" active={isActive('/entregas')} onClick={nav} />
            <SidebarItem href="/workspace/tasks" icon={<IcoCheckSquare />} label="Tasks" active={isActive('/workspace/tasks')} onClick={nav} />
          </div>

          <Divider />

          {/* MÍDIA ANALYTICS */}
          <SectionLabel>Mídia Analytics</SectionLabel>
          <div className="px-2 space-y-0.5">
            <SidebarItem href="/performance" icon={<IcoTrendingUp />} label="Performance" active={isActive('/performance')} onClick={nav} />
            <SidebarSub href="/metricas?tab=meta" icon={<IconSubMeta />} label="Meta Ads" active={isActive('/metricas?tab=meta')} onClick={nav} />
            <SidebarSub href="/metricas?tab=google" icon={<IconSubGoogle />} label="Google Ads" active={isActive('/metricas?tab=google')} onClick={nav} />
            <SidebarSub href="/metricas?tab=yampi" icon={<IcoShoppingCart />} label="Yampi" active={isActive('/metricas?tab=yampi')} onClick={nav} />
            <SidebarSub href="/metricas?tab=influenciadores" icon={<IcoStar />} label="Influencers" active={isActive('/metricas?tab=influenciadores')} onClick={nav} />
          </div>

          <Divider />

          {/* BUSINESS PLAN */}
          <SectionLabel>Business Plan</SectionLabel>
          <div className="px-2 space-y-0.5">
            <SidebarItem href="/ferramentas/planejamento-midia" icon={<IcoBarChart />} label="Mídia Plan" active={isActive('/ferramentas/planejamento-midia')} onClick={nav} />
            <SidebarItem href="/ferramentas/planejamento-midia?tab=sales_forecast" icon={<IcoDollarSign />} label="Sales Forecast" active={isActive('/ferramentas/planejamento-midia?tab=sales_forecast')} onClick={nav} />
            <SidebarItem href="/ferramentas/forecast" icon={<IcoTrendingUp />} label="Forecast" active={isActive('/ferramentas/forecast')} onClick={nav} />
            <SidebarItem href="/ferramentas/calculadora-cenarios" icon={<IcoCalculator />} label="ROAS/CAC Planner" active={isActive('/ferramentas/calculadora-cenarios')} onClick={nav} />
          </div>

          <Divider />

          {/* Marketplaces */}
          <div className="px-2 space-y-0.5">
            <SidebarItem href="/marketplaces" icon={<IcoStore />} label="Marketplaces" active={isActive('/marketplaces')} onClick={nav} />
          </div>

          <Divider />

          {/* EM BREVE */}
          <SectionLabel>Em breve</SectionLabel>
          <div className="px-2 space-y-0.5">
            <SoonItem label="Gerador de LP" />
            <SoonItem label="Funil de Vendas" />
          </div>

          <Divider />

          {/* Bottom */}
          <div className="px-2 space-y-0.5">
            <SidebarItem href="/team" icon={<IcoTeam />} label="Equipe" active={isActive('/team')} onClick={nav} />
            <SidebarItem href="/integracoes" icon={<IcoLink />} label="Integrações" active={isActive('/integracoes')} onClick={nav} />
          </div>

          {profile?.role === 'admin' && (
            <>
              <Divider />
              <SectionLabel>Admin</SectionLabel>
              <div className="px-2">
                <SidebarItem href="/admin" icon={<IcoShield />} label="Painel Admin" active={isActive('/admin')} onClick={nav} />
              </div>
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3" style={{ borderTop: `1px solid ${T.border}` }}>
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg mb-1">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{ background: T.activeBg }}
            >
              <span className="text-xs font-semibold" style={{ color: T.gold }}>
                {profile?.name?.[0]?.toUpperCase() ?? 'A'}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: T.textPrimary }}>{profile?.name ?? 'Aluno'}</p>
              <p className="capitalize" style={{ fontSize: 10, color: T.textMuted }}>{profile?.role === 'admin' ? 'Admin' : 'Aluno'}</p>
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
            <IcoLogout />
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
          <button
            onClick={() => setOpen(true)}
            className="p-2 -ml-1 rounded-lg"
            aria-label="Abrir menu"
            style={{ color: T.textMuted }}
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

// ── Nav components ──

function SidebarItem({ href, icon, label, active, onClick }: {
  href: string; icon: React.ReactNode; label: string; active: boolean; onClick: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
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
        if (!active) {
          e.currentTarget.style.background = T.hoverBg
          e.currentTarget.style.color = T.textPrimary
        }
      }}
      onMouseOut={e => {
        if (!active) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = T.textNav
        }
      }}
    >
      <span style={{ opacity: active ? 1 : 0.6, color: active ? T.gold : 'inherit', display: 'flex' }}>{icon}</span>
      {label}
    </Link>
  )
}

function SidebarSub({ href, icon, label, active, onClick }: {
  href: string; icon: React.ReactNode; label: string; active: boolean; onClick: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center rounded-lg transition-all"
      style={{
        height: 34,
        paddingLeft: 28,
        paddingRight: 12,
        gap: 10,
        fontSize: 12.5,
        fontWeight: 500,
        color: active ? T.gold : T.textNav,
        background: active ? T.activeBg : 'transparent',
      }}
      onMouseOver={e => {
        if (!active) {
          e.currentTarget.style.background = T.hoverBg
          e.currentTarget.style.color = T.textPrimary
        }
      }}
      onMouseOut={e => {
        if (!active) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = T.textNav
        }
      }}
    >
      <span style={{ opacity: active ? 1 : 0.6, color: active ? T.gold : 'inherit', display: 'flex' }}>{icon}</span>
      {label}
    </Link>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="uppercase select-none"
      style={{
        fontSize: 9,
        letterSpacing: '0.18em',
        color: T.sectionLabel,
        padding: '16px 16px 4px',
      }}
    >
      {children}
    </p>
  )
}

function Divider() {
  return <div style={{ height: 1, background: T.divider, margin: '8px 16px' }} />
}

function SoonItem({ label }: { label: string }) {
  return (
    <div
      className="flex items-center rounded-lg"
      style={{
        height: 36,
        padding: '0 12px 0 16px',
        gap: 10,
        fontSize: 13,
        fontWeight: 500,
        color: T.textNav,
        opacity: 0.5,
        cursor: 'default',
      }}
    >
      <span style={{ display: 'flex', opacity: 0.6 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
      </span>
      {label}
      <span
        className="ml-auto uppercase"
        style={{
          fontSize: 9,
          padding: '2px 6px',
          borderRadius: 99,
          background: T.soonBadgeBg,
          color: T.gold,
          letterSpacing: '0.05em',
        }}
      >
        em breve
      </span>
    </div>
  )
}

// ── Icons (16×16 unless noted) ──

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

// Graduation cap
function IcoGraduationCap() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5" />
    </svg>
  )
}
// Layout dashboard
function IcoDashboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  )
}
// Git branch
function IcoGitBranch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  )
}
// Check square
function IcoCheckSquare() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  )
}
// Trending up
function IcoTrendingUp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  )
}
// Shopping cart
function IcoShoppingCart() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  )
}
// Star
function IcoStar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}
// Bar chart 2
function IcoBarChart() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}
// Dollar sign
function IcoDollarSign() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  )
}
// Calculator
function IcoCalculator() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="8" y1="10" x2="10" y2="10" /><line x1="14" y1="10" x2="16" y2="10" /><line x1="8" y1="14" x2="10" y2="14" /><line x1="14" y1="14" x2="16" y2="14" /><line x1="8" y1="18" x2="16" y2="18" />
    </svg>
  )
}
// Store
function IcoStore() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}
// Team (users)
function IcoTeam() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
// Link
function IcoLink() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}
// Shield
function IcoShield() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}
// Logout
function IcoLogout() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}
// Platform icons
function IconSubMeta() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M12 2.04C6.5 2.04 2 6.53 2 12.06C2 17.06 5.66 21.21 10.44 21.96V14.96H7.9V12.06H10.44V9.85C10.44 7.34 11.93 5.96 14.22 5.96C15.31 5.96 16.45 6.15 16.45 6.15V8.62H15.19C13.95 8.62 13.56 9.39 13.56 10.18V12.06H16.34L15.89 14.96H13.56V21.96C18.34 21.21 22 17.06 22 12.06C22 6.53 17.5 2.04 12 2.04Z"/>
    </svg>
  )
}
function IconSubGoogle() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}
