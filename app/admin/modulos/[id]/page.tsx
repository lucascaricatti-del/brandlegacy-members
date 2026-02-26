import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EditModuleForm from './EditModuleForm'
import CreateLessonForm from './CreateLessonForm'
import LessonActions from './LessonActions'
import UploadMaterialForm from './UploadMaterialForm'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AdminModulePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: mod } = await supabase
    .from('modules')
    .select('*, lessons(*, materials(*)), materials(*)')
    .eq('id', id)
    .order('order_index', { referencedTable: 'lessons' })
    .single()

  if (!mod) notFound()

  const lessons = mod.lessons ?? []
  const moduleMaterials = mod.materials ?? []

  return (
    <div className="animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-text-muted mb-6">
        <Link href="/admin/modulos" className="hover:text-text-primary transition-colors">Módulos</Link>
        <span>/</span>
        <span className="text-text-secondary">{mod.title}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna esquerda: edição do módulo */}
        <div className="space-y-6">
          <div className="bg-bg-card border border-border rounded-xl p-6">
            <h2 className="font-semibold text-text-primary mb-4">Editar Módulo</h2>
            <EditModuleForm module={mod} />
          </div>

          {/* Materiais do módulo */}
          <div className="bg-bg-card border border-border rounded-xl p-6">
            <h2 className="font-semibold text-text-primary mb-4">Materiais do Módulo</h2>
            <UploadMaterialForm moduleId={mod.id} />
            {moduleMaterials.length > 0 && (
              <div className="mt-4 space-y-2">
                {moduleMaterials.map((mat) => (
                  <div key={mat.id} className="flex items-center gap-2 p-2 rounded-lg bg-bg-surface border border-border">
                    <span className="flex-1 text-xs text-text-secondary truncate">{mat.title}</span>
                    <a href={mat.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-gold hover:underline shrink-0">Ver</a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Coluna direita: aulas */}
        <div className="lg:col-span-2 space-y-6">
          {/* Criar nova aula */}
          <div className="bg-bg-card border border-border rounded-xl p-6">
            <h2 className="font-semibold text-text-primary mb-4">Nova Aula</h2>
            <CreateLessonForm moduleId={mod.id} currentLessonsCount={lessons.length} />
          </div>

          {/* Lista de aulas */}
          <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-text-primary">Aulas ({lessons.length})</h2>
            </div>
            {lessons.length === 0 ? (
              <div className="p-10 text-center text-text-muted text-sm">
                Nenhuma aula criada ainda.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {lessons.map((lesson, index) => (
                  <div key={lesson.id} className="px-5 py-4 hover:bg-bg-hover transition-colors">
                    <div className="flex items-start gap-3">
                      <span className="text-text-muted text-sm font-mono mt-0.5 shrink-0 w-6">{index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-text-primary text-sm">{lesson.title}</p>
                            <div className="flex items-center gap-3 mt-1">
                              {lesson.video_type && (
                                <span className="text-xs text-text-muted capitalize">{lesson.video_type}</span>
                              )}
                              {lesson.duration_minutes > 0 && (
                                <span className="text-xs text-text-muted">{lesson.duration_minutes} min</span>
                              )}
                              <span className={`text-xs px-2 py-0.5 rounded-full ${lesson.is_published ? 'bg-success/15 text-success' : 'bg-bg-surface text-text-muted border border-border'}`}>
                                {lesson.is_published ? 'Publicada' : 'Rascunho'}
                              </span>
                            </div>
                          </div>
                          <LessonActions
                            lessonId={lesson.id}
                            moduleId={mod.id}
                            isPublished={lesson.is_published}
                          />
                        </div>

                        {/* Materiais da aula */}
                        <div className="mt-3">
                          <UploadMaterialForm lessonId={lesson.id} moduleId={mod.id} compact />
                          {lesson.materials && lesson.materials.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {lesson.materials.map((mat) => (
                                <div key={mat.id} className="flex items-center gap-2 text-xs text-text-muted">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                  <a href={mat.file_url} target="_blank" rel="noopener noreferrer" className="hover:text-brand-gold transition-colors truncate">
                                    {mat.title}
                                  </a>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
