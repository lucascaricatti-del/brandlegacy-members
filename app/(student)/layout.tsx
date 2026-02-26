import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StudentLayoutShell from './StudentLayoutShell'

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
    <StudentLayoutShell profile={profile}>
      {children}
    </StudentLayoutShell>
  )
}
