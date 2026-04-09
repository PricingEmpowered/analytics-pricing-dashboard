interface DataPoint {
  label: string;
  revenue: number;
  cost: number;
  profit: number;
}

interface LineChartProps {
  data: DataPoint[];
  height?: number;
  title: string;
  subtitle?: string;
  loading?: boolean;
}

function formatCurrency(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function formatMonth(ym: string) {
  const [y, m] = ym.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

export default function LineChart({ data, height = 220, title, subtitle, loading }: LineChartProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse">
        <div className="h-4 w-48 bg-gray-200 rounded mb-2" />
        <div className="h-3 w-28 bg-gray-100 rounded mb-6" />
        <div className="bg-gray-100 rounded" style={{ height }} />
      </div>
    );
  }

  const svgPad = { top: 16, right: 16, bottom: 32, left: 52 };
  const svgWidth = 600;
  const svgHeight = height;
  const plotW = svgWidth - svgPad.left - svgPad.right;
  const plotH = svgHeight - svgPad.top - svgPad.bottom;

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-0.5">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 mb-4">{subtitle}</p>}
        <div className="flex items-center justify-center text-gray-300 text-sm" style={{ height }}>
          No data available
        </div>
      </div>
    );
  }

  const maxVal = Math.max(...data.flatMap((d) => [d.revenue, d.cost]), 1);
  const step = plotW / (data.length - 1 || 1);

  const toX = (i: number) => svgPad.left + i * step;
  const toY = (v: number) => svgPad.top + plotH - (v / maxVal) * plotH;

  const pathFor = (key: keyof DataPoint) => {
    return data
      .map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d[key] as number)}`)
      .join(' ');
  };

  const areaFor = (key: keyof DataPoint) => {
    const pts = data.map((d, i) => `${toX(i)},${toY(d[key] as number)}`).join(' ');
    const base = `${toX(data.length - 1)},${svgPad.top + plotH} ${toX(0)},${svgPad.top + plotH}`;
    return `M ${pts} L ${base} Z`;
  };

  const yTicks = 4;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-blue-500 inline-block rounded" />Revenue</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-rose-400 inline-block rounded" />Cost</span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full"
        style={{ height }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="grad-revenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.01" />
          </linearGradient>
          <linearGradient id="grad-cost" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const y = svgPad.top + (plotH / yTicks) * i;
          const val = maxVal * (1 - i / yTicks);
          return (
            <g key={i}>
              <line x1={svgPad.left} y1={y} x2={svgPad.left + plotW} y2={y} stroke="#f1f5f9" strokeWidth="1" />
              <text x={svgPad.left - 6} y={y + 4} textAnchor="end" fontSize="9" fill="#94a3b8">
                {formatCurrency(val)}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => (
          i % Math.ceil(data.length / 8) === 0 && (
            <text key={i} x={toX(i)} y={svgHeight - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">
              {formatMonth(d.label)}
            </text>
          )
        ))}

        <path d={areaFor('revenue')} fill="url(#grad-revenue)" />
        <path d={areaFor('cost')} fill="url(#grad-cost)" />
        <path d={pathFor('revenue')} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d={pathFor('cost')} fill="none" stroke="#f43f5e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 2" />

        {data.map((d, i) => (
          <circle key={i} cx={toX(i)} cy={toY(d.revenue)} r="3" fill="#2563eb" stroke="white" strokeWidth="1.5" />
        ))}
      </svg>
    </div>
  );
}
