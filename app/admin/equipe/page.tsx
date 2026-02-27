import { createAdminClient } from '@/lib/supabase/admin'
import EquipeClient from './EquipeClient'

export default async function EquipePage() {
  const adminSupabase = createAdminClient()

  const { data: admins } = await adminSupabase
    .from('profiles')
    .select('id, name, email, avatar_url, admin_role')
    .eq('role', 'admin')
    .order('name')

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Equipe</h1>
        <p className="text-text-secondary mt-1">Gerencie os níveis de acesso da equipe administrativa.</p>
      </div>

      <EquipeClient admins={admins ?? []} />
    </div>
  )
}
