export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base px-4">
      {/* Gradiente de fundo decorativo */}
      <div
        className="fixed inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% -10%, rgba(236,162,6,0.12) 0%, transparent 70%)',
        }}
      />
      <div className="w-full max-w-md relative z-10">
        {/* Logo / Nome da marca */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="BrandLegacy" className="h-14 w-auto mx-auto" />
          <p className="text-text-secondary text-sm mt-2">Área de Membros</p>
        </div>
        {children}
      </div>
    </div>
  )
}
