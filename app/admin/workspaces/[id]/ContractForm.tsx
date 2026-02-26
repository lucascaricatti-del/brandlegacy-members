'use client'

import { useState, useTransition } from 'react'
import { upsertContract } from '@/app/actions/contracts'
import type { ContractStatus } from '@/lib/types/database'

interface ExistingContract {
  id: string
  plan_type: string
  contract_value_brl: number
  installments: number
  start_date: string
  duration_months: number
  renewal_date: string | null
  status: ContractStatus
  total_deliveries_promised: number
  deliveries_completed: number
  notes: string | null
}

interface Props {
  workspaceId: string
  existingContract: ExistingContract | null
}

export default function ContractForm({ workspaceId, existingContract: c }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await upsertContract(workspaceId, formData, c?.id)
      if (result.error) setError(result.error)
      else setSuccess(true)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">Plano</label>
          <select
            name="plan_type"
            defaultValue={c?.plan_type ?? 'tracao'}
            className="w-full px-2.5 py-1.5 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold"
          >
            <option value="tracao">Tração</option>
            <option value="club">Club</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">Status</label>
          <select
            name="status"
            defaultValue={c?.status ?? 'active'}
            className="w-full px-2.5 py-1.5 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold"
          >
            <option value="active">Ativo</option>
            <option value="paused">Pausado</option>
            <option value="renewing">Renovando</option>
            <option value="completed">Concluído</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">Valor (R$)</label>
          <input
            name="contract_value_brl"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={c?.contract_value_brl ?? ''}
            placeholder="5000.00"
            className="w-full px-2.5 py-1.5 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">Parcelas</label>
          <input
            name="installments"
            type="number"
            min="1"
            max="24"
            defaultValue={c?.installments ?? 1}
            className="w-full px-2.5 py-1.5 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">Início</label>
          <input
            name="start_date"
            type="date"
            required
            defaultValue={c?.start_date?.slice(0, 10) ?? ''}
            className="w-full px-2.5 py-1.5 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">Duração (meses)</label>
          <input
            name="duration_months"
            type="number"
            min="1"
            max="60"
            defaultValue={c?.duration_months ?? 6}
            className="w-full px-2.5 py-1.5 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-muted mb-1">Renovação (opcional)</label>
        <input
          name="renewal_date"
          type="date"
          defaultValue={c?.renewal_date?.slice(0, 10) ?? ''}
          className="w-full px-2.5 py-1.5 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">Entregas previstas</label>
          <input
            name="total_deliveries_promised"
            type="number"
            min="0"
            defaultValue={c?.total_deliveries_promised ?? 0}
            className="w-full px-2.5 py-1.5 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">Realizadas</label>
          <input
            name="deliveries_completed"
            type="number"
            min="0"
            defaultValue={c?.deliveries_completed ?? 0}
            className="w-full px-2.5 py-1.5 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-muted mb-1">Observações</label>
        <textarea
          name="notes"
          rows={2}
          defaultValue={c?.notes ?? ''}
          placeholder="Notas internas sobre o contrato..."
          className="w-full px-2.5 py-1.5 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold resize-none"
        />
      </div>

      {error && <p className="text-error text-xs">{error}</p>}
      {success && <p className="text-success text-xs">Contrato salvo!</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-2 rounded-lg bg-brand-gold/15 text-brand-gold border border-brand-gold/30 hover:bg-brand-gold/25 text-sm font-medium transition-colors disabled:opacity-60"
      >
        {isPending ? 'Salvando...' : c ? 'Atualizar Contrato' : 'Criar Contrato'}
      </button>
    </form>
  )
}
