'use client'

interface VarianceBadgeProps {
  previsto: number
  realizado: number
  type: 'currency' | 'pct' | 'number' | 'roas'
  invertColor?: boolean
}

export function VarianceBadge({ previsto, realizado, type, invertColor }: VarianceBadgeProps) {
  if (realizado === 0) {
    return <span className="tabular-nums block" style={{ fontSize: 10, color: '#4a5a4f' }}>&mdash;</span>
  }

  const delta = realizado - previsto
  const pct = previsto !== 0 ? (delta / previsto) * 100 : 0

  // Determine color: positive delta is green unless invertColor (cost metrics: lower = better)
  const isPositive = delta > 0
  const isGreen = invertColor ? !isPositive : isPositive
  const color = delta === 0 ? '#6b7c6f' : isGreen ? '#4ade80' : '#ef4444'
  const arrow = delta > 0 ? '\u25B2' : delta < 0 ? '\u25BC' : ''

  function fmtDelta(): string {
    const abs = Math.abs(delta)
    const sign = delta > 0 ? '+' : '-'
    if (type === 'currency') {
      const formatted = abs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })
      return `${sign}${formatted}`
    }
    if (type === 'pct') return `${sign}${abs.toFixed(1).replace('.', ',')}pp`
    if (type === 'roas') return `${sign}${abs.toFixed(1)}x`
    return `${sign}${abs.toLocaleString('pt-BR')}`
  }

  const pctStr = previsto !== 0 ? `(${pct > 0 ? '+' : ''}${pct.toFixed(1).replace('.', ',')}%)` : ''

  return (
    <span className="tabular-nums block whitespace-nowrap" style={{ fontSize: 10, color }}>
      {arrow} {fmtDelta()} {type !== 'pct' && pctStr}
    </span>
  )
}
