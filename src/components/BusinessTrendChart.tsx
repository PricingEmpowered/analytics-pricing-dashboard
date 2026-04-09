import type { BusinessTypeTrend } from '../types';

interface Props {
  data: BusinessTypeTrend[];
  height?: number;
  loading?: boolean;
}

function fmtCurrency(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtMonth(ym: string) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m, 10) - 1]} '${y.slice(2)}`;
}

const SERIES = [
  { key: 'parts' as const,   label: 'Parts & Products', color: '#2563eb' },
  { key: 'repairs' as const, label: 'Repairs & Service', color: '#10b981' },
  { key: 'labor' as const,   label: 'Labor & Projects',  color: '#f59e0b' },
];

export default function BusinessTrendChart({ data, height = 240, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse">
        <div className="h-4 w-48 bg-gray-200 rounded mb-2" />
        <div className="h-3 w-32 bg-gray-100 rounded mb-6" />
        <div className="bg-gray-100 rounded" style={{ height }} />
      </div>
    );
  }

  const svgPad = { top: 16, right: 16, bottom: 32, left: 56 };
  const svgW = 600;
  const svgH = height;
  const plotW = svgW - svgPad.left - svgPad.right;
  const plotH = svgH - svgPad.top - svgPad.bottom;

  const maxVal = data.length > 0
    ? Math.max(...data.map(d => d.parts + d.repairs + d.labor), 1)
    : 1;

  const toX = (i: number) => svgPad.left + (i / Math.max(data.length - 1, 1)) * plotW;
  const toY = (v: number) => svgPad.top + plotH - (v / maxVal) * plotH;

  const pathFor = (key: 'parts' | 'repairs' | 'labor') =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d[key]).toFixed(1)}`).join(' ');

  const areaFor = (key: 'parts' | 'repairs' | 'labor') => {
    if (data.length === 0) return '';
    const pts = data.map((d, i) => `${toX(i).toFixed(1)},${toY(d[key]).toFixed(1)}`).join(' L ');
    return `M ${pts} L ${toX(data.length - 1)},${svgPad.top + plotH} L ${toX(0)},${svgPad.top + plotH} Z`;
  };

  const yTicks = 4;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Revenue by Business Type</h3>
          <p className="text-xs text-gray-400 mt-0.5">Parts vs repairs vs labor over time</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap justify-end">
          {SERIES.map(s => (
            <span key={s.key} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center text-gray-300 text-sm" style={{ height }}>
          No data available
        </div>
      ) : (
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" style={{ height }} preserveAspectRatio="none">
          <defs>
            {SERIES.map(s => (
              <linearGradient key={s.key} id={`grad-bt-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.12" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0.01" />
              </linearGradient>
            ))}
          </defs>

          {Array.from({ length: yTicks + 1 }, (_, i) => {
            const y = svgPad.top + (plotH / yTicks) * i;
            const val = maxVal * (1 - i / yTicks);
            return (
              <g key={i}>
                <line x1={svgPad.left} y1={y} x2={svgPad.left + plotW} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                <text x={svgPad.left - 6} y={y + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{fmtCurrency(val)}</text>
              </g>
            );
          })}

          {data.map((d, i) => (
            i % Math.ceil(data.length / 8) === 0 && (
              <text key={i} x={toX(i)} y={svgH - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">
                {fmtMonth(d.month)}
              </text>
            )
          ))}

          {SERIES.map(s => (
            <path key={`area-${s.key}`} d={areaFor(s.key)} fill={`url(#grad-bt-${s.key})`} />
          ))}
          {SERIES.map(s => (
            <path
              key={`line-${s.key}`}
              d={pathFor(s.key)}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {data.map((d, i) => (
            <circle key={i} cx={toX(i)} cy={toY(d.repairs)} r="2.5" fill="#10b981" stroke="white" strokeWidth="1.5" />
          ))}
        </svg>
      )}
    </div>
  );
}
