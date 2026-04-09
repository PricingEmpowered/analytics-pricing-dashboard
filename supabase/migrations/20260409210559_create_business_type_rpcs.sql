/*
  # Business Type Classification RPCs

  ## Context
  This business has two primary revenue modes:
  1. **Parts Sales** — standard product SKUs with list prices
  2. **Repairs/Service** — dummy item numbers (GCS-RPR-*, GCS-VLV-*, etc.) where
     the BOM table captures the actual parts content at cost. The sales line shows
     the total billed price but the BOM reveals parts consumed within.

  ## Classification Logic
  product_cat_description patterns:
  - Contains "Repair" or "Shop"  → Repair/Service
  - Contains "Labor" or "Proj"   → Labor/Field Service
  - Contains "Kit"               → Parts Kits
  - All others                   → Parts/Products

  ## Functions
  1. `get_business_type_breakdown` — revenue/cost/margin by business type
  2. `get_repair_intelligence` — for repair orders: BOM parts cost vs billed price,
     showing how much margin comes from labor vs parts
*/

CREATE OR REPLACE FUNCTION public.get_business_type_breakdown(
  date_from date DEFAULT NULL,
  date_to   date DEFAULT NULL
)
RETURNS TABLE (
  business_type text,
  revenue       numeric,
  cost          numeric,
  gross_profit  numeric,
  margin_pct    numeric,
  order_count   bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    CASE
      WHEN TRIM(product_cat_description) ILIKE '%repair%'
        OR TRIM(product_cat_description) ILIKE '%shop%'  THEN 'Repairs & Service'
      WHEN TRIM(product_cat_description) ILIKE '%labor%'
        OR TRIM(product_cat_description) ILIKE '%proj%'  THEN 'Labor & Projects'
      WHEN TRIM(product_cat_description) ILIKE '%kit%'   THEN 'Parts Kits'
      ELSE 'Parts & Products'
    END                                                              AS business_type,
    SUM(sales_amt)                                                   AS revenue,
    SUM(cost_amt)                                                    AS cost,
    SUM(sales_amt) - SUM(cost_amt)                                   AS gross_profit,
    CASE WHEN SUM(sales_amt) > 0
         THEN ROUND(((SUM(sales_amt) - SUM(cost_amt)) / SUM(sales_amt)) * 100, 1)
         ELSE 0 END                                                  AS margin_pct,
    COUNT(DISTINCT order_number)                                     AS order_count
  FROM public.v_sales
  WHERE (date_from IS NULL OR invoice_date >= date_from)
    AND (date_to   IS NULL OR invoice_date <= date_to)
  GROUP BY 1
  ORDER BY revenue DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_business_type_breakdown TO anon;


/*
  Repair Intelligence: for every repair order, show the sales-side billing
  alongside the BOM-side parts content (cost basis). This reveals:
  - bom_parts_cost  — actual parts consumed per the BOM
  - billed_revenue  — what was charged on the sales line
  - implied_labor   — revenue minus parts cost (effective labor recovery)
  - labor_margin    — how much of the billed price is pure labor profit
*/
CREATE OR REPLACE FUNCTION public.get_repair_intelligence(
  date_from  date DEFAULT NULL,
  date_to    date DEFAULT NULL,
  row_limit  int  DEFAULT 20
)
RETURNS TABLE (
  order_number       bigint,
  company_name       text,
  invoice_date       date,
  product_type       text,
  billed_revenue     numeric,
  sales_cost         numeric,
  bom_parts_cost     numeric,
  implied_labor_rev  numeric,
  margin_pct         numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH repair_sales AS (
    SELECT
      order_number,
      company_name,
      invoice_date,
      TRIM(product_cat_description)               AS product_type,
      SUM(sales_amt)                              AS billed_revenue,
      SUM(cost_amt)                               AS sales_cost
    FROM public.v_sales
    WHERE (
      TRIM(product_cat_description) ILIKE '%repair%'
      OR TRIM(product_cat_description) ILIKE '%shop%'
    )
    AND (date_from IS NULL OR invoice_date >= date_from)
    AND (date_to   IS NULL OR invoice_date <= date_to)
    GROUP BY order_number, company_name, invoice_date, product_cat_description
  ),
  bom_costs AS (
    SELECT
      b.ordno                                      AS order_number,
      SUM(b.qtyordered * b.unitcost)               AS bom_parts_cost
    FROM public.bom b
    WHERE b.unitcost > 0
    GROUP BY b.ordno
  )
  SELECT
    rs.order_number,
    rs.company_name,
    rs.invoice_date,
    rs.product_type,
    rs.billed_revenue,
    rs.sales_cost,
    COALESCE(bc.bom_parts_cost, 0)                                      AS bom_parts_cost,
    rs.billed_revenue - COALESCE(bc.bom_parts_cost, 0)                  AS implied_labor_rev,
    CASE WHEN rs.billed_revenue > 0
         THEN ROUND(((rs.billed_revenue - rs.sales_cost) / rs.billed_revenue) * 100, 1)
         ELSE 0 END                                                      AS margin_pct
  FROM repair_sales rs
  LEFT JOIN bom_costs bc ON bc.order_number = rs.order_number
  ORDER BY rs.billed_revenue DESC
  LIMIT row_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_repair_intelligence TO anon;


/*
  Monthly revenue trend split by business type (Parts vs Repairs vs Labor)
*/
CREATE OR REPLACE FUNCTION public.get_business_type_trend(
  date_from date DEFAULT NULL,
  date_to   date DEFAULT NULL
)
RETURNS TABLE (
  month        text,
  parts        numeric,
  repairs      numeric,
  labor        numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    TO_CHAR(DATE_TRUNC('month', invoice_date), 'YYYY-MM')             AS month,
    SUM(CASE WHEN TRIM(product_cat_description) NOT ILIKE '%repair%'
                  AND TRIM(product_cat_description) NOT ILIKE '%shop%'
                  AND TRIM(product_cat_description) NOT ILIKE '%labor%'
                  AND TRIM(product_cat_description) NOT ILIKE '%proj%'
             THEN sales_amt ELSE 0 END)                               AS parts,
    SUM(CASE WHEN TRIM(product_cat_description) ILIKE '%repair%'
                  OR TRIM(product_cat_description) ILIKE '%shop%'
             THEN sales_amt ELSE 0 END)                               AS repairs,
    SUM(CASE WHEN TRIM(product_cat_description) ILIKE '%labor%'
                  OR TRIM(product_cat_description) ILIKE '%proj%'
             THEN sales_amt ELSE 0 END)                               AS labor
  FROM public.v_sales
  WHERE (date_from IS NULL OR invoice_date >= date_from)
    AND (date_to   IS NULL OR invoice_date <= date_to)
  GROUP BY 1
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_business_type_trend TO anon;
