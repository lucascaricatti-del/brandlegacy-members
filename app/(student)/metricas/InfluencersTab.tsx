'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'

type ViewType = 'consolidado' | 'macro' | 'micro' | 'ranking'
type Period = 'mes_atual' | '7d' | '14d' | '30d' | '90d' | 'custom'
type FeeType = 'fixed' | 'commission' | 'fixed_commission' | 'barter'
type Tier = 'macro' | 'micro'
type ModalStep = 1 | 2 | 3
type ContentType = 'stories' | 'reels' | 'feed' | 'live'
type SeqStatus = 'pending' | 'published' | 'delayed'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'mes_atual', label: 'Mês Atual' },
  { key: '7d', label: '7 dias' },
  { key: '14d', label: '14 dias' },
  { key: '30d', label: '30 dias' },
  { key: '90d', label: '90 dias' },
  { key: 'custom', label: 'Personalizado' },
]
const FEE_TYPES: { key: FeeType; label: string }[] = [
  { key: 'fixed', label: 'Fixo' },
  { key: 'commission', label: 'Comissão' },
  { key: 'fixed_commission', label: 'Fixo + Comissão' },
  { key: 'barter', label: 'Permuta' },
]
const NICHES = ['Saude', 'Beleza', 'Fitness', 'Lifestyle', 'Alimentacao', 'Outro']
const CONTENT_TYPES: { key: ContentType; label: string }[] = [
  { key: 'stories', label: 'Stories' },
  { key: 'reels', label: 'Reels' },
  { key: 'feed', label: 'Feed' },
  { key: 'live', label: 'Live' },
]
const VIEWS: { key: ViewType; label: string }[] = [
  { key: 'consolidado', label: 'Consolidado' },
  { key: 'macro', label: 'Macro' },
  { key: 'micro', label: 'Micro' },
  { key: 'ranking', label: 'Ranking' },
]

type Sequence = {
  id?: string; sequence_number: number; scheduled_date: string
  content_type: string; description: string; status: SeqStatus; published_at: string
}
type Renewal = {
  id?: string; renewal_number: number; start_date: string; end_date: string | null
  fee_type: string; monthly_fee: number; commission_pct: number; notes: string | null; is_current: boolean
}
type Performance = {
  id: string; name: string; instagram: string | null; coupon_code: string
  tier: Tier; fee_type: string; monthly_fee: number; commission_pct: number
  start_date: string | null; end_date: string | null; contract_status: string
  niche: string | null; followers_count: number | null; is_active: boolean; notes: string | null
  total_orders: number; total_revenue: number; avg_ticket: number; total_cost: number
  roas: number | null; sequences: Sequence[]; renewals: Renewal[]
  prev_orders?: number; prev_revenue?: number
}

type FormState = {
  name: string; instagram: string; tier: Tier; niche: string; followers: string
  coupon: string; startDate: string; endDate: string; feeType: FeeType
  monthlyFee: string; commission: string; notes: string; isActive: boolean
  sequences: { scheduled_date: string; content_type: string; description: string; status: SeqStatus; published_at: string }[]
}

const INITIAL_FORM: FormState = {
  name: '', instagram: '', tier: 'micro', niche: '', followers: '',
  coupon: '', startDate: '', endDate: '', feeType: 'fixed',
  monthlyFee: '', commission: '', notes: '', isActive: true,
  sequences: [
    { scheduled_date: '', content_type: '', description: '', status: 'pending', published_at: '' },
    { scheduled_date: '', content_type: '', description: '', status: 'pending', published_at: '' },
    { scheduled_date: '', content_type: '', description: '', status: 'pending', published_at: '' },
  ],
}

function toYMD(d: Date) { return d.toISOString().slice(0, 10) }
function getRange(p: Period, cFrom?: string, cTo?: string) {
  const today = toYMD(new Date())
  if (p === 'mes_atual') return { date_from: today.slice(0, 7) + '-01', date_to: today }
  if (p === 'custom' && cFrom && cTo) return { date_from: cFrom, date_to: cTo }
  const daysMap: Record<string, number> = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 }
  const since = new Date(); since.setDate(since.getDate() - (daysMap[p] ?? 30))
  return { date_from: toYMD(since), date_to: today }
}
function fmtBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtNum(v: number) { return v.toLocaleString('pt-BR') }
function daysRemaining(endDate: string | null) {
  if (!endDate) return null
  return Math.ceil((new Date(endDate + 'T00:00:00').getTime() - Date.now()) / 86400000)
}

