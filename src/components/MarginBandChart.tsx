import type { MarginBandSummary } from '../types';
import { AlertTriangle, TrendingDown, CheckCircle } from 'lucide-react';

interface Props {
  data: MarginBandSummary[];
  loading?: boolean;
}

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

const BAND_COLORS: Record<string, string> = {
  'Below Cost (<0%)': 'bg-red-500',
  'Negative / Zero':  'bg-red-300',
  '0% – 10%':        'bg-orange-400',
  '10% – 20%':       'bg-amber-400',
  '20% – 30%':       'bg-yellow-400',
  '30% – 40%':       'bg-emerald-400',
  '40%+':            'bg-emerald-600',
};

const BAND_TEXT: Record<string, string> = {
  'Below Cost (<0%)': 'text-red-700',
  'Negative / Zero':  'text-red-500',
  '0% – 10%':        'text-orange-700',
  '10% – 20%':       'text-amber-700',
  '20% – 30%':       'text-yellow-700',
  '30% – 40%':       'text-emerald-700',
  '40%+':            'text-emerald-800',
};

function BandIcon({ band }: { band: string }) {
  if (band.includes('Below') || band.includes('Negative'))
    return <AlertTriangle className="w-4 h-4 text-red-500" />;
  if (band.includes('0%') || band.includes('10%'))
    return <TrendingDown className="w-4 h-4 text-orange-500" />;
  return <CheckCircle className="w-4 h-4 text-emerald-500" />;
}

export default function MarginBandChart({ data, loading }: Props) {
  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="h-5 w-48 bg-gray-100 rounded animate-pulse mb-1" />
        <div className="h-4 w-64 bg-gray-50 rounded animate-pulse mb-6" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 mb-3">
            <div className="w-28 h-4 bg-gray-100 rounded animate-pulse" />
            <div className="flex-1 h-7 bg-gray-100 rounded animate-pulse" />
            <div className="w-20 h-4 bg-gray-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  // Compute totals for opportunity summary
  const atRisk = data.filter((d) => d.band === 'Below Cost (<0%)' || d.band === '0% – 10%' || d.band === 'Negative / Zero');
  const atRiskRevenue = atRisk.reduce((s, d) => s + d.revenue, 0);
  const totalRevenue = data.reduce((s, d) => s + Math.max(d.revenue, 0), 0);
  const atRiskPct = totalRevenue > 0 ? (atRiskRevenue / totalRevenue) * 100 : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-base font-bold text-gray-900">Margin Band Distribution</h3>
          <p className="text-xs text-gray-400 mt-0.5">Revenue bucketed by gross margin % per line item</p>
        </div>
        {atRiskRevenue > 0 && (
          <div className="flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            <span className="text-xs font-semibold text-red-700">
              {fmt(atRiskRevenue)} at risk ({atRiskPct.toFixed(1)}%)
            </span>
          </div>
        )}
      </div>

      <div className="mt-5 space-y-2.5">
        {data.map((row) => {
          const barPct = (Math.max(row.revenue, 0) / maxRevenue) * 100;
          const barColor = BAND_COLORS[row.band] ?? 'bg-gray-300';
          const textColor = BAND_TEXT[row.band] ?? 'text-gray-700';
          return (
            <div key={row.band} className="flex items-center gap-3 group">
              <div className="w-36 flex items-center gap-1.5 shrink-0">
                <BandIcon band={row.band} />
                <span className={`text-xs font-medium ${textColor} truncate`}>{row.band}</span>
              </div>
              <div className="flex-1 relative h-7 bg-gray-50 rounded overflow-hidden">
                <div
                  className={`absolute left-0 top-0 h-full ${barColor} opacity-80 rounded transition-all duration-500`}
                  style={{ width: `${barPct}%` }}
                />
                <div className="absolute inset-0 flex items-center px-2 gap-3">
                  <span className="text-xs font-bold text-gray-800 relative z-10">{fmt(row.revenue)}</span>
                  <span className="text-xs text-gray-500 relative z-10">{row.pct_of_revenue.toFixed(1)}% of rev</span>
                  <span className="text-xs text-gray-400 relative z-10 ml-auto">{row.order_count.toLocaleString()} orders</span>
                </div>
              </div>
              <div className="w-20 text-right shrink-0">
                <span className="text-xs font-semibold text-gray-700">{fmt(row.gross_profit)}</span>
                <div className="text-xs text-gray-400">profit</div>
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
