/*
  # Pricing Opportunity RPC Functions
  ═══════════════════════════════════════════════════════════════════════════════

  ## Business Context
  This company sells OEM (OE), Aftermarket (AM), and Manufactured (MG) parts for
  oil & gas service equipment.  Part numbers follow the pattern:
      <VENDOR>-<PRODUCT_CODE>-<SUFFIX>
  where SUFFIX ∈ {OE, AM, MG}.  Parts sharing the same VENDOR-PRODUCT_CODE prefix
  are "siblings" and their list prices should maintain a logical relationship
  (OE is the anchor; AM and MG are priced relative to it).

  Target gross margin: 30–32% (company standard).
  Locations can override customer list prices — this is a major source of margin leakage.

  ## Functions
  1. get_part_family_alignment   — OE/AM/MG siblings, price ratios, misalignment flags
  2. get_margin_bands            — revenue bucketed by margin %, flagged vs 30% target
  3. get_discount_buckets        — revenue by effective discount depth vs list price
  4. get_pricing_opportunity     — per-item: avg price, cost, list, discount, price index, uplift
  5. get_customer_pricing_profiles — per-customer: margin, discount, price index, flag
  6. get_location_override_analysis — by location: billed vs list, override rate, margin impact
  7. get_uplift_summary          — scenario modelling: what if we hit 30% margin floor?
*/

-- ─── Helper: parse part number suffix (OE / AM / MG / OTHER) ─────────────────
-- Part numbers look like: GCS-RPR-OE, VENDOR-PROD-AM, ABC-123-MG, etc.
-- We split on the last hyphen segment.

