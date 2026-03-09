import { redirect } from 'next/navigation'

export default function ForecastPage() {
  const currentYear = new Date().getFullYear()
  redirect(`/ferramentas/forecast/${currentYear}`)
}
