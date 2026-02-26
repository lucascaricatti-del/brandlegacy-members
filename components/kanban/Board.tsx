'use client'

import { useState, useTransition } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import KanbanColumn from './Column'
import { moveCard } from '@/app/actions/kanban'
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
  position: number
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
  position: number
  cards: CardData[]
}

interface Props {
  columns: ColumnData[]
  workspaceId: string
  members: Member[]
}

export default function KanbanBoard({ columns: initialColumns, workspaceId, members }: Props) {
  const [columns, setColumns] = useState(initialColumns)
  const [activeCardId, setActiveCardId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  function findColumnByCardId(cardId: string) {
    return columns.find((col) => col.cards.some((c) => c.id === cardId))
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveCardId(active.id as string)
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveCardId(null)
    if (!over) return

    const cardId = active.id as string
    const overId = over.id as string

    const sourceColumn = findColumnByCardId(cardId)
    if (!sourceColumn) return

    // Determina coluna de destino
    const destColumn = columns.find((col) => col.id === overId)
      ?? findColumnByCardId(overId)

    if (!destColumn) return

    if (sourceColumn.id === destColumn.id) {
      // Reorder dentro da mesma coluna
      const oldIndex = sourceColumn.cards.findIndex((c) => c.id === cardId)
      const newIndex = sourceColumn.cards.findIndex((c) => c.id === overId)
      if (oldIndex === newIndex) return

      const newCards = arrayMove(sourceColumn.cards, oldIndex, newIndex)
      setColumns((prev) =>
        prev.map((col) =>
          col.id === sourceColumn.id ? { ...col, cards: newCards } : col
        )
      )
      startTransition(() => {
        moveCard(workspaceId, cardId, destColumn.id, newIndex)
      })
    } else {
      // Mover para outra coluna
      const card = sourceColumn.cards.find((c) => c.id === cardId)!
      const newPosition = destColumn.cards.length

      setColumns((prev) =>
        prev.map((col) => {
          if (col.id === sourceColumn.id) {
            return { ...col, cards: col.cards.filter((c) => c.id !== cardId) }
          }
          if (col.id === destColumn.id) {
            return { ...col, cards: [...col.cards, { ...card, column_id: destColumn.id }] }
          }
          return col
        })
      )

      startTransition(() => {
        moveCard(workspaceId, cardId, destColumn.id, newPosition)
      })
    }
  }

  const activeCard = activeCardId
    ? columns.flatMap((c) => c.cards).find((c) => c.id === activeCardId)
    : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-5 overflow-x-auto pb-4">
        {columns
          .sort((a, b) => a.position - b.position)
          .map((col) => (
            <KanbanColumn
              key={col.id}
              column={col}
              workspaceId={workspaceId}
              members={members}
            />
          ))}
      </div>

      <DragOverlay>
        {activeCard && (
          <div className="p-3 bg-bg-card border border-brand-gold/40 rounded-lg shadow-xl rotate-1 opacity-90 w-72">
            <p className="text-sm text-text-primary font-medium">{activeCard.title}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
