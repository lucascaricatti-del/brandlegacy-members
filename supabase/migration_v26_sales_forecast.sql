-- Migration v26: Sales Forecast table
-- Run AFTER migration_v25

CREATE TABLE IF NOT EXISTS sales_forecast (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL, -- 1-12
  channel TEXT NOT NULL DEFAULT 'ecommerce', -- 'ecommerce' | 'marketplaces' | 'consolidado'

  -- Inputs (user fills manually)
  faturamento_bruto NUMERIC(12,2),
  pedidos INTEGER,
  investimento_midia NUMERIC(12,2),
  imposto_pct NUMERIC(5,2), -- % ex: 10.0
  cmv_pct NUMERIC(5,2),     -- % ex: 15.0

  -- Auto-calculated (derived)
  ticket_medio NUMERIC(10,2) GENERATED ALWAYS AS (
    CASE WHEN pedidos > 0 THEN ROUND(faturamento_bruto / pedidos, 2) ELSE 0 END
  ) STORED,
  imposto_rs NUMERIC(12,2) GENERATED ALWAYS AS (
    ROUND(faturamento_bruto * imposto_pct / 100, 2)
  ) STORED,
  cmv_rs NUMERIC(12,2) GENERATED ALWAYS AS (
    ROUND(faturamento_bruto * cmv_pct / 100, 2)
  ) STORED,
  faturamento_liquido NUMERIC(12,2) GENERATED ALWAYS AS (
    ROUND(faturamento_bruto * (1 - imposto_pct/100), 2)
  ) STORED,
  lucro_apos_aquisicao NUMERIC(12,2) GENERATED ALWAYS AS (
    ROUND(faturamento_bruto * (1 - imposto_pct/100 - cmv_pct/100) - COALESCE(investimento_midia, 0), 2)
  ) STORED,
  roas NUMERIC(8,2) GENERATED ALWAYS AS (
    CASE WHEN investimento_midia > 0
    THEN ROUND(faturamento_bruto / investimento_midia, 2)
    ELSE 0 END
  ) STORED,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, year, month, channel)
);

ALTER TABLE sales_forecast ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can read sales_forecast" ON sales_forecast FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = sales_forecast.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.is_active = true
  ));

CREATE POLICY "service role full access sales_forecast" ON sales_forecast FOR ALL
  USING (auth.role() = 'service_role');
