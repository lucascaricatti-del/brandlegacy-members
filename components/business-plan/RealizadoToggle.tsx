'use client'

export function RealizadoToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border"
      style={{
        borderColor: show ? '#c9971a' : 'rgba(201,151,26,0.3)',
        background: show ? 'rgba(201,151,26,0.1)' : 'transparent',
        color: show ? '#c9a84c' : 'rgba(201,151,26,0.6)',
      }}
    >
      <span style={{ fontSize: 12 }}>{show ? '\uD83D\uDE48' : '\uD83D\uDCCA'}</span>
      {show ? 'Ocultar Realizado' : 'Ver Realizado'}
    </button>
  )
}
