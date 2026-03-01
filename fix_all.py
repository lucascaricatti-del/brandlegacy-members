#!/usr/bin/env python3
import os

BASE = '/Users/lucascaricatticonde/brandlegacy-members'

def fix_menu():
    path = os.path.join(BASE, 'app/(student)/StudentLayoutShell.tsx')
    with open(path) as f:
        content = f.read()
    content = content.replace("  const [ferramentasOpen, setFerramentasOpen] = useState(false)\n", "")
    old = '''          {/* Ferramentas — submenu expansível */}
          <div>
            <button
              onClick={() => setFerramentasOpen((v) => !v)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors group"
            >
              <span className="text-text-muted group-hover:text-brand-gold transition-colors"><IconFerramentas /></span>
              <span className="flex-1 text-left">Ferramentas</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`text-text-muted transition-transform duration-200 ${ferramentasOpen ? 'rotate-180' : ''}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            <div className={`overflow-hidden transition-all duration-200 ${ferramentasOpen ? 'max-h-60' : 'max-h-0'}`}>
              <div className="ml-3 pl-3 border-l border-border space-y-0.5 py-1">
                <SubNavItem href="/ferramentas/planejamento-financeiro" label="Plan. Financeiro" onNavigate={() => setOpen(false)} />
                <SubNavItem href="/ferramentas/planejamento-midia" label="Plan. de Mídia" onNavigate={() => setOpen(false)} />
                <SubNavItem href="/ferramentas/calculadora-cenarios" label="Calc. de Cenários" onNavigate={() => setOpen(false)} />
                <SubNavItem href="/ferramentas/matriz-criativa" label="Matriz Criativa" onNavigate={() => setOpen(false)} />
                <SubNavItem href="/ferramentas/metricas-criativos" label="Métricas de Criativos" onNavigate={() => setOpen(false)} />
              </div>
            </div>
          </div>'''
    new = '''          <NavItem href="/ferramentas/planejamento-midia" icon={<IconPlanMidia />} label="Planejamento de Mídia" onNavigate={() => setOpen(false)} />
          <NavItem href="/ferramentas/planejamento-financeiro" icon={<IconForecasting />} label="Forecasting" onNavigate={() => setOpen(false)} />

          <div className="pt-2 mt-2 border-t border-border">
            <p className="text-text-muted text-[10px] font-medium px-3 mb-1.5 uppercase tracking-wider">Em breve</p>
            <NavItemSoon href="/ferramentas/calculadora-cenarios" label="Calc. de Cenários" onNavigate={() => setOpen(false)} />
            <NavItemSoon href="/ferramentas/matriz-criativa" label="Matriz Criativa" onNavigate={() => setOpen(false)} />
            <NavItemSoon href="/ferramentas/metricas-criativos" label="Métricas de Criativos" onNavigate={() => setOpen(false)} />
          </div>'''
    if old in content:
        content = content.replace(old, new)
        print("  [OK] Submenu substituido")
    else:
        print("  [WARN] Bloco nao encontrado")
    idx = content.find('function IconFerramentas()')
    if idx > 0:
        bc = 0
        started = False
        ei = idx
        for i in range(idx, len(content)):
            if content[i] == '{': bc += 1; started = True
            elif content[i] == '}':
                bc -= 1
                if started and bc == 0: ei = i + 1; break
        old_f = content[idx:ei]
        new_f = '''function IconPlanMidia() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
    </svg>
  )
}

function IconForecasting() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

function NavItemSoon({ href, label, onNavigate }: { href: string; label: string; onNavigate: () => void }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-muted/60 hover:text-text-muted hover:bg-bg-hover/50 transition-colors"
    >
      <span className="w-[18px] h-[18px] flex items-center justify-center text-text-muted/40">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
      </span>
      <span>{label}</span>
      <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-text-muted/50">em breve</span>
    </Link>
  )
}'''
        content = content.replace(old_f, new_f)
        print("  [OK] Icones substituidos")
    with open(path, 'w') as f:
        f.write(content)
    print("  [DONE] Menu")

def fix_button():
    path = os.path.join(BASE, 'app/(student)/ferramentas/planejamento-midia/PlannerClient.tsx')
    with open(path) as f:
        content = f.read()
    if 'syncMediaToFinancial' in content:
        print("  [SKIP] Ja existe"); return
    content = content.replace(
        "import { upsertMetrics, upsertMetricsAdmin } from '@/app/actions/media-plan'",
        "import { upsertMetrics, upsertMetricsAdmin, syncMediaToFinancial } from '@/app/actions/media-plan'"
    )
    content = content.replace(
        "  const [saving, setSaving] = useState(false)",
        "  const [saving, setSaving] = useState(false)\n  const [syncMsg, setSyncMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)"
    )
    handler = '''
  const handleSyncToFinancial = useCallback(async () => {
    setSyncMsg(null)
    try {
      const res = await syncMediaToFinancial(workspaceId, year)
      if (res.error) setSyncMsg({ type: 'err', text: res.error })
      else setSyncMsg({ type: 'ok', text: `Faturamento enviado p/ Financeiro (${res.synced} meses)` })
    } catch { setSyncMsg({ type: 'err', text: 'Erro ao sincronizar' }) }
    setTimeout(() => setSyncMsg(null), 4000)
  }, [workspaceId, year])
'''
    csv_pattern = "  }, [getCellValue, annualSummary, year])"
    if csv_pattern in content:
        content = content.replace(csv_pattern, csv_pattern + handler)
        print("  [OK] Handler adicionado")
    else:
        print("  [WARN] Padrao nao encontrado para handler")
    csv_btn_end = '''            CSV
          </button>
        </div>
      </div>'''
    new_btn = '''            CSV
          </button>
          <button
            onClick={handleSyncToFinancial}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-sm text-purple-400 hover:bg-purple-500/20 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
            Enviar p/ Financeiro
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${syncMsg.type === 'ok' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
          {syncMsg.text}
        </div>
      )}'''
    if csv_btn_end in content:
        content = content.replace(cv_btn_end, new_btn)
        print("  [OK] Botao adicionado")
    else:
        print("  [WARN] Padrao botao nao encontrado")
    with open(path, 'w') as f:
        f.write(content)
    print("  [DONE] Botao")

def fix_ux(filename):
    path = os.path.join(BASE, f'app/(student)/ferramentas/{filename}')
    if not os.path.exists(path): print(f"  [SKIP] {filename}"); return
    with open(path) as f:
        content = f.read()
    for old, new in {"#0a1a0f":"#111827","#0d2015":"#1f2937","#1f3d25":"#374151","'#e8e0d0'":"'#f3f4f6'"}.items():
        if old in content: content = content.replace(old, new); print(f"  [OK] {old} -> {new}")
    with open(path, 'w') as f:
        f.write(content)
    print(f"  [DONE] {filename}")

print("\n=== FIX 1: MENU ===")
fix_menu()
print("\n=== FIX 2: BOTAO ===")
fix_button()
print("\n=== FIX 3: UX MIDIA ===")
fix_ux('planejamento-midia/PlannerClient.tsx')
print("\n=== FIX 3: UX FINANCEIRO ===")
fix_ux('planejamento-financeiro/FinancialPlannerClient.tsx')
print("\n=== TUDO FEITO ===")
