'use client';

import { useState, useEffect } from 'react';
import { MiniChart } from '@/components/tradingview/MiniChart';

const STATS = [
  { label: 'USD/CAD', emoji: '💱', symbol: 'FX_IDC:USDCAD' },
  { label: 'Or', emoji: '🥇', symbol: 'TVC:GOLD' },
  { label: 'Pétrole WTI', emoji: '🛢️', symbol: 'TVC:USOIL' },
  { label: 'VIX', emoji: '📊', symbol: 'CBOE:VIX' },
];

export function MarketQuickStats() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

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
        @keyframes statPop {
          from { opacity: 0; transform: scale(0.9) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      <h3 className="text-sm font-bold font-[family-name:var(--font-heading)] text-text-main mb-4 flex items-center gap-2">
        <span>⚡</span>
        Indicateurs rapides
      </h3>

      <div className="grid grid-cols-2 gap-3">
        {STATS.map((stat, i) => (
          <div
            key={stat.symbol}
            className="border border-gray-100 rounded-xl overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
            style={{ animation: mounted ? `statPop 0.4s ease-out ${0.1 * i}s both` : 'none' }}
          >
            <div className="px-3 pt-2 flex items-center gap-1.5">
              <span className="text-base">{stat.emoji}</span>
              <span className="text-xs font-semibold text-text-muted">{stat.label}</span>
            </div>
            <MiniChart symbol={stat.symbol} height={100} dateRange="1M" />
          </div>
        ))}
      </div>
    </div>
  );
}
