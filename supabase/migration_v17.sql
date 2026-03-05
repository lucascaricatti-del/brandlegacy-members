-- migration_v17: RPC functions for ML marketplace aggregation (bypass 1000-row limit)

-- 1. Aggregated metrics
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
    'total_revenue',      COALESCE(SUM(revenue), 0),
    'total_orders',       COUNT(*),
    'total_cancelled',    COUNT(*) FILTER (WHERE status = 'cancelled'),
    'total_units',        COALESCE(SUM(
      (SELECT COALESCE(SUM((elem->>'quantity')::int), 0)
       FROM jsonb_array_elements(COALESCE(items, '[]'::jsonb)) AS elem)
    ), 0),
    'avg_ticket',         CASE WHEN COUNT(*) > 0
                            THEN ROUND((COALESCE(SUM(revenue), 0) / COUNT(*))::numeric, 2)
                            ELSE 0
                          END,
    'total_commission',   COALESCE(SUM(ml_commission), 0),
    'total_fixed_fee',    COALESCE(SUM(ml_fixed_fee), 0),
    'total_financing_fee', COALESCE(SUM(ml_financing_fee), 0),
    'total_frete',        COALESCE(SUM(frete_custo), 0),
    'total_fees',         COALESCE(SUM(ml_commission), 0) + COALESCE(SUM(ml_fixed_fee), 0) + COALESCE(SUM(ml_financing_fee), 0) + COALESCE(SUM(frete_custo), 0),
    'total_net',          COALESCE(SUM(revenue), 0) - COALESCE(SUM(ml_commission), 0) - COALESCE(SUM(ml_fixed_fee), 0) - COALESCE(SUM(ml_financing_fee), 0) - COALESCE(SUM(frete_custo), 0)
  ) INTO result
  FROM ml_orders
  WHERE workspace_id = p_workspace_id
    AND date >= p_date_from
    AND date <= p_date_to;

  RETURN result;
END;
$$;

-- 2. Top 10 products by revenue
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
    GROUP BY item->>'title'
    ORDER BY total_revenue DESC
    LIMIT 10
  ) t;

  RETURN COALESCE(result, '[]'::json);
END;
$$;
