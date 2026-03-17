/**
 * Date utilities — America/Sao_Paulo timezone
 *
 * Todas as datas de negócio devem usar Brasília (UTC-3).
 * Timestamps de auditoria (updated_at, created_at) continuam em UTC — isso é correto.
 */

/** Returns YYYY-MM-DD in America/Sao_Paulo timezone */
export function toBrazilDate(d: Date = new Date()): string {
  return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}

/** Returns ISO start-of-day in Brasília: "YYYY-MM-DDT00:00:00-03:00" */
export function brazilDayStart(dateStr: string): string {
  return `${dateStr}T00:00:00-03:00`
}

/** Returns ISO end-of-day in Brasília: "YYYY-MM-DDT23:59:59-03:00" */
export function brazilDayEnd(dateStr: string): string {
  return `${dateStr}T23:59:59-03:00`
}
