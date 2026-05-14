'use client';

import { useState, useEffect } from 'react';
import { useYieldCurve } from '@/lib/hooks/useYieldCurve';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

function getSpreadSignal(spread: number): { label: string; color: string; emoji: string; detail: string } {
  if (spread < -0.2) return { label: 'Inversée', color: 'text-red-600', emoji: '🔴', detail: 'Signal historique de récession. Les taux courts dépassent les taux longs.' };
  if (spread < 0.1) return { label: 'Plate', color: 'text-amber-600', emoji: '🟡', detail: 'Courbe quasi-plate. Le marché anticipe un ralentissement ou une baisse de taux.' };
  if (spread < 0.5) return { label: 'Normale', color: 'text-blue-600', emoji: '🔵', detail: 'Courbe légèrement pentue. Environnement économique stable.' };
  return { label: 'Pentue', color: 'text-emerald-600', emoji: '🟢', detail: 'Courbe bien pentue. Le marché anticipe de la croissance et possiblement de l\'inflation.' };
}

function getMortgageEstimate(y5: number): { fixed5: string; variable: string } {
  return {
    fixed5: `~${(y5 + 1.5).toFixed(1)}%`,
    variable: `~${(y5 + 0.5).toFixed(1)}%`,
  };
}

export function RateIntelligence() {
  const { points, date, isLoading, overnight } = useYieldCurve();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const y2 = points.find(p => p.term === '2Y')?.yield ?? 0;
  const y5 = points.find(p => p.term === '5Y')?.yield ?? 0;
  const y10 = points.find(p => p.term === '10Y')?.yield ?? 0;
  const y30 = points.find(p => p.term === '30Y')?.yield ?? 0;
  const spread = y10 - y2;
  const signal = getSpreadSignal(spread);
  const mortgage = getMortgageEstimate(y5);

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-[var(--shadow-card)] p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-40 bg-gray-200 rounded" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  const rates = [
    { label: 'Taux directeur', value: overnight !== null ? `${overnight.toFixed(2)}%` : '—', sub: 'Banque du Canada', emoji: '🏛️', trend: 'stable' as const },
    { label: 'Obligation 2 ans', value: y2 > 0 ? `${y2.toFixed(2)}%` : '—', sub: 'Taux court terme', emoji: '📅', trend: y2 > y10 ? 'up' as const : 'stable' as const },
    { label: 'Obligation 5 ans', value: y5 > 0 ? `${y5.toFixed(2)}%` : '—', sub: 'Réf. hypothécaire fixe', emoji: '🏠', trend: 'stable' as const },
    { label: 'Obligation 10 ans', value: y10 > 0 ? `${y10.toFixed(2)}%` : '—', sub: 'Réf. long terme', emoji: '📊', trend: 'stable' as const },
  ];

  const trendIcon = { up: TrendingUp, down: TrendingDown, stable: Minus };

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
        @keyframes rateReveal {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold font-[family-name:var(--font-heading)] text-text-main flex items-center gap-2">
            <span>🏛️</span>
            Intelligence Taux
          </h3>
          {date && <p className="text-xs text-text-muted mt-0.5">{date}</p>}
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
          spread < 0 ? 'bg-red-50 text-red-700' : spread < 0.3 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
        }`}>
          <span>{signal.emoji}</span>
          Courbe {signal.label}
        </div>
      </div>

      {/* Key rates grid */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        {rates.map((rate, i) => {
          const Icon = trendIcon[rate.trend];
          return (
            <div
              key={rate.label}
              className="bg-gray-50 rounded-xl p-3 hover:bg-gray-100 transition-all duration-200"
              style={{ animation: mounted ? `rateReveal 0.3s ease-out ${0.1 + i * 0.08}s both` : 'none' }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm">{rate.emoji}</span>
                <Icon className="h-3 w-3 text-text-light" />
              </div>
              <p className="text-lg font-extrabold text-text-main">{rate.value}</p>
              <p className="text-[10px] font-semibold text-text-muted">{rate.label}</p>
              <p className="text-[9px] text-text-light">{rate.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Spread & Mortgage insight */}
      <div className="grid grid-cols-2 gap-2.5 mb-3">
        {/* Spread */}
        <div className={`rounded-xl p-3 border ${spread < 0 ? 'bg-red-50 border-red-200' : spread < 0.3 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <p className="text-[10px] font-bold text-text-muted mb-0.5">Écart 2-10 ans</p>
          <p className={`text-lg font-extrabold ${signal.color}`}>
            {spread >= 0 ? '+' : ''}{spread.toFixed(2)}%
          </p>
          <p className="text-[9px] text-text-muted mt-0.5">{signal.detail}</p>
        </div>

        {/* Mortgage estimate */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <p className="text-[10px] font-bold text-text-muted mb-0.5">Impact hypothèques</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-text-muted">Fixe 5 ans</span>
              <span className="text-xs font-bold text-blue-700">{mortgage.fixed5}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-text-muted">Variable</span>
              <span className="text-xs font-bold text-blue-700">{mortgage.variable}</span>
            </div>
          </div>
          <p className="text-[9px] text-text-light mt-1">Estimations basées sur les rendements obligataires</p>
        </div>
      </div>

      {/* Mini rate bar visualization */}
      {y30 > 0 && (
        <div className="flex items-end gap-1 justify-between px-1">
          {points.filter(p => ['3M', '1Y', '2Y', '5Y', '10Y', '30Y'].includes(p.term)).map((p, i) => {
            const maxYield = Math.max(...points.map(pt => pt.yield), 1);
            const height = Math.max((p.yield / maxYield) * 48, 4);
            const isKey = p.term === '5Y' || p.term === '2Y';
            return (
              <div key={p.term} className="flex-1 flex flex-col items-center gap-1" style={{ animation: mounted ? `rateReveal 0.3s ease-out ${0.6 + i * 0.05}s both` : 'none' }}>
                <span className="text-[8px] font-bold text-text-muted">{p.yield.toFixed(1)}%</span>
                <div
                  className={`w-full rounded-t-md transition-all duration-700 ease-out ${
                    isKey ? 'bg-brand-primary' : p.yield > y10 && p.term !== '30Y' ? 'bg-red-300' : 'bg-blue-200'
                  }`}
                  style={{ height: `${height}px` }}
                />
                <span className={`text-[9px] ${isKey ? 'font-bold text-brand-primary' : 'text-text-light'}`}>{p.term}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
