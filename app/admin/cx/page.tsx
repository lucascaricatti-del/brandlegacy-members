import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getWorkspacesHealth } from '@/app/actions/cx'
import CxClient from './CxClient'

export const metadata = { title: 'CX — Admin' }

export default async function CxPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const healthData = await getWorkspacesHealth()

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Customer Success</h1>
        <p className="text-sm text-text-muted mt-1">Monitore a saúde dos mentorados e identifique riscos de churn</p>
      </div>
      <CxClient initialData={healthData} />
    </div>
  )
}
