/**
 * R$ mask: formats as Brazilian currency while typing
 */
export function maskBRL(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  const number = parseInt(digits) / 100
  return number.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  })
}

export function unmaskBRL(masked: string): number {
  const clean = masked.replace(/[R$\s.]/g, '').replace(',', '.')
  return parseFloat(clean) || 0
}

/**
 * % mask: allows 0-100 with up to 2 decimals
 */
export function maskPct(value: string): string {
  const clean = value.replace(/[^0-9,\.]/g, '')
  const parts = clean.split(/[,\.]/)
  if (parts.length > 2) return clean.slice(0, -1)
  if (parts[1]?.length > 2) return clean.slice(0, -1)
  return clean
}

export function unmaskPct(value: string): number {
  return parseFloat(value.replace(',', '.')) || 0
}

/**
 * Format a raw number for display
 */
export function formatBRL(value: number): string {
  if (value === 0) return 'R$ 0,00'
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

export function formatPct(value: number, decimals = 1): string {
  return `${value.toFixed(decimals).replace('.', ',')}%`
}
