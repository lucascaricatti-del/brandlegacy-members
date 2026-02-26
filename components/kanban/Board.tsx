'use client'

import { useState, useRef, useTransition, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import KanbanColumn from './Column'
import KanbanCard from './Card'
import { moveCard } from '@/app/actions/kanban'
import type { KanbanPriority, CardLabel, CardAttachment } from '@/lib/types/database'

// ── Shared interfaces ──────────────────────────────────────

export interface Comment {
  id: string
  content: string
  created_at: string
  profiles: { name: string } | null
}

export interface CardData {
  id: string
  title: string
  description: string | null
  priority: KanbanPriority
  due_date: string | null
  assignee_id: string | null
  column_id: string
  position: number
  labels: CardLabel[]
  attachments: CardAttachment[]
  comments: Comment[]
  profiles: { name: string } | null
}

export interface Member {
  user_id: string
  profiles: { id: string; name: string } | null
}

export interface ColumnData {
  id: string
  title: string
  color: string | null
  position: number
  cards: CardData[]
}

export interface ColumnMeta {
  id: string
  title: string
}

// ── Board Component ────────────────────────────────────────

interface Props {
  columns: ColumnData[]
  workspaceId: string
  members: Member[]
}

export default function KanbanBoard({ columns: initialColumns, workspaceId, members }: Props) {
  const [columns, setColumns] = useState(initialColumns)
  const [activeCardId, setActiveCardId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // Ref for latest columns state (accessible in event handlers without stale closures)
  const columnsRef = useRef(columns)
  columnsRef.current = columns

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  const isColumnId = useCallback(
    (id: string) => columnsRef.current.some((col) => col.id === id),
    []
  )

  const findColumnOfCard = useCallback(
    (cardId: string) => columnsRef.current.find((col) => col.cards.some((c) => c.id === cardId)),
    []
  )

  // ── Drag start ──
  function handleDragStart({ active }: DragStartEvent) {
    setActiveCardId(active.id as string)
  }

  // ── Drag over: handle cross-column movement live ──
  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return
    const activeId = active.id as string
    const overId = over.id as string
    if (activeId === overId) return

    const sourceCol = findColumnOfCard(activeId)
    if (!sourceCol) return

    const destCol = isColumnId(overId)
      ? columnsRef.current.find((c) => c.id === overId)
      : findColumnOfCard(overId)

    if (!destCol || sourceCol.id === destCol.id) return

    // Move card from source to dest
    setColumns((prev) => {
      const srcCards = prev.find((c) => c.id === sourceCol.id)?.cards
      const card = srcCards?.find((c) => c.id === activeId)
      if (!card) return prev

      return prev.map((col) => {
        if (col.id === sourceCol.id) {
          return { ...col, cards: col.cards.filter((c) => c.id !== activeId) }
        }
        if (col.id === destCol.id) {
          // If over a card, insert at that position; if over column, append
          const overIdx = isColumnId(overId)
            ? col.cards.length
            : col.cards.findIndex((c) => c.id === overId)
          const idx = overIdx >= 0 ? overIdx : col.cards.length
          const newCards = [...col.cards]
          newCards.splice(idx, 0, { ...card, column_id: col.id })
          return { ...col, cards: newCards }
        }
        return col
      })
    })
  }

  // ── Drag end: handle within-column reorder + persist ──
  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveCardId(null)
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string
    if (activeId === overId) {
      // Persist current position (dropped in same spot)
      const col = findColumnOfCard(activeId)
      if (col) {
        const idx = col.cards.findIndex((c) => c.id === activeId)
        startTransition(() => { moveCard(workspaceId, activeId, col.id, idx) })
      }
      return
    }

    const column = findColumnOfCard(activeId)
    if (!column) return

    // Within-column reorder
    if (!isColumnId(overId) && column.cards.some((c) => c.id === overId)) {
      const oldIndex = column.cards.findIndex((c) => c.id === activeId)
      const newIndex = column.cards.findIndex((c) => c.id === overId)
      if (oldIndex !== newIndex) {
        setColumns((prev) =>
          prev.map((col) =>
            col.id === column.id
              ? { ...col, cards: arrayMove(col.cards, oldIndex, newIndex) }
              : col
          )
        )
      }
    }

    // Persist final position (read from latest ref after state update)
    setTimeout(() => {
      const latestCol = columnsRef.current.find((c) => c.cards.some((card) => card.id === activeId))
      if (latestCol) {
        const idx = latestCol.cards.findIndex((c) => c.id === activeId)
        startTransition(() => { moveCard(workspaceId, activeId, latestCol.id, idx) })
      }
    }, 0)
  }

  // ── Render ──

  const sortedColumns = [...columns].sort((a, b) => a.position - b.position)
  const allColumns: ColumnMeta[] = sortedColumns.map((col) => ({ id: col.id, title: col.title }))

  const activeCard = activeCardId
    ? columns.flatMap((c) => c.cards).find((c) => c.id === activeCardId)
    : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 items-start">
        {sortedColumns.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            workspaceId={workspaceId}
            members={members}
            allColumns={allColumns}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeCard && (
          <div className="w-[272px] opacity-90 rotate-2">
            <KanbanCard
              card={activeCard}
              workspaceId={workspaceId}
              members={members}
              allColumns={allColumns}
              isOverlay
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
