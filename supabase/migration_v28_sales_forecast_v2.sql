-- Migration v28: Sales Forecast v2 + Media Plan metadata
-- Adds new columns for taxas, comissão marketplace, cancelamento, logística
-- Adds metadata JSONB to media_plans for min investment toggle
-- Run AFTER migration_v27

-- Add metadata to media_plans for min investment settings
ALTER TABLE media_plans ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Drop existing generated columns that need formula changes
ALTER TABLE sales_forecast
  DROP COLUMN IF EXISTS faturamento_liquido,
  DROP COLUMN IF EXISTS lucro_apos_aquisicao;

-- Add new input columns
ALTER TABLE sales_forecast
  ADD COLUMN IF NOT EXISTS taxas_pct NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comissao_marketplace_pct NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancelamento_pct NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS logistica_rs NUMERIC(12,2) DEFAULT 0;

-- Add generated columns for auto-calculated values
ALTER TABLE sales_forecast
  ADD COLUMN IF NOT EXISTS taxas_rs NUMERIC(12,2) GENERATED ALWAYS AS (
    ROUND(COALESCE(faturamento_bruto, 0) * COALESCE(taxas_pct, 0) / 100, 2)
  ) STORED;

ALTER TABLE sales_forecast
  ADD COLUMN IF NOT EXISTS comissao_marketplace_rs NUMERIC(12,2) GENERATED ALWAYS AS (
    ROUND(COALESCE(faturamento_bruto, 0) * COALESCE(comissao_marketplace_pct, 0) / 100, 2)
  ) STORED;

ALTER TABLE sales_forecast
  ADD COLUMN IF NOT EXISTS cancelamento_rs NUMERIC(12,2) GENERATED ALWAYS AS (
    ROUND(COALESCE(faturamento_bruto, 0) * COALESCE(cancelamento_pct, 0) / 100, 2)
  ) STORED;

-- Re-create generated columns with updated formulas (now includes taxas)
ALTER TABLE sales_forecast
  ADD COLUMN faturamento_liquido NUMERIC(12,2) GENERATED ALWAYS AS (
    ROUND(COALESCE(faturamento_bruto, 0) * (1 - COALESCE(imposto_pct, 0)/100 - COALESCE(taxas_pct, 0)/100 - COALESCE(comissao_marketplace_pct, 0)/100 - COALESCE(cancelamento_pct, 0)/100), 2)
  ) STORED;

ALTER TABLE sales_forecast
  ADD COLUMN lucro_apos_aquisicao NUMERIC(12,2) GENERATED ALWAYS AS (
    ROUND(
      COALESCE(faturamento_bruto, 0) * (1 - COALESCE(imposto_pct, 0)/100 - COALESCE(taxas_pct, 0)/100 - COALESCE(comissao_marketplace_pct, 0)/100 - COALESCE(cancelamento_pct, 0)/100 - COALESCE(cmv_pct, 0)/100)
      - COALESCE(investimento_midia, 0)
      - COALESCE(logistica_rs, 0),
    2)
  ) STORED;
