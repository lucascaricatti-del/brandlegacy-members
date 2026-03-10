import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveWorkspace } from '@/lib/resolve-workspace'
import StrategicCalculator from './StrategicCalculator'

export default async function CalculadoraCenariosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ws = await resolveWorkspace(user.id)

  return <StrategicCalculator workspaceId={ws?.id ?? null} />
}
