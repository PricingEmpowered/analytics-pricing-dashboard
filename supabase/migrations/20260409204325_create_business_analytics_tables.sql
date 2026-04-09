/*
  # Business Analytics Schema

  ## Overview
  Creates all tables needed for business analytics sprint dashboard.

  ## Tables Created

  1. **sales** - Core sales/invoicing data with revenue, cost, quantities
  2. **customer** - Customer directory with contact info and type classification
  3. **item** - Product catalog with categories and analytical families
  4. **bom** - Bill of materials / order line items with pricing and costs
  5. **avgcost** - Average cost per item/location with reference pricing
  6. **discount** - Discount schedule by customer type and product family
  7. **list_prices** - Published price list by part number
  8. **location** - Order-to-location mapping
  9. **oe_prices** - Order entry prices with cost data per item/location

  ## Notes
  - Original schema had spaces in table/column names; normalized to underscores
  - All tables have RLS enabled with anonymous read access for the analytics dashboard
  - id columns added as primary keys where missing
*/

-- SALES table
CREATE TABLE IF NOT EXISTS public.sales (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  order_number bigint,
  customer_number text,
  invoice_number bigint,
  invoice_date date,
  company_name text,
  item_number text,
  product_cat text,
  product_cat_description text,
  sales_amt numeric,
  cost_amt numeric,
  total_invoice numeric,
  qty_to_ship numeric,
  sales_tax_amt text,
  sales_tax_amt_2 text,
  sales_tax_amt_3 text,
  freight_amt text
);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select on sales"
  ON public.sales FOR SELECT
  TO anon
  USING (true);

-- CUSTOMER table
CREATE TABLE IF NOT EXISTS public.customer (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  rank bigint,
  cust_no text,
  cust_name text,
  address text,
  address_1 text,
  address_2 text,
  zip text,
  city text,
  county text,
  state text,
  country text,
  contact text,
  contact_1 text,
  phone_no text,
  phone_no_1 text,
  company text,
  cust_sup text,
  active text,
  tax_1099 text,
  c text,
  domestic_foreign text,
  sls_man text,
  a text,
  b text,
  credit text,
  cust_type text
);

ALTER TABLE public.customer ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select on customer"
  ON public.customer FOR SELECT
  TO anon
  USING (true);

-- ITEM table
CREATE TABLE IF NOT EXISTS public.item (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  item_number text,
  product_cat text,
  product_cat_description text,
  analytical_family text,
  description text
);

ALTER TABLE public.item ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select on item"
  ON public.item FOR SELECT
  TO anon
  USING (true);

-- BOM table
CREATE TABLE IF NOT EXISTS public.bom (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  ordtype text,
  ordno bigint,
  lineseqno bigint,
  itemno text,
  loc bigint,
  pickseq text,
  cusitemno text,
  itemdesc1 text,
  itemdesc2 text,
  qtyordered double precision,
  qtytoship text,
  unitprice double precision,
  concat text,
  kit_name text,
  discountpct text,
  requestdt text,
  qtybkord text,
  qtyreturntostk text,
  bkordfg text,
  uom text,
  uomratio bigint,
  unitcost double precision
);

ALTER TABLE public.bom ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select on bom"
  ON public.bom FOR SELECT
  TO anon
  USING (true);

-- AVGCOST table
CREATE TABLE IF NOT EXISTS public.avgcost (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  item_no text,
  uom text,
  loc text,
  mat text,
  prod_cat text,
  avg_cost double precision,
  ref_price text,
  qty_nov_25 text
);

ALTER TABLE public.avgcost ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select on avgcost"
  ON public.avgcost FOR SELECT
  TO anon
  USING (true);

-- DISCOUNT table
CREATE TABLE IF NOT EXISTS public.discount (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  code text,
  customer_type text,
  product_family text,
  macola_discount text
);

ALTER TABLE public.discount ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select on discount"
  ON public.discount FOR SELECT
  TO anon
  USING (true);

-- LIST PRICES table
CREATE TABLE IF NOT EXISTS public.list_prices (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  prefix text,
  suffix text,
  part_no text,
  part_description text,
  price_code text,
  macola_price text
);

ALTER TABLE public.list_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select on list_prices"
  ON public.list_prices FOR SELECT
  TO anon
  USING (true);

-- LOCATION table
CREATE TABLE IF NOT EXISTS public.location (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  order_number bigint,
  location text
);

ALTER TABLE public.location ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select on location"
  ON public.location FOR SELECT
  TO anon
  USING (true);

-- OE PRICES table
CREATE TABLE IF NOT EXISTS public.oe_prices (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  unformatted_item_no text,
  xref_item text,
  item_desc_1 text,
  item_desc_2 text,
  location text,
  product_category text,
  user_code text,
  cycle_count_code text,
  item_category text,
  average_cost text,
  standard_cost text,
  default_price text
);

ALTER TABLE public.oe_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select on oe_prices"
  ON public.oe_prices FOR SELECT
  TO anon
  USING (true);
