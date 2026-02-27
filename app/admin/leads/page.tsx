import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LeadsClient from './LeadsClient'

export default async function LeadsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const adminSupabase = createAdminClient()

  const { data: leads } = await adminSupabase
    .from('leads')
    .select('id, name, email, phone, module_id, utm_source, utm_campaign, created_at, modules(title)')
    .order('created_at', { ascending: false })

  const { data: modules } = await adminSupabase
    .from('modules')
    .select('id, title')
    .eq('category', 'free_class')
    .eq('is_published', true)
    .order('title')

  return (
    <LeadsClient
      leads={(leads ?? []).map((l) => ({
        ...l,
        module_title: (l.modules as { title: string } | null)?.title ?? null,
      }))}
      modules={modules ?? []}
    />
  )
}
