'use client'

interface Props {
  title: string
  description: string
  icon: React.ReactNode
}

export default function ComingSoonPage({ title, description, icon }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-fade-in">
      {/* Glow background */}
      <div className="relative mb-8">
        <div className="absolute inset-0 -m-8 rounded-full bg-brand-gold/5 blur-2xl" />
        <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-bg-surface to-bg-card border border-border flex items-center justify-center">
          <span className="text-brand-gold">{icon}</span>
        </div>
      </div>

      <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-3">{title}</h1>

      <span className="inline-block text-[10px] px-3 py-1 rounded-full bg-brand-gold/15 text-brand-gold font-bold tracking-wider uppercase mb-4">
        Em Breve
      </span>

      <p className="text-text-secondary text-sm md:text-base max-w-md leading-relaxed mb-8">
        {description}
      </p>

      <button
        disabled
        className="px-6 py-3 rounded-xl bg-bg-surface border border-border text-text-muted text-sm font-medium cursor-not-allowed opacity-60"
      >
        Disponível em breve
      </button>
    </div>
  )
}
