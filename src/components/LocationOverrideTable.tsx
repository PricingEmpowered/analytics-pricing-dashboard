import type { LocationOverride } from '../types';
import { MapPin, AlertTriangle, TrendingDown } from 'lucide-react';

interface Props {
  data: LocationOverride[];
  loading?: boolean;
}

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function OverrideBar({ rate }: { rate: number }) {
  const color = rate > 60 ? 'bg-red-500' : rate > 40 ? 'bg-orange-400' : rate > 20 ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.min(rate, 100)}%` }} />
      </div>
      <span className={`text-xs font-semibold ${rate > 60 ? 'text-red-600' : rate > 40 ? 'text-orange-600' : rate > 20 ? 'text-amber-600' : 'text-emerald-600'}`}>
        {rate.toFixed(1)}%
      </span>
    </div>
  );
}

export default function LocationOverrideTable({ data, loading }: Props) {
  const totalGap = data.reduce((s, d) => s + d.revenue_gap, 0);
  const worstLocation = data.reduce((best, d) => d.revenue_gap > (best?.revenue_gap ?? 0) ? d : best, data[0]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="h-5 w-56 bg-gray-100 rounded animate-pulse mb-6" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-50 rounded animate-pulse mb-2" />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 pt-6 pb-4 border-b border-gray-50">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900">Location Override Analysis</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              How much revenue each location discounts below list price — override rate = % of lines sold below list
            </p>
          </div>
          <div className="flex gap-3">
            {totalGap > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2 text-center">
                <div className="text-xs font-bold text-red-700">{fmt(totalGap)}</div>
                <div className="text-xs text-red-500">total gap vs list</div>
              </div>
            )}
            {worstLocation && (
              <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-2 text-center">
                <div className="text-xs font-bold text-orange-700 truncate max-w-[120px]">{worstLocation.location}</div>
                <div className="text-xs text-orange-500">highest gap location</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3 text-left font-semibold">Location</th>
              <th className="px-4 py-3 text-right font-semibold">Revenue</th>
              <th className="px-4 py-3 text-right font-semibold">Margin</th>
              <th className="px-4 py-3 text-right font-semibold">List Revenue</th>
              <th className="px-4 py-3 text-right font-semibold">Gap vs List</th>
              <th className="px-4 py-3 text-left font-semibold">Override Rate</th>
              <th className="px-4 py-3 text-right font-semibold">Orders</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.map((row) => (
              <tr key={row.location} className={`hover:bg-gray-50 transition-colors ${row.override_rate > 60 ? 'bg-red-50/20' : ''}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="text-xs font-semibold text-gray-800">{row.location}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-xs font-semibold text-gray-800">{fmt(row.revenue)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`text-xs font-semibold ${row.margin_pct < 30 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {row.margin_pct.toFixed(1)}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-xs text-gray-600">{fmt(row.list_revenue)}</td>
                <td className="px-4 py-3 text-right">
                  {row.revenue_gap > 0 ? (
                    <div className="flex items-center justify-end gap-1">
                      <TrendingDown className="w-3 h-3 text-red-400" />
                      <span className="text-xs font-bold text-red-600">{fmt(row.revenue_gap)}</span>
                    </div>
                  ) : <span className="text-xs text-gray-400">—</span>}
                </td>
                <td className="px-4 py-3"><OverrideBar rate={row.override_rate} /></td>
                <td className="px-4 py-3 text-right text-xs text-gray-500">{row.order_count.toLocaleString()}</td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-10">
                  <AlertTriangle className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No location data available</p>
                  <p className="text-xs text-gray-300 mt-1">Ensure the location table is populated</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
