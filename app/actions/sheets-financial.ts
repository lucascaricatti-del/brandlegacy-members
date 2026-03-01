"use server";

import {
  getClientes,
  getVendas,
  getRecebimentos,
  getDespesas,
  getFunilImersao,
  clearSheetsCache,
  type Venda,
  type Recebimento,
} from "@/lib/google-sheets";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// Auth helper
// ============================================================

async function requireInternalUser() {
  try {
    const supabase = await createClient();
    // In a full SSR setup this would use the user's session cookie.
    // For now, the admin client is used server-side for internal tools.
    // Access is gated by the (interno) route group and middleware.
    void supabase;
  } catch {
    // DB not ready — allow access for internal tools
  }
}

// ============================================================
// Helpers
// ============================================================

function toYYYYMM(date: Date | null): string {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

function vendaStatusOk(v: Venda): boolean {
  const s = (v.status_venda || "").toLowerCase();
  return s === "ganha" || s === "ativa" || s === "ativo";
}

function generateMonthRange(from: string, to: string): string[] {
  const months: string[] = [];
  let y = parseInt(from.slice(0, 4), 10);
  let m = parseInt(from.slice(4, 6), 10);
  const yEnd = parseInt(to.slice(0, 4), 10);
  const mEnd = parseInt(to.slice(4, 6), 10);

  while (y < yEnd || (y === yEnd && m <= mEnd)) {
    months.push(`${y}${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return months;
}

// ============================================================
// getFinancialKPIs
// ============================================================

export type FinancialKPIs = {
  receitaRealizada: number;
  receitaContratada: number;
  despesaTotal: number;
  despesaMarketing: number;
  resultado: number;
  margem: number;
  ticketMedio: number;
  qtdVendas: number;
  qtdClientesAtivos: number;
};

export async function getFinancialKPIs(month: string): Promise<FinancialKPIs> {
  await requireInternalUser();

  const [recebimentos, vendas, despesas, clientes] = await Promise.all([
    getRecebimentos(),
    getVendas(),
    getDespesas(),
    getClientes(),
  ]);

  const recMonth = recebimentos.filter(
    (r) => (r.ano_mes || toYYYYMM(r.data_recebimento)) === month
  );
  const receitaRealizada = recMonth.reduce(
    (s, r) => s + r.valor_liquido_recebido,
    0
  );

  // DEBUG
  console.log("[KPI DEBUG] month:", month);
  console.log("[KPI DEBUG] vendas sample:", vendas.slice(0, 3).map(v => ({ id: v.venda_id, data: v.data_venda, status: v.status_venda, valor: v.valor_liquido_contratado })));
  console.log("[KPI DEBUG] recebimentos sample:", recebimentos.slice(0, 3).map(r => ({ id: r.recebimento_id, ano_mes: r.ano_mes, valor: r.valor_liquido_recebido })));

  // DEBUG
  console.log("[KPI DEBUG] month:", month);
  console.log("[KPI DEBUG] vendas sample:", vendas.slice(0, 3).map(v => ({ id: v.venda_id, data: v.data_venda, status: v.status_venda, valor: v.valor_liquido_contratado })));
  console.log("[KPI DEBUG] recebimentos sample:", recebimentos.slice(0, 3).map(r => ({ id: r.recebimento_id, ano_mes: r.ano_mes, valor: r.valor_liquido_recebido })));

  const vendasMonth = vendas.filter(
    (v) => toYYYYMM(v.data_venda) === month && vendaStatusOk(v)
  );
  const receitaContratada = vendasMonth.reduce(
    (s, v) => s + v.valor_liquido_contratado,
    0
  );
  const qtdVendas = vendasMonth.length;
  const ticketMedio =
    qtdVendas > 0 ? receitaContratada / qtdVendas : 0;

  const despMonth = despesas.filter(
    (d) =>
      (d.ano_mes || toYYYYMM(d.data)) === month &&
      (d.status || "").toLowerCase() === "pago"
  );
  const despesaTotal = despMonth.reduce((s, d) => s + d.valor, 0);
  const despesaMarketing = despMonth
    .filter((d) => (d.categoria || "").toLowerCase() === "marketing")
    .reduce((s, d) => s + d.valor, 0);

  const resultado = receitaRealizada - despesaTotal;
  const margem = receitaRealizada > 0 ? resultado / receitaRealizada : 0;

  const qtdClientesAtivos = clientes.filter(
    (c) => (c.status_cliente || "").toLowerCase() === "ativo"
  ).length;

  return {
    receitaRealizada,
    receitaContratada,
    despesaTotal,
    despesaMarketing,
    resultado,
    margem,
    ticketMedio,
    qtdVendas,
    qtdClientesAtivos,
  };
}

// ============================================================
// getDREMensal
// ============================================================

export type DREMensalRow = {
  mes: string;
  receitaPorProduto: Record<string, number>;
  receitaTotal: number;
  despesaPorCategoria: Record<string, number>;
  despesaTotal: number;
  resultado: number;
  margem: number;
};

export async function getDREMensal(
  fromMonth: string,
  toMonth: string
): Promise<DREMensalRow[]> {
  await requireInternalUser();

  const [recebimentos, despesas] = await Promise.all([
    getRecebimentos(),
    getDespesas(),
  ]);

  const months = generateMonthRange(fromMonth, toMonth);

  return months.map((mes) => {
    // Receitas por produto
    const recMes = recebimentos.filter((r) => (r.ano_mes || toYYYYMM(r.data_recebimento)) === mes);
    const receitaPorProduto: Record<string, number> = {};
    for (const r of recMes) {
      const prod = r.produto_final || r.produto || "Outros";
      receitaPorProduto[prod] = (receitaPorProduto[prod] || 0) + r.valor_liquido_recebido;
    }
    const receitaTotal = recMes.reduce((s, r) => s + r.valor_liquido_recebido, 0);

    // Despesas por categoria (só pagas)
    const despMes = despesas.filter(
      (d) =>
        (d.ano_mes || toYYYYMM(d.data)) === mes &&
        (d.status || "").toLowerCase() === "pago"
    );
    const despesaPorCategoria: Record<string, number> = {};
    for (const d of despMes) {
      const cat = d.categoria || "Outros";
      despesaPorCategoria[cat] = (despesaPorCategoria[cat] || 0) + d.valor;
    }
    const despesaTotal = despMes.reduce((s, d) => s + d.valor, 0);

    const resultado = receitaTotal - despesaTotal;
    const margem = receitaTotal > 0 ? resultado / receitaTotal : 0;

    return { mes, receitaPorProduto, receitaTotal, despesaPorCategoria, despesaTotal, resultado, margem };
  });
}

// ============================================================
// getContratadoVsRealizado
// ============================================================

export type ContratadoVsRealizadoRow = {
  mes: string;
  contratado: number;
  realizado: number;
  gap: number;
};

export async function getContratadoVsRealizado(
  fromMonth: string,
  toMonth: string
): Promise<ContratadoVsRealizadoRow[]> {
  await requireInternalUser();

  const [vendas, recebimentos] = await Promise.all([
    getVendas(),
    getRecebimentos(),
  ]);

  const months = generateMonthRange(fromMonth, toMonth);

  return months.map((mes) => {
    const contratado = vendas
      .filter((v) => toYYYYMM(v.data_venda) === mes && vendaStatusOk(v))
      .reduce((s, v) => s + v.valor_liquido_contratado, 0);

    const realizado = recebimentos
      .filter((r) => (r.ano_mes || toYYYYMM(r.data_recebimento)) === mes)
      .reduce((s, r) => s + r.valor_liquido_recebido, 0);

    return { mes, contratado, realizado, gap: contratado - realizado };
  });
}

// ============================================================
// getContasAReceber
// ============================================================

export type ContasAReceberDetalhe = {
  venda_id: string;
  cliente: string;
  produto: string;
  contratado: number;
  recebido: number;
  saldo: number;
  data_venda: string | null; // serialized
};

export type ContasAReceberData = {
  resumo: {
    saldoTotal: number;
    contratosAbertos: number;
    totalContratado: number;
    totalRecebido: number;
  };
  detalhe: ContasAReceberDetalhe[];
};

export async function getContasAReceber(): Promise<ContasAReceberData> {
  await requireInternalUser();

  const [vendas, recebimentos] = await Promise.all([
    getVendas(),
    getRecebimentos(),
  ]);

  // Sum recebimentos by venda_id
  const recebidoPorVenda = new Map<string, number>();
  for (const r of recebimentos) {
    if (r.venda_id) {
      recebidoPorVenda.set(
        r.venda_id,
        (recebidoPorVenda.get(r.venda_id) || 0) + r.valor_liquido_recebido
      );
    }
  }

  const detalhe: ContasAReceberDetalhe[] = [];

  for (const v of vendas) {
    if (!vendaStatusOk(v)) continue;
    const contratado = v.valor_liquido_contratado;
    const recebido = recebidoPorVenda.get(v.venda_id) || 0;
    const saldo = contratado - recebido;
    if (saldo <= 0) continue;

    detalhe.push({
      venda_id: v.venda_id,
      cliente: v.nome_cliente || v.cliente_id,
      produto: v.produto,
      contratado,
      recebido,
      saldo,
      data_venda: v.data_venda?.toISOString() ?? null,
    });
  }

  // Sort by saldo descending
  detalhe.sort((a, b) => b.saldo - a.saldo);

  const totalContratado = detalhe.reduce((s, d) => s + d.contratado, 0);
  const totalRecebido = detalhe.reduce((s, d) => s + d.recebido, 0);

  return {
    resumo: {
      saldoTotal: totalContratado - totalRecebido,
      contratosAbertos: detalhe.length,
      totalContratado,
      totalRecebido,
    },
    detalhe,
  };
}

// ============================================================
// getFunilMetrics
// ============================================================

export type FunilMetricRow = {
  imersao_id: string;
  datas: string;
  tema: string;
  gasto_total: number;
  leads: number;
  cpl: number;
  vendas_total: number;
  receita_total: number;
  cac: number;
  take_rate_club: number;
  take_rate_tracao: number;
  roi: number;
};

export async function getFunilMetrics(
  imersaoId?: string
): Promise<FunilMetricRow[]> {
  await requireInternalUser();

  const funil = await getFunilImersao();

  const rows = funil
    .filter((f) => (!imersaoId || f.imersao_id === imersaoId))
    .map((f) => {
      const vendas_total =
        f.vendas_imersao_qtd + f.vendas_club_qtd + f.vendas_tracao_qtd;
      const roi =
        f.gasto_total > 0
          ? (f.receita_total - f.gasto_total) / f.gasto_total
          : 0;

      return {
        imersao_id: f.imersao_id,
        datas: f.datas,
        tema: f.tema,
        gasto_total: f.gasto_total,
        leads: f.leads,
        cpl: f.cpl,
        vendas_total,
        receita_total: f.receita_total,
        cac: f.cac_imersao,
        take_rate_club: f.take_rate_club,
        take_rate_tracao: f.take_rate_tracao,
        roi,
      };
    });

  return rows;
}

// ============================================================
// getClientesSummary
// ============================================================

export type ClientesSummary = {
  total: number;
  ativos: number;
  churn: number;
  porSegmento: Record<string, number>;
  porProduto: Record<string, number>;
  porCS: Record<string, number>;
  ticketMedioPorSegmento: Record<string, number>;
  faturamentoMedioPorSegmento: Record<string, number>;
};

export async function getClientesSummary(): Promise<ClientesSummary> {
  await requireInternalUser();

  const clientes = await getClientes();

  const total = clientes.length;
  const ativos = clientes.filter(
    (c) => (c.status_cliente || "").toLowerCase() === "ativo"
  ).length;
  const churn = clientes.filter(
    (c) => (c.status_cliente || "").toLowerCase() === "churn"
  ).length;

  const porSegmento: Record<string, number> = {};
  const porProduto: Record<string, number> = {};
  const porCS: Record<string, number> = {};
  const segFat: Record<string, { sum: number; count: number }> = {};
  const segTicket: Record<string, { sum: number; count: number }> = {};

  for (const c of clientes) {
    const seg = c.segmento || "N/A";
    const prod = c.produto_atual || "N/A";
    const cs = c.cs_responsavel || "N/A";

    porSegmento[seg] = (porSegmento[seg] || 0) + 1;
    porProduto[prod] = (porProduto[prod] || 0) + 1;
    porCS[cs] = (porCS[cs] || 0) + 1;

    if (!segFat[seg]) segFat[seg] = { sum: 0, count: 0 };
    segFat[seg].sum += c.faturamento_medio_mensal;
    segFat[seg].count += 1;

    // ticket = same as faturamento for segmento grouping
    if (!segTicket[seg]) segTicket[seg] = { sum: 0, count: 0 };
    segTicket[seg].sum += c.faturamento_medio_mensal;
    segTicket[seg].count += 1;
  }

  const ticketMedioPorSegmento: Record<string, number> = {};
  const faturamentoMedioPorSegmento: Record<string, number> = {};
  for (const seg of Object.keys(segFat)) {
    faturamentoMedioPorSegmento[seg] =
      segFat[seg].count > 0 ? segFat[seg].sum / segFat[seg].count : 0;
    ticketMedioPorSegmento[seg] =
      segTicket[seg].count > 0 ? segTicket[seg].sum / segTicket[seg].count : 0;
  }

  return {
    total,
    ativos,
    churn,
    porSegmento,
    porProduto,
    porCS,
    ticketMedioPorSegmento,
    faturamentoMedioPorSegmento,
  };
}

// ============================================================
// refreshSheetsData — force reload
// ============================================================

export async function refreshSheetsData(): Promise<void> {
  await requireInternalUser();
  clearSheetsCache();
}
