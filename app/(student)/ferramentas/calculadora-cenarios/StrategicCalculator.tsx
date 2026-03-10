'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { maskBRL, unmaskBRL, numberToBRL, maskPct, unmaskPct, numberToPct } from '@/lib/masks'

// ============================================================
// Types
// ============================================================

interface Product {
  id: string
  name: string
  price: number
  cost: number
  salesPct: number
  // Display strings (masked)
  priceDisplay: string
  costDisplay: string
  salesPctDisplay: string
}

interface FreteInputs {
  custoTransporte: number
  insumos: number
  picking: number
  freteGratisPct: number
  devolucao: number
}

interface TaxasInputs {
  pixPct: number
  taxaPix: number
  taxaCartao: number
  taxaAntecipacao: number
  mediaParcelas: number
}

interface DescontoInputs {
  totalFaturado: number
  totalCupons: number
}

// ============================================================
// Constants
// ============================================================

const GOLD = '#ECA206'
const BG_CARD = '#122014'

const SEGMENTS_CONFIG = [
  { key: 'cmv', label: 'CMV', color: '#ef4444' },
  { key: 'impostos', label: 'Impostos', color: '#f97316' },
  { key: 'frete', label: 'Frete', color: '#eab308' },
  { key: 'taxas', label: 'Taxas', color: '#a855f7' },
  { key: 'desconto', label: 'Desconto', color: '#ec4899' },
  { key: 'lucro', label: 'Lucro', color: '#22c55e' },
  { key: 'mkt', label: 'Marketing', color: GOLD },
] as const

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function makeProduct(name: string, price: number, cost: number, salesPct: number): Product {
  return {
    id: uid(), name, price, cost, salesPct,
    priceDisplay: price > 0 ? numberToBRL(price) : '',
    costDisplay: cost > 0 ? numberToBRL(cost) : '',
    salesPctDisplay: salesPct > 0 ? numberToPct(salesPct) : '',
  }
}

// ============================================================
// Main Component
// ============================================================

