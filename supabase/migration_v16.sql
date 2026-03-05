-- Migration v16: Add fee breakdown columns to ml_orders
-- These columns store the individual Mercado Livre fee components
-- and the fully calculated net revenue (after all fees and shipping costs)

ALTER TABLE ml_orders ADD COLUMN IF NOT EXISTS ml_commission NUMERIC(10,2) DEFAULT 0;
ALTER TABLE ml_orders ADD COLUMN IF NOT EXISTS ml_fixed_fee NUMERIC(10,2) DEFAULT 0;
ALTER TABLE ml_orders ADD COLUMN IF NOT EXISTS ml_financing_fee NUMERIC(10,2) DEFAULT 0;
ALTER TABLE ml_orders ADD COLUMN IF NOT EXISTS frete_custo NUMERIC(10,2) DEFAULT 0;
ALTER TABLE ml_orders ADD COLUMN IF NOT EXISTS net_revenue_full NUMERIC(10,2) DEFAULT 0;
