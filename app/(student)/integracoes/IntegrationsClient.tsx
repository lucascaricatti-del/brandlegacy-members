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
    id: 'yampi',
    name: 'Yampi',
    description: 'Checkout, pedidos, aprovação PIX e métricas de conversão.',
    color: '#6C2BD9',
    oauth: false,
    oneClick: true,
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
    description: 'Sessões orgânicas e pagas para taxa de conversão real.',
    color: '#E37400',
    oauth: false,
    isGa4: true,
  },
]

const MARKETPLACES = [
  {
    id: 'mercadolivre',
    name: 'Mercado Livre',
    description: 'Pedidos, receita líquida, taxas marketplace, reclamações e reputação.',
    color: '#FFE600',
    textColor: '#2D3277',
    icon: 'ML',
    isMarketplace: true,
    oauth: true,
  },
  {
    id: 'shopee',
    name: 'Shopee',
    description: 'Pedidos, receita, taxas de comissão e métricas de loja.',
    color: '#EE4D2D',
    textColor: '#fff',
    icon: 'SP',
    isMarketplace: true,
    comingSoon: true,
  },
  {
    id: 'magalu',
    name: 'Magalu',
    description: 'Pedidos, faturamento e performance no marketplace.',
    color: '#0086FF',
    textColor: '#fff',
    icon: 'MG',
    isMarketplace: true,
    comingSoon: true,
  },
  {
    id: 'netshoes',
    name: 'Netshoes',
    description: 'Pedidos, receita e métricas de operação esportiva.',
    color: '#000000',
    textColor: '#fff',
    icon: 'NS',
    isMarketplace: true,
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
  // GA4 uses the google_ads integration (shared OAuth token)
  const googleIntegration = connectedMap.get('google_ads') ?? null

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-4">Plataformas de Anúncios</h2>
        <div className="grid gap-4">
          {PLATFORMS.map((platform) => (
            <PlatformCard
              key={platform.id}
              platform={platform}
              workspaceId={workspaceId}
              connected={(platform as any).isGa4 ? googleIntegration : connectedMap.get(platform.id) ?? null}
            />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-4">Marketplaces</h2>
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
      </div>
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
  // GA4 state
  const [ga4Properties, setGa4Properties] = useState<{ property_id: string; display_name: string; account_name: string }[]>([])
  const [loadingProperties, setLoadingProperties] = useState(false)
  const [selectedProperty, setSelectedProperty] = useState('')

  const isGa4 = !!(platform as any).isGa4
  const isConnected = isGa4
    ? !!(connected?.status === 'active' && connected?.metadata?.ga4_property_id)
    : connected?.status === 'active'
  const ga4NeedsReconnect = isGa4 && connected?.status === 'active' && !connected?.metadata?.ga4_connected
  const ga4NeedsProperty = isGa4 && connected?.status === 'active' && connected?.metadata?.ga4_connected && !connected?.metadata?.ga4_property_id
  const accounts: any[] = connected?.metadata?.accounts ?? []

  async function handleConnect() {
    if (platform.id === 'yampi') {
      setConnecting(true); setMessage(null)
      try {
        const res = await fetch('/api/integrations/yampi/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspace_id: workspaceId }),
        })
        const data = await res.json()
        if (data.error) { setMessage({ type: 'error', text: data.error }) }
        else { setMessage({ type: 'success', text: 'Yampi conectada!' }); window.location.reload() }
      } catch { setMessage({ type: 'error', text: 'Erro ao conectar.' }) }
      setConnecting(false)
      return
    }
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
    // GA4 reconnect = same as google-ads connect (shared OAuth)
    const provider = (platform.id === 'google_ads' || isGa4) ? 'google-ads' : 'meta'
    window.location.href = `/api/integrations/${provider}/connect?workspace_id=${workspaceId}`
  }

  async function handleSync() {
    setSyncing(true); setMessage(null)
    try {
      let url: string
      if (isGa4) {
        url = '/api/integrations/ga4/sync'
      } else {
        const provider = platform.id === 'google_ads' ? 'google-ads' : platform.id === 'shopify' ? 'shopify' : platform.id === 'yampi' ? 'yampi' : 'meta'
        url = `/api/integrations/${provider}/sync`
      }
      const res = await fetch(url, {
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
      else {
        const count = data.synced ?? data.synced_days ?? 0
        setMessage({ type: 'success', text: `${count} ${isGa4 ? 'dias' : 'registros'} sincronizados!` })
      }
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

  async function handleLoadGa4Properties() {
    setLoadingProperties(true); setMessage(null)
    try {
      const res = await fetch(`/api/integrations/ga4/properties?workspace_id=${workspaceId}`)
      const data = await res.json()
      if (data.error) {
        setMessage({ type: 'error', text: data.error })
        if (data.needs_reconnect) {
          setMessage({ type: 'error', text: 'Reconecte o Google para autorizar acesso ao GA4.' })
        }
      } else {
        setGa4Properties(data.properties || [])
        if (data.properties?.length === 0) {
          setMessage({ type: 'error', text: 'Nenhuma propriedade GA4 encontrada nesta conta Google.' })
        }
      }
    } catch {
      setMessage({ type: 'error', text: 'Erro ao buscar propriedades.' })
    }
    setLoadingProperties(false)
  }

  async function handleSelectGa4Property(propertyId: string, propertyName: string) {
    setMessage(null)
    try {
      const res = await fetch('/api/integrations/ga4/select-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, property_id: propertyId, property_name: propertyName }),
      })
      const data = await res.json()
      if (data.error) setMessage({ type: 'error', text: data.error })
      else {
        setMessage({ type: 'success', text: `Propriedade ${propertyName} selecionada!` })
        window.location.reload()
      }
    } catch {
      setMessage({ type: 'error', text: 'Erro ao selecionar propriedade.' })
    }
  }

  return (
    <div className="bg-bg-card border border-border rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ backgroundColor: platform.color }}>
            {isGa4 ? 'GA' : platform.name[0]}
          </div>
          <div>
            <h3 className="text-text-primary font-semibold">{platform.name}</h3>
            <p className="text-text-muted text-sm">{platform.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(platform as any).comingSoon ? (
            <span className="text-xs px-2.5 py-1 rounded-full bg-bg-surface text-text-muted font-medium border border-border">
              Em breve
            </span>
          ) : isConnected ? (
            <span className="text-xs px-2.5 py-1 rounded-full bg-success/15 text-success font-medium">
              Conectado
            </span>
          ) : ga4NeedsReconnect ? (
            <span className="text-xs px-2.5 py-1 rounded-full bg-yellow-500/15 text-yellow-400 font-medium">
              Reconectar Google
            </span>
          ) : ga4NeedsProperty ? (
            <span className="text-xs px-2.5 py-1 rounded-full bg-yellow-500/15 text-yellow-400 font-medium">
              Selecione propriedade
            </span>
          ) : connected && !isGa4 ? (
            <span className="text-xs px-2.5 py-1 rounded-full bg-yellow-500/15 text-yellow-400 font-medium">
              Selecione uma conta
            </span>
          ) : (
            <span className="text-xs px-2.5 py-1 rounded-full bg-bg-surface text-text-muted font-medium border border-border">
              {isGa4 && !connected ? 'Google não conectado' : 'Não conectado'}
            </span>
          )}
        </div>
      </div>

      {/* GA4 — Connected with property */}
      {isGa4 && isConnected && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="text-text-secondary">
              <span className="text-text-muted">Propriedade:</span> {connected?.metadata?.ga4_property_name || connected?.metadata?.ga4_property_id}
            </span>
            {connected?.metadata?.last_ga4_sync && (
              <span className="text-text-secondary flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="text-text-muted">Última sync:</span>{' '}
                {new Date(connected.metadata.last_ga4_sync).toLocaleDateString('pt-BR', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                })}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={handleSync} disabled={syncing}
              className="px-3 py-1.5 text-sm rounded-lg bg-brand-gold text-bg-base font-medium hover:bg-brand-gold-light transition-colors disabled:opacity-50">
              {syncing ? 'Sincronizando...' : 'Sincronizar GA4'}
            </button>
            <button onClick={handleLoadGa4Properties} disabled={loadingProperties}
              className="px-3 py-1.5 text-sm rounded-lg border border-border text-text-secondary hover:bg-bg-hover transition-colors disabled:opacity-50">
              {loadingProperties ? 'Buscando...' : 'Trocar propriedade'}
            </button>
          </div>
        </div>
      )}

      {/* GA4 — Needs reconnect (no analytics scope) */}
      {isGa4 && ga4NeedsReconnect && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-sm text-text-muted mb-3">
            Reconecte o Google para autorizar o acesso ao Google Analytics 4.
          </p>
          <button onClick={handleConnect}
            className="px-4 py-2 text-sm rounded-lg bg-brand-gold text-bg-base font-medium hover:bg-brand-gold-light transition-colors">
            Reconectar Google
          </button>
        </div>
      )}

      {/* GA4 — Needs property selection */}
      {isGa4 && ga4NeedsProperty && (
        <div className="mt-4 pt-4 border-t border-border">
          {connected?.metadata?.ga4_properties?.length > 0 ? (
            <>
              <p className="text-sm text-text-secondary mb-3">Selecione a propriedade GA4:</p>
              <div className="grid gap-2">
                {connected.metadata.ga4_properties.map((prop: any) => (
                  <button key={prop.property_id}
                    onClick={() => handleSelectGa4Property(prop.property_id, prop.display_name)}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-bg-hover transition-colors text-left">
                    <div>
                      <p className="text-sm font-medium text-text-primary">{prop.display_name}</p>
                      <p className="text-xs text-text-muted">{prop.account_name} · ID: {prop.property_id}</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-text-muted mb-3">Busque as propriedades GA4 da sua conta Google.</p>
              <button onClick={handleLoadGa4Properties} disabled={loadingProperties}
                className="px-4 py-2 text-sm rounded-lg bg-brand-gold text-bg-base font-medium hover:bg-brand-gold-light transition-colors disabled:opacity-50">
                {loadingProperties ? 'Buscando...' : 'Buscar Propriedades GA4'}
              </button>
            </>
          )}
        </div>
      )}

      {/* GA4 — Google not connected at all */}
      {isGa4 && !connected && (
        <div className="mt-4">
          <p className="text-sm text-text-muted mb-3">Conecte o Google Ads primeiro para habilitar o GA4.</p>
          <button onClick={handleConnect}
            className="px-4 py-2 text-sm rounded-lg bg-brand-gold text-bg-base font-medium hover:bg-brand-gold-light transition-colors">
            Conectar Google
          </button>
        </div>
      )}

      {/* GA4 — Property search results */}
      {isGa4 && ga4Properties.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-sm text-text-secondary mb-3">Selecione a propriedade GA4:</p>
          <div className="grid gap-2">
            {ga4Properties.map((prop) => (
              <button key={prop.property_id}
                onClick={() => handleSelectGa4Property(prop.property_id, prop.display_name)}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                  selectedProperty === prop.property_id
                    ? 'border-brand-gold bg-brand-gold/10'
                    : 'border-border hover:bg-bg-hover'
                }`}>
                <div>
                  <p className="text-sm font-medium text-text-primary">{prop.display_name}</p>
                  <p className="text-xs text-text-muted">{prop.account_name} · ID: {prop.property_id}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Connected info — non-GA4 */}
      {!isGa4 && isConnected && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {connected!.account_name && (
              <span className="text-text-secondary">
                <span className="text-text-muted">Conta:</span> {connected!.account_name}
                {connected!.account_id && <span className="text-text-muted ml-1">({connected!.account_id})</span>}
              </span>
            )}
            {connected!.metadata?.last_sync && (
              <span className="text-text-secondary flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="text-text-muted">Última sync:</span>{' '}
                {new Date(connected!.metadata.last_sync).toLocaleDateString('pt-BR', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                })}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={handleSync} disabled={syncing}
              className="px-3 py-1.5 text-sm rounded-lg bg-brand-gold text-bg-base font-medium hover:bg-brand-gold-light transition-colors disabled:opacity-50">
              {syncing ? 'Sincronizando...' : 'Sincronizar'}
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

      {/* Account selector — non-GA4 */}
      {!isGa4 && (showAccounts || (connected && !isConnected && accounts.length > 0)) && (
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

      {/* Connect button — OAuth platforms (non-GA4) */}
      {!isGa4 && !connected && !(platform as any).comingSoon && platform.oauth && (
        <div className="mt-4">
          <button onClick={handleConnect}
            className="px-4 py-2 text-sm rounded-lg bg-brand-gold text-bg-base font-medium hover:bg-brand-gold-light transition-colors">
            Conectar {platform.name}
          </button>
        </div>
      )}

      {/* Connect — Yampi (one-click) */}
      {!connected && !(platform as any).comingSoon && (platform as any).oneClick && (
        <div className="mt-4">
          <button onClick={handleConnect} disabled={connecting}
            className="px-4 py-2 text-sm rounded-lg bg-brand-gold text-bg-base font-medium hover:bg-brand-gold-light transition-colors disabled:opacity-50">
            {connecting ? 'Conectando...' : `Conectar ${platform.name}`}
          </button>
        </div>
      )}

      {/* Connect — Shopify (token-based) */}
      {!connected && !(platform as any).comingSoon && (platform as any).needsToken && (
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
    }
  }

  async function handleSync() {
    setSyncing(true); setMessage(null)
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
    if (!confirm(`Desconectar ${marketplace.name}?`)) return
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm"
            style={{ backgroundColor: marketplace.color, color: marketplace.textColor }}>
            {marketplace.icon}
          </div>
          <div>
            <h3 className="text-text-primary font-semibold">{marketplace.name}</h3>
            <p className="text-text-muted text-sm">{marketplace.description}</p>
          </div>
        </div>
        <div>
          {marketplace.comingSoon ? (
            <span className="text-xs px-2.5 py-1 rounded-full bg-bg-surface text-text-muted font-medium border border-border">Em breve</span>
          ) : isConnected ? (
            <span className="text-xs px-2.5 py-1 rounded-full bg-success/15 text-success font-medium">Conectado</span>
          ) : (
            <span className="text-xs px-2.5 py-1 rounded-full bg-bg-surface text-text-muted font-medium border border-border">Não conectado</span>
          )}
        </div>
      </div>

      {isConnected && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {connected.account_name && (
              <span className="text-text-secondary">
                <span className="text-text-muted">Vendedor:</span> {connected.account_name}
              </span>
            )}
            {connected.metadata?.last_sync && (
              <span className="text-text-secondary flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="text-text-muted">Última sync:</span>{' '}
                {new Date(connected.metadata.last_sync).toLocaleDateString('pt-BR', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                })}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={handleSync} disabled={syncing}
              className="px-3 py-1.5 text-sm rounded-lg bg-brand-gold text-bg-base font-medium hover:bg-brand-gold-light transition-colors disabled:opacity-50">
              {syncing ? 'Sincronizando...' : 'Sincronizar'}
            </button>
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

      {!connected && !marketplace.comingSoon && (
        <div className="mt-4">
          <button onClick={handleConnect}
            className="px-4 py-2 text-sm rounded-lg bg-brand-gold text-bg-base font-medium hover:bg-brand-gold-light transition-colors">
            Conectar {marketplace.name}
          </button>
        </div>
      )}

      {message && (
        <div className={`mt-3 text-sm px-3 py-2 rounded-lg ${message.type === 'success' ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
          {message.text}
        </div>
      )}
    </div>
  )
}
