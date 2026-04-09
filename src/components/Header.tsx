import { BarChart2, Calendar, RefreshCw } from 'lucide-react';
import type { DateRange } from '../types';

interface Props {
  dateRange: DateRange;
  onDateChange: (range: DateRange) => void;
  onRefresh: () => void;
  lastUpdated: Date | null;
}

const PRESETS = [
  { label: 'YTD', from: `${new Date().getFullYear()}-01-01`, to: new Date().toISOString().slice(0, 10) },
  { label: '12M', from: new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) },
  { label: '6M', from: new Date(Date.now() - 182 * 86400000).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) },
  { label: '3M', from: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) },
  { label: '30D', from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) },
];

export default function Header({ dateRange, onDateChange, onRefresh, lastUpdated }: Props) {
  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
      <div className="max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
            <BarChart2 size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-none">Business Analytics</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Sprint Dashboard'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1">
            {PRESETS.map((p) => {
              const active = p.from === dateRange.from && p.to === dateRange.to;
              return (
                <button
                  key={p.label}
                  onClick={() => onDateChange({ from: p.from, to: p.to })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    active ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 bg-gray-50 rounded-xl px-3 py-2">
            <Calendar size={13} className="text-gray-400" />
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => onDateChange({ ...dateRange, from: e.target.value })}
              className="bg-transparent text-xs text-gray-600 outline-none w-28"
            />
            <span className="text-gray-300 text-xs">—</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => onDateChange({ ...dateRange, to: e.target.value })}
              className="bg-transparent text-xs text-gray-600 outline-none w-28"
            />
          </div>

          <button
            onClick={onRefresh}
            className="w-9 h-9 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors"
            title="Refresh data"
          >
            <RefreshCw size={14} className="text-gray-500" />
          </button>
        </div>
      </div>
    </header>
  );
}
