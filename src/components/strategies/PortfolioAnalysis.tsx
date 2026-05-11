'use client';

import { useState, useMemo } from 'react';
import {
  PieChart as PieIcon, TrendingUp, Shield, BarChart3, List,
  Download, ChevronUp, ChevronDown,
  Globe, Briefcase, ArrowUpRight, ArrowDownRight,
  Loader2, FileText, Zap, DollarSign, Activity, Brain,
  AlertTriangle, Percent,
} from 'lucide-react';
import {
  LineChart, Line as RLine, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie,
  Legend, Area, AreaChart, ReferenceLine,
} from 'recharts';

// ── DUO Colors ──────────────────────────────────────────────────────────────

const DUO = {
  green: '#58CC02', greenDark: '#45a300',
  blue: '#1CB0F6', blueDark: '#1899d6',
  purple: '#CE82FF', purpleDark: '#b06edb',
  orange: '#FF9600', orangeDark: '#e08600',
  red: '#FF4B4B',
  teal: '#00CD9C',
  navy: '#03045e',
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

const RISK_COLORS: Record<string, string> = {
  'Conservateur': DUO.green, 'Modéré': DUO.blue, 'Croissance': DUO.orange, 'Audacieux': DUO.red,
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

type Tab = 'overview' | 'allocation' | 'performance' | 'risk' | 'simulation' | 'holdings';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Props { data: any; }

// ── Component ──────────────────────────────────────────────────────────────

export function PortfolioAnalysis({ data }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [sortField, setSortField] = useState<string>('weight');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const tabs: { key: Tab; label: string; icon: typeof PieIcon }[] = [
    { key: 'overview', label: 'Sommaire', icon: Briefcase },
    { key: 'allocation', label: 'Allocation', icon: PieIcon },
    { key: 'performance', label: 'Rendements', icon: TrendingUp },
    { key: 'risk', label: 'Risque', icon: Shield },
    { key: 'simulation', label: 'Simulation', icon: Zap },
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
  const ai = data.aiNarrative;
  const riskProfile = data.riskProfile;
  const concentration = data.concentration;

  // Recharts data prep
  const growthChartData = useMemo(() => {
    const gs = data.growthSeries ?? [];
    // Build multi-index aligned data
    const multiIndex = data.multiIndex ?? [];
    return gs.map((p: { date: string; portfolio: number; benchmark: number }, i: number) => {
      const point: Record<string, number | string> = {
        date: p.date.slice(0, 7),
        Portefeuille: p.portfolio,
        [data.benchmark]: p.benchmark,
      };
      for (const idx of multiIndex.slice(2)) {
        const val = idx.growthSeries[i];
        if (val) point[idx.label] = val.value;
      }
      return point;
    });
  }, [data.growthSeries, data.multiIndex, data.benchmark]);

  const annualChartData = useMemo(() =>
    (data.annualReturns ?? []).map((ar: { year: number; portfolio: number; benchmark: number }) => ({
      year: ar.year.toString(),
      Portefeuille: +(ar.portfolio * 100).toFixed(1),
      Benchmark: +(ar.benchmark * 100).toFixed(1),
    })),
  [data.annualReturns]);

  const sectorPieData = useMemo(() =>
    (data.sectors ?? []).map((s: { sector: string; weight: number }) => ({
      name: s.sector,
      value: +s.weight.toFixed(1),
      fill: SECTOR_COLORS[s.sector] ?? '#94a3b8',
    })),
  [data.sectors]);

  const multiIndexColors = [DUO.blue, '#94a3b8', DUO.red, DUO.green, DUO.purple];

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-gray-100/80 rounded-xl p-1 mb-6 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold transition-all flex-1 justify-center min-w-[80px] ${
              activeTab === t.key ? 'bg-white text-text-main shadow-sm' : 'text-text-muted hover:text-text-main'
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
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
          {/* Risk profile badge */}
          {riskProfile && (
            <div className="flex items-center gap-4 p-4 rounded-2xl" style={{ backgroundColor: `${RISK_COLORS[riskProfile.level]}10`, border: `2px solid ${RISK_COLORS[riskProfile.level]}20` }}>
              <div className="px-4 py-1.5 rounded-xl text-white font-extrabold text-sm" style={{ backgroundColor: RISK_COLORS[riskProfile.level] }}>
                {riskProfile.level}
              </div>
              <p className="text-xs text-text-muted flex-1">{riskProfile.description}</p>
              <div className="text-2xl font-extrabold" style={{ color: RISK_COLORS[riskProfile.level] }}>{riskProfile.score}/100</div>
            </div>
          )}

          {/* AI Summary */}
          {ai?.executiveSummary && (
            <div className="rounded-2xl p-5" style={{ backgroundColor: '#f0fafb', border: '2px solid #00b4d820' }}>
              <div className="flex items-center gap-2 mb-3">
                <Brain className="h-4 w-4" style={{ color: DUO.blue }} />
                <span className="text-xs font-extrabold uppercase tracking-wider" style={{ color: DUO.blue }}>Analyse IA</span>
              </div>
              <p className="text-sm text-text-main leading-relaxed">{ai.executiveSummary}</p>
            </div>
          )}

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Rendement 1 an', value: fmtPct(rs.return1Y), color: rs.return1Y >= 0 ? DUO.green : DUO.red },
              { label: 'Rendement 3 ans (ann.)', value: fmtPct(rs.return3Y), color: rs.return3Y >= 0 ? DUO.green : DUO.red },
              { label: 'Sharpe 3 ans', value: fmtNum(rs.sharpe3Y), color: DUO.blue },
              { label: 'Max Drawdown', value: fmtPct(rs.maxDrawdown), color: DUO.red },
            ].map((kpi, i) => (
              <div key={i} className="rounded-2xl bg-white p-4" style={{ border: `2px solid ${kpi.color}15`, borderBottom: `4px solid ${kpi.color}25` }}>
                <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">{kpi.label}</div>
                <div className="text-2xl font-extrabold" style={{ color: kpi.color }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Strengths & Weaknesses */}
          {ai?.strengths && ai?.weaknesses && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl bg-white p-5" style={{ border: `2px solid ${DUO.green}15` }}>
                <h3 className="text-sm font-extrabold mb-3 flex items-center gap-2" style={{ color: DUO.green }}>
                  <ArrowUpRight className="h-4 w-4" /> Points forts
                </h3>
                <ul className="space-y-2">
                  {ai.strengths.map((s: string, i: number) => (
                    <li key={i} className="text-xs text-text-main flex items-start gap-2">
                      <span style={{ color: DUO.green }} className="font-bold">+</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl bg-white p-5" style={{ border: `2px solid ${DUO.red}15` }}>
                <h3 className="text-sm font-extrabold mb-3 flex items-center gap-2" style={{ color: DUO.red }}>
                  <AlertTriangle className="h-4 w-4" /> Points de vigilance
                </h3>
                <ul className="space-y-2">
                  {ai.weaknesses.map((w: string, i: number) => (
                    <li key={i} className="text-xs text-text-main flex items-start gap-2">
                      <span style={{ color: DUO.red }} className="font-bold">-</span> {w}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Two-column: fundamentals + returns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white p-5" style={{ border: '2px solid #f1f5f9' }}>
              <h3 className="text-sm font-extrabold text-text-main mb-4">Fondamentaux pondérés</h3>
              <div className="space-y-3">
                {[
                  { label: 'P/E ratio', value: fmtNum(wf.weightedPE, 1) },
                  { label: 'P/B ratio', value: fmtNum(wf.weightedPB, 2) },
                  { label: 'ROE', value: wf.weightedROE ? `${(wf.weightedROE * 100).toFixed(1)}%` : '—' },
                  { label: 'Rendement dividende', value: data.totalDivYield ? `${(data.totalDivYield * 100).toFixed(2)}%` : '—' },
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

            <div className="rounded-2xl bg-white p-5" style={{ border: '2px solid #f1f5f9' }}>
              <h3 className="text-sm font-extrabold text-text-main mb-4">Rendements</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'YTD', value: rs.returnYTD },
                  { label: '1 an', value: rs.return1Y },
                  { label: '3 ans', value: rs.return3Y },
                  { label: '5 ans', value: rs.return5Y },
                  { label: '10 ans', value: rs.return10Y },
                  { label: 'Inception', value: rs.returnSinceInception },
                ].map((item, i) => (
                  <div key={i} className="text-center p-2 rounded-xl bg-gray-50">
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
          </div>

          {/* Concentration */}
          {concentration && (
            <div className="rounded-2xl bg-white p-5" style={{ border: '2px solid #f1f5f9' }}>
              <h3 className="text-sm font-extrabold text-text-main mb-4 flex items-center gap-2">
                <Activity className="h-4 w-4" style={{ color: DUO.purple }} />
                Concentration du portefeuille
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-xl bg-gray-50">
                  <div className="text-[10px] font-bold text-text-muted uppercase mb-1">HHI</div>
                  <div className="text-xl font-extrabold" style={{ color: DUO.purple }}>{concentration.herfindahl}</div>
                  <div className="text-[9px] text-text-muted mt-1">{concentration.level}</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-gray-50">
                  <div className="text-[10px] font-bold text-text-muted uppercase mb-1">Pos. effectives</div>
                  <div className="text-xl font-extrabold text-text-main">{concentration.effectivePositions.toFixed(1)}</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-gray-50">
                  <div className="text-[10px] font-bold text-text-muted uppercase mb-1">Top 5</div>
                  <div className="text-xl font-extrabold text-text-main">{(concentration.top5Weight * 100).toFixed(0)}%</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-gray-50">
                  <div className="text-[10px] font-bold text-text-muted uppercase mb-1">Top 10</div>
                  <div className="text-xl font-extrabold text-text-main">{(concentration.top10Weight * 100).toFixed(0)}%</div>
                </div>
              </div>
            </div>
          )}

          {/* Sources */}
          <div className="flex items-center gap-4 py-3 px-4 rounded-xl bg-gray-50">
            <FileText className="h-4 w-4 text-text-muted flex-shrink-0" />
            <div className="text-[10px] text-text-muted">
              <strong>Sources :</strong> Fondamentaux — {data.sources?.fundamentals} · Prix — {data.sources?.prices} · Benchmark — {data.sources?.benchmark} · Généré le {new Date(data.sources?.generatedAt).toLocaleDateString('fr-CA')}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ ALLOCATION TAB ═══════════════ */}
      {activeTab === 'allocation' && (
        <div className="space-y-6">
          {ai?.allocationComment && (
            <div className="rounded-2xl p-4" style={{ backgroundColor: '#f0fafb', border: '2px solid #00b4d820' }}>
              <div className="flex items-center gap-2 mb-2">
                <Brain className="h-3.5 w-3.5" style={{ color: DUO.blue }} />
                <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: DUO.blue }}>Commentaire IA</span>
              </div>
              <p className="text-xs text-text-main leading-relaxed">{ai.allocationComment}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sector pie chart */}
            <div className="rounded-2xl bg-white p-5" style={{ border: '2px solid #f1f5f9' }}>
              <h3 className="text-sm font-extrabold text-text-main mb-4">Répartition sectorielle</h3>
              <div className="h-64">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={sectorPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                      {sectorPieData.map((entry: { fill: string }, i: number) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Sector bars */}
            <div className="rounded-2xl bg-white p-5" style={{ border: '2px solid #f1f5f9' }}>
              <h3 className="text-sm font-extrabold text-text-main mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" style={{ color: DUO.purple }} />
                Pondération sectorielle
              </h3>
              <div className="space-y-2.5">
                {(data.sectors ?? []).map((s: { sector: string; weight: number }, i: number) => {
                  const color = SECTOR_COLORS[s.sector] ?? '#94a3b8';
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-28 text-[11px] text-text-main truncate">{s.sector}</span>
                      <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${s.weight}%`, backgroundColor: color }} />
                      </div>
                      <span className="w-10 text-xs font-bold text-text-main text-right">{s.weight.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
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
                const colors: Record<string, string> = { 'Canada': DUO.red, 'États-Unis': DUO.blue, 'Europe': DUO.purple, 'Asie-Pacifique': DUO.orange, 'Autre': '#94a3b8' };
                const color = colors[g.region] ?? '#94a3b8';
                return (
                  <div key={i} className="rounded-xl p-4 text-center" style={{ backgroundColor: `${color}10`, border: `1px solid ${color}20` }}>
                    <div className="text-xl font-extrabold" style={{ color }}>{g.weight.toFixed(0)}%</div>
                    <div className="text-xs font-bold text-text-main mt-1">{g.region}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Currency Exposure */}
          {data.currencyExposure?.length > 0 && (
            <div className="rounded-2xl bg-white p-5" style={{ border: '2px solid #f1f5f9' }}>
              <h3 className="text-sm font-extrabold text-text-main mb-4 flex items-center gap-2">
                <DollarSign className="h-4 w-4" style={{ color: DUO.orange }} />
                Exposition aux devises
              </h3>
              <div className="flex h-4 rounded-full overflow-hidden mb-3">
                {data.currencyExposure.map((c: { currency: string; weight: number }, i: number) => {
                  const colors: Record<string, string> = { 'CAD': DUO.red, 'USD': DUO.blue, 'EUR': DUO.purple, 'GBP': DUO.green };
                  return <div key={i} className="h-full" style={{ width: `${c.weight * 100}%`, backgroundColor: colors[c.currency] ?? '#94a3b8' }} />;
                })}
              </div>
              <div className="flex gap-4 flex-wrap">
                {data.currencyExposure.map((c: { currency: string; weight: number; label: string }, i: number) => {
                  const colors: Record<string, string> = { 'CAD': DUO.red, 'USD': DUO.blue, 'EUR': DUO.purple, 'GBP': DUO.green };
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: colors[c.currency] ?? '#94a3b8' }} />
                      <span className="text-xs text-text-main">{c.label}: {(c.weight * 100).toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Style Matrix */}
          <div className="rounded-2xl bg-white p-5" style={{ border: '2px solid #f1f5f9' }}>
            <h3 className="text-sm font-extrabold text-text-main mb-4">Matrice de style (Morningstar)</h3>
            <div className="max-w-xs mx-auto">
              <div className="grid grid-cols-3 gap-1">
                {(['large-value', 'large-blend', 'large-growth',
                  'mid-value', 'mid-blend', 'mid-growth',
                  'small-value', 'small-blend', 'small-growth'] as const).map((box) => {
                  const weight = (data.styleMatrix?.[box] ?? 0) * 100;
                  const intensity = Math.min(weight / 40, 1);
                  return (
                    <div key={box} className="aspect-square rounded-lg flex flex-col items-center justify-center p-2"
                      style={{
                        backgroundColor: weight > 0 ? `rgba(28, 176, 246, ${0.05 + intensity * 0.45})` : '#f8fafc',
                        border: weight > 0 ? '2px solid rgba(28, 176, 246, 0.3)' : '1px solid #e5e7eb',
                      }}>
                      <span className="text-[10px] text-text-muted text-center whitespace-pre-line leading-tight">{STYLE_LABELS[box]}</span>
                      <span className={`text-lg font-extrabold mt-1 ${weight > 0 ? '' : 'text-gray-300'}`} style={weight > 0 ? { color: DUO.blue } : {}}>
                        {weight > 0 ? `${weight.toFixed(0)}%` : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ PERFORMANCE TAB ═══════════════ */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          {ai?.performanceComment && (
            <div className="rounded-2xl p-4" style={{ backgroundColor: '#f0fafb', border: '2px solid #00b4d820' }}>
              <div className="flex items-center gap-2 mb-2">
                <Brain className="h-3.5 w-3.5" style={{ color: DUO.blue }} />
                <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: DUO.blue }}>Commentaire IA</span>
              </div>
              <p className="text-xs text-text-main leading-relaxed">{ai.performanceComment}</p>
            </div>
          )}

          {/* Growth of $10K — Multi-index chart */}
          <div className="rounded-2xl bg-white p-5" style={{ border: '2px solid #f1f5f9' }}>
            <h3 className="text-sm font-extrabold text-text-main mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" style={{ color: DUO.green }} />
              Croissance de 10 000$ — Multi-indices
            </h3>
            {growthChartData.length > 2 ? (
              <div className="h-72">
                <ResponsiveContainer>
                  <LineChart data={growthChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={(v) => fmt(Number(v))} labelStyle={{ fontSize: 11 }} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    {Object.keys(growthChartData[0] ?? {}).filter(k => k !== 'date').map((key, i) => (
                      <RLine key={key} type="monotone" dataKey={key} stroke={multiIndexColors[i % multiIndexColors.length]}
                        strokeWidth={i === 0 ? 2.5 : 1.5} dot={false} strokeDasharray={i > 1 ? '5 3' : undefined} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="text-xs text-text-muted">Données insuffisantes</p>}
          </div>

          {/* Annual returns bar chart */}
          <div className="rounded-2xl bg-white p-5" style={{ border: '2px solid #f1f5f9' }}>
            <h3 className="text-sm font-extrabold text-text-main mb-4">Rendements annuels</h3>
            {annualChartData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={annualChartData} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={0.5} />
                    <Bar dataKey="Portefeuille" radius={[4, 4, 0, 0]}>
                      {annualChartData.map((entry: { Portefeuille: number }, i: number) => (
                        <Cell key={i} fill={entry.Portefeuille >= 0 ? DUO.blue : DUO.red} />
                      ))}
                    </Bar>
                    <Bar dataKey="Benchmark" radius={[4, 4, 0, 0]} fill="#94a3b8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="text-xs text-text-muted">Données insuffisantes</p>}
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
          {ai?.riskComment && (
            <div className="rounded-2xl p-4" style={{ backgroundColor: '#f0fafb', border: '2px solid #00b4d820' }}>
              <div className="flex items-center gap-2 mb-2">
                <Brain className="h-3.5 w-3.5" style={{ color: DUO.blue }} />
                <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: DUO.blue }}>Commentaire IA</span>
              </div>
              <p className="text-xs text-text-main leading-relaxed">{ai.riskComment}</p>
            </div>
          )}

          {/* Risk/return summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Écart-type 1 an', value: rs.stdDev1Y ? `${(rs.stdDev1Y * 100).toFixed(1)}%` : '—', color: DUO.orange },
              { label: 'Écart-type 3 ans', value: rs.stdDev3Y ? `${(rs.stdDev3Y * 100).toFixed(1)}%` : '—', color: DUO.orange },
              { label: 'Écart-type 5 ans', value: rs.stdDev5Y ? `${(rs.stdDev5Y * 100).toFixed(1)}%` : '—', color: DUO.orange },
              { label: 'Sharpe 1 an', value: fmtNum(rs.sharpe1Y), color: DUO.blue },
              { label: 'Sharpe 3 ans', value: fmtNum(rs.sharpe3Y), color: DUO.blue },
              { label: 'Sortino 3 ans', value: fmtNum(rs.sortino3Y), color: DUO.purple },
            ].map((item, i) => (
              <div key={i} className="rounded-2xl bg-white p-4 text-center" style={{ border: `1px solid ${item.color}20` }}>
                <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">{item.label}</div>
                <div className="text-2xl font-extrabold" style={{ color: item.color }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Relative stats */}
          <div className="rounded-2xl bg-white p-5" style={{ border: '2px solid #f1f5f9' }}>
            <h3 className="text-sm font-extrabold text-text-main mb-4">Statistiques relatives (3 ans) vs {data.benchmark}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Alpha', value: rs.alpha3Y !== null ? fmtPct(rs.alpha3Y) : '—', desc: 'Surperformance ajustée' },
                { label: 'Beta', value: fmtNum(rs.beta3Y), desc: 'Sensibilité au marché' },
                { label: 'R²', value: rs.rSquared3Y !== null ? `${(rs.rSquared3Y * 100).toFixed(0)}%` : '—', desc: 'Corrélation benchmark' },
                { label: 'Info Ratio', value: fmtNum(rs.informationRatio3Y), desc: 'Rend. excéd. / risque actif' },
              ].map((item, i) => (
                <div key={i} className="p-3 rounded-xl bg-gray-50">
                  <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">{item.label}</div>
                  <div className="text-xl font-extrabold text-text-main">{item.value}</div>
                  <div className="text-[9px] text-text-muted mt-1">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Capture ratios + Max DD */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Capture hausse', value: rs.captureUpside3Y !== null ? `${rs.captureUpside3Y.toFixed(0)}%` : '—', color: DUO.green },
              { label: 'Capture baisse', value: rs.captureDownside3Y !== null ? `${rs.captureDownside3Y.toFixed(0)}%` : '—', color: DUO.red },
              { label: 'Tracking Error', value: rs.trackingError3Y !== null ? `${(rs.trackingError3Y * 100).toFixed(1)}%` : '—', color: DUO.orange },
              { label: 'Max Drawdown', value: fmtPct(rs.maxDrawdown), color: DUO.red },
            ].map((item, i) => (
              <div key={i} className="rounded-2xl bg-white p-4 text-center" style={{ border: `1px solid ${item.color}20` }}>
                <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">{item.label}</div>
                <div className="text-xl font-extrabold" style={{ color: item.color }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Stress Tests */}
          {data.stressTests?.length > 0 && (
            <div className="rounded-2xl bg-white p-5" style={{ border: '2px solid #f1f5f9' }}>
              <h3 className="text-sm font-extrabold text-text-main mb-4 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" style={{ color: DUO.red }} />
                Tests de résistance
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-bold text-text-muted">Événement</th>
                      <th className="text-left py-2 px-3 font-bold text-text-muted">Période</th>
                      <th className="text-right py-2 px-3 font-bold text-text-muted">Portefeuille</th>
                      <th className="text-right py-2 px-3 font-bold text-text-muted">Benchmark</th>
                      <th className="text-right py-2 px-3 font-bold text-text-muted">Drawdown</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {data.stressTests.map((st: any, i: number) => (
                      <tr key={i} className={`border-b border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                        <td className="py-2.5 px-3 font-bold text-text-main">{st.name}</td>
                        <td className="py-2.5 px-3 text-text-muted">{st.period}</td>
                        <td className={`py-2.5 px-3 text-right font-bold ${st.portfolioReturn >= 0 ? 'text-[#58CC02]' : 'text-[#FF4B4B]'}`}>
                          {fmtPct(st.portfolioReturn)}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-bold ${st.benchmarkReturn >= 0 ? 'text-[#58CC02]' : 'text-[#FF4B4B]'}`}>
                          {fmtPct(st.benchmarkReturn)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-[#FF4B4B]">{fmtPct(st.maxDrawdown)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ SIMULATION TAB ═══════════════ */}
      {activeTab === 'simulation' && (
        <div className="space-y-6">
          {/* Monte Carlo */}
          {data.monteCarlo && (
            <>
              <div className="rounded-2xl bg-white p-5" style={{ border: '2px solid #f1f5f9' }}>
                <h3 className="text-sm font-extrabold text-text-main mb-2 flex items-center gap-2">
                  <Zap className="h-4 w-4" style={{ color: DUO.blue }} />
                  Simulation Monte Carlo — 5 ans
                </h3>
                <p className="text-xs text-text-muted mb-4">1 000 scénarios basés sur la distribution historique des rendements mensuels</p>

                <div className="h-64">
                  <ResponsiveContainer>
                    <AreaChart data={data.monteCarlo.percentile50.map((_: number, i: number) => ({
                      month: i,
                      p5: data.monteCarlo.percentile5[i],
                      p25: data.monteCarlo.percentile25[i],
                      median: data.monteCarlo.percentile50[i],
                      p75: data.monteCarlo.percentile75[i],
                      p95: data.monteCarlo.percentile95[i],
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={(v: number) => v % 12 === 0 ? `An ${v / 12}` : ''} interval={11} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} />
                      <Tooltip formatter={(v) => fmt(Number(v))} labelFormatter={(l) => `Mois ${l}`} />
                      <Area type="monotone" dataKey="p95" stackId="band" fill="rgba(28,176,246,0.08)" stroke="none" />
                      <Area type="monotone" dataKey="p75" stackId="band2" fill="rgba(28,176,246,0.12)" stroke="none" />
                      <RLine type="monotone" dataKey="median" stroke={DUO.blue} strokeWidth={2.5} dot={false} name="Médiane" />
                      <Area type="monotone" dataKey="p25" stackId="band3" fill="rgba(28,176,246,0.08)" stroke="none" />
                      <Area type="monotone" dataKey="p5" stackId="band4" fill="rgba(28,176,246,0.04)" stroke="none" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Monte Carlo results */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Scénario médian', value: fmt(data.monteCarlo.medianFinal), color: DUO.blue },
                  { label: 'Pire scénario (5e)', value: fmt(data.monteCarlo.worstCase), color: DUO.red },
                  { label: 'Prob. de gain', value: `${(data.monteCarlo.probPositive * 100).toFixed(0)}%`, color: DUO.green },
                  { label: 'Prob. de doubler', value: `${(data.monteCarlo.probDoubling * 100).toFixed(0)}%`, color: DUO.purple },
                ].map((item, i) => (
                  <div key={i} className="rounded-2xl bg-white p-4 text-center" style={{ border: `2px solid ${item.color}15`, borderBottom: `4px solid ${item.color}25` }}>
                    <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">{item.label}</div>
                    <div className="text-2xl font-extrabold" style={{ color: item.color }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Dividend Projection */}
          {data.dividendProjection?.length > 0 && (
            <div className="rounded-2xl bg-white p-5" style={{ border: '2px solid #f1f5f9' }}>
              <h3 className="text-sm font-extrabold text-text-main mb-2 flex items-center gap-2">
                <Percent className="h-4 w-4" style={{ color: DUO.green }} />
                Projection des dividendes (5 ans)
              </h3>
              <p className="text-xs text-text-muted mb-4">Investissement de 100 000 $, croissance des dividendes estimée à 5% / an</p>
              <div className="h-48">
                <ResponsiveContainer>
                  <BarChart data={data.dividendProjection}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}K$`} />
                    <Tooltip formatter={(v) => fmt(Number(v))} />
                    <Bar dataKey="income" name="Revenu" radius={[6, 6, 0, 0]} fill={DUO.green} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Risk Contributions */}
          {data.riskContributions?.length > 0 && (
            <div className="rounded-2xl bg-white p-5" style={{ border: '2px solid #f1f5f9' }}>
              <h3 className="text-sm font-extrabold text-text-main mb-4 flex items-center gap-2">
                <Activity className="h-4 w-4" style={{ color: DUO.purple }} />
                Contribution au risque par position
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 font-bold text-text-muted">Titre</th>
                      <th className="text-right py-2 px-2 font-bold text-text-muted">Poids</th>
                      <th className="text-right py-2 px-2 font-bold text-text-muted">Volatilité</th>
                      <th className="text-right py-2 px-2 font-bold text-text-muted">Contrib. risque</th>
                      <th className="text-right py-2 px-2 font-bold text-text-muted">Contrib. rend.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {[...data.riskContributions].sort((a: any, b: any) => Math.abs(b.riskContribution) - Math.abs(a.riskContribution)).slice(0, 15).map((c: any, i: number) => (
                      <tr key={i} className={`border-b border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                        <td className="py-2 px-2 font-bold text-text-main">{c.symbol}</td>
                        <td className="py-2 px-2 text-right">{(c.weight * 100).toFixed(1)}%</td>
                        <td className="py-2 px-2 text-right">{(c.volatility * 100).toFixed(1)}%</td>
                        <td className={`py-2 px-2 text-right font-bold ${c.riskContribution > 0 ? 'text-[#FF4B4B]' : 'text-[#58CC02]'}`}>
                          {c.riskContribution.toFixed(1)}%
                        </td>
                        <td className={`py-2 px-2 text-right font-bold ${c.returnContribution >= 0 ? 'text-[#58CC02]' : 'text-[#FF4B4B]'}`}>
                          {fmtPct(c.returnContribution)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AI Outlook */}
          {ai?.outlook && (
            <div className="rounded-2xl p-5" style={{ backgroundColor: '#f0fafb', border: '2px solid #00b4d820' }}>
              <div className="flex items-center gap-2 mb-3">
                <Brain className="h-4 w-4" style={{ color: DUO.blue }} />
                <span className="text-xs font-extrabold uppercase tracking-wider" style={{ color: DUO.blue }}>Perspectives IA</span>
              </div>
              <p className="text-sm text-text-main leading-relaxed">{ai.outlook}</p>
            </div>
          )}
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
