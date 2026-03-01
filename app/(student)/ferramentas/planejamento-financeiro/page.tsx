import { redirect } from 'next/navigation'

export default function PlanejamentoFinanceiroPage() {
  const currentYear = new Date().getFullYear()
  redirect(`/ferramentas/planejamento-financeiro/${currentYear}`)
}
