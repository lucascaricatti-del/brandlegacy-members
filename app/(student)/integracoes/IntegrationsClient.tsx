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

const PLATFORMS = [
  {
    id: 'meta_ads',
    name: 'Meta Ads',
    description: 'Facebook & Instagram Ads — métricas de campanhas, ROAS, CPA.',
    color: '#1877F2',
    oauth: true,
  },
  {
    id: 'google_ads',
    name: 'Google Ads',
    description: 'Campanhas de Google Search, Display e YouTube.',
    color: '#4285F4',
    oauth: true,
  },
  {
    id: 'shopify',
    name: 'Shopify',
    description: 'Pedidos, receita, ticket médio e métricas de e-commerce.',
    color: '#96BF48',
    oauth: false,
    needsShop: true,
    needsToken: true,
  },
  {
    id: 'ga4',
    name: 'Google Analytics 4',
    description: 'Sessões, usuários e comportamento do site.',
    color: '#E37400',
    oauth: false,
    comingSoon: true,
  },
]

export default function IntegrationsClient({
  workspaceId,
  integrations,
}: {
  workspaceId: string
  integrations: Integration[]
}) {
  const connectedMap = new Map(integrations.map((i) => [i.provider, i]))

  return (
    <div className="grid gap-4">
      {PLATFORMS.map((platform) => (
        <PlatformCard
          key={platform.id}
          platform={platform}
          workspaceId={workspaceId}
          connected={connectedMap.get(platform.id) ?? null}
        />
      ))}
    </div>
  )
}

