import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AcademyClient from './AcademyClient'

const PLAN_RANK: Record<string, number> = { free: 0, tracao: 1, club: 2 }

export default async function AcademyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = createAdminClient()

  // Busca plano do workspace ativo
  type WsMembership = { workspaces: { plan_type: string } | null }
  const { data: wsMembership } = await adminSupabase
    .from('workspace_members')
    .select('workspaces(plan_type)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .single()

  const userPlan = (wsMembership as unknown as WsMembership)?.workspaces?.plan_type ?? 'free'
  const userRank = PLAN_RANK[userPlan] ?? 0
  const hasActivePlan = userRank > 0

  // Busca todos os módulos publicados com lessons
  const [modulesRes, progressRes] = await Promise.all([
    adminSupabase
      .from('modules')
      .select('id, title, description, thumbnail_url, content_type, category, min_plan, order_index, lessons(id, duration_minutes)')
      .eq('is_published', true)
      .order('order_index'),
    supabase
      .from('lesson_progress')
      .select('lesson_id')
      .eq('user_id', user.id),
  ])

  const allModules = modulesRes.data ?? []
  const completedIds = new Set((progressRes.data ?? []).map((p) => p.lesson_id))

  // Categorizar módulos (defensive: se category=null, deduz do content_type)
  function resolveCategory(m: { category: string | null; content_type: string }) {
    if (m.category) return m.category
    if (m.content_type === 'masterclass') return 'masterclass'
    return 'mentoria'
  }

  const mentoriaModules = allModules.filter((m) => resolveCategory(m) === 'mentoria')
  const masterclassModules = allModules.filter((m) => resolveCategory(m) === 'masterclass')
  const freeClassModules = allModules.filter((m) => resolveCategory(m) === 'free_class')

  // Enriquecer com progresso e acesso
  function enrichModule(mod: typeof allModules[number]) {
    const lessons = mod.lessons ?? []
    const totalLessons = lessons.length
    const completedLessons = lessons.filter((l: { id: string }) => completedIds.has(l.id)).length
    const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0
    const totalDuration = lessons.reduce((sum: number, l: { duration_minutes: number }) => sum + (l.duration_minutes ?? 0), 0)
    const modRank = PLAN_RANK[mod.min_plan] ?? 0
    const hasAccess = modRank <= userRank

    return {
      id: mod.id,
      title: mod.title,
      description: mod.description,
      thumbnail_url: mod.thumbnail_url,
      category: resolveCategory(mod),
      min_plan: mod.min_plan,
      total_lessons: totalLessons,
      completed_lessons: completedLessons,
      progress,
      total_duration: totalDuration,
      has_access: hasAccess,
    }
  }

  const enrichedMentoria = mentoriaModules.map(enrichModule)
  const enrichedMasterclass = masterclassModules.map(enrichModule)
  const enrichedFreeClass = freeClassModules.map(enrichModule)

  // Continue assistindo: módulos com progresso > 0 e < 100
  const continueWatching = [...enrichedMentoria, ...enrichedMasterclass]
    .filter((m) => m.progress > 0 && m.progress < 100)
    .slice(0, 4)

  // Stats
  const totalLessons = allModules.reduce((sum, m) => sum + (m.lessons?.length ?? 0), 0)
  const totalMasterclasses = masterclassModules.length
  const totalModules = allModules.length

  return (
    <AcademyClient
      mentoria={enrichedMentoria}
      masterclass={enrichedMasterclass}
      freeClass={enrichedFreeClass}
      continueWatching={continueWatching}
      hasActivePlan={hasActivePlan}
      stats={{ totalLessons, totalMasterclasses, totalModules }}
    />
  )
}
