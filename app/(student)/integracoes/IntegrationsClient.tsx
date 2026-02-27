'use client'

import { useState, useTransition } from 'react'
import { PLATFORMS } from '@/lib/constants/integrations'
import type { IntegrationPlatform } from '@/lib/constants/integrations'
import {
  saveIntegration,
  deleteIntegration,
  testIntegration,
  syncIntegration,
} from '@/app/actions/integrations'

type IntegrationInfo = {
  id: string
  platform: string
  account_id: string | null
  last_sync: string | null
  is_active: boolean
}

export default function IntegrationsClient({
  workspaceId,
  integrations,
}: {
  workspaceId: string
  integrations: IntegrationInfo[]
}) {
  const connectedMap = new Map(integrations.map((i) => [i.platform, i]))

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
  connected: IntegrationInfo | null
}) {
  const [expanded, setExpanded] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const isConnected = !!connected

  function handleFieldChange(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    setMessage(null)
    startTransition(async () => {
      const result = await saveIntegration(workspaceId, platform.id, fields)
      if ('error' in result && result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: 'Integração salva com sucesso!' })
        setExpanded(false)
        setFields({})
      }
    })
  }

  function handleTest() {
    setMessage(null)
    startTransition(async () => {
      const result = await testIntegration(workspaceId, platform.id)
      if ('error' in result && result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: (result as { message: string }).message ?? 'Conexão OK' })
      }
    })
  }

  function handleSync() {
    setMessage(null)
    startTransition(async () => {
      const result = await syncIntegration(workspaceId, platform.id)
      if ('error' in result && result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: `Sincronizado: ${(result as { synced: number }).synced ?? 0} dias` })
      }
    })
  }

  function handleDisconnect() {
    if (!confirm(`Desconectar ${platform.name}?`)) return
    setMessage(null)
    startTransition(async () => {
      const result = await deleteIntegration(workspaceId, platform.id as IntegrationPlatform)
      if ('error' in result && result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: 'Desconectado' })
      }
    })
  }

  return (
    <div className="bg-bg-card border border-border rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ backgroundColor: platform.color }}
          >
            {platform.name[0]}
          </div>
          <div>
            <h3 className="text-text-primary font-semibold">{platform.name}</h3>
            <p className="text-text-muted text-sm">{platform.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
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
            {connected.account_id && (
              <span className="text-text-secondary">
                <span className="text-text-muted">Conta:</span> {connected.account_id}
              </span>
            )}
            {connected.last_sync && (
              <span className="text-text-secondary">
                <span className="text-text-muted">Última sync:</span>{' '}
                {new Date(connected.last_sync).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={handleSync}
              disabled={isPending}
              className="px-3 py-1.5 text-sm rounded-lg bg-brand-gold text-bg-base font-medium hover:bg-brand-gold-light transition-colors disabled:opacity-50"
            >
              {isPending ? 'Sincronizando...' : 'Sincronizar'}
            </button>
            <button
              onClick={handleTest}
              disabled={isPending}
              className="px-3 py-1.5 text-sm rounded-lg border border-border text-text-secondary hover:bg-bg-hover transition-colors disabled:opacity-50"
            >
              Testar conexão
            </button>
            <button
              onClick={handleDisconnect}
              disabled={isPending}
              className="px-3 py-1.5 text-sm rounded-lg border border-error/30 text-error hover:bg-error/10 transition-colors disabled:opacity-50"
            >
              Desconectar
            </button>
          </div>
        </div>
      )}

      {/* Connect form (when not connected) */}
      {!isConnected && !expanded && (
        <div className="mt-4">
          <button
            onClick={() => setExpanded(true)}
            className="px-4 py-2 text-sm rounded-lg bg-brand-gold text-bg-base font-medium hover:bg-brand-gold-light transition-colors"
          >
            Conectar {platform.name}
          </button>
        </div>
      )}

      {!isConnected && expanded && (
        <div className="mt-4 pt-4 border-t border-border space-y-4">
          {/* Instructions toggle */}
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="text-sm text-brand-gold hover:text-brand-gold-light transition-colors flex items-center gap-1"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`transition-transform ${showInstructions ? 'rotate-90' : ''}`}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            Como obter as credenciais
          </button>
          {showInstructions && (
            <div className="text-sm text-text-secondary bg-bg-surface border border-border rounded-lg p-3">
              {platform.instructions}
            </div>
          )}

          {/* Fields */}
          {platform.fields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                {field.label}
              </label>
              <input
                type={field.type}
                placeholder={field.placeholder}
                value={fields[field.key] ?? ''}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                className="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-gold/50 focus:ring-1 focus:ring-brand-gold/25"
              />
            </div>
          ))}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="px-4 py-2 text-sm rounded-lg bg-brand-gold text-bg-base font-medium hover:bg-brand-gold-light transition-colors disabled:opacity-50"
            >
              {isPending ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={() => { setExpanded(false); setFields({}); setMessage(null) }}
              className="px-4 py-2 text-sm rounded-lg border border-border text-text-secondary hover:bg-bg-hover transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Message */}
      {message && (
        <div
          className={`mt-3 text-sm px-3 py-2 rounded-lg ${
            message.type === 'success'
              ? 'bg-success/10 text-success'
              : 'bg-error/10 text-error'
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  )
}
