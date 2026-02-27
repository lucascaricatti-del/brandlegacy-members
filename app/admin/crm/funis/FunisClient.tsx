'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createFunnel } from '@/app/actions/crm'
import Link from 'next/link'

type Funnel = {
  id: string
  name: string
  slug: string
  product: string
  description: string | null
  is_active: boolean
  created_at: string
  lead_count: number
}

export default function FunisClient({ funnels }: { funnels: Funnel[] }) {
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [product, setProduct] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleCreate() {
    if (!name.trim() || !slug.trim() || !product.trim()) {
      setError('Preencha nome, slug e produto.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await createFunnel({ name: name.trim(), slug: slug.trim(), product: product.trim(), description: description.trim() || undefined })
      if (result.error) {
        setError(result.error)
      } else {
        setShowCreate(false)
        setName('')
        setSlug('')
        setProduct('')
        setDescription('')
        router.refresh()
      }
    })
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const baseUrl = 'https://app.brandlegacy.com.br'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Funis de Venda</h1>
          <p className="text-text-muted text-sm mt-1">{funnels.length} funis cadastrados</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 rounded-lg bg-brand-gold hover:bg-brand-gold-light text-bg-base text-sm font-medium transition-colors"
        >
          + Novo Funil
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl bg-bg-card border border-border p-6 mb-6">
          <h2 className="text-sm font-bold text-text-primary mb-4">Criar Funil</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-text-muted mb-1">Nome *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Funil Imersão" className="w-full px-3 py-2 rounded-lg bg-bg-surface border border-border text-text-primary text-sm" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Slug (URL) *</label>
              <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="imersao" className="w-full px-3 py-2 rounded-lg bg-bg-surface border border-border text-text-primary text-sm" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Produto *</label>
              <input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="imersao" className="w-full px-3 py-2 rounded-lg bg-bg-surface border border-border text-text-primary text-sm" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Descrição</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição breve" className="w-full px-3 py-2 rounded-lg bg-bg-surface border border-border text-text-primary text-sm" />
            </div>
          </div>
          {error && <p className="text-error text-xs mb-3">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={isPending} className="px-4 py-2 rounded-lg bg-brand-gold hover:bg-brand-gold-light text-bg-base text-sm font-medium transition-colors disabled:opacity-60">
              {isPending ? 'Criando...' : 'Criar'}
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg border border-border text-text-muted text-sm hover:bg-bg-hover transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Funnel list */}
      <div className="space-y-3">
        {funnels.map((funnel) => {
          const formUrl = `${baseUrl}/forms/${funnel.slug}`
          const embedCode = `<iframe src="${formUrl}/embed" width="100%" height="700" frameborder="0"></iframe>`
          return (
            <div key={funnel.id} className="rounded-xl bg-bg-card border border-border p-5">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-text-primary">{funnel.name}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${funnel.is_active ? 'bg-green-400/15 text-green-400' : 'bg-red-400/15 text-red-400'}`}>
                      {funnel.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
                    <span>Produto: {funnel.product}</span>
                    <span>Slug: /{funnel.slug}</span>
                    <span>{funnel.lead_count} leads</span>
                  </div>
                  {funnel.description && <p className="text-xs text-text-muted mt-1">{funnel.description}</p>}
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => copyToClipboard(formUrl, `link-${funnel.id}`)}
                    className="px-3 py-1.5 rounded-lg bg-bg-surface border border-border text-xs text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {copied === `link-${funnel.id}` ? 'Copiado!' : 'Copiar link'}
                  </button>
                  <button
                    onClick={() => copyToClipboard(embedCode, `embed-${funnel.id}`)}
                    className="px-3 py-1.5 rounded-lg bg-bg-surface border border-border text-xs text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {copied === `embed-${funnel.id}` ? 'Copiado!' : 'Copiar embed'}
                  </button>
                  <Link
                    href="/admin/crm"
                    className="px-3 py-1.5 rounded-lg bg-brand-gold/15 text-brand-gold text-xs font-medium text-center hover:bg-brand-gold/25 transition-colors"
                  >
                    Ver pipeline
                  </Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
