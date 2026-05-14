'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';

interface SectorData {
  sector: string;
  changesPercentage: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const sectorEmojis: Record<string, string> = {
  'Technology': '💻',
  'Healthcare': '🏥',
  'Financial Services': '🏦',
  'Industrials': '🏗️',
  'Consumer Cyclical': '🛍️',
  'Consumer Defensive': '🛒',
  'Energy': '⚡',
  'Utilities': '💡',
  'Real Estate': '🏠',
  'Basic Materials': '⛏️',
  'Communication Services': '📡',
};

const sectorNamesFr: Record<string, string> = {
  'Technology': 'Technologie',
  'Healthcare': 'Santé',
  'Financial Services': 'Services financiers',
  'Industrials': 'Industriels',
  'Consumer Cyclical': 'Consommation cyclique',
  'Consumer Defensive': 'Consommation défensive',
  'Energy': 'Énergie',
  'Utilities': 'Services publics',
  'Real Estate': 'Immobilier',
  'Basic Materials': 'Matériaux de base',
  'Communication Services': 'Communication',
};

function getBarColor(pct: number) {
  if (pct >= 2) return 'bg-emerald-500';
  if (pct >= 1) return 'bg-emerald-400';
  if (pct >= 0.5) return 'bg-emerald-300';
  if (pct >= 0) return 'bg-emerald-200';
  if (pct >= -0.5) return 'bg-red-200';
  if (pct >= -1) return 'bg-red-300';
  if (pct >= -2) return 'bg-red-400';
  return 'bg-red-500';
}

function getBgGradient(pct: number) {
  if (pct >= 1) return 'from-emerald-50 to-emerald-100/50';
  if (pct >= 0) return 'from-emerald-50/50 to-white';
  if (pct >= -1) return 'from-red-50/50 to-white';
  return 'from-red-50 to-red-100/50';
}

function getTextColor(pct: number) {
  if (pct >= 0) return 'text-emerald-700';
  return 'text-red-700';
}

export function SectorHeatmap() {
  const { data, isLoading } = useSWR<SectorData[]>(
    '/api/fmp/sector-performance',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
  );

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Skeleton
  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-[var(--shadow-card)] p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)]">
        <div className="h-5 w-48 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      </div>
    );
  }

  const sectors = data ?? [];

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
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <h3 className="text-sm font-bold font-[family-name:var(--font-heading)] text-text-main mb-4 flex items-center gap-2">
        <span>📊</span>
        Performance sectorielle
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {sectors.map((sector, i) => {
          const pct = parseFloat(sector.changesPercentage) || 0;
          const emoji = sectorEmojis[sector.sector] ?? '📈';
          const nameFr = sectorNamesFr[sector.sector] ?? sector.sector;
          const maxBarWidth = Math.min(Math.abs(pct) * 20, 100);

          return (
            <div
              key={sector.sector}
              className={`
                bg-gradient-to-br ${getBgGradient(pct)}
                rounded-xl p-3 border border-gray-100
                transition-all duration-300 ease-out
                hover:-translate-y-1 hover:shadow-md
                cursor-default
              `}
              style={{
                animation: mounted ? `fadeSlideUp 0.4s ease-out ${0.05 * i}s both` : 'none',
              }}
            >
              <div className="flex items-start justify-between mb-1.5">
                <span className="text-base">{emoji}</span>
                <span className={`text-xs font-bold ${getTextColor(pct)}`}>
                  {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                </span>
              </div>
              <p className="text-xs font-semibold text-text-main truncate mb-2">{nameFr}</p>
              {/* Mini bar */}
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${getBarColor(pct)} transition-all duration-1000 ease-out`}
                  style={{ width: mounted ? `${maxBarWidth}%` : '0%' }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
