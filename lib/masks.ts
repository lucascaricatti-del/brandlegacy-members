/**
 * R$ mask: formats as Brazilian currency while typing
 * Input receives raw keystrokes, outputs formatted string like "R$ 1.234,56"
 */
export function maskBRL(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits || digits === '0') return ''
  const number = parseInt(digits) / 100
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(number)
}

export function unmaskBRL(masked: string): number {
  const clean = masked.replace(/[R$\s.]/g, '').replace(',', '.')
  return parseFloat(clean) || 0
}

/**
 * Format a raw number into BRL display string (for pre-filling inputs)
 */
export function numberToBRL(value: number): string {
  if (!value || value === 0) return ''
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value)
}

/**
 * % mask: allows digits with up to 2 decimal places
 */
export function maskPct(raw: string): string {
  const clean = raw.replace(/[^0-9,\.]/g, '')
  const normalized = clean.replace(',', '.')
  const parts = normalized.split('.')
  if (parts.length > 2) return raw.slice(0, -1)
  if (parts[1]?.length > 2) return raw.slice(0, -1)
  return clean
}

export function unmaskPct(value: string): number {
  return parseFloat(value.replace(',', '.')) || 0
}

/**
 * Format a raw number into PCT display string (for pre-filling inputs)
 */
export function numberToPct(value: number): string {
  if (!value || value === 0) return ''
  return value.toFixed(2).replace('.', ',')
}

/**
 * Format number for display (legacy helpers)
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
