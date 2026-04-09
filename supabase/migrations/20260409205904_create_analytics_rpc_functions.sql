/*
  # Analytics RPC Functions

  Server-side aggregation functions for the sprint analytics dashboard.
  All heavy computation stays in Postgres rather than pulling raw rows to the client.

  ## Functions
  1. `get_kpis(date_from, date_to)` — totals: revenue, cost, profit, margin, orders, invoices
  2. `get_category_breakdown(date_from, date_to)` — top 15 product categories by revenue
  3. `get_monthly_trend(date_from, date_to)` — month-by-month revenue, cost, profit
  4. `get_top_customers(date_from, date_to, row_limit)` — top customers ranked by revenue
  5. `get_top_products(date_from, date_to, row_limit)` — top items ranked by revenue

  All functions are SECURITY DEFINER so anon callers can access them, and they read
  only from v_sales (which itself is backed by the RLS-protected sales table).
*/

CREATE OR REPLACE FUNCTION public.get_kpis(
  date_from date DEFAULT NULL,
  date_to   date DEFAULT NULL
)
RETURNS TABLE (
  total_revenue    numeric,
  total_cost       numeric,
  gross_profit     numeric,
  gross_margin_pct numeric,
  total_orders     bigint,
  total_invoices   bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    COALESCE(SUM(sales_amt), 0)                                                   AS total_revenue,
    COALESCE(SUM(cost_amt), 0)                                                    AS total_cost,
    COALESCE(SUM(sales_amt) - SUM(cost_amt), 0)                                   AS gross_profit,
    CASE WHEN SUM(sales_amt) > 0
         THEN ROUND(((SUM(sales_amt) - SUM(cost_amt)) / SUM(sales_amt)) * 100, 2)
         ELSE 0 END                                                               AS gross_margin_pct,
    COUNT(DISTINCT order_number)                                                  AS total_orders,
    COUNT(DISTINCT invoice_number)                                                AS total_invoices
  FROM public.v_sales
  WHERE (date_from IS NULL OR invoice_date >= date_from)
    AND (date_to   IS NULL OR invoice_date <= date_to);
$$;

GRANT EXECUTE ON FUNCTION public.get_kpis TO anon;


CREATE OR REPLACE FUNCTION public.get_category_breakdown(
  date_from date DEFAULT NULL,
  date_to   date DEFAULT NULL
)
RETURNS TABLE (
  category    text,
  revenue     numeric,
  cost        numeric,
  margin_pct  numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    COALESCE(NULLIF(product_cat_description, ''), 'Uncategorized') AS category,
    SUM(sales_amt)                                                  AS revenue,
    SUM(cost_amt)                                                   AS cost,
    CASE WHEN SUM(sales_amt) > 0
         THEN ROUND(((SUM(sales_amt) - SUM(cost_amt)) / SUM(sales_amt)) * 100, 1)
         ELSE 0 END                                                 AS margin_pct
  FROM public.v_sales
  WHERE (date_from IS NULL OR invoice_date >= date_from)
    AND (date_to   IS NULL OR invoice_date <= date_to)
  GROUP BY 1
  ORDER BY revenue DESC
  LIMIT 15;
$$;

GRANT EXECUTE ON FUNCTION public.get_category_breakdown TO anon;


CREATE OR REPLACE FUNCTION public.get_monthly_trend(
  date_from date DEFAULT NULL,
  date_to   date DEFAULT NULL
)
RETURNS TABLE (
  month   text,
  revenue numeric,
  cost    numeric,
  profit  numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    TO_CHAR(DATE_TRUNC('month', invoice_date), 'YYYY-MM') AS month,
    SUM(sales_amt)                                         AS revenue,
    SUM(cost_amt)                                          AS cost,
    SUM(sales_amt) - SUM(cost_amt)                        AS profit
  FROM public.v_sales
  WHERE (date_from IS NULL OR invoice_date >= date_from)
    AND (date_to   IS NULL OR invoice_date <= date_to)
  GROUP BY 1
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_monthly_trend TO anon;


CREATE OR REPLACE FUNCTION public.get_top_customers(
  date_from  date DEFAULT NULL,
  date_to    date DEFAULT NULL,
  row_limit  int  DEFAULT 10
)
RETURNS TABLE (
  customer_number text,
  company_name    text,
  revenue         numeric,
  cost            numeric,
  gross_profit    numeric,
  margin_pct      numeric,
  order_count     bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    customer_number,
    company_name,
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
  GROUP BY customer_number, company_name
  ORDER BY revenue DESC
  LIMIT row_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_top_customers TO anon;


CREATE OR REPLACE FUNCTION public.get_top_products(
  date_from  date DEFAULT NULL,
  date_to    date DEFAULT NULL,
  row_limit  int  DEFAULT 10
)
RETURNS TABLE (
  item_number              text,
  product_cat_description  text,
  revenue                  numeric,
  cost                     numeric,
  gross_profit             numeric,
  margin_pct               numeric,
  qty_shipped              numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    item_number,
    COALESCE(NULLIF(product_cat_description, ''), 'Uncategorized') AS product_cat_description,
    SUM(sales_amt)                                                  AS revenue,
    SUM(cost_amt)                                                   AS cost,
    SUM(sales_amt) - SUM(cost_amt)                                  AS gross_profit,
    CASE WHEN SUM(sales_amt) > 0
         THEN ROUND(((SUM(sales_amt) - SUM(cost_amt)) / SUM(sales_amt)) * 100, 1)
         ELSE 0 END                                                 AS margin_pct,
    SUM(qty_to_ship)                                                AS qty_shipped
  FROM public.v_sales
  WHERE (date_from IS NULL OR invoice_date >= date_from)
    AND (date_to   IS NULL OR invoice_date <= date_to)
  GROUP BY item_number, product_cat_description
  ORDER BY revenue DESC
  LIMIT row_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_top_products TO anon;
