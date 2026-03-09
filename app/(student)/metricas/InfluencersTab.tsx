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
type ContractMode = 'month' | 'months' | 'custom'

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
  cost?: number
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
  prev_orders?: number; prev_revenue?: number; total_sequences?: number
}

type SeqForm = { scheduled_date: string; content_type: string; description: string; status: SeqStatus; published_at: string; cost: number }

type FormState = {
  name: string; instagram: string; tier: Tier; niche: string; followers: string
  coupon: string; startDate: string; endDate: string; feeType: FeeType
  monthlyFee: string; commission: string; notes: string; isActive: boolean
  totalSequences: number; sequences: SeqForm[]
  contractMode: ContractMode; contractMonth: string; contractDuration: number
  createCouponYampi: boolean; discountType: 'percent' | 'value'; discountValue: string; maxUses: string
}

function makeEmptySeq(): SeqForm {
  return { scheduled_date: '', content_type: '', description: '', status: 'pending', published_at: '', cost: 0 }
}

const INITIAL_FORM: FormState = {
  name: '', instagram: '', tier: 'micro', niche: '', followers: '',
  coupon: '', startDate: '', endDate: '', feeType: 'fixed',
  monthlyFee: '', commission: '', notes: '', isActive: true,
  totalSequences: 3, sequences: [makeEmptySeq(), makeEmptySeq(), makeEmptySeq()],
  contractMode: 'month', contractMonth: '', contractDuration: 1,
  createCouponYampi: false, discountType: 'percent', discountValue: '', maxUses: '',
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
function fmtDateBR(d: string) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
function lastDayOfMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}
function getCurrentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
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
  const [showModal, setShowModal] = useState(false)
  const [modalStep, setModalStep] = useState<ModalStep>(1)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [couponPreview, setCouponPreview] = useState<{ orders: number; revenue: number } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const couponTimeout = useRef<NodeJS.Timeout>(null)
  // Renewal modal
  const [showRenewalModal, setShowRenewalModal] = useState(false)
  const [renewTarget, setRenewTarget] = useState<Performance | null>(null)
  const [renewForm, setRenewForm] = useState({ startDate: '', endDate: '', monthlyFee: '', commission: '', feeType: 'fixed' as FeeType, contractMode: 'month' as ContractMode, contractMonth: '', contractDuration: 1 })
  const [renewSaving, setRenewSaving] = useState(false)
  // Seq popover
  const [seqPopoverId, setSeqPopoverId] = useState<string | null>(null)

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
  function setSeqField(idx: number, key: string, val: string | number) {
    setForm(f => {
      const seqs = [...f.sequences]
      seqs[idx] = { ...seqs[idx], [key]: val }
      return { ...f, sequences: seqs }
    })
  }

  // Auto-update sequences count
  function setTotalSequences(n: number) {
    const clamped = Math.max(1, Math.min(20, n))
    setForm(f => {
      const seqs = [...f.sequences]
      while (seqs.length < clamped) seqs.push(makeEmptySeq())
      while (seqs.length > clamped) seqs.pop()
      // Recalculate costs
      const fee = parseFloat(f.monthlyFee.replace(/\./g, '').replace(',', '.')) || 0
      const costPer = clamped > 0 ? fee / clamped : 0
      return { ...f, totalSequences: clamped, sequences: seqs.map(s => ({ ...s, cost: Math.round(costPer * 100) / 100 })) }
    })
  }

  // Auto-recalculate sequence costs when fee or total changes
  function recalcSeqCosts(fee: number, total: number, seqs: SeqForm[]): SeqForm[] {
    const costPer = total > 0 ? fee / total : 0
    return seqs.map(s => ({ ...s, cost: Math.round(costPer * 100) / 100 }))
  }

  // Contract date helpers
  function applyContractDates(mode: ContractMode, month: string, duration: number) {
    if (mode === 'month' && month) {
      const [y, m] = month.split('-').map(Number)
      const start = `${y}-${String(m).padStart(2, '0')}-01`
      const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDayOfMonth(y, m)).padStart(2, '0')}`
      setForm(f => ({ ...f, startDate: start, endDate: end, contractMode: mode, contractMonth: month }))
    } else if (mode === 'months' && month && duration > 0) {
      const [y, m] = month.split('-').map(Number)
      const start = `${y}-${String(m).padStart(2, '0')}-01`
      const endMonth = new Date(y, m - 1 + duration, 0)
      const end = toYMD(endMonth)
      setForm(f => ({ ...f, startDate: start, endDate: end, contractMode: mode, contractMonth: month, contractDuration: duration }))
    }
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
    const totalSeqs = inf.total_sequences || inf.sequences.length || 3
    const fee = inf.monthly_fee || 0
    const costPer = totalSeqs > 0 ? fee / totalSeqs : 0
    const seqs: SeqForm[] = Array.from({ length: totalSeqs }, (_, i) => {
      const seq = inf.sequences.find(s => s.sequence_number === i + 1)
      return {
        scheduled_date: seq?.scheduled_date || '',
        content_type: seq?.content_type || '',
        description: seq?.description || '',
        status: (seq?.status as SeqStatus) || 'pending',
        published_at: seq?.published_at || '',
        cost: seq?.cost ?? Math.round(costPer * 100) / 100,
      }
    })
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
      totalSequences: totalSeqs,
      sequences: seqs,
      contractMode: 'custom',
      contractMonth: '',
      contractDuration: 1,
      createCouponYampi: false, discountType: 'percent', discountValue: '', maxUses: '',
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
      total_sequences: form.totalSequences,
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
      // Yampi coupon creation
      if (!editingId && form.createCouponYampi && form.discountValue) {
        try {
          const couponRes = await fetch('/api/influencers/create-coupon', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workspace_id: workspaceId,
              coupon_code: form.coupon.trim().toUpperCase(),
              discount_type: form.discountType,
              discount_value: parseFloat(form.discountValue) || 0,
              max_uses: form.maxUses ? parseInt(form.maxUses) : null,
            }),
          })
          const couponJson = await couponRes.json()
          if (couponJson.cloudflare_blocked) {
            showToast('Influenciadora salva. Crie o cupom manualmente na Yampi.')
          } else if (couponJson.success) {
            showToast('Adicionado + cupom criado na Yampi!')
          } else {
            showToast('Influenciadora salva. Erro ao criar cupom.')
          }
        } catch {
          showToast('Influenciadora salva. Erro ao criar cupom.')
        }
      } else {
        showToast(editingId ? 'Atualizado!' : 'Adicionado!')
      }
      setShowModal(false)
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
      body: JSON.stringify({ id: inf.id, workspace_id: workspaceId, is_active: !inf.is_active }),
    })
    fetchPerformance()
  }

  function openRenewalModal(inf: Performance) {
    setRenewTarget(inf)
    setRenewForm({
      startDate: '', endDate: '', monthlyFee: '', commission: '',
      feeType: (inf.fee_type as FeeType) || 'fixed',
      contractMode: 'month', contractMonth: getCurrentMonth(), contractDuration: 1,
    })
    setShowRenewalModal(true)
  }

  async function handleRenewalSave() {
    if (!renewTarget || !renewForm.startDate) return
    setRenewSaving(true)
    const fee = parseFloat(renewForm.monthlyFee.replace(/\./g, '').replace(',', '.')) || 0
    const commission = parseFloat(renewForm.commission.replace(',', '.')) || 0
    // Create renewal record
    await fetch('/api/influencers/renewals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        influencer_id: renewTarget.id,
        workspace_id: workspaceId,
        start_date: renewForm.startDate,
        end_date: renewForm.endDate || null,
        fee_type: renewForm.feeType,
        monthly_fee: fee,
        commission_pct: commission,
      }),
    })
    // Update influencer base record
    await fetch('/api/influencers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: renewTarget.id,
        workspace_id: workspaceId,
        start_date: renewForm.startDate,
        end_date: renewForm.endDate || null,
        monthly_fee: fee,
        commission_pct: commission,
        fee_type: renewForm.feeType,
        contract_status: 'renewed',
      }),
    })
    setRenewSaving(false)
    setShowRenewalModal(false)
    showToast('Contrato renovado!')
    fetchPerformance()
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
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

  const ranked = [...activeData].sort((a, b) => (b.roas ?? -1) - (a.roas ?? -1))
  const tierViewData = (view === 'macro' || view === 'micro') ? data.filter(d => d.tier === view) : []
  const tierViewActive = tierViewData.filter(d => d.is_active).length
  const tierViewRevenue = tierViewData.reduce((s, d) => s + d.total_revenue, 0)
  const tierViewCost = tierViewData.reduce((s, d) => s + d.total_cost, 0)
  const tierViewWithRoas = tierViewData.filter(d => d.roas !== null && d.total_orders > 0)
  const tierViewAvgRoas = tierViewWithRoas.length > 0 ? tierViewWithRoas.reduce((s, d) => s + (d.roas ?? 0), 0) / tierViewWithRoas.length : null

  // Seq cost totals for modal validation
  const seqTotal = form.sequences.reduce((s, seq) => s + (seq.cost || 0), 0)
  const feeTotal = parseFloat(form.monthlyFee.replace(/\./g, '').replace(',', '.')) || 0
  const costMatch = Math.abs(seqTotal - feeTotal) < 0.02

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

      {/* Loading skeleton */}
      {loading && (view === 'macro' || view === 'micro') && (
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex items-center gap-4 p-4 border-b border-border/50 last:border-0 animate-pulse">
              <div className="h-4 w-24 bg-bg-hover rounded" />
              <div className="h-4 w-16 bg-bg-hover rounded" />
              <div className="h-4 w-20 bg-bg-hover rounded" />
              <div className="flex-1" />
              <div className="h-4 w-16 bg-bg-hover rounded" />
            </div>
          ))}
        </div>
      )}

      {/* ═══════ VIEW: CONSOLIDADO ═══════ */}
      {view === 'consolidado' && (
        <>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7C3AED' }}>Macro</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Macros Ativas" value={String(macroStats.count)} />
              <KpiCard label="Receita Macros" value={fmtBRL(macroStats.revenue)} color="gold" />
              <KpiCard label="Custo Macros" value={fmtBRL(macroStats.cost)} color="red" />
              <KpiCard label="ROAS Medio" value={macroStats.avgRoas !== null ? `${macroStats.avgRoas.toFixed(1)}x` : '--'} roasValue={macroStats.avgRoas} />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#2563EB' }}>Micro</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Micros Ativas" value={String(microStats.count)} />
              <KpiCard label="Receita Micros" value={fmtBRL(microStats.revenue)} color="gold" />
              <KpiCard label="Custo Micros" value={fmtBRL(microStats.cost)} color="red" />
              <KpiCard label="ROAS Medio" value={microStats.avgRoas !== null ? `${microStats.avgRoas.toFixed(1)}x` : '--'} roasValue={microStats.avgRoas} />
            </div>
          </div>
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

      {/* ═══════ VIEW: MACRO / MICRO (List/Table) ═══════ */}
      {(view === 'macro' || view === 'micro') && !loading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Ativas" value={String(tierViewActive)} />
            <KpiCard label="Receita Total" value={fmtBRL(tierViewRevenue)} color="gold" />
            <KpiCard label="Custo Total" value={fmtBRL(tierViewCost)} color="red" />
            <KpiCard label="ROAS Medio" value={tierViewAvgRoas !== null ? `${tierViewAvgRoas.toFixed(1)}x` : '--'} roasValue={tierViewAvgRoas} />
          </div>

          {tierViewData.length > 0 ? (
            <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] text-text-muted uppercase tracking-wide">
                      <th className="px-3 py-2.5 font-medium sticky left-0 bg-bg-card z-10">Nome</th>
                      <th className="px-3 py-2.5 font-medium hidden sm:table-cell">Instagram</th>
                      <th className="px-3 py-2.5 font-medium">Cupom</th>
                      <th className="px-3 py-2.5 font-medium hidden md:table-cell">Periodo</th>
                      <th className="px-3 py-2.5 font-medium text-center">Seq.</th>
                      <th className="px-3 py-2.5 font-medium text-right">Pedidos</th>
                      <th className="px-3 py-2.5 font-medium text-right">Receita</th>
                      <th className="px-3 py-2.5 font-medium text-right">ROAS</th>
                      <th className="px-3 py-2.5 font-medium text-center hidden sm:table-cell">Status</th>
                      <th className="px-3 py-2.5 font-medium text-right">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tierViewData.map(inf => {
                      const dr = daysRemaining(inf.end_date)
                      return (
                        <tr key={inf.id} className="border-b border-border/50 last:border-0 hover:bg-bg-hover/30 transition-colors">
                          <td className="px-3 py-2.5 font-medium text-text-primary sticky left-0 bg-bg-card z-10 whitespace-nowrap">
                            {inf.name}
                          </td>
                          <td className="px-3 py-2.5 text-text-muted hidden sm:table-cell">
                            {inf.instagram ? `@${inf.instagram.replace('@', '')}` : '--'}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="px-2 py-0.5 rounded bg-bg-surface text-text-secondary text-xs font-mono border border-border">{inf.coupon_code}</span>
                          </td>
                          <td className="px-3 py-2.5 text-text-muted text-xs hidden md:table-cell whitespace-nowrap">
                            {inf.start_date ? `${fmtDateBR(inf.start_date)} → ${inf.end_date ? fmtDateBR(inf.end_date) : '∞'}` : '--'}
                          </td>
                          <td className="px-3 py-2.5 text-center relative">
                            <button
                              onClick={() => setSeqPopoverId(seqPopoverId === inf.id ? null : inf.id)}
                              className="cursor-pointer"
                            >
                              <SeqDots sequences={inf.sequences} total={inf.total_sequences || 3} />
                            </button>
                            {seqPopoverId === inf.id && inf.sequences.length > 0 && (
                              <SeqPopover sequences={inf.sequences} total={inf.total_sequences || 3} onClose={() => setSeqPopoverId(null)} />
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right text-text-secondary">{fmtNum(inf.total_orders)}</td>
                          <td className="px-3 py-2.5 text-right font-medium text-emerald-400">{fmtBRL(inf.total_revenue)}</td>
                          <td className="px-3 py-2.5 text-right">
                            {inf.roas !== null ? (
                              <span className={`font-medium ${inf.roas >= 3 ? 'text-emerald-400' : inf.roas >= 1 ? 'text-yellow-400' : 'text-red-400'}`}>
                                {inf.roas.toFixed(1)}x
                              </span>
                            ) : <span className="text-text-muted">--</span>}
                          </td>
                          <td className="px-3 py-2.5 text-center hidden sm:table-cell">
                            <span className={`inline-block w-2 h-2 rounded-full ${inf.is_active ? 'bg-emerald-400' : 'bg-red-400'}`} />
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => openEditModal(inf)} title="Editar"
                                className="p-1.5 rounded-lg hover:bg-bg-surface text-text-muted hover:text-text-primary transition-colors cursor-pointer">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              </button>
                              <button onClick={() => openRenewalModal(inf)} title="Renovar"
                                className="p-1.5 rounded-lg hover:bg-bg-surface text-text-muted hover:text-emerald-400 transition-colors cursor-pointer">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                              </button>
                              <button onClick={() => handleToggleActive(inf)} title={inf.is_active ? 'Desativar' : 'Ativar'}
                                className={`p-1.5 rounded-lg hover:bg-bg-surface transition-colors cursor-pointer ${inf.is_active ? 'text-text-muted hover:text-red-400' : 'text-red-400 hover:text-emerald-400'}`}>
                                {inf.is_active ? (
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                ) : (
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-bg-card border border-border rounded-xl p-8 text-center">
              <p className="text-text-muted text-sm">Nenhuma influenciadora {view} cadastrada.</p>
            </div>
          )}
        </>
      )}

      {/* ═══════ VIEW: RANKING ═══════ */}
      {view === 'ranking' && (
        <>
          {ranked.length > 0 && (
            <div className="flex items-end justify-center gap-4 md:gap-8 pt-4 pb-2">
              {ranked.length > 1 && <PodiumCard rank={2} inf={ranked[1]} h="h-24" />}
              <PodiumCard rank={1} inf={ranked[0]} h="h-32" />
              {ranked.length > 2 && <PodiumCard rank={3} inf={ranked[2]} h="h-16" />}
            </div>
          )}
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
            {/* Sticky header */}
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-border bg-bg-card rounded-t-2xl md:rounded-t-xl z-10 shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">
                  {editingId ? 'Editar Influenciadora' : 'Adicionar Influenciadora'}
                </h3>
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

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {/* STEP 1: Perfil */}
              {modalStep === 1 && (
                <>
                  <Field label="Nome *">
                    <input type="text" value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Nome da influenciadora" className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-gold" />
                  </Field>
                  <Field label="Instagram">
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
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Nicho">
                      <select value={form.niche} onChange={e => setField('niche', e.target.value)} className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-gold">
                        <option value="">Selecione</option>
                        {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </Field>
                    <Field label="Seguidores">
                      <input type="text" value={form.followers} onChange={e => setField('followers', e.target.value.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.'))} placeholder="120.000" className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-gold" />
                    </Field>
                  </div>
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
                        {couponPreview.orders > 0 ? `${couponPreview.orders} pedidos, ${fmtBRL(couponPreview.revenue)}` : 'Nenhum pedido com este cupom'}
                      </p>
                    )}
                  </Field>
                  {/* Yampi coupon creation toggle */}
                  {!editingId && (
                    <div className="bg-bg-surface/50 border border-border rounded-lg p-3 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.createCouponYampi} onChange={e => setField('createCouponYampi', e.target.checked)} className="accent-brand-gold w-4 h-4" />
                        <span className="text-xs text-text-secondary">Criar cupom na Yampi automaticamente</span>
                      </label>
                      {form.createCouponYampi && (
                        <div className="space-y-2 pl-6">
                          <Field label="Tipo de desconto" compact>
                            <div className="flex gap-1">
                              <button onClick={() => setField('discountType', 'percent')}
                                className={`flex-1 px-2 py-1 text-xs rounded font-medium cursor-pointer ${form.discountType === 'percent' ? 'bg-brand-gold text-bg-base' : 'bg-bg-surface border border-border text-text-muted'}`}>
                                Percentual %
                              </button>
                              <button onClick={() => setField('discountType', 'value')}
                                className={`flex-1 px-2 py-1 text-xs rounded font-medium cursor-pointer ${form.discountType === 'value' ? 'bg-brand-gold text-bg-base' : 'bg-bg-surface border border-border text-text-muted'}`}>
                                Valor fixo R$
                              </button>
                            </div>
                          </Field>
                          <div className="grid grid-cols-2 gap-2">
                            <Field label="Valor do desconto" compact>
                              <input type="number" value={form.discountValue} onChange={e => setField('discountValue', e.target.value)} placeholder={form.discountType === 'percent' ? '10' : '50'} className="w-full bg-bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none focus:border-brand-gold" />
                            </Field>
                            <Field label="Uso maximo" compact>
                              <input type="number" value={form.maxUses} onChange={e => setField('maxUses', e.target.value)} placeholder="Ilimitado" className="w-full bg-bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none focus:border-brand-gold" />
                            </Field>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* STEP 2: Contrato */}
              {modalStep === 2 && (
                <>
                  <Field label="Periodo do contrato">
                    <div className="flex gap-1 mb-2">
                      {([['month', 'Mês Fechado'], ['months', 'Meses'], ['custom', 'Personalizado']] as [ContractMode, string][]).map(([k, l]) => (
                        <button key={k} onClick={() => {
                          setField('contractMode', k)
                          if (k === 'month' && form.contractMonth) applyContractDates(k, form.contractMonth, 1)
                          if (k === 'months' && form.contractMonth) applyContractDates(k, form.contractMonth, form.contractDuration)
                        }}
                          className={`flex-1 px-2 py-1.5 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                            form.contractMode === k ? 'bg-brand-gold text-bg-base' : 'bg-bg-surface border border-border text-text-secondary hover:bg-bg-hover'
                          }`}>{l}</button>
                      ))}
                    </div>
                  </Field>

                  {form.contractMode === 'month' && (
                    <Field label="Mês/Ano">
                      <input type="month" value={form.contractMonth || getCurrentMonth()}
                        onChange={e => {
                          const v = e.target.value
                          setField('contractMonth', v)
                          applyContractDates('month', v, 1)
                        }}
                        className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-gold" />
                    </Field>
                  )}

                  {form.contractMode === 'months' && (
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Mês inicial">
                        <input type="month" value={form.contractMonth || getCurrentMonth()}
                          onChange={e => {
                            const v = e.target.value
                            setField('contractMonth', v)
                            applyContractDates('months', v, form.contractDuration)
                          }}
                          className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-gold" />
                      </Field>
                      <Field label="Duracao">
                        <select value={form.contractDuration} onChange={e => {
                          const d = Number(e.target.value)
                          setField('contractDuration', d)
                          applyContractDates('months', form.contractMonth || getCurrentMonth(), d)
                        }} className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-gold">
                          {[1, 2, 3, 6].map(n => <option key={n} value={n}>{n} {n === 1 ? 'mês' : 'meses'}</option>)}
                        </select>
                      </Field>
                    </div>
                  )}

                  {form.contractMode === 'custom' && (
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Data de inicio *">
                        <input type="date" value={form.startDate} onChange={e => setField('startDate', e.target.value)} className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-gold" />
                      </Field>
                      <Field label="Data de termino">
                        <input type="date" value={form.endDate} onChange={e => setField('endDate', e.target.value)} className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-gold" />
                      </Field>
                    </div>
                  )}

                  {form.startDate && (
                    <p className="text-[11px] text-text-muted">
                      {fmtDateBR(form.startDate)} → {form.endDate ? fmtDateBR(form.endDate) : '∞'}
                    </p>
                  )}

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
                    <Field label="Valor do Contrato (R$)">
                      <div className="flex items-center">
                        <span className="text-sm text-text-muted mr-1">R$</span>
                        <input type="text" value={form.monthlyFee} onChange={e => {
                          const v = e.target.value
                          setField('monthlyFee', v)
                          const fee = parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0
                          setForm(f => ({ ...f, monthlyFee: v, sequences: recalcSeqCosts(fee, f.totalSequences, f.sequences) }))
                        }} placeholder="0,00" className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-gold" />
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
                  <Field label="Numero de sequencias">
                    <div className="flex items-center gap-3">
                      <input type="number" min={1} max={20} value={form.totalSequences}
                        onChange={e => setTotalSequences(Number(e.target.value))}
                        className="w-20 bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-gold" />
                      {feeTotal > 0 && (
                        <span className="text-[11px] text-text-muted">
                          Custo por sequencia: {fmtBRL(form.totalSequences > 0 ? feeTotal / form.totalSequences : 0)}
                        </span>
                      )}
                    </div>
                  </Field>

                  {form.sequences.map((seq, i) => (
                    <div key={i} className="bg-bg-surface/50 border border-border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-text-primary">Sequencia {i + 1}</p>
                        {seq.cost > 0 && <span className="text-[10px] text-text-muted">{fmtBRL(seq.cost)}</span>}
                      </div>
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

                  {/* Cost check */}
                  {feeTotal > 0 && (
                    <div className={`text-[11px] px-3 py-2 rounded-lg ${costMatch ? 'bg-emerald-500/10 text-emerald-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                      Total sequencias: {fmtBRL(seqTotal)} = Valor contrato: {fmtBRL(feeTotal)} {costMatch ? '\u2713' : '\u26A0 Divergencia'}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Sticky footer */}
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

      {/* ═══════ RENEWAL MODAL ═══════ */}
      {showRenewalModal && renewTarget && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60" onClick={() => setShowRenewalModal(false)}>
          <div className="relative w-full max-w-md md:mx-4 max-h-[90vh] flex flex-col rounded-t-2xl md:rounded-xl bg-bg-card border border-border" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border shrink-0">
              <h3 className="text-lg font-semibold text-text-primary">Renovar Contrato — {renewTarget.name}</h3>
              <p className="text-xs text-text-muted mt-0.5">Mesmo cupom, novas condições.</p>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {/* Previous contract info */}
              {renewTarget.start_date && (
                <div className="bg-bg-surface/50 border border-border rounded-lg p-3">
                  <p className="text-[10px] text-text-muted uppercase mb-1">Contrato anterior</p>
                  <p className="text-xs text-text-secondary">
                    {fmtDateBR(renewTarget.start_date)} → {renewTarget.end_date ? fmtDateBR(renewTarget.end_date) : '∞'} — {fmtBRL(renewTarget.monthly_fee)}
                  </p>
                </div>
              )}
              {/* Renewal history */}
              {renewTarget.renewals.length > 0 && (
                <div className="bg-bg-surface/50 border border-border rounded-lg p-3">
                  <p className="text-[10px] text-text-muted uppercase mb-1">Historico de renovacoes ({renewTarget.renewals.length})</p>
                  {renewTarget.renewals.slice(-3).map((r, i) => (
                    <p key={i} className="text-[10px] text-text-muted">
                      #{r.renewal_number}: {fmtDateBR(r.start_date)} → {r.end_date ? fmtDateBR(r.end_date) : '∞'} — {fmtBRL(r.monthly_fee)}
                    </p>
                  ))}
                </div>
              )}

              <Field label="Periodo">
                <div className="flex gap-1 mb-2">
                  {([['month', 'Mês Fechado'], ['months', 'Meses'], ['custom', 'Personalizado']] as [ContractMode, string][]).map(([k, l]) => (
                    <button key={k} onClick={() => {
                      setRenewForm(f => ({ ...f, contractMode: k }))
                      if (k === 'month' && renewForm.contractMonth) {
                        const [y, m] = renewForm.contractMonth.split('-').map(Number)
                        const start = `${y}-${String(m).padStart(2, '0')}-01`
                        const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDayOfMonth(y, m)).padStart(2, '0')}`
                        setRenewForm(f => ({ ...f, contractMode: k, startDate: start, endDate: end }))
                      }
                    }}
                      className={`flex-1 px-2 py-1.5 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                        renewForm.contractMode === k ? 'bg-brand-gold text-bg-base' : 'bg-bg-surface border border-border text-text-secondary hover:bg-bg-hover'
                      }`}>{l}</button>
                  ))}
                </div>
              </Field>

              {renewForm.contractMode === 'month' && (
                <Field label="Mês/Ano">
                  <input type="month" value={renewForm.contractMonth || getCurrentMonth()}
                    onChange={e => {
                      const v = e.target.value
                      const [y, m] = v.split('-').map(Number)
                      setRenewForm(f => ({
                        ...f, contractMonth: v,
                        startDate: `${y}-${String(m).padStart(2, '0')}-01`,
                        endDate: `${y}-${String(m).padStart(2, '0')}-${String(lastDayOfMonth(y, m)).padStart(2, '0')}`,
                      }))
                    }}
                    className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-gold" />
                </Field>
              )}
              {renewForm.contractMode === 'months' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Mês inicial">
                    <input type="month" value={renewForm.contractMonth || getCurrentMonth()}
                      onChange={e => {
                        const v = e.target.value
                        const [y, m] = v.split('-').map(Number)
                        const dur = renewForm.contractDuration
                        const endMonth = new Date(y, m - 1 + dur, 0)
                        setRenewForm(f => ({
                          ...f, contractMonth: v,
                          startDate: `${y}-${String(m).padStart(2, '0')}-01`,
                          endDate: toYMD(endMonth),
                        }))
                      }}
                      className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-gold" />
                  </Field>
                  <Field label="Duracao">
                    <select value={renewForm.contractDuration} onChange={e => {
                      const d = Number(e.target.value)
                      const mo = renewForm.contractMonth || getCurrentMonth()
                      const [y, m] = mo.split('-').map(Number)
                      const endMonth = new Date(y, m - 1 + d, 0)
                      setRenewForm(f => ({
                        ...f, contractDuration: d,
                        startDate: `${y}-${String(m).padStart(2, '0')}-01`,
                        endDate: toYMD(endMonth),
                      }))
                    }} className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-gold">
                      {[1, 2, 3, 6].map(n => <option key={n} value={n}>{n} {n === 1 ? 'mês' : 'meses'}</option>)}
                    </select>
                  </Field>
                </div>
              )}
              {renewForm.contractMode === 'custom' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Data de inicio *">
                    <input type="date" value={renewForm.startDate} onChange={e => setRenewForm(f => ({ ...f, startDate: e.target.value }))} className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-gold" />
                  </Field>
                  <Field label="Data de termino">
                    <input type="date" value={renewForm.endDate} onChange={e => setRenewForm(f => ({ ...f, endDate: e.target.value }))} className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-gold" />
                  </Field>
                </div>
              )}

              {renewForm.startDate && (
                <p className="text-[11px] text-text-muted">{fmtDateBR(renewForm.startDate)} → {renewForm.endDate ? fmtDateBR(renewForm.endDate) : '∞'}</p>
              )}

              <Field label="Tipo de Pagamento">
                <div className="flex gap-1.5">
                  {FEE_TYPES.map(ft => (
                    <button key={ft.key} onClick={() => setRenewForm(f => ({ ...f, feeType: ft.key }))}
                      className={`flex-1 px-2 py-1.5 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                        renewForm.feeType === ft.key ? 'bg-brand-gold text-bg-base' : 'bg-bg-surface border border-border text-text-secondary hover:bg-bg-hover'
                      }`}>{ft.label}</button>
                  ))}
                </div>
              </Field>
              {(renewForm.feeType === 'fixed' || renewForm.feeType === 'fixed_commission') && (
                <Field label="Valor do Contrato (R$)">
                  <input type="text" value={renewForm.monthlyFee} onChange={e => setRenewForm(f => ({ ...f, monthlyFee: e.target.value }))} placeholder="0,00" className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-gold" />
                </Field>
              )}
              {(renewForm.feeType === 'commission' || renewForm.feeType === 'fixed_commission') && (
                <Field label="Comissao (%)">
                  <input type="text" value={renewForm.commission} onChange={e => setRenewForm(f => ({ ...f, commission: e.target.value }))} placeholder="10" className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-gold" />
                </Field>
              )}
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-border shrink-0">
              <button onClick={() => setShowRenewalModal(false)}
                className="flex-1 px-4 py-2.5 text-sm rounded-lg border border-border text-text-secondary hover:bg-bg-hover cursor-pointer">Cancelar</button>
              <button onClick={handleRenewalSave} disabled={!renewForm.startDate || renewSaving}
                className="flex-1 px-4 py-2.5 text-sm rounded-lg font-medium bg-brand-gold text-bg-base hover:opacity-90 disabled:opacity-40 cursor-pointer">
                {renewSaving ? 'Salvando...' : 'Renovar'}
              </button>
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

function SeqPopover({ sequences, total, onClose }: { sequences: Sequence[]; total: number; onClose: () => void }) {
  return (
    <div className="absolute z-20 top-full mt-1 left-1/2 -translate-x-1/2 bg-bg-card border border-border rounded-lg shadow-xl p-3 min-w-[200px]" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-text-muted uppercase font-semibold">Sequencias</p>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary cursor-pointer">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      {Array.from({ length: total }, (_, i) => {
        const seq = sequences.find(s => s.sequence_number === i + 1)
        const statusColor = seq?.status === 'published' ? 'text-emerald-400' : seq?.status === 'delayed' ? 'text-red-400' : 'text-yellow-400'
        const statusLabel = seq?.status === 'published' ? 'Publicado' : seq?.status === 'delayed' ? 'Atrasado' : 'Pendente'
        return (
          <div key={i} className="flex items-center justify-between text-[10px] py-1 border-b border-border/30 last:border-0">
            <span className="text-text-secondary">#{i + 1} {seq?.content_type || ''}</span>
            <div className="flex items-center gap-2">
              <span className="text-text-muted">{seq?.scheduled_date ? fmtDateBR(seq.scheduled_date) : '--'}</span>
              <span className={statusColor}>{seq ? statusLabel : '--'}</span>
            </div>
          </div>
        )
      })}
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

function SeqDots({ sequences, total }: { sequences: Sequence[]; total: number }) {
  const dots = Array.from({ length: total }, (_, i) => {
    const seq = sequences.find(s => s.sequence_number === i + 1)
    if (!seq) return 'bg-bg-surface'
    return seq.status === 'published' ? 'bg-emerald-400' : seq.status === 'delayed' ? 'bg-red-400' : 'bg-yellow-400'
  })
  return (
    <div className="flex gap-1">
      {dots.map((cls, i) => <span key={i} className={`w-2 h-2 rounded-full ${cls}`} />)}
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
