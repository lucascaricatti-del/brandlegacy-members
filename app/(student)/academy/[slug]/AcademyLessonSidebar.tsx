'use client'

import { useState } from 'react'
import Link from 'next/link'

interface LessonItem {
  id: string
  title: string
  duration_minutes: number
  completed: boolean
}

export default function AcademyLessonSidebar({
  moduleId,
  moduleTitle,
  lessons,
  activeLessonId,
  totalDone,
}: {
  moduleId: string
  moduleTitle: string
  lessons: LessonItem[]
  activeLessonId: string
  totalDone: number
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pct = lessons.length > 0 ? Math.round((totalDone / lessons.length) * 100) : 0

  const lessonList = (
    <div className="divide-y divide-[#1f3d25]">
      {lessons.map((lesson, i) => {
        const isActive = lesson.id === activeLessonId
        return (
          <Link
            key={lesson.id}
            href={`/academy/${moduleId}?aula=${lesson.id}`}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-4 py-3.5 transition-all ${
              isActive
                ? 'bg-[#c9a84c]/10 border-l-2 border-l-[#c9a84c]'
                : 'hover:bg-[#152d1f] border-l-2 border-l-transparent'
            }`}
          >
            {/* Status icon */}
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
              lesson.completed
                ? 'bg-green-400/15 text-green-400'
                : isActive
                  ? 'bg-[#c9a84c]/20 text-[#c9a84c]'
                  : 'bg-[#1f3d25] text-[#8a9e8f]'
            }`}>
              {lesson.completed ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
              ) : (
                i + 1
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className={`text-sm leading-tight ${
                isActive ? 'text-[#c9a84c] font-semibold' :
                lesson.completed ? 'text-[#8a9e8f]' :
                'text-white'
              }`}>
                {lesson.title}
              </p>
              {lesson.duration_minutes > 0 && (
                <p className="text-[10px] text-[#8a9e8f] mt-0.5">{lesson.duration_minutes} min</p>
              )}
            </div>

            {isActive && (
              <div className="w-2 h-2 rounded-full bg-[#c9a84c] shrink-0 animate-pulse" />
            )}
          </Link>
        )
      })}
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block lg:w-[340px] xl:w-[380px] shrink-0 border-l border-[#1f3d25] bg-[#0f2318]">
        <div className="sticky top-0 max-h-screen overflow-y-auto">
          {/* Header */}
          <div className="p-5 border-b border-[#1f3d25]">
            <h3 className="text-sm font-bold text-white mb-1">{moduleTitle}</h3>
            <div className="flex items-center justify-between text-xs text-[#8a9e8f] mb-3">
              <span>{totalDone}/{lessons.length} concluídas</span>
              <span className="text-[#c9a84c] font-medium">{pct}%</span>
            </div>
            <div className="w-full h-1.5 bg-[#1f3d25] rounded-full overflow-hidden">
              <div className="h-full bg-[#c9a84c] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
          {lessonList}
        </div>
      </aside>

      {/* Mobile accordion */}
      <div className="lg:hidden border-t border-[#1f3d25] bg-[#0f2318]">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex items-center justify-between w-full px-4 py-4 text-left"
        >
          <div className="flex items-center gap-3">
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className={`text-[#c9a84c] transition-transform ${mobileOpen ? 'rotate-90' : ''}`}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span className="text-sm font-bold text-white">Aulas do módulo</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#8a9e8f]">{totalDone}/{lessons.length}</span>
            <div className="w-16 h-1.5 bg-[#1f3d25] rounded-full overflow-hidden">
              <div className="h-full bg-[#c9a84c] rounded-full" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </button>
        {mobileOpen && lessonList}
      </div>
    </>
  )
}
