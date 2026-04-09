interface BarChartProps {
  data: { label: string; value: number; secondary?: number }[];
  height?: number;
  primaryColor?: string;
  secondaryColor?: string;
  formatValue?: (v: number) => string;
  title: string;
  subtitle?: string;
  loading?: boolean;
}

function formatCurrency(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export default function BarChart({
  data,
  height = 220,
  primaryColor = '#2563eb',
  secondaryColor = '#bfdbfe',
  formatValue = formatCurrency,
  title,
  subtitle,
  loading,
}: BarChartProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse">
        <div className="h-4 w-40 bg-gray-200 rounded mb-2" />
        <div className="h-3 w-24 bg-gray-100 rounded mb-6" />
        <div className="flex items-end gap-2" style={{ height }}>
          {[80, 55, 95, 40, 70, 60, 85, 50].map((h, i) => (
            <div key={i} className="flex-1 bg-gray-100 rounded-t" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => Math.max(d.value, d.secondary ?? 0)), 1);
  const barPad = 4;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center text-gray-300 text-sm" style={{ height }}>
          No data available
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex items-end gap-1 min-w-0" style={{ height }}>
            {data.map((d, i) => {
              const primaryH = (d.value / maxVal) * (height - 24);
              const secondaryH = d.secondary !== undefined ? (d.secondary / maxVal) * (height - 24) : null;
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end group min-w-0" style={{ paddingLeft: barPad / 2, paddingRight: barPad / 2 }}>
                  <div className="relative w-full flex items-end justify-center gap-0.5" style={{ height: height - 24 }}>
                    {secondaryH !== null && (
                      <div
                        className="rounded-t transition-all"
                        style={{ width: '45%', height: secondaryH, backgroundColor: secondaryColor }}
                      />
                    )}
                    <div
                      className="rounded-t transition-all group-hover:opacity-80"
                      style={{ width: secondaryH !== null ? '45%' : '70%', height: primaryH, backgroundColor: primaryColor }}
                    />
                    <div className="absolute -top-5 left-0 right-0 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-xs font-semibold text-gray-700 bg-white px-1 rounded shadow-sm">
                        {formatValue(d.value)}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 truncate w-full text-center leading-tight" title={d.label}>
                    {d.label.length > 12 ? d.label.slice(0, 11) + '…' : d.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
