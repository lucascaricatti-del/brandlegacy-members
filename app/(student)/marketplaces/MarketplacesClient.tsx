'use client'

import { useState } from 'react'

type Integration = {
  id: string
  provider: string
  account_id: string | null
  account_name: string | null
  status: string
  metadata: any
  updated_at: string
}

const MARKETPLACES = [
  {
    id: 'mercadolivre',
    name: 'Mercado Livre',
    description: 'Pedidos, receita líquida, taxas marketplace, reclamações e reputação.',
    color: '#FFE600',
    textColor: '#2D3277',
    icon: 'ML',
    oauth: true,
  },
  {
    id: 'shopee',
    name: 'Shopee',
    description: 'Pedidos, receita, taxas de comissão e métricas de loja.',
    color: '#EE4D2D',
    textColor: '#fff',
    icon: 'SP',
    comingSoon: true,
  },
  {
    id: 'magalu',
    name: 'Magalu',
    description: 'Pedidos, faturamento e performance no marketplace.',
    color: '#0086FF',
    textColor: '#fff',
    icon: 'MG',
    comingSoon: true,
  },
  {
    id: 'netshoes',
    name: 'Netshoes',
    description: 'Pedidos, receita e métricas de operação esportiva.',
    color: '#000000',
    textColor: '#fff',
    icon: 'NS',
    comingSoon: true,
  },
]

export default function MarketplacesClient({
  workspaceId,
  integrations,
}: {
  workspaceId: string
  integrations: Integration[]
}) {
  const connectedMap = new Map(integrations.map((i) => [i.provider, i]))

  return (
    <div className="grid gap-4">
      {MARKETPLACES.map((mp) => (
        <MarketplaceCard
          key={mp.id}
          marketplace={mp}
          workspaceId={workspaceId}
          connected={connectedMap.get(mp.id) ?? null}
        />
      ))}
    </div>
  )
}

function MarketplaceCard({
  marketplace,
  workspaceId,
  connected,
}: {
  marketplace: (typeof MARKETPLACES)[number]
  workspaceId: string
  connected: Integration | null
}) {
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const isConnected = connected?.status === 'active'

  async function handleConnect() {
    if (marketplace.id === 'mercadolivre') {
      window.location.href = `/api/integrations/mercadolivre/auth?workspace_id=${workspaceId}`
      return
    }
  }

  async function handleSync() {
    setSyncing(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/integrations/${marketplace.id}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, days: 30 }),
      })
      const data = await res.json()
      if (data.error) setMessage({ type: 'error', text: data.error })
      else setMessage({ type: 'success', text: `${data.synced} pedidos sincronizados!` })
    } catch {
      setMessage({ type: 'error', text: 'Erro ao sincronizar.' })
    }
    setSyncing(false)
  }

  async function handleDisconnect() {
    if (!confirm(`Desconectar ${marketplace.name}? Dados de métricas serão removidos.`)) return
    setMessage(null)
    try {
      const res = await fetch('/api/integrations/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, provider: marketplace.id }),
      })
      const data = await res.json()
      if (data.error) setMessage({ type: 'error', text: data.error })
      else window.location.reload()
    } catch {
      setMessage({ type: 'error', text: 'Erro ao desconectar.' })
    }
  }

  return (
    <div className="bg-bg-card border border-border rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm"
            style={{ backgroundColor: marketplace.color, color: marketplace.textColor }}
          >
            {marketplace.icon}
          </div>
          <div>
            <h3 className="text-text-primary font-semibold">{marketplace.name}</h3>
            <p className="text-text-muted text-sm">{marketplace.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {marketplace.comingSoon ? (
            <span className="text-xs px-2.5 py-1 rounded-full bg-bg-surface text-text-muted font-medium border border-border">
              Em breve
            </span>
          ) : isConnected ? (
            <span className="text-xs px-2.5 py-1 rounded-full bg-success/15 text-success font-medium">
              Conectado
            </span>
          ) : (
            <span className="text-xs px-2.5 py-1 rounded-full bg-bg-surface text-text-muted font-medium border border-border">
              Não conectado
            </span>
          )}
        </div>
      </div>

      {/* Connected info */}
      {isConnected && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {connected.account_name && (
              <span className="text-text-secondary">
                <span className="text-text-muted">Vendedor:</span> {connected.account_name}
                {connected.account_id && <span className="text-text-muted ml-1">({connected.account_id})</span>}
              </span>
            )}
            {connected.updated_at && (
              <span className="text-text-secondary">
                <span className="text-text-muted">Última sync:</span>{' '}
                {new Date(connected.updated_at).toLocaleDateString('pt-BR', {
                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                })}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-3 py-1.5 text-sm rounded-lg bg-brand-gold text-bg-base font-medium hover:bg-brand-gold-light transition-colors disabled:opacity-50"
            >
              {syncing ? 'Sincronizando...' : 'Sincronizar'}
            </button>
            <button
              onClick={handleConnect}
              className="px-3 py-1.5 text-sm rounded-lg border border-border text-text-secondary hover:bg-bg-hover transition-colors"
            >
              Reconectar
            </button>
            <button
              onClick={handleDisconnect}
              className="px-3 py-1.5 text-sm rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Desconectar
            </button>
          </div>
        </div>
      )}

      {/* Connect button */}
      {!connected && !marketplace.comingSoon && (
        <div className="mt-4">
          <button
            onClick={handleConnect}
            className="px-4 py-2 text-sm rounded-lg bg-brand-gold text-bg-base font-medium hover:bg-brand-gold-light transition-colors"
          >
            Conectar {marketplace.name}
          </button>
        </div>
      )}

      {/* Message */}
      {message && (
        <div className={`mt-3 text-sm px-3 py-2 rounded-lg ${
          message.type === 'success' ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
        }`}>
          {message.text}
        </div>
      )}
    </div>
  )
}
