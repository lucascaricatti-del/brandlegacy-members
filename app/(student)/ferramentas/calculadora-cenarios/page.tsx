import ComingSoonPage from '@/components/student/ComingSoonPage'

export default function CalculadoraCenariosPage() {
  return (
    <ComingSoonPage
      title="Calculadora de Cenários"
      description="Compare cenários otimista, realista e conservador para sua DNVB. Simule variações de ticket médio, CAC e LTV para tomar decisões com clareza."
      icon={
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="8" y1="10" x2="10" y2="10" /><line x1="14" y1="10" x2="16" y2="10" /><line x1="8" y1="14" x2="10" y2="14" /><line x1="14" y1="14" x2="16" y2="14" /><line x1="8" y1="18" x2="16" y2="18" />
        </svg>
      }
    />
  )
}
