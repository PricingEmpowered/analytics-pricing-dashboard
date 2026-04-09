import type { UpliftScenario } from '../types';
import { TrendingUp, Target, Zap } from 'lucide-react';

interface Props {
  data: UpliftScenario[];
  loading?: boolean;
}

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

const SCENARIO_META: Record<string, { icon: typeof TrendingUp; color: string; bg: string; border: string; desc: string }> = {
  'Baseline': {
    icon: Target,
    color: 'text-gray-700',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    desc: 'Current state — actual revenue and profit',
  },
  'A: Price to 30% Floor (Full Volume)': {
    icon: TrendingUp,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    desc: 'Raise all sub-30% margin lines to 30% — assumes no volume loss',
  },
  'B: Price to 30% Floor (−10% Volume)': {
    icon: TrendingUp,
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    desc: 'Same as A but models 10% volume loss on affected lines (conservative)',
  },
  'C: Cap Discounts at 30% Off List': {
    icon: Zap,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    desc: 'Bring all lines discounted >30% off list back to 30% off — targets discount discipline',
  },
};

export default function UpliftSummaryPanel({ data, loading }: Props) {
  const baseline = data.find((d) => d.scenario === 'Baseline');

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-pulse">
            <div className="h-4 w-32 bg-gray-100 rounded mb-3" />
            <div className="h-8 w-24 bg-gray-100 rounded mb-2" />
            <div className="h-3 w-40 bg-gray-50 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-gray-400 text-sm">
        No uplift scenario data available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4">
        <h3 className="text-base font-bold text-gray-900">Pricing Uplift Scenarios</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Incremental profit available by closing margin gaps — target: 30% gross margin floor
        </p>
      </div>

      {/* Scenario cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {data.map((scenario) => {
          const meta = SCENARIO_META[scenario.scenario] ?? {
            icon: TrendingUp,
            color: 'text-gray-700',
            bg: 'bg-gray-50',
            border: 'border-gray-200',
            desc: '',
          };
          const Icon = meta.icon;
          const isBaseline = scenario.scenario === 'Baseline';
          const upliftPct = baseline && baseline.current_profit > 0
            ? ((scenario.incremental_profit / baseline.current_profit) * 100)
            : 0;

          return (
            <div key={scenario.scenario} className={`rounded-2xl border ${meta.border} ${meta.bg} p-5`}>
              <div className="flex items-start justify-between mb-3">
                <Icon className={`w-5 h-5 ${meta.color}`} />
                {!isBaseline && scenario.incremental_profit > 0 && (
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                    +{upliftPct.toFixed(1)}% profit
                  </span>
                )}
              </div>

              <div className="text-xs font-semibold text-gray-500 mb-1 leading-tight">
                {isBaseline ? 'Current State' : scenario.scenario.replace(/^[A-C]: /, '')}
              </div>

              {isBaseline ? (
                <>
                  <div className="text-2xl font-bold text-gray-900">{fmt(scenario.current_profit)}</div>
                  <div className="text-xs text-gray-500 mt-0.5">gross profit @ {scenario.current_margin.toFixed(1)}% margin</div>
                  <div className="text-xs text-gray-400 mt-2">{fmt(scenario.current_revenue)} revenue</div>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold text-emerald-700">+{fmt(scenario.incremental_profit)}</div>
                  <div className="text-xs text-gray-500 mt-0.5">incremental profit</div>
                  <div className="mt-3 pt-3 border-t border-current/10 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">New profit</span>
                      <span className="font-semibold text-gray-800">{fmt(scenario.uplift_profit)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">New margin</span>
                      <span className={`font-semibold ${scenario.new_margin >= 30 ? 'text-emerald-700' : 'text-amber-600'}`}>
                        {scenario.new_margin.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </>
              )}

              <p className="text-xs text-gray-400 mt-3 leading-relaxed">{meta.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Target margin indicator */}
      {baseline && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-gray-700">Current Margin vs 30% Target</div>
            <div className={`text-sm font-bold ${baseline.current_margin >= 30 ? 'text-emerald-600' : 'text-red-600'}`}>
              {baseline.current_margin.toFixed(1)}% / 30.0%
            </div>
          </div>
          <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`absolute left-0 top-0 h-full rounded-full transition-all ${baseline.current_margin >= 30 ? 'bg-emerald-500' : 'bg-red-400'}`}
              style={{ width: `${Math.min((baseline.current_margin / 50) * 100, 100)}%` }}
            />
            {/* 30% target line */}
            <div
              className="absolute top-0 h-full w-0.5 bg-gray-800 opacity-40"
              style={{ left: `${(30 / 50) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>0%</span>
            <span className="font-semibold text-gray-600">← 30% Target</span>
            <span>50%</span>
          </div>
        </div>
      )}
    </div>
  );
}
