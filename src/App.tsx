import { useState, useCallback } from 'react';
import {
  DollarSign, TrendingUp, ShoppingCart, Users, Percent, Package,
  BarChart2, Target, Tag, MapPin, Layers, Zap,
} from 'lucide-react';
import Header from './components/Header';
import KPICard from './components/KPICard';
import BarChart from './components/BarChart';
import LineChart from './components/LineChart';
import TopCustomersTable from './components/TopCustomersTable';
import TopProductsTable from './components/TopProductsTable';
import BusinessMixPanel from './components/BusinessMixPanel';
import BusinessTrendChart from './components/BusinessTrendChart';
import RepairIntelligenceTable from './components/RepairIntelligenceTable';
import MarginBandChart from './components/MarginBandChart';
import DiscountDepthChart from './components/DiscountDepthChart';
import PricingOpportunityTable from './components/PricingOpportunityTable';
import DiscountComplianceTable from './components/DiscountComplianceTable';
import PartFamilyTable from './components/PartFamilyTable';
import LocationOverrideTable from './components/LocationOverrideTable';
import UpliftSummaryPanel from './components/UpliftSummaryPanel';
import {
  useKPIs,
  useCategoryBreakdown,
  useMonthlyTrend,
  useTopCustomers,
  useTopProducts,
  useBusinessTypeBreakdown,
  useBusinessTypeTrend,
  useRepairIntelligence,
  useMarginBands,
  useDiscountBuckets,
  usePricingOpportunity,
  useDiscountComplianceByCustomer,
  useDiscountComplianceByFamily,
  useDiscountScheduleSummary,
  useLocationOverrides,
  useUpliftSummary,
  usePartFamilyAlignment,
} from './hooks/useAnalytics';
import type { DateRange } from './types';

const YTD_RANGE: DateRange = {
  from: `${new Date().getFullYear()}-01-01`,
  to: new Date().toISOString().slice(0, 10),
};

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

type Tab = 'overview' | 'pricing' | 'compliance' | 'families' | 'locations' | 'uplift';

const TABS: { id: Tab; label: string; icon: typeof BarChart2; description: string }[] = [
  { id: 'overview',    label: 'Overview',            icon: BarChart2,  description: 'Revenue, margin, and business mix' },
  { id: 'pricing',     label: 'Pricing Opportunity', icon: Target,     description: 'Item-level margin & discount analysis' },
  { id: 'compliance',  label: 'Discount Compliance', icon: Tag,        description: 'Entitlement vs actual by customer & family' },
  { id: 'families',    label: 'OE / AM / MG',        icon: Layers,     description: 'Part family price alignment' },
  { id: 'locations',   label: 'Location Overrides',  icon: MapPin,     description: 'Override rate & revenue gap by location' },
  { id: 'uplift',      label: 'Uplift Scenarios',    icon: Zap,        description: 'What-if profit modelling at 30% floor' },
];

