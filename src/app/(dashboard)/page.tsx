'use client';

import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import { TickerTape } from '@/components/tradingview/TickerTape';
import { MiniChart } from '@/components/tradingview/MiniChart';
import {
  GreetingHeader,
  FearGreedGauge,
  SectorHeatmap,
  MorningBriefing,
  EconomicCalendar,
  NewsRadar,
  MarketQuickStats,
} from '@/components/dashboard';

const YieldCurveWidget = dynamic(
  () => import('@/components/dashboard/YieldCurveWidget').then((m) => m.YieldCurveWidget),
  { ssr: false, loading: () => <div className="bg-white rounded-2xl shadow-[var(--shadow-card)] p-6 h-[340px] animate-pulse" /> }
);

const INDICES = [
  { label: 'S&P/TSX', symbol: 'TSX:TX60', flag: '🇨🇦' },
  { label: 'S&P 500', symbol: 'FOREXCOM:SPXUSD', flag: '🇺🇸' },
  { label: 'NASDAQ 100', symbol: 'NASDAQ:NDX', flag: '🇺🇸' },
  { label: 'Dow Jones', symbol: 'DJ:DJI', flag: '🇺🇸' },
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const firstName = (session?.user?.name || 'Conseiller').split(' ')[0];

  return (
    <div className="space-y-6">
      {/* News Ticker Tape */}
      <div className="rounded-2xl overflow-hidden border border-gray-100">
        <TickerTape />
      </div>

      {/* Greeting */}
      <GreetingHeader userName={firstName} />

      {/* Indices Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {INDICES.map((idx, i) => (
          <div
            key={idx.symbol}
            className="bg-white rounded-2xl shadow-[var(--shadow-card)] overflow-hidden hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)] transition-all duration-300"
            style={{ animation: `fadeSlideUp 0.4s ease-out ${0.08 * i}s both` }}
          >
            <div className="px-4 pt-3 flex items-center gap-2">
              <span className="text-base">{idx.flag}</span>
              <span className="text-xs font-bold text-text-main">{idx.label}</span>
            </div>
            <MiniChart symbol={idx.symbol} height={140} dateRange="3M" />
          </div>
        ))}
      </div>

      {/* Row: Fear & Greed + Sector Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <FearGreedGauge />
        </div>
        <div className="lg:col-span-3">
          <SectorHeatmap />
        </div>
      </div>

      {/* Row: Yield Curve + Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <YieldCurveWidget />
        <MarketQuickStats />
      </div>

      {/* Row: Morning Briefing + Economic Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <MorningBriefing />
        </div>
        <div className="lg:col-span-2">
          <EconomicCalendar />
        </div>
      </div>

      {/* Full width: News Radar */}
      <NewsRadar />

      {/* Global animation keyframes */}
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
