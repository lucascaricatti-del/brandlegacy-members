'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import KanbanCard from './Card'
import AddCardForm from './AddCardForm'
import type { CardData, Member, ColumnMeta } from './Board'

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
  allColumns: ColumnMeta[]
}

export default function KanbanColumn({ column, workspaceId, members, allColumns }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column' },
  })

  const cardIds = column.cards.map((c) => c.id)

  return (
    <div className="flex flex-col w-[272px] shrink-0 max-h-[calc(100vh-180px)]">
      {/* Column header */}
      <div className="flex items-center justify-between mb-2 px-2 py-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {column.color && (
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: column.color }} />
          )}
          <h3 className="font-semibold text-sm text-text-primary truncate">{column.title}</h3>
          <span className="text-xs text-text-muted shrink-0">{column.cards.length}</span>
        </div>
      </div>

      {/* Cards container */}
      <div
        ref={setNodeRef}
        className={`
          flex-1 overflow-y-auto rounded-lg px-1.5 py-1.5 min-h-[60px]
          transition-colors duration-150
          ${isOver ? 'bg-brand-gold/5 ring-1 ring-brand-gold/20' : 'bg-bg-surface/30'}
        `}
      >
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {column.cards.map((card) => (
              <KanbanCard
                key={card.id}
                card={card}
                workspaceId={workspaceId}
                members={members}
                allColumns={allColumns}
              />
            ))}
          </div>
        </SortableContext>

        {column.cards.length === 0 && !isOver && (
          <div className="flex items-center justify-center py-6">
            <p className="text-xs text-text-muted/60">Arraste cards aqui</p>
          </div>
        )}
      </div>

      {/* Add card */}
      <div className="mt-1.5 px-0.5">
        <AddCardForm columnId={column.id} workspaceId={workspaceId} />
      </div>
    </div>
  )
}