function PlatformCard({
  platform,
  workspaceId,
  connected,
}: {
  platform: (typeof PLATFORMS)[number]
  workspaceId: string
  connected: Integration | null
}) {
  const [syncing, setSyncing] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showAccounts, setShowAccounts] = useState(false)
  const [shopDomain, setShopDomain] = useState('')
  const [shopToken, setShopToken] = useState('')

  const isConnected = connected?.status === 'active'
  const accounts: any[] = connected?.metadata?.accounts ?? []

  async function handleConnect() {
    if (platform.id === 'shopify') {
      if (!shopDomain.trim()) { setMessage({ type: 'error', text: 'Informe o domínio da loja.' }); return }
      if (!shopToken.trim()) { setMessage({ type: 'error', text: 'Informe o Access Token.' }); return }
      setConnecting(true); setMessage(null)
      try {
        const res = await fetch('/api/integrations/shopify/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspace_id: workspaceId, domain: shopDomain.trim(), access_token: shopToken.trim() }),
        })
        const data = await res.json()
        if (data.error) { setMessage({ type: 'error', text: data.error }) }
        else { setMessage({ type: 'success', text: `Loja ${data.shop_name} conectada!` }); window.location.reload() }
      } catch { setMessage({ type: 'error', text: 'Erro ao conectar.' }) }
      setConnecting(false)
      return
    }
    const provider = platform.id === 'google_ads' ? 'google-ads' : 'meta'
    window.location.href = `/api/integrations/${provider}/connect?workspace_id=${workspaceId}`
  }

  async function handleSync() {
    setSyncing(true); setMessage(null)
    try {
      const provider = platform.id === 'google_ads' ? 'google-ads' : platform.id === 'shopify' ? 'shopify' : 'meta'
      const res = await fetch(`/api/integrations/${provider}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          date_from: new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0],
          date_to: new Date().toISOString().split('T')[0],
        }),
      })
      const data = await res.json()
      if (data.error) setMessage({ type: 'error', text: data.error })
      else setMessage({ type: 'success', text: `${data.synced} registros sincronizados!` })
    } catch {
      setMessage({ type: 'error', text: 'Erro ao sincronizar.' })
    }
    setSyncing(false)
  }

  async function handleSelectAccount(accountId: string, accountName: string) {
    try {
      const provider = platform.id === 'google_ads' ? 'google-ads' : 'meta'
      const res = await fetch(`/api/integrations/${provider}/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, account_id: accountId, account_name: accountName }),
      })
      const data = await res.json()
      if (data.error) setMessage({ type: 'error', text: data.error })
      else {
        setMessage({ type: 'success', text: `Conta ${accountName} selecionada!` })
        setShowAccounts(false)
        window.location.reload()
      }
    } catch {
      setMessage({ type: 'error', text: 'Erro ao selecionar conta.' })
    }
  }

  async function handleDisconnect() {
    if (!confirm(`Desconectar ${platform.name}? Dados de métricas serão removidos.`)) return
    setMessage(null)
    try {
      const res = await fetch('/api/integrations/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, provider: platform.id }),
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
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ backgroundColor: platform.color }}>
            {platform.name[0]}
          </div>
          <div>
            <h3 className="text-text-primary font-semibold">{platform.name}</h3>
            <p className="text-text-muted text-sm">{platform.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {platform.comingSoon ? (
            <span className="text-xs px-2.5 py-1 rounded-full bg-bg-surface text-text-muted font-medium border border-border">
              Em breve
            </span>
          ) : isConnected ? (
            <span className="text-xs px-2.5 py-1 rounded-full bg-success/15 text-success font-medium">
              Conectado
            </span>
          ) : connected ? (
            <span className="text-xs px-2.5 py-1 rounded-full bg-yellow-500/15 text-yellow-400 font-medium">
              Selecione uma conta
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
                <span className="text-text-muted">Conta:</span> {connected.account_name}
                {connected.account_id && <span className="text-text-muted ml-1">({connected.account_id})</span>}
              </span>
            )}
            {connected.updated_at && (
              <span className="text-text-secondary">
                <span className="text-text-muted">Atualizado:</span>{' '}
                {new Date(connected.updated_at).toLocaleDateString('pt-BR', {
                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                })}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={handleSync} disabled={syncing}
              className="px-3 py-1.5 text-sm rounded-lg bg-brand-gold text-bg-base font-medium hover:bg-brand-gold-light transition-colors disabled:opacity-50">
              {syncing ? 'Sincronizando...' : '🔄 Sincronizar'}
            </button>
            {accounts.length > 1 && (
              <button onClick={() => setShowAccounts(!showAccounts)}
                className="px-3 py-1.5 text-sm rounded-lg border border-border text-text-secondary hover:bg-bg-hover transition-colors">
                Trocar conta
              </button>
            )}
            <button onClick={handleConnect}
              className="px-3 py-1.5 text-sm rounded-lg border border-border text-text-secondary hover:bg-bg-hover transition-colors">
              Reconectar
            </button>
            <button onClick={handleDisconnect}
              className="px-3 py-1.5 text-sm rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">
              Desconectar
            </button>
          </div>
        </div>
      )}

      {/* Account selector */}
      {(showAccounts || (connected && !isConnected && accounts.length > 0)) && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-sm text-text-secondary mb-3">Selecione a conta de anúncio:</p>
          <div className="grid gap-2">
            {accounts.map((acc: any) => (
              <button key={acc.account_id}
                onClick={() => handleSelectAccount(acc.account_id, acc.name)}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                  connected?.account_id === acc.account_id
                    ? 'border-brand-gold bg-brand-gold/10'
                    : 'border-border hover:bg-bg-hover'
                }`}>
                <div>
                  <p className="text-sm font-medium text-text-primary">{acc.name}</p>
                  <p className="text-xs text-text-muted">ID: {acc.account_id} · {acc.currency}</p>
                </div>
                {connected?.account_id === acc.account_id && (
                  <span className="text-xs text-brand-gold font-medium">Ativa</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Connect button — OAuth platforms */}
      {!connected && !platform.comingSoon && platform.oauth && (
        <div className="mt-4">
          <button onClick={handleConnect}
            className="px-4 py-2 text-sm rounded-lg bg-brand-gold text-bg-base font-medium hover:bg-brand-gold-light transition-colors">
            Conectar {platform.name}
          </button>
        </div>
      )}

      {/* Connect — Shopify (token-based) */}
      {!connected && !platform.comingSoon && (platform as any).needsToken && (
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">Dominio da loja</label>
            <input
              type="text"
              value={shopDomain}
              onChange={e => setShopDomain(e.target.value)}
              placeholder="minha-loja.myshopify.com"
              className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Access Token (Admin API)</label>
            <input
              type="password"
              value={shopToken}
              onChange={e => setShopToken(e.target.value)}
              placeholder="shpat_..."
              className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
            />
          </div>
          <p className="text-xs text-text-muted">
            Crie um app privado em Shopify Admin &gt; Settings &gt; Apps &gt; Develop apps. Ative os escopos <strong className="text-text-secondary">read_orders</strong> e <strong className="text-text-secondary">read_analytics</strong>.
          </p>
          <button onClick={handleConnect} disabled={connecting}
            className="px-4 py-2 text-sm rounded-lg bg-brand-gold text-bg-base font-medium hover:bg-brand-gold-light transition-colors disabled:opacity-50">
            {connecting ? 'Conectando...' : 'Conectar Shopify'}
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
