'use client';

import { useState, useEffect } from 'react';
import { useYieldCurve } from '@/lib/hooks/useYieldCurve';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export function YieldCurveWidget() {
  const { points, date, isLoading, overnight } = useYieldCurve();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Check for inversion (2Y > 10Y)
  const y2 = points.find((p) => p.term === '2Y')?.yield ?? 0;
  const y10 = points.find((p) => p.term === '10Y')?.yield ?? 0;
  const isInverted = y2 > y10 && y2 > 0 && y10 > 0;

  // Chart data
  const chartData = points.map((p) => ({
    name: p.term,
    yield: p.yield,
    years: p.years,
  }));

  // Skeleton
  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-[var(--shadow-card)] p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)]">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-40 bg-gray-200 rounded" />
          <div className="h-44 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        bg-white rounded-2xl shadow-[var(--shadow-card)] p-6
        transition-all duration-500 ease-out
        hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)]
        ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}
      `}
    >
      <style>{`
        @keyframes invertedPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold font-[family-name:var(--font-heading)] text-text-main flex items-center gap-2">
            <span>📈</span>
            Courbe des taux Canada
          </h3>
          {date && (
            <p className="text-xs text-text-muted mt-0.5">{date}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {overnight !== null && (
            <span className="text-xs bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
              Taux directeur: {overnight.toFixed(2)}%
            </span>
          )}
          {isInverted && (
            <span
              className="text-xs bg-red-50 text-red-700 font-bold px-2 py-0.5 rounded-full"
              style={{ animation: 'invertedPulse 2s ease-in-out infinite' }}
            >
              ⚠️ Inversée
            </span>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="yieldFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isInverted ? '#fca5a5' : '#00b4d8'} stopOpacity={0.3} />
                <stop offset="95%" stopColor={isInverted ? '#fca5a5' : '#00b4d8'} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: '#586e82' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#586e82' }}
              axisLine={false}
              tickLine={false}
              domain={['auto', 'auto']}
              tickFormatter={(v: number) => `${v.toFixed(1)}%`}
            />
            <Tooltip
              contentStyle={{
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              }}
              formatter={(val) => [`${Number(val ?? 0).toFixed(3)}%`, 'Rendement']}
            />
            <Area
              type="monotone"
              dataKey="yield"
              stroke={isInverted ? '#ef4444' : '#00b4d8'}
              strokeWidth={2.5}
              fill="url(#yieldFill)"
              dot={{ r: 3, fill: isInverted ? '#ef4444' : '#00b4d8', strokeWidth: 0 }}
              activeDot={{ r: 5, fill: isInverted ? '#ef4444' : '#00b4d8', strokeWidth: 2, stroke: 'white' }}
              animationDuration={1200}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Key rates */}
      <div className="flex justify-between mt-3 gap-2">
        {['3M', '2Y', '5Y', '10Y', '30Y'].map((term) => {
          const pt = points.find((p) => p.term === term);
          if (!pt) return null;
          const isHighlighted = (term === '2Y' || term === '10Y') && isInverted;
          return (
            <div
              key={term}
              className={`
                flex-1 text-center p-1.5 rounded-lg
                ${isHighlighted ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}
              `}
            >
              <p className="text-[10px] font-semibold text-text-muted">{term}</p>
              <p className={`text-xs font-bold ${isHighlighted ? 'text-red-700' : 'text-text-main'}`}>
                {pt.yield.toFixed(2)}%
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
