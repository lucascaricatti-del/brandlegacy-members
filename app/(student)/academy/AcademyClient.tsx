'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'

// ── Types ────────────────────────────────────────────────────

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

const PLAN_BADGE: Record<string, string> = { tracao: 'Tração', club: 'Club' }

interface Props {
  mentoria: EnrichedModule[]
  masterclass: EnrichedModule[]
  freeClass: EnrichedModule[]
  continueWatching: EnrichedModule[]
  hasActivePlan: boolean
  stats: { totalLessons: number; totalMasterclasses: number; totalModules: number }
}

// ── Main Component ───────────────────────────────────────────

export default function AcademyClient({ mentoria, masterclass, freeClass, continueWatching, hasActivePlan, stats }: Props) {
  const [search, setSearch] = useState('')

  const allModules = [...mentoria, ...masterclass, ...freeClass]
  const filteredModules = search.length >= 2
    ? allModules.filter((m) => m.title.toLowerCase().includes(search.toLowerCase()))
    : null

  return (
    <div className="animate-fade-in -mx-4 md:-mx-8">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden px-4 md:px-8 pt-14 pb-12 md:pt-20 md:pb-16 mb-10">
        {/* Gradient layers */}
        <div className="absolute inset-0 bg-[#0a1a0f]" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#152d1f]/80 via-[#0a1a0f] to-[#0f2318]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#c9a84c]/[0.04] to-transparent" />
        {/* Decorative glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#c9a84c]/[0.03] rounded-full blur-3xl" />

        <div className="relative max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 tracking-tight">
            BrandLegacy <span className="text-gradient-gold">Academy</span>
          </h1>
          <p className="text-[#8a9e8f] text-sm md:text-base mb-8">
            Seu centro de conhecimento para escalar seu negócio
          </p>

          {/* Search */}
          <div className="relative max-w-lg mx-auto mb-8">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8a9e8f]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Buscar aulas, masterclasses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-[#0f2318]/80 backdrop-blur-sm border border-[#1f3d25] text-white placeholder:text-[#8a9e8f]/60 text-sm focus:outline-none focus:border-[#c9a84c]/50 focus:ring-1 focus:ring-[#c9a84c]/20 transition-all"
            />
          </div>

          {/* Stats */}
          <div className="flex items-center justify-center gap-6 text-[#8a9e8f] text-sm">
            <span className="flex items-center gap-1.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#c9a84c]"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              {stats.totalLessons} aulas
            </span>
            <span className="w-1 h-1 rounded-full bg-[#8a9e8f]/40" />
            <span className="flex items-center gap-1.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#c9a84c]"><rect x="2" y="7" width="20" height="15" rx="2" ry="2" /><polyline points="17 2 12 7 7 2" /></svg>
              {stats.totalMasterclasses} masterclasses
            </span>
            <span className="w-1 h-1 rounded-full bg-[#8a9e8f]/40" />
            <span className="flex items-center gap-1.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#c9a84c]"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
              {stats.totalModules} módulos
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 space-y-12 pb-12">
        {/* Search results */}
        {filteredModules !== null ? (
          <div>
            <h2 className="text-xl font-bold text-white mb-6">
              Resultados para &ldquo;{search}&rdquo;
            </h2>
            {filteredModules.length === 0 ? (
              <div className="bg-[#0f2318] border border-[#1f3d25] rounded-xl p-16 text-center">
                <p className="text-[#8a9e8f] text-sm">Nenhum resultado encontrado.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredModules.map((mod, i) => (
                  <ModuleCard key={mod.id} mod={mod} index={i} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Continue assistindo */}
            {continueWatching.length > 0 && (
              <section>
                <SectionTitle title="Continue assistindo" count={continueWatching.length} icon="clock" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {continueWatching.map((mod, i) => (
                    <ModuleCard key={mod.id} mod={mod} index={i} highlight />
                  ))}
                </div>
              </section>
            )}

            {/* Aulas de Mentoria */}
            {mentoria.length > 0 && (
              <Carousel
                title="Aulas de Mentoria"
                count={mentoria.length}
                icon="book"
                modules={mentoria}
                locked={!hasActivePlan}
              />
            )}

            {/* Masterclasses */}
            {masterclass.length > 0 && (
              <Carousel
                title="Masterclasses"
                count={masterclass.length}
                icon="star"
                modules={masterclass}
              />
            )}

            {/* Aulas Gratuitas */}
            {freeClass.length > 0 && (
              <Carousel
                title="Aulas Gratuitas"
                count={freeClass.length}
                icon="gift"
                modules={freeClass}
                isFreeClass
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Section Title ────────────────────────────────────────────

function SectionTitle({ title, count, icon }: { title: string; count: number; icon: string }) {
  const icons: Record<string, React.ReactNode> = {
    clock: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#c9a84c]"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
    book: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#c9a84c]"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>,
    star: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#c9a84c]"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
    gift: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#c9a84c]"><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></svg>,
  }

  return (
    <div className="flex items-center gap-3 mb-6">
      {icons[icon]}
      <h2 className="text-xl font-bold text-white">{title}</h2>
      <span className="text-xs px-2.5 py-1 rounded-full bg-[#c9a84c]/15 text-[#c9a84c] font-semibold">{count}</span>
    </div>
  )
}

// ── Carousel ─────────────────────────────────────────────────

function Carousel({
  title,
  count,
  icon,
  modules,
  locked,
  isFreeClass,
}: {
  title: string
  count: number
  icon: string
  modules: EnrichedModule[]
  locked?: boolean
  isFreeClass?: boolean
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  function scroll(direction: 'left' | 'right') {
    if (!scrollRef.current) return
    const amount = scrollRef.current.clientWidth * 0.75
    scrollRef.current.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <SectionTitle title={title} count={count} icon={icon} />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => scroll('left')}
            className="w-9 h-9 rounded-full bg-[#0f2318] border border-[#1f3d25] text-[#8a9e8f] hover:text-white hover:border-[#c9a84c]/40 hover:bg-[#152d1f] flex items-center justify-center transition-all"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <button
            onClick={() => scroll('right')}
            className="w-9 h-9 rounded-full bg-[#0f2318] border border-[#1f3d25] text-[#8a9e8f] hover:text-white hover:border-[#c9a84c]/40 hover:bg-[#152d1f] flex items-center justify-center transition-all"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-5 overflow-x-auto pb-4 -mb-4 snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none' }}
      >
        {modules.map((mod, i) => (
          <div key={mod.id} className="shrink-0 snap-start w-[280px] md:w-[300px] lg:w-[320px]">
            <ModuleCard
              mod={mod}
              index={i}
              locked={locked && !mod.has_access}
              isFreeClass={isFreeClass}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Module Card ──────────────────────────────────────────────

function ModuleCard({
  mod,
  index = 0,
  locked,
  isFreeClass,
  highlight,
}: {
  mod: EnrichedModule
  index?: number
  locked?: boolean
  isFreeClass?: boolean
  highlight?: boolean
}) {
  const href = isFreeClass ? `/aulas/${mod.id}` : `/academy/${mod.id}`
  const planLabel = PLAN_BADGE[mod.min_plan]

  return (
    <Link
      href={href}
      className="block group rounded-xl overflow-hidden bg-[#0f2318] border border-[#1f3d25] hover:border-[#c9a84c]/30 transition-all duration-300 hover:scale-[1.02]"
      style={{
        animationDelay: `${index * 80}ms`,
        animationFillMode: 'backwards',
        boxShadow: 'none',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 32px rgba(201,168,76,0.15)' }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none' }}
    >
      {/* Thumbnail — 60% of card */}
      <div className="relative aspect-[16/10] overflow-hidden">
        {mod.thumbnail_url ? (
          <img
            src={mod.thumbnail_url}
            alt={mod.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#0a1a0f] via-[#152d1f] to-[#c9a84c]/20" />
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-[#c9a84c]/[0.06] rotate-45" />
            <div className="absolute -left-4 -bottom-4 w-24 h-24 rounded-full bg-[#c9a84c]/[0.04]" />
          </div>
        )}

        {/* Dark overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300" />

        {/* Gradient bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Play button — centered */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-[#c9a84c]/20 border-2 border-[#c9a84c]/40 backdrop-blur-sm flex items-center justify-center opacity-80 group-hover:opacity-100 group-hover:scale-110 group-hover:bg-[#c9a84c]/30 transition-all duration-300">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-[#c9a84c] ml-0.5">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        </div>

        {/* Plan badge — top right in gold */}
        {!isFreeClass && planLabel && (
          <span className="absolute top-3 right-3 text-[10px] px-2.5 py-1 rounded-md bg-[#c9a84c] text-[#0a1a0f] font-bold tracking-wide uppercase">
            {planLabel}
          </span>
        )}

        {isFreeClass && (
          <span className="absolute top-3 right-3 text-[10px] px-2.5 py-1 rounded-md bg-green-500 text-white font-bold tracking-wide uppercase">
            Gratuito
          </span>
        )}

        {/* Lock overlay */}
        {locked && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
            <div className="text-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/50 mx-auto mb-2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <p className="text-xs text-white/50 font-medium">Disponível para mentorados</p>
            </div>
          </div>
        )}

        {/* Duration */}
        {mod.total_duration > 0 && !locked && (
          <span className="absolute bottom-3 right-3 text-[10px] px-2 py-0.5 rounded-md bg-black/60 text-white/80 font-medium backdrop-blur-sm">
            {mod.total_duration} min
          </span>
        )}
      </div>

      {/* Info section */}
      <div className="p-4">
        <h3 className="text-sm font-bold text-white group-hover:text-[#c9a84c] transition-colors line-clamp-2 leading-snug mb-2">
          {mod.title}
        </h3>

        {mod.description && (
          <p className="text-[#8a9e8f] text-xs line-clamp-1 mb-3">{mod.description}</p>
        )}

        <div className="flex items-center justify-between text-[11px] text-[#8a9e8f]">
          <span>{mod.total_lessons} {mod.total_lessons === 1 ? 'aula' : 'aulas'}</span>
          {mod.progress === 100 && (
            <span className="flex items-center gap-1 text-green-400 font-medium">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
              Concluído
            </span>
          )}
          {mod.progress > 0 && mod.progress < 100 && (
            <span className="text-[#c9a84c] font-medium">{mod.progress}%</span>
          )}
        </div>

        {/* Progress bar */}
        {(mod.progress > 0 || highlight) && mod.progress < 100 && (
          <div className="mt-3 w-full h-1.5 bg-[#1f3d25] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#c9a84c] rounded-full transition-all duration-700 ease-out"
              style={{ width: `${mod.progress}%` }}
            />
          </div>
        )}
        {highlight && mod.progress > 0 && mod.progress < 100 && (
          <p className="text-[10px] text-[#c9a84c] mt-1.5 font-medium">{mod.progress}% concluído</p>
        )}
      </div>
    </Link>
  )
}
