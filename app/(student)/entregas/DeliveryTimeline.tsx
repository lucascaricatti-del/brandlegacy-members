'use client'

import { useState } from 'react'

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

function getEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v')
      return v ? `https://www.youtube.com/embed/${v}` : null
    }
    if (u.hostname === 'youtu.be') {
      const v = u.pathname.slice(1)
      return v ? `https://www.youtube.com/embed/${v}` : null
    }
    if (u.hostname.includes('pandavideo')) {
      return url
    }
    return null
  } catch {
    return null
  }
}

function formatDate(date: string) {
  return new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

const STATUS_CONFIG = {
  pending: {
    label: 'Pendente',
    dotClass: 'bg-text-muted border-2 border-border-light',
    badgeClass: 'bg-bg-surface text-text-muted border border-border',
  },
  scheduled: {
    label: 'Agendada',
    dotClass: 'bg-brand-gold border-2 border-brand-gold',
    badgeClass: 'bg-brand-gold/15 text-brand-gold border border-brand-gold/30',
  },
  completed: {
    label: 'Concluída',
    dotClass: 'bg-success border-2 border-success',
    badgeClass: 'bg-success/15 text-success border border-success/30',
  },
}

export default function DeliveryTimeline({ deliveries }: { deliveries: Delivery[] }) {
  const [openId, setOpenId] = useState<string | null>(null)

  if (deliveries.length === 0) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-16 text-center">
        <div className="text-4xl mb-4">📋</div>
        <p className="text-text-muted">Nenhuma entrega cadastrada ainda.</p>
        <p className="text-text-muted text-sm mt-1">Entre em contato com seu mentor para mais informações.</p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Linha vertical da timeline */}
      <div className="absolute left-[19px] top-6 bottom-6 w-0.5 bg-border" />

      <div className="space-y-4">
        {deliveries.map((delivery, idx) => {
          const cfg = STATUS_CONFIG[delivery.status]
          const isOpen = openId === delivery.id
          const hasMaterials = delivery.delivery_materials.length > 0
          const isLast = idx === deliveries.length - 1

          return (
            <div key={delivery.id} className="relative pl-12">
              {/* Dot da timeline */}
              <div className={`absolute left-0 top-5 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold z-10 ${cfg.dotClass}`}
                style={{ background: delivery.status === 'pending' ? 'var(--color-bg-card)' : undefined }}>
                {delivery.status === 'completed' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ) : delivery.status === 'scheduled' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-bg-base">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                ) : (
                  <span className="text-text-muted text-xs font-medium">{delivery.order_index}</span>
                )}
              </div>

              {/* Card da entrega */}
              <div className={`bg-bg-card border rounded-xl transition-colors ${isOpen ? 'border-brand-gold/40' : 'border-border'}`}>
                {/* Header do card */}
                <button
                  className="w-full text-left p-5 flex items-center justify-between gap-4"
                  onClick={() => setOpenId(isOpen ? null : delivery.id)}
                  aria-expanded={isOpen}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-text-muted text-xs font-medium">
                        Entrega {delivery.order_index}
                      </span>
                    </div>
                    <h3 className="font-semibold text-text-primary">{delivery.title}</h3>
                    {delivery.status === 'scheduled' && delivery.scheduled_date && (
                      <p className="text-sm text-brand-gold mt-1">
                        Agendada para {formatDate(delivery.scheduled_date)}
                      </p>
                    )}
                    {delivery.status === 'completed' && delivery.completed_date && (
                      <p className="text-sm text-success mt-1">
                        Concluída em {formatDate(delivery.completed_date)}
                      </p>
                    )}
                    {delivery.link_call && delivery.status === 'scheduled' && (
                      <a
                        href={delivery.link_call}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 mt-1 text-xs text-brand-gold hover:text-brand-gold-light transition-colors"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.845v6.31a1 1 0 0 1-1.447.894L15 14M3 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z"/>
                        </svg>
                        Entrar na call
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${cfg.badgeClass}`}>
                      {cfg.label}
                    </span>
                    {hasMaterials && (
                      <svg
                        width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        className={`text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      >
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    )}
                  </div>
                </button>

                {/* Materiais expandidos */}
                {isOpen && hasMaterials && (
                  <div className="border-t border-border px-5 py-4 space-y-4">
                    {delivery.notes && (
                      <p className="text-text-secondary text-sm bg-bg-surface rounded-lg px-4 py-3 border border-border">
                        {delivery.notes}
                      </p>
                    )}
                    {delivery.delivery_materials.map((mat) => (
                      <MaterialItem key={mat.id} material={mat} />
                    ))}
                  </div>
                )}

                {/* Sem materiais mas expandido (notas) */}
                {isOpen && !hasMaterials && delivery.notes && (
                  <div className="border-t border-border px-5 py-4">
                    <p className="text-text-secondary text-sm bg-bg-surface rounded-lg px-4 py-3 border border-border">
                      {delivery.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MaterialItem({ material }: { material: Material }) {
  const [videoOpen, setVideoOpen] = useState(false)

  if (material.type === 'video') {
    const embedUrl = material.url ? getEmbedUrl(material.url) : null

    return (
      <div className="rounded-lg border border-border overflow-hidden">
        <button
          className="w-full flex items-center gap-3 px-4 py-3 bg-bg-surface hover:bg-bg-hover transition-colors text-left"
          onClick={() => setVideoOpen((o) => !o)}
        >
          <div className="w-8 h-8 rounded-lg bg-error/15 flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-error">
              <polygon points="23 7 16 12 23 17 23 7"/>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
          </div>
          <span className="flex-1 text-sm font-medium text-text-primary truncate">{material.title}</span>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`text-text-muted transition-transform shrink-0 ${videoOpen ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {videoOpen && embedUrl && (
          <div className="aspect-video">
            <iframe
              src={embedUrl}
              className="w-full h-full"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          </div>
        )}
        {videoOpen && !embedUrl && material.url && (
          <div className="px-4 py-3 bg-bg-surface border-t border-border">
            <a
              href={material.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-gold text-sm hover:underline"
            >
              Abrir vídeo →
            </a>
          </div>
        )}
      </div>
    )
  }

  // Material (PDF / link)
  const downloadUrl = material.file_url || material.url
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-bg-surface rounded-lg border border-border">
      <div className="w-8 h-8 rounded-lg bg-brand-gold/15 flex items-center justify-center shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-gold">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      </div>
      <span className="flex-1 text-sm font-medium text-text-primary truncate">{material.title}</span>
      {downloadUrl && (
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-brand-gold hover:text-brand-gold-light transition-colors shrink-0"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Baixar
        </a>
      )}
    </div>
  )
}
