'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import CardModal, { PRIORITY_COLORS, PRIORITY_LABELS } from './CardModal'
import type { KanbanPriority } from '@/lib/types/database'

interface Comment {
  id: string
  content: string
  created_at: string
  profiles: { name: string } | null
}

interface CardData {
  id: string
  title: string
  description: string | null
  priority: KanbanPriority
  due_date: string | null
  assignee_id: string | null
  column_id: string
  comments?: Comment[]
  profiles?: { name: string } | null
}

interface Member {
  user_id: string
  profiles: { id: string; name: string } | null
}

interface Props {
  card: CardData
  workspaceId: string
  members: Member[]
}

export default function KanbanCard({ card, workspaceId, members }: Props) {
  const [modalOpen, setModalOpen] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, data: { type: 'card', columnId: card.column_id } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const isOverdue = card.due_date && new Date(card.due_date) < new Date()

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={() => setModalOpen(true)}
        className="p-3 bg-bg-card border border-border rounded-lg cursor-grab active:cursor-grabbing hover:border-brand-gold/40 transition-colors group"
      >
        <p className="text-sm text-text-primary font-medium mb-2 leading-snug">{card.title}</p>

        {card.description && (
          <p className="text-xs text-text-muted line-clamp-2 mb-2">{card.description}</p>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLORS[card.priority]}`}>
              {PRIORITY_LABELS[card.priority]}
            </span>
            {card.due_date && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${isOverdue ? 'text-error bg-error/10' : 'text-text-muted bg-bg-surface'}`}>
                {new Date(card.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              </span>
            )}
          </div>

          {card.profiles && (
            <div className="w-5 h-5 rounded-full bg-brand-gold/20 flex items-center justify-center shrink-0" title={card.profiles.name}>
              <span className="text-brand-gold text-xs font-semibold">{card.profiles.name[0]?.toUpperCase()}</span>
            </div>
          )}
        </div>

        {(card.comments?.length ?? 0) > 0 && (
          <div className="flex items-center gap-1 mt-2 text-text-muted">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span className="text-xs">{card.comments!.length}</span>
          </div>
        )}
      </div>

      {modalOpen && (
        <CardModal
          card={card}
          workspaceId={workspaceId}
          members={members}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}
