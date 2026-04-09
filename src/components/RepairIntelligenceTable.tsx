import { Wrench, AlertCircle } from 'lucide-react';
import type { RepairOrder } from '../types';

interface Props {
  data: RepairOrder[];
  loading?: boolean;
}

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function MarginBadge({ pct }: { pct: number }) {
  const cls = pct >= 65 ? 'bg-emerald-100 text-emerald-700'
    : pct >= 45 ? 'bg-blue-100 text-blue-700'
    : pct >= 25 ? 'bg-amber-100 text-amber-700'
    : 'bg-rose-100 text-rose-700';
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{pct.toFixed(1)}%</span>;
}

function LaborBar({ bom, revenue }: { bom: number; revenue: number }) {
  const partsPct = revenue > 0 ? Math.min((bom / revenue) * 100, 100) : 0;
  const laborPct = 100 - partsPct;
  return (
    <div className="flex w-full h-2 rounded-full overflow-hidden gap-px" title={`Parts ${partsPct.toFixed(0)}% · Labor ${laborPct.toFixed(0)}%`}>
      <div className="bg-blue-300 rounded-l-full transition-all" style={{ width: `${partsPct}%` }} />
      <div className="bg-emerald-400 rounded-r-full transition-all" style={{ width: `${laborPct}%` }} />
    </div>
  );
}

export default function RepairIntelligenceTable({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse">
        <div className="h-4 w-52 bg-gray-200 rounded mb-2" />
        <div className="h-3 w-40 bg-gray-100 rounded mb-6" />
        {[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-gray-100 rounded mb-2" />)}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <Wrench size={15} className="text-emerald-600" />
          <h3 className="text-sm font-semibold text-gray-900">Repair Order Intelligence</h3>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          BOM parts cost vs billed revenue — blue = parts content, green = implied labor
        </p>
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-300 inline-block" /> Parts cost (BOM)</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" /> Implied labor</span>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-300">
          <AlertCircle size={28} className="mb-2" />
          <span className="text-sm">No repair orders in range</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Order</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Type</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Billed</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">BOM Parts</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Margin</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide w-32">Content Split</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.map((r) => (
                <tr key={r.order_number} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 text-gray-500 text-xs font-mono">{r.order_number}</td>
                  <td className="px-6 py-3">
                    <p className="font-medium text-gray-900 text-sm truncate max-w-[160px]">{r.company_name || '—'}</p>
                    <p className="text-xs text-gray-400">{r.invoice_date}</p>
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{r.product_type}</span>
                  </td>
                  <td className="px-6 py-3 text-right font-semibold text-gray-800">{fmt(r.billed_revenue)}</td>
                  <td className="px-6 py-3 text-right text-gray-500">
                    {r.bom_parts_cost > 0 ? fmt(r.bom_parts_cost) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-6 py-3 text-right"><MarginBadge pct={r.margin_pct} /></td>
                  <td className="px-6 py-3 w-32">
                    <LaborBar bom={r.bom_parts_cost} revenue={r.billed_revenue} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
