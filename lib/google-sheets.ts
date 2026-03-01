import { google } from "googleapis";

// ============================================================
// Types
// ============================================================

export type Cliente = {
  cliente_id: string;
  nome: string;
  empresa: string;
  email: string;
  telefone: string;
  segmento: string;
  canal_aquisicao: string;
  faturamento_medio_mensal: number;
  tamanho_time: number;
  cidade_uf: string;
  data_entrada: Date | null;
  produto_atual: string;
  status_cliente: string;
  cs_responsavel: string;
  observacoes: string;
};

export type Venda = {
  venda_id: string;
  data_venda: Date | null;
  data_inicio: Date | null;
  produto: string;
  imersao_id: string;
  cliente_id: string;
  nome_cliente: string;
  canal_aquisicao: string;
  status_venda: string;
  valor_bruto: number;
  desconto: number;
  valor_liquido_contratado: number;
  modalidade_pagamento: string;
  forma_pagamento: string;
  entrada: number;
  qtd_parcelas: number;
  valor_parcela: number;
  primeiro_vencimento: Date | null;
  observacoes: string;
  moeda: string;
};

export type Recebimento = {
  recebimento_id: string;
  data_recebimento: Date | null;
  venda_id: string;
  cliente_id: string;
  produto: string;
  cliente_id_final: string;
  produto_final: string;
  nome_cliente: string;
  valor_bruto_recebido: number;
  taxas: number;
  valor_liquido_recebido: number;
  forma_pagamento: string;
  num_parcela: string;
  centro_de_custo: string;
  observacoes: string;
  ano_mes: string;
};

export type Despesa = {
  despesa_id: string;
  data: Date | null;
  fornecedor: string;
  categoria: string;
  subcategoria: string;
  centro_de_custo: string;
  produto: string;
  valor: number;
  forma_pagamento: string;
  status: string;
  observacoes: string;
  ano_mes: string;
};

export type FunilImersao = {
  imersao_id: string;
  datas: string;
  tema: string;
  gasto_meta: number;
  gasto_google: number;
  outros_gastos: number;
  gasto_total: number;
  leads: number;
  cpl: number;
  vendas_imersao_qtd: number;
  receita_imersao: number;
  vendas_club_qtd: number;
  receita_club: number;
  vendas_tracao_qtd: number;
  receita_tracao: number;
  receita_total: number;
  cac_imersao: number;
  take_rate_club: number;
  take_rate_tracao: number;
  observacoes: string;
};

// ============================================================
// In-memory cache (5 min TTL)
// ============================================================

const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map<string, { ts: number; data: unknown[] }>();

function getCached<T>(key: string): T[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data as T[];
}

function setCache<T>(key: string, data: T[]): void {
  cache.set(key, { ts: Date.now(), data });
}

export function clearSheetsCache(): void {
  cache.clear();
}

// ============================================================
// Google Sheets auth (singleton)
// ============================================================

let _sheets: ReturnType<typeof google.sheets> | null = null;

function getSheetsClient() {
  if (_sheets) return _sheets;

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  const privateKey = rawKey?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY");
  }

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  _sheets = google.sheets({ version: "v4", auth });
  return _sheets;
}

function getSpreadsheetId(): string {
  const id = process.env.GOOGLE_SHEETS_ID;
  if (!id) throw new Error("Missing GOOGLE_SHEETS_ID");
  return id;
}

// ============================================================
// Slugify header → field name
// ============================================================

