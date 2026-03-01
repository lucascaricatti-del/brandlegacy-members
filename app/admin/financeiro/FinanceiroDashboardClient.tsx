"use client";

import { useState, useCallback, useTransition } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  getFinancialKPIs,
  getDREMensal,
  getContratadoVsRealizado,
  getContasAReceber,
  getFunilMetrics,
  getClientesSummary,
  refreshSheetsData,
  type FinancialKPIs,
  type DREMensalRow,
  type ContratadoVsRealizadoRow,
  type ContasAReceberData,
  type FunilMetricRow,
  type ClientesSummary,
} from "@/app/actions/sheets-financial";

// ============================================================
// Constants
// ============================================================

const GOLD = "#c9a84c";
const GREEN = "#22c55e";
const RED = "#ef4444";
const BLUE = "#3b82f6";
const BG_CARD = "bg-white/5";
const BORDER = "border-white/10";

const TABS = [
  { key: "resumo", label: "Resumo" },
  { key: "dre", label: "DRE" },
  { key: "contratado", label: "Contratado vs Realizado" },
  { key: "receber", label: "Contas a Receber" },
  { key: "funil", label: "Funil de Imersão" },
  { key: "clientes", label: "Clientes (CX)" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const PIE_COLORS = [GOLD, GREEN, BLUE, "#a855f7", "#f97316", "#ec4899", "#06b6d4", "#84cc16"];

// ============================================================
// Types
// ============================================================

type InitialData = {
  kpis: FinancialKPIs;
  dre: DREMensalRow[];
  contratado: ContratadoVsRealizadoRow[];
  receber: ContasAReceberData;
  funil: FunilMetricRow[];
  clientes: ClientesSummary;
  month: string;
  from: string;
} | null;

// ============================================================
// Helpers
// ============================================================

function fmt(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return "0,00";
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtK(n: number | undefined | null): string {
  if (n == null || isNaN(Number(n))) return "0";
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return fmt(n);
}

function fmtPct(n: number | undefined | null): string {
  if (n == null || isNaN(Number(n))) return "0.0%";
  return `${(Number(n) * 100).toFixed(1)}%`;
}

function monthLabel(ym: string): string {
  const m = parseInt(ym.slice(4, 6), 10);
  const y = ym.slice(2, 4);
  const names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${names[m - 1] || ym}/${y}`;
}

function currentYYYYMM(): string {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthsBefore(yyyymm: string, n: number): string {
  let y = parseInt(yyyymm.slice(0, 4), 10);
  let m = parseInt(yyyymm.slice(4, 6), 10);
  m -= n;
  while (m < 1) { m += 12; y--; }
  return `${y}${String(m).padStart(2, "0")}`;
}

// ============================================================
// Main Component
// ============================================================

export default function FinanceiroDashboardClient({
  initialData,
}: {
  initialData: InitialData;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("resumo");
  const [selectedMonth, setSelectedMonth] = useState(initialData?.month || currentYYYYMM());
  const [kpis, setKpis] = useState(initialData?.kpis ?? null);
  const [dre, setDre] = useState(initialData?.dre ?? []);
  const [contratado, setContratado] = useState(initialData?.contratado ?? []);
  const [receber, setReceber] = useState(initialData?.receber ?? null);
  const [funil, setFunil] = useState(initialData?.funil ?? []);
  const [clientes, setClientes] = useState(initialData?.clientes ?? null);
  const [isPending, startTransition] = useTransition();

  const reload = useCallback(() => {
    startTransition(async () => {
      await refreshSheetsData();
      const from = monthsBefore(selectedMonth, 5);
      const [k, d, c, r, f, cl] = await Promise.all([
        getFinancialKPIs(selectedMonth),
        getDREMensal(from, selectedMonth),
        getContratadoVsRealizado(from, selectedMonth),
        getContasAReceber(),
        getFunilMetrics(),
        getClientesSummary(),
      ]);
      setKpis(k);
      setDre(d);
      setContratado(c);
      setReceber(r);
      setFunil(f);
      setClientes(cl);
    });
  }, [selectedMonth]);

  const changeMonth = useCallback(
    (month: string) => {
      setSelectedMonth(month);
      startTransition(async () => {
        const from = monthsBefore(month, 5);
        const [k, d, c] = await Promise.all([
          getFinancialKPIs(month),
          getDREMensal(from, month),
          getContratadoVsRealizado(from, month),
        ]);
        setKpis(k);
        setDre(d);
        setContratado(c);
      });
    },
    []
  );

  // Month selector options (last 12 months)
  const monthOptions: string[] = [];
  for (let i = 0; i < 12; i++) {
    monthOptions.push(monthsBefore(currentYYYYMM(), i));
  }

  // No data
  if (!initialData && !kpis) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-lg mb-4">
          Não foi possível carregar os dados financeiros.
        </p>
        <p className="text-gray-500 text-sm">
          Verifique as variáveis de ambiente do Google Sheets e tente novamente.
        </p>
        <button
          onClick={reload}
          className="mt-4 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm hover:bg-white/10 transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 tabular-nums">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Financeiro BrandLegacy</h1>
          <p className="text-sm text-gray-400 mt-1">
            Dados em tempo real via Google Sheets
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => changeMonth(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c9a84c]/50"
          >
            {monthOptions.map((m) => (
              <option key={m} value={m} className="bg-gray-900">
                {monthLabel(m)}
              </option>
            ))}
          </select>
          <button
            onClick={reload}
            disabled={isPending}
            className="px-4 py-2 rounded-lg bg-[#c9a84c]/10 border border-[#c9a84c]/20 text-[#c9a84c] text-sm hover:bg-[#c9a84c]/20 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isPending && <Spinner />}
            Atualizar
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={[
              "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
              activeTab === tab.key
                ? "bg-[#c9a84c]/10 text-[#c9a84c]"
                : "text-gray-400 hover:text-white hover:bg-white/5",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading overlay */}
      {isPending && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Spinner /> Carregando dados...
        </div>
      )}

      {/* Tab content */}
      {activeTab === "resumo" && kpis && <TabResumo kpis={kpis} dre={dre} />}
      {activeTab === "dre" && <TabDRE dre={dre} />}
      {activeTab === "contratado" && <TabContratado data={contratado} />}
      {activeTab === "receber" && receber && <TabReceber data={receber} />}
      {activeTab === "funil" && <TabFunil data={funil} />}
      {activeTab === "clientes" && clientes && <TabClientes data={clientes} />}
    </div>
  );
}

// ============================================================
// Tab 1 — Resumo
// ============================================================

function TabResumo({ kpis, dre }: { kpis: FinancialKPIs; dre: DREMensalRow[] }) {
  const chartData = dre.map((d) => ({
    name: monthLabel(d.mes),
    receita: d.receitaTotal,
    despesa: d.despesaTotal,
  }));

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard label="Receita Realizada" value={`R$ ${fmtK(kpis.receitaRealizada)}`} color={GREEN} />
        <KpiCard label="Receita Contratada" value={`R$ ${fmtK(kpis.receitaContratada)}`} color={BLUE} />
        <KpiCard label="Despesa Total" value={`R$ ${fmtK(kpis.despesaTotal)}`} color={RED} />
        <KpiCard
          label="Resultado"
          value={`R$ ${fmtK(kpis.resultado)}`}
          color={kpis.resultado >= 0 ? GREEN : RED}
        />
        <KpiCard label="Margem" value={fmtPct(kpis.margem)} color={kpis.margem >= 0 ? GREEN : RED} />
        <KpiCard label="Ticket Médio" value={`R$ ${fmt(kpis.ticketMedio)}`} color={GOLD} />
        <KpiCard label="Vendas no Mês" value={String(kpis.qtdVendas)} color={GOLD} />
        <KpiCard label="Clientes Ativos" value={String(kpis.qtdClientesAtivos)} color={GOLD} />
      </div>

      {/* Mini chart */}
      {chartData.length > 0 && (
        <Card title="Receita vs Despesa — Últimos meses">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={fmtK} />
                <Tooltip
                  contentStyle={{
                    background: "#1e293b",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                  }}
                  formatter={(value) => [`R$ ${fmt(value as number)}`, ""]}
                  labelStyle={{ color: "#94a3b8" }}
                />
                <Area
                  type="monotone"
                  dataKey="receita"
                  name="Receita"
                  stroke={GREEN}
                  fill={GREEN}
                  fillOpacity={0.1}
                />
                <Area
                  type="monotone"
                  dataKey="despesa"
                  name="Despesa"
                  stroke={RED}
                  fill={RED}
                  fillOpacity={0.1}
                />
                <Legend
                  wrapperStyle={{ color: "#94a3b8", fontSize: 12 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// Tab 2 — DRE
// ============================================================

function TabDRE({ dre }: { dre: DREMensalRow[] }) {
  if (dre.length === 0) return <EmptyState msg="Nenhum dado de DRE disponível." />;

  // Collect all product and category keys
  const allProdutos = new Set<string>();
  const allCategorias = new Set<string>();
  for (const row of dre) {
    Object.keys(row.receitaPorProduto).forEach((k) => allProdutos.add(k));
    Object.keys(row.despesaPorCategoria).forEach((k) => allCategorias.add(k));
  }
  const produtos = Array.from(allProdutos).sort();
  const categorias = Array.from(allCategorias).sort();

  return (
    <Card title="DRE Mensal">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs text-gray-500 uppercase">
              <th className="text-left py-2 pr-4 sticky left-0 bg-[#1a2332] z-10">Categoria</th>
              {dre.map((d) => (
                <th key={d.mes} className="text-right py-2 px-3 whitespace-nowrap">
                  {monthLabel(d.mes)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Receitas */}
            <tr className="border-t border-white/5">
              <td className="py-2 pr-4 font-semibold text-green-400 sticky left-0 bg-[#1a2332] z-10" colSpan={1}>
                RECEITAS
              </td>
              {dre.map((d) => (
                <td key={d.mes} />
              ))}
            </tr>
            {produtos.map((prod) => (
              <tr key={prod} className="border-t border-white/5 hover:bg-white/5">
                <td className="py-1.5 pr-4 text-gray-400 pl-4 sticky left-0 bg-[#1a2332] z-10">
                  {prod}
                </td>
                {dre.map((d) => (
                  <td key={d.mes} className="text-right px-3 text-gray-300">
                    {fmt(d.receitaPorProduto[prod] || 0)}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t border-white/10 font-medium">
              <td className="py-2 pr-4 text-green-400 sticky left-0 bg-[#1a2332] z-10">
                Total Receita
              </td>
              {dre.map((d) => (
                <td key={d.mes} className="text-right px-3 text-green-400">
                  {fmt(d.receitaTotal)}
                </td>
              ))}
            </tr>

            {/* Despesas */}
            <tr className="border-t border-white/10">
              <td className="py-2 pr-4 font-semibold text-red-400 sticky left-0 bg-[#1a2332] z-10" colSpan={1}>
                DESPESAS
              </td>
              {dre.map((d) => (
                <td key={d.mes} />
              ))}
            </tr>
            {categorias.map((cat) => (
              <tr key={cat} className="border-t border-white/5 hover:bg-white/5">
                <td className="py-1.5 pr-4 text-gray-400 pl-4 sticky left-0 bg-[#1a2332] z-10">
                  {cat}
                </td>
                {dre.map((d) => (
                  <td key={d.mes} className="text-right px-3 text-gray-300">
                    {fmt(d.despesaPorCategoria[cat] || 0)}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t border-white/10 font-medium">
              <td className="py-2 pr-4 text-red-400 sticky left-0 bg-[#1a2332] z-10">
                Total Despesa
              </td>
              {dre.map((d) => (
                <td key={d.mes} className="text-right px-3 text-red-400">
                  {fmt(d.despesaTotal)}
                </td>
              ))}
            </tr>

            {/* Resultado */}
            <tr className="border-t-2 border-white/20 font-bold">
              <td className="py-2 pr-4 sticky left-0 bg-[#1a2332] z-10" style={{ color: GOLD }}>
                RESULTADO
              </td>
              {dre.map((d) => (
                <td
                  key={d.mes}
                  className="text-right px-3"
                  style={{ color: d.resultado >= 0 ? GREEN : RED }}
                >
                  {fmt(d.resultado)}
                </td>
              ))}
            </tr>
            <tr className="border-t border-white/5">
              <td className="py-2 pr-4 text-gray-400 sticky left-0 bg-[#1a2332] z-10">
                Margem %
              </td>
              {dre.map((d) => (
                <td
                  key={d.mes}
                  className="text-right px-3"
                  style={{ color: d.margem >= 0 ? GREEN : RED }}
                >
                  {fmtPct(d.margem)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ============================================================
// Tab 3 — Contratado vs Realizado
// ============================================================

function TabContratado({ data }: { data: ContratadoVsRealizadoRow[] }) {
  if (data.length === 0)
    return <EmptyState msg="Nenhum dado de contratado vs realizado." />;

  const chartData = data.map((d) => ({
    name: monthLabel(d.mes),
    contratado: d.contratado,
    realizado: d.realizado,
  }));

  return (
    <div className="space-y-6">
      <Card title="Contratado vs Realizado">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={fmtK} />
              <Tooltip
                contentStyle={{
                  background: "#1e293b",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                }}
                formatter={(value) => [`R$ ${fmt(value as number)}`, ""]}
                labelStyle={{ color: "#94a3b8" }}
              />
              <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
              <Bar dataKey="contratado" name="Contratado" fill={BLUE} radius={[4, 4, 0, 0]} />
              <Bar dataKey="realizado" name="Realizado" fill={GREEN} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Detalhamento">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-gray-500 uppercase">
                <th className="text-left py-2">Mês</th>
                <th className="text-right py-2">Contratado</th>
                <th className="text-right py-2">Realizado</th>
                <th className="text-right py-2">Gap</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.mes} className="border-t border-white/5 hover:bg-white/5">
                  <td className="py-2 text-white">{monthLabel(d.mes)}</td>
                  <td className="py-2 text-right text-blue-400">R$ {fmt(d.contratado)}</td>
                  <td className="py-2 text-right text-green-400">R$ {fmt(d.realizado)}</td>
                  <td
                    className="py-2 text-right"
                    style={{ color: d.gap > 0 ? "#f97316" : GREEN }}
                  >
                    R$ {fmt(d.gap)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// Tab 4 — Contas a Receber
// ============================================================

function TabReceber({ data }: { data: ContasAReceberData }) {
  const { resumo, detalhe } = data;
  const pctRecebido =
    resumo.totalContratado > 0
      ? resumo.totalRecebido / resumo.totalContratado
      : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Saldo Total a Receber" value={`R$ ${fmtK(resumo.saldoTotal)}`} color={GOLD} />
        <KpiCard label="Contratos Abertos" value={String(resumo.contratosAbertos)} color={BLUE} />
        <KpiCard label="% Recebido" value={fmtPct(pctRecebido)} color={GREEN} />
      </div>

      <Card title="Detalhamento por Venda">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-gray-500 uppercase">
                <th className="text-left py-2">Cliente</th>
                <th className="text-left py-2">Produto</th>
                <th className="text-right py-2">Contratado</th>
                <th className="text-right py-2">Recebido</th>
                <th className="text-right py-2">Saldo</th>
                <th className="py-2 w-36">Progresso</th>
              </tr>
            </thead>
            <tbody>
              {detalhe.map((d) => {
                const pct =
                  d.contratado > 0 ? (d.recebido / d.contratado) * 100 : 0;
                return (
                  <tr
                    key={d.venda_id}
                    className="border-t border-white/5 hover:bg-white/5"
                  >
                    <td className="py-2 text-white">{d.cliente}</td>
                    <td className="py-2 text-gray-400">{d.produto}</td>
                    <td className="py-2 text-right text-gray-300">
                      R$ {fmt(d.contratado)}
                    </td>
                    <td className="py-2 text-right text-green-400">
                      R$ {fmt(d.recebido)}
                    </td>
                    <td className="py-2 text-right font-medium" style={{ color: GOLD }}>
                      R$ {fmt(d.saldo)}
                    </td>
                    <td className="py-2 px-2">
                      <div className="w-full bg-white/5 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.min(pct, 100)}%`,
                            background: pct >= 80 ? GREEN : pct >= 50 ? GOLD : RED,
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-500">{pct.toFixed(0)}%</span>
                    </td>
                  </tr>
                );
              })}
              {detalhe.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    Nenhum saldo em aberto.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// Tab 5 — Funil de Imersão
// ============================================================

function TabFunil({ data }: { data: FunilMetricRow[] }) {
  if (data.length === 0)
    return <EmptyState msg="Nenhum dado de funil disponível." />;

  return (
    <div className="space-y-6">
      {/* Cards per imersão */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.map((f, idx) => (
          <Card key={f.imersao_id || idx} title={`${f.imersao_id || "—"} — ${f.datas}`}>
            {f.tema && <p className="text-xs text-gray-500 -mt-2 mb-3">{f.tema}</p>}
            <div className="grid grid-cols-3 gap-3 text-sm">
              <MiniKpi label="Gasto Total" value={`R$ ${fmtK(f.gasto_total)}`} />
              <MiniKpi label="Leads" value={String(f.leads ?? 0)} />
              <MiniKpi label="CPL" value={`R$ ${fmt(f.cpl)}`} />
              <MiniKpi label="Vendas" value={String(f.vendas_total ?? 0)} />
              <MiniKpi label="Receita" value={`R$ ${fmtK(f.receita_total)}`} />
              <MiniKpi label="CAC" value={`R$ ${fmt(f.cac)}`} />
              <MiniKpi
                label="ROI"
                value={`${((f.roi || 0) * 100).toFixed(0)}%`}
                color={f.roi > 0 ? GREEN : RED}
              />
              <MiniKpi label="Take Club" value={`${((f.take_rate_club || 0) * 100).toFixed(0)}%`} color={GOLD} />
              <MiniKpi label="Take Tração" value={`${((f.take_rate_tracao || 0) * 100).toFixed(0)}%`} color={GOLD} />
            </div>
          </Card>
        ))}
      </div>

      {/* Comparison table */}
      <Card title="Comparativo de Imersões">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-gray-500 uppercase">
                <th className="text-left py-2">Imersão</th>
                <th className="text-right py-2">Gasto</th>
                <th className="text-right py-2">Leads</th>
                <th className="text-right py-2">CPL</th>
                <th className="text-right py-2">Vendas</th>
                <th className="text-right py-2">Receita</th>
                <th className="text-right py-2">ROI</th>
              </tr>
            </thead>
            <tbody>
              {data.map((f, idx) => (
                <tr key={f.imersao_id || idx} className="border-t border-white/5 hover:bg-white/5">
                  <td className="py-2 text-white">{f.imersao_id}</td>
                  <td className="py-2 text-right text-red-400">R$ {fmtK(f.gasto_total)}</td>
                  <td className="py-2 text-right text-gray-300">{f.leads}</td>
                  <td className="py-2 text-right text-gray-300">R$ {fmt(f.cpl)}</td>
                  <td className="py-2 text-right text-gray-300">{f.vendas_total}</td>
                  <td className="py-2 text-right text-green-400">R$ {fmtK(f.receita_total)}</td>
                  <td
                    className="py-2 text-right font-medium"
                    style={{ color: f.roi > 0 ? GREEN : RED }}
                  >
                    {(f.roi * 100).toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// Tab 6 — Clientes (CX)
// ============================================================

function TabClientes({ data }: { data: ClientesSummary }) {
  const churnRate = data.total > 0 ? data.churn / data.total : 0;

  const segData = Object.entries(data.porSegmento).map(([name, value]) => ({
    name,
    value,
  }));

  const prodData = Object.entries(data.porProduto).map(([name, value]) => ({
    name,
    value,
  }));

  const csData = Object.entries(data.porCS)
    .map(([cs, count]) => ({ cs, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Total Clientes" value={String(data.total)} color={GOLD} />
        <KpiCard label="Ativos" value={String(data.ativos)} color={GREEN} />
        <KpiCard label="Churn Rate" value={fmtPct(churnRate)} color={churnRate > 0.1 ? RED : GOLD} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Segmento */}
        <Card title="Por Segmento">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={segData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  label={({ name, percent }) =>
                    `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                >
                  {segData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#1e293b",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Produto */}
        <Card title="Por Produto Atual">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={prodData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  label={({ name, percent }) =>
                    `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                >
                  {prodData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#1e293b",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* CS table */}
      <Card title="Por CS Responsável">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-gray-500 uppercase">
                <th className="text-left py-2">CS Responsável</th>
                <th className="text-right py-2">Clientes</th>
                <th className="text-right py-2">Fat. Médio</th>
              </tr>
            </thead>
            <tbody>
              {csData.map((row) => (
                <tr key={row.cs} className="border-t border-white/5 hover:bg-white/5">
                  <td className="py-2 text-white">{row.cs}</td>
                  <td className="py-2 text-right text-gray-300">{row.count}</td>
                  <td className="py-2 text-right text-gray-300">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// Shared sub-components
// ============================================================

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className={`${BG_CARD} border ${BORDER} rounded-xl p-5`}>
      {title && (
        <p className="text-xs text-gray-400 mb-4 font-medium uppercase tracking-wide">
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

function KpiCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className={`${BG_CARD} border ${BORDER} rounded-xl p-4`}>
      <p className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">
        {label}
      </p>
      <p className="text-xl font-bold" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function MiniKpi({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div>
      <p className="text-[10px] text-gray-500 uppercase">{label}</p>
      <p className="text-sm font-semibold" style={{ color: color || "#fff" }}>
        {value}
      </p>
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="text-center py-16">
      <p className="text-gray-500">{msg}</p>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