-- ─── 1. get_part_family_alignment ────────────────────────────────────────────
/*
  For every item that has at least one OE sibling, show the full family:
  - family_key: everything before the last hyphen  (e.g. "GCS-RPR")
  - part_type:  OE | AM | MG | OTHER
  - list_price, avg_sold_price, avg_cost, margin_pct, revenue
  - oe_list_price: the OE sibling's list price (for ratio comparison)
  - price_ratio:   this item's list / OE list  (should be ≤ 1 for AM/MG)
  - misaligned:    true when AM or MG list > OE list, or when margin < 28%
*/
CREATE OR REPLACE FUNCTION public.get_part_family_alignment(
  date_from  date DEFAULT NULL,
  date_to    date DEFAULT NULL,
  row_limit  int  DEFAULT 100
)
RETURNS TABLE (
  family_key       text,
  item_number      text,
  part_type        text,
  list_price       numeric,
  avg_sold_price   numeric,
  avg_cost         numeric,
  margin_pct       numeric,
  revenue          numeric,
  qty_shipped      numeric,
  oe_list_price    numeric,
  price_ratio      numeric,   -- this item list / OE list
  discount_vs_list numeric,   -- % discount from list at avg sold price
  misalignment_flag text      -- 'AM > OE List' | 'MG > OE List' | 'Below Cost' | 'Low Margin' | 'OK'
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH
  -- Sales aggregated per item
  item_sales AS (
    SELECT
      TRIM(s.item_number)                                                       AS item_number,
      SUM(s.sales_amt)                                                          AS revenue,
      SUM(s.cost_amt)                                                           AS total_cost,
      SUM(s.qty_to_ship)                                                        AS qty_shipped,
      CASE WHEN SUM(s.qty_to_ship) > 0
           THEN SUM(s.sales_amt) / NULLIF(SUM(s.qty_to_ship), 0) ELSE 0 END    AS avg_sold_price,
      CASE WHEN SUM(s.qty_to_ship) > 0
           THEN SUM(s.cost_amt)  / NULLIF(SUM(s.qty_to_ship), 0) ELSE 0 END    AS avg_cost
    FROM public.v_sales s
    WHERE (date_from IS NULL OR s.invoice_date >= date_from)
      AND (date_to   IS NULL OR s.invoice_date <= date_to)
      AND s.sales_amt > 0
    GROUP BY TRIM(s.item_number)
  ),
  -- Best list price per item
  lp AS (
    SELECT DISTINCT ON (TRIM(part_no))
      TRIM(part_no)                                                             AS part_no,
      CAST(NULLIF(TRIM(macola_price), '') AS numeric)                           AS list_price
    FROM public.list_prices
    WHERE macola_price IS NOT NULL AND TRIM(macola_price) != ''
      AND TRIM(macola_price) ~ '^[0-9]+(\.[0-9]+)?$'
    ORDER BY TRIM(part_no), CAST(NULLIF(TRIM(macola_price), '') AS numeric) DESC NULLS LAST
  ),
  -- Parse suffix: last segment after final hyphen
  parsed AS (
    SELECT
      its.item_number,
      its.revenue,
      its.total_cost,
      its.qty_shipped,
      its.avg_sold_price,
      its.avg_cost,
      COALESCE(lp.list_price, 0)                                               AS list_price,
      -- Family key = everything before the last hyphen
      CASE WHEN its.item_number LIKE '%-%'
           THEN REVERSE(SUBSTRING(REVERSE(its.item_number) FROM POSITION('-' IN REVERSE(its.item_number)) + 1))
           ELSE its.item_number END                                             AS family_key,
      -- Part type = last segment
      CASE
        WHEN UPPER(REVERSE(SPLIT_PART(REVERSE(its.item_number), '-', 1))) = 'OE'  THEN 'OE'
        WHEN UPPER(REVERSE(SPLIT_PART(REVERSE(its.item_number), '-', 1))) = 'AM'  THEN 'AM'
        WHEN UPPER(REVERSE(SPLIT_PART(REVERSE(its.item_number), '-', 1))) IN ('MG','MFG') THEN 'MG'
        ELSE 'OTHER'
      END                                                                       AS part_type
    FROM item_sales its
    LEFT JOIN lp ON lp.part_no = its.item_number
  ),
  -- OE anchor list price per family
  oe_anchor AS (
    SELECT family_key, MAX(list_price) AS oe_list_price
    FROM parsed
    WHERE part_type = 'OE' AND list_price > 0
    GROUP BY family_key
  ),
  -- Only keep families that have at least one OE member with a list price
  families_with_oe AS (
    SELECT DISTINCT family_key FROM oe_anchor
  )
  SELECT
    p.family_key,
    p.item_number,
    p.part_type,
    ROUND(p.list_price, 4)                                                      AS list_price,
    ROUND(p.avg_sold_price, 4)                                                  AS avg_sold_price,
    ROUND(p.avg_cost, 4)                                                        AS avg_cost,
    CASE WHEN p.revenue > 0
         THEN ROUND(((p.revenue - p.total_cost) / p.revenue) * 100, 1)
         ELSE 0 END                                                             AS margin_pct,
    ROUND(p.revenue, 2)                                                         AS revenue,
    ROUND(p.qty_shipped, 2)                                                     AS qty_shipped,
    COALESCE(oa.oe_list_price, 0)                                               AS oe_list_price,
    -- Price ratio vs OE
    CASE WHEN COALESCE(oa.oe_list_price, 0) > 0 AND p.list_price > 0
         THEN ROUND(p.list_price / oa.oe_list_price, 3)
         ELSE NULL END                                                          AS price_ratio,
    -- Discount from list at avg sold price
    CASE WHEN p.list_price > 0
         THEN ROUND(((p.list_price - p.avg_sold_price) / p.list_price) * 100, 1)
         ELSE NULL END                                                          AS discount_vs_list,
    -- Misalignment flag
    CASE
      WHEN p.part_type = 'AM' AND p.list_price > COALESCE(oa.oe_list_price, 0) AND COALESCE(oa.oe_list_price,0) > 0
        THEN 'AM > OE List'
      WHEN p.part_type = 'MG' AND p.list_price > COALESCE(oa.oe_list_price, 0) AND COALESCE(oa.oe_list_price,0) > 0
        THEN 'MG > OE List'
      WHEN p.revenue > 0 AND (p.revenue - p.total_cost) / p.revenue < 0
        THEN 'Below Cost'
      WHEN p.revenue > 0 AND (p.revenue - p.total_cost) / p.revenue < 0.28
        THEN 'Low Margin'
      ELSE 'OK'
    END                                                                         AS misalignment_flag
  FROM parsed p
  JOIN families_with_oe fwo ON fwo.family_key = p.family_key
  LEFT JOIN oe_anchor oa ON oa.family_key = p.family_key
  ORDER BY p.revenue DESC
  LIMIT row_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_part_family_alignment TO anon;


-- ─── 2. get_margin_bands ─────────────────────────────────────────────────────
/*
  Revenue bucketed by gross margin % per transaction line.
  Target margin = 30%.  Bands are designed around that anchor.
*/
CREATE OR REPLACE FUNCTION public.get_margin_bands(
  date_from date DEFAULT NULL,
  date_to   date DEFAULT NULL
)
RETURNS TABLE (
  band            text,
  revenue         numeric,
  gross_profit    numeric,
  order_count     bigint,
  item_count      bigint,
  pct_of_revenue  numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH base AS (
    SELECT
      order_number,
      item_number,
      sales_amt,
      cost_amt,
      CASE
        WHEN sales_amt <= 0                                                  THEN 'Negative / Zero'
        WHEN sales_amt > 0 AND (sales_amt - cost_amt) / sales_amt < 0       THEN 'Below Cost (<0%)'
        WHEN (sales_amt - cost_amt) / sales_amt < 0.10                      THEN '0% – 10%'
        WHEN (sales_amt - cost_amt) / sales_amt < 0.20                      THEN '10% – 20%'
        WHEN (sales_amt - cost_amt) / sales_amt < 0.30                      THEN '20% – 30%'
        WHEN (sales_amt - cost_amt) / sales_amt < 0.35                      THEN '30% – 35% ✓ Target'
        WHEN (sales_amt - cost_amt) / sales_amt < 0.40                      THEN '35% – 40%'
        ELSE '40%+'
      END AS band
    FROM public.v_sales
    WHERE (date_from IS NULL OR invoice_date >= date_from)
      AND (date_to   IS NULL OR invoice_date <= date_to)
  ),
  totals AS (
    SELECT SUM(GREATEST(sales_amt, 0)) AS grand_total FROM base
  )
  SELECT
    b.band,
    ROUND(SUM(b.sales_amt), 2)                                               AS revenue,
    ROUND(SUM(b.sales_amt - b.cost_amt), 2)                                  AS gross_profit,
    COUNT(DISTINCT b.order_number)                                            AS order_count,
    COUNT(DISTINCT b.item_number)                                             AS item_count,
    ROUND(SUM(GREATEST(b.sales_amt,0)) / NULLIF(t.grand_total,0) * 100, 1)  AS pct_of_revenue
  FROM base b, totals t
  GROUP BY b.band, t.grand_total
  ORDER BY
    CASE b.band
      WHEN 'Below Cost (<0%)'    THEN 1
      WHEN 'Negative / Zero'     THEN 2
      WHEN '0% – 10%'            THEN 3
      WHEN '10% – 20%'           THEN 4
      WHEN '20% – 30%'           THEN 5
      WHEN '30% – 35% ✓ Target'  THEN 6
      WHEN '35% – 40%'           THEN 7
      WHEN '40%+'                THEN 8
    END;
$$;

GRANT EXECUTE ON FUNCTION public.get_margin_bands TO anon;


-- ─── 3. get_discount_buckets ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_discount_buckets(
  date_from date DEFAULT NULL,
  date_to   date DEFAULT NULL
)
RETURNS TABLE (
  bucket          text,
  revenue         numeric,
  order_count     bigint,
  avg_margin_pct  numeric,
  pct_of_revenue  numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH line_discounts AS (
    SELECT
      s.order_number,
      s.sales_amt,
      s.cost_amt,
      -- effective discount per line vs list price × qty
      CASE
        WHEN COALESCE(CAST(NULLIF(TRIM(lp.macola_price),'') AS numeric), 0) > 0
             AND s.qty_to_ship > 0
          THEN ROUND(
            (1 - s.sales_amt / NULLIF(
              CAST(NULLIF(TRIM(lp.macola_price),'') AS numeric) * s.qty_to_ship, 0
            )) * 100, 1)
        ELSE NULL
      END AS discount_pct
    FROM public.v_sales s
    LEFT JOIN public.list_prices lp ON TRIM(lp.part_no) = TRIM(s.item_number)
    WHERE (date_from IS NULL OR s.invoice_date >= date_from)
      AND (date_to   IS NULL OR s.invoice_date <= date_to)
      AND s.sales_amt > 0
  ),
  bucketed AS (
    SELECT
      sales_amt, cost_amt, order_number,
      CASE
        WHEN discount_pct IS NULL     THEN 'No List Price'
        WHEN discount_pct < 0         THEN 'Above List (Premium)'
        WHEN discount_pct < 10        THEN '0% – 10% Off'
        WHEN discount_pct < 20        THEN '10% – 20% Off'
        WHEN discount_pct < 30        THEN '20% – 30% Off'
        WHEN discount_pct < 40        THEN '30% – 40% Off'
        ELSE '40%+ Off'
      END AS bucket
    FROM line_discounts
  ),
  totals AS (SELECT SUM(sales_amt) AS grand_total FROM bucketed)
  SELECT
    b.bucket,
    ROUND(SUM(b.sales_amt), 2)                                               AS revenue,
    COUNT(DISTINCT b.order_number)                                            AS order_count,
    CASE WHEN SUM(b.sales_amt) > 0
         THEN ROUND(((SUM(b.sales_amt)-SUM(b.cost_amt))/SUM(b.sales_amt))*100,1)
         ELSE 0 END                                                           AS avg_margin_pct,
    ROUND(SUM(b.sales_amt)/NULLIF(t.grand_total,0)*100,1)                    AS pct_of_revenue
  FROM bucketed b, totals t
  GROUP BY b.bucket, t.grand_total
  ORDER BY
    CASE b.bucket
      WHEN 'Above List (Premium)' THEN 1
      WHEN 'No List Price'        THEN 2
      WHEN '0% – 10% Off'         THEN 3
      WHEN '10% – 20% Off'        THEN 4
      WHEN '20% – 30% Off'        THEN 5
      WHEN '30% – 40% Off'        THEN 6
      WHEN '40%+ Off'             THEN 7
    END;
$$;

GRANT EXECUTE ON FUNCTION public.get_discount_buckets TO anon;


-- ─── 4. get_pricing_opportunity ───────────────────────────────────────────────
/*
  Per-item pricing opportunity.
  opportunity_flag priority:
    1. Below Cost
    2. Low Margin  (<30% — below company target)
    3. High Discount (>30% off list)
    4. OK
  uplift_revenue = revenue needed to reach 30% margin floor
*/
CREATE OR REPLACE FUNCTION public.get_pricing_opportunity(
  date_from  date DEFAULT NULL,
  date_to    date DEFAULT NULL,
  row_limit  int  DEFAULT 60
)
RETURNS TABLE (
  item_number              text,
  product_cat_description  text,
  analytical_family        text,
  part_type                text,
  avg_unit_price           numeric,
  avg_unit_cost            numeric,
  list_price               numeric,
  avg_discount_pct         numeric,
  margin_pct               numeric,
  revenue                  numeric,
  qty_shipped              numeric,
  transaction_count        bigint,
  price_index              numeric,
  opportunity_flag         text,
  uplift_revenue           numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH item_sales AS (
    SELECT
      TRIM(s.item_number)                                                       AS item_number,
      COALESCE(NULLIF(TRIM(s.product_cat_description),''),'Uncategorized')      AS product_cat_description,
      COALESCE(NULLIF(TRIM(i.analytical_family),''),'General')                  AS analytical_family,
      SUM(s.sales_amt)                                                          AS revenue,
      SUM(s.cost_amt)                                                           AS total_cost,
      SUM(s.qty_to_ship)                                                        AS qty_shipped,
      COUNT(*)                                                                  AS transaction_count,
      CASE WHEN SUM(s.qty_to_ship)>0
           THEN SUM(s.sales_amt)/NULLIF(SUM(s.qty_to_ship),0) ELSE 0 END       AS avg_unit_price,
      CASE WHEN SUM(s.qty_to_ship)>0
           THEN SUM(s.cost_amt)/NULLIF(SUM(s.qty_to_ship),0)  ELSE 0 END       AS avg_unit_cost
    FROM public.v_sales s
    LEFT JOIN public.v_item i ON TRIM(i.item_number) = TRIM(s.item_number)
    WHERE (date_from IS NULL OR s.invoice_date >= date_from)
      AND (date_to   IS NULL OR s.invoice_date <= date_to)
      AND s.sales_amt > 0
    GROUP BY TRIM(s.item_number), s.product_cat_description, i.analytical_family
  ),
  global_avg AS (
    SELECT item_number,
      CASE WHEN SUM(qty_to_ship)>0
           THEN SUM(sales_amt)/NULLIF(SUM(qty_to_ship),0) ELSE 0 END AS global_avg_price
    FROM public.v_sales WHERE sales_amt > 0 GROUP BY item_number
  ),
  lp AS (
    SELECT DISTINCT ON (TRIM(part_no))
      TRIM(part_no) AS part_no,
      CAST(NULLIF(TRIM(macola_price),'') AS numeric) AS list_price
    FROM public.list_prices
    WHERE macola_price IS NOT NULL AND TRIM(macola_price)!=''
      AND TRIM(macola_price) ~ '^[0-9]+(\.[0-9]+)?$'
    ORDER BY TRIM(part_no), CAST(NULLIF(TRIM(macola_price),'') AS numeric) DESC NULLS LAST
  )
  SELECT
    its.item_number,
    its.product_cat_description,
    its.analytical_family,
    -- Part type from suffix
    CASE
      WHEN UPPER(REVERSE(SPLIT_PART(REVERSE(its.item_number),'-',1))) = 'OE'        THEN 'OE'
      WHEN UPPER(REVERSE(SPLIT_PART(REVERSE(its.item_number),'-',1))) = 'AM'        THEN 'AM'
      WHEN UPPER(REVERSE(SPLIT_PART(REVERSE(its.item_number),'-',1))) IN ('MG','MFG') THEN 'MG'
      ELSE 'OTHER'
    END                                                                             AS part_type,
    ROUND(its.avg_unit_price,4)                                                     AS avg_unit_price,
    ROUND(its.avg_unit_cost,4)                                                      AS avg_unit_cost,
    COALESCE(lp.list_price,0)                                                       AS list_price,
    CASE WHEN COALESCE(lp.list_price,0)>0
         THEN ROUND(((lp.list_price-its.avg_unit_price)/lp.list_price)*100,1)
         ELSE 0 END                                                                 AS avg_discount_pct,
    CASE WHEN its.revenue>0
         THEN ROUND(((its.revenue-its.total_cost)/its.revenue)*100,1)
         ELSE 0 END                                                                 AS margin_pct,
    ROUND(its.revenue,2)                                                            AS revenue,
    ROUND(its.qty_shipped,2)                                                        AS qty_shipped,
    its.transaction_count,
    CASE WHEN COALESCE(ga.global_avg_price,0)>0
         THEN ROUND(its.avg_unit_price/ga.global_avg_price,3)
         ELSE 1.000 END                                                             AS price_index,
    CASE
      WHEN its.revenue>0 AND (its.revenue-its.total_cost)/its.revenue < 0          THEN 'Below Cost'
      WHEN its.revenue>0 AND (its.revenue-its.total_cost)/its.revenue < 0.30       THEN 'Below Target'
      WHEN COALESCE(lp.list_price,0)>0
           AND ((lp.list_price-its.avg_unit_price)/lp.list_price) > 0.30           THEN 'High Discount'
      ELSE 'OK'
    END                                                                             AS opportunity_flag,
    -- Uplift to reach 30% margin floor
    CASE
      WHEN its.revenue>0 AND (its.revenue-its.total_cost)/its.revenue < 0.30
        THEN ROUND(its.total_cost/0.70 - its.revenue, 2)
      ELSE 0
    END                                                                             AS uplift_revenue
  FROM item_sales its
  LEFT JOIN global_avg ga ON ga.item_number = its.item_number
  LEFT JOIN lp ON lp.part_no = its.item_number
  ORDER BY its.revenue DESC
  LIMIT row_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_pricing_opportunity TO anon;


-- ─── 5. get_customer_pricing_profiles ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_customer_pricing_profiles(
  date_from  date DEFAULT NULL,
  date_to    date DEFAULT NULL,
  row_limit  int  DEFAULT 40
)
RETURNS TABLE (
  customer_number  text,
  company_name     text,
  cust_type        text,
  revenue          numeric,
  avg_margin_pct   numeric,
  avg_discount_pct numeric,
  price_index      numeric,
  order_count      bigint,
  opportunity_flag text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH cust_sales AS (
    SELECT
      s.customer_number,
      s.company_name,
      COALESCE(NULLIF(TRIM(c.cust_type),''),'Unknown')                        AS cust_type,
      SUM(s.sales_amt)                                                         AS revenue,
      SUM(s.cost_amt)                                                          AS total_cost,
      COUNT(DISTINCT s.order_number)                                           AS order_count
    FROM public.v_sales s
    LEFT JOIN public.v_customer c ON TRIM(c.cust_no) = TRIM(s.customer_number)
    WHERE (date_from IS NULL OR s.invoice_date >= date_from)
      AND (date_to   IS NULL OR s.invoice_date <= date_to)
      AND s.sales_amt > 0
    GROUP BY s.customer_number, s.company_name, c.cust_type
  ),
  global_item_avg AS (
    SELECT item_number,
      CASE WHEN SUM(qty_to_ship)>0
           THEN SUM(sales_amt)/NULLIF(SUM(qty_to_ship),0) ELSE 0 END AS global_avg_price
    FROM public.v_sales WHERE sales_amt>0 GROUP BY item_number
  ),
  cust_price_index AS (
    SELECT s.customer_number,
      CASE WHEN SUM(ga.global_avg_price * s.qty_to_ship)>0
           THEN ROUND(SUM(s.sales_amt)/SUM(ga.global_avg_price*s.qty_to_ship),3)
           ELSE 1.000 END AS price_index
    FROM public.v_sales s
    JOIN global_item_avg ga ON ga.item_number = s.item_number
    WHERE (date_from IS NULL OR s.invoice_date >= date_from)
      AND (date_to   IS NULL OR s.invoice_date <= date_to)
      AND s.sales_amt>0 AND s.qty_to_ship>0
    GROUP BY s.customer_number
  ),
  cust_discount AS (
    SELECT s.customer_number,
      CASE WHEN SUM(COALESCE(CAST(NULLIF(TRIM(lp.macola_price),'') AS numeric),0)*s.qty_to_ship)>0
           THEN ROUND((1 - SUM(s.sales_amt)/NULLIF(
             SUM(COALESCE(CAST(NULLIF(TRIM(lp.macola_price),'') AS numeric),0)*s.qty_to_ship),0
           ))*100,1)
           ELSE 0 END AS avg_discount_pct
    FROM public.v_sales s
    LEFT JOIN public.list_prices lp ON TRIM(lp.part_no)=TRIM(s.item_number)
    WHERE (date_from IS NULL OR s.invoice_date >= date_from)
      AND (date_to   IS NULL OR s.invoice_date <= date_to)
      AND s.sales_amt>0
    GROUP BY s.customer_number
  )
  SELECT
    cs.customer_number,
    cs.company_name,
    cs.cust_type,
    ROUND(cs.revenue,2)                                                        AS revenue,
    CASE WHEN cs.revenue>0
         THEN ROUND(((cs.revenue-cs.total_cost)/cs.revenue)*100,1)
         ELSE 0 END                                                            AS avg_margin_pct,
    COALESCE(cd.avg_discount_pct,0)                                            AS avg_discount_pct,
    COALESCE(cpi.price_index,1.000)                                            AS price_index,
    cs.order_count,
    CASE
      WHEN cs.revenue>0 AND (cs.revenue-cs.total_cost)/cs.revenue < 0         THEN 'Below Cost'
      WHEN cs.revenue>0 AND (cs.revenue-cs.total_cost)/cs.revenue < 0.30      THEN 'Below Target'
      WHEN COALESCE(cpi.price_index,1) < 0.85                                 THEN 'Deep Discount'
      ELSE 'OK'
    END                                                                        AS opportunity_flag
  FROM cust_sales cs
  LEFT JOIN cust_price_index cpi ON cpi.customer_number = cs.customer_number
  LEFT JOIN cust_discount cd ON cd.customer_number = cs.customer_number
  ORDER BY cs.revenue DESC
  LIMIT row_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_pricing_profiles TO anon;


-- ─── 6. get_location_override_analysis ───────────────────────────────────────
/*
  Compares what was actually billed vs what the list price would have been,
  grouped by location.  A high override rate + low margin = pricing leakage.
*/
CREATE OR REPLACE FUNCTION public.get_location_override_analysis(
  date_from date DEFAULT NULL,
  date_to   date DEFAULT NULL
)
RETURNS TABLE (
  location         text,
  revenue          numeric,
  total_cost       numeric,
  margin_pct       numeric,
  list_revenue     numeric,   -- what revenue would be at full list price × qty
  revenue_gap      numeric,   -- list_revenue - revenue  (money left on table)
  override_rate    numeric,   -- % of lines where sold < list
  order_count      bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH loc_lines AS (
    SELECT
      COALESCE(NULLIF(TRIM(l.location),''),'Unknown')                         AS location,
      s.order_number,
      s.sales_amt,
      s.cost_amt,
      s.qty_to_ship,
      COALESCE(CAST(NULLIF(TRIM(lp.macola_price),'') AS numeric),0)           AS list_unit_price,
      CASE WHEN COALESCE(CAST(NULLIF(TRIM(lp.macola_price),'') AS numeric),0)>0
                AND s.qty_to_ship>0
                AND s.sales_amt < CAST(NULLIF(TRIM(lp.macola_price),'') AS numeric)*s.qty_to_ship
           THEN 1 ELSE 0 END                                                  AS is_override
    FROM public.v_sales s
    LEFT JOIN public.location l ON l.order_number = s.order_number
    LEFT JOIN public.list_prices lp ON TRIM(lp.part_no)=TRIM(s.item_number)
    WHERE (date_from IS NULL OR s.invoice_date >= date_from)
      AND (date_to   IS NULL OR s.invoice_date <= date_to)
      AND s.sales_amt > 0
  )
  SELECT
    ll.location,
    ROUND(SUM(ll.sales_amt),2)                                                AS revenue,
    ROUND(SUM(ll.cost_amt),2)                                                 AS total_cost,
    CASE WHEN SUM(ll.sales_amt)>0
         THEN ROUND(((SUM(ll.sales_amt)-SUM(ll.cost_amt))/SUM(ll.sales_amt))*100,1)
         ELSE 0 END                                                           AS margin_pct,
    ROUND(SUM(
      CASE WHEN ll.list_unit_price>0 AND ll.qty_to_ship>0
           THEN ll.list_unit_price*ll.qty_to_ship
           ELSE ll.sales_amt END
    ),2)                                                                      AS list_revenue,
    ROUND(SUM(
      CASE WHEN ll.list_unit_price>0 AND ll.qty_to_ship>0
           THEN GREATEST(ll.list_unit_price*ll.qty_to_ship - ll.sales_amt, 0)
           ELSE 0 END
    ),2)                                                                      AS revenue_gap,
    ROUND(AVG(ll.is_override)*100,1)                                          AS override_rate,
    COUNT(DISTINCT ll.order_number)                                           AS order_count
  FROM loc_lines ll
  GROUP BY ll.location
  ORDER BY revenue DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_location_override_analysis TO anon;


-- ─── 7. get_uplift_summary ────────────────────────────────────────────────────
/*
  Scenario modelling: what incremental profit is available if we close margin gaps?
  Three scenarios:
    A. Bring all sub-30% lines to 30% margin (price increase, no volume loss)
    B. Bring all sub-30% lines to 30% margin with 10% assumed volume loss
    C. Eliminate all discounts > 30% off list (bring to 30% off)
*/
CREATE OR REPLACE FUNCTION public.get_uplift_summary(
  date_from date DEFAULT NULL,
  date_to   date DEFAULT NULL
)
RETURNS TABLE (
  scenario          text,
  current_revenue   numeric,
  current_profit    numeric,
  current_margin    numeric,
  uplift_profit     numeric,
  new_margin        numeric,
  incremental_profit numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH base AS (
    SELECT
      s.sales_amt,
      s.cost_amt,
      s.qty_to_ship,
      COALESCE(CAST(NULLIF(TRIM(lp.macola_price),'') AS numeric),0) AS list_unit_price,
      CASE WHEN s.sales_amt>0
           THEN (s.sales_amt-s.cost_amt)/s.sales_amt ELSE 0 END      AS margin_rate
    FROM public.v_sales s
    LEFT JOIN public.list_prices lp ON TRIM(lp.part_no)=TRIM(s.item_number)
    WHERE (date_from IS NULL OR s.invoice_date >= date_from)
      AND (date_to   IS NULL OR s.invoice_date <= date_to)
      AND s.sales_amt > 0
  ),
  totals AS (
    SELECT
      SUM(sales_amt)           AS tot_rev,
      SUM(cost_amt)            AS tot_cost,
      SUM(sales_amt-cost_amt)  AS tot_profit
    FROM base
  ),
  -- Scenario A: bring sub-30% to 30% (full volume)
  scen_a AS (
    SELECT SUM(
      CASE WHEN margin_rate < 0.30
           THEN cost_amt/0.70 - sales_amt   -- additional revenue needed
           ELSE 0 END
    ) AS extra_profit FROM base
  ),
  -- Scenario B: same but 10% volume loss on affected lines
  scen_b AS (
    SELECT SUM(
      CASE WHEN margin_rate < 0.30
           THEN (cost_amt/0.70 - sales_amt) * 0.90
           ELSE 0 END
    ) AS extra_profit FROM base
  ),
  -- Scenario C: cap discounts at 30% off list (bring >30% off lines up)
  scen_c AS (
    SELECT SUM(
      CASE WHEN list_unit_price>0 AND qty_to_ship>0
                AND sales_amt < list_unit_price*qty_to_ship*0.70
           THEN list_unit_price*qty_to_ship*0.70 - sales_amt
           ELSE 0 END
    ) AS extra_revenue FROM base
  )
  SELECT 'Baseline' AS scenario,
    ROUND(t.tot_rev,2), ROUND(t.tot_profit,2),
    ROUND(t.tot_profit/NULLIF(t.tot_rev,0)*100,1),
    ROUND(t.tot_profit,2),
    ROUND(t.tot_profit/NULLIF(t.tot_rev,0)*100,1),
    0::numeric
  FROM totals t
  UNION ALL
  SELECT 'A: Price to 30% Floor (Full Volume)',
    ROUND(t.tot_rev,2), ROUND(t.tot_profit,2),
    ROUND(t.tot_profit/NULLIF(t.tot_rev,0)*100,1),
    ROUND(t.tot_profit+a.extra_profit,2),
    ROUND((t.tot_profit+a.extra_profit)/NULLIF(t.tot_rev+a.extra_profit,0)*100,1),
    ROUND(a.extra_profit,2)
  FROM totals t, scen_a a
  UNION ALL
  SELECT 'B: Price to 30% Floor (−10% Volume)',
    ROUND(t.tot_rev,2), ROUND(t.tot_profit,2),
    ROUND(t.tot_profit/NULLIF(t.tot_rev,0)*100,1),
    ROUND(t.tot_profit+b.extra_profit,2),
    ROUND((t.tot_profit+b.extra_profit)/NULLIF(t.tot_rev+b.extra_profit,0)*100,1),
    ROUND(b.extra_profit,2)
  FROM totals t, scen_b b
  UNION ALL
  SELECT 'C: Cap Discounts at 30% Off List',
    ROUND(t.tot_rev,2), ROUND(t.tot_profit,2),
    ROUND(t.tot_profit/NULLIF(t.tot_rev,0)*100,1),
    ROUND(t.tot_profit+c.extra_revenue*0.30,2),  -- 30% of extra rev flows to profit
    ROUND((t.tot_profit+c.extra_revenue*0.30)/NULLIF(t.tot_rev+c.extra_revenue,0)*100,1),
    ROUND(c.extra_revenue*0.30,2)
  FROM totals t, scen_c c;
$$;

GRANT EXECUTE ON FUNCTION public.get_uplift_summary TO anon;
