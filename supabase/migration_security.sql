-- ============================================================
-- Migration: Row Level Security for workspace-scoped tables
-- Date: 2026-03-08
--
-- Purpose:
--   Enable RLS on all tables that store workspace-scoped data
--   (metrics, orders, integrations, influencers, costs).
--   Each table gets three policies:
--     1. Workspace members can SELECT their own workspace rows
--     2. Admins can SELECT all rows
--     3. service_role has unrestricted access (for API routes via adminClient)
--
--   This migration is idempotent: all policies are dropped before creation.
-- ============================================================

-- ============================================================
-- 1. yampi_orders
-- ============================================================
ALTER TABLE yampi_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace members can read yampi_orders" ON yampi_orders;
CREATE POLICY "workspace members can read yampi_orders"
  ON yampi_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = yampi_orders.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.is_active = true
    )
  );

DROP POLICY IF EXISTS "admins can read yampi_orders" ON yampi_orders;
CREATE POLICY "admins can read yampi_orders"
  ON yampi_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "service role full access yampi_orders" ON yampi_orders;
CREATE POLICY "service role full access yampi_orders"
  ON yampi_orders FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================================
-- 2. yampi_metrics
-- ============================================================
ALTER TABLE yampi_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace members can read yampi_metrics" ON yampi_metrics;
CREATE POLICY "workspace members can read yampi_metrics"
  ON yampi_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = yampi_metrics.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.is_active = true
    )
  );

DROP POLICY IF EXISTS "admins can read yampi_metrics" ON yampi_metrics;
CREATE POLICY "admins can read yampi_metrics"
  ON yampi_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "service role full access yampi_metrics" ON yampi_metrics;
CREATE POLICY "service role full access yampi_metrics"
  ON yampi_metrics FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================================
-- 3. ml_orders
-- ============================================================
ALTER TABLE ml_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace members can read ml_orders" ON ml_orders;
CREATE POLICY "workspace members can read ml_orders"
  ON ml_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = ml_orders.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.is_active = true
    )
  );

DROP POLICY IF EXISTS "admins can read ml_orders" ON ml_orders;
CREATE POLICY "admins can read ml_orders"
  ON ml_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "service role full access ml_orders" ON ml_orders;
CREATE POLICY "service role full access ml_orders"
  ON ml_orders FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================================
-- 4. ml_claims
-- ============================================================
ALTER TABLE ml_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace members can read ml_claims" ON ml_claims;
CREATE POLICY "workspace members can read ml_claims"
  ON ml_claims FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = ml_claims.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.is_active = true
    )
  );

DROP POLICY IF EXISTS "admins can read ml_claims" ON ml_claims;
CREATE POLICY "admins can read ml_claims"
  ON ml_claims FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "service role full access ml_claims" ON ml_claims;
CREATE POLICY "service role full access ml_claims"
  ON ml_claims FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================================
-- 5. ml_finances
-- ============================================================
ALTER TABLE ml_finances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace members can read ml_finances" ON ml_finances;
CREATE POLICY "workspace members can read ml_finances"
  ON ml_finances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = ml_finances.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.is_active = true
    )
  );

DROP POLICY IF EXISTS "admins can read ml_finances" ON ml_finances;
CREATE POLICY "admins can read ml_finances"
  ON ml_finances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "service role full access ml_finances" ON ml_finances;
CREATE POLICY "service role full access ml_finances"
  ON ml_finances FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================================
-- 6. ml_items
-- ============================================================
ALTER TABLE ml_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace members can read ml_items" ON ml_items;
CREATE POLICY "workspace members can read ml_items"
  ON ml_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = ml_items.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.is_active = true
    )
  );

DROP POLICY IF EXISTS "admins can read ml_items" ON ml_items;
CREATE POLICY "admins can read ml_items"
  ON ml_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "service role full access ml_items" ON ml_items;
CREATE POLICY "service role full access ml_items"
  ON ml_items FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================================
-- 7. ads_metrics
-- ============================================================
ALTER TABLE ads_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace members can read ads_metrics" ON ads_metrics;
CREATE POLICY "workspace members can read ads_metrics"
  ON ads_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = ads_metrics.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.is_active = true
    )
  );

