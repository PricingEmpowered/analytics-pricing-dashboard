import { useState } from 'react';
import type { PricingOpportunityItem } from '../types';
import { AlertTriangle, TrendingDown, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  data: PricingOpportunityItem[];
  loading?: boolean;
}

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

const FLAG_CONFIG: Record<string, { label: string; cls: string; icon: typeof AlertTriangle }> = {
  'Below Cost':    { label: 'Below Cost',    cls: 'bg-red-50 text-red-700 border-red-200',      icon: AlertTriangle },
  'Below Target':  { label: 'Below Target',  cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: TrendingDown },
  'High Discount': { label: 'High Discount', cls: 'bg-orange-50 text-orange-700 border-orange-200', icon: TrendingDown },
  'OK':            { label: 'OK',            cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle },
};

const PART_TYPE_STYLE: Record<string, string> = {
  OE:    'bg-blue-100 text-blue-800',
  AM:    'bg-amber-100 text-amber-800',
  MG:    'bg-purple-100 text-purple-800',
  OTHER: 'bg-gray-100 text-gray-600',
};

function MarginCell({ pct }: { pct: number }) {
  const color = pct < 0 ? 'text-red-600' : pct < 30 ? 'text-amber-600' : 'text-emerald-600';
  const bg = pct < 0 ? 'bg-red-100' : pct < 30 ? 'bg-amber-100' : 'bg-emerald-100';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${color} ${bg}`}>
      {pct.toFixed(1)}%
    </span>
  );
}

type SortKey = keyof PricingOpportunityItem;

export default function PricingOpportunityTable({ data, loading }: Props) {
  const [filterFlag, setFilterFlag] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const flagCounts = data.reduce<Record<string, number>>((acc, r) => {
    acc[r.opportunity_flag] = (acc[r.opportunity_flag] ?? 0) + 1;
    return acc;
  }, {});

  const totalUplift = data.filter((d) => d.opportunity_flag !== 'OK').reduce((s, d) => s + d.uplift_revenue, 0);

  const filtered = data.filter((d) => filterFlag === 'all' || d.opportunity_flag === filterFlag);
  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey] as number ?? 0;
    const bv = b[sortKey] as number ?? 0;
    return sortDir === 'desc' ? bv - av : av - bv;
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="opacity-20">↕</span>;
    return sortDir === 'desc' ? <ChevronDown className="w-3 h-3 inline" /> : <ChevronUp className="w-3 h-3 inline" />;
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="h-5 w-56 bg-gray-100 rounded animate-pulse mb-6" />
        {[...Array(10)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-50 rounded animate-pulse mb-2" />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-50">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900">Item-Level Pricing Opportunity</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Per-item margin, discount, and price index — sorted by revenue. Target: 30% margin floor.
            </p>
          </div>
          {totalUplift > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-center">
              <div className="text-sm font-bold text-amber-700">${(totalUplift / 1000).toFixed(0)}K uplift</div>
              <div className="text-xs text-amber-500">to reach 30% floor</div>
            </div>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2 mt-4">
          {(['all', 'Below Cost', 'Below Target', 'High Discount', 'OK'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterFlag(f)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                filterFlag === f ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              {f === 'all' ? `All (${data.length})` : `${f} (${flagCounts[f] ?? 0})`}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3 text-left font-semibold">Item</th>
              <th className="px-4 py-3 text-left font-semibold">Family / Category</th>
              <th className="px-4 py-3 text-center font-semibold">Type</th>
              <th className="px-4 py-3 text-right font-semibold cursor-pointer hover:text-gray-800" onClick={() => toggleSort('avg_unit_price')}>
                Avg Price <SortIcon k="avg_unit_price" />
              </th>
              <th className="px-4 py-3 text-right font-semibold">Avg Cost</th>
              <th className="px-4 py-3 text-right font-semibold">List Price</th>
              <th className="px-4 py-3 text-right font-semibold cursor-pointer hover:text-gray-800" onClick={() => toggleSort('avg_discount_pct')}>
                Disc. <SortIcon k="avg_discount_pct" />
              </th>
              <th className="px-4 py-3 text-center font-semibold cursor-pointer hover:text-gray-800" onClick={() => toggleSort('margin_pct')}>
                Margin <SortIcon k="margin_pct" />
              </th>
              <th className="px-4 py-3 text-right font-semibold">Price Idx</th>
              <th className="px-4 py-3 text-right font-semibold cursor-pointer hover:text-gray-800" onClick={() => toggleSort('revenue')}>
                Revenue <SortIcon k="revenue" />
              </th>
              <th className="px-4 py-3 text-right font-semibold cursor-pointer hover:text-gray-800" onClick={() => toggleSort('uplift_revenue')}>
                Uplift <SortIcon k="uplift_revenue" />
              </th>
              <th className="px-4 py-3 text-center font-semibold">Flag</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((row) => {
              const flagCfg = FLAG_CONFIG[row.opportunity_flag] ?? FLAG_CONFIG['OK'];
              const FlagIcon = flagCfg.icon;
              return (
                <tr key={row.item_number} className={`hover:bg-gray-50 transition-colors ${row.opportunity_flag === 'Below Cost' ? 'bg-red-50/20' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono font-semibold text-gray-800">{row.item_number}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-gray-600 truncate max-w-[140px]">{row.analytical_family}</div>
                    <div className="text-xs text-gray-400 truncate max-w-[140px]">{row.product_cat_description}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${PART_TYPE_STYLE[row.part_type] ?? PART_TYPE_STYLE['OTHER']}`}>
                      {row.part_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-semibold text-gray-800">{fmt(row.avg_unit_price)}</td>
                  <td className="px-4 py-3 text-right text-xs text-gray-500">{fmt(row.avg_unit_cost)}</td>
                  <td className="px-4 py-3 text-right text-xs text-gray-500">
                    {row.list_price > 0 ? fmt(row.list_price) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.avg_discount_pct > 0 ? (
                      <span className={`text-xs font-semibold ${row.avg_discount_pct > 30 ? 'text-red-600' : 'text-gray-600'}`}>
                        {row.avg_discount_pct.toFixed(1)}%
                      </span>
                    ) : <span className="text-xs text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center"><MarginCell pct={row.margin_pct} /></td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-xs font-semibold ${row.price_index < 0.9 ? 'text-red-600' : row.price_index > 1.1 ? 'text-emerald-600' : 'text-gray-600'}`}>
                      {row.price_index.toFixed(3)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-semibold text-gray-800">{fmt(row.revenue)}</td>
                  <td className="px-4 py-3 text-right">
                    {row.uplift_revenue > 0 ? (
                      <span className="text-xs font-bold text-amber-600">{fmt(row.uplift_revenue)}</span>
                    ) : <span className="text-xs text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${flagCfg.cls}`}>
                      <FlagIcon className="w-3 h-3" />
                      {flagCfg.label}
                    </span>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr><td colSpan={12} className="text-center py-10 text-gray-400 text-sm">No items match the selected filter</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
