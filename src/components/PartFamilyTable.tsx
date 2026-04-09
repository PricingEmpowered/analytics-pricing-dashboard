import { useState } from 'react';
import type { PartFamilyRow } from '../types';
import { AlertTriangle, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react';

interface Props {
  data: PartFamilyRow[];
  loading?: boolean;
}

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

const PART_TYPE_STYLE: Record<string, string> = {
  OE:    'bg-blue-100 text-blue-800 border-blue-200',
  AM:    'bg-amber-100 text-amber-800 border-amber-200',
  MG:    'bg-purple-100 text-purple-800 border-purple-200',
  OTHER: 'bg-gray-100 text-gray-600 border-gray-200',
};

const FLAG_STYLE: Record<string, string> = {
  'AM > OE List':  'bg-orange-50 text-orange-700 border-orange-200',
  'MG > OE List':  'bg-orange-50 text-orange-700 border-orange-200',
  'Below Cost':    'bg-red-50 text-red-700 border-red-200',
  'Low Margin':    'bg-amber-50 text-amber-700 border-amber-200',
  'OK':            'bg-emerald-50 text-emerald-700 border-emerald-200',
};

function MarginBar({ pct }: { pct: number }) {
  const clamped = Math.max(Math.min(pct, 60), -5);
  const width = ((clamped + 5) / 65) * 100;
  const color = pct < 0 ? 'bg-red-500' : pct < 30 ? 'bg-amber-400' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
      </div>
      <span className={`text-xs font-semibold ${pct < 0 ? 'text-red-600' : pct < 30 ? 'text-amber-600' : 'text-emerald-600'}`}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

export default function PartFamilyTable({ data, loading }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filterFlag, setFilterFlag] = useState<string>('all');

  // Group by family_key
  const families = data.reduce<Record<string, PartFamilyRow[]>>((acc, row) => {
    if (!acc[row.family_key]) acc[row.family_key] = [];
    acc[row.family_key].push(row);
    return acc;
  }, {});

  const familyKeys = Object.keys(families).filter((fk) => {
    if (filterFlag === 'all') return true;
    return families[fk].some((r) => r.misalignment_flag === filterFlag);
  });

  const flagCounts = data.reduce<Record<string, number>>((acc, r) => {
    acc[r.misalignment_flag] = (acc[r.misalignment_flag] ?? 0) + 1;
    return acc;
  }, {});

  function toggleFamily(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="h-5 w-64 bg-gray-100 rounded animate-pulse mb-6" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-50 rounded animate-pulse mb-2" />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-50">
        <h3 className="text-base font-bold text-gray-900">OE / AM / MG Part Family Alignment</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Price relationships within part families — OE is the anchor; AM and MG should price below OE list
        </p>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2 mt-4">
          {(['all', 'AM > OE List', 'MG > OE List', 'Below Cost', 'Low Margin', 'OK'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterFlag(f)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                filterFlag === f
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              {f === 'all' ? 'All Families' : f}
              {f !== 'all' && flagCounts[f] ? ` (${flagCounts[f]})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3 text-left font-semibold w-8" />
              <th className="px-4 py-3 text-left font-semibold">Family / Item</th>
              <th className="px-4 py-3 text-center font-semibold">Type</th>
              <th className="px-4 py-3 text-right font-semibold">List Price</th>
              <th className="px-4 py-3 text-right font-semibold">Avg Sold</th>
              <th className="px-4 py-3 text-right font-semibold">Avg Cost</th>
              <th className="px-4 py-3 text-left font-semibold">Margin</th>
              <th className="px-4 py-3 text-right font-semibold">Disc. vs List</th>
              <th className="px-4 py-3 text-right font-semibold">Price Ratio</th>
              <th className="px-4 py-3 text-right font-semibold">Revenue</th>
              <th className="px-4 py-3 text-center font-semibold">Flag</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {familyKeys.map((fk) => {
              const rows = families[fk];
              const isOpen = expanded.has(fk);
              const familyRevenue = rows.reduce((s, r) => s + r.revenue, 0);
              const hasIssue = rows.some((r) => r.misalignment_flag !== 'OK');
              const oeRow = rows.find((r) => r.part_type === 'OE');

              return [
                // Family header row
                <tr
                  key={`fk-${fk}`}
                  className={`cursor-pointer transition-colors ${hasIssue ? 'bg-amber-50/40 hover:bg-amber-50' : 'hover:bg-gray-50'}`}
                  onClick={() => toggleFamily(fk)}
                >
                  <td className="px-4 py-3 text-gray-400">
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900 text-xs">{fk}</div>
                    <div className="text-xs text-gray-400">{rows.length} variant{rows.length !== 1 ? 's' : ''}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex gap-1 justify-center flex-wrap">
                      {[...new Set(rows.map((r) => r.part_type))].map((t) => (
                        <span key={t} className={`px-1.5 py-0.5 rounded text-xs font-bold border ${PART_TYPE_STYLE[t]}`}>{t}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-600">
                    {oeRow && oeRow.list_price > 0 ? fmt(oeRow.list_price) : '—'}
                  </td>
                  <td className="px-4 py-3" colSpan={5} />
                  <td className="px-4 py-3 text-right text-xs font-semibold text-gray-800">{fmt(familyRevenue)}</td>
                  <td className="px-4 py-3 text-center">
                    {hasIssue ? <AlertTriangle className="w-4 h-4 text-amber-500 mx-auto" /> : <CheckCircle className="w-4 h-4 text-emerald-400 mx-auto" />}
                  </td>
                </tr>,
                // Child rows
                ...(isOpen ? rows.map((r) => (
                  <tr key={r.item_number} className="bg-gray-50/50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5" />
                    <td className="px-4 py-2.5 pl-8">
                      <span className="text-xs font-mono text-gray-700">{r.item_number}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-bold border ${PART_TYPE_STYLE[r.part_type]}`}>{r.part_type}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-gray-700">
                      {r.list_price > 0 ? fmt(r.list_price) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-gray-700">{fmt(r.avg_sold_price)}</td>
                    <td className="px-4 py-2.5 text-right text-xs text-gray-500">{fmt(r.avg_cost)}</td>
                    <td className="px-4 py-2.5"><MarginBar pct={r.margin_pct} /></td>
                    <td className="px-4 py-2.5 text-right text-xs">
                      {r.discount_vs_list != null ? (
                        <span className={r.discount_vs_list > 30 ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                          {r.discount_vs_list.toFixed(1)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs">
                      {r.price_ratio != null ? (
                        <span className={r.price_ratio > 1 && r.part_type !== 'OE' ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                          {r.price_ratio.toFixed(3)}×
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs font-semibold text-gray-700">{fmt(r.revenue)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${FLAG_STYLE[r.misalignment_flag] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                        {r.misalignment_flag}
                      </span>
                    </td>
                  </tr>
                )) : []),
              ];
            })}
            {familyKeys.length === 0 && (
              <tr><td colSpan={11} className="text-center py-10 text-gray-400 text-sm">No family data for selected period</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
