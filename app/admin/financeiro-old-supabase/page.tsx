import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import FinanceiroClient from './FinanceiroClient'

export const metadata = { title: 'Financeiro — Admin' }

export default async function FinanceiroPage() {
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

  const { data: records } = await adminSupabase
    .from('financial_info')
    .select('*, workspaces:workspace_id(id, name, plan_type, is_active)')
    .order('created_at', { ascending: false })

  type RawRecord = {
    id: string
    workspace_id: string
    plan_name: string | null
    status: string
    total_value: number | null
    installments: number | null
    entry_value: number | null
    installment_value: number | null
    first_payment_date: string | null
    notes: string | null
    created_at: string
    workspaces: { id: string; name: string; plan_type: string; is_active: boolean } | null
  }

  const data = ((records ?? []) as unknown as RawRecord[]).map((r) => ({
    id: r.id,
    workspace_id: r.workspace_id,
    workspace_name: r.workspaces?.name ?? 'N/A',
    plan_name: r.plan_name,
    status: r.status,
    total_value: r.total_value,
    installments: r.installments,
    entry_value: r.entry_value,
    installment_value: r.installment_value,
    first_payment_date: r.first_payment_date,
    is_active: r.workspaces?.is_active ?? false,
    created_at: r.created_at,
  }))

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Financeiro</h1>
        <p className="text-sm text-text-muted mt-1">Visão geral financeira dos mentorados</p>
      </div>
      <FinanceiroClient records={data} />
    </div>
  )
}
