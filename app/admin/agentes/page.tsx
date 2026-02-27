import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AgentLogsClient from './AgentLogsClient'

export default async function AdminAgentesPage() {
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

  // Busca logs com nome do workspace
  const { data: logsRaw } = await adminSupabase
    .from('agent_logs')
    .select('*, workspaces:workspace_id(name)')
    .order('created_at', { ascending: false })
    .limit(100)

  type RawLog = {
    id: string
    workspace_id: string | null
    agent_type: string
    summary: string | null
    cards_found: number
    email_sent: boolean
    created_at: string
    workspaces: { name: string } | null
  }

  const logs = (logsRaw as unknown as RawLog[] ?? []).map((l) => ({
    id: l.id,
    workspace_name: l.workspaces?.name ?? 'N/A',
    agent_type: l.agent_type,
    summary: l.summary,
    cards_found: l.cards_found,
    email_sent: l.email_sent,
    created_at: l.created_at,
  }))

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Agentes</h1>
          <p className="text-sm text-text-muted mt-1">
            Monitoramento automático — execução diária às 9h
          </p>
        </div>
      </div>

      <AgentLogsClient logs={logs} />
    </div>
  )
}
