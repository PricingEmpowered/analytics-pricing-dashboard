import type { TopCustomer } from '../types';

interface Props {
  data: TopCustomer[];
  loading?: boolean;
}

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

function MarginBadge({ pct }: { pct: number }) {
  const color = pct >= 40 ? 'bg-emerald-100 text-emerald-700' : pct >= 20 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700';
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>{pct.toFixed(1)}%</span>;
}

export default function TopCustomersTable({ data, loading }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-50">
        <h3 className="text-sm font-semibold text-gray-900">Top Customers by Revenue</h3>
        <p className="text-xs text-gray-400 mt-0.5">Ranked by total sales amount in period</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-400">
              <th className="text-left px-6 py-3 font-semibold w-6">#</th>
              <th className="text-left px-6 py-3 font-semibold">Customer</th>
              <th className="text-right px-6 py-3 font-semibold">Revenue</th>
              <th className="text-right px-6 py-3 font-semibold">Orders</th>
              <th className="text-right px-6 py-3 font-semibold">Margin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: 8 }, (_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-6 py-3"><div className="h-3 w-4 bg-gray-100 rounded" /></td>
                  <td className="px-6 py-3"><div className="h-3 w-36 bg-gray-100 rounded" /></td>
                  <td className="px-6 py-3"><div className="h-3 w-20 bg-gray-100 rounded ml-auto" /></td>
                  <td className="px-6 py-3"><div className="h-3 w-10 bg-gray-100 rounded ml-auto" /></td>
                  <td className="px-6 py-3"><div className="h-5 w-14 bg-gray-100 rounded ml-auto" /></td>
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-300 text-sm">No customer data available</td>
              </tr>
            ) : (
              data.map((c, i) => (
                <tr key={c.customer_number} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 text-gray-400 text-xs font-medium">{i + 1}</td>
                  <td className="px-6 py-3">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{c.company_name || 'Unknown'}</p>
                      <p className="text-xs text-gray-400">{c.customer_number}</p>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right font-semibold text-gray-800">{fmt(c.revenue)}</td>
                  <td className="px-6 py-3 text-right text-gray-500">{c.order_count}</td>
                  <td className="px-6 py-3 text-right"><MarginBadge pct={c.margin_pct} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
