import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/actions/auth'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', cx: 'CX', financial: 'Financeiro', mentor: 'Mentor',
}

export default async function InternoLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .single()

  const internalRoles = ['admin', 'cx', 'financial', 'mentor']
  if (!profile || !internalRoles.includes(profile.role)) redirect('/dashboard')

  const role = profile.role

  return (
    <div className="flex min-h-screen bg-bg-base">
      {/* Sidebar Interno */}
      <aside className="w-60 shrink-0 bg-bg-card border-r border-border flex flex-col">
        <div className="px-6 py-6 border-b border-border">
          <Link href="/interno">
            <img src="/logo.png" alt="BrandLegacy" className="h-8 w-auto" />
            <p className="text-xs mt-1 text-brand-gold/70 font-medium">Painel Interno</p>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavItem href="/interno" icon={<IconDash />} label="Visão Geral" />
          <NavItem href="/interno/mentorados" icon={<IconMentorados />} label="Mentorados" />
          {(role === 'admin' || role === 'financial') && (
            <NavItem href="/interno/financeiro" icon={<IconFinanceiro />} label="Financeiro" />
          )}
          <div className="pt-3 mt-3 border-t border-border">
            <NavItem href="/dashboard" icon={<IconArea />} label="Área do Mentorado" />
            {role === 'admin' && (
              <NavItem href="/admin" icon={<IconAdmin />} label="Painel Admin" />
            )}
          </div>
        </nav>

        <div className="px-3 py-4 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg mb-1">
            <div className="w-8 h-8 rounded-full bg-brand-gold/20 flex items-center justify-center shrink-0">
              <span className="text-brand-gold text-sm font-semibold">
                {profile.name?.[0]?.toUpperCase() ?? 'I'}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-text-primary text-sm font-medium truncate">{profile.name}</p>
              <p className="text-text-muted text-xs">{ROLE_LABELS[role] ?? role}</p>
            </div>
          </div>
          <form action={logout}>
            <button type="submit" className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-text-muted hover:text-error hover:bg-error/10 transition-colors text-left">
              <IconLogout />
              Sair
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}

function NavItem({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors group">
      <span className="text-text-muted group-hover:text-brand-gold transition-colors">{icon}</span>
      {label}
    </Link>
  )
}

function IconDash() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
}
function IconMentorados() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}
function IconFinanceiro() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
}
function IconArea() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
}
function IconAdmin() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
}
function IconLogout() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
}
