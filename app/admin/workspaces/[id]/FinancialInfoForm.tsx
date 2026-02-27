'use client'

import { useState, useTransition } from 'react'
import { saveFinancialInfo } from '@/app/actions/financial'
import type { FinancialInfoStatus } from '@/lib/types/database'

interface ExistingInfo {
  id: string
  plan_name: string | null
  status: string
  total_value: number | null
  installments: number | null
  entry_value: number | null
  installment_value: number | null
  first_payment_date: string | null
  start_date: string | null
  renewal_date: string | null
  notes: string | null
}

interface Props {
  workspaceId: string
  existingInfo: ExistingInfo | null
}

function formatCurrency(value: string) {
  const digits = value.replace(/\D/g, '')
  const num = parseInt(digits || '0', 10) / 100
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseCurrency(formatted: string): number {
  return parseFloat(formatted.replace(/\./g, '').replace(',', '.')) || 0
}

export default function FinancialInfoForm({ workspaceId, existingInfo: fi }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [planName, setPlanName] = useState(fi?.plan_name ?? 'tracao')
  const [status, setStatus] = useState<FinancialInfoStatus>((fi?.status as FinancialInfoStatus) ?? 'active')
  const [totalValue, setTotalValue] = useState(fi?.total_value ? formatCurrency(String(Math.round(fi.total_value * 100))) : '')
  const [installments, setInstallments] = useState(fi?.installments?.toString() ?? '1')
  const [entryValue, setEntryValue] = useState(fi?.entry_value ? formatCurrency(String(Math.round(fi.entry_value * 100))) : '')
  const [installmentValue, setInstallmentValue] = useState(fi?.installment_value ? formatCurrency(String(Math.round(fi.installment_value * 100))) : '')
  const [firstPaymentDate, setFirstPaymentDate] = useState(fi?.first_payment_date?.slice(0, 10) ?? '')
  const [startDate, setStartDate] = useState(fi?.start_date?.slice(0, 10) ?? '')
  const [renewalDate, setRenewalDate] = useState(fi?.renewal_date?.slice(0, 10) ?? '')
  const [notes, setNotes] = useState(fi?.notes ?? '')

  // Auto-calculate installment value
  function handleTotalOrInstallmentsChange(newTotal: string, newInstallments: string, newEntry: string) {
    setTotalValue(newTotal)
    setInstallments(newInstallments)
    setEntryValue(newEntry)

    const total = parseCurrency(newTotal)
    const entry = parseCurrency(newEntry)
    const parcelas = parseInt(newInstallments, 10) || 1

    if (total > 0 && parcelas > 0) {
      const remaining = total - entry
      const perInstallment = remaining > 0 ? remaining / parcelas : 0
      setInstallmentValue(formatCurrency(String(Math.round(perInstallment * 100))))
    }
  }

  function handleCurrencyInput(setter: (v: string) => void, value: string, field: 'total' | 'entry') {
    const formatted = formatCurrency(value)
    setter(formatted)

    if (field === 'total') {
      handleTotalOrInstallmentsChange(formatted, installments, entryValue)
    } else if (field === 'entry') {
      handleTotalOrInstallmentsChange(totalValue, installments, formatted)
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    startTransition(async () => {
      const result = await saveFinancialInfo(workspaceId, {
        plan_name: planName,
        status,
        total_value: parseCurrency(totalValue) || null,
        installments: parseInt(installments, 10) || null,
        entry_value: parseCurrency(entryValue) || null,
        installment_value: parseCurrency(installmentValue) || null,
        first_payment_date: firstPaymentDate || null,
        start_date: startDate || null,
        renewal_date: renewalDate || null,
        notes: notes || null,
      })
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
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold"
          >
            <option value="tracao">Tração</option>
            <option value="club">Club</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as FinancialInfoStatus)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold"
          >
            <option value="active">Ativo</option>
            <option value="inadimplente">Inadimplente</option>
            <option value="cancelled">Cancelado</option>
            <option value="completed">Concluído</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-muted mb-1">Valor Total (R$)</label>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-sm">R$</span>
          <input
            type="text"
            inputMode="numeric"
            value={totalValue}
            onChange={(e) => handleCurrencyInput(setTotalValue, e.target.value, 'total')}
            placeholder="0,00"
            className="w-full pl-9 pr-2.5 py-1.5 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-muted mb-1">Entrada (R$)</label>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-sm">R$</span>
          <input
            type="text"
            inputMode="numeric"
            value={entryValue}
            onChange={(e) => handleCurrencyInput(setEntryValue, e.target.value, 'entry')}
            placeholder="0,00"
            className="w-full pl-9 pr-2.5 py-1.5 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">Parcelas</label>
          <input
            type="number"
            min="1"
            max="24"
            value={installments}
            onChange={(e) => handleTotalOrInstallmentsChange(totalValue, e.target.value, entryValue)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">Valor parcela</label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-sm">R$</span>
            <input
              type="text"
              value={installmentValue}
              readOnly
              className="w-full pl-9 pr-2.5 py-1.5 rounded-lg bg-bg-surface/50 border border-border text-text-muted text-sm cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-muted mb-1">Data 1° pagamento</label>
        <input
          type="date"
          value={firstPaymentDate}
          onChange={(e) => setFirstPaymentDate(e.target.value)}
          className="w-full px-2.5 py-1.5 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">Data de início</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">Data de renovação</label>
          <input
            type="date"
            value={renewalDate}
            onChange={(e) => setRenewalDate(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-muted mb-1">Observações</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Notas internas..."
          className="w-full px-2.5 py-1.5 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold resize-none"
        />
      </div>

      {error && <p className="text-error text-xs">{error}</p>}
      {success && <p className="text-success text-xs">Informações financeiras salvas!</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-2 rounded-lg bg-brand-gold/15 text-brand-gold border border-brand-gold/30 hover:bg-brand-gold/25 text-sm font-medium transition-colors disabled:opacity-60"
      >
        {isPending ? 'Salvando...' : fi ? 'Atualizar' : 'Salvar'}
      </button>
    </form>
  )
}