DROP POLICY IF EXISTS "admins can read ads_metrics" ON ads_metrics;
CREATE POLICY "admins can read ads_metrics"
  ON ads_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "service role full access ads_metrics" ON ads_metrics;
CREATE POLICY "service role full access ads_metrics"
  ON ads_metrics FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================================
-- 8. ecommerce_metrics
-- ============================================================
ALTER TABLE ecommerce_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace members can read ecommerce_metrics" ON ecommerce_metrics;
CREATE POLICY "workspace members can read ecommerce_metrics"
  ON ecommerce_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = ecommerce_metrics.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.is_active = true
    )
  );

DROP POLICY IF EXISTS "admins can read ecommerce_metrics" ON ecommerce_metrics;
CREATE POLICY "admins can read ecommerce_metrics"
  ON ecommerce_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "service role full access ecommerce_metrics" ON ecommerce_metrics;
CREATE POLICY "service role full access ecommerce_metrics"
  ON ecommerce_metrics FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================================
-- 9. ga4_metrics
-- ============================================================
ALTER TABLE ga4_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ga4_metrics_workspace" ON ga4_metrics;
DROP POLICY IF EXISTS "workspace members can read ga4_metrics" ON ga4_metrics;
CREATE POLICY "workspace members can read ga4_metrics"
  ON ga4_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = ga4_metrics.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.is_active = true
    )
  );

DROP POLICY IF EXISTS "admins can read ga4_metrics" ON ga4_metrics;
CREATE POLICY "admins can read ga4_metrics"
  ON ga4_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "service role full access ga4_metrics" ON ga4_metrics;
CREATE POLICY "service role full access ga4_metrics"
  ON ga4_metrics FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================================
-- 10. workspace_integrations
-- ============================================================
ALTER TABLE workspace_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace members can read workspace_integrations" ON workspace_integrations;
CREATE POLICY "workspace members can read workspace_integrations"
  ON workspace_integrations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_integrations.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.is_active = true
    )
  );

DROP POLICY IF EXISTS "admins can read workspace_integrations" ON workspace_integrations;
CREATE POLICY "admins can read workspace_integrations"
  ON workspace_integrations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "service role full access workspace_integrations" ON workspace_integrations;
CREATE POLICY "service role full access workspace_integrations"
  ON workspace_integrations FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================================
-- 11. influencer_orders
-- ============================================================
ALTER TABLE influencer_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace members can read influencer_orders" ON influencer_orders;
CREATE POLICY "workspace members can read influencer_orders"
  ON influencer_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = influencer_orders.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.is_active = true
    )
  );

DROP POLICY IF EXISTS "admins can read influencer_orders" ON influencer_orders;
CREATE POLICY "admins can read influencer_orders"
  ON influencer_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "service role full access influencer_orders" ON influencer_orders;
CREATE POLICY "service role full access influencer_orders"
  ON influencer_orders FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================================
-- 12. influencer_sequences
-- ============================================================
ALTER TABLE influencer_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sequences_workspace" ON influencer_sequences;
DROP POLICY IF EXISTS "workspace members can read influencer_sequences" ON influencer_sequences;
CREATE POLICY "workspace members can read influencer_sequences"
  ON influencer_sequences FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = influencer_sequences.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.is_active = true
    )
  );

DROP POLICY IF EXISTS "admins can read influencer_sequences" ON influencer_sequences;
CREATE POLICY "admins can read influencer_sequences"
  ON influencer_sequences FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "service role full access influencer_sequences" ON influencer_sequences;
CREATE POLICY "service role full access influencer_sequences"
  ON influencer_sequences FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================================
-- 13. marketplace_manual_costs
-- ============================================================
ALTER TABLE marketplace_manual_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace members can read marketplace_manual_costs" ON marketplace_manual_costs;
CREATE POLICY "workspace members can read marketplace_manual_costs"
  ON marketplace_manual_costs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = marketplace_manual_costs.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.is_active = true
    )
  );

DROP POLICY IF EXISTS "admins can read marketplace_manual_costs" ON marketplace_manual_costs;
CREATE POLICY "admins can read marketplace_manual_costs"
  ON marketplace_manual_costs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "service role full access marketplace_manual_costs" ON marketplace_manual_costs;
CREATE POLICY "service role full access marketplace_manual_costs"
  ON marketplace_manual_costs FOR ALL
  USING (auth.role() = 'service_role');
