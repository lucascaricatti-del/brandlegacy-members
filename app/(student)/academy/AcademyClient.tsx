'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'

type EnrichedModule = {
  id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  category: string
  min_plan: string
  total_lessons: number
  completed_lessons: number
  progress: number
  total_duration: number
  has_access: boolean
}

const PLAN_LABELS: Record<string, string> = { free: 'Todos', tracao: 'Tração', club: 'Club' }

interface Props {
  mentoria: EnrichedModule[]
  masterclass: EnrichedModule[]
  freeClass: EnrichedModule[]
  continueWatching: EnrichedModule[]
  hasActivePlan: boolean
}

export default function AcademyClient({ mentoria, masterclass, freeClass, continueWatching, hasActivePlan }: Props) {
  const [search, setSearch] = useState('')

  const allModules = [...mentoria, ...masterclass, ...freeClass]
  const filteredModules = search.length >= 2
    ? allModules.filter((m) => m.title.toLowerCase().includes(search.toLowerCase()))
    : null

  return (
    <div className="animate-fade-in -mx-4 md:-mx-8">
      {/* Hero */}
      <div className="relative overflow-hidden px-4 md:px-8 py-12 md:py-16 mb-8">
        <div className="absolute inset-0 bg-gradient-to-br from-bg-surface/80 via-bg-base to-bg-card" />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-gold/5 to-transparent" />
        <div className="relative max-w-3xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-text-primary mb-3">
            BrandLegacy <span className="text-gradient-gold">Academy</span>
          </h1>
          <p className="text-text-secondary text-sm md:text-base mb-8">
            Seu centro de conhecimento para escalar seu negócio
          </p>
          <div className="relative max-w-md mx-auto">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Buscar aulas, masterclasses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-bg-card/80 backdrop-blur border border-border text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-brand-gold transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 space-y-10 pb-8">
        {/* Resultados de busca */}
        {filteredModules !== null ? (
          <div>
            <h2 className="text-lg font-bold text-text-primary mb-4">
              Resultados para &ldquo;{search}&rdquo;
            </h2>
            {filteredModules.length === 0 ? (
              <p className="text-text-muted text-sm">Nenhum resultado encontrado.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredModules.map((mod) => (
                  <ModuleCard key={mod.id} mod={mod} size="normal" />
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Continue assistindo */}
            {continueWatching.length > 0 && (
              <Carousel title="Continue assistindo" modules={continueWatching} size="normal" showProgress />
            )}

            {/* Aulas de Mentoria */}
            {mentoria.length > 0 && (
              <Carousel
                title="Aulas de Mentoria"
                modules={mentoria}
                size="normal"
                emptyLock={!hasActivePlan}
              />
            )}

            {/* Masterclasses */}
            {masterclass.length > 0 && (
              <Carousel title="Masterclasses" modules={masterclass} size="large" badge="MASTERCLASS" />
            )}

            {/* Aulas Gratuitas */}
            {freeClass.length > 0 && (
              <Carousel title="Aulas Gratuitas" modules={freeClass} size="normal" badge="GRATUITO" isFreeClass />
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Carousel({
  title,
  modules,
  size,
  badge,
  showProgress,
  emptyLock,
  isFreeClass,
}: {
  title: string
  modules: EnrichedModule[]
  size: 'normal' | 'large'
  badge?: string
  showProgress?: boolean
  emptyLock?: boolean
  isFreeClass?: boolean
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  function scroll(direction: 'left' | 'right') {
    if (!scrollRef.current) return
    const amount = scrollRef.current.clientWidth * 0.8
    scrollRef.current.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-text-primary">{title}</h2>
        <div className="flex gap-1">
          <button onClick={() => scroll('left')} className="p-1.5 rounded-lg bg-bg-card border border-border text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <button onClick={() => scroll('right')} className="p-1.5 rounded-lg bg-bg-card border border-border text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mb-2 snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none' }}
      >
        {modules.map((mod) => (
          <div key={mod.id} className={`shrink-0 snap-start ${size === 'large' ? 'w-72 md:w-80' : 'w-56 md:w-64'}`}>
            <ModuleCard
              mod={mod}
              size={size}
              badge={badge}
              showProgress={showProgress}
              locked={emptyLock && !mod.has_access}
              isFreeClass={isFreeClass}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

function ModuleCard({
  mod,
  size,
  badge,
  showProgress,
  locked,
  isFreeClass,
}: {
  mod: EnrichedModule
  size: 'normal' | 'large'
  badge?: string
  showProgress?: boolean
  locked?: boolean
  isFreeClass?: boolean
}) {
  const aspectHeight = size === 'large' ? 'h-44' : 'h-36'
  const href = isFreeClass ? `/aulas/${mod.id}` : `/academy/${mod.id}`

  return (
    <Link
      href={href}
      className="block group rounded-xl overflow-hidden bg-bg-card border border-border hover:border-brand-gold/40 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-brand-gold/5"
    >
      {/* Thumbnail */}
      <div className={`relative ${aspectHeight} overflow-hidden`}>
        {mod.thumbnail_url ? (
          <img src={mod.thumbnail_url} alt={mod.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full relative overflow-hidden">
            {/* Gradient background: dark green → gold */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0F1911] via-[#1A4628] to-[#C98A05]/40" />
            {/* Decorative diagonal stripe */}
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-brand-gold/8 rotate-45" />
            <div className="absolute -left-4 -bottom-4 w-24 h-24 rounded-full bg-brand-gold/5" />
            {/* Content overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center px-4 gap-2">
              {/* Play icon */}
              <div className="w-10 h-10 rounded-full bg-brand-gold/20 border border-brand-gold/30 flex items-center justify-center group-hover:bg-brand-gold/30 group-hover:scale-110 transition-all duration-300">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-brand-gold ml-0.5">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
              {/* Module title */}
              <p className="text-white/90 text-xs font-semibold text-center leading-tight line-clamp-2 max-w-[90%]">
                {mod.title}
              </p>
            </div>
          </div>
        )}

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Badge */}
        {badge && (
          <span className={`absolute top-2.5 left-2.5 text-[9px] px-2 py-0.5 rounded font-bold tracking-wider uppercase ${
            badge === 'MASTERCLASS' ? 'bg-brand-gold text-bg-base' :
            badge === 'GRATUITO' ? 'bg-green-500 text-white' :
            'bg-bg-surface text-text-primary'
          }`}>
            {badge}
          </span>
        )}

        {/* Plan badge */}
        {!isFreeClass && mod.min_plan !== 'free' && (
          <span className="absolute top-2.5 right-2.5 text-[9px] px-1.5 py-0.5 rounded bg-black/50 text-white/80 font-medium">
            {PLAN_LABELS[mod.min_plan] ?? mod.min_plan}
          </span>
        )}

        {/* Lock overlay */}
        {locked && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-[1px]">
            <div className="text-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/60 mx-auto mb-1">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <p className="text-[10px] text-white/60 font-medium">Disponível para mentorados</p>
            </div>
          </div>
        )}

        {/* Duration */}
        {mod.total_duration > 0 && (
          <span className="absolute bottom-2 right-2.5 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white/80 font-medium">
            {mod.total_duration} min
          </span>
        )}

        {/* Progress bar */}
        {(showProgress || mod.progress > 0) && mod.progress < 100 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
            <div className="h-full bg-brand-gold transition-all" style={{ width: `${mod.progress}%` }} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="text-sm font-semibold text-text-primary group-hover:text-brand-gold transition-colors line-clamp-2 leading-tight">
          {mod.title}
        </h3>
        {mod.description && (
          <p className="text-text-muted text-xs mt-1 line-clamp-1">{mod.description}</p>
        )}
        <p className="text-text-muted text-[10px] mt-1.5">
          {mod.total_lessons} {mod.total_lessons === 1 ? 'aula' : 'aulas'}
          {mod.progress > 0 && mod.progress < 100 && ` · ${mod.progress}% concluído`}
          {mod.progress === 100 && ' · Concluído'}
        </p>
      </div>
    </Link>
  )
}
