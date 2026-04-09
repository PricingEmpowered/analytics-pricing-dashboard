import { Wrench, Package, HardHat, LayoutGrid } from 'lucide-react';
import type { BusinessTypeSummary } from '../types';

interface Props {
  data: BusinessTypeSummary[];
  loading?: boolean;
}

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

const TYPE_CONFIG: Record<string, { icon: typeof Wrench; color: string; bg: string; border: string }> = {
  'Repairs & Service':  { icon: Wrench,      color: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-200' },
  'Parts & Products':   { icon: Package,     color: 'text-blue-600',   bg: 'bg-blue-50',     border: 'border-blue-200'   },
  'Labor & Projects':   { icon: HardHat,     color: 'text-amber-600',  bg: 'bg-amber-50',    border: 'border-amber-200'  },
  'Parts Kits':         { icon: LayoutGrid,  color: 'text-cyan-600',   bg: 'bg-cyan-50',     border: 'border-cyan-200'   },
};

const FALLBACK = { icon: Package, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' };

function MarginBar({ pct }: { pct: number }) {
  const color = pct >= 60 ? 'bg-emerald-500' : pct >= 40 ? 'bg-blue-500' : pct >= 25 ? 'bg-amber-400' : 'bg-rose-400';
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
      <div className={`h-1.5 rounded-full ${color} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

export default function BusinessMixPanel({ data, loading }: Props) {
  const total = data.reduce((s, d) => s + d.revenue, 0);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse">
        <div className="h-4 w-40 bg-gray-200 rounded mb-2" />
        <div className="h-3 w-28 bg-gray-100 rounded mb-6" />
        <div className="grid grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-gray-100 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-gray-900">Revenue Mix</h3>
        <p className="text-xs text-gray-400 mt-0.5">Business type breakdown — total {fmt(total)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {data.map((d) => {
          const cfg = TYPE_CONFIG[d.business_type] ?? FALLBACK;
          const Icon = cfg.icon;
          const share = total > 0 ? (d.revenue / total) * 100 : 0;
          return (
            <div key={d.business_type} className={`rounded-xl border p-4 ${cfg.bg} ${cfg.border}`}>
              <div className="flex items-start justify-between mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cfg.bg}`}>
                  <Icon size={15} className={cfg.color} />
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                  {d.margin_pct.toFixed(1)}%
                </span>
              </div>
              <p className="text-xs text-gray-500 leading-tight mb-0.5">{d.business_type}</p>
              <p className="text-base font-bold text-gray-900">{fmt(d.revenue)}</p>
              <MarginBar pct={d.margin_pct} />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400">{share.toFixed(1)}% of revenue</span>
                <span className="text-xs text-gray-400">{d.order_count.toLocaleString()} orders</span>
              </div>
            </div>
          );
        })}
      </div>

      {data.length === 0 && (
        <div className="flex items-center justify-center text-gray-300 text-sm h-32">
          No data available
        </div>
      )}
    </div>
  );
}
