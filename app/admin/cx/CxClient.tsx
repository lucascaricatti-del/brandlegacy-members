'use client'

import { useState, useTransition } from 'react'
import { analyzeWorkspaceHealth, type WorkspaceHealth } from '@/app/actions/cx'

const STATUS_CONFIG: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  em_dia: { label: 'Em dia', emoji: '🟢', color: 'text-green-400', bg: 'bg-green-400/15' },
  atencao: { label: 'Atenção', emoji: '🟡', color: 'text-yellow-400', bg: 'bg-yellow-400/15' },
  churn: { label: 'Risco de churn', emoji: '🔴', color: 'text-red-400', bg: 'bg-red-400/15' },
}

function getRenewalBadge(dateStr: string | null) {
  if (!dateStr) return null
  const today = new Date()
  const renewal = new Date(dateStr + 'T12:00:00')
  const diffDays = Math.ceil((renewal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  const color = diffDays < 15 ? 'text-red-400 bg-red-400/15' : diffDays <= 30 ? 'text-yellow-400 bg-yellow-400/15' : 'text-green-400 bg-green-400/15'
  const label = diffDays <= 0 ? 'Vencido' : `Renova em ${diffDays}d`
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${color}`}>{label}</span>
}

export default function CxClient({ initialData }: { initialData: WorkspaceHealth[] }) {
  const [data, setData] = useState(initialData)
  const [drawerWs, setDrawerWs] = useState<WorkspaceHealth | null>(null)
  const [isPending, startTransition] = useTransition()
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)

  const statusOrder = { churn: 0, atencao: 1, em_dia: 2 }
  const sorted = [...data].sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9))

  const counts = {
    em_dia: data.filter((d) => d.status === 'em_dia').length,
    atencao: data.filter((d) => d.status === 'atencao').length,
    churn: data.filter((d) => d.status === 'churn').length,
  }

  function handleAnalyze(wsId: string) {
    setAnalyzingId(wsId)
    startTransition(async () => {
      const result = await analyzeWorkspaceHealth(wsId)
      if ('error' in result) {
        alert(result.error)
      } else {
        setData((prev) => prev.map((w) => (w.workspace_id === wsId ? result : w)))
        setDrawerWs(result)
      }
      setAnalyzingId(null)
    })
  }

  function handleAnalyzeAll() {
    startTransition(async () => {
      for (const ws of data) {
        setAnalyzingId(ws.workspace_id)
        const result = await analyzeWorkspaceHealth(ws.workspace_id)
        if (!('error' in result)) {
          setData((prev) => prev.map((w) => (w.workspace_id === ws.workspace_id ? result : w)))
        }
      }
      setAnalyzingId(null)
    })
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-bg-card border border-border rounded-xl p-4">
          <p className="text-text-muted text-xs font-medium mb-1">Em dia</p>
          <p className="text-2xl font-bold text-green-400">{counts.em_dia}</p>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-4">
          <p className="text-text-muted text-xs font-medium mb-1">Atenção</p>
          <p className="text-2xl font-bold text-yellow-400">{counts.atencao}</p>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-4">
          <p className="text-text-muted text-xs font-medium mb-1">Risco de Churn</p>
          <p className="text-2xl font-bold text-red-400">{counts.churn}</p>
        </div>
      </div>

      {/* Analyze all button */}
      <div className="flex justify-end">
        <button
          onClick={handleAnalyzeAll}
          disabled={isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-gold text-bg-base text-sm font-medium hover:bg-brand-gold-light transition-colors disabled:opacity-60"
        >
          {isPending ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Analisando...
            </>
          ) : (
            'Analisar todos com IA'
          )}
        </button>
      </div>

      {/* Workspace list */}
      {sorted.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-xl p-12 text-center">
          <p className="text-text-muted">Nenhum workspace ativo encontrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((ws) => {
            const cfg = STATUS_CONFIG[ws.status] ?? STATUS_CONFIG.em_dia
            return (
              <div key={ws.workspace_id} className="bg-bg-card border border-border rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span>{cfg.emoji}</span>
                      <h3 className="text-sm font-semibold text-text-primary">{ws.workspace_name}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      {getRenewalBadge(ws.renewal_date)}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted mt-2">
                      <span>
                        Última sessão:{' '}
                        {ws.last_session_date
                          ? new Date(ws.last_session_date).toLocaleDateString('pt-BR')
                          : 'Nunca'}
                      </span>
                      <span>Tarefas: {ws.completed_tasks}/{ws.total_tasks}</span>
                      <span className={ws.overdue_tasks > 0 ? 'text-red-400' : ''}>
                        Atrasadas: {ws.overdue_tasks}
                      </span>
                      <span>
                        {ws.days_inactive === -1
                          ? 'Sem dados'
                          : `${ws.days_inactive}d sem movimentação`}
                      </span>
                    </div>
                    {ws.summary && (
                      <p className="text-xs text-text-secondary mt-2 bg-bg-surface/50 p-2 rounded-lg border border-border">
                        {ws.summary}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleAnalyze(ws.workspace_id)}
                      disabled={isPending}
                      className="px-3 py-1.5 text-xs rounded-lg border border-border text-text-secondary hover:bg-bg-hover transition-colors disabled:opacity-60"
                    >
                      {analyzingId === ws.workspace_id ? '...' : 'Analisar'}
                    </button>
                    <button
                      onClick={() => setDrawerWs(ws)}
                      className="px-3 py-1.5 text-xs rounded-lg bg-brand-gold/10 text-brand-gold border border-brand-gold/20 hover:bg-brand-gold/20 transition-colors"
                    >
                      Ver detalhes
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Drawer */}
      {drawerWs && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setDrawerWs(null)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-bg-card border-l border-border overflow-y-auto">
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-text-primary">{drawerWs.workspace_name}</h2>
                <button onClick={() => setDrawerWs(null)} className="text-text-muted hover:text-text-primary p-1">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Status */}
              {(() => {
                const cfg = STATUS_CONFIG[drawerWs.status] ?? STATUS_CONFIG.em_dia
                return (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${cfg.bg}`}>
                    <span className="text-lg">{cfg.emoji}</span>
                    <span className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</span>
                    {getRenewalBadge(drawerWs.renewal_date)}
                  </div>
                )
              })()}

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-bg-surface/50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-text-primary">{drawerWs.total_tasks}</p>
                  <p className="text-xs text-text-muted">Total tarefas</p>
                </div>
                <div className="bg-bg-surface/50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-green-400">{drawerWs.completed_tasks}</p>
                  <p className="text-xs text-text-muted">Concluídas</p>
                </div>
                <div className="bg-bg-surface/50 rounded-lg p-3 text-center">
                  <p className={`text-xl font-bold ${drawerWs.overdue_tasks > 0 ? 'text-red-400' : 'text-text-primary'}`}>
                    {drawerWs.overdue_tasks}
                  </p>
                  <p className="text-xs text-text-muted">Atrasadas</p>
                </div>
                <div className="bg-bg-surface/50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-text-primary">
                    {drawerWs.days_inactive === -1 ? '—' : `${drawerWs.days_inactive}d`}
                  </p>
                  <p className="text-xs text-text-muted">Inativo</p>
                </div>
              </div>

              {/* AI Analysis */}
              {drawerWs.summary && (
                <div>
                  <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Análise da IA</h3>
                  <p className="text-sm text-text-primary bg-bg-surface/50 p-3 rounded-lg border border-border">
                    {drawerWs.summary}
                  </p>
                </div>
              )}

              {drawerWs.recommendations.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Recomendações</h3>
                  <ul className="space-y-1.5">
                    {drawerWs.recommendations.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-text-primary">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-gold shrink-0" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!drawerWs.summary && (
                <div className="text-center py-4">
                  <p className="text-text-muted text-sm mb-3">Análise IA ainda não realizada.</p>
                  <button
                    onClick={() => handleAnalyze(drawerWs.workspace_id)}
                    disabled={isPending}
                    className="px-4 py-2 rounded-lg bg-brand-gold text-bg-base text-sm font-medium hover:bg-brand-gold-light transition-colors disabled:opacity-60"
                  >
                    Analisar com IA
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
