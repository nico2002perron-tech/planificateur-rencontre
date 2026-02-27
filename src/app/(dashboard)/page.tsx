'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { TickerTape } from '@/components/tradingview/TickerTape';
import { MiniChart } from '@/components/tradingview/MiniChart';

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        description="Vue d'ensemble de votre activité"
      />

      {/* Ticker Tape */}
      <div className="mb-6 rounded-xl overflow-hidden border border-gray-100">
        <TickerTape />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <DashboardStatCard label="Clients actifs" value="--" change={null} />
        <DashboardStatCard label="Portefeuilles" value="--" change={null} />
        <DashboardStatCard label="Actifs sous gestion" value="--" change={null} />
        <DashboardStatCard label="Rapports ce mois" value="--" change={null} />
      </div>

      {/* Market Mini Charts + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-white rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-6">
          <h3 className="text-lg font-bold font-[family-name:var(--font-heading)] mb-4">
            Marchés
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="px-3 pt-2 text-xs font-semibold text-text-muted">S&P/TSX 60</div>
              <MiniChart symbol="TSX:TX60" height={180} />
            </div>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="px-3 pt-2 text-xs font-semibold text-text-muted">S&P 500</div>
              <MiniChart symbol="FOREXCOM:SPXUSD" height={180} />
            </div>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="px-3 pt-2 text-xs font-semibold text-text-muted">USD/CAD</div>
              <MiniChart symbol="FX_IDC:USDCAD" height={180} />
            </div>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="px-3 pt-2 text-xs font-semibold text-text-muted">Or</div>
              <MiniChart symbol="AMEX:GLD" height={180} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-6">
          <h3 className="text-lg font-bold font-[family-name:var(--font-heading)] mb-4">
            Actions rapides
          </h3>
          <div className="space-y-3">
            <QuickActionLink href="/clients/new" label="Nouveau client" />
            <QuickActionLink href="/portfolios/new" label="Nouveau portefeuille" />
            <QuickActionLink href="/models/new" label="Nouveau modèle" />
            <QuickActionLink href="/markets" label="Analyser un titre" />
            <QuickActionLink href="/reports/new" label="Générer un rapport" />
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardStatCard({ label, value, change }: { label: string; value: string; change: number | null }) {
  return (
    <div className="bg-white rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-5">
      <p className="text-sm text-text-muted mb-1">{label}</p>
      <p className="text-2xl font-bold font-[family-name:var(--font-heading)] text-text-main">{value}</p>
      {change !== null && (
        <p className={`text-xs mt-1 ${change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
          {change >= 0 ? '+' : ''}{change}%
        </p>
      )}
    </div>
  );
}

function QuickActionLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-100 hover:border-brand-primary hover:bg-brand-primary/5 transition-all duration-200 text-sm font-medium text-text-main"
    >
      {label}
      <span className="text-brand-primary">&rarr;</span>
    </a>
  );
}
