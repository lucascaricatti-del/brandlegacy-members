'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import CardModal from './CardModal'
import type { KanbanPriority, CardLabel } from '@/lib/types/database'
import type { CardData, Member, ColumnMeta } from './Board'

// ── Priority config ────────────────────────────────────────

export const PRIORITY_COLORS: Record<KanbanPriority, string> = {
  low: 'text-blue-400 bg-blue-400/15',
  medium: 'text-yellow-400 bg-yellow-400/15',
  high: 'text-orange-400 bg-orange-400/15',
  urgent: 'text-red-400 bg-red-400/15',
}

export const PRIORITY_LABELS: Record<KanbanPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
}

// ── Card Component ────────────────────────────────────────

interface Props {
  card: CardData
  workspaceId: string
  members: Member[]
  allColumns: ColumnMeta[]
  isOverlay?: boolean
}

export default function KanbanCard({ card, workspaceId, members, allColumns, isOverlay }: Props) {
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
    opacity: isDragging ? 0.3 : 1,
  }

  const isOverdue = card.due_date && new Date(card.due_date) < new Date()
  const commentCount = card.comments?.length ?? 0
  const attachmentCount = card.attachments?.length ?? 0
  const labels = card.labels ?? []

  return (
    <>
      <div
        ref={isOverlay ? undefined : setNodeRef}
        style={isOverlay ? undefined : style}
        {...(isOverlay ? {} : attributes)}
        {...(isOverlay ? {} : listeners)}
        onClick={isOverlay ? undefined : () => setModalOpen(true)}
        className={`
          bg-bg-card border border-border rounded-lg cursor-pointer
          hover:border-border-light transition-colors
          ${isDragging ? 'shadow-lg ring-1 ring-brand-gold/30' : 'shadow-sm'}
          ${isOverlay ? 'shadow-xl ring-1 ring-brand-gold/40' : ''}
        `}
      >
        {/* Label color bars */}
        {labels.length > 0 && (
          <div className="flex gap-1 px-3 pt-2.5 pb-0.5 flex-wrap">
            {labels.map((label: CardLabel) => (
              <span
                key={label.id}
                className="h-2 rounded-full min-w-[40px] text-[0px]"
                style={{ backgroundColor: label.color }}
                title={label.text}
              >
                {label.text}
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <div className="px-3 pt-2 pb-1.5">
          <p className="text-sm text-text-primary leading-snug">{card.title}</p>
        </div>

        {/* Metadata row */}
        <div className="flex items-center gap-1.5 flex-wrap px-3 pb-2.5">
          {/* Priority badge */}
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium leading-none ${PRIORITY_COLORS[card.priority]}`}>
            {PRIORITY_LABELS[card.priority]}
          </span>

          {/* Due date */}
          {card.due_date && (
            <span className={`
              inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded leading-none
              ${isOverdue ? 'text-red-400 bg-red-400/10' : 'text-text-muted bg-bg-surface'}
            `}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              {new Date(card.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </span>
          )}

          {/* Comment count */}
          {commentCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-text-muted leading-none">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              {commentCount}
            </span>
          )}

          {/* Attachment count */}
          {attachmentCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-text-muted leading-none">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
              {attachmentCount}
            </span>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Assignee avatar */}
          {card.profiles && (
            <div
              className="w-6 h-6 rounded-full bg-brand-gold/20 flex items-center justify-center shrink-0"
              title={card.profiles.name}
            >
              <span className="text-brand-gold text-[10px] font-semibold">
                {card.profiles.name[0]?.toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </div>

      {modalOpen && (
        <CardModal
          card={card}
          workspaceId={workspaceId}
          members={members}
          allColumns={allColumns}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}
