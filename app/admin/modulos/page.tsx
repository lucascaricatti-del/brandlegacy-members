import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ModuleActions from './ModuleActions'
import CreateModuleForm from './CreateModuleForm'

export default async function AdminModulosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: modules } = await supabase
    .from('modules')
    .select('*, lessons(id, is_published)')
    .order('order_index')

  const mods = modules ?? []

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Módulos</h1>
          <p className="text-text-secondary mt-1">{mods.length} {mods.length === 1 ? 'módulo' : 'módulos'} criados</p>
        </div>
      </div>

      {/* Formulário para criar novo módulo */}
      <div className="bg-bg-card border border-border rounded-xl p-6 mb-8">
        <h2 className="font-semibold text-text-primary mb-4">Novo Módulo</h2>
        <CreateModuleForm />
      </div>

      {/* Lista de módulos */}
      {mods.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-xl p-12 text-center text-text-muted text-sm">
          Nenhum módulo criado ainda. Use o formulário acima para criar o primeiro.
        </div>
      ) : (
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs text-text-muted font-medium px-5 py-3 uppercase tracking-wider">Ordem</th>
                <th className="text-left text-xs text-text-muted font-medium px-5 py-3 uppercase tracking-wider">Título</th>
                <th className="text-left text-xs text-text-muted font-medium px-5 py-3 uppercase tracking-wider">Aulas</th>
                <th className="text-left text-xs text-text-muted font-medium px-5 py-3 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {mods.map((mod) => {
                const total = mod.lessons?.length ?? 0
                const published = mod.lessons?.filter((l) => l.is_published).length ?? 0

                return (
                  <tr key={mod.id} className="border-b border-border last:border-0 hover:bg-bg-hover transition-colors">
                    <td className="px-5 py-4 text-sm text-text-muted">{mod.order_index}</td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/admin/modulos/${mod.id}`}
                        className="font-medium text-text-primary hover:text-brand-gold transition-colors text-sm"
                      >
                        {mod.title}
                      </Link>
                      {mod.description && (
                        <p className="text-text-muted text-xs mt-0.5 line-clamp-1">{mod.description}</p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-text-muted">
                      {published}/{total}
                      <span className="text-xs ml-1 opacity-60">(pub/total)</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${mod.is_published ? 'bg-success/15 text-success' : 'bg-bg-surface text-text-muted border border-border'}`}>
                        {mod.is_published ? 'Publicado' : 'Rascunho'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/modulos/${mod.id}`}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs text-text-secondary hover:text-brand-gold hover:border-brand-gold/30 transition-colors"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                          Editar Aulas
                        </Link>
                        <ModuleActions moduleId={mod.id} isPublished={mod.is_published} />
                      </div>
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
