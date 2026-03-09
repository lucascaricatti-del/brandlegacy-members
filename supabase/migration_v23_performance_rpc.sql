-- migration_v23: RPC function for performance dashboard metrics
-- Aggregates yampi_orders, ads_metrics, ga4_metrics, ecommerce_metrics, influencers
-- into a single JSON response per workspace + date range.

CREATE OR REPLACE FUNCTION get_performance_metrics(
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
  WITH yampi AS (
    SELECT
      COUNT(*) AS orders_captados,
      COALESCE(SUM(revenue), 0) AS receita_captada,
      COUNT(CASE WHEN status IN ('paid','invoiced','shipped','delivered') THEN 1 END) AS orders_faturados,
      COALESCE(SUM(CASE WHEN status IN ('paid','invoiced','shipped','delivered') THEN revenue ELSE 0 END), 0) AS receita_faturada,
      COUNT(CASE WHEN status IN ('cancelled','refused') THEN 1 END) AS orders_cancelled,
      COUNT(CASE WHEN LOWER(payment_method) = 'pix' THEN 1 END) AS pix_total,
      COUNT(CASE WHEN LOWER(payment_method) = 'pix' AND status IN ('paid','invoiced','shipped','delivered') THEN 1 END) AS pix_paid,
      COUNT(CASE WHEN coupon_code IS NOT NULL AND coupon_code != '' AND status IN ('paid','invoiced','shipped','delivered') THEN 1 END) AS coupon_orders
    FROM yampi_orders
    WHERE workspace_id = p_workspace_id
      AND date >= p_date_from
      AND date <= p_date_to
  ),
  ads AS (
    SELECT
      COALESCE(SUM(spend), 0) AS total_spend,
      COALESCE(SUM(impressions), 0) AS total_impressions,
      COALESCE(SUM(clicks), 0) AS total_clicks,
      COALESCE(SUM(conversions), 0) AS total_conversions
    FROM ads_metrics
    WHERE workspace_id = p_workspace_id
      AND date >= p_date_from
      AND date <= p_date_to
  ),
  meta_ads AS (
    SELECT
      COALESCE(SUM(spend), 0) AS meta_spend,
      COALESCE(SUM(impressions), 0) AS meta_impressions
    FROM ads_metrics
    WHERE workspace_id = p_workspace_id
      AND provider = 'meta_ads'
      AND date >= p_date_from
      AND date <= p_date_to
  ),
  google_ads AS (
    SELECT
      COALESCE(SUM(spend), 0) AS google_spend
    FROM ads_metrics
    WHERE workspace_id = p_workspace_id
      AND provider = 'google_ads'
      AND date >= p_date_from
      AND date <= p_date_to
  ),
  ga4 AS (
    SELECT
      COALESCE(SUM(sessions), 0) AS ga4_sessions,
      COALESCE(SUM(organic_sessions), 0) AS organic_sessions,
      COALESCE(SUM(paid_sessions), 0) AS paid_sessions,
      COALESCE(SUM(direct_sessions), 0) AS direct_sessions,
      COALESCE(SUM(social_sessions), 0) AS social_sessions,
      (COUNT(*) > 0) AS has_ga4
    FROM ga4_metrics
    WHERE workspace_id = p_workspace_id
      AND date >= p_date_from
      AND date <= p_date_to
  ),
  shopify AS (
    SELECT
      COALESCE(SUM(sessions), 0) AS shopify_sessions
    FROM ecommerce_metrics
    WHERE workspace_id = p_workspace_id
      AND provider = 'shopify'
      AND date >= p_date_from
      AND date <= p_date_to
  ),
  influencer_fees AS (
    SELECT
      COALESCE(SUM(monthly_fee), 0) AS influencer_spend
    FROM influencers
    WHERE workspace_id = p_workspace_id
      AND is_active = TRUE
      AND (start_date IS NULL OR start_date <= p_date_to)
      AND (end_date IS NULL OR end_date >= p_date_from)
  ),
  influencer_commission AS (
    SELECT
      COALESCE(SUM(
        yo.revenue * (i.commission_pct / 100.0)
      ), 0) AS influencer_commission
    FROM yampi_orders yo
    JOIN influencers i ON i.workspace_id = yo.workspace_id
      AND LOWER(i.coupon_code) = LOWER(yo.coupon_code)
    WHERE yo.workspace_id = p_workspace_id
      AND yo.date >= p_date_from
      AND yo.date <= p_date_to
      AND yo.status IN ('paid','invoiced','shipped','delivered')
      AND yo.coupon_code IS NOT NULL
      AND yo.coupon_code != ''
      AND i.commission_pct > 0
  )
  SELECT json_build_object(
    'orders_captados', y.orders_captados,
    'receita_captada', y.receita_captada,
    'orders_faturados', y.orders_faturados,
    'receita_faturada', y.receita_faturada,
    'orders_cancelled', y.orders_cancelled,
    'pix_total', y.pix_total,
    'pix_paid', y.pix_paid,
    'coupon_orders', y.coupon_orders,
    'total_spend', a.total_spend,
    'total_impressions', a.total_impressions,
    'total_clicks', a.total_clicks,
    'total_conversions', a.total_conversions,
    'meta_spend', m.meta_spend,
    'meta_impressions', m.meta_impressions,
    'google_spend', g.google_spend,
    'ga4_sessions', ga.ga4_sessions,
    'organic_sessions', ga.organic_sessions,
    'paid_sessions', ga.paid_sessions,
    'direct_sessions', ga.direct_sessions,
    'social_sessions', ga.social_sessions,
    'has_ga4', ga.has_ga4,
    'shopify_sessions', sh.shopify_sessions,
    'influencer_spend', inf.influencer_spend,
    'influencer_commission', ic.influencer_commission,
    'recurrence', 0
  ) INTO result
  FROM yampi y, ads a, meta_ads m, google_ads g, ga4 ga, shopify sh, influencer_fees inf, influencer_commission ic;

  RETURN result;
END;
$$;
