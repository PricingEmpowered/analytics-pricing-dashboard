/*
  # Normalized Views for Analytics Dashboard

  Creates clean snake_case views over the original tables which have
  column names with spaces and special characters. The dashboard queries
  these views instead of the raw tables.

  ## Views Created
  - `v_sales` — core sales/invoice lines with revenue, cost, dates
  - `v_customer` — customer directory with type and salesman info
  - `v_item` — product catalog with categories and families

  ## Notes
  - Views are SECURITY INVOKER (default), relying on RLS on base tables
  - Anon SELECT policies already exist on base tables from prior migration
  - TRIM applied to text columns to remove trailing whitespace from source data
*/

CREATE OR REPLACE VIEW public.v_sales AS
SELECT
  id,
  "Order Number"              AS order_number,
  TRIM("Customer Number")     AS customer_number,
  "Invoice Number"            AS invoice_number,
  "Invoice Date"              AS invoice_date,
  TRIM("Company Name")        AS company_name,
  TRIM("Item Number")         AS item_number,
  TRIM("Product Cat")         AS product_cat,
  TRIM("Product Cat Description") AS product_cat_description,
  "Sales Amt."                AS sales_amt,
  "Cost Amt."                 AS cost_amt,
  "Total Invoice"             AS total_invoice,
  "Qty to Ship"               AS qty_to_ship
FROM public.sales;

GRANT SELECT ON public.v_sales TO anon;

CREATE OR REPLACE VIEW public.v_customer AS
SELECT
  id,
  "Rank"                      AS rank,
  TRIM("Cust #")              AS cust_no,
  TRIM("Cust Name")           AS cust_name,
  TRIM("City")                AS city,
  TRIM("State")               AS state,
  TRIM("Country")             AS country,
  TRIM("Company")             AS company,
  TRIM("Cust Type")           AS cust_type,
  TRIM("Sls Man")             AS sls_man,
  TRIM("Active")              AS active,
  TRIM("Credit")              AS credit,
  TRIM("Domestic/Foreign")    AS domestic_foreign
FROM public.customer;

GRANT SELECT ON public.v_customer TO anon;

CREATE OR REPLACE VIEW public.v_item AS
SELECT
  id,
  TRIM("Item Number")                 AS item_number,
  TRIM("Product Cat")                 AS product_cat,
  TRIM("Product Cat Description")     AS product_cat_description,
  TRIM("Analytical Family")           AS analytical_family,
  TRIM("Description")                 AS description
FROM public.item;

GRANT SELECT ON public.v_item TO anon;
