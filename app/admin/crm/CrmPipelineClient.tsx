'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import { getLeads, getLeadStats, updateLeadStatus, assignLead, addNote, getNotes } from '@/app/actions/crm'

type Lead = {
  id: string
  name: string
  email: string
  whatsapp: string | null
  revenue_range: string | null
  business_segment: string | null
  status: string
  assigned_to: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  created_at: string
  profiles: { name: string } | null
}

type Funnel = { id: string; name: string; slug: string; product: string }
type Admin = { id: string; name: string; email: string }
type Stats = {
  total: number
  novos_hoje: number
  por_status: Record<string, number>
  conversao: number
}

type Note = {
  id: string
  content: string
  contact_type: string
  created_at: string
  profiles: { name: string } | null
}

const STATUSES = ['novo', 'contatado', 'qualificado', 'fechado', 'perdido'] as const
const STATUS_LABELS: Record<string, string> = {
  novo: 'Novo',
  contatado: 'Contatado',
  qualificado: 'Qualificado',
  fechado: 'Fechado',
  perdido: 'Perdido',
}
const STATUS_COLORS: Record<string, string> = {
  novo: 'bg-blue-400/15 text-blue-400',
  contatado: 'bg-yellow-400/15 text-yellow-400',
  qualificado: 'bg-purple-400/15 text-purple-400',
  fechado: 'bg-green-400/15 text-green-400',
  perdido: 'bg-red-400/15 text-red-400',
}
const CONTACT_TYPES = [
  { value: 'ligacao', label: 'Ligação' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'nota', label: 'Nota' },
]

interface Props {
  funnels: Funnel[]
  admins: Admin[]
  initialLeads: Array<Record<string, unknown>>
  initialStats: Stats
  defaultFunnelId: string | null
}

export default function CrmPipelineClient({ funnels, admins, initialLeads, initialStats, defaultFunnelId }: Props) {
  const [funnelId, setFunnelId] = useState(defaultFunnelId ?? '')
  const [leads, setLeads] = useState<Lead[]>(initialLeads as unknown as Lead[])
  const [stats, setStats] = useState<Stats>(initialStats)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [activeTab, setActiveTab] = useState<string>('all')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [isPending, startTransition] = useTransition()

  const refreshData = useCallback((funnel: string) => {
    startTransition(async () => {
      const [leadsRes, newStats] = await Promise.all([
        getLeads(funnel, { status: statusFilter !== 'all' ? statusFilter : undefined, search: search || undefined }),
        getLeadStats(funnel),
      ])
      setLeads((leadsRes.data ?? []) as unknown as Lead[])
      setStats(newStats)
    })
  }, [statusFilter, search])

  useEffect(() => {
    if (funnelId) refreshData(funnelId)
  }, [funnelId, statusFilter, refreshData])

  function handleSearch() {
    if (funnelId) refreshData(funnelId)
  }

  const displayedLeads = activeTab === 'all'
    ? leads
    : leads.filter((l) => l.status === activeTab)

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-text-primary">CRM Comercial</h1>
        <div className="flex flex-wrap gap-3">
          <select
            value={funnelId}
            onChange={(e) => setFunnelId(e.target.value)}
            className="px-3 py-2 rounded-lg bg-bg-surface border border-border text-text-primary text-sm"
          >
            {funnels.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Buscar nome/email..."
              className="px-3 py-2 rounded-lg bg-bg-surface border border-border text-text-primary placeholder:text-text-muted text-sm w-48"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-bg-surface border border-border text-text-primary text-sm"
            >
              <option value="all">Todos os status</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total de Leads" value={stats.total} />
        <StatCard label="Novos Hoje" value={stats.novos_hoje} />
        <StatCard label="Taxa de Conversão" value={`${stats.conversao}%`} />
        <div className="rounded-xl bg-bg-card border border-border p-4">
          <p className="text-text-muted text-xs mb-2">Por Status</p>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => (
              <span key={s} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s]}`}>
                {STATUS_LABELS[s]}: {stats.por_status[s] ?? 0}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        <TabButton label="Todos" value="all" active={activeTab} onClick={setActiveTab} count={leads.length} />
        {STATUSES.map((s) => (
          <TabButton key={s} label={STATUS_LABELS[s]} value={s} active={activeTab} onClick={setActiveTab} count={leads.filter((l) => l.status === s).length} />
        ))}
      </div>

      {/* Lead cards */}
      {isPending ? (
        <div className="text-center py-12 text-text-muted text-sm">Carregando...</div>
      ) : displayedLeads.length === 0 ? (
        <div className="text-center py-12 text-text-muted text-sm">Nenhum lead encontrado.</div>
      ) : (
        <div className="space-y-2">
          {displayedLeads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              admins={admins}
              onClick={() => setSelectedLead(lead)}
              onStatusChange={(newStatus) => {
                startTransition(async () => {
                  await updateLeadStatus(lead.id, newStatus)
                  refreshData(funnelId)
                })
              }}
              onAssign={(profileId) => {
                startTransition(async () => {
                  await assignLead(lead.id, profileId || null)
                  refreshData(funnelId)
                })
              }}
            />
          ))}
        </div>
      )}

      {/* Lead Modal */}
      {selectedLead && (
        <LeadModal
          lead={selectedLead}
          admins={admins}
          onClose={() => setSelectedLead(null)}
          onRefresh={() => refreshData(funnelId)}
        />
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-bg-card border border-border p-4">
      <p className="text-text-muted text-xs mb-1">{label}</p>
      <p className="text-xl font-bold text-text-primary">{value}</p>
    </div>
  )
}

function TabButton({ label, value, active, onClick, count }: {
  label: string; value: string; active: string; onClick: (v: string) => void; count: number
}) {
  const isActive = active === value
  return (
    <button
      onClick={() => onClick(value)}
      className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        isActive ? 'bg-brand-gold text-bg-base' : 'bg-bg-card border border-border text-text-muted hover:text-text-primary'
      }`}
    >
      {label} ({count})
    </button>
  )
}