export default function InfluencersTab({ workspaceId, initialView = 'consolidado' }: { workspaceId: string; initialView?: ViewType }) {
  const searchParams = useSearchParams()
  const urlView = searchParams.get('view') as ViewType | null
  const [view, setView] = useState<ViewType>(urlView || initialView)
  const [period, setPeriod] = useState<Period>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [appliedFrom, setAppliedFrom] = useState('')
  const [appliedTo, setAppliedTo] = useState('')
  const [data, setData] = useState<Performance[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedOrders, setExpandedOrders] = useState<any[]>([])
  const [expandLoading, setExpandLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [modalStep, setModalStep] = useState<ModalStep>(1)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [couponPreview, setCouponPreview] = useState<{ orders: number; revenue: number } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const couponTimeout = useRef<NodeJS.Timeout>(null)

  // Sync view with URL changes (sidebar navigation)
  useEffect(() => {
    const v = searchParams.get('view') as ViewType
    if (v && ['consolidado', 'macro', 'micro', 'ranking'].includes(v)) setView(v)
  }, [searchParams])

  function changeView(v: ViewType) {
    setView(v)
    try { window.history.replaceState(null, '', `/metricas?tab=influenciadores&view=${v}`) } catch {}
  }

  const fetchPerformance = useCallback(async () => {
    setLoading(true)
    const range = getRange(period, appliedFrom, appliedTo)
    const includeInactive = view === 'macro' || view === 'micro'
    const compare = view === 'ranking'
    try {
      const res = await fetch(
        `/api/influencers/performance?workspace_id=${workspaceId}&date_from=${range.date_from}&date_to=${range.date_to}&include_inactive=${includeInactive}&compare=${compare}`
      )
      const json = await res.json()
      setData(json.performance || [])
    } catch (err) { console.error('[influencers] fetch error:', err) }
    setLoading(false)
  }, [workspaceId, period, appliedFrom, appliedTo, view])

  useEffect(() => { fetchPerformance() }, [fetchPerformance])

  // Expand card orders
  async function handleExpand(inf: Performance) {
    if (expandedId === inf.id) { setExpandedId(null); return }
    setExpandedId(inf.id)
    setExpandLoading(true)
    setExpandedOrders([])
    try {
      const range = getRange(period, appliedFrom, appliedTo)
      const res = await fetch(`/api/influencers/orders?workspace_id=${workspaceId}&coupon_code=${encodeURIComponent(inf.coupon_code)}&date_from=${range.date_from}&date_to=${range.date_to}`)
      const json = await res.json()
      setExpandedOrders(json.orders || [])
    } catch {}
    setExpandLoading(false)
  }

  // Coupon preview
  async function previewCoupon(code: string) {
    if (!code.trim()) { setCouponPreview(null); return }
    setPreviewLoading(true)
    try {
      const res = await fetch(`/api/influencers/preview?workspace_id=${workspaceId}&coupon_code=${encodeURIComponent(code.toUpperCase())}`)
      const json = await res.json()
      setCouponPreview({ orders: json.orders || 0, revenue: json.revenue || 0 })
    } catch { setCouponPreview(null) }
    setPreviewLoading(false)
  }

  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm(f => ({ ...f, [key]: val }))
  }
  function setSeqField(idx: number, key: string, val: string) {
    setForm(f => {
      const seqs = [...f.sequences]
      seqs[idx] = { ...seqs[idx], [key]: val }
      return { ...f, sequences: seqs }
    })
  }

  function openAddModal() {
    setEditingId(null)
    setForm(INITIAL_FORM)
    setCouponPreview(null)
    setModalStep(1)
    setShowModal(true)
  }

  function openEditModal(inf: Performance) {
    setEditingId(inf.id)
    setForm({
      name: inf.name,
      instagram: inf.instagram?.replace('@', '') || '',
      tier: inf.tier || 'micro',
      niche: inf.niche || '',
      followers: inf.followers_count ? String(inf.followers_count) : '',
      coupon: inf.coupon_code,
      startDate: inf.start_date || '',
      endDate: inf.end_date || '',
      feeType: (inf.fee_type as FeeType) || 'fixed',
      monthlyFee: inf.monthly_fee > 0 ? String(inf.monthly_fee) : '',
      commission: inf.commission_pct > 0 ? String(inf.commission_pct) : '',
      notes: inf.notes || '',
      isActive: inf.is_active,
      sequences: [0, 1, 2].map(i => {
        const seq = inf.sequences.find(s => s.sequence_number === i + 1)
        return {
          scheduled_date: seq?.scheduled_date || '',
          content_type: seq?.content_type || '',
          description: seq?.description || '',
          status: (seq?.status as SeqStatus) || 'pending',
          published_at: seq?.published_at || '',
        }
      }),
    })
    setCouponPreview(null)
    setModalStep(1)
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.coupon.trim()) return
    setSaving(true)
    const body: any = {
      workspace_id: workspaceId,
      name: form.name.trim(),
      instagram: form.instagram.trim() || null,
      coupon_code: form.coupon.trim().toUpperCase(),
      fee_type: form.feeType,
      monthly_fee: parseFloat(form.monthlyFee.replace(/\./g, '').replace(',', '.')) || 0,
      commission_pct: parseFloat(form.commission.replace(',', '.')) || 0,
      start_date: form.startDate || null,
      end_date: form.endDate || null,
      notes: form.notes.trim() || null,
      is_active: form.isActive,
      tier: form.tier,
      niche: form.niche || null,
      followers_count: parseInt(form.followers.replace(/\D/g, '')) || null,
      contract_status: form.endDate && new Date(form.endDate) < new Date() ? 'expired' : 'active',
    }
    if (editingId) body.id = editingId

    try {
      const res = await fetch('/api/influencers', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.error) {
        showToast(`Erro: ${json.error}`)
        setSaving(false)
        return
      }
      const infId = editingId || json.influencer?.id
      if (infId) {
        const seqsToSave = form.sequences.filter(s => s.scheduled_date)
        if (seqsToSave.length > 0) {
          await fetch('/api/influencers/sequences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ influencer_id: infId, workspace_id: workspaceId, sequences: seqsToSave }),
          })
        }
      }
      setShowModal(false)
      showToast(editingId ? 'Atualizado!' : 'Adicionado!')
      fetchPerformance()
    } catch {
      showToast('Erro ao salvar.')
    }
    setSaving(false)
  }

  async function handleToggleActive(inf: Performance) {
    await fetch('/api/influencers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: inf.id, is_active: !inf.is_active }),
    })
    fetchPerformance()
  }

  async function handleRenew(inf: Performance) {
    const startDate = prompt('Data de inicio da renovacao (AAAA-MM-DD):')
    if (!startDate) return
    const endDate = prompt('Data de termino (AAAA-MM-DD, deixe vazio para indefinido):') || null
    await fetch('/api/influencers/renewals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        influencer_id: inf.id,
        workspace_id: workspaceId,
        start_date: startDate,
        end_date: endDate,
        fee_type: inf.fee_type,
        monthly_fee: inf.monthly_fee,
        commission_pct: inf.commission_pct,
      }),
    })
    await fetch('/api/influencers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: inf.id, start_date: startDate, end_date: endDate, contract_status: 'renewed' }),
    })
    showToast('Contrato renovado!')
    fetchPerformance()
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // ── Computed ──
  const activeData = data.filter(d => d.is_active)
  const macros = activeData.filter(d => d.tier === 'macro')
  const micros = activeData.filter(d => d.tier === 'micro')

  function tierStats(list: Performance[]) {
    const count = list.length
    const revenue = list.reduce((s, d) => s + d.total_revenue, 0)
    const cost = list.reduce((s, d) => s + d.total_cost, 0)
    const withRoas = list.filter(d => d.roas !== null && d.total_orders > 0)
    const avgRoas = withRoas.length > 0 ? withRoas.reduce((s, d) => s + (d.roas ?? 0), 0) / withRoas.length : null
    return { count, revenue, cost, avgRoas }
  }
  const macroStats = tierStats(macros)
  const microStats = tierStats(micros)

  const showFixedFee = form.feeType === 'fixed' || form.feeType === 'fixed_commission'
  const showCommission = form.feeType === 'commission' || form.feeType === 'fixed_commission'

  // Ranking sorted by ROAS desc
  const ranked = [...activeData].sort((a, b) => (b.roas ?? -1) - (a.roas ?? -1))

  // Tier-filtered data for macro/micro views (includes inactive)
  const tierViewData = (view === 'macro' || view === 'micro') ? data.filter(d => d.tier === view) : []
  const tierViewActive = tierViewData.filter(d => d.is_active).length
  const tierViewRevenue = tierViewData.reduce((s, d) => s + d.total_revenue, 0)
  const tierViewCost = tierViewData.reduce((s, d) => s + d.total_cost, 0)
  const tierViewWithRoas = tierViewData.filter(d => d.roas !== null && d.total_orders > 0)
  const tierViewAvgRoas = tierViewWithRoas.length > 0 ? tierViewWithRoas.reduce((s, d) => s + (d.roas ?? 0), 0) / tierViewWithRoas.length : null

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-[60] bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg">{toast}</div>
      )}

      {/* Period filters + Add button */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 md:gap-2 flex-1">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-2 py-1 md:px-3 md:py-1.5 text-xs md:text-sm rounded-lg font-medium transition-all cursor-pointer ${
                period === p.key ? 'bg-brand-gold text-bg-base shadow-sm' : 'bg-bg-card border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`}>{p.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {loading && <span className="text-xs text-text-muted">Carregando...</span>}
          <button onClick={openAddModal}
            className="px-3 py-1.5 text-sm rounded-lg font-medium bg-brand-gold text-bg-base hover:opacity-90 cursor-pointer flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            <span className="hidden sm:inline">Adicionar</span>
          </button>
        </div>
      </div>
      {period === 'custom' && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-text-muted text-xs">De:</span>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="bg-bg-card border border-border rounded-lg px-2 py-1 text-xs text-text-primary flex-1 min-w-[130px]" />
          <span className="text-text-muted text-xs">Ate:</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="bg-bg-card border border-border rounded-lg px-2 py-1 text-xs text-text-primary flex-1 min-w-[130px]" />
          <button onClick={() => { setAppliedFrom(customFrom); setAppliedTo(customTo) }} disabled={!customFrom || !customTo}
            className="px-4 py-1.5 text-sm rounded-lg font-medium bg-brand-gold text-bg-base hover:opacity-90 disabled:opacity-40 cursor-pointer">Buscar</button>
        </div>
      )}

      {/* View sub-tabs */}
      <div className="flex gap-1 bg-bg-card border border-border rounded-xl p-1 overflow-x-auto">
        {VIEWS.map(v => (
          <button key={v.key} onClick={() => changeView(v.key)}
            className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              view === v.key ? 'bg-brand-gold text-bg-base shadow-sm' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
            }`}>{v.label}</button>
        ))}
      </div>

      {/* ═══════ VIEW: CONSOLIDADO ═══════ */}
      {view === 'consolidado' && (
        <>
          {/* Macro KPIs */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7C3AED' }}>Macro</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Macros Ativas" value={String(macroStats.count)} />
              <KpiCard label="Receita Macros" value={fmtBRL(macroStats.revenue)} color="gold" />
              <KpiCard label="Custo Macros" value={fmtBRL(macroStats.cost)} color="red" />
              <KpiCard label="ROAS Medio" value={macroStats.avgRoas !== null ? `${macroStats.avgRoas.toFixed(1)}x` : '--'} roasValue={macroStats.avgRoas} />
            </div>
          </div>
          {/* Micro KPIs */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#2563EB' }}>Micro</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Micros Ativas" value={String(microStats.count)} />
              <KpiCard label="Receita Micros" value={fmtBRL(microStats.revenue)} color="gold" />
              <KpiCard label="Custo Micros" value={fmtBRL(microStats.cost)} color="red" />
              <KpiCard label="ROAS Medio" value={microStats.avgRoas !== null ? `${microStats.avgRoas.toFixed(1)}x` : '--'} roasValue={microStats.avgRoas} />
            </div>
          </div>
          {/* Comparison chart */}
          <div className="bg-bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold text-sm mb-4" style={{ color: '#C9971A' }}>Comparativo ROAS: Macro vs Micro</h3>
            <div className="space-y-4">
              {[{ label: 'Macro', val: macroStats.avgRoas, color: '#7C3AED' }, { label: 'Micro', val: microStats.avgRoas, color: '#2563EB' }].map(item => {
                const max = Math.max(macroStats.avgRoas || 0, microStats.avgRoas || 0, 1)
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-text-secondary flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ background: item.color }} />{item.label}
                      </span>
                      <span className="text-sm font-mono text-text-primary">{item.val !== null ? `${item.val.toFixed(1)}x` : '--'}</span>
                    </div>
                    <div className="h-6 bg-bg-surface rounded-lg overflow-hidden">
                      <div className="h-full rounded-lg transition-all duration-500" style={{ width: `${((item.val || 0) / max) * 100}%`, background: item.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          {activeData.length === 0 && !loading && (
            <div className="bg-bg-card border border-border rounded-xl p-8 text-center">
              <p className="text-text-muted text-sm">Nenhuma influenciadora cadastrada.</p>
            </div>
          )}
        </>
      )}

      {/* ═══════ VIEW: MACRO / MICRO ═══════ */}
      {(view === 'macro' || view === 'micro') && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Ativas" value={String(tierViewActive)} />
            <KpiCard label="Receita Total" value={fmtBRL(tierViewRevenue)} color="gold" />
            <KpiCard label="Custo Total" value={fmtBRL(tierViewCost)} color="red" />
            <KpiCard label="ROAS Medio" value={tierViewAvgRoas !== null ? `${tierViewAvgRoas.toFixed(1)}x` : '--'} roasValue={tierViewAvgRoas} />
          </div>

          {/* Cards grid */}
          {tierViewData.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tierViewData.map(inf => (
                <InfluencerCard
                  key={inf.id}
                  inf={inf}
                  expanded={expandedId === inf.id}
                  expandLoading={expandLoading}
                  expandedOrders={expandedOrders}
                  onExpand={() => handleExpand(inf)}
                  onEdit={() => openEditModal(inf)}
                  onRenew={() => handleRenew(inf)}
                  onToggle={() => handleToggleActive(inf)}
                />
              ))}
            </div>
          ) : !loading ? (
            <div className="bg-bg-card border border-border rounded-xl p-8 text-center">
              <p className="text-text-muted text-sm">Nenhuma influenciadora {view} cadastrada.</p>
            </div>
          ) : null}
        </>
      )}

      {/* ═══════ VIEW: RANKING ═══════ */}
      {view === 'ranking' && (
        <>
          {/* Podium */}
          {ranked.length > 0 && (
            <div className="flex items-end justify-center gap-4 md:gap-8 pt-4 pb-2">
              {ranked.length > 1 && <PodiumCard rank={2} inf={ranked[1]} h="h-24" />}
              <PodiumCard rank={1} inf={ranked[0]} h="h-32" />
              {ranked.length > 2 && <PodiumCard rank={3} inf={ranked[2]} h="h-16" />}
            </div>
          )}
          {/* Ranking table */}
          {ranked.length > 0 ? (
            <div className="bg-bg-card border border-border rounded-xl p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left" style={{ color: '#C9971A' }}>
                      <th className="pb-2 pr-2 w-8 text-xs font-medium sticky left-0 bg-bg-card z-10">#</th>
                      <th className="pb-2 pr-2 text-xs font-medium sticky left-8 bg-bg-card z-10">Nome</th>
                      <th className="pb-2 pr-2 text-xs font-medium">Tier</th>
                      <th className="pb-2 pr-2 text-xs font-medium">Cupom</th>
                      <th className="pb-2 pr-2 text-xs font-medium text-right">Pedidos</th>
                      <th className="pb-2 pr-2 text-xs font-medium text-right">Receita</th>
                      <th className="pb-2 pr-2 text-xs font-medium text-right">Investimento</th>
                      <th className="pb-2 pr-2 text-xs font-medium text-right">ROAS</th>
                      <th className="pb-2 text-xs font-medium text-right">Tendencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.map((inf, i) => {
                      const trend = inf.prev_revenue !== undefined && inf.prev_revenue > 0
                        ? ((inf.total_revenue - inf.prev_revenue) / inf.prev_revenue * 100)
                        : null
                      return (
                        <tr key={inf.id} className="border-b border-border/50 last:border-0 hover:bg-bg-hover/50 transition-colors">
                          <td className="py-2.5 pr-2 text-text-muted sticky left-0 bg-bg-card z-10">{i + 1}</td>
                          <td className="py-2.5 pr-2 text-text-primary font-medium sticky left-8 bg-bg-card z-10">{inf.name}</td>
                          <td className="py-2.5 pr-2"><TierBadge tier={inf.tier} /></td>
                          <td className="py-2.5 pr-2">
                            <span className="px-2 py-0.5 rounded bg-bg-surface text-text-secondary text-xs font-mono border border-border">{inf.coupon_code}</span>
                          </td>
                          <td className="py-2.5 pr-2 text-right text-text-secondary">{fmtNum(inf.total_orders)}</td>
                          <td className="py-2.5 pr-2 text-right font-medium text-emerald-400">{fmtBRL(inf.total_revenue)}</td>
                          <td className="py-2.5 pr-2 text-right text-red-400">{inf.total_cost > 0 ? fmtBRL(inf.total_cost) : '--'}</td>
                          <td className="py-2.5 pr-2 text-right">
                            {inf.roas !== null ? (
                              <span className={`font-medium ${inf.roas >= 3 ? 'text-emerald-400' : inf.roas >= 1 ? 'text-yellow-400' : 'text-red-400'}`}>
                                {inf.roas.toFixed(1)}x
                              </span>
                            ) : '--'}
                          </td>
                          <td className="py-2.5 text-right">
                            {trend !== null ? (
                              <span className={`text-xs font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {trend >= 0 ? '\u2191' : '\u2193'} {Math.abs(trend).toFixed(0)}%
                              </span>
                            ) : <span className="text-text-muted text-xs">--</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : !loading ? (
            <div className="bg-bg-card border border-border rounded-xl p-8 text-center">
              <p className="text-text-muted text-sm">Nenhuma influenciadora ativa com dados.</p>
            </div>
          ) : null}
        </>
      )}

      {/* ═══════ MULTI-STEP MODAL ═══════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60" onClick={() => setShowModal(false)}>
          <div className="relative w-full max-w-lg md:mx-4 max-h-[95vh] md:max-h-[90vh] flex flex-col rounded-t-2xl md:rounded-xl bg-bg-card border border-border" onClick={e => e.stopPropagation()}>
            {/* ── Sticky header ── */}
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-border bg-bg-card rounded-t-2xl md:rounded-t-xl z-10 shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">
                  {editingId ? 'Editar Influenciadora' : 'Adicionar Influenciadora'}
                </h3>
                {/* Step indicator inline */}
                <div className="flex items-center gap-1.5 mt-1">
                  {[1, 2, 3].map(s => (
                    <div key={s} className="flex items-center gap-1">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        modalStep === s ? 'bg-brand-gold text-bg-base' : modalStep > s ? 'bg-emerald-500/20 text-emerald-400' : 'bg-bg-surface text-text-muted'
                      }`}>{modalStep > s ? '\u2713' : s}</div>
                      <span className={`text-[10px] hidden sm:inline ${modalStep === s ? 'text-text-primary font-medium' : 'text-text-muted'}`}>
                        {s === 1 ? 'Perfil' : s === 2 ? 'Contrato' : 'Sequencias'}
                      </span>
                      {s < 3 && <div className={`w-4 h-px ${modalStep > s ? 'bg-emerald-500/40' : 'bg-border'}`} />}
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 -mr-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors cursor-pointer shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* ── Scrollable content ── */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {/* STEP 1: Perfil */}
              {modalStep === 1 && (
                <>
                  <Field label="Nome *">
                    <input type="text" value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Nome da influenciadora" className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-gold" />
                  </Field>
                  <Field label="Instagram *">
                    <div className="flex items-center">
                      <span className="text-sm text-text-muted mr-1">@</span>
                      <input type="text" value={form.instagram} onChange={e => setField('instagram', e.target.value)} placeholder="usuario" className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-gold" />
                    </div>
                  </Field>
                  <Field label="Tier">
                    <div className="flex gap-2">
                      <button onClick={() => setField('tier', 'macro')}
                        className={`flex-1 px-3 py-2 text-sm rounded-lg font-medium transition-all cursor-pointer border ${
                          form.tier === 'macro' ? 'text-white border-purple-500' : 'bg-bg-surface border-border text-text-secondary hover:bg-bg-hover'
                        }`} style={form.tier === 'macro' ? { background: '#7C3AED' } : {}}>MACRO</button>
                      <button onClick={() => setField('tier', 'micro')}
                        className={`flex-1 px-3 py-2 text-sm rounded-lg font-medium transition-all cursor-pointer border ${
                          form.tier === 'micro' ? 'text-white border-blue-500' : 'bg-bg-surface border-border text-text-secondary hover:bg-bg-hover'
                        }`} style={form.tier === 'micro' ? { background: '#2563EB' } : {}}>MICRO</button>
                    </div>
                  </Field>
                  <Field label="Nicho">
                    <select value={form.niche} onChange={e => setField('niche', e.target.value)} className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-gold">
                      <option value="">Selecione</option>
                      {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </Field>
                  <Field label="Seguidores">
                    <input type="text" value={form.followers} onChange={e => setField('followers', e.target.value.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.'))} placeholder="120.000" className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-gold" />
                  </Field>
                  <Field label="Cupom *">
                    <input type="text" value={form.coupon}
                      onChange={e => {
                        const v = e.target.value.toUpperCase()
                        setField('coupon', v)
                        setCouponPreview(null)
                        if (couponTimeout.current) clearTimeout(couponTimeout.current)
                        couponTimeout.current = setTimeout(() => previewCoupon(v), 500)
                      }}
                      className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-gold font-mono" placeholder="CODIGO" />
                    {previewLoading && <p className="text-[11px] text-text-muted mt-1">Buscando...</p>}
                    {couponPreview && !previewLoading && (
                      <p className={`text-[11px] mt-1 ${couponPreview.orders > 0 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                        {couponPreview.orders > 0 ? `${couponPreview.orders} pedidos encontrados, ${fmtBRL(couponPreview.revenue)} em receita` : 'Nenhum pedido encontrado com este cupom'}
                      </p>
                    )}
                  </Field>
                </>
              )}

              {/* STEP 2: Contrato */}
              {modalStep === 2 && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Data de inicio *">
                      <input type="date" value={form.startDate} onChange={e => setField('startDate', e.target.value)} className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-gold" />
                    </Field>
                    <Field label="Data de termino">
                      <input type="date" value={form.endDate} onChange={e => setField('endDate', e.target.value)} className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-gold" />
                    </Field>
                  </div>
                  <Field label="Tipo de Pagamento">
                    <div className="flex gap-1.5">
                      {FEE_TYPES.map(ft => (
                        <button key={ft.key} onClick={() => setField('feeType', ft.key)}
                          className={`flex-1 px-2 py-1.5 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                            form.feeType === ft.key ? 'bg-brand-gold text-bg-base' : 'bg-bg-surface border border-border text-text-secondary hover:bg-bg-hover'
                          }`}>{ft.label}</button>
                      ))}
                    </div>
                  </Field>
                  {showFixedFee && (
                    <Field label="Valor Mensal">
                      <div className="flex items-center">
                        <span className="text-sm text-text-muted mr-1">R$</span>
                        <input type="text" value={form.monthlyFee} onChange={e => setField('monthlyFee', e.target.value)} placeholder="0,00" className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-gold" />
                      </div>
                    </Field>
                  )}
                  {showCommission && (
                    <Field label="Comissao (%)">
                      <input type="text" value={form.commission} onChange={e => setField('commission', e.target.value)} placeholder="10" className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-gold" />
                    </Field>
                  )}
                  <Field label="Notas do contrato">
                    <textarea value={form.notes} onChange={e => setField('notes', e.target.value)} rows={2} className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-gold resize-none" placeholder="Observacoes..." />
                  </Field>
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-text-muted">Status:</label>
                    <button onClick={() => setField('isActive', !form.isActive)}
                      className={`px-3 py-1 text-xs rounded-full font-medium transition-colors cursor-pointer ${
                        form.isActive ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/15 text-red-400 border border-red-500/20'
                      }`}>{form.isActive ? 'Ativa' : 'Inativa'}</button>
                  </div>
                </>
              )}

              {/* STEP 3: Sequencias */}
              {modalStep === 3 && (
                <>
                  {form.sequences.map((seq, i) => (
                    <div key={i} className="bg-bg-surface/50 border border-border rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold text-text-primary">Sequencia {i + 1}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Data programada *" compact>
                          <input type="date" value={seq.scheduled_date} onChange={e => setSeqField(i, 'scheduled_date', e.target.value)} className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-gold text-xs" />
                        </Field>
                        <Field label="Tipo de conteudo" compact>
                          <div className="flex gap-1">
                            {CONTENT_TYPES.map(ct => (
                              <button key={ct.key} onClick={() => setSeqField(i, 'content_type', ct.key)}
                                className={`flex-1 px-1 py-1 text-[10px] rounded font-medium transition-all cursor-pointer ${
                                  seq.content_type === ct.key ? 'bg-brand-gold text-bg-base' : 'bg-bg-surface border border-border text-text-muted hover:bg-bg-hover'
                                }`}>{ct.label}</button>
                            ))}
                          </div>
                        </Field>
                      </div>
                      <Field label="Descricao" compact>
                        <input type="text" value={seq.description} onChange={e => setSeqField(i, 'description', e.target.value)} className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-gold text-xs" placeholder="O que foi combinado" />
                      </Field>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Status" compact>
                          <div className="flex gap-1">
                            {(['pending', 'published', 'delayed'] as SeqStatus[]).map(s => (
                              <button key={s} onClick={() => setSeqField(i, 'status', s)}
                                className={`flex-1 px-1 py-1 text-[10px] rounded font-medium transition-all cursor-pointer ${
                                  seq.status === s
                                    ? s === 'published' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : s === 'delayed' ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                    : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                    : 'bg-bg-surface border border-border text-text-muted hover:bg-bg-hover'
                                }`}>{s === 'pending' ? 'Pendente' : s === 'published' ? 'Publicado' : 'Atrasado'}</button>
                            ))}
                          </div>
                        </Field>
                        {seq.status === 'published' && (
                          <Field label="Data de publicacao" compact>
                            <input type="date" value={seq.published_at} onChange={e => setSeqField(i, 'published_at', e.target.value)} className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-gold text-xs" />
                          </Field>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* ── Sticky footer ── */}
            <div className="sticky bottom-0 flex gap-3 px-5 py-4 border-t border-border bg-bg-card rounded-b-xl shrink-0">
              {modalStep > 1 ? (
                <button onClick={() => setModalStep((modalStep - 1) as ModalStep)}
                  className="px-4 py-2.5 text-sm rounded-lg border border-border text-text-secondary hover:bg-bg-hover cursor-pointer transition-colors">Voltar</button>
              ) : (
                <button onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 text-sm rounded-lg border border-border text-text-secondary hover:bg-bg-hover cursor-pointer transition-colors">Cancelar</button>
              )}
              <div className="flex-1" />
              {modalStep < 3 ? (
                <button onClick={() => setModalStep((modalStep + 1) as ModalStep)}
                  disabled={modalStep === 1 && (!form.name.trim() || !form.coupon.trim())}
                  className="px-5 py-2.5 text-sm rounded-lg font-medium bg-brand-gold text-bg-base hover:opacity-90 disabled:opacity-40 cursor-pointer transition-opacity">Proximo</button>
              ) : (
                <button onClick={handleSave} disabled={saving}
                  className="px-5 py-2.5 text-sm rounded-lg font-medium bg-brand-gold text-bg-base hover:opacity-90 disabled:opacity-40 cursor-pointer transition-opacity">
                  {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Adicionar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════
   Sub-components
   ══════════════════════════════════════════════ */

function InfluencerCard({ inf, expanded, expandLoading, expandedOrders, onExpand, onEdit, onRenew, onToggle }: {
  inf: Performance; expanded: boolean; expandLoading: boolean; expandedOrders: any[]
  onExpand: () => void; onEdit: () => void; onRenew: () => void; onToggle: () => void
}) {
  const dr = daysRemaining(inf.end_date)
  const barColor = dr === null ? 'bg-text-muted/30' : dr > 30 ? 'bg-emerald-400' : dr > 7 ? 'bg-yellow-400' : 'bg-red-400'
  const textColor = dr === null ? 'text-text-muted' : dr > 30 ? 'text-emerald-400' : dr > 7 ? 'text-yellow-400' : 'text-red-400'

  // Contract progress percentage
  const contractProgress = (() => {
    if (!inf.start_date || !inf.end_date) return null
    const start = new Date(inf.start_date + 'T00:00:00').getTime()
    const end = new Date(inf.end_date + 'T00:00:00').getTime()
    const now = Date.now()
    const total = end - start
    if (total <= 0) return 100
    return Math.min(100, Math.max(0, ((now - start) / total) * 100))
  })()

  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 space-y-3">
      {/* Top: Name + badge + status dot */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <h4 className="text-sm font-semibold text-text-primary truncate">{inf.name}</h4>
          <TierBadge tier={inf.tier} />
        </div>
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-0.5 ${inf.is_active ? 'bg-emerald-400' : 'bg-red-400'}`} title={inf.is_active ? 'Ativa' : 'Inativa'} />
      </div>

      {/* Instagram */}
      {inf.instagram && (
        <p className="text-xs text-text-muted">@{inf.instagram.replace('@', '')}</p>
      )}

      {/* Coupon pill */}
      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-mono font-medium"
        style={{ background: '#ECA20615', color: '#ECA206', border: '1px solid #ECA20630' }}>
        {inf.coupon_code}
      </span>

      {/* Metrics row */}
      <div className="flex items-center py-2.5 border-t border-b border-border/50">
        <div className="text-center flex-1">
          <p className="text-[10px] text-text-muted uppercase tracking-wide">Pedidos</p>
          <p className="text-sm font-semibold text-text-primary mt-0.5">{fmtNum(inf.total_orders)}</p>
        </div>
        <div className="w-px h-8 bg-border/50" />
        <div className="text-center flex-1">
          <p className="text-[10px] text-text-muted uppercase tracking-wide">Receita</p>
          <p className="text-sm font-semibold text-emerald-400 mt-0.5">{fmtBRL(inf.total_revenue)}</p>
        </div>
        <div className="w-px h-8 bg-border/50" />
        <div className="text-center flex-1">
          <p className="text-[10px] text-text-muted uppercase tracking-wide">ROAS</p>
          <p className={`text-sm font-semibold mt-0.5 ${inf.roas !== null ? (inf.roas >= 3 ? 'text-emerald-400' : inf.roas >= 1 ? 'text-yellow-400' : 'text-red-400') : 'text-text-muted'}`}>
            {inf.roas !== null ? `${inf.roas.toFixed(1)}x` : '--'}
          </p>
        </div>
      </div>

      {/* Contract bar */}
      {inf.start_date && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-text-muted">{inf.start_date}</span>
            <span className="text-text-muted">{inf.end_date || '\u221E'}</span>
          </div>
          {contractProgress !== null && (
            <div className="h-1.5 bg-bg-surface rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${contractProgress}%` }} />
            </div>
          )}
          {dr !== null && (
            <p className={`text-[10px] ${textColor}`}>
              {dr > 0 ? `${dr} dias restantes` : dr === 0 ? 'Expira hoje' : `Expirado ha ${Math.abs(dr)} dias`}
            </p>
          )}
        </div>
      )}

      {/* Sequence dots */}
      {inf.sequences.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-text-muted mr-0.5">Seq:</span>
          <SeqDots sequences={inf.sequences} />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button onClick={onEdit} className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-bg-surface border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors cursor-pointer">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          <span>Editar</span>
        </button>
        <button onClick={onRenew} className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-bg-surface border border-border text-text-secondary hover:bg-bg-hover hover:text-emerald-400 transition-colors cursor-pointer">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          <span>Renovar</span>
        </button>
        <button onClick={onExpand} className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border transition-colors cursor-pointer ${expanded ? 'bg-brand-gold/10 border-brand-gold/30 text-brand-gold' : 'bg-bg-surface border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary'}`}>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          <span>Ver pedidos</span>
        </button>
      </div>

      {/* Expanded orders panel */}
      {expanded && (
        <div className="bg-bg-surface/50 rounded-lg p-3 space-y-2 border border-border/50 mt-1">
          {expandLoading ? (
            <p className="text-xs text-text-muted">Carregando pedidos...</p>
          ) : expandedOrders.length > 0 ? (
            <>
              <p className="text-xs font-semibold text-text-primary mb-2">Ultimos Pedidos</p>
              <div className="space-y-0.5">
                {expandedOrders.slice(0, 10).map((o: any, j: number) => (
                  <div key={j} className="flex items-center justify-between text-xs py-1.5 border-b border-border/30 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-text-muted">{o.date}</span>
                      <span className="text-text-secondary font-mono">#{String(o.order_id).slice(-6)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-medium">{fmtBRL(o.revenue)}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        o.status === 'delivered' ? 'bg-emerald-500/15 text-emerald-400' : o.status === 'shipped' ? 'bg-blue-500/15 text-blue-400' : 'bg-yellow-500/15 text-yellow-400'
                      }`}>{o.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-text-muted">Nenhum pedido no periodo.</p>
          )}
        </div>
      )}
    </div>
  )
}

