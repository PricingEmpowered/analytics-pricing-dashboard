import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type {
  KPIData,
  CategoryBreakdown,
  MonthlyTrend,
  TopCustomer,
  TopProduct,
  BusinessTypeSummary,
  BusinessTypeTrend,
  RepairOrder,
  DateRange,
  PricingOpportunityItem,
  CustomerPricingProfile,
  MarginBandSummary,
  DiscountBucket,
} from '../types';

function toNum(v: unknown): number {
  return typeof v === 'string' ? parseFloat(v) : (v as number) ?? 0;
}

// ─── Generic hook factory ─────────────────────────────────────────────────────
function useRpc<T>(
  rpcName: string,
  params: Record<string, unknown>,
  mapper: (r: Record<string, unknown>) => T,
  deps: unknown[]
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabase
      .rpc(rpcName, params)
      .then(({ data: rows, error: err }) => {
        if (cancelled) return;
        if (err) { setError(err.message); setLoading(false); return; }
        setData((rows ?? []).map((r: Record<string, unknown>) => mapper(r)));
        setLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────
export function useKPIs(dateRange: DateRange) {
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabase
      .rpc('get_kpis', { date_from: dateRange.from || null, date_to: dateRange.to || null })
      .then(({ data: rows, error: err }) => {
        if (cancelled) return;
        if (err) { setError(err.message); setLoading(false); return; }
        const r = rows?.[0];
        if (!r) { setData(null); setLoading(false); return; }
        setData({
          total_revenue:    toNum(r.total_revenue),
          total_cost:       toNum(r.total_cost),
          gross_profit:     toNum(r.gross_profit),
          gross_margin_pct: toNum(r.gross_margin_pct),
          total_orders:     toNum(r.total_orders),
          total_invoices:   toNum(r.total_invoices),
        });
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [dateRange.from, dateRange.to]);

  return { data, loading, error };
}

// ─── Category Breakdown ───────────────────────────────────────────────────────
export function useCategoryBreakdown(dateRange: DateRange) {
  return useRpc<CategoryBreakdown>(
    'get_category_breakdown',
    { date_from: dateRange.from || null, date_to: dateRange.to || null },
    (r) => ({
      category:   r.category as string,
      revenue:    toNum(r.revenue),
      cost:       toNum(r.cost),
      margin_pct: toNum(r.margin_pct),
    }),
    [dateRange.from, dateRange.to]
  );
}

// ─── Monthly Trend ────────────────────────────────────────────────────────────
export function useMonthlyTrend(dateRange: DateRange) {
  return useRpc<MonthlyTrend>(
    'get_monthly_trend',
    { date_from: dateRange.from || null, date_to: dateRange.to || null },
    (r) => ({
      month:   r.month as string,
      revenue: toNum(r.revenue),
      cost:    toNum(r.cost),
      profit:  toNum(r.profit),
    }),
    [dateRange.from, dateRange.to]
  );
}

// ─── Top Customers ────────────────────────────────────────────────────────────
export function useTopCustomers(dateRange: DateRange, rowLimit = 10) {
  return useRpc<TopCustomer>(
    'get_top_customers',
    { date_from: dateRange.from || null, date_to: dateRange.to || null, row_limit: rowLimit },
    (r) => ({
      customer_number: r.customer_number as string,
      company_name:    r.company_name as string,
      revenue:         toNum(r.revenue),
      cost:            toNum(r.cost),
      gross_profit:    toNum(r.gross_profit),
      margin_pct:      toNum(r.margin_pct),
      order_count:     toNum(r.order_count),
    }),
    [dateRange.from, dateRange.to, rowLimit]
  );
}

// ─── Top Products ─────────────────────────────────────────────────────────────
export function useTopProducts(dateRange: DateRange, rowLimit = 10) {
  return useRpc<TopProduct>(
    'get_top_products',
    { date_from: dateRange.from || null, date_to: dateRange.to || null, row_limit: rowLimit },
    (r) => ({
      item_number:             r.item_number as string,
      product_cat_description: r.product_cat_description as string,
      revenue:                 toNum(r.revenue),
      cost:                    toNum(r.cost),
      gross_profit:            toNum(r.gross_profit),
      margin_pct:              toNum(r.margin_pct),
      qty_shipped:             toNum(r.qty_shipped),
    }),
    [dateRange.from, dateRange.to, rowLimit]
  );
}

// ─── Business Type Breakdown ──────────────────────────────────────────────────
export function useBusinessTypeBreakdown(dateRange: DateRange) {
  return useRpc<BusinessTypeSummary>(
    'get_business_type_breakdown',
    { date_from: dateRange.from || null, date_to: dateRange.to || null },
    (r) => ({
      business_type: r.business_type as string,
      revenue:       toNum(r.revenue),
      cost:          toNum(r.cost),
      gross_profit:  toNum(r.gross_profit),
      margin_pct:    toNum(r.margin_pct),
      order_count:   toNum(r.order_count),
    }),
    [dateRange.from, dateRange.to]
  );
}

// ─── Business Type Trend ──────────────────────────────────────────────────────
export function useBusinessTypeTrend(dateRange: DateRange) {
  return useRpc<BusinessTypeTrend>(
    'get_business_type_trend',
    { date_from: dateRange.from || null, date_to: dateRange.to || null },
    (r) => ({
      month:   r.month as string,
      parts:   toNum(r.parts),
      repairs: toNum(r.repairs),
      labor:   toNum(r.labor),
    }),
    [dateRange.from, dateRange.to]
  );
}

// ─── Repair Intelligence ──────────────────────────────────────────────────────
export function useRepairIntelligence(dateRange: DateRange, rowLimit = 20) {
  return useRpc<RepairOrder>(
    'get_repair_intelligence',
    { date_from: dateRange.from || null, date_to: dateRange.to || null, row_limit: rowLimit },
    (r) => ({
      order_number:      toNum(r.order_number),
      company_name:      r.company_name as string,
      invoice_date:      r.invoice_date as string,
      product_type:      r.product_type as string,
      billed_revenue:    toNum(r.billed_revenue),
      sales_cost:        toNum(r.sales_cost),
      bom_parts_cost:    toNum(r.bom_parts_cost),
      implied_labor_rev: toNum(r.implied_labor_rev),
      margin_pct:        toNum(r.margin_pct),
    }),
    [dateRange.from, dateRange.to, rowLimit]
  );
}

// ─── Pricing Opportunity Items ────────────────────────────────────────────────
export function usePricingOpportunity(dateRange: DateRange, rowLimit = 50) {
  return useRpc<PricingOpportunityItem>(
    'get_pricing_opportunity',
    { date_from: dateRange.from || null, date_to: dateRange.to || null, row_limit: rowLimit },
    (r) => ({
      item_number:             r.item_number as string,
      product_cat_description: r.product_cat_description as string,
      analytical_family:       (r.analytical_family as string) ?? '',
      part_type:               (r.part_type as string) ?? 'OTHER',
      avg_unit_price:          toNum(r.avg_unit_price),
      avg_unit_cost:           toNum(r.avg_unit_cost),
      list_price:              toNum(r.list_price),
      avg_discount_pct:        toNum(r.avg_discount_pct),
      margin_pct:              toNum(r.margin_pct),
      revenue:                 toNum(r.revenue),
      qty_shipped:             toNum(r.qty_shipped),
      transaction_count:       toNum(r.transaction_count),
      price_index:             toNum(r.price_index),
      opportunity_flag:        (r.opportunity_flag as string) ?? 'OK',
      uplift_revenue:          toNum(r.uplift_revenue),
    }),
    [dateRange.from, dateRange.to, rowLimit]
  );
}

// ─── Customer Pricing Profiles ────────────────────────────────────────────────
export function useCustomerPricingProfiles(dateRange: DateRange, rowLimit = 30) {
  return useRpc<CustomerPricingProfile>(
    'get_customer_pricing_profiles',
    { date_from: dateRange.from || null, date_to: dateRange.to || null, row_limit: rowLimit },
    (r) => ({
      customer_number:  r.customer_number as string,
      company_name:     r.company_name as string,
      cust_type:        (r.cust_type as string) ?? '',
      revenue:          toNum(r.revenue),
      avg_margin_pct:   toNum(r.avg_margin_pct),
      avg_discount_pct: toNum(r.avg_discount_pct),
      price_index:      toNum(r.price_index),
      order_count:      toNum(r.order_count),
      opportunity_flag: (r.opportunity_flag as string) ?? 'OK',
    }),
    [dateRange.from, dateRange.to, rowLimit]
  );
}

// ─── Margin Band Summary ──────────────────────────────────────────────────────
export function useMarginBands(dateRange: DateRange) {
  return useRpc<MarginBandSummary>(
    'get_margin_bands',
    { date_from: dateRange.from || null, date_to: dateRange.to || null },
    (r) => ({
      band:           r.band as string,
      revenue:        toNum(r.revenue),
      gross_profit:   toNum(r.gross_profit),
      order_count:    toNum(r.order_count),
      item_count:     toNum(r.item_count),
      pct_of_revenue: toNum(r.pct_of_revenue),
    }),
    [dateRange.from, dateRange.to]
  );
}

// ─── Discount Bucket Analysis ─────────────────────────────────────────────────
export function useDiscountBuckets(dateRange: DateRange) {
  return useRpc<DiscountBucket>(
    'get_discount_buckets',
    { date_from: dateRange.from || null, date_to: dateRange.to || null },
    (r) => ({
      bucket:         r.bucket as string,
      revenue:        toNum(r.revenue),
      order_count:    toNum(r.order_count),
      avg_margin_pct: toNum(r.avg_margin_pct),
      pct_of_revenue: toNum(r.pct_of_revenue),
    }),
    [dateRange.from, dateRange.to]
  );
}

// ─── Discount Compliance Hooks ────────────────────────────────────────────────
import type {
  DiscountComplianceCustomer,
  DiscountComplianceFamily,
  DiscountScheduleSummary,
  LocationOverride,
  UpliftScenario,
  PartFamilyRow,
} from '../types';

export function useDiscountComplianceByCustomer(dateRange: DateRange, rowLimit = 50) {
  return useRpc<DiscountComplianceCustomer>(
    'get_discount_compliance_by_customer',
    { date_from: dateRange.from || null, date_to: dateRange.to || null, row_limit: rowLimit },
    (r) => ({
      customer_number:     r.customer_number as string,
      company_name:        r.company_name as string,
      cust_type:           (r.cust_type as string) ?? '',
      revenue:             toNum(r.revenue),
      margin_pct:          toNum(r.margin_pct),
      entitled_discount:   toNum(r.entitled_discount),
      actual_discount:     toNum(r.actual_discount),
      excess_discount:     toNum(r.excess_discount),
      revenue_at_schedule: toNum(r.revenue_at_schedule),
      revenue_gap:         toNum(r.revenue_gap),
      order_count:         toNum(r.order_count),
      compliance_flag:     (r.compliance_flag as string) ?? 'No Schedule',
    }),
    [dateRange.from, dateRange.to, rowLimit]
  );
}

export function useDiscountComplianceByFamily(dateRange: DateRange) {
  return useRpc<DiscountComplianceFamily>(
    'get_discount_compliance_by_family',
    { date_from: dateRange.from || null, date_to: dateRange.to || null },
    (r) => ({
      product_family:    r.product_family as string,
      revenue:           toNum(r.revenue),
      margin_pct:        toNum(r.margin_pct),
      entitled_discount: toNum(r.entitled_discount),
      actual_discount:   toNum(r.actual_discount),
      excess_discount:   toNum(r.excess_discount),
      revenue_gap:       toNum(r.revenue_gap),
      customer_count:    toNum(r.customer_count),
      order_count:       toNum(r.order_count),
      compliance_flag:   (r.compliance_flag as string) ?? 'No Schedule',
    }),
    [dateRange.from, dateRange.to]
  );
}

export function useDiscountScheduleSummary(dateRange: DateRange) {
  return useRpc<DiscountScheduleSummary>(
    'get_discount_schedule_summary',
    { date_from: dateRange.from || null, date_to: dateRange.to || null },
    (r) => ({
      cust_type:         r.cust_type as string,
      product_family:    r.product_family as string,
      entitled_discount: toNum(r.entitled_discount),
      actual_discount:   toNum(r.actual_discount),
      excess_discount:   toNum(r.excess_discount),
      revenue:           toNum(r.revenue),
      margin_pct:        toNum(r.margin_pct),
      customer_count:    toNum(r.customer_count),
      revenue_gap:       toNum(r.revenue_gap),
    }),
    [dateRange.from, dateRange.to]
  );
}

export function useLocationOverrides(dateRange: DateRange) {
  return useRpc<LocationOverride>(
    'get_location_override_analysis',
    { date_from: dateRange.from || null, date_to: dateRange.to || null },
    (r) => ({
      location:      r.location as string,
      revenue:       toNum(r.revenue),
      total_cost:    toNum(r.total_cost),
      margin_pct:    toNum(r.margin_pct),
      list_revenue:  toNum(r.list_revenue),
      revenue_gap:   toNum(r.revenue_gap),
      override_rate: toNum(r.override_rate),
      order_count:   toNum(r.order_count),
    }),
    [dateRange.from, dateRange.to]
  );
}

export function useUpliftSummary(dateRange: DateRange) {
  return useRpc<UpliftScenario>(
    'get_uplift_summary',
    { date_from: dateRange.from || null, date_to: dateRange.to || null },
    (r) => ({
      scenario:           r.scenario as string,
      current_revenue:    toNum(r.current_revenue),
      current_profit:     toNum(r.current_profit),
      current_margin:     toNum(r.current_margin),
      uplift_profit:      toNum(r.uplift_profit),
      new_margin:         toNum(r.new_margin),
      incremental_profit: toNum(r.incremental_profit),
    }),
    [dateRange.from, dateRange.to]
  );
}

export function usePartFamilyAlignment(dateRange: DateRange, rowLimit = 100) {
  return useRpc<PartFamilyRow>(
    'get_part_family_alignment',
    { date_from: dateRange.from || null, date_to: dateRange.to || null, row_limit: rowLimit },
    (r) => ({
      family_key:        r.family_key as string,
      item_number:       r.item_number as string,
      part_type:         (r.part_type as 'OE' | 'AM' | 'MG' | 'OTHER'),
      list_price:        toNum(r.list_price),
      avg_sold_price:    toNum(r.avg_sold_price),
      avg_cost:          toNum(r.avg_cost),
      margin_pct:        toNum(r.margin_pct),
      revenue:           toNum(r.revenue),
      qty_shipped:       toNum(r.qty_shipped),
      oe_list_price:     toNum(r.oe_list_price),
      price_ratio:       r.price_ratio != null ? toNum(r.price_ratio) : null,
      discount_vs_list:  r.discount_vs_list != null ? toNum(r.discount_vs_list) : null,
      misalignment_flag: (r.misalignment_flag as string) ?? 'OK',
    }),
    [dateRange.from, dateRange.to, rowLimit]
  );
}