function slugify(header: string): string {
  return header
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/\(r\$\)/g, "")
    .replace(/\(auto\)/g, "")
    .replace(/\(opcional\)/g, "")
    .replace(/\(qtd\)/g, "_qtd")
    .replace(/[()]/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

// Header slug → TypeScript field name mapping
const FIELD_MAP: Record<string, string> = {
  // Clientes
  cliente_id: "cliente_id",
  nome: "nome",
  empresa: "empresa",
  e_mail: "email",
  email: "email",
  telefone: "telefone",
  segmento: "segmento",
  canal_aquisicao: "canal_aquisicao",
  faturamento_medio_mensal: "faturamento_medio_mensal",
  tamanho_time: "tamanho_time",
  cidade_uf: "cidade_uf",
  data_entrada: "data_entrada",
  produto_atual: "produto_atual",
  status_cliente: "status_cliente",
  cs_responsavel: "cs_responsavel",
  observacoes: "observacoes",

  // Vendas
  venda_id: "venda_id",
  data_venda: "data_venda",
  data_inicio: "data_inicio",
  produto: "produto",
  imersao_id: "imersao_id",
  nome_cliente: "nome_cliente",
  status_venda: "status_venda",
  valor_bruto: "valor_bruto",
  desconto: "desconto",
  valor_liquido_contratado: "valor_liquido_contratado",
  modalidade_pagamento: "modalidade_pagamento",
  forma_pagamento: "forma_pagamento",
  entrada: "entrada",
  qtd_parcelas: "qtd_parcelas",
  valor_parcela: "valor_parcela",
  "1_vencimento": "primeiro_vencimento",
  primeiro_vencimento: "primeiro_vencimento",
  moeda: "moeda",

  // Recebimentos
  recebimento_id: "recebimento_id",
  data_recebimento: "data_recebimento",
  cliente_id_final: "cliente_id_final",
  produto_final: "produto_final",
  valor_bruto_recebido: "valor_bruto_recebido",
  taxas: "taxas",
  valor_liquido_recebido: "valor_liquido_recebido",
  n_parcela: "num_parcela",
  num_parcela: "num_parcela",
  centro_de_custo: "centro_de_custo",
  anomes: "ano_mes",
  ano_mes: "ano_mes",

  // Despesas
  despesa_id: "despesa_id",
  data: "data",
  fornecedor: "fornecedor",
  categoria: "categoria",
  subcategoria: "subcategoria",
  valor: "valor",
  status: "status",

  // Funil Imersão
  datas: "datas",
  tema: "tema",
  gasto_meta: "gasto_meta",
  gasto_google: "gasto_google",
  outros_gastos: "outros_gastos",
  gasto_total: "gasto_total",
  leads: "leads",
  cpl: "cpl",
  vendas_imersao_qtd: "vendas_imersao_qtd",
  receita_imersao: "receita_imersao",
  vendas_club_qtd: "vendas_club_qtd",
  receita_club: "receita_club",
  vendas_tracao_qtd: "vendas_tracao_qtd",
  receita_tracao: "receita_tracao",
  receita_total: "receita_total",
  cac_imersao: "cac_imersao",
  take_rate_club: "take_rate_club",
  take_rate_tracao: "take_rate_tracao",
};

// ============================================================
// Value parsing helpers
// ============================================================

const DATE_FIELDS = new Set([
  "data_entrada",
  "data_venda",
  "data_inicio",
  "data_recebimento",
  "primeiro_vencimento",
  "data",
]);

const NUMERIC_FIELDS = new Set([
  "faturamento_medio_mensal",
  "tamanho_time",
  "valor_bruto",
  "desconto",
  "valor_liquido_contratado",
  "entrada",
  "qtd_parcelas",
  "valor_parcela",
  "valor_bruto_recebido",
  "taxas",
  "valor_liquido_recebido",
  "valor",
  "gasto_meta",
  "gasto_google",
  "outros_gastos",
  "gasto_total",
  "leads",
  "cpl",
  "vendas_imersao_qtd",
  "receita_imersao",
  "vendas_club_qtd",
  "receita_club",
  "vendas_tracao_qtd",
  "receita_tracao",
  "receita_total",
  "cac_imersao",
  "take_rate_club",
  "take_rate_tracao",
]);

function parseNumeric(raw: string): number {
  if (!raw || raw.trim() === "" || raw === "-") return 0;
  const cleaned = raw
    .replace(/R\$\s*/gi, "")
    .replace(/\./g, "")     // remove thousands separator
    .replace(",", ".")      // decimal comma → dot
    .replace(/[^\d.\-]/g, "")
    .trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function parseDate(raw: string): Date | null {
  if (!raw || raw.trim() === "" || raw === "-") return null;
  // DD/MM/YYYY
  const parts = raw.trim().split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    if (!isNaN(date.getTime())) return date;
  }
  // fallback: try native parsing
  const fallback = new Date(raw);
  return isNaN(fallback.getTime()) ? null : fallback;
}

// ============================================================
// Generic sheet reader
// ============================================================

async function getSheetRows<T>(tabName: string): Promise<T[]> {
  const cacheKey = `tab:${tabName}`;
  const cached = getCached<T>(cacheKey);
  if (cached) return cached;

  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A1:AZ`,
  });

  const rawRows = response.data.values as string[][] | null | undefined;
  if (!rawRows || rawRows.length < 4) return [];

  const headerRow = rawRows[2] ?? rawRows[0];
  const fieldNames = headerRow.map((h) => {
    const slug = slugify(h);
    return FIELD_MAP[slug] || slug;
  });

  const result: T[] = [];
  // DEBUG: log raw rows
  console.log("[SHEETS DEBUG] tab:", tabName, "totalRows:", rawRows.length);
  console.log("[SHEETS DEBUG] row0:", JSON.stringify(rawRows[0]?.slice(0, 5)));
  console.log("[SHEETS DEBUG] row1:", JSON.stringify(rawRows[1]?.slice(0, 5)));
  console.log("[SHEETS DEBUG] row2:", JSON.stringify(rawRows[2]?.slice(0, 5)));
  console.log("[SHEETS DEBUG] fieldNames:", JSON.stringify(fieldNames?.slice(0, 5)));

  for (let i = 3; i < rawRows.length; i++) {
    const row = rawRows[i];
    // Skip completely empty rows
    if (!row || row.every((c) => !c || c.trim() === "")) continue;

    const obj: Record<string, unknown> = {};
    for (let j = 0; j < fieldNames.length; j++) {
      const field = fieldNames[j];
      const raw = row[j] ?? "";

      if (DATE_FIELDS.has(field)) {
        obj[field] = parseDate(raw);
      } else if (NUMERIC_FIELDS.has(field)) {
        obj[field] = parseNumeric(raw);
      } else {
        obj[field] = raw.trim();
      }
    }
    result.push(obj as T);
  }

  setCache(cacheKey, result);
  return result;
}

// ============================================================
// Tab-specific functions
// ============================================================

export function getClientes(): Promise<Cliente[]> {
  return getSheetRows<Cliente>("02_Clientes");
}

export function getVendas(): Promise<Venda[]> {
  return getSheetRows<Venda>("03_Vendas");
}

export function getRecebimentos(): Promise<Recebimento[]> {
  return getSheetRows<Recebimento>("04_Recebimentos");
}

export function getDespesas(): Promise<Despesa[]> {
  return getSheetRows<Despesa>("06_Despesas");
}

export function getFunilImersao(): Promise<FunilImersao[]> {
  return getSheetRows<FunilImersao>("09_Funil_Imersao");
}
