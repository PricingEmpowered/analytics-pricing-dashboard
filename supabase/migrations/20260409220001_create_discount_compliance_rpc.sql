/*
  # Discount Schedule Compliance RPCs
  ═══════════════════════════════════════════════════════════════════════════════

  ## Business Context
  Customers are assigned discount schedules by customer_type × product_family
  (stored in the `discount` table: code, customer_type, product_family, macola_discount).

  The `item` table carries `analytical_family` which maps to `product_family` in
  the discount schedule.  The `customer` table carries `cust_type`.

  This module answers:
    1. For each customer × product_family: what discount were they entitled to,
       what discount did they actually receive, and how much did that cost?
    2. Which customers are consistently receiving discounts beyond their schedule?
    3. Which product families have the worst schedule compliance?
    4. Summary by customer_type × product_family showing entitlement vs actuals.

  ## Discount % convention
  The `macola_discount` column stores values like "30", "32.5", meaning percent off
  list price.  We parse it as numeric.

  ## Functions
  1. get_discount_compliance_by_customer  — per customer: entitled vs actual discount, gap $
  2. get_discount_compliance_by_family    — per product family: schedule vs actual
  3. get_discount_schedule_summary        — cust_type × product_family grid
*/

-- ─── 1. get_discount_compliance_by_customer ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_discount_compliance_by_customer(
  date_from  date DEFAULT NULL,
  date_to    date DEFAULT NULL,
  row_limit  int  DEFAULT 50
)
RETURNS TABLE (
  customer_number      text,
  company_name         text,
  cust_type            text,
  revenue              numeric,
  margin_pct           numeric,
  entitled_discount    numeric,   -- avg entitled discount % from schedule
  actual_discount      numeric,   -- avg actual discount % vs list
  excess_discount      numeric,   -- actual - entitled  (positive = over-discounted)
  revenue_at_schedule  numeric,   -- what revenue would be at entitled discount
  revenue_gap          numeric,   -- revenue_at_schedule - revenue (money left on table)
  order_count          bigint,
  compliance_flag      text       -- 'Over-Discounted' | 'On Schedule' | 'Under-Discounted' | 'No Schedule'
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH
  -- Parse discount schedule: customer_type × product_family → discount %
  disc_sched AS (
    SELECT
      TRIM(customer_type)                                                    AS cust_type,
      TRIM(product_family)                                                   AS product_family,
      CAST(NULLIF(TRIM(macola_discount),'') AS numeric)                      AS entitled_pct
    FROM public.discount
    WHERE macola_discount IS NOT NULL
      AND TRIM(macola_discount) ~ '^[0-9]+(\.[0-9]+)?$'
  ),
  -- Sales lines enriched with customer type and item family
  enriched AS (
    SELECT
      s.customer_number,
      s.company_name,
      COALESCE(NULLIF(TRIM(c.cust_type),''),'Unknown')                      AS cust_type,
      COALESCE(NULLIF(TRIM(i.analytical_family),''),'General')               AS analytical_family,
      s.order_number,
      s.sales_amt,
      s.cost_amt,
      s.qty_to_ship,
      COALESCE(CAST(NULLIF(TRIM(lp.macola_price),'') AS numeric),0)         AS list_unit_price
    FROM public.v_sales s
    LEFT JOIN public.v_customer c  ON TRIM(c.cust_no)      = TRIM(s.customer_number)
    LEFT JOIN public.v_item     i  ON TRIM(i.item_number)  = TRIM(s.item_number)
    LEFT JOIN public.list_prices lp ON TRIM(lp.part_no)   = TRIM(s.item_number)
    WHERE (date_from IS NULL OR s.invoice_date >= date_from)
      AND (date_to   IS NULL OR s.invoice_date <= date_to)
      AND s.sales_amt > 0
  ),
  -- Join each line to its entitled discount
  with_entitlement AS (
    SELECT
      e.*,
      ds.entitled_pct,
      -- Actual discount this line vs list
      CASE WHEN e.list_unit_price > 0 AND e.qty_to_ship > 0
           THEN (1 - e.sales_amt / NULLIF(e.list_unit_price * e.qty_to_ship, 0)) * 100
           ELSE NULL END                                                     AS actual_disc_pct,
      -- Revenue at entitled discount
      CASE WHEN e.list_unit_price > 0 AND e.qty_to_ship > 0 AND ds.entitled_pct IS NOT NULL
           THEN e.list_unit_price * e.qty_to_ship * (1 - ds.entitled_pct / 100)
           ELSE e.sales_amt END                                              AS rev_at_schedule
    FROM enriched e
    LEFT JOIN disc_sched ds
      ON ds.cust_type = e.cust_type
     AND ds.product_family = e.analytical_family
  ),
  -- Aggregate per customer
  cust_agg AS (
    SELECT
      customer_number,
      company_name,
      cust_type,
      SUM(sales_amt)                                                         AS revenue,
      SUM(cost_amt)                                                          AS total_cost,
      COUNT(DISTINCT order_number)                                           AS order_count,
      AVG(entitled_pct)                                                      AS avg_entitled,
      -- Weighted avg actual discount (only lines with a list price)
      CASE WHEN SUM(CASE WHEN list_unit_price>0 AND qty_to_ship>0
                         THEN list_unit_price*qty_to_ship ELSE 0 END) > 0
           THEN (1 - SUM(CASE WHEN list_unit_price>0 AND qty_to_ship>0
                              THEN sales_amt ELSE 0 END)
                   / SUM(CASE WHEN list_unit_price>0 AND qty_to_ship>0
                              THEN list_unit_price*qty_to_ship ELSE 0 END)) * 100
           ELSE NULL END                                                     AS avg_actual_disc,
      SUM(rev_at_schedule)                                                   AS rev_at_schedule
    FROM with_entitlement
    GROUP BY customer_number, company_name, cust_type
  )
  SELECT
    ca.customer_number,
    ca.company_name,
    ca.cust_type,
    ROUND(ca.revenue, 2)                                                     AS revenue,
    CASE WHEN ca.revenue > 0
         THEN ROUND(((ca.revenue - ca.total_cost) / ca.revenue) * 100, 1)
         ELSE 0 END                                                          AS margin_pct,
    ROUND(COALESCE(ca.avg_entitled, 0), 1)                                  AS entitled_discount,
    ROUND(COALESCE(ca.avg_actual_disc, 0), 1)                               AS actual_discount,
    ROUND(COALESCE(ca.avg_actual_disc, 0) - COALESCE(ca.avg_entitled, 0), 1) AS excess_discount,
    ROUND(ca.rev_at_schedule, 2)                                             AS revenue_at_schedule,
    ROUND(GREATEST(ca.rev_at_schedule - ca.revenue, 0), 2)                  AS revenue_gap,
    ca.order_count,
    CASE
      WHEN ca.avg_entitled IS NULL                                           THEN 'No Schedule'
      WHEN COALESCE(ca.avg_actual_disc,0) > COALESCE(ca.avg_entitled,0) + 2 THEN 'Over-Discounted'
      WHEN COALESCE(ca.avg_actual_disc,0) < COALESCE(ca.avg_entitled,0) - 2 THEN 'Under-Discounted'
      ELSE 'On Schedule'
    END                                                                      AS compliance_flag
  FROM cust_agg ca
  ORDER BY revenue_gap DESC
  LIMIT row_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_discount_compliance_by_customer TO anon;


-- ─── 2. get_discount_compliance_by_family ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_discount_compliance_by_family(
  date_from date DEFAULT NULL,
  date_to   date DEFAULT NULL
)
RETURNS TABLE (
  product_family       text,
  revenue              numeric,
  margin_pct           numeric,
  entitled_discount    numeric,
  actual_discount      numeric,
  excess_discount      numeric,
  revenue_gap          numeric,
  customer_count       bigint,
  order_count          bigint,
  compliance_flag      text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH
  disc_sched AS (
    SELECT
      TRIM(customer_type)                                                    AS cust_type,
      TRIM(product_family)                                                   AS product_family,
      CAST(NULLIF(TRIM(macola_discount),'') AS numeric)                      AS entitled_pct
    FROM public.discount
    WHERE macola_discount IS NOT NULL
      AND TRIM(macola_discount) ~ '^[0-9]+(\.[0-9]+)?$'
  ),
  enriched AS (
    SELECT
      COALESCE(NULLIF(TRIM(i.analytical_family),''),'General')               AS analytical_family,
      COALESCE(NULLIF(TRIM(c.cust_type),''),'Unknown')                      AS cust_type,
      s.customer_number,
      s.order_number,
      s.sales_amt,
      s.cost_amt,
      s.qty_to_ship,
      COALESCE(CAST(NULLIF(TRIM(lp.macola_price),'') AS numeric),0)         AS list_unit_price
    FROM public.v_sales s
    LEFT JOIN public.v_customer c  ON TRIM(c.cust_no)     = TRIM(s.customer_number)
    LEFT JOIN public.v_item     i  ON TRIM(i.item_number) = TRIM(s.item_number)
    LEFT JOIN public.list_prices lp ON TRIM(lp.part_no)  = TRIM(s.item_number)
    WHERE (date_from IS NULL OR s.invoice_date >= date_from)
      AND (date_to   IS NULL OR s.invoice_date <= date_to)
      AND s.sales_amt > 0
  ),
  with_entitlement AS (
    SELECT
      e.analytical_family,
      e.customer_number,
      e.order_number,
      e.sales_amt,
      e.cost_amt,
      e.qty_to_ship,
      e.list_unit_price,
      ds.entitled_pct,
      CASE WHEN e.list_unit_price>0 AND e.qty_to_ship>0
           THEN e.list_unit_price * e.qty_to_ship * (1 - COALESCE(ds.entitled_pct,0)/100)
           ELSE e.sales_amt END                                              AS rev_at_schedule
    FROM enriched e
    LEFT JOIN disc_sched ds
      ON ds.cust_type = e.cust_type
     AND ds.product_family = e.analytical_family
  )
  SELECT
    we.analytical_family                                                     AS product_family,
    ROUND(SUM(we.sales_amt), 2)                                              AS revenue,
    CASE WHEN SUM(we.sales_amt)>0
         THEN ROUND(((SUM(we.sales_amt)-SUM(we.cost_amt))/SUM(we.sales_amt))*100,1)
         ELSE 0 END                                                          AS margin_pct,
    ROUND(AVG(we.entitled_pct), 1)                                          AS entitled_discount,
    -- Weighted actual discount
    CASE WHEN SUM(CASE WHEN we.list_unit_price>0 AND we.qty_to_ship>0
                       THEN we.list_unit_price*we.qty_to_ship ELSE 0 END)>0
         THEN ROUND((1 - SUM(CASE WHEN we.list_unit_price>0 AND we.qty_to_ship>0
                                  THEN we.sales_amt ELSE 0 END)
                      / SUM(CASE WHEN we.list_unit_price>0 AND we.qty_to_ship>0
                                 THEN we.list_unit_price*we.qty_to_ship ELSE 0 END))*100, 1)
         ELSE 0 END                                                          AS actual_discount,
    -- Excess
    CASE WHEN SUM(CASE WHEN we.list_unit_price>0 AND we.qty_to_ship>0
                       THEN we.list_unit_price*we.qty_to_ship ELSE 0 END)>0
         THEN ROUND((1 - SUM(CASE WHEN we.list_unit_price>0 AND we.qty_to_ship>0
                                  THEN we.sales_amt ELSE 0 END)
                      / SUM(CASE WHEN we.list_unit_price>0 AND we.qty_to_ship>0
                                 THEN we.list_unit_price*we.qty_to_ship ELSE 0 END))*100
                  - COALESCE(AVG(we.entitled_pct),0), 1)
         ELSE 0 END                                                          AS excess_discount,
    ROUND(GREATEST(SUM(we.rev_at_schedule) - SUM(we.sales_amt), 0), 2)     AS revenue_gap,
    COUNT(DISTINCT we.customer_number)                                       AS customer_count,
    COUNT(DISTINCT we.order_number)                                          AS order_count,
    CASE
      WHEN AVG(we.entitled_pct) IS NULL                                     THEN 'No Schedule'
      WHEN (1 - SUM(CASE WHEN we.list_unit_price>0 AND we.qty_to_ship>0
                         THEN we.sales_amt ELSE 0 END)
               / NULLIF(SUM(CASE WHEN we.list_unit_price>0 AND we.qty_to_ship>0
                                 THEN we.list_unit_price*we.qty_to_ship ELSE 0 END),0))*100
           > COALESCE(AVG(we.entitled_pct),0) + 2                           THEN 'Over-Discounted'
      ELSE 'On Schedule'
    END                                                                      AS compliance_flag
  FROM with_entitlement we
  GROUP BY we.analytical_family
  ORDER BY revenue_gap DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_discount_compliance_by_family TO anon;


-- ─── 3. get_discount_schedule_summary ────────────────────────────────────────
/*
  Grid view: customer_type × product_family showing the entitled discount,
  actual average discount, revenue, and margin.
  This is the "discount schedule report card."
*/
CREATE OR REPLACE FUNCTION public.get_discount_schedule_summary(
  date_from date DEFAULT NULL,
  date_to   date DEFAULT NULL
)
RETURNS TABLE (
  cust_type            text,
  product_family       text,
  entitled_discount    numeric,
  actual_discount      numeric,
  excess_discount      numeric,
  revenue              numeric,
  margin_pct           numeric,
  customer_count       bigint,
  revenue_gap          numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH
  disc_sched AS (
    SELECT
      TRIM(customer_type)                                                    AS cust_type,
      TRIM(product_family)                                                   AS product_family,
      CAST(NULLIF(TRIM(macola_discount),'') AS numeric)                      AS entitled_pct
    FROM public.discount
    WHERE macola_discount IS NOT NULL
      AND TRIM(macola_discount) ~ '^[0-9]+(\.[0-9]+)?$'
  ),
  enriched AS (
    SELECT
      COALESCE(NULLIF(TRIM(c.cust_type),''),'Unknown')                      AS cust_type,
      COALESCE(NULLIF(TRIM(i.analytical_family),''),'General')               AS analytical_family,
      s.customer_number,
      s.sales_amt,
      s.cost_amt,
      s.qty_to_ship,
      COALESCE(CAST(NULLIF(TRIM(lp.macola_price),'') AS numeric),0)         AS list_unit_price
    FROM public.v_sales s
    LEFT JOIN public.v_customer c  ON TRIM(c.cust_no)     = TRIM(s.customer_number)
    LEFT JOIN public.v_item     i  ON TRIM(i.item_number) = TRIM(s.item_number)
    LEFT JOIN public.list_prices lp ON TRIM(lp.part_no)  = TRIM(s.item_number)
    WHERE (date_from IS NULL OR s.invoice_date >= date_from)
      AND (date_to   IS NULL OR s.invoice_date <= date_to)
      AND s.sales_amt > 0
  ),
  joined AS (
    SELECT
      e.cust_type,
      e.analytical_family,
      e.customer_number,
      e.sales_amt,
      e.cost_amt,
      e.qty_to_ship,
      e.list_unit_price,
      ds.entitled_pct,
      CASE WHEN e.list_unit_price>0 AND e.qty_to_ship>0 AND ds.entitled_pct IS NOT NULL
           THEN e.list_unit_price * e.qty_to_ship * (1 - ds.entitled_pct/100)
           ELSE e.sales_amt END                                              AS rev_at_schedule
    FROM enriched e
    LEFT JOIN disc_sched ds
      ON ds.cust_type = e.cust_type
     AND ds.product_family = e.analytical_family
  )
  SELECT
    j.cust_type,
    j.analytical_family                                                      AS product_family,
    ROUND(AVG(j.entitled_pct), 1)                                           AS entitled_discount,
    CASE WHEN SUM(CASE WHEN j.list_unit_price>0 AND j.qty_to_ship>0
                       THEN j.list_unit_price*j.qty_to_ship ELSE 0 END)>0
         THEN ROUND((1 - SUM(CASE WHEN j.list_unit_price>0 AND j.qty_to_ship>0
                                  THEN j.sales_amt ELSE 0 END)
                      / SUM(CASE WHEN j.list_unit_price>0 AND j.qty_to_ship>0
                                 THEN j.list_unit_price*j.qty_to_ship ELSE 0 END))*100, 1)
         ELSE 0 END                                                          AS actual_discount,
    CASE WHEN SUM(CASE WHEN j.list_unit_price>0 AND j.qty_to_ship>0
                       THEN j.list_unit_price*j.qty_to_ship ELSE 0 END)>0
         THEN ROUND((1 - SUM(CASE WHEN j.list_unit_price>0 AND j.qty_to_ship>0
                                  THEN j.sales_amt ELSE 0 END)
                      / SUM(CASE WHEN j.list_unit_price>0 AND j.qty_to_ship>0
                                 THEN j.list_unit_price*j.qty_to_ship ELSE 0 END))*100
                  - COALESCE(AVG(j.entitled_pct),0), 1)
         ELSE 0 END                                                          AS excess_discount,
    ROUND(SUM(j.sales_amt), 2)                                              AS revenue,
    CASE WHEN SUM(j.sales_amt)>0
         THEN ROUND(((SUM(j.sales_amt)-SUM(j.cost_amt))/SUM(j.sales_amt))*100,1)
         ELSE 0 END                                                          AS margin_pct,
    COUNT(DISTINCT j.customer_number)                                        AS customer_count,
    ROUND(GREATEST(SUM(j.rev_at_schedule) - SUM(j.sales_amt), 0), 2)       AS revenue_gap
  FROM joined j
  GROUP BY j.cust_type, j.analytical_family
  ORDER BY revenue_gap DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_discount_schedule_summary TO anon;