export default function StrategicCalculator({ workspaceId }: { workspaceId: string | null }) {
  // --- Curva A ---
  const [useCurvaA, setUseCurvaA] = useState(true)
  const [products, setProducts] = useState<Product[]>([
    makeProduct('Produto Principal', 160, 19.2, 100),
  ])

  // --- Manual inputs (when Curva A off) ---
  const [manualTicket, setManualTicket] = useState('')
  const [manualCmv, setManualCmv] = useState('')

  // --- Frete (display strings) ---
  const [freteDisplay, setFreteDisplay] = useState({
    custoTransporte: '', insumos: '', picking: '', freteGratisPct: '', devolucao: '',
  })
  const frete: FreteInputs = useMemo(() => ({
    custoTransporte: unmaskBRL(freteDisplay.custoTransporte),
    insumos: unmaskBRL(freteDisplay.insumos),
    picking: unmaskBRL(freteDisplay.picking),
    freteGratisPct: unmaskPct(freteDisplay.freteGratisPct),
    devolucao: unmaskBRL(freteDisplay.devolucao),
  }), [freteDisplay])

  // --- Taxas (display strings) ---
  const [taxasDisplay, setTaxasDisplay] = useState({
    pixPct: numberToPct(55), taxaPix: numberToPct(0.5),
    taxaCartao: numberToPct(2), taxaAntecipacao: numberToPct(1.5),
    mediaParcelas: '2',
  })
  const taxas: TaxasInputs = useMemo(() => ({
    pixPct: unmaskPct(taxasDisplay.pixPct),
    taxaPix: unmaskPct(taxasDisplay.taxaPix),
    taxaCartao: unmaskPct(taxasDisplay.taxaCartao),
    taxaAntecipacao: unmaskPct(taxasDisplay.taxaAntecipacao),
    mediaParcelas: Number(taxasDisplay.mediaParcelas) || 0,
  }), [taxasDisplay])

  // --- Desconto (display strings) ---
  const [descontoDisplay, setDescontoDisplay] = useState({
    totalFaturado: numberToBRL(100000), totalCupons: numberToBRL(5000),
  })
  const desconto: DescontoInputs = useMemo(() => ({
    totalFaturado: unmaskBRL(descontoDisplay.totalFaturado),
    totalCupons: unmaskBRL(descontoDisplay.totalCupons),
  }), [descontoDisplay])

  // --- Other (display strings) ---
  const [impostosPctDisplay, setImpostosPctDisplay] = useState(numberToPct(10))
  const [lucroDesejadoPctDisplay, setLucroDesejadoPctDisplay] = useState(numberToPct(20))
  const impostosPct = unmaskPct(impostosPctDisplay)
  const lucroDesejadoPct = unmaskPct(lucroDesejadoPctDisplay)

  // --- Collapsible sections ---
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    curvaA: true,
    frete: false,
    taxas: false,
    desconto: false,
  })

  const toggleSection = useCallback((key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  // --- Persistence ---
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const loadedRef = useRef(false)
  const saveTimerRef = useRef<NodeJS.Timeout>(null)

  // Collect all state for saving
  function collectState() {
    return {
      useCurvaA,
      products: products.map(p => ({ name: p.name, price: p.price, cost: p.cost, salesPct: p.salesPct })),
      manualTicket, manualCmv,
      freteDisplay, taxasDisplay, descontoDisplay,
      impostosPctDisplay, lucroDesejadoPctDisplay,
    }
  }

  // Restore state from saved data
  function restoreState(saved: any) {
    if (!saved) return
    if (saved.useCurvaA !== undefined) setUseCurvaA(saved.useCurvaA)
    if (saved.products?.length) {
      setProducts(saved.products.map((p: any) => makeProduct(p.name, p.price, p.cost, p.salesPct)))
    }
    if (saved.manualTicket !== undefined) setManualTicket(saved.manualTicket)
    if (saved.manualCmv !== undefined) setManualCmv(saved.manualCmv)
    if (saved.freteDisplay) setFreteDisplay(saved.freteDisplay)
    if (saved.taxasDisplay) setTaxasDisplay(saved.taxasDisplay)
    if (saved.descontoDisplay) setDescontoDisplay(saved.descontoDisplay)
    if (saved.impostosPctDisplay !== undefined) setImpostosPctDisplay(saved.impostosPctDisplay)
    if (saved.lucroDesejadoPctDisplay !== undefined) setLucroDesejadoPctDisplay(saved.lucroDesejadoPctDisplay)
  }

  // Load on mount
  useEffect(() => {
    if (!workspaceId) return
    fetch(`/api/calculadora?workspace_id=${workspaceId}`)
      .then(r => r.json())
      .then(json => {
        if (json.data) restoreState(json.data)
        loadedRef.current = true
      })
      .catch(() => { loadedRef.current = true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId])

  // Auto-save (debounced 2s) after any field change
  useEffect(() => {
    if (!workspaceId || !loadedRef.current) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSaveStatus('idle')
    saveTimerRef.current = setTimeout(() => {
      setSaveStatus('saving')
      fetch('/api/calculadora', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, data: collectState() }),
      })
        .then(() => {
          setSaveStatus('saved')
          setTimeout(() => setSaveStatus(s => s === 'saved' ? 'idle' : s), 2000)
        })
        .catch(() => setSaveStatus('idle'))
    }, 2000)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useCurvaA, products, manualTicket, manualCmv, freteDisplay, taxasDisplay, descontoDisplay, impostosPctDisplay, lucroDesejadoPctDisplay, workspaceId])

  function handleClearAll() {
    setUseCurvaA(true)
    setProducts([makeProduct('Produto Principal', 0, 0, 100)])
    setManualTicket('')
    setManualCmv('')
    setFreteDisplay({ custoTransporte: '', insumos: '', picking: '', freteGratisPct: '', devolucao: '' })
    setTaxasDisplay({ pixPct: '', taxaPix: '', taxaCartao: '', taxaAntecipacao: '', mediaParcelas: '' })
    setDescontoDisplay({ totalFaturado: '', totalCupons: '' })
    setImpostosPctDisplay('')
    setLucroDesejadoPctDisplay('')
    setShowClearConfirm(false)
    if (workspaceId) {
      fetch('/api/calculadora', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId }),
      }).catch(() => {})
    }
  }

  // ============================================================
  // Calculations
  // ============================================================

  const curvaA = useMemo(() => {
    if (!useCurvaA || products.length === 0) {
      return { ticketMedio: unmaskBRL(manualTicket), cmvPct: unmaskPct(manualCmv) }
    }
    const totalSales = products.reduce((s, p) => s + p.salesPct, 0) || 1
    const ticketMedio = products.reduce(
      (s, p) => s + p.price * (p.salesPct / totalSales),
      0
    )
    const cmvPct =
      ticketMedio > 0
        ? products.reduce(
            (s, p) => s + (p.cost / (p.price || 1)) * 100 * (p.salesPct / totalSales),
            0
          )
        : 0
    return { ticketMedio, cmvPct }
  }, [useCurvaA, products, manualTicket, manualCmv])

  const ticketMedio = curvaA.ticketMedio
  const cmvPct = curvaA.cmvPct

  const fretePct = useMemo(() => {
    if (ticketMedio <= 0) return 0
    const custoFrete = frete.custoTransporte + frete.insumos + frete.picking
    const total = (custoFrete * frete.freteGratisPct) / 100 + frete.devolucao
    return (total / ticketMedio) * 100
  }, [frete, ticketMedio])

  const taxasPct = useMemo(() => {
    const pixShare = taxas.pixPct / 100
    const cartaoShare = 1 - pixShare
    return pixShare * taxas.taxaPix + cartaoShare * (taxas.taxaCartao + taxas.taxaAntecipacao)
  }, [taxas])

  const descontoPct = useMemo(() => {
    if (desconto.totalFaturado <= 0) return 0
    return (desconto.totalCupons / desconto.totalFaturado) * 100
  }, [desconto])

  const mktPct = useMemo(() => {
    return Math.max(
      0,
      100 - cmvPct - impostosPct - fretePct - taxasPct - descontoPct - lucroDesejadoPct
    )
  }, [cmvPct, impostosPct, fretePct, taxasPct, descontoPct, lucroDesejadoPct])

  const roasMinimo = mktPct > 0 ? 100 / mktPct : 0
  const cpaMaximo = (ticketMedio * mktPct) / 100

  // --- Composition bar ---
  const segments = useMemo(() => {
    const values: Record<string, number> = {
      cmv: cmvPct,
      impostos: impostosPct,
      frete: fretePct,
      taxas: taxasPct,
      desconto: descontoPct,
      lucro: lucroDesejadoPct,
      mkt: mktPct,
    }
    return SEGMENTS_CONFIG.map(s => ({
      ...s,
      pct: values[s.key] || 0,
    })).filter(s => s.pct > 0)
  }, [cmvPct, impostosPct, fretePct, taxasPct, descontoPct, lucroDesejadoPct, mktPct])

  // --- Product handlers ---
  const updateProduct = useCallback(
    (id: string, field: 'name' | 'priceDisplay' | 'costDisplay' | 'salesPctDisplay', value: string) => {
      setProducts(prev =>
        prev.map(p => {
          if (p.id !== id) return p
          if (field === 'name') return { ...p, name: value }
          if (field === 'priceDisplay') {
            const masked = maskBRL(value)
            return { ...p, priceDisplay: masked, price: unmaskBRL(masked) }
          }
          if (field === 'costDisplay') {
            const masked = maskBRL(value)
            return { ...p, costDisplay: masked, cost: unmaskBRL(masked) }
          }
          if (field === 'salesPctDisplay') {
            const masked = maskPct(value)
            return { ...p, salesPctDisplay: masked, salesPct: unmaskPct(masked) }
          }
          return p
        })
      )
    },
    []
  )

  const addProduct = useCallback(() => {
    setProducts(prev => [
      ...prev,
      makeProduct(`Produto ${prev.length + 1}`, 0, 0, 0),
    ])
  }, [])

  const removeProduct = useCallback((id: string) => {
    setProducts(prev => (prev.length <= 1 ? prev : prev.filter(p => p.id !== id)))
  }, [])

  // % Vendas sum warning
  const salesPctSum = products.reduce((s, p) => s + p.salesPct, 0)
  const salesPctWarning = useCurvaA && products.length > 1 && Math.abs(salesPctSum - 100) > 0.5

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="space-y-6 tabular-nums">
      {/* Clear confirmation modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowClearConfirm(false)}>
          <div className="bg-bg-card border border-border rounded-xl p-6 max-w-sm mx-4 space-y-4" onClick={e => e.stopPropagation()}>
            <p className="text-text-primary font-semibold">Limpar tudo?</p>
            <p className="text-text-muted text-sm">Tem certeza? Todos os dados ser&#227;o apagados.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowClearConfirm(false)} className="px-4 py-2 text-sm rounded-lg bg-bg-surface border border-border text-text-secondary hover:bg-bg-hover transition-colors">Cancelar</button>
              <button onClick={handleClearAll} className="px-4 py-2 text-sm rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors font-medium">Limpar</button>
            </div>
          </div>
        </div>
      )}

      {/* 1. Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Calculadora Estrat&#233;gica</h1>
          <p className="text-sm text-text-muted mt-1">
            Descubra seu ROAS M&#237;nimo, CPA M&#225;ximo e quanto do ticket est&#225; dispon&#237;vel para
            investir em marketing.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 mt-1">
          {saveStatus === 'saving' && (
            <span className="text-xs text-text-muted animate-pulse">Salvando...</span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-xs text-emerald-400">&#128190; Salvo</span>
          )}
          <button
            onClick={() => setShowClearConfirm(true)}
            className="text-xs px-3 py-1.5 rounded-lg text-text-muted border border-border hover:bg-bg-hover hover:text-red-400 transition-colors"
          >
            &#128465;&#65039; Limpar tudo
          </button>
        </div>
      </div>

      {/* 2. RESULTADO — 3 cards + barra */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ResultCard
          label="ROAS Mínimo"
          value={roasMinimo.toFixed(2)}
          suffix="x"
        />
        <ResultCard
          label="CPA Máximo"
          value={fmt(cpaMaximo)}
          prefix="R$"
        />
        <ResultCard
          label="% Disponível p/ Mkt"
          value={mktPct.toFixed(1)}
          suffix="%"
          accent={mktPct < 10}
        />
      </div>

      {/* Barra de composição */}
      <Card>
        <SectionTitle>Composição do Ticket</SectionTitle>
        <div className="flex rounded-lg overflow-hidden h-8">
          {segments.map(s => (
            <div
              key={s.key}
              style={{ width: `${s.pct}%`, background: s.color }}
              className="relative group transition-all duration-300"
            >
              {s.pct >= 7 && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-text-primary drop-shadow">
                  {s.pct.toFixed(0)}%
                </span>
              )}
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block bg-bg-base text-text-primary text-xs px-2 py-1 rounded whitespace-nowrap z-10 border border-border">
                {s.label}: {s.pct.toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
          {segments.map(s => (
            <div key={s.key} className="flex items-center gap-1.5 text-xs text-text-muted">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
              {s.label} ({s.pct.toFixed(1)}%)
            </div>
          ))}
        </div>
      </Card>

      {/* 3. Ticket Médio + CMV% (read-only quando Curva A ativa) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <SectionTitle>Ticket Médio</SectionTitle>
          {useCurvaA ? (
            <p className="text-2xl font-bold text-text-primary">R$ {fmt(ticketMedio)}</p>
          ) : (
            <MaskedInput label="Ticket Médio (R$)" type="brl" value={manualTicket} onChange={setManualTicket} />
          )}
          <p className="text-xs text-text-muted mt-1">
            {useCurvaA ? 'Calculado pela Curva A' : 'Valor manual'}
          </p>
        </Card>
        <Card>
          <SectionTitle>CMV %</SectionTitle>
          {useCurvaA ? (
            <p className="text-2xl font-bold text-text-primary">{cmvPct.toFixed(1)}%</p>
          ) : (
            <MaskedInput label="CMV (%)" type="pct" value={manualCmv} onChange={setManualCmv} />
          )}
          <p className="text-xs text-text-muted mt-1">
            {useCurvaA ? 'Calculado pela Curva A' : 'Valor manual'}
          </p>
        </Card>
      </div>

      {/* 4. Impostos + Lucro Desejado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <MaskedInput label="Impostos (%)" type="pct" value={impostosPctDisplay} onChange={setImpostosPctDisplay} />
        </Card>
        <Card>
          <MaskedInput label="Lucro após Aquisição Desejado (%)" type="pct" value={lucroDesejadoPctDisplay} onChange={setLucroDesejadoPctDisplay} />
        </Card>
      </div>

      {/* 5. Curva A — colapsável */}
      <CollapsibleCard
        title="Curva A — Produtos Principais"
        subtitle={
          useCurvaA
            ? `Ticket: R$ ${fmt(ticketMedio)} · CMV: ${cmvPct.toFixed(1)}%`
            : 'Desativada — usando valores manuais'
        }
        isOpen={openSections.curvaA}
        onToggle={() => toggleSection('curvaA')}
      >
        {/* Toggle */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
          <span className="text-sm text-text-muted">
            {useCurvaA ? 'Curva A ativada — cálculo ponderado' : 'Usar valores manuais'}
          </span>
          <Toggle checked={useCurvaA} onChange={setUseCurvaA} />
        </div>

        {useCurvaA && (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] text-text-muted uppercase tracking-wide">
                    <th className="pb-2 pr-2">Produto</th>
                    <th className="pb-2 pr-2 w-32">Preço (R$)</th>
                    <th className="pb-2 pr-2 w-32">Custo (R$)</th>
                    <th className="pb-2 pr-2 w-24">% Vendas</th>
                    <th className="pb-2 pr-2 w-20 text-right">CMV%</th>
                    <th className="pb-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => {
                    const pCmv = p.price > 0 ? (p.cost / p.price) * 100 : 0
                    return (
                      <tr key={p.id} className="border-t border-border">
                        <td className="py-2 pr-2">
                          <input
                            type="text"
                            value={p.name}
                            onChange={e => updateProduct(p.id, 'name', e.target.value)}
                            className="w-full bg-bg-surface/50 hover:bg-bg-hover border border-border rounded px-2 py-1.5 text-text-primary text-sm focus:outline-none focus:border-brand-gold/50"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={p.priceDisplay}
                            onChange={e => updateProduct(p.id, 'priceDisplay', e.target.value)}
                            placeholder="R$ 0,00"
                            className="w-full bg-bg-surface/50 hover:bg-bg-hover border border-border rounded px-2 py-1.5 text-text-primary text-sm text-right focus:outline-none focus:border-brand-gold/50"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={p.costDisplay}
                            onChange={e => updateProduct(p.id, 'costDisplay', e.target.value)}
                            placeholder="R$ 0,00"
                            className="w-full bg-bg-surface/50 hover:bg-bg-hover border border-border rounded px-2 py-1.5 text-text-primary text-sm text-right focus:outline-none focus:border-brand-gold/50"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={p.salesPctDisplay}
                            onChange={e => updateProduct(p.id, 'salesPctDisplay', e.target.value)}
                            placeholder="0,00"
                            className="w-full bg-bg-surface/50 hover:bg-bg-hover border border-border rounded px-2 py-1.5 text-text-primary text-sm text-right focus:outline-none focus:border-brand-gold/50"
                          />
                        </td>
                        <td className="py-2 pr-2 text-right text-sm text-text-muted">
                          {pCmv.toFixed(1)}%
                        </td>
                        <td className="py-2 text-center">
                          <button
                            onClick={() => removeProduct(p.id)}
                            className="text-text-muted/60 hover:text-red-400 transition-colors p-1 disabled:opacity-30"
                            title="Remover"
                            disabled={products.length <= 1}
                          >
                            <IconX size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {salesPctWarning && (
              <p className="text-yellow-400 text-xs flex items-center gap-1">
                <span>&#9888;</span> % Vendas soma {salesPctSum.toFixed(1)}% (deveria ser 100%)
              </p>
            )}

            <button
              onClick={addProduct}
              className="text-xs text-brand-gold hover:text-brand-gold-light transition-colors flex items-center gap-1"
            >
              <IconPlus size={14} />
              Adicionar produto
            </button>

            <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span className="text-text-muted">
                Ticket ponderado:{' '}
                <span className="text-text-primary font-medium">R$ {fmt(ticketMedio)}</span>
              </span>
              <span className="text-text-muted">
                CMV ponderado:{' '}
                <span className="text-text-primary font-medium">{cmvPct.toFixed(1)}%</span>
              </span>
            </div>
          </div>
        )}
      </CollapsibleCard>

      {/* 6. Mini-calculadoras (colapsáveis) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Frete */}
        <CollapsibleCard
          title="Frete"
          subtitle={`${fretePct.toFixed(1)}% do ticket`}
          isOpen={openSections.frete}
          onToggle={() => toggleSection('frete')}
        >
          <div className="space-y-3">
            <MaskedInput label="Custo transporte (R$)" type="brl" value={freteDisplay.custoTransporte}
              onChange={v => setFreteDisplay(p => ({ ...p, custoTransporte: v }))} />
            <MaskedInput label="Insumos / embalagem (R$)" type="brl" value={freteDisplay.insumos}
              onChange={v => setFreteDisplay(p => ({ ...p, insumos: v }))} />
            <MaskedInput label="Picking / manuseio (R$)" type="brl" value={freteDisplay.picking}
              onChange={v => setFreteDisplay(p => ({ ...p, picking: v }))} />
            <MaskedInput label="% Pedidos com frete grátis" type="pct" value={freteDisplay.freteGratisPct}
              onChange={v => setFreteDisplay(p => ({ ...p, freteGratisPct: v }))} />
            <MaskedInput label="Custo devolução médio (R$)" type="brl" value={freteDisplay.devolucao}
              onChange={v => setFreteDisplay(p => ({ ...p, devolucao: v }))} />
            <MiniResult
              rows={[
                {
                  label: 'Custo frete/pedido',
                  value: `R$ ${fmt(
                    ((frete.custoTransporte + frete.insumos + frete.picking) *
                      frete.freteGratisPct) /
                      100 +
                      frete.devolucao
                  )}`,
                },
                { label: '% do ticket', value: `${fretePct.toFixed(1)}%` },
              ]}
            />
          </div>
        </CollapsibleCard>

        {/* Taxas */}
        <CollapsibleCard
          title="Taxas"
          subtitle={`${taxasPct.toFixed(1)}% do ticket`}
          isOpen={openSections.taxas}
          onToggle={() => toggleSection('taxas')}
        >
          <div className="space-y-3">
            <MaskedInput label="% Vendas via PIX" type="pct" value={taxasDisplay.pixPct}
              onChange={v => setTaxasDisplay(p => ({ ...p, pixPct: v }))} />
            <MaskedInput label="Taxa PIX (%)" type="pct" value={taxasDisplay.taxaPix}
              onChange={v => setTaxasDisplay(p => ({ ...p, taxaPix: v }))} />
            <MaskedInput label="Taxa cartão (%)" type="pct" value={taxasDisplay.taxaCartao}
              onChange={v => setTaxasDisplay(p => ({ ...p, taxaCartao: v }))} />
            <MaskedInput label="Taxa antecipação (%)" type="pct" value={taxasDisplay.taxaAntecipacao}
              onChange={v => setTaxasDisplay(p => ({ ...p, taxaAntecipacao: v }))} />
            <MaskedInput label="Média de parcelas" type="number" value={taxasDisplay.mediaParcelas}
              onChange={v => setTaxasDisplay(p => ({ ...p, mediaParcelas: v }))} />
            <MiniResult
              rows={[
                {
                  label: 'Taxa ponderada',
                  value: `${taxasPct.toFixed(2)}%`,
                },
                {
                  label: 'Por pedido',
                  value: `R$ ${fmt((ticketMedio * taxasPct) / 100)}`,
                },
              ]}
            />
          </div>
        </CollapsibleCard>

        {/* Desconto */}
        <CollapsibleCard
          title="Desconto"
          subtitle={`${descontoPct.toFixed(1)}% do ticket`}
          isOpen={openSections.desconto}
          onToggle={() => toggleSection('desconto')}
        >
          <div className="space-y-3">
            <MaskedInput label="Total faturado no período (R$)" type="brl" value={descontoDisplay.totalFaturado}
              onChange={v => setDescontoDisplay(p => ({ ...p, totalFaturado: v }))} />
            <MaskedInput label="Total em cupons / descontos (R$)" type="brl" value={descontoDisplay.totalCupons}
              onChange={v => setDescontoDisplay(p => ({ ...p, totalCupons: v }))} />
            <MiniResult
              rows={[
                { label: '% Desconto médio', value: `${descontoPct.toFixed(1)}%` },
                {
                  label: 'Por pedido',
                  value: `R$ ${fmt((ticketMedio * descontoPct) / 100)}`,
                },
              ]}
            />
          </div>
        </CollapsibleCard>
      </div>

      {/* 7. Tabela resumo */}
      <Card>
        <SectionTitle>Resumo por Pedido</SectionTitle>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-text-muted uppercase tracking-wide border-b border-border">
              <th className="pb-2">Item</th>
              <th className="pb-2 text-right">%</th>
              <th className="pb-2 text-right">R$</th>
            </tr>
          </thead>
          <tbody>
            <SummaryRow label="Ticket Médio" pct={100} value={ticketMedio} />
            <SummaryRow label="(−) CMV" pct={cmvPct} value={(ticketMedio * cmvPct) / 100} negative />
            <SummaryRow label="(−) Impostos" pct={impostosPct} value={(ticketMedio * impostosPct) / 100} negative />
            <SummaryRow label="(−) Frete" pct={fretePct} value={(ticketMedio * fretePct) / 100} negative />
            <SummaryRow label="(−) Taxas" pct={taxasPct} value={(ticketMedio * taxasPct) / 100} negative />
            <SummaryRow label="(−) Desconto" pct={descontoPct} value={(ticketMedio * descontoPct) / 100} negative />
            <SummaryRow label="(−) Lucro Desejado" pct={lucroDesejadoPct} value={(ticketMedio * lucroDesejadoPct) / 100} negative />
            <tr className="border-t-2 border-border">
              <td className="py-2.5 font-semibold" style={{ color: GOLD }}>
                = Disponível p/ Marketing
              </td>
              <td className="py-2.5 text-right font-semibold" style={{ color: GOLD }}>
                {mktPct.toFixed(1)}%
              </td>
              <td className="py-2.5 text-right font-semibold" style={{ color: GOLD }}>
                R$ {fmt(cpaMaximo)}
              </td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  )
}

// ============================================================
// Sub-components
// ============================================================

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: BG_CARD }} className="rounded-xl p-5 border border-border">
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-text-muted mb-3 font-medium uppercase tracking-wide">{children}</p>
  )
}

