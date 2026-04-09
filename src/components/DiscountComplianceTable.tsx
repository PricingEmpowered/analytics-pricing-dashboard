import { useState } from 'react';
import type { DiscountComplianceCustomer, DiscountComplianceFamily, DiscountScheduleSummary } from '../types';
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Users, Package } from 'lucide-react';

interface Props {
  customers: DiscountComplianceCustomer[];
  families: DiscountComplianceFamily[];
  schedule: DiscountScheduleSummary[];
  loading?: boolean;
}

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function FlagBadge({ flag }: { flag: string }) {
  const cfg: Record<string, string> = {
    'Over-Discounted':    'bg-red-50 text-red-700 border-red-200',
    'On Schedule':        'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Under-Discounted':   'bg-blue-50 text-blue-700 border-blue-200',
    'No Schedule':        'bg-gray-50 text-gray-500 border-gray-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg[flag] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
      {flag === 'Over-Discounted' && <AlertTriangle className="w-3 h-3" />}
      {flag === 'On Schedule' && <CheckCircle className="w-3 h-3" />}
      {flag}
    </span>
  );
}

function ExcessBar({ excess, entitled }: { excess: number; entitled: number }) {
  if (entitled <= 0) return <span className="text-xs text-gray-400">—</span>;
  const pct = Math.min(Math.abs(excess) / Math.max(entitled, 1) * 100, 100);
  const isOver = excess > 0;
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${isOver ? 'bg-red-400' : 'bg-blue-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-semibold ${isOver ? 'text-red-600' : excess < 0 ? 'text-blue-600' : 'text-gray-500'}`}>
        {excess > 0 ? '+' : ''}{excess.toFixed(1)}%
      </span>
    </div>
  );
}

type Tab = 'customers' | 'families' | 'schedule';

