export default function Loading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 rounded w-1/3" style={{ background: 'rgba(255,255,255,0.05)' }} />
      <div className="h-4 rounded w-2/3" style={{ background: 'rgba(255,255,255,0.03)' }} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-28 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }} />
        ))}
      </div>
      <div className="h-64 rounded-xl mt-4" style={{ background: 'rgba(255,255,255,0.03)' }} />
    </div>
  )
}
