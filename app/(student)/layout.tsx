import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/actions/auth'

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex min-h-screen bg-bg-base">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-bg-card border-r border-border flex flex-col">
        {/* Logo */}
        <div className="px-6 py-6 border-b border-border">
          <Link href="/dashboard">
            <img src="/logo.png" alt="BrandLegacy" className="h-8 w-auto" />
            <p className="text-text-muted text-xs mt-1">Área de Membros</p>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavItem href="/dashboard" icon={<IconDashboard />} label="Dashboard" />
          <NavItem href="/modulos" icon={<IconModulos />} label="Módulos" />
          <NavItem href="/masterclasses" icon={<IconMasterclass />} label="Master Classes" />
          <NavItem href="/workspace/kanban" icon={<IconKanban />} label="Gestor de Tarefas" />
          <NavItem href="/entregas" icon={<IconEntregas />} label="Controle de Entregas" />
          <NavItem href="/team" icon={<IconTeam />} label="Meu Time" />
          {profile?.role === 'admin' && (
            <div className="pt-3 mt-3 border-t border-border">
              <p className="text-text-muted text-xs font-medium px-3 mb-2 uppercase tracking-wider">Admin</p>
              <NavItem href="/admin" icon={<IconAdmin />} label="Painel Admin" />
            </div>
          )}
        </nav>

        {/* Footer do sidebar — perfil e logout */}
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
              className="
                w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                text-text-muted hover:text-error hover:bg-error/10
                transition-colors text-left
              "
            >
              <IconLogout />
              Sair
            </button>
          </form>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}

function NavItem({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="
        flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
        text-text-secondary hover:text-text-primary hover:bg-bg-hover
        transition-colors group
      "
    >
      <span className="text-text-muted group-hover:text-brand-gold transition-colors">{icon}</span>
      {label}
    </Link>
  )
}

// Ícones simples (SVG inline)
function IconDashboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  )
}

function IconModulos() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}

function IconMasterclass() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7"/>
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
    </svg>
  )
}
function IconWorkspace() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
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

function IconLogout() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function IconKanban() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="5" height="18" rx="1"/>
      <rect x="10" y="3" width="5" height="11" rx="1"/>
      <rect x="17" y="3" width="5" height="14" rx="1"/>
    </svg>
  )
}

function IconEntregas() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  )
}

function IconTeam() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}
