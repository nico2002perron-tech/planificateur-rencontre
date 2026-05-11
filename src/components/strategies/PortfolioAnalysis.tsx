'use client';

import { useState, useMemo } from 'react';
import {
  PieChart, TrendingUp, Shield, BarChart3, List,
  Target, Download, ChevronUp, ChevronDown,
  Globe, Briefcase, ArrowUpRight, ArrowDownRight,
  Loader2, FileText,
} from 'lucide-react';

// ── DUO Colors ──────────────────────────────────────────────────────────────

const DUO = {
  green: '#58CC02', greenDark: '#45a300',
  blue: '#1CB0F6', blueDark: '#1899d6',
  purple: '#CE82FF', purpleDark: '#b06edb',
  orange: '#FF9600', orangeDark: '#e08600',
  red: '#FF4B4B',
  teal: '#00CD9C',
} as const;

const SECTOR_COLORS: Record<string, string> = {
  'Technology': DUO.blue, 'Information Technology': DUO.blue,
  'Financial Services': DUO.green, 'Financials': DUO.green,
  'Healthcare': DUO.purple, 'Health Care': DUO.purple,
  'Energy': DUO.orange,
  'Consumer Cyclical': '#FF6B6B', 'Consumer Discretionary': '#FF6B6B',
  'Industrials': DUO.teal,
  'Communication Services': '#6C5CE7',
  'Consumer Defensive': '#FDCB6E', 'Consumer Staples': '#FDCB6E',
  'Utilities': '#A29BFE',
  'Real Estate': '#E17055',
  'Basic Materials': '#00CEC9', 'Materials': '#00CEC9',
};

const GEO_COLORS: Record<string, string> = {
  'Canada': DUO.red, 'États-Unis': DUO.blue, 'Europe': DUO.purple,
  'Asie-Pacifique': DUO.orange, 'Autre': '#94a3b8',
};

const STYLE_LABELS: Record<string, string> = {
  'large-value': 'Grande\nValeur', 'large-blend': 'Grande\nMixte', 'large-growth': 'Grande\nCroissance',
  'mid-value': 'Moy.\nValeur', 'mid-blend': 'Moy.\nMixte', 'mid-growth': 'Moy.\nCroissance',
  'small-value': 'Petite\nValeur', 'small-blend': 'Petite\nMixte', 'small-growth': 'Petite\nCroissance',
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmt(v: number): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(v);
}

