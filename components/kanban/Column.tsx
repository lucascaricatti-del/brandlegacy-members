'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import KanbanCard from './Card'
import AddCardForm from './AddCardForm'
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

interface ColumnData {
  id: string
  title: string
  color: string | null
  cards: CardData[]
}

interface Props {
  column: ColumnData
  workspaceId: string
  members: Member[]
}

export default function KanbanColumn({ column, workspaceId, members }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column' },
  })

  const cardIds = column.cards.map((c) => c.id)

  return (
    <div className="flex flex-col w-72 shrink-0">
      {/* Cabeçalho da coluna */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          {column.color && (
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: column.color }} />
          )}
          <h3 className="font-medium text-sm text-text-primary">{column.title}</h3>
          <span className="text-xs text-text-muted bg-bg-surface rounded-full px-2 py-0.5">
            {column.cards.length}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className={`flex-1 rounded-xl p-2 min-h-[200px] transition-colors ${isOver ? 'bg-brand-gold/5 border border-brand-gold/20' : 'bg-bg-surface/50'}`}
      >
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {column.cards.map((card) => (
              <KanbanCard
                key={card.id}
                card={card}
                workspaceId={workspaceId}
                members={members}
              />
            ))}
          </div>
        </SortableContext>

        {column.cards.length === 0 && !isOver && (
          <div className="flex items-center justify-center h-20">
            <p className="text-xs text-text-muted">Sem cards</p>
          </div>
        )}
      </div>

      {/* Adicionar card */}
      <div className="mt-2">
        <AddCardForm columnId={column.id} workspaceId={workspaceId} />
      </div>
    </div>
  )
}
