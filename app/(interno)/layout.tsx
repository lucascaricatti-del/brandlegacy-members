import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import InternoLayoutShell from './InternoLayoutShell'

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

  return (
    <InternoLayoutShell profile={profile as { name: string; role: string }}>
      {children}
    </InternoLayoutShell>
  )
}