function fmtPct(v: number | null, decimals = 1): string {
  if (v === null) return '—';
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(decimals)}%`;
}

function fmtNum(v: number | null, decimals = 2): string {
  if (v === null) return '—';
  return v.toFixed(decimals);
}

// ── Types ──────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'allocation' | 'performance' | 'risk' | 'holdings';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Props { data: any; }

// ── Component ──────────────────────────────────────────────────────────────

export function PortfolioAnalysis({ data }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [sortField, setSortField] = useState<string>('weight');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const tabs: { key: Tab; label: string; icon: typeof PieChart }[] = [
    { key: 'overview', label: 'Sommaire', icon: Briefcase },
    { key: 'allocation', label: 'Allocation', icon: PieChart },
    { key: 'performance', label: 'Rendements', icon: TrendingUp },
    { key: 'risk', label: 'Risque', icon: Shield },
    { key: 'holdings', label: 'Avoirs', icon: List },
  ];

  const sortedHoldings = useMemo(() => {
    const h = [...(data.holdings ?? [])];
    h.sort((a: Record<string, number | null>, b: Record<string, number | null>) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      return sortDir === 'desc' ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
    });
    return h;
  }, [data.holdings, sortField, sortDir]);

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return sortDir === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />;
  };

  const handlePdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const res = await fetch('/api/portfolio/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Erreur PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.name ?? 'Portefeuille'} - Analyse.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Erreur lors de la génération du PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const rs = data.riskStats ?? {};
  const wf = data.weightedFundamentals ?? {};

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-gray-100/80 rounded-xl p-1 mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex-1 justify-center ${
              activeTab === t.key ? 'bg-white text-text-main shadow-sm' : 'text-text-muted hover:text-text-main'
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
        {/* PDF button */}
        <button
          onClick={handlePdf}
          disabled={isGeneratingPdf}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold text-white transition-all ml-1"
          style={{ backgroundColor: DUO.green, boxShadow: `0 2px 0 0 ${DUO.greenDark}` }}
        >
          {isGeneratingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          PDF
        </button>
      </div>

      {/* ═══════════════ OVERVIEW TAB ═══════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Rendement 1 an', value: fmtPct(rs.return1Y), color: rs.return1Y >= 0 ? DUO.green : DUO.red },
              { label: 'Rendement 3 ans (ann.)', value: fmtPct(rs.return3Y), color: rs.return3Y >= 0 ? DUO.green : DUO.red },
              { label: 'Sharpe 3 ans', value: fmtNum(rs.sharpe3Y), color: DUO.blue },
              { label: 'Max Drawdown', value: fmtPct(rs.maxDrawdown), color: DUO.red },
            ].map((kpi, i) => (
              <div
                key={i}
                className="rounded-2xl bg-white p-4"
                style={{ border: `2px solid ${kpi.color}15`, borderBottom: `4px solid ${kpi.color}25` }}
              >
                <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">{kpi.label}</div>
                <div className="text-2xl font-extrabold" style={{ color: kpi.color }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Two-column: fundamentals + style matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Weighted fundamentals */}
            <div className="rounded-2xl bg-white p-5" style={{ border: '2px solid #f1f5f9' }}>
              <h3 className="text-sm font-extrabold text-text-main mb-4">Fondamentaux pondérés</h3>
              <div className="space-y-3">
                {[
                  { label: 'P/E ratio', value: fmtNum(wf.weightedPE, 1) },
                  { label: 'P/B ratio', value: fmtNum(wf.weightedPB, 2) },
                  { label: 'ROE', value: wf.weightedROE ? `${(wf.weightedROE * 100).toFixed(1)}%` : '—' },
                  { label: 'Rendement dividende', value: wf.weightedDividendYield ? `${(wf.weightedDividendYield * 100).toFixed(2)}%` : '—' },
                  { label: 'Marge bénéficiaire', value: wf.weightedProfitMargin ? `${(wf.weightedProfitMargin * 100).toFixed(1)}%` : '—' },
                  { label: 'Cap. boursière moy.', value: wf.avgMarketCapB ? `${wf.avgMarketCapB.toFixed(1)}G$` : '—' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-xs text-text-muted">{item.label}</span>
                    <span className="text-sm font-bold text-text-main">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Style Matrix 3x3 */}
            <div className="rounded-2xl bg-white p-5" style={{ border: '2px solid #f1f5f9' }}>
              <h3 className="text-sm font-extrabold text-text-main mb-4">Style Matrix</h3>
              <div className="grid grid-cols-3 gap-1">
                {(['large-value', 'large-blend', 'large-growth',
                  'mid-value', 'mid-blend', 'mid-growth',
                  'small-value', 'small-blend', 'small-growth'] as const).map((box) => {
                  const weight = (data.styleMatrix?.[box] ?? 0) * 100;
                  const intensity = Math.min(weight / 40, 1);
                  return (
                    <div
                      key={box}
                      className="aspect-square rounded-lg flex flex-col items-center justify-center relative"
                      style={{
                        backgroundColor: weight > 0 ? `rgba(28, 176, 246, ${0.08 + intensity * 0.4})` : '#f8fafc',
                        border: weight > 0 ? '1px solid rgba(28, 176, 246, 0.3)' : '1px solid #e5e7eb',
                      }}
                    >
                      <span className="text-[8px] text-text-muted text-center whitespace-pre-line leading-tight">
                        {STYLE_LABELS[box]}
                      </span>
                      {weight > 0 && (
                        <span className="text-xs font-extrabold mt-0.5" style={{ color: DUO.blue }}>
                          {weight.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between mt-2 px-1">
                <span className="text-[8px] text-text-muted">Valeur</span>
                <span className="text-[8px] text-text-muted">Mixte</span>
                <span className="text-[8px] text-text-muted">Croissance</span>
              </div>
            </div>
          </div>

          {/* Returns summary */}
          <div className="rounded-2xl bg-white p-5" style={{ border: '2px solid #f1f5f9' }}>
            <h3 className="text-sm font-extrabold text-text-main mb-4">Rendements</h3>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {[
                { label: 'YTD', value: rs.returnYTD },
                { label: '1 an', value: rs.return1Y },
                { label: '3 ans', value: rs.return3Y },
                { label: '5 ans', value: rs.return5Y },
                { label: '10 ans', value: rs.return10Y },
                { label: 'Inception', value: rs.returnSinceInception },
              ].map((item, i) => (
                <div key={i} className="text-center p-3 rounded-xl bg-gray-50">
                  <div className="text-[10px] font-bold text-text-muted uppercase mb-1">{item.label}</div>
                  <div className={`text-lg font-extrabold ${
                    item.value === null ? 'text-text-muted' : item.value >= 0 ? 'text-[#58CC02]' : 'text-[#FF4B4B]'
                  }`}>
                    {fmtPct(item.value)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sources */}
          <div className="flex items-center gap-4 py-3 px-4 rounded-xl bg-gray-50">
            <FileText className="h-4 w-4 text-text-muted flex-shrink-0" />
            <div className="text-[10px] text-text-muted">
              <strong>Sources :</strong> Fondamentaux — {data.sources?.fundamentals} · Prix & historique — {data.sources?.prices} · Benchmark — {data.sources?.benchmark} · Généré le {new Date(data.sources?.generatedAt).toLocaleDateString('fr-CA')}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ ALLOCATION TAB ═══════════════ */}
      {activeTab === 'allocation' && (
        <div className="space-y-6">
          {/* Sector allocation */}
          <div className="rounded-2xl bg-white p-5" style={{ border: '2px solid #f1f5f9' }}>
            <h3 className="text-sm font-extrabold text-text-main mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" style={{ color: DUO.purple }} />
              Répartition sectorielle
            </h3>
            <div className="space-y-3">
              {(data.sectors ?? []).map((s: { sector: string; weight: number }, i: number) => {
                const color = SECTOR_COLORS[s.sector] ?? '#94a3b8';
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-32 text-xs text-text-main truncate">{s.sector}</span>
                    <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${s.weight}%`, backgroundColor: color }}
                      />
                    </div>
                    <span className="w-12 text-xs font-bold text-text-main text-right">{s.weight.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Geography */}
          <div className="rounded-2xl bg-white p-5" style={{ border: '2px solid #f1f5f9' }}>
            <h3 className="text-sm font-extrabold text-text-main mb-4 flex items-center gap-2">
              <Globe className="h-4 w-4" style={{ color: DUO.blue }} />
              Répartition géographique
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {(data.geography ?? []).map((g: { region: string; weight: number }, i: number) => {
                const color = GEO_COLORS[g.region] ?? '#94a3b8';
                return (
                  <div key={i} className="rounded-xl p-4 text-center" style={{ backgroundColor: `${color}10`, border: `1px solid ${color}20` }}>
                    <div className="text-xl font-extrabold" style={{ color }}>{g.weight.toFixed(0)}%</div>
                    <div className="text-xs font-bold text-text-main mt-1">{g.region}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Style Matrix (larger) */}
          <div className="rounded-2xl bg-white p-5" style={{ border: '2px solid #f1f5f9' }}>
            <h3 className="text-sm font-extrabold text-text-main mb-4">Style Matrix (Morningstar)</h3>
            <div className="max-w-xs mx-auto">
              <div className="grid grid-cols-3 gap-1">
                {(['large-value', 'large-blend', 'large-growth',
                  'mid-value', 'mid-blend', 'mid-growth',
                  'small-value', 'small-blend', 'small-growth'] as const).map((box) => {
                  const weight = (data.styleMatrix?.[box] ?? 0) * 100;
                  const intensity = Math.min(weight / 40, 1);
                  return (
                    <div
                      key={box}
                      className="aspect-square rounded-lg flex flex-col items-center justify-center p-2"
                      style={{
                        backgroundColor: weight > 0 ? `rgba(28, 176, 246, ${0.05 + intensity * 0.45})` : '#f8fafc',
                        border: weight > 0 ? '2px solid rgba(28, 176, 246, 0.3)' : '1px solid #e5e7eb',
                      }}
                    >
                      <span className="text-[10px] text-text-muted text-center whitespace-pre-line leading-tight">
                        {STYLE_LABELS[box]}
                      </span>
                      <span className={`text-lg font-extrabold mt-1 ${weight > 0 ? '' : 'text-gray-300'}`} style={weight > 0 ? { color: DUO.blue } : {}}>
                        {weight > 0 ? `${weight.toFixed(0)}%` : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Dividend yield */}
          <div className="rounded-2xl bg-white p-5" style={{ border: '2px solid #f1f5f9' }}>
            <h3 className="text-sm font-extrabold text-text-main mb-2">Rendement en dividendes</h3>
            <div className="text-3xl font-extrabold" style={{ color: DUO.green }}>
              {data.totalDivYield ? `${(data.totalDivYield * 100).toFixed(2)}%` : '—'}
            </div>
            <p className="text-xs text-text-muted mt-1">Rendement pondéré du portefeuille</p>
          </div>
        </div>
      )}

      {/* ═══════════════ PERFORMANCE TAB ═══════════════ */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          {/* Growth of $10K */}
          <div className="rounded-2xl bg-white p-5" style={{ border: '2px solid #f1f5f9' }}>
            <h3 className="text-sm font-extrabold text-text-main mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" style={{ color: DUO.green }} />
              Croissance de 10 000$
            </h3>
            {data.growthSeries?.length > 2 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-text-muted">Portefeuille: </span>
                    <span className="text-lg font-extrabold" style={{ color: DUO.blue }}>
                      {fmt(data.growthSeries[data.growthSeries.length - 1]?.portfolio ?? 10000)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-text-muted">Benchmark: </span>
                    <span className="text-lg font-extrabold text-text-muted">
                      {fmt(data.growthSeries[data.growthSeries.length - 1]?.benchmark ?? 10000)}
                    </span>
                  </div>
                </div>
                {/* Simple visual bar comparison */}
                <div className="space-y-1">
                  {(() => {
                    const lastP = data.growthSeries[data.growthSeries.length - 1]?.portfolio ?? 10000;
                    const lastB = data.growthSeries[data.growthSeries.length - 1]?.benchmark ?? 10000;
                    const max = Math.max(lastP, lastB);
                    return (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="w-20 text-xs font-bold text-text-main">Portefeuille</span>
                          <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${(lastP / max) * 100}%`, backgroundColor: DUO.blue }} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-20 text-xs font-bold text-text-muted">Benchmark</span>
                          <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-gray-400" style={{ width: `${(lastB / max) * 100}%` }} />
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <p className="text-xs text-text-muted">Données insuffisantes</p>
            )}
          </div>

          {/* Annual returns table */}
          <div className="rounded-2xl bg-white p-5" style={{ border: '2px solid #f1f5f9' }}>
            <h3 className="text-sm font-extrabold text-text-main mb-4">Rendements annuels</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-bold text-text-muted uppercase tracking-wider">Année</th>
                    <th className="text-right py-2 px-3 font-bold text-text-muted uppercase tracking-wider">Portefeuille</th>
                    <th className="text-right py-2 px-3 font-bold text-text-muted uppercase tracking-wider">Benchmark</th>
                    <th className="text-right py-2 px-3 font-bold text-text-muted uppercase tracking-wider">Écart</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.annualReturns ?? []).map((ar: { year: number; portfolio: number; benchmark: number }, i: number) => {
                    const diff = ar.portfolio - ar.benchmark;
                    return (
                      <tr key={i} className={`border-b border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                        <td className="py-2.5 px-3 font-bold text-text-main">{ar.year}</td>
                        <td className={`py-2.5 px-3 text-right font-bold ${ar.portfolio >= 0 ? 'text-[#58CC02]' : 'text-[#FF4B4B]'}`}>
                          {fmtPct(ar.portfolio)}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-bold ${ar.benchmark >= 0 ? 'text-[#58CC02]' : 'text-[#FF4B4B]'}`}>
                          {fmtPct(ar.benchmark)}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-bold ${diff >= 0 ? 'text-[#58CC02]' : 'text-[#FF4B4B]'}`}>
                          {fmtPct(diff)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Best/Worst month */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white p-4" style={{ border: `2px solid ${DUO.green}15` }}>
              <div className="flex items-center gap-2 mb-2">
                <ArrowUpRight className="h-4 w-4" style={{ color: DUO.green }} />
                <span className="text-xs font-bold text-text-muted">Meilleur mois</span>
              </div>
              <div className="text-xl font-extrabold" style={{ color: DUO.green }}>{fmtPct(rs.bestMonth)}</div>
              <div className="text-[10px] text-text-muted">{rs.bestMonthDate}</div>
            </div>
            <div className="rounded-2xl bg-white p-4" style={{ border: `2px solid ${DUO.red}15` }}>
              <div className="flex items-center gap-2 mb-2">
                <ArrowDownRight className="h-4 w-4" style={{ color: DUO.red }} />
                <span className="text-xs font-bold text-text-muted">Pire mois</span>
              </div>
              <div className="text-xl font-extrabold" style={{ color: DUO.red }}>{fmtPct(rs.worstMonth)}</div>
              <div className="text-[10px] text-text-muted">{rs.worstMonthDate}</div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ RISK TAB ═══════════════ */}
      {activeTab === 'risk' && (
        <div className="space-y-6">
          {/* Risk/return summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Écart-type 1 an', value: rs.stdDev1Y ? `${(rs.stdDev1Y * 100).toFixed(1)}%` : '—', color: DUO.orange },
              { label: 'Écart-type 3 ans', value: rs.stdDev3Y ? `${(rs.stdDev3Y * 100).toFixed(1)}%` : '—', color: DUO.orange },
              { label: 'Écart-type 5 ans', value: rs.stdDev5Y ? `${(rs.stdDev5Y * 100).toFixed(1)}%` : '—', color: DUO.orange },
              { label: 'Sharpe 1 an', value: fmtNum(rs.sharpe1Y), color: DUO.blue },
              { label: 'Sharpe 3 ans', value: fmtNum(rs.sharpe3Y), color: DUO.blue },
              { label: 'Sharpe 5 ans', value: fmtNum(rs.sharpe5Y), color: DUO.blue },
            ].map((item, i) => (
              <div
                key={i}
                className="rounded-2xl bg-white p-4 text-center"
                style={{ border: `1px solid ${item.color}20` }}
              >
                <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">{item.label}</div>
                <div className="text-2xl font-extrabold" style={{ color: item.color }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Relative stats vs benchmark */}
          <div className="rounded-2xl bg-white p-5" style={{ border: '2px solid #f1f5f9' }}>
            <h3 className="text-sm font-extrabold text-text-main mb-4">
              Statistiques relatives (3 ans) vs {data.benchmark}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Alpha', value: rs.alpha3Y !== null ? fmtPct(rs.alpha3Y) : '—', desc: 'Surperformance ajustée au risque' },
                { label: 'Beta', value: fmtNum(rs.beta3Y), desc: 'Sensibilité au marché' },
                { label: 'R²', value: rs.rSquared3Y !== null ? `${(rs.rSquared3Y * 100).toFixed(0)}%` : '—', desc: 'Corrélation avec le benchmark' },
                { label: 'Tracking Error', value: rs.trackingError3Y !== null ? `${(rs.trackingError3Y * 100).toFixed(1)}%` : '—', desc: 'Écart vs benchmark' },
              ].map((item, i) => (
                <div key={i} className="p-3 rounded-xl bg-gray-50">
                  <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">{item.label}</div>
                  <div className="text-xl font-extrabold text-text-main">{item.value}</div>
                  <div className="text-[9px] text-text-muted mt-1">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Sortino + Capture ratios + Max DD + Info Ratio */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Sortino 3 ans', value: fmtNum(rs.sortino3Y), color: DUO.purple },
              { label: 'Info Ratio 3 ans', value: fmtNum(rs.informationRatio3Y), color: DUO.teal },
              { label: 'Capture hausse', value: rs.captureUpside3Y !== null ? `${rs.captureUpside3Y.toFixed(0)}%` : '—', color: DUO.green },
              { label: 'Capture baisse', value: rs.captureDownside3Y !== null ? `${rs.captureDownside3Y.toFixed(0)}%` : '—', color: DUO.red },
            ].map((item, i) => (
              <div
                key={i}
                className="rounded-2xl bg-white p-4 text-center"
                style={{ border: `1px solid ${item.color}20` }}
              >
                <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">{item.label}</div>
                <div className="text-xl font-extrabold" style={{ color: item.color }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Max Drawdown */}
          <div className="rounded-2xl bg-white p-5" style={{ border: `2px solid ${DUO.red}15` }}>
            <h3 className="text-sm font-extrabold text-text-main mb-2">Drawdown maximal</h3>
            <div className="flex items-end gap-4">
              <div className="text-3xl font-extrabold" style={{ color: DUO.red }}>{fmtPct(rs.maxDrawdown)}</div>
              <div className="text-xs text-text-muted pb-1">Atteint le {rs.maxDrawdownDate}</div>
            </div>
            <div className="mt-3 h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.abs(rs.maxDrawdown ?? 0) * 100}%`, backgroundColor: DUO.red }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ HOLDINGS TAB ═══════════════ */}
      {activeTab === 'holdings' && (
        <div className="rounded-2xl bg-white overflow-hidden" style={{ border: '2px solid #f1f5f9' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {[
                    { key: 'symbol', label: 'Titre', align: 'left' as const },
                    { key: 'weight', label: 'Poids', align: 'right' as const },
                    { key: 'price', label: 'Prix', align: 'right' as const },
                    { key: 'targetPrice', label: 'Cible', align: 'right' as const },
                    { key: 'upside', label: 'Potentiel', align: 'right' as const },
                    { key: 'pe', label: 'P/E', align: 'right' as const },
                    { key: 'dividendYield', label: 'Div. %', align: 'right' as const },
                    { key: 'beta', label: 'Beta', align: 'right' as const },
                    { key: 'gicSector', label: 'Secteur', align: 'left' as const },
                  ].map((col) => (
                    <th
                      key={col.key}
                      className={`py-3 px-3 font-bold text-text-muted uppercase tracking-wider cursor-pointer hover:text-text-main transition-colors text-${col.align}`}
                      onClick={() => toggleSort(col.key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        <SortIcon field={col.key} />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {sortedHoldings.map((h: any, i: number) => (
                  <tr key={i} className={`border-b border-gray-50 hover:bg-blue-50/30 transition-colors ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
                    <td className="py-3 px-3">
                      <div className="font-extrabold text-text-main">{h.symbol}</div>
                      <div className="text-[10px] text-text-muted truncate max-w-[150px]">{h.name}</div>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-text-main">{h.weight.toFixed(1)}%</td>
                    <td className="py-3 px-3 text-right font-bold text-text-main">{h.price > 0 ? `$${h.price.toFixed(2)}` : '—'}</td>
                    <td className="py-3 px-3 text-right font-bold text-text-main">{h.targetPrice ? `$${h.targetPrice.toFixed(2)}` : '—'}</td>
                    <td className={`py-3 px-3 text-right font-bold ${
                      h.upside === null ? 'text-text-muted' : h.upside >= 0 ? 'text-[#58CC02]' : 'text-[#FF4B4B]'
                    }`}>
                      {h.upside !== null ? `${h.upside >= 0 ? '+' : ''}${h.upside.toFixed(1)}%` : '—'}
                    </td>
                    <td className="py-3 px-3 text-right text-text-main">{h.pe ? h.pe.toFixed(1) : '—'}</td>
                    <td className="py-3 px-3 text-right text-text-main">
                      {h.dividendYield ? `${(h.dividendYield * 100).toFixed(2)}%` : '—'}
                    </td>
                    <td className="py-3 px-3 text-right text-text-main">{h.beta ? h.beta.toFixed(2) : '—'}</td>
                    <td className="py-3 px-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-text-muted whitespace-nowrap">
                        {h.gicSector || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
