'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') throw new Error('Acesso negado')
  return { supabase, user }
}

// ============================================================
// ALUNOS
// ============================================================

export async function toggleStudentActive(studentId: string, isActive: boolean) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('profiles')
    .update({ is_active: !isActive })
    .eq('id', studentId)

  if (error) return { error: error.message }

  revalidatePath('/admin/alunos')
  return { success: true }
}

export async function setStudentRole(studentId: string, role: 'student' | 'admin') {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', studentId)

  if (error) return { error: error.message }

  revalidatePath('/admin/alunos')
  return { success: true }
}

// ============================================================
// MÓDULOS
// ============================================================

export async function createModule(formData: FormData) {
  const { supabase } = await requireAdmin()

  const { error, data } = await supabase
    .from('modules')
    .insert({
      title: formData.get('title') as string,
      description: (formData.get('description') as string) || null,
      order_index: Number(formData.get('order_index') ?? 0),
      is_published: formData.get('is_published') === 'true',
      content_type: (formData.get('content_type') as 'course' | 'masterclass' | 'webinar') || 'course',
      min_plan: (formData.get('min_plan') as 'free' | 'tracao' | 'club') || 'free',
      webinar_open_to_all: formData.get('webinar_open_to_all') !== 'false',
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/admin/modulos')
  return { success: true, id: data.id }
}

export async function updateModule(id: string, formData: FormData) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('modules')
    .update({
      title: formData.get('title') as string,
      description: (formData.get('description') as string) || null,
      order_index: Number(formData.get('order_index') ?? 0),
      is_published: formData.get('is_published') === 'true',
      content_type: (formData.get('content_type') as 'course' | 'masterclass' | 'webinar') || 'course',
      min_plan: (formData.get('min_plan') as 'free' | 'tracao' | 'club') || 'free',
      webinar_open_to_all: formData.get('webinar_open_to_all') !== 'false',
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/modulos')
  revalidatePath(`/admin/modulos/${id}`)
  return { success: true }
}

export async function deleteModule(id: string) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase.from('modules').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/admin/modulos')
  return { success: true }
}

export async function toggleModulePublished(id: string, current: boolean) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('modules')
    .update({ is_published: !current })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/modulos')
  return { success: true }
}

// ============================================================
// AULAS
// ============================================================

export async function createLesson(moduleId: string, formData: FormData) {
  const { supabase } = await requireAdmin()

  const { error, data } = await supabase
    .from('lessons')
    .insert({
      module_id: moduleId,
      title: formData.get('title') as string,
      description: (formData.get('description') as string) || null,
      video_url: (formData.get('video_url') as string) || null,
      video_type: (formData.get('video_type') as 'youtube' | 'panda') ?? 'youtube',
      duration_minutes: Number(formData.get('duration_minutes') ?? 0),
      order_index: Number(formData.get('order_index') ?? 0),
      is_published: formData.get('is_published') === 'true',
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/admin/modulos/${moduleId}`)
  return { success: true, id: data.id }
}

export async function updateLesson(lessonId: string, moduleId: string, formData: FormData) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('lessons')
    .update({
      title: formData.get('title') as string,
      description: (formData.get('description') as string) || null,
      video_url: (formData.get('video_url') as string) || null,
      video_type: (formData.get('video_type') as 'youtube' | 'panda') ?? 'youtube',
      duration_minutes: Number(formData.get('duration_minutes') ?? 0),
      order_index: Number(formData.get('order_index') ?? 0),
      is_published: formData.get('is_published') === 'true',
    })
    .eq('id', lessonId)

  if (error) return { error: error.message }

  revalidatePath(`/admin/modulos/${moduleId}`)
  return { success: true }
}

export async function deleteLesson(lessonId: string, moduleId: string) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase.from('lessons').delete().eq('id', lessonId)
  if (error) return { error: error.message }

  revalidatePath(`/admin/modulos/${moduleId}`)
  return { success: true }
}

export async function toggleLessonPublished(lessonId: string, moduleId: string, current: boolean) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('lessons')
    .update({ is_published: !current })
    .eq('id', lessonId)

  if (error) return { error: error.message }

  revalidatePath(`/admin/modulos/${moduleId}`)
  return { success: true }
}

// ============================================================
// MATERIAIS
// ============================================================

export async function createMaterial(formData: FormData) {
  const { supabase } = await requireAdmin()

  const file = formData.get('file') as File
  const lessonId = (formData.get('lesson_id') as string) || null
  const moduleId = (formData.get('module_id') as string) || null
  const title = formData.get('title') as string

  if (!file || file.size === 0) return { error: 'Nenhum arquivo selecionado' }

  // Upload para o Supabase Storage
  const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`
  const path = lessonId ? `lessons/${lessonId}/${fileName}` : `modules/${moduleId}/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('materials')
    .upload(path, file)

  if (uploadError) return { error: uploadError.message }

  // URL pública (signed URL de 1 ano para downloads)
  const { data: urlData } = await supabase.storage
    .from('materials')
    .createSignedUrl(path, 60 * 60 * 24 * 365)

  const fileUrl = urlData?.signedUrl ?? path

  const { error } = await supabase.from('materials').insert({
    title,
    file_url: fileUrl,
    file_size_kb: Math.round(file.size / 1024),
    lesson_id: lessonId,
    module_id: moduleId,
  })

  if (error) return { error: error.message }

  if (lessonId) revalidatePath(`/admin/modulos`)
  if (moduleId) revalidatePath(`/admin/modulos/${moduleId}`)

  return { success: true }
}

export async function deleteMaterial(materialId: string, moduleId?: string) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase.from('materials').delete().eq('id', materialId)
  if (error) return { error: error.message }

  if (moduleId) revalidatePath(`/admin/modulos/${moduleId}`)
  return { success: true }
}
