'use client'

import { useState, useTransition } from 'react'
import {
  updateDelivery,
  addDeliveryMaterial,
  deleteDeliveryMaterial,
  initWorkspaceDeliveries,
} from '@/app/actions/deliveries'

type Material = {
  id: string
  title: string
  type: 'video' | 'material'
  url: string | null
  file_url: string | null
}

type Delivery = {
  id: string
  title: string
  order_index: number
  status: 'pending' | 'scheduled' | 'completed'
  scheduled_date: string | null
  completed_date: string | null
  notes: string | null
  link_call: string | null
  delivery_materials: Material[]
}

type Props = {
  workspaceId: string
  planType: 'free' | 'tracao' | 'club'
  contractId: string | null
  deliveries: Delivery[]
}

const STATUS_LABELS = { pending: 'Pendente', scheduled: 'Agendada', completed: 'Concluída' }
const STATUS_COLORS = {
  pending:   'bg-bg-surface text-text-muted border border-border',
  scheduled: 'bg-brand-gold/15 text-brand-gold border border-brand-gold/30',
  completed: 'bg-success/15 text-success border border-success/30',
}

export default function DeliveryManager({ workspaceId, planType, contractId, deliveries }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [initError, setInitError] = useState<string | null>(null)

  async function handleInit() {
    if (planType === 'free') return
    setInitError(null)
    startTransition(async () => {
      const res = await initWorkspaceDeliveries(workspaceId, planType as 'tracao' | 'club', contractId)
      if (res?.error) setInitError(res.error)
    })
  }

  if (deliveries.length === 0) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-12 text-center">
        <div className="text-4xl mb-4">📋</div>
        <p className="text-text-primary font-medium mb-1">Nenhuma entrega cadastrada</p>
        <p className="text-text-muted text-sm mb-6">
          {planType === 'free'
            ? 'Workspaces Free não têm entregas de mentoria.'
            : `Clique para criar as ${planType === 'club' ? '6' : '3'} entregas padrão do plano ${planType === 'club' ? 'Club' : 'Tração'}.`}
        </p>
        {planType !== 'free' && (
          <>
            <button
              onClick={handleInit}
              disabled={isPending}
              className="px-5 py-2.5 rounded-lg bg-brand-gold text-bg-base text-sm font-medium hover:bg-brand-gold-light transition-colors disabled:opacity-60"
            >
              {isPending ? 'Criando...' : `Inicializar entregas (${planType === 'club' ? '6' : '3'})`}
            </button>
            {initError && <p className="text-error text-sm mt-3">{initError}</p>}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {deliveries.map((delivery) => (
        <DeliveryCard
          key={delivery.id}
          delivery={delivery}
          workspaceId={workspaceId}
          isOpen={openId === delivery.id}
          onToggle={() => setOpenId(openId === delivery.id ? null : delivery.id)}
        />
      ))}
    </div>
  )
}

function DeliveryCard({
  delivery,
  workspaceId,
  isOpen,
  onToggle,
}: {
  delivery: Delivery
  workspaceId: string
  isOpen: boolean
  onToggle: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Form state
  const [status, setStatus] = useState(delivery.status)
  const [scheduledDate, setScheduledDate] = useState(delivery.scheduled_date ?? '')
  const [completedDate, setCompletedDate] = useState(delivery.completed_date ?? '')
  const [notes, setNotes] = useState(delivery.notes ?? '')
  const [linkCall, setLinkCall] = useState(delivery.link_call ?? '')

  async function handleSave() {
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      const res = await updateDelivery(delivery.id, workspaceId, {
        status,
        scheduled_date: scheduledDate || null,
        completed_date: completedDate || null,
        notes: notes || null,
        link_call: linkCall || null,
      })
      if (res?.error) setError(res.error)
      else setSuccess(true)
    })
  }

  return (
    <div className={`bg-bg-card border rounded-xl transition-colors ${isOpen ? 'border-brand-gold/40' : 'border-border'}`}>
      {/* Header */}
      <button
        className="w-full flex items-center justify-between gap-4 p-5 text-left"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-full bg-bg-surface border border-border flex items-center justify-center text-xs font-bold text-text-muted shrink-0">
            {delivery.order_index}
          </span>
          <div>
            <h3 className="font-semibold text-text-primary">{delivery.title}</h3>
            <p className="text-xs text-text-muted mt-0.5">
              {delivery.delivery_materials.length} material{delivery.delivery_materials.length !== 1 ? 'is' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[delivery.status]}`}>
            {STATUS_LABELS[delivery.status]}
          </span>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </button>

      {/* Painel de edição */}
      {isOpen && (
        <div className="border-t border-border p-5 space-y-6">
          {/* Status + Datas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Delivery['status'])}
                className="w-full px-3 py-2 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold"
              >
                <option value="pending">Pendente</option>
                <option value="scheduled">Agendada</option>
                <option value="completed">Concluída</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Data de agendamento</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Data de conclusão</label>
              <input
                type="date"
                value={completedDate}
                onChange={(e) => setCompletedDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold"
              />
            </div>
          </div>

          {/* Link da call */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Link da call</label>
            <input
              type="url"
              value={linkCall}
              onChange={(e) => setLinkCall(e.target.value)}
              placeholder="https://meet.google.com/... ou https://zoom.us/..."
              className="w-full px-3 py-2 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold placeholder:text-text-muted"
            />
            <p className="text-xs text-text-muted mt-1">Visível para o mentorado na Agenda e Controle de Entregas.</p>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Observações</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Notas visíveis para o mentorado..."
              className="w-full px-3 py-2 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold resize-none placeholder:text-text-muted"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="px-4 py-2 rounded-lg bg-brand-gold text-bg-base text-sm font-medium hover:bg-brand-gold-light transition-colors disabled:opacity-60"
            >
              {isPending ? 'Salvando...' : 'Salvar alterações'}
            </button>
            {success && <span className="text-success text-sm">Salvo!</span>}
            {error && <span className="text-error text-sm">{error}</span>}
          </div>

          {/* Materiais */}
          <MaterialsSection
            delivery={delivery}
            workspaceId={workspaceId}
          />
        </div>
      )}
    </div>
  )
}

function MaterialsSection({ delivery, workspaceId }: { delivery: Delivery; workspaceId: string }) {
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<'video' | 'material'>('video')
  const [url, setUrl] = useState('')
  const [fileUrl, setFileUrl] = useState('')

  async function handleAdd() {
    setFormError(null)
    startTransition(async () => {
      const res = await addDeliveryMaterial(
        delivery.id, workspaceId, title, type,
        url || null, fileUrl || null,
      )
      if (res?.error) {
        setFormError(res.error)
      } else {
        setTitle('')
        setUrl('')
        setFileUrl('')
        setShowForm(false)
      }
    })
  }

  async function handleDelete(materialId: string) {
    startTransition(async () => {
      await deleteDeliveryMaterial(materialId, workspaceId)
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-text-primary">Materiais e Vídeos</h4>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="text-xs text-brand-gold hover:text-brand-gold-light transition-colors flex items-center gap-1"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {showForm ? 'Cancelar' : 'Adicionar'}
        </button>
      </div>

      {/* Lista de materiais */}
      {delivery.delivery_materials.length === 0 && !showForm && (
        <p className="text-text-muted text-xs py-2">Nenhum material vinculado ainda.</p>
      )}

      <div className="space-y-2 mb-3">
        {delivery.delivery_materials.map((mat) => (
          <div key={mat.id} className="flex items-center gap-3 px-3 py-2.5 bg-bg-surface rounded-lg border border-border">
            <span className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 ${mat.type === 'video' ? 'bg-error/15 text-error' : 'bg-brand-gold/15 text-brand-gold'}`}>
              {mat.type === 'video' ? 'Vídeo' : 'Material'}
            </span>
            <span className="flex-1 text-sm text-text-primary truncate">{mat.title}</span>
            <button
              onClick={() => handleDelete(mat.id)}
              disabled={isPending}
              className="text-text-muted hover:text-error transition-colors shrink-0"
              title="Remover"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4h6v2"/>
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Formulário de adição */}
      {showForm && (
        <div className="bg-bg-surface border border-border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Título</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Gravação da Mentoria 1"
                className="w-full px-3 py-2 rounded-lg bg-bg-card border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold placeholder:text-text-muted"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Tipo</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'video' | 'material')}
                className="w-full px-3 py-2 rounded-lg bg-bg-card border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold"
              >
                <option value="video">Vídeo (YouTube / Panda)</option>
                <option value="material">Material (PDF / Link)</option>
              </select>
            </div>
          </div>

          {type === 'video' && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">URL do vídeo</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... ou Panda"
                className="w-full px-3 py-2 rounded-lg bg-bg-card border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold placeholder:text-text-muted"
              />
            </div>
          )}

          {type === 'material' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Link externo</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-lg bg-bg-card border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold placeholder:text-text-muted"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">URL do arquivo (PDF)</label>
                <input
                  type="url"
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  placeholder="https://... (direto para download)"
                  className="w-full px-3 py-2 rounded-lg bg-bg-card border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold placeholder:text-text-muted"
                />
              </div>
            </div>
          )}

          {formError && <p className="text-error text-xs">{formError}</p>}

          <button
            onClick={handleAdd}
            disabled={isPending || !title.trim()}
            className="px-4 py-2 rounded-lg bg-brand-gold text-bg-base text-sm font-medium hover:bg-brand-gold-light transition-colors disabled:opacity-60"
          >
            {isPending ? 'Adicionando...' : 'Adicionar material'}
          </button>
        </div>
      )}
    </div>
  )
}
