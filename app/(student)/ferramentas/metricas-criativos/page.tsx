import ComingSoonPage from '@/components/student/ComingSoonPage'

export default function MetricasCriativosPage() {
  return (
    <ComingSoonPage
      title="Métricas de Criativos"
      description="Acompanhe CTR, hook rate, hold rate e CPA dos seus criativos em um dashboard visual. Identifique winners e elimine fadiga criativa rapidamente."
      icon={
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" />
        </svg>
      }
    />
  )
}
