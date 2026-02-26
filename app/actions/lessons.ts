'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function toggleLessonComplete(lessonId: string, completed: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Não autenticado' }

  if (completed) {
    // Remover progresso (desmarcar como concluído)
    const { error } = await supabase
      .from('lesson_progress')
      .delete()
      .eq('user_id', user.id)
      .eq('lesson_id', lessonId)

    if (error) return { error: error.message }
  } else {
    // Inserir progresso (marcar como concluído)
    const { error } = await supabase
      .from('lesson_progress')
      .insert({ user_id: user.id, lesson_id: lessonId })

    if (error && !error.message.includes('duplicate')) {
      return { error: error.message }
    }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}
