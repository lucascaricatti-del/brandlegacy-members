import { redirect } from 'next/navigation'

export default function PlanejamentoMidiaPage() {
  const currentYear = new Date().getFullYear()
  redirect(`/ferramentas/planejamento-midia/${currentYear}`)
}
