-- migration_v32: Marketplace Consolidated — manual metrics, tax config, consolidated RPC

-- 1. Table: marketplace_manual_metrics
CREATE TABLE IF NOT EXISTS marketplace_manual_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  marketplace TEXT NOT NULL CHECK (marketplace IN ('shopee','magalu','netshoes','tiktok_shop')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  gross_revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
  orders_count INTEGER NOT NULL DEFAULT 0,
  units_sold INTEGER NOT NULL DEFAULT 0,
  ad_spend NUMERIC(14,2) NOT NULL DEFAULT 0,
  shipping_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  returns_count INTEGER NOT NULL DEFAULT 0,
  returns_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (workspace_id, marketplace, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_manual_metrics_ws_dates
  ON marketplace_manual_metrics (workspace_id, period_start, period_end);

-- RLS
ALTER TABLE marketplace_manual_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manual_metrics_member_select" ON marketplace_manual_metrics
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "manual_metrics_member_insert" ON marketplace_manual_metrics
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "manual_metrics_member_update" ON marketplace_manual_metrics
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "manual_metrics_admin_all" ON marketplace_manual_metrics
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "manual_metrics_service_role" ON marketplace_manual_metrics
  FOR ALL USING (auth.role() = 'service_role');


-- 2. Table: workspace_tax_config
CREATE TABLE IF NOT EXISTS workspace_tax_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  marketplace TEXT NOT NULL DEFAULT '_all',
  effective_tax_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  simples_nacional_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  icms_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  pis_cofins_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (workspace_id, marketplace)
);

-- RLS
ALTER TABLE workspace_tax_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tax_config_member_select" ON workspace_tax_config
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "tax_config_member_insert" ON workspace_tax_config
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "tax_config_member_update" ON workspace_tax_config
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "tax_config_admin_all" ON workspace_tax_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "tax_config_service_role" ON workspace_tax_config
  FOR ALL USING (auth.role() = 'service_role');


-- 3. RPC: get_consolidated_marketplace_metrics
CREATE OR REPLACE FUNCTION get_consolidated_marketplace_metrics(
  p_workspace_id UUID,
  p_date_from DATE,
  p_date_to DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ml_data JSON;
  manual_data JSON;
  tax_data JSON;
  result JSON;
BEGIN
  -- Mercado Livre aggregation (from ml_orders, excluding cancelled/refunded)
  SELECT json_build_object(
    'marketplace', 'mercadolivre',
    'gross_revenue', COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','refunded') THEN revenue ELSE 0 END), 0),
    'net_revenue', COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','refunded') THEN net_revenue_full ELSE 0 END), 0),
    'orders_count', COUNT(CASE WHEN status NOT IN ('cancelled','refunded') THEN 1 END),
    'units_sold', COALESCE((
      SELECT SUM((item->>'quantity')::int)
      FROM ml_orders o2, jsonb_array_elements(o2.items) item
      WHERE o2.workspace_id = p_workspace_id AND o2.date >= p_date_from AND o2.date <= p_date_to
      AND o2.status NOT IN ('cancelled','refunded') AND o2.items IS NOT NULL
    ), 0),
    'avg_ticket', COALESCE(
      NULLIF(SUM(CASE WHEN status NOT IN ('cancelled','refunded') THEN revenue ELSE 0 END), 0) /
      NULLIF(COUNT(CASE WHEN status NOT IN ('cancelled','refunded') THEN 1 END), 0), 0),
    'commission', COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','refunded') THEN ml_commission ELSE 0 END), 0),
    'shipping', COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','refunded') THEN frete_custo ELSE 0 END), 0)
  ) INTO ml_data
  FROM ml_orders WHERE workspace_id = p_workspace_id AND date >= p_date_from AND date <= p_date_to;

  -- Manual marketplaces aggregation (overlapping periods)
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO manual_data
  FROM (
    SELECT
      marketplace,
      SUM(gross_revenue) AS gross_revenue,
      SUM(net_revenue) AS net_revenue,
      SUM(orders_count) AS orders_count,
      SUM(units_sold) AS units_sold,
      SUM(ad_spend) AS ad_spend,
      SUM(shipping_cost) AS shipping_cost,
      SUM(returns_count) AS returns_count,
      SUM(returns_value) AS returns_value,
      CASE WHEN SUM(orders_count) > 0
        THEN ROUND(SUM(gross_revenue) / SUM(orders_count), 2)
        ELSE 0 END AS avg_ticket
    FROM marketplace_manual_metrics
    WHERE workspace_id = p_workspace_id
      AND period_start <= p_date_to
      AND period_end >= p_date_from
    GROUP BY marketplace
  ) t;

  -- Tax config
  SELECT COALESCE(json_agg(row_to_json(tc)), '[]'::json) INTO tax_data
  FROM (
    SELECT marketplace, effective_tax_pct, simples_nacional_pct, icms_pct, pis_cofins_pct
    FROM workspace_tax_config
    WHERE workspace_id = p_workspace_id
  ) tc;

  -- Build final result
  result := json_build_object(
    'mercadolivre', ml_data,
    'manual_marketplaces', manual_data,
    'tax_config', tax_data
  );

  RETURN result;
END;
$$;
