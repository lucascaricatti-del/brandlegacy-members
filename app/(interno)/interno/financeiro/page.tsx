import FinanceiroDashboardClient from "./FinanceiroDashboardClient";
import {
  getFinancialKPIs,
  getDREMensal,
  getContratadoVsRealizado,
  getContasAReceber,
  getFunilMetrics,
  getClientesSummary,
} from "@/app/actions/sheets-financial";

export const dynamic = "force-dynamic";

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function sixMonthsAgo(): string {
  const now = new Date();
  now.setMonth(now.getMonth() - 5);
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default async function FinanceiroInternoPage() {
  const month = currentMonth();
  const from = sixMonthsAgo();

  let initialData;
  try {
    const [kpis, dre, contratado, receber, funil, clientes] =
      await Promise.all([
        getFinancialKPIs(month),
        getDREMensal(from, month),
        getContratadoVsRealizado(from, month),
        getContasAReceber(),
        getFunilMetrics(),
        getClientesSummary(),
      ]);

    initialData = { kpis, dre, contratado, receber, funil, clientes, month, from };
  } catch (err) {
    console.error("[Financeiro Interno] Error loading data:", err);
    initialData = null;
  }

  return <FinanceiroDashboardClient initialData={initialData} />;
}