function PodiumCard({ rank, inf, h }: { rank: number; inf: Performance; h: string }) {
  const color = rank === 1 ? '#ECA206' : rank === 2 ? '#9CA3AF' : '#B45309'
  return (
    <div className="flex flex-col items-center w-24 md:w-32">
      <div className="w-10 h-10 rounded-full bg-bg-surface border-2 flex items-center justify-center mb-1" style={{ borderColor: color }}>
        <span className="text-sm font-bold" style={{ color }}>{inf.name[0]?.toUpperCase()}</span>
      </div>
      <p className="text-xs text-text-primary font-medium text-center truncate w-full">{inf.name}</p>
      <p className="text-[10px] text-text-muted">{inf.roas !== null ? `${inf.roas.toFixed(1)}x ROAS` : '--'}</p>
      <TierBadge tier={inf.tier} />
      <div className={`w-full ${h} rounded-t-lg mt-1 flex items-end justify-center pb-2`}
        style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
        <span className="text-lg font-bold" style={{ color }}>#{rank}</span>
      </div>
    </div>
  )
}

function TierBadge({ tier }: { tier: Tier }) {
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0"
      style={tier === 'macro' ? { background: '#7C3AED20', color: '#A78BFA' } : { background: '#2563EB20', color: '#60A5FA' }}>
      {tier}
    </span>
  )
}

