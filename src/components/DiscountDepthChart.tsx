import type { DiscountBucket } from '../types';
import { Tag, TrendingUp, AlertTriangle } from 'lucide-react';

interface Props {
  data: DiscountBucket[];
  loading?: boolean;
}

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

const BUCKET_COLORS: Record<string, string> = {
  'Above List (Premium)': 'bg-emerald-500',
  'No List Price':        'bg-gray-300',
  '0% – 10% Off':        'bg-blue-400',
  '10% – 20% Off':       'bg-blue-500',
  '20% – 30% Off':       'bg-amber-400',
  '30% – 40% Off':       'bg-orange-500',
  '40%+ Off':            'bg-red-500',
};

const BUCKET_MARGIN_COLOR = (margin: number) => {
  if (margin < 0) return 'text-red-600';
  if (margin < 10) return 'text-orange-600';
  if (margin < 20) return 'text-amber-600';
  return 'text-emerald-600';
};

export default function DiscountDepthChart({ data, loading }: Props) {
  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="h-5 w-48 bg-gray-100 rounded animate-pulse mb-1" />
        <div className="h-4 w-64 bg-gray-50 rounded animate-pulse mb-6" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 mb-3">
            <div className="w-32 h-4 bg-gray-100 rounded animate-pulse" />
            <div className="flex-1 h-7 bg-gray-100 rounded animate-pulse" />
            <div className="w-16 h-4 bg-gray-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  const deepDiscount = data.filter((d) => d.bucket === '30% – 40% Off' || d.bucket === '40%+ Off');
  const deepRev = deepDiscount.reduce((s, d) => s + d.revenue, 0);
  const totalRev = data.reduce((s, d) => s + d.revenue, 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-base font-bold text-gray-900">Discount Depth Analysis</h3>
          <p className="text-xs text-gray-400 mt-0.5">Revenue by effective discount vs published list price</p>
        </div>
        {deepRev > 0 && (
          <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-100 rounded-lg px-3 py-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-xs font-semibold text-orange-700">
              {fmt(deepRev)} at 30%+ off ({totalRev > 0 ? ((deepRev / totalRev) * 100).toFixed(1) : 0}%)
            </span>
          </div>
        )}
      </div>

      <div className="mt-5 space-y-2.5">
        {data.map((row) => {
          const barPct = (row.revenue / maxRevenue) * 100;
          const barColor = BUCKET_COLORS[row.bucket] ?? 'bg-gray-300';
          const marginColor = BUCKET_MARGIN_COLOR(row.avg_margin_pct);
          return (
            <div key={row.bucket} className="flex items-center gap-3 group">
              <div className="w-36 flex items-center gap-1.5 shrink-0">
                {row.bucket.includes('Premium') ? (
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                ) : row.bucket.includes('No List') ? (
                  <Tag className="w-4 h-4 text-gray-400" />
                ) : (
                  <Tag className="w-4 h-4 text-blue-400" />
                )}
                <span className="text-xs font-medium text-gray-700 truncate">{row.bucket}</span>
              </div>
              <div className="flex-1 relative h-7 bg-gray-50 rounded overflow-hidden">
                <div
                  className={`absolute left-0 top-0 h-full ${barColor} opacity-75 rounded transition-all duration-500`}
                  style={{ width: `${barPct}%` }}
                />
                <div className="absolute inset-0 flex items-center px-2 gap-3">
                  <span className="text-xs font-bold text-gray-800 relative z-10">{fmt(row.revenue)}</span>
                  <span className="text-xs text-gray-500 relative z-10">{row.pct_of_revenue.toFixed(1)}%</span>
                  <span className={`text-xs font-semibold relative z-10 ml-auto ${marginColor}`}>
                    {row.avg_margin_pct.toFixed(1)}% margin
                  </span>
                </div>
              </div>
              <div className="w-20 text-right shrink-0 text-xs text-gray-400">
                {row.order_count.toLocaleString()} orders
              </div>
            </div>
          );
        })}
      </div>

      {data.length === 0 && (
        <div className="text-center py-10 text-gray-400 text-sm">No data for selected period</div>
      )}
    </div>
  );
}
