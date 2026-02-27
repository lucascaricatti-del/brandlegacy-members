'use client'

import { useState, useTransition } from 'react'

interface LogEntry {
  id: string
  workspace_name: string
  agent_type: string
  summary: string | null
  cards_found: number
  email_sent: boolean
  created_at: string
}

interface Props {
  logs: LogEntry[]
}

export default function AgentLogsClient({ logs }: Props) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleRunNow() {
    setError(null)
    setResult(null)
    startTransition(async () => {
      try {
        const cronSecret = prompt('Digite o CRON_SECRET para executar o agente:')
        if (!cronSecret) return

        const res = await fetch('/api/agents/overdue', {
          headers: { Authorization: `Bearer ${cronSecret}` },
        })

        const data = await res.json()

        if (!res.ok) {
          setError(data.error ?? `Erro ${res.status}`)
        } else {
          setResult(`Executado! ${data.processed ?? 0} workspace(s) processado(s).`)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro de rede')
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Run now */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleRunNow}
          disabled={isPending}
          className="
            flex items-center gap-2 px-4 py-2.5 rounded-xl
            bg-brand-gold text-bg-base text-sm font-medium
            hover:bg-brand-gold-light transition-colors
            disabled:opacity-60
          "
        >
          {isPending ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Executando...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Rodar agora
            </>
          )}
        </button>

        {result && (
          <span className="text-sm text-green-400 bg-green-400/10 px-3 py-1.5 rounded-lg">
            {result}
          </span>
        )}
        {error && (
          <span className="text-sm text-red-400 bg-red-400/10 px-3 py-1.5 rounded-lg">
            {error}
          </span>
        )}
      </div>

      {/* Agent info card */}
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-brand-gold/15 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-gold">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Verificador de Cards Vencidos</h3>
            <p className="text-xs text-text-muted">overdue_checker — executa diariamente às 9h (UTC)</p>
          </div>
        </div>
        <p className="text-xs text-text-secondary leading-relaxed">
          Busca cards do Kanban com prazo vencido em todos os workspaces ativos.
          Gera email personalizado com IA e envia para o owner do workspace via Resend.
        </p>
      </div>

      {/* Logs table */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">
            Histórico de Execuções
          </h2>
        </div>

        {logs.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-8">
            Nenhuma execução registrada ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-text-muted border-b border-border">
                  <th className="px-5 py-2.5 font-medium">Data</th>
                  <th className="px-5 py-2.5 font-medium">Workspace</th>
                  <th className="px-5 py-2.5 font-medium text-center">Cards</th>
                  <th className="px-5 py-2.5 font-medium text-center">Email</th>
                  <th className="px-5 py-2.5 font-medium">Resumo</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-border/50 hover:bg-bg-surface/30 transition-colors">
                    <td className="px-5 py-3 text-text-secondary whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-3 text-text-primary font-medium">
                      {log.workspace_name}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`
                        inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded text-xs font-semibold
                        ${log.cards_found > 0 ? 'bg-red-400/15 text-red-400' : 'bg-bg-surface text-text-muted'}
                      `}>
                        {log.cards_found}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      {log.email_sent ? (
                        <span className="inline-flex items-center gap-1 text-green-400 text-xs">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Enviado
                        </span>
                      ) : (
                        <span className="text-text-muted text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-text-muted text-xs max-w-[300px] truncate">
                      {log.summary ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
