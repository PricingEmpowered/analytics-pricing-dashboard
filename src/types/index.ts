export interface DateRange {
  from: string;
  to: string;
}

export interface KPIData {
  total_revenue: number;
  total_cost: number;
  gross_profit: number;
  gross_margin_pct: number;
  total_orders: number;
  total_invoices: number;
}

export interface CategoryBreakdown {
  category: string;
  revenue: number;
  cost: number;
  margin_pct: number;
}

export interface MonthlyTrend {
  month: string;
  revenue: number;
  cost: number;
  profit: number;
}

export interface TopCustomer {
  customer_number: string;
  company_name: string;
  revenue: number;
  cost: number;
  gross_profit: number;
  margin_pct: number;
  order_count: number;
}

export interface TopProduct {
  item_number: string;
  product_cat_description: string;
  revenue: number;
  cost: number;
  gross_profit: number;
  margin_pct: number;
  qty_shipped: number;
}

export interface BusinessTypeSummary {
  business_type: string;
  revenue: number;
  cost: number;
  gross_profit: number;
  margin_pct: number;
  order_count: number;
}

export interface BusinessTypeTrend {
  month: string;
  parts: number;
  repairs: number;
  labor: number;
}

export interface RepairOrder {
  order_number: number;
  company_name: string;
  invoice_date: string;
  product_type: string;
  billed_revenue: number;
  sales_cost: number;
  bom_parts_cost: number;
  implied_labor_rev: number;
  margin_pct: number;
}

// ─── Pricing Opportunity Types ────────────────────────────────────────────────

export interface PartFamilyRow {
  family_key: string;
  item_number: string;
  part_type: 'OE' | 'AM' | 'MG' | 'OTHER';
  list_price: number;
  avg_sold_price: number;
  avg_cost: number;
  margin_pct: number;
  revenue: number;
  qty_shipped: number;
  oe_list_price: number;
  price_ratio: number | null;
  discount_vs_list: number | null;
  misalignment_flag: string;
}

export interface PricingOpportunityItem {
  item_number: string;
  product_cat_description: string;
  analytical_family: string;
  part_type: string;
  avg_unit_price: number;
  avg_unit_cost: number;
  list_price: number;
  avg_discount_pct: number;
  margin_pct: number;
  revenue: number;
  qty_shipped: number;
  transaction_count: number;
  price_index: number;
  opportunity_flag: string;
  uplift_revenue: number;
}

export interface CustomerPricingProfile {
  customer_number: string;
  company_name: string;
  cust_type: string;
  revenue: number;
  avg_margin_pct: number;
  avg_discount_pct: number;
  price_index: number;
  order_count: number;
  opportunity_flag: string;
}

export interface LocationOverride {
  location: string;
  revenue: number;
  total_cost: number;
  margin_pct: number;
  list_revenue: number;
  revenue_gap: number;
  override_rate: number;
  order_count: number;
}

export interface MarginBandSummary {
  band: string;
  revenue: number;
  gross_profit: number;
  order_count: number;
  item_count: number;
  pct_of_revenue: number;
}

export interface DiscountBucket {
  bucket: string;
  revenue: number;
  order_count: number;
  avg_margin_pct: number;
  pct_of_revenue: number;
}

export interface DiscountComplianceCustomer {
  customer_number: string;
  company_name: string;
  cust_type: string;
  revenue: number;
  margin_pct: number;
  entitled_discount: number;
  actual_discount: number;
  excess_discount: number;
  revenue_at_schedule: number;
  revenue_gap: number;
  order_count: number;
  compliance_flag: string;
}

export interface DiscountComplianceFamily {
  product_family: string;
  revenue: number;
  margin_pct: number;
  entitled_discount: number;
  actual_discount: number;
  excess_discount: number;
  revenue_gap: number;
  customer_count: number;
  order_count: number;
  compliance_flag: string;
}

export interface DiscountScheduleSummary {
  cust_type: string;
  product_family: string;
  entitled_discount: number;
  actual_discount: number;
  excess_discount: number;
  revenue: number;
  margin_pct: number;
  customer_count: number;
  revenue_gap: number;
}

export interface UpliftScenario {
  scenario: string;
  current_revenue: number;
  current_profit: number;
  current_margin: number;
  uplift_profit: number;
  new_margin: number;
  incremental_profit: number;
}