export default function DiscountComplianceTable({ customers, families, schedule, loading }: Props) {
  const [tab, setTab] = useState<Tab>('customers');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [sortKey, setSortKey] = useState<string>('revenue_gap');

  const totalGap = customers.reduce((s, c) => s + c.revenue_gap, 0);
  const overCount = customers.filter((c) => c.compliance_flag === 'Over-Discounted').length;

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  }

  function SortIcon({ k }: { k: string }) {
    if (sortKey !== k) return null;
    return sortDir === 'desc' ? <ChevronDown className="w-3 h-3 inline ml-0.5" /> : <ChevronUp className="w-3 h-3 inline ml-0.5" />;
  }

  const sortedCustomers = [...customers].sort((a, b) => {
    const av = (a as Record<string, unknown>)[sortKey] as number ?? 0;
    const bv = (b as Record<string, unknown>)[sortKey] as number ?? 0;
    return sortDir === 'desc' ? bv - av : av - bv;
  });

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="h-5 w-64 bg-gray-100 rounded animate-pulse mb-6" />
        {[...Array(8)].map((_, i) => (
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
            <h3 className="text-base font-bold text-gray-900">Discount Schedule Compliance</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Actual discounts vs entitlements by customer type × product family
            </p>
          </div>
          {totalGap > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <div>
                <div className="text-xs font-bold text-red-700">{fmt(totalGap)} revenue gap</div>
                <div className="text-xs text-red-500">{overCount} over-discounted customers</div>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {([['customers', 'By Customer', Users], ['families', 'By Product Family', Package], ['schedule', 'Schedule Grid', Package]] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key as Tab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                tab === key ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Customer tab */}
      {tab === 'customers' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left font-semibold">Customer</th>
                <th className="px-4 py-3 text-left font-semibold">Type</th>
                <th className="px-4 py-3 text-right font-semibold cursor-pointer hover:text-gray-800" onClick={() => toggleSort('revenue')}>Revenue <SortIcon k="revenue" /></th>
                <th className="px-4 py-3 text-right font-semibold">Margin</th>
                <th className="px-4 py-3 text-right font-semibold">Entitled Disc.</th>
                <th className="px-4 py-3 text-right font-semibold">Actual Disc.</th>
                <th className="px-4 py-3 text-center font-semibold">Excess</th>
                <th className="px-4 py-3 text-right font-semibold cursor-pointer hover:text-gray-800" onClick={() => toggleSort('revenue_gap')}>Rev. Gap <SortIcon k="revenue_gap" /></th>
                <th className="px-4 py-3 text-center font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedCustomers.map((c) => (
                <tr key={c.customer_number} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 text-xs truncate max-w-[180px]">{c.company_name}</div>
                    <div className="text-xs text-gray-400">{c.customer_number}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{c.cust_type || '—'}</td>
                  <td className="px-4 py-3 text-right text-xs font-semibold text-gray-800">{fmt(c.revenue)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-xs font-semibold ${c.margin_pct < 30 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {c.margin_pct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-600">
                    {c.entitled_discount > 0 ? `${c.entitled_discount.toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-800 font-medium">
                    {c.actual_discount > 0 ? `${c.actual_discount.toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <ExcessBar excess={c.excess_discount} entitled={c.entitled_discount} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.revenue_gap > 0 ? (
                      <span className="text-xs font-bold text-red-600">{fmt(c.revenue_gap)}</span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <FlagBadge flag={c.compliance_flag} />
                  </td>
                </tr>
              ))}
              {sortedCustomers.length === 0 && (
                <tr><td colSpan={9} className="text-center py-10 text-gray-400 text-sm">No data for selected period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Families tab */}
      {tab === 'families' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left font-semibold">Product Family</th>
                <th className="px-4 py-3 text-right font-semibold">Revenue</th>
                <th className="px-4 py-3 text-right font-semibold">Margin</th>
                <th className="px-4 py-3 text-right font-semibold">Entitled Disc.</th>
                <th className="px-4 py-3 text-right font-semibold">Actual Disc.</th>
                <th className="px-4 py-3 text-center font-semibold">Excess</th>
                <th className="px-4 py-3 text-right font-semibold">Rev. Gap</th>
                <th className="px-4 py-3 text-right font-semibold">Customers</th>
                <th className="px-4 py-3 text-center font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {families.map((f) => (
                <tr key={f.product_family} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 text-xs">{f.product_family}</td>
                  <td className="px-4 py-3 text-right text-xs font-semibold text-gray-800">{fmt(f.revenue)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-xs font-semibold ${f.margin_pct < 30 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {f.margin_pct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-600">
                    {f.entitled_discount > 0 ? `${f.entitled_discount.toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-medium text-gray-800">
                    {f.actual_discount > 0 ? `${f.actual_discount.toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <ExcessBar excess={f.excess_discount} entitled={f.entitled_discount} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {f.revenue_gap > 0 ? (
                      <span className="text-xs font-bold text-red-600">{fmt(f.revenue_gap)}</span>
                    ) : <span className="text-xs text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-600">{f.customer_count}</td>
                  <td className="px-4 py-3 text-center"><FlagBadge flag={f.compliance_flag} /></td>
                </tr>
              ))}
              {families.length === 0 && (
                <tr><td colSpan={9} className="text-center py-10 text-gray-400 text-sm">No data for selected period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Schedule grid tab */}
      {tab === 'schedule' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left font-semibold">Cust. Type</th>
                <th className="px-4 py-3 text-left font-semibold">Product Family</th>
                <th className="px-4 py-3 text-right font-semibold">Entitled</th>
                <th className="px-4 py-3 text-right font-semibold">Actual</th>
                <th className="px-4 py-3 text-center font-semibold">Excess</th>
                <th className="px-4 py-3 text-right font-semibold">Revenue</th>
                <th className="px-4 py-3 text-right font-semibold">Margin</th>
                <th className="px-4 py-3 text-right font-semibold">Customers</th>
                <th className="px-4 py-3 text-right font-semibold">Rev. Gap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {schedule.map((s, i) => (
                <tr key={i} className={`hover:bg-gray-50 transition-colors ${s.excess_discount > 2 ? 'bg-red-50/30' : ''}`}>
                  <td className="px-4 py-3 text-xs font-semibold text-gray-700">{s.cust_type}</td>
                  <td className="px-4 py-3 text-xs text-gray-700">{s.product_family}</td>
                  <td className="px-4 py-3 text-right text-xs text-gray-600">
                    {s.entitled_discount > 0 ? `${s.entitled_discount.toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-medium text-gray-800">
                    {s.actual_discount > 0 ? `${s.actual_discount.toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <ExcessBar excess={s.excess_discount} entitled={s.entitled_discount} />
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-semibold text-gray-800">{fmt(s.revenue)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-xs font-semibold ${s.margin_pct < 30 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {s.margin_pct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-600">{s.customer_count}</td>
                  <td className="px-4 py-3 text-right">
                    {s.revenue_gap > 0 ? (
                      <span className="text-xs font-bold text-red-600">{fmt(s.revenue_gap)}</span>
                    ) : <span className="text-xs text-gray-400">—</span>}
                  </td>
                </tr>
              ))}
              {schedule.length === 0 && (
                <tr><td colSpan={9} className="text-center py-10 text-gray-400 text-sm">No data for selected period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
