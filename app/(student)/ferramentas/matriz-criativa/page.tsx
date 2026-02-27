import ComingSoonPage from '@/components/student/ComingSoonPage'

export default function MatrizCriativaPage() {
  return (
    <ComingSoonPage
      title="Matriz Criativa"
      description="Organize seus ângulos de copy, formatos de anúncio e variações criativas em uma matriz visual. Nunca mais fique sem ideias para escalar."
      icon={
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
        </svg>
      }
    />
  )
}