export default function App() {
  const [dateRange, setDateRange] = useState<DateRange>(YTD_RANGE);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // ── Overview data ──────────────────────────────────────────────────────────
  const { data: kpis, loading: kpiLoading } = useKPIs(dateRange);
  const { data: categories, loading: catLoading } = useCategoryBreakdown(dateRange);
  const { data: monthly, loading: monthlyLoading } = useMonthlyTrend(dateRange);
  const { data: customers, loading: custLoading } = useTopCustomers(dateRange);
  const { data: products, loading: prodLoading } = useTopProducts(dateRange);
  const { data: bizTypes, loading: bizLoading } = useBusinessTypeBreakdown(dateRange);
  const { data: bizTrend, loading: bizTrendLoading } = useBusinessTypeTrend(dateRange);
  const { data: repairs, loading: repairLoading } = useRepairIntelligence(dateRange, 25);

  // ── Pricing Opportunity data ───────────────────────────────────────────────
  const { data: marginBands, loading: mbLoading } = useMarginBands(dateRange);
  const { data: discountBuckets, loading: dbLoading } = useDiscountBuckets(dateRange);
  const { data: pricingItems, loading: piLoading } = usePricingOpportunity(dateRange, 60);

  // ── Discount Compliance data ───────────────────────────────────────────────
  const { data: complianceCust, loading: ccLoading } = useDiscountComplianceByCustomer(dateRange, 50);
  const { data: complianceFam, loading: cfLoading } = useDiscountComplianceByFamily(dateRange);
  const { data: scheduleGrid, loading: sgLoading } = useDiscountScheduleSummary(dateRange);

  // ── Location Overrides data ────────────────────────────────────────────────
  const { data: locationOverrides, loading: locLoading } = useLocationOverrides(dateRange);

  // ── Uplift Scenarios data ──────────────────────────────────────────────────
  const { data: upliftScenarios, loading: upliftLoading } = useUpliftSummary(dateRange);

  // ── Part Family Alignment data ─────────────────────────────────────────────
  const { data: partFamilies, loading: pfLoading } = usePartFamilyAlignment(dateRange, 200);

  const handleRefresh = useCallback(() => {
    setLastUpdated(new Date());
    setDateRange((r) => ({ ...r }));
  }, []);

  const barData = categories.map((c) => ({
    label: c.category,
    value: c.revenue,
    secondary: c.cost,
  }));

  const trendData = monthly.map((m) => ({
    label: m.month,
    revenue: m.revenue,
    cost: m.cost,
    profit: m.profit,
  }));

  // Pricing KPIs derived from margin bands
  const atRiskRevenue = marginBands
    .filter((b) => ['Below Cost (<0%)', 'Negative / Zero', '0% – 10%', '10% – 20%', '20% – 30%'].includes(b.band))
    .reduce((s, b) => s + Math.max(b.revenue, 0), 0);
  const totalRevenue = marginBands.reduce((s, b) => s + Math.max(b.revenue, 0), 0);
  const atRiskPct = totalRevenue > 0 ? (atRiskRevenue / totalRevenue) * 100 : 0;
  const totalUplift = pricingItems.filter((p) => p.opportunity_flag !== 'OK').reduce((s, p) => s + p.uplift_revenue, 0);
  const totalDiscGap = complianceCust.reduce((s, c) => s + c.revenue_gap, 0);
  const totalLocGap = locationOverrides.reduce((s, l) => s + l.revenue_gap, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        dateRange={dateRange}
        onDateChange={setDateRange}
        onRefresh={handleRefresh}
        lastUpdated={lastUpdated}
      />

      {/* Tab navigation */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-6">
          <div className="flex gap-0 overflow-x-auto scrollbar-hide">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                      : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <main className="max-w-screen-xl mx-auto px-6 py-8 space-y-8">

        {/* ── OVERVIEW TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Business Overview</h2>
              <p className="text-sm text-gray-400 mt-1">{dateRange.from} — {dateRange.to}</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <KPICard title="Total Revenue"  value={kpis ? fmt(kpis.total_revenue) : '—'}                icon={DollarSign}  color="blue"    loading={kpiLoading} />
              <KPICard title="Total Cost"     value={kpis ? fmt(kpis.total_cost) : '—'}                  icon={ShoppingCart} color="amber"  loading={kpiLoading} />
              <KPICard title="Gross Profit"   value={kpis ? fmt(kpis.gross_profit) : '—'}                icon={TrendingUp}  color="emerald" loading={kpiLoading} />
              <KPICard title="Gross Margin"   value={kpis ? `${kpis.gross_margin_pct.toFixed(1)}%` : '—'} icon={Percent}    color="cyan"    loading={kpiLoading} />
              <KPICard title="Unique Orders"  value={kpis ? kpis.total_orders.toLocaleString() : '—'}    icon={Package}     color="slate"   loading={kpiLoading} />
              <KPICard title="Invoices"       value={kpis ? kpis.total_invoices.toLocaleString() : '—'}  icon={Users}       color="rose"    loading={kpiLoading} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <BusinessMixPanel data={bizTypes} loading={bizLoading} />
              <BusinessTrendChart data={bizTrend} height={280} loading={bizTrendLoading} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <BarChart
                data={barData}
                title="Revenue by Product Category"
                subtitle="Blue = Revenue · Gray = Cost · Top 15"
                height={240}
                primaryColor="#2563eb"
                secondaryColor="#cbd5e1"
                loading={catLoading}
              />
              <LineChart
                data={trendData}
                title="Monthly Revenue & Profit Trend"
                subtitle="Revenue vs cost vs profit over time"
                height={240}
                loading={monthlyLoading}
              />
            </div>

            <RepairIntelligenceTable data={repairs} loading={repairLoading} />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <TopCustomersTable data={customers} loading={custLoading} />
              <TopProductsTable data={products} loading={prodLoading} />
            </div>
          </>
        )}

        {/* ── PRICING OPPORTUNITY TAB ──────────────────────────────────────── */}
        {activeTab === 'pricing' && (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Pricing Opportunity</h2>
                <p className="text-sm text-gray-400 mt-1">
                  Margin band distribution, discount depth, and item-level opportunities — 30% margin target
                </p>
              </div>
              <div className="flex gap-3">
                {atRiskRevenue > 0 && (
                  <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2 text-center">
                    <div className="text-sm font-bold text-red-700">{fmt(atRiskRevenue)}</div>
                    <div className="text-xs text-red-500">below 30% margin ({atRiskPct.toFixed(1)}%)</div>
                  </div>
                )}
                {totalUplift > 0 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-2 text-center">
                    <div className="text-sm font-bold text-amber-700">{fmt(totalUplift)}</div>
                    <div className="text-xs text-amber-500">uplift to 30% floor</div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <MarginBandChart data={marginBands} loading={mbLoading} />
              <DiscountDepthChart data={discountBuckets} loading={dbLoading} />
            </div>

            <PricingOpportunityTable data={pricingItems} loading={piLoading} />
          </>
        )}

        {/* ── DISCOUNT COMPLIANCE TAB ──────────────────────────────────────── */}
        {activeTab === 'compliance' && (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Discount Schedule Compliance</h2>
                <p className="text-sm text-gray-400 mt-1">
                  Actual discounts vs customer entitlements by customer type × product family
                </p>
              </div>
              {totalDiscGap > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2 text-center">
                  <div className="text-sm font-bold text-red-700">{fmt(totalDiscGap)}</div>
                  <div className="text-xs text-red-500">total revenue gap vs schedule</div>
                </div>
              )}
            </div>

            <DiscountComplianceTable
              customers={complianceCust}
              families={complianceFam}
              schedule={scheduleGrid}
              loading={ccLoading || cfLoading || sgLoading}
            />
          </>
        )}

        {/* ── OE / AM / MG FAMILIES TAB ───────────────────────────────────── */}
        {activeTab === 'families' && (
          <>
            <div>
              <h2 className="text-xl font-bold text-gray-900">OE / AM / MG Part Family Alignment</h2>
              <p className="text-sm text-gray-400 mt-1">
                Price relationships within part families — OE is the anchor; AM and MG should price at or below OE list.
                Part numbers parsed by suffix (e.g. GCS-RPR-<strong>OE</strong>).
              </p>
            </div>
            <PartFamilyTable data={partFamilies} loading={pfLoading} />
          </>
        )}

        {/* ── LOCATION OVERRIDES TAB ──────────────────────────────────────── */}
        {activeTab === 'locations' && (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Location Override Analysis</h2>
                <p className="text-sm text-gray-400 mt-1">
                  How much each location discounts below list price — override rate = % of lines sold below list
                </p>
              </div>
              {totalLocGap > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2 text-center">
                  <div className="text-sm font-bold text-red-700">{fmt(totalLocGap)}</div>
                  <div className="text-xs text-red-500">total gap vs list across all locations</div>
                </div>
              )}
            </div>
            <LocationOverrideTable data={locationOverrides} loading={locLoading} />
          </>
        )}

        {/* ── UPLIFT SCENARIOS TAB ─────────────────────────────────────────── */}
        {activeTab === 'uplift' && (
          <>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Pricing Uplift Scenarios</h2>
              <p className="text-sm text-gray-400 mt-1">
                What-if profit modelling — incremental profit available by enforcing a 30% gross margin floor
                and capping excess discounts
              </p>
            </div>
            <UpliftSummaryPanel data={upliftScenarios} loading={upliftLoading} />
          </>
        )}

      </main>
    </div>
  );
}
