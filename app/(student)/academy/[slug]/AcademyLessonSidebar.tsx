'use client'

import Link from 'next/link'

interface LessonItem {
  id: string
  title: string
  duration_minutes: number
  completed: boolean
}

export default function AcademyLessonSidebar({
  moduleId,
  lessons,
  activeLessonId,
}: {
  moduleId: string
  lessons: LessonItem[]
  activeLessonId: string
}) {
  return (
    <aside className="lg:w-80 shrink-0 border-l border-border bg-bg-card">
      <div className="sticky top-0 max-h-screen overflow-y-auto">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-text-primary">Aulas do Módulo</h3>
          <p className="text-xs text-text-muted mt-0.5">
            {lessons.filter((l) => l.completed).length}/{lessons.length} concluídas
          </p>
        </div>
        <div className="p-2">
          {lessons.map((lesson, i) => {
            const isActive = lesson.id === activeLessonId
            return (
              <Link
                key={lesson.id}
                href={`/academy/${moduleId}?aula=${lesson.id}`}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  isActive
                    ? 'bg-brand-gold/15 text-brand-gold font-medium'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                  lesson.completed
                    ? 'bg-green-400/20 text-green-400'
                    : isActive
                      ? 'bg-brand-gold/20 text-brand-gold'
                      : 'bg-bg-surface text-text-muted'
                }`}>
                  {lesson.completed ? '✓' : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate">{lesson.title}</p>
                  {lesson.duration_minutes > 0 && (
                    <p className="text-[10px] text-text-muted">{lesson.duration_minutes} min</p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </aside>
  )
}