function CollapsibleCard({
  title,
  subtitle,
  isOpen,
  onToggle,
  children,
}: {
  title: string
  subtitle?: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div style={{ background: BG_CARD }} className="rounded-xl border border-border overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-bg-hover/50 transition-colors"
      >
        <div className="min-w-0">
          <p className="text-xs text-text-muted font-medium uppercase tracking-wide">{title}</p>
          {subtitle && (
            <p className="text-xs text-text-muted mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        <span
          className={[
            'text-text-muted transition-transform duration-200 shrink-0 ml-3',
            isOpen ? 'rotate-180' : '',
          ].join(' ')}
        >
          <IconChevron />
        </span>
      </button>
      <div
        className={[
          'transition-all duration-200 ease-in-out overflow-hidden',
          isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0',
        ].join(' ')}
      >
        <div className="px-5 pb-5 pt-1">{children}</div>
      </div>
    </div>
  )
}

function ResultCard({
  label,
  value,
  prefix,
  suffix,
  accent,
}: {
  label: string
  value: string
  prefix?: string
  suffix?: string
  accent?: boolean
}) {
  return (
    <div
      style={{
        background: BG_CARD,
        borderColor: accent ? '#ef4444' : '#1F3D25',
      }}
      className="rounded-xl p-5 border"
    >
      <p className="text-xs text-text-muted mb-1 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold" style={{ color: accent ? '#ef4444' : GOLD }}>
        {prefix && <span className="text-base font-normal mr-1">{prefix}</span>}
        {value}
        {suffix && <span className="text-base font-normal ml-0.5">{suffix}</span>}
      </p>
    </div>
  )
}

function MaskedInput({
  label,
  type,
  value,
  onChange,
  disabled,
}: {
  label: string
  type: 'brl' | 'pct' | 'number'
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const handleChange = (raw: string) => {
    if (type === 'brl') {
      onChange(maskBRL(raw))
    } else if (type === 'pct') {
      onChange(maskPct(raw))
    } else {
      // plain number: allow digits only
      const clean = raw.replace(/[^0-9]/g, '')
      onChange(clean)
    }
  }

  const placeholder = type === 'brl' ? 'R$ 0,00' : type === 'pct' ? '0,00' : '0'

  return (
    <label className="block">
      <span className="text-xs text-text-muted mb-1 block">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={e => handleChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={[
          'w-full rounded px-3 py-2 text-sm text-text-primary border border-border focus:outline-none focus:border-brand-gold/50 tabular-nums',
          disabled
            ? 'bg-bg-hover/30 text-text-muted cursor-not-allowed'
            : 'bg-bg-surface/50 hover:bg-bg-hover',
        ].join(' ')}
      />
    </label>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={[
        'relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0',
        checked ? 'bg-brand-gold' : 'bg-bg-surface',
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200',
          checked ? 'translate-x-5' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  )
}

function MiniResult({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <div className="pt-3 mt-1 border-t border-border space-y-1">
      {rows.map(r => (
        <div key={r.label} className="flex justify-between text-sm">
          <span className="text-text-muted">{r.label}</span>
          <span className="text-text-primary font-medium">{r.value}</span>
        </div>
      ))}
    </div>
  )
}

function SummaryRow({
  label,
  pct,
  value,
  negative,
}: {
  label: string
  pct: number
  value: number
  negative?: boolean
}) {
  return (
    <tr className="border-t border-border">
      <td className={`py-2 ${negative ? 'text-text-muted' : 'text-text-primary font-medium'}`}>
        {label}
      </td>
      <td className={`py-2 text-right ${negative ? 'text-text-muted' : 'text-text-primary'}`}>
        {pct.toFixed(1)}%
      </td>
      <td
        className={`py-2 text-right ${negative ? 'text-red-400/80' : 'text-text-primary font-medium'}`}
      >
        R$ {fmt(value)}
      </td>
    </tr>
  )
}

// ============================================================
// Icons
// ============================================================

function IconChevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function IconX({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function IconPlus({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}
