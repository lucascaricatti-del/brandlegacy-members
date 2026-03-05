-- migration_v19: Fix double-counting of fixed fee + exclude cancelled from RPC

-- 1. Zero out ml_fixed_fee (sale_fee already includes it) and recalculate net_revenue_full
UPDATE ml_orders
SET ml_fixed_fee = 0,
    net_revenue_full = revenue - ml_commission - frete_custo
WHERE workspace_id = '313aa5ab-7d05-4ffd-8f77-306e0a81e488';

-- 2. Updated RPC: excludes cancelled/refunded, no fixed_fee, total_fees = commission + frete only
CREATE OR REPLACE FUNCTION get_ml_metrics(
  p_workspace_id UUID,
  p_date_from DATE,
  p_date_to DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_revenue', COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','refunded') THEN revenue ELSE 0 END), 0),
    'total_orders', COUNT(CASE WHEN status NOT IN ('cancelled','refunded') THEN 1 END),
    'total_cancelled', COUNT(CASE WHEN status IN ('cancelled','refunded') THEN 1 END),
    'total_units', COALESCE((
      SELECT SUM((item->>'quantity')::int)
      FROM ml_orders o2, jsonb_array_elements(o2.items) item
      WHERE o2.workspace_id = p_workspace_id AND o2.date >= p_date_from AND o2.date <= p_date_to
      AND o2.status NOT IN ('cancelled','refunded') AND o2.items IS NOT NULL
    ), 0),
    'avg_ticket', COALESCE(
      NULLIF(SUM(CASE WHEN status NOT IN ('cancelled','refunded') THEN revenue ELSE 0 END), 0) /
      NULLIF(COUNT(CASE WHEN status NOT IN ('cancelled','refunded') THEN 1 END), 0), 0),
    'total_commission', COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','refunded') THEN ml_commission ELSE 0 END), 0),
    'total_fixed_fee', 0,
    'total_frete', COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','refunded') THEN frete_custo ELSE 0 END), 0),
    'total_fees', COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','refunded') THEN ml_commission + frete_custo ELSE 0 END), 0),
    'total_net', COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','refunded') THEN net_revenue_full ELSE 0 END), 0)
  ) INTO result
  FROM ml_orders WHERE workspace_id = p_workspace_id AND date >= p_date_from AND date <= p_date_to;
  RETURN result;
END;
$$;

-- 3. Updated top products: exclude cancelled/refunded
CREATE OR REPLACE FUNCTION get_ml_top_products(
  p_workspace_id UUID,
  p_date_from DATE,
  p_date_to DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(row_to_json(t)) INTO result
  FROM (
    SELECT
      item->>'title' AS title,
      COUNT(DISTINCT o.order_id) AS order_count,
      SUM((item->>'quantity')::int) AS total_units,
      ROUND(SUM((item->>'unit_price')::numeric * (item->>'quantity')::int)::numeric, 2) AS total_revenue,
      ROUND((SUM((item->>'unit_price')::numeric * (item->>'quantity')::int) /
        NULLIF(COUNT(DISTINCT o.order_id), 0))::numeric, 2) AS avg_ticket
    FROM ml_orders o,
         jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) AS item
    WHERE o.workspace_id = p_workspace_id
      AND o.date >= p_date_from
      AND o.date <= p_date_to
      AND o.status NOT IN ('cancelled','refunded')
    GROUP BY item->>'title'
    ORDER BY total_revenue DESC
    LIMIT 10
  ) t;
  RETURN COALESCE(result, '[]'::json);
END;
$$;
