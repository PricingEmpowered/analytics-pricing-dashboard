import { type LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  subValue?: string;
  icon: LucideIcon;
  trend?: number;
  color: 'blue' | 'emerald' | 'amber' | 'rose' | 'slate' | 'cyan';
  loading?: boolean;
}

const colorMap = {
  blue: { bg: 'bg-blue-50', icon: 'bg-blue-100 text-blue-600', value: 'text-blue-700', border: 'border-blue-100' },
  emerald: { bg: 'bg-emerald-50', icon: 'bg-emerald-100 text-emerald-600', value: 'text-emerald-700', border: 'border-emerald-100' },
  amber: { bg: 'bg-amber-50', icon: 'bg-amber-100 text-amber-600', value: 'text-amber-700', border: 'border-amber-100' },
  rose: { bg: 'bg-rose-50', icon: 'bg-rose-100 text-rose-600', value: 'text-rose-700', border: 'border-rose-100' },
  slate: { bg: 'bg-slate-50', icon: 'bg-slate-100 text-slate-600', value: 'text-slate-700', border: 'border-slate-100' },
  cyan: { bg: 'bg-cyan-50', icon: 'bg-cyan-100 text-cyan-600', value: 'text-cyan-700', border: 'border-cyan-100' },
};

export default function KPICard({ title, value, subValue, icon: Icon, trend, color, loading }: KPICardProps) {
  const c = colorMap[color];

  if (loading) {
    return (
      <div className={`rounded-2xl border ${c.border} ${c.bg} p-6 animate-pulse`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="h-3 w-24 bg-gray-200 rounded mb-3" />
            <div className="h-8 w-32 bg-gray-200 rounded mb-2" />
            <div className="h-3 w-20 bg-gray-200 rounded" />
          </div>
          <div className={`w-12 h-12 rounded-xl ${c.icon} opacity-50`} />
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border ${c.border} ${c.bg} p-6 transition-transform hover:-translate-y-0.5 hover:shadow-md`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">{title}</p>
          <p className={`text-3xl font-bold ${c.value} leading-none mb-1`}>{value}</p>
          {subValue && <p className="text-xs text-gray-500 mt-1">{subValue}</p>}
          {trend !== undefined && (
            <div className={`inline-flex items-center gap-1 mt-2 text-xs font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              <span>{trend >= 0 ? '▲' : '▼'}</span>
              <span>{Math.abs(trend).toFixed(1)}% vs prior</span>
            </div>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl ${c.icon} flex items-center justify-center flex-shrink-0 ml-4`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}
