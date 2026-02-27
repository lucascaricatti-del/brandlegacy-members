import ComingSoonPage from '@/components/student/ComingSoonPage'

export default function PlanejamentoMidiaPage() {
  return (
    <ComingSoonPage
      title="Planejamento de Mídia"
      description="Distribua seu budget de mídia paga entre canais, simule ROAS por plataforma e encontre o mix ideal para escalar suas campanhas."
      icon={
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      }
    />
  )
}