function SeqDots({ sequences }: { sequences: Sequence[] }) {
  const dots = [1, 2, 3].map(n => {
    const seq = sequences.find(s => s.sequence_number === n)
    if (!seq) return 'bg-bg-surface'
    return seq.status === 'published' ? 'bg-emerald-400' : seq.status === 'delayed' ? 'bg-red-400' : 'bg-yellow-400'
  })
  return (
    <div className="flex gap-1">
      {dots.map((cls, i) => <span key={i} className={`w-2.5 h-2.5 rounded-full ${cls}`} />)}
    </div>
  )
}

function KpiCard({ label, value, color, roasValue }: { label: string; value: string; color?: 'gold' | 'red'; roasValue?: number | null }) {
  let textCls = 'text-text-primary'
  if (color === 'gold') textCls = 'text-brand-gold'
  else if (color === 'red') textCls = 'text-red-400'
  else if (roasValue !== undefined && roasValue !== null) {
    textCls = roasValue >= 3 ? 'text-emerald-400' : roasValue >= 1 ? 'text-yellow-400' : 'text-red-400'
  }
  return (
    <div className="kpi-card">
      <p className="text-text-muted text-xs font-medium tracking-wide uppercase mb-2">{label}</p>
      <p className={`font-data text-lg font-semibold leading-none ${textCls}`}>{value}</p>
    </div>
  )
}

function Field({ label, children, compact }: { label: string; children: React.ReactNode; compact?: boolean }) {
  return (
    <div>
      <label className={`text-text-muted mb-1 block ${compact ? 'text-[10px]' : 'text-xs'}`}>{label}</label>
      {children}
    </div>
  )
}