function LeadCard({ lead, admins, onClick, onStatusChange, onAssign }: {
  lead: Lead
  admins: Admin[]
  onClick: () => void
  onStatusChange: (status: string) => void
  onAssign: (profileId: string) => void
}) {
  return (
    <div
      onClick={onClick}
      className="rounded-xl bg-bg-card border border-border p-4 hover:border-brand-gold/30 transition-colors cursor-pointer"
    >
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-text-primary truncate">{lead.name}</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[lead.status] ?? STATUS_COLORS.novo}`}>
              {STATUS_LABELS[lead.status] ?? lead.status}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
            <span>{lead.email}</span>
            {lead.whatsapp && (
              <a
                href={`https://wa.me/55${lead.whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-green-400 hover:underline"
              >
                {lead.whatsapp}
              </a>
            )}
            {lead.revenue_range && <span>{lead.revenue_range}</span>}
            {lead.business_segment && <span>{lead.business_segment}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <select
            value={lead.status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-bg-surface border border-border text-text-primary text-xs"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <select
            value={lead.assigned_to ?? ''}
            onChange={(e) => onAssign(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-bg-surface border border-border text-text-primary text-xs"
          >
            <option value="">Sem vendedor</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <span className="text-[10px] text-text-muted whitespace-nowrap">
            {new Date(lead.created_at).toLocaleDateString('pt-BR')}
          </span>
        </div>
      </div>
    </div>
  )
}

function LeadModal({ lead, admins, onClose, onRefresh }: {
  lead: Lead
  admins: Admin[]
  onClose: () => void
  onRefresh: () => void
}) {
  const [notes, setNotes] = useState<Note[]>([])
  const [noteContent, setNoteContent] = useState('')
  const [noteType, setNoteType] = useState('nota')
  const [status, setStatus] = useState(lead.status)
  const [assignedTo, setAssignedTo] = useState(lead.assigned_to ?? '')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      const res = await getNotes(lead.id)
      setNotes((res.data ?? []) as unknown as Note[])
    })
  }, [lead.id])

  function handleStatusChange(newStatus: string) {
    setStatus(newStatus)
    startTransition(async () => {
      await updateLeadStatus(lead.id, newStatus)
      onRefresh()
    })
  }

  function handleAssign(profileId: string) {
    setAssignedTo(profileId)
    startTransition(async () => {
      await assignLead(lead.id, profileId || null)
      onRefresh()
    })
  }

  function handleAddNote() {
    if (!noteContent.trim()) return
    startTransition(async () => {
      await addNote(lead.id, noteContent.trim(), noteType)
      setNoteContent('')
      const res = await getNotes(lead.id)
      setNotes((res.data ?? []) as unknown as Note[])
      onRefresh()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-bg-card border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-text-primary">{lead.name}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Lead info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoItem label="Email" value={lead.email} />
            <InfoItem label="WhatsApp" value={lead.whatsapp ?? '—'} isWhatsApp={!!lead.whatsapp} phone={lead.whatsapp} />
            <InfoItem label="Faturamento" value={lead.revenue_range ?? '—'} />
            <InfoItem label="Segmento" value={lead.business_segment ?? '—'} />
            {lead.utm_source && <InfoItem label="UTM Source" value={lead.utm_source} />}
            {lead.utm_campaign && <InfoItem label="UTM Campaign" value={lead.utm_campaign} />}
          </div>

          {/* Status + Assignment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">Status</label>
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-bg-surface border border-border text-text-primary text-sm"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">Vendedor</label>
              <select
                value={assignedTo}
                onChange={(e) => handleAssign(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-bg-surface border border-border text-text-primary text-sm"
              >
                <option value="">Sem vendedor</option>
                {admins.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes section */}
          <div>
            <h3 className="text-sm font-bold text-text-primary mb-3">Histórico / Notas</h3>

            {/* Add note */}
            <div className="flex gap-2 mb-4">
              <select
                value={noteType}
                onChange={(e) => setNoteType(e.target.value)}
                className="px-2 py-2 rounded-lg bg-bg-surface border border-border text-text-primary text-xs shrink-0"
              >
                {CONTACT_TYPES.map((ct) => (
                  <option key={ct.value} value={ct.value}>{ct.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                placeholder="Adicionar nota..."
                className="flex-1 px-3 py-2 rounded-lg bg-bg-surface border border-border text-text-primary placeholder:text-text-muted text-sm"
              />
              <button
                onClick={handleAddNote}
                disabled={isPending || !noteContent.trim()}
                className="px-4 py-2 rounded-lg bg-brand-gold hover:bg-brand-gold-light text-bg-base text-xs font-medium transition-colors disabled:opacity-60"
              >
                Salvar
              </button>
            </div>

            {/* Notes list */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {notes.length === 0 ? (
                <p className="text-text-muted text-xs py-4 text-center">Nenhuma nota registrada.</p>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className="rounded-lg bg-bg-surface border border-border p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-card text-text-muted font-medium">
                        {CONTACT_TYPES.find((ct) => ct.value === note.contact_type)?.label ?? note.contact_type}
                      </span>
                      <span className="text-[10px] text-text-muted">
                        {note.profiles?.name ?? 'Sistema'} — {new Date(note.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-text-secondary text-sm">{note.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoItem({ label, value, isWhatsApp, phone }: { label: string; value: string; isWhatsApp?: boolean; phone?: string | null }) {
  return (
    <div>
      <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">{label}</p>
      {isWhatsApp && phone ? (
        <a
          href={`https://wa.me/55${phone.replace(/\D/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-green-400 hover:underline"
        >
          {value}
        </a>
      ) : (
        <p className="text-sm text-text-primary">{value}</p>
      )}
    </div>
  )
}
