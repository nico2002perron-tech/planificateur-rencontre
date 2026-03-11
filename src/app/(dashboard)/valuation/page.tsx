'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import useSWR from 'swr';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { Search, TrendingUp, TrendingDown, Minus, RefreshCw, AlertCircle, BarChart2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { calculateValuation, solveReverseDcf, buildSensitivityMatrix } from '@/lib/valuation/dcf';
import { getBenchmarkData } from '@/lib/valuation/benchmarks';
import { scoreOutOf10, relativeValuationLabel } from '@/lib/valuation/scoring';

// ─── TradingView Search Hook ─────────────────────────────────────────────────

interface TVResult { symbol: string; name: string; exchange: string; type: string; logo: string | null; }
const tvFetcher = (url: string) => fetch(url).then(r => r.json());

function useTradingViewSearch(query: string) {
  const key = query.length >= 1 ? `/api/search?q=${encodeURIComponent(query)}` : null;
  const { data, isLoading } = useSWR<TVResult[]>(key, tvFetcher, { dedupingInterval: 3_000, revalidateOnFocus: false });
  return { results: Array.isArray(data) ? data : [], isLoading };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnnualRow { year: string; [key: string]: number | string }
interface PricePoint { date: string; close: number | null; volume: number | null; open: number | null; high: number | null; low: number | null }
interface RecTrend { period: string; strongBuy: number; buy: number; hold: number; sell: number; strongSell: number }
interface UpgradeEntry { epochGradeDate: number; firm: string; toGrade: string; fromGrade: string; action: string }
interface InsiderEntry { date: string; name: string; relation: string; shares: number; value: number; transaction: string }
interface NewsItem { title: string; publisher: string; link: string; publishedAt: string; thumbnail?: string | null }

interface StockData {
  symbol: string;
  name: string;
  sector: string;
  currency: string;
  exchange: string;
  currentPrice: number;
  sharesOutstanding: number;
  marketCap: number;
  revenue: number;
  fcf: number;
  eps: number;
  pe: number;
  ps: number;
  cash: number;
  totalDebt: number;
  revenueGrowth: number;
  earningsGrowth: number;
  week52High: number;
  week52Low: number;
  beta: number;
  dividendYield: number;
  dividendRate: number;
  payoutRatio: number;
  exDividendDate: string | null;
  grossMargin: number;
  operatingMargin: number;
  profitMargin: number;
  returnOnEquity: number;
  returnOnAssets: number;
  debtToEquity: number;
  currentRatio: number;
  targetLow: number | null;
  targetMean: number | null;
  targetHigh: number | null;
  numAnalysts: number;
  recommendationKey: string;
  recTrend: RecTrend[];
  upgrades: UpgradeEntry[];
  insiders: InsiderEntry[];
  priceHistory: PricePoint[];
  annualData: AnnualRow[];
  news: NewsItem[];
  nextEarningsDate: string | null;
  epsEstimate: number | null;
  revenueEstimate: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, dec = 2): string {
  if (n == null || isNaN(n) || !isFinite(n)) return 'N/D';
  return n.toLocaleString('fr-CA', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtB(n: number): string {
  if (!n || isNaN(n)) return 'N/D';
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(2)} B$`;
  if (Math.abs(n) >= 1e9)  return `${(n / 1e9).toFixed(2)} G$`;
  if (Math.abs(n) >= 1e6)  return `${(n / 1e6).toFixed(2)} M$`;
  return `${n.toFixed(0)} $`;
}
function fmtPct(n: number, alreadyPct = false): string {
  if (!n || isNaN(n)) return 'N/D';
  const v = alreadyPct ? n : n * 100;
  return `${v.toFixed(1)} %`;
}
function deltaColor(d: number) { return d > 0 ? 'text-green-600' : d < 0 ? 'text-red-500' : 'text-gray-500'; }

const BRAND   = '#00b4d8';
const DARK    = '#03045e';
const GREEN   = '#2ecc71';
const RED     = '#e63946';
const YELLOW  = '#f4a261';

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: 'green' | 'red' | 'yellow' }) {
  const bg = highlight === 'green' ? 'bg-green-50 border border-green-100' : highlight === 'red' ? 'bg-red-50 border border-red-100' : highlight === 'yellow' ? 'bg-yellow-50 border border-yellow-100' : 'bg-gray-50';
  return (
    <div className={`rounded-xl p-4 ${bg}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function ScenarioCard({ label, price, current, emoji }: { label: string; price: number; current: number; emoji: string }) {
  const delta = price - current;
  return (
    <div className="bg-gray-50 rounded-xl p-4 text-center">
      <p className="text-sm font-medium text-gray-600 mb-2">{emoji} {label}</p>
      <p className="text-2xl font-bold text-brand-dark">{price > 0 ? `${fmt(price)} $` : 'N/D'}</p>
      {price > 0 && current > 0 && (
        <p className={`text-sm mt-1 font-medium ${deltaColor(delta)}`}>
          {delta >= 0 ? '+' : ''}{fmt(delta)} $ ({delta >= 0 ? '+' : ''}{((delta / current) * 100).toFixed(1)} %)
        </p>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 mt-6">{children}</h3>;
}

// ─── Onglets ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'fundamentals', label: 'Fondamentaux' },
  { id: 'dcf',          label: 'DCF' },
  { id: 'ps',           label: 'P/S' },
  { id: 'pe',           label: 'P/E' },
  { id: 'analysts',     label: 'Analystes' },
  { id: 'insiders',     label: 'Insiders' },
  { id: 'technical',    label: 'Technique' },
  { id: 'scorecard',    label: 'Scorecard' },
  { id: 'news',         label: 'Actualités' },
  { id: 'earnings',     label: 'Résultats' },
  { id: 'compare',      label: 'Comparaison' },
];

// ─── Page principale ──────────────────────────────────────────────────────────

export default function ValuationPage() {
  const [search, setSearch]         = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [data, setData]             = useState<StockData | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const { results: tvResults, isLoading: tvLoading } = useTradingViewSearch(search);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Hypothèses modifiables
  const [grSales,  setGrSales]  = useState(10);
  const [grFcf,    setGrFcf]    = useState(12);
  const [wacc,     setWacc]     = useState(9);
  const [targetPe, setTargetPe] = useState(20);
  const [targetPs, setTargetPs] = useState(5);

  // ─── Comparaison ──────────────────────────────────────────────────────────
  const [compareInput,   setCompareInput]   = useState('');
  const [compareData,    setCompareData]    = useState<StockData | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  // ─── Screener ─────────────────────────────────────────────────────────────
  const [screenerSel,      setScreenerSel]      = useState<string[]>([]);
  const [screenerData,     setScreenerData]     = useState<Record<string, StockData>>({});
  const [screenerLoading,  setScreenerLoading]  = useState(false);
  const [screenerMaxPE,    setScreenerMaxPE]    = useState(100);
  const [screenerMinGrowth,setScreenerMinGrowth]= useState(-100);

  // TradingView search results are in tvResults (from useTradingViewSearch hook)

  const analyze = useCallback(async (ticker: string) => {
    if (!ticker.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res  = await fetch(`/api/valuation/stock/${encodeURIComponent(ticker.trim())}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Erreur API');
      setData(json);
      const bench = getBenchmarkData(ticker, json.sector ?? '');
      setGrSales(bench.gr_sales);
      setGrFcf(bench.gr_fcf);
      setWacc(bench.wacc);
      setTargetPe(bench.pe);
      setTargetPs(bench.ps);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, []);

  const analyzeCompare = useCallback(async (ticker: string) => {
    if (!ticker.trim()) return;
    setCompareLoading(true);
    setCompareData(null);
    try {
      const res  = await fetch(`/api/valuation/stock/${encodeURIComponent(ticker.trim())}`);
      const json = await res.json();
      if (res.ok) setCompareData(json);
    } catch { /* silent */ }
    finally { setCompareLoading(false); }
  }, []);

  const SCREENER_PRESETS = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'BRK-B',
    'JPM', 'V', 'JNJ', 'PG', 'UNH',
    'RY.TO', 'TD.TO', 'BNS.TO', 'ENB.TO', 'CNR.TO', 'SHOP.TO', 'BCE.TO',
  ];

  const runScreener = useCallback(async () => {
    if (screenerSel.length === 0) return;
    setScreenerLoading(true);
    try {
      const settled = await Promise.allSettled(
        screenerSel.map(async (t) => {
          const res = await fetch(`/api/valuation/stock/${encodeURIComponent(t)}`);
          const j   = await res.json();
          return { ticker: t, data: j as StockData };
        })
      );
      const map: Record<string, StockData> = {};
      for (const r of settled) {
        if (r.status === 'fulfilled') map[r.value.ticker] = r.value.data;
      }
      setScreenerData(map);
    } finally {
      setScreenerLoading(false);
    }
  }, [screenerSel]);

  const bench = data ? getBenchmarkData(data.symbol, data.sector) : null;

  const runCalc = (gFac: number, mFac: number, wAdj: number): [number, number, number] =>
    data ? calculateValuation(
      (grSales / 100) * gFac, (grFcf / 100) * gFac, 0.1,
      wacc / 100 + wAdj,
      targetPs * mFac, targetPe * mFac,
      data.revenue, data.fcf, data.eps,
      data.cash, data.totalDebt, data.sharesOutstanding
    ) : [0, 0, 0];

  const [bearDcf, bearPs, bearPe] = runCalc(0.8, 0.8,  0.01);
  const [baseDcf, basePs, basePe] = runCalc(1.0, 1.0,  0.00);
  const [bullDcf, bullPs, bullPe] = runCalc(1.2, 1.2, -0.01);

  const scores = data && bench ? scoreOutOf10({
    ticker: data.symbol, price: data.currentPrice,
    pe: data.pe, ps: data.ps,
    sales_gr: data.revenueGrowth, eps_gr: data.earningsGrowth,
    net_cash: data.cash - data.totalDebt,
    fcf_yield: data.marketCap > 0 ? data.fcf / data.marketCap : 0,
    rule_40: data.revenueGrowth * 100 + (data.revenue > 0 ? (data.fcf / data.revenue) * 100 : 0),
  }, bench) : null;

  const sensitivity = data
    ? buildSensitivityMatrix(wacc, grFcf, data.fcf, data.cash, data.totalDebt, data.sharesOutstanding)
    : null;

  const recLabel = (k: string) =>
    ({ strong_buy: 'Achat fort', buy: 'Achat', hold: 'Conserver', sell: 'Vente', underperform: 'Sous-performer' }[k] ?? k);

  // Prix position dans le range 52 semaines
  const week52Pct = data && data.week52High > data.week52Low
    ? ((data.currentPrice - data.week52Low) / (data.week52High - data.week52Low)) * 100
    : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Valuation Master Pro" description="Analyse fondamentale & valorisation multi-méthodes" />

      {/* ── Sélecteur ───────────────────────────────────────────── */}
      <Card>
        <div ref={searchRef} className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">Rechercher un titre</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par nom ou ticker (ex: Apple, AAPL, RY.TO, SHOP)…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && search.trim()) {
                    setSearchOpen(false);
                    analyze(search.trim().toUpperCase());
                  }
                }}
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>
            <button
              onClick={() => { setSearchOpen(false); analyze(search.trim().toUpperCase()); }}
              disabled={loading || !search.trim()}
              className="px-5 py-2.5 bg-brand-primary text-white rounded-lg text-sm font-medium hover:bg-brand-primary/90 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
            >
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Analyser'}
            </button>
          </div>

          {/* TradingView autocomplete dropdown */}
          {searchOpen && search.length >= 1 && (
            <div className="absolute top-full left-0 right-0 mt-1 max-h-72 overflow-y-auto border border-gray-100 rounded-lg shadow-lg bg-white z-50">
              {tvLoading ? (
                <div className="flex items-center justify-center py-4 text-sm text-gray-400">
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Recherche…
                </div>
              ) : tvResults.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Aucun résultat — appuyez Entrée pour chercher directement</p>
              ) : (
                tvResults.map((r) => (
                  <button
                    key={r.symbol}
                    onClick={() => { setSearch(r.symbol); setSearchOpen(false); analyze(r.symbol); }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0 flex items-center gap-3"
                  >
                    {r.logo && (
                      <img src={r.logo} alt="" className="w-6 h-6 rounded-full object-contain flex-shrink-0 bg-gray-50" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-gray-900">{r.symbol}</span>
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{r.exchange}</span>
                        <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{r.type}</span>
                      </div>
                      <p className="text-xs text-gray-400 truncate">{r.name}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </Card>

      {/* ── Erreur ─────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* ── Résultats ─────────────────────────────────────────── */}
      {data && !loading && (
        <>
          {/* Header titre */}
          <Card padding="sm">
            <div className="flex flex-wrap items-center justify-between gap-4 px-2 py-1">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold text-brand-dark">{data.symbol}</h2>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{data.exchange}</span>
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{data.currency}</span>
                </div>
                <p className="text-gray-500 text-sm mt-0.5">{data.name} {data.sector && `· ${data.sector}`}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-brand-dark">{fmt(data.currentPrice)} <span className="text-base font-normal text-gray-400">{data.currency}</span></p>
                {week52Pct !== null && (
                  <div className="mt-1">
                    <div className="flex items-center gap-1 text-xs text-gray-400 justify-end mb-0.5">
                      <span>{fmt(data.week52Low, 0)}</span>
                      <div className="relative w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="absolute h-full bg-brand-primary rounded-full" style={{ width: `${week52Pct}%` }} />
                      </div>
                      <span>{fmt(data.week52High, 0)}</span>
                    </div>
                    <p className="text-xs text-gray-400 text-right">52 semaines ({week52Pct.toFixed(0)} %)</p>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Métriques clés */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Market Cap"        value={fmtB(data.marketCap)} />
            <MetricCard label="P/E TTM"           value={data.pe > 0 ? `${fmt(data.pe, 1)}x` : 'N/D'} sub={bench ? `Pair: ${bench.pe}x` : undefined} highlight={bench && data.pe > 0 ? (data.pe < bench.pe ? 'green' : 'red') : undefined} />
            <MetricCard label="P/S"               value={data.ps > 0 ? `${fmt(data.ps, 1)}x` : 'N/D'} sub={bench ? `Pair: ${bench.ps}x` : undefined} />
            <MetricCard label="EPS TTM"           value={data.eps !== 0 ? `${fmt(data.eps)} $` : 'N/D'} />
            <MetricCard label="Marge brute"       value={fmtPct(data.grossMargin)} />
            <MetricCard label="Marge opérat."     value={fmtPct(data.operatingMargin)} />
            <MetricCard label="Marge nette"       value={fmtPct(data.profitMargin)} highlight={data.profitMargin > 0.15 ? 'green' : data.profitMargin < 0 ? 'red' : undefined} />
            <MetricCard label="FCF"               value={data.fcf !== 0 ? fmtB(data.fcf) : 'N/D'} />
            <MetricCard label="Cash net"          value={fmtB(data.cash - data.totalDebt)} highlight={data.cash > data.totalDebt ? 'green' : 'red'} />
            <MetricCard label="ROE"               value={fmtPct(data.returnOnEquity)} />
            <MetricCard label="Beta"              value={data.beta > 0 ? fmt(data.beta) : 'N/D'} sub={data.beta > 1.5 ? 'Volatil' : data.beta < 0.8 ? 'Défensif' : 'Modéré'} />
            <MetricCard label="Dividende"         value={data.dividendRate > 0 ? `${fmt(data.dividendRate, 2)} $ (${fmtPct(data.dividendYield)})` : 'Aucun'} />
          </div>

          {/* Hypothèses */}
          <Card>
            <CardHeader><CardTitle>Hypothèses de valorisation</CardTitle></CardHeader>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {([
                { label: 'Croissance ventes %', value: grSales, set: setGrSales },
                { label: 'Croissance FCF %',    value: grFcf,   set: setGrFcf },
                { label: 'WACC %',              value: wacc,    set: setWacc },
                { label: 'P/E cible',           value: targetPe, set: setTargetPe },
                { label: 'P/S cible',           value: targetPs, set: setTargetPs },
              ] as { label: string; value: number; set: (v: number) => void }[]).map(({ label, value, set }) => (
                <div key={label}>
                  <label className="block text-xs text-gray-500 mb-1">{label}</label>
                  <input type="number" value={value}
                    onChange={(e) => set(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                </div>
              ))}
            </div>
            {bench && (
              <p className="text-xs text-gray-400 mt-3">
                Comparables: <strong>{bench.name}</strong> ({bench.source}) · {bench.peers}
              </p>
            )}
          </Card>

          {/* Onglets */}
          <Tabs tabs={TABS}>
            {(active) => (
              <>
                {/* ── FONDAMENTAUX ─────────────────────────── */}
                {active === 'fundamentals' && (
                  <div className="space-y-5">
                    {/* Revenus & Bénéfice */}
                    {data.annualData.length > 0 && (
                      <Card>
                        <CardHeader><CardTitle>Revenus & Bénéfice net (annuel)</CardTitle></CardHeader>
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart data={data.annualData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                            <YAxis tickFormatter={(v: number) => fmtB(v)} tick={{ fontSize: 11 }} width={70} />
                            <Tooltip formatter={(v: number | undefined) => v != null ? fmtB(v) : 'N/D'} />
                            <Legend />
                            <Bar dataKey="totalRevenue"  name="Revenus"       fill={BRAND} radius={[4,4,0,0]} />
                            <Bar dataKey="grossProfit"   name="Bénéfice brut" fill="#0077b6" radius={[4,4,0,0]} />
                            <Bar dataKey="netIncome"     name="Bénéfice net"  fill={DARK} radius={[4,4,0,0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </Card>
                    )}

                    {/* FCF & Cash flows */}
                    {data.annualData.length > 0 && (
                      <Card>
                        <CardHeader><CardTitle>Free Cash Flow & Flux opérationnel (annuel)</CardTitle></CardHeader>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={data.annualData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                            <YAxis tickFormatter={(v: number) => fmtB(v)} tick={{ fontSize: 11 }} width={70} />
                            <Tooltip formatter={(v: number | undefined) => v != null ? fmtB(v) : 'N/D'} />
                            <Legend />
                            <Bar dataKey="operatingCashFlow" name="Flux opérationnel" fill={BRAND}   radius={[4,4,0,0]} />
                            <Bar dataKey="freeCashFlow"      name="Free Cash Flow"    fill="#0077b6" radius={[4,4,0,0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </Card>
                    )}

                    {/* Cash vs Dette */}
                    {data.annualData.length > 0 && (
                      <Card>
                        <CardHeader><CardTitle>Cash vs Dette totale (annuel)</CardTitle></CardHeader>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={data.annualData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                            <YAxis tickFormatter={(v: number) => fmtB(v)} tick={{ fontSize: 11 }} width={70} />
                            <Tooltip formatter={(v: number | undefined) => v != null ? fmtB(v) : 'N/D'} />
                            <Legend />
                            <Bar dataKey="cashAndCashEquivalents" name="Cash"       fill={GREEN} radius={[4,4,0,0]} />
                            <Bar dataKey="totalDebt"              name="Dette tot." fill={RED}   radius={[4,4,0,0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </Card>
                    )}

                    {/* Marges actuelles */}
                    <Card>
                      <CardHeader><CardTitle>Marges & Ratios actuels</CardTitle></CardHeader>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {[
                          { label: 'Marge brute',      val: data.grossMargin },
                          { label: 'Marge opération.', val: data.operatingMargin },
                          { label: 'Marge nette',      val: data.profitMargin },
                          { label: 'ROE',              val: data.returnOnEquity },
                          { label: 'ROA',              val: data.returnOnAssets },
                          { label: 'Ratio courant',    val: data.currentRatio, isRatio: true },
                        ].map(({ label, val, isRatio }) => (
                          <div key={label}>
                            <p className="text-xs text-gray-500 mb-1">{label}</p>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-brand-primary" style={{ width: `${Math.min(100, Math.abs(isRatio ? val * 33 : val * 100))}%`, backgroundColor: val < 0 ? RED : BRAND }} />
                              </div>
                              <span className={`text-sm font-bold w-14 text-right ${val < 0 ? 'text-red-500' : 'text-gray-800'}`}>
                                {isRatio ? fmt(val, 2) : fmtPct(val)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {data.dividendRate > 0 && (
                        <>
                          <SectionTitle>Dividende</SectionTitle>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <MetricCard label="Taux annuel"     value={`${fmt(data.dividendRate)} $`} />
                            <MetricCard label="Rendement"       value={fmtPct(data.dividendYield)} />
                            <MetricCard label="Taux versement"  value={fmtPct(data.payoutRatio)} />
                            <MetricCard label="Ex-dividende"    value={data.exDividendDate ?? 'N/D'} />
                          </div>
                        </>
                      )}
                    </Card>
                  </div>
                )}

                {/* ── DCF ─────────────────────────────────── */}
                {active === 'dcf' && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <ScenarioCard label="Bear" price={bearDcf} current={data.currentPrice} emoji="🐻" />
                      <ScenarioCard label="Neutre" price={baseDcf} current={data.currentPrice} emoji="🎯" />
                      <ScenarioCard label="Bull"  price={bullDcf} current={data.currentPrice} emoji="🐂" />
                    </div>
                    {data.fcf > 0 && (
                      <Card>
                        <CardHeader><CardTitle>Reverse DCF — Croissance implicite du marché</CardTitle></CardHeader>
                        <p className="text-sm text-gray-600">
                          Le marché intègre actuellement une croissance FCF de{' '}
                          <strong className="text-brand-dark text-lg">
                            {(solveReverseDcf(data.currentPrice, data.fcf, wacc / 100, data.sharesOutstanding, data.cash, data.totalDebt) * 100).toFixed(1)} %
                          </strong>
                          {' '}par an pendant 5 ans.
                        </p>
                      </Card>
                    )}
                    {sensitivity && (
                      <Card>
                        <CardHeader><CardTitle>Matrice de sensibilité — Prix DCF ($)</CardTitle></CardHeader>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr>
                                <th className="p-2 text-left text-gray-400 text-xs font-medium"></th>
                                {sensitivity.cols.map((c) => (
                                  <th key={c} className="p-2 text-center text-gray-500 text-xs font-medium">{c}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {sensitivity.rows.map((row, i) => (
                                <tr key={row} className="border-t border-gray-50">
                                  <td className="p-2 text-gray-500 text-xs font-medium whitespace-nowrap">{row}</td>
                                  {sensitivity.data[i].map((val, j) => {
                                    const ratio = data.currentPrice > 0 ? val / data.currentPrice : 1;
                                    const bg = ratio > 1.15 ? 'bg-green-100 text-green-800' : ratio < 0.85 ? 'bg-red-100 text-red-800' : 'bg-yellow-50 text-yellow-800';
                                    return <td key={j} className={`p-2 text-center rounded text-xs font-semibold ${bg}`}>{fmt(val)} $</td>;
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    )}
                  </div>
                )}

                {/* ── P/S ─────────────────────────────────── */}
                {active === 'ps' && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <ScenarioCard label="Bear" price={bearPs} current={data.currentPrice} emoji="🐻" />
                      <ScenarioCard label="Neutre" price={basePs} current={data.currentPrice} emoji="🎯" />
                      <ScenarioCard label="Bull"  price={bullPs} current={data.currentPrice} emoji="🐂" />
                    </div>
                    {bench && (
                      <Card>
                        <CardHeader><CardTitle>P/S relatif — {data.symbol} vs {bench.name}</CardTitle></CardHeader>
                        {(() => {
                          const { label, color } = relativeValuationLabel(data.ps, bench.ps);
                          return (
                            <div className="space-y-3">
                              <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${color === 'green' ? 'bg-green-100 text-green-700' : color === 'red' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{label}</span>
                              <div className="flex gap-8 text-sm"><span>P/S actuel: <strong>{fmt(data.ps, 1)}x</strong></span><span>P/S pair: <strong>{bench.ps}x</strong></span></div>
                            </div>
                          );
                        })()}
                      </Card>
                    )}
                  </div>
                )}

                {/* ── P/E ─────────────────────────────────── */}
                {active === 'pe' && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <ScenarioCard label="Bear" price={bearPe} current={data.currentPrice} emoji="🐻" />
                      <ScenarioCard label="Neutre" price={basePe} current={data.currentPrice} emoji="🎯" />
                      <ScenarioCard label="Bull"  price={bullPe} current={data.currentPrice} emoji="🐂" />
                    </div>
                    {bench && (
                      <Card>
                        <CardHeader><CardTitle>P/E relatif — {data.symbol} vs {bench.name}</CardTitle></CardHeader>
                        {(() => {
                          const { label, color } = relativeValuationLabel(data.pe, bench.pe);
                          return (
                            <div className="space-y-3">
                              <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${color === 'green' ? 'bg-green-100 text-green-700' : color === 'red' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{label}</span>
                              <div className="flex gap-8 text-sm"><span>P/E actuel: <strong>{fmt(data.pe, 1)}x</strong></span><span>P/E pair: <strong>{bench.pe}x</strong></span></div>
                            </div>
                          );
                        })()}
                      </Card>
                    )}
                  </div>
                )}

                {/* ── ANALYSTES ──────────────────────────── */}
                {active === 'analysts' && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <MetricCard label="Consensus" value={recLabel(data.recommendationKey)} highlight={['buy','strong_buy'].includes(data.recommendationKey) ? 'green' : ['sell','underperform'].includes(data.recommendationKey) ? 'red' : 'yellow'} />
                      <MetricCard label="Nb analystes" value={`${data.numAnalysts}`} />
                      {data.targetMean != null && <MetricCard label="Cible moyenne" value={`${fmt(data.targetMean)} $`} sub={`Potentiel: ${((data.targetMean - data.currentPrice) / data.currentPrice * 100).toFixed(1)} %`} highlight={(data.targetMean - data.currentPrice) / data.currentPrice > 0.1 ? 'green' : 'yellow'} />}
                      {data.targetHigh != null && <MetricCard label="Cible haute"   value={`${fmt(data.targetHigh)} $`} />}
                    </div>

                    {data.recTrend.length > 0 && (
                      <Card>
                        <CardHeader><CardTitle>Répartition des recommandations</CardTitle></CardHeader>
                        {(() => {
                          const l = data.recTrend[0];
                          const rd = [
                            { name: 'Achat fort', value: l.strongBuy,   fill: '#00b4d8' },
                            { name: 'Achat',      value: l.buy,         fill: '#0077b6' },
                            { name: 'Conserver',  value: l.hold,        fill: '#90e0ef' },
                            { name: 'Vente',      value: l.sell,        fill: RED },
                            { name: 'Vente forte',value: l.strongSell,  fill: '#9d0208' },
                          ].filter((d) => d.value > 0);
                          return (
                            <ResponsiveContainer width="100%" height={200}>
                              <BarChart data={rd} layout="vertical">
                                <XAxis type="number" tick={{ fontSize: 11 }} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={90} />
                                <Tooltip />
                                <Bar dataKey="value" radius={[0,4,4,0]}>
                                  {rd.map((e, i) => <Cell key={i} fill={e.fill} />)}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          );
                        })()}
                      </Card>
                    )}

                    {data.upgrades.length > 0 && (
                      <Card>
                        <CardHeader><CardTitle>Upgrades / Downgrades récents</CardTitle></CardHeader>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-100">
                                {['Date', 'Firme', 'Action', 'Nouvelle note', 'Ancienne note'].map((h) => (
                                  <th key={h} className="text-left p-2 text-gray-400 font-medium text-xs">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {data.upgrades.map((u, i) => {
                                const g = u.toGrade?.toLowerCase() ?? '';
                                const gc = g.includes('buy') || g.includes('outperform') ? 'text-green-600' : g.includes('sell') || g.includes('underperform') ? 'text-red-500' : 'text-yellow-600';
                                return (
                                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                                    <td className="p-2 text-gray-400 text-xs">{new Date(u.epochGradeDate * 1000).toLocaleDateString('fr-CA')}</td>
                                    <td className="p-2 font-medium text-xs">{u.firm}</td>
                                    <td className="p-2 text-gray-400 text-xs">{u.action}</td>
                                    <td className={`p-2 font-semibold text-xs ${gc}`}>{u.toGrade}</td>
                                    <td className="p-2 text-gray-300 text-xs">{u.fromGrade}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    )}
                  </div>
                )}

                {/* ── INSIDERS ────────────────────────────── */}
                {active === 'insiders' && (
                  <Card>
                    <CardHeader><CardTitle>Transactions des insiders</CardTitle></CardHeader>
                    {data.insiders.length === 0 ? (
                      <p className="text-sm text-gray-400">Aucune donnée disponible pour ce titre.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100">
                              {['Date', 'Nom', 'Rôle', 'Actions', 'Valeur', 'Transaction'].map((h) => (
                                <th key={h} className="text-left p-2 text-gray-400 font-medium text-xs">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {data.insiders.map((ins, i) => (
                              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="p-2 text-gray-400 text-xs">{ins.date}</td>
                                <td className="p-2 font-medium text-xs">{ins.name}</td>
                                <td className="p-2 text-gray-400 text-xs">{ins.relation}</td>
                                <td className="p-2 text-xs">{ins.shares?.toLocaleString('fr-CA')}</td>
                                <td className="p-2 text-xs">{ins.value ? fmtB(ins.value) : 'N/D'}</td>
                                <td className="p-2 text-gray-400 text-xs">{ins.transaction}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                )}

                {/* ── TECHNIQUE ───────────────────────────── */}
                {active === 'technical' && (
                  <div className="space-y-5">
                    {data.priceHistory.length > 0 && (
                      <Card>
                        <CardHeader><CardTitle>Prix — 1 an</CardTitle></CardHeader>
                        <ResponsiveContainer width="100%" height={300}>
                          <AreaChart data={data.priceHistory}>
                            <defs>
                              <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%"  stopColor={BRAND} stopOpacity={0.2} />
                                <stop offset="95%" stopColor={BRAND} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={30} />
                            <YAxis domain={['auto','auto']} tick={{ fontSize: 11 }} width={60} />
                            <Tooltip formatter={(v: number | undefined) => v != null ? [`${fmt(v)} $`, 'Prix'] : ['N/D', 'Prix']} />
                            <Area type="monotone" dataKey="close" name="Prix" stroke={BRAND} strokeWidth={2} fill="url(#priceGrad)" dot={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </Card>
                    )}

                    {data.priceHistory.length > 0 && (
                      <Card>
                        <CardHeader><CardTitle>Volume — 1 an</CardTitle></CardHeader>
                        <ResponsiveContainer width="100%" height={160}>
                          <BarChart data={data.priceHistory}>
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={30} />
                            <YAxis tickFormatter={(v: number) => `${(v / 1e6).toFixed(0)}M`} tick={{ fontSize: 10 }} width={45} />
                            <Tooltip formatter={(v: number | undefined) => v != null ? [`${(v / 1e6).toFixed(2)} M`, 'Volume'] : ['N/D', 'Volume']} />
                            <Bar dataKey="volume" name="Volume" fill="#90e0ef" />
                          </BarChart>
                        </ResponsiveContainer>
                      </Card>
                    )}

                    {data.targetMean != null && data.priceHistory.length > 0 && (
                      <Card>
                        <CardHeader><CardTitle>Prix historique + Cibles analystes sur 12 mois</CardTitle></CardHeader>
                        {(() => {
                          const last = data.priceHistory[data.priceHistory.length - 1];
                          const fd = new Date(last.date);
                          fd.setFullYear(fd.getFullYear() + 1);
                          const fds = fd.toISOString().split('T')[0];
                          const chartData = [
                            ...data.priceHistory.map((p) => ({ date: p.date, prix: p.close })),
                            { date: fds, cibleHaute: data.targetHigh, cibleMoy: data.targetMean, cibleBasse: data.targetLow },
                          ];
                          return (
                            <ResponsiveContainer width="100%" height={260}>
                              <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={30} />
                                <YAxis domain={['auto','auto']} tick={{ fontSize: 11 }} width={60} />
                                <Tooltip formatter={(v: number | undefined) => v != null ? `${fmt(v)} $` : 'N/D'} />
                                <Legend />
                                <Line type="monotone" dataKey="prix"       name="Prix"         stroke={BRAND}  strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="cibleHaute" name="Cible haute"  stroke={GREEN}  strokeWidth={1.5} strokeDasharray="6 3" dot={{ r: 5 }} />
                                <Line type="monotone" dataKey="cibleMoy"   name="Cible moy."   stroke={YELLOW} strokeWidth={1.5} strokeDasharray="6 3" dot={{ r: 5 }} />
                                <Line type="monotone" dataKey="cibleBasse" name="Cible basse"  stroke={RED}    strokeWidth={1.5} strokeDasharray="6 3" dot={{ r: 5 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          );
                        })()}
                      </Card>
                    )}
                  </div>
                )}

                {/* ── SCORECARD ──────────────────────────── */}
                {active === 'scorecard' && scores && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <MetricCard label="Score global"      value={`${scores.overall.toFixed(1)} / 10`} highlight={scores.overall >= 7 ? 'green' : scores.overall < 5 ? 'red' : 'yellow'} />
                      <MetricCard label="Santé financière"  value={`${scores.health.toFixed(1)} / 10`} />
                      <MetricCard label="Croissance"        value={`${scores.growth.toFixed(1)} / 10`} />
                      <MetricCard label="Valorisation"      value={`${scores.valuation.toFixed(1)} / 10`} />
                    </div>

                    <Card>
                      <CardHeader><CardTitle>Barres de score</CardTitle></CardHeader>
                      <div className="space-y-4">
                        {[
                          { label: 'Global',       val: scores.overall  },
                          { label: 'Santé',        val: scores.health   },
                          { label: 'Croissance',   val: scores.growth   },
                          { label: 'Valorisation', val: scores.valuation },
                        ].map(({ label, val }) => (
                          <div key={label} className="flex items-center gap-3">
                            <span className="text-sm text-gray-600 w-24">{label}</span>
                            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${(val / 10) * 100}%`, backgroundColor: val >= 7 ? GREEN : val < 5 ? RED : YELLOW }} />
                            </div>
                            <span className="text-sm font-bold w-12 text-right">{val.toFixed(1)}/10</span>
                          </div>
                        ))}
                      </div>
                    </Card>

                    <Card>
                      <CardHeader><CardTitle>Résumé fondamental</CardTitle></CardHeader>
                      <div className="space-y-2 text-sm">
                        {[
                          { icon: data.cash - data.totalDebt > 0 ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />, text: `Cash net: ${fmtB(data.cash - data.totalDebt)}` },
                          { icon: data.revenueGrowth > 0.1 ? <TrendingUp className="h-4 w-4 text-green-500" /> : data.revenueGrowth > 0 ? <Minus className="h-4 w-4 text-yellow-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />, text: `Croissance revenus: ${fmtPct(data.revenueGrowth)}` },
                          { icon: data.profitMargin > 0.15 ? <TrendingUp className="h-4 w-4 text-green-500" /> : data.profitMargin < 0 ? <TrendingDown className="h-4 w-4 text-red-500" /> : <Minus className="h-4 w-4 text-yellow-500" />, text: `Marge nette: ${fmtPct(data.profitMargin)}` },
                          ...(bench ? [{ icon: data.pe > 0 && data.pe < bench.pe ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />, text: `P/E ${fmt(data.pe, 1)}x vs pair ${bench.pe}x` }] : []),
                          ...(data.dividendRate > 0 ? [{ icon: <TrendingUp className="h-4 w-4 text-blue-500" />, text: `Dividende: ${fmt(data.dividendRate)} $ (${fmtPct(data.dividendYield)})` }] : []),
                        ].map(({ icon, text }, i) => (
                          <div key={i} className="flex items-center gap-2">{icon}<span>{text}</span></div>
                        ))}
                      </div>
                    </Card>
                  </div>
                )}

                {/* ── ACTUALITÉS ──────────────────────────── */}
                {active === 'news' && (
                  <div className="space-y-3">
                    {data.news.length === 0 ? (
                      <div className="text-center py-14 text-gray-400">
                        <p className="text-sm">Aucune actualité disponible pour ce titre.</p>
                      </div>
                    ) : (
                      data.news.map((item, i) => (
                        <a key={i} href={item.link} target="_blank" rel="noopener noreferrer"
                          className="flex gap-4 bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all group">
                          {item.thumbnail && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.thumbnail} alt="" className="w-20 h-14 object-cover rounded-lg flex-shrink-0 bg-gray-100" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-brand-dark group-hover:text-brand-primary leading-snug line-clamp-2 transition-colors">{item.title}</p>
                            <p className="text-xs text-gray-400 mt-1.5">
                              <span className="font-medium text-gray-500">{item.publisher}</span>
                              {item.publishedAt && ` · ${new Date(item.publishedAt).toLocaleDateString('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' })}`}
                            </p>
                          </div>
                        </a>
                      ))
                    )}
                  </div>
                )}

                {/* ── RÉSULTATS ────────────────────────────── */}
                {active === 'earnings' && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <MetricCard
                        label="Prochains résultats"
                        value={data.nextEarningsDate ?? 'N/D'}
                        highlight={data.nextEarningsDate ? 'yellow' : undefined}
                      />
                      <MetricCard
                        label="Estimé BPA (trim. courant)"
                        value={data.epsEstimate != null ? `${fmt(data.epsEstimate)} $` : 'N/D'}
                        sub={data.eps !== 0 ? `BPA TTM: ${fmt(data.eps)} $` : undefined}
                      />
                      <MetricCard
                        label="Estimé Revenus (trim. courant)"
                        value={data.revenueEstimate != null ? fmtB(data.revenueEstimate) : 'N/D'}
                        sub={data.revenue !== 0 ? `Revenus TTM: ${fmtB(data.revenue)}` : undefined}
                      />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <MetricCard label="Croissance revenus" value={fmtPct(data.revenueGrowth)} highlight={data.revenueGrowth > 0.1 ? 'green' : data.revenueGrowth < 0 ? 'red' : 'yellow'} />
                      <MetricCard label="Croissance bénéfice" value={fmtPct(data.earningsGrowth)} highlight={data.earningsGrowth > 0.1 ? 'green' : data.earningsGrowth < 0 ? 'red' : 'yellow'} />
                      <MetricCard label="EPS TTM" value={data.eps !== 0 ? `${fmt(data.eps)} $` : 'N/D'} />
                      <MetricCard label="Taux de versement" value={fmtPct(data.payoutRatio)} />
                    </div>

                    {data.recTrend.length > 0 && (
                      <Card>
                        <CardHeader><CardTitle>Évolution recommandations analystes (4 derniers trimestres)</CardTitle></CardHeader>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={[...data.recTrend].slice(0, 4).reverse()}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="strongBuy"  name="Achat fort"  stackId="a" fill="#00b4d8" />
                            <Bar dataKey="buy"         name="Achat"       stackId="a" fill="#0077b6" />
                            <Bar dataKey="hold"        name="Conserver"   stackId="a" fill="#90e0ef" />
                            <Bar dataKey="sell"        name="Vente"       stackId="a" fill={RED} />
                            <Bar dataKey="strongSell"  name="Vente forte" stackId="a" fill="#9d0208" radius={[4,4,0,0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </Card>
                    )}
                  </div>
                )}

                {/* ── COMPARAISON ──────────────────────────── */}
                {active === 'compare' && (
                  <div className="space-y-5">
                    <Card>
                      <CardHeader><CardTitle>Comparer {data.symbol} avec un autre titre</CardTitle></CardHeader>
                      <div className="flex gap-2 mt-2">
                        <input
                          type="text"
                          placeholder="Ex: MSFT, TD.TO, NVDA…"
                          value={compareInput}
                          onChange={(e) => setCompareInput(e.target.value.toUpperCase())}
                          onKeyDown={(e) => e.key === 'Enter' && analyzeCompare(compareInput)}
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary font-mono"
                        />
                        <button
                          onClick={() => analyzeCompare(compareInput)}
                          disabled={compareLoading || !compareInput}
                          className="px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-medium hover:bg-brand-primary/90 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                        >
                          {compareLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Comparer'}
                        </button>
                      </div>
                    </Card>

                    {compareData && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <Card padding="sm">
                            <div className="px-1">
                              <p className="text-xs text-gray-400">{data.exchange} · {data.sector}</p>
                              <p className="text-xl font-bold text-brand-dark mt-0.5">{data.symbol}</p>
                              <p className="text-sm text-gray-500">{data.name}</p>
                              <p className="text-2xl font-bold mt-2">{fmt(data.currentPrice)} <span className="text-sm text-gray-400">{data.currency}</span></p>
                            </div>
                          </Card>
                          <Card padding="sm">
                            <div className="px-1">
                              <p className="text-xs text-gray-400">{compareData.exchange} · {compareData.sector}</p>
                              <p className="text-xl font-bold text-brand-dark mt-0.5">{compareData.symbol}</p>
                              <p className="text-sm text-gray-500">{compareData.name}</p>
                              <p className="text-2xl font-bold mt-2">{fmt(compareData.currentPrice)} <span className="text-sm text-gray-400">{compareData.currency}</span></p>
                            </div>
                          </Card>
                        </div>

                        <Card>
                          <CardHeader><CardTitle>Métriques côte-à-côte</CardTitle></CardHeader>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-100 bg-gray-50">
                                  <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs w-44">Métrique</th>
                                  <th className="text-center px-3 py-2.5 text-brand-dark font-bold text-sm">{data.symbol}</th>
                                  <th className="text-center px-3 py-2.5 text-brand-dark font-bold text-sm">{compareData.symbol}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {[
                                  { label: 'Market Cap',         a: fmtB(data.marketCap),                               b: fmtB(compareData.marketCap) },
                                  { label: 'Prix',               a: `${fmt(data.currentPrice)} $`,                       b: `${fmt(compareData.currentPrice)} $` },
                                  { label: 'P/E TTM',            a: data.pe > 0 ? `${fmt(data.pe, 1)}x` : 'N/D',        b: compareData.pe > 0 ? `${fmt(compareData.pe, 1)}x` : 'N/D' },
                                  { label: 'P/S',                a: data.ps > 0 ? `${fmt(data.ps, 1)}x` : 'N/D',        b: compareData.ps > 0 ? `${fmt(compareData.ps, 1)}x` : 'N/D' },
                                  { label: 'EPS TTM',            a: `${fmt(data.eps)} $`,                                b: `${fmt(compareData.eps)} $` },
                                  { label: 'Revenus',            a: fmtB(data.revenue),                                  b: fmtB(compareData.revenue) },
                                  { label: 'FCF',                a: data.fcf > 0 ? fmtB(data.fcf) : 'N/D',              b: compareData.fcf > 0 ? fmtB(compareData.fcf) : 'N/D' },
                                  { label: 'Marge brute',        a: fmtPct(data.grossMargin),                            b: fmtPct(compareData.grossMargin) },
                                  { label: 'Marge nette',        a: fmtPct(data.profitMargin),                           b: fmtPct(compareData.profitMargin) },
                                  { label: 'Croiss. revenus',    a: fmtPct(data.revenueGrowth),                          b: fmtPct(compareData.revenueGrowth) },
                                  { label: 'ROE',                a: fmtPct(data.returnOnEquity),                         b: fmtPct(compareData.returnOnEquity) },
                                  { label: 'Dette/Capitaux',     a: fmt(data.debtToEquity, 2),                           b: fmt(compareData.debtToEquity, 2) },
                                  { label: 'Cash net',           a: fmtB(data.cash - data.totalDebt),                   b: fmtB(compareData.cash - compareData.totalDebt) },
                                  { label: 'Beta',               a: data.beta > 0 ? fmt(data.beta) : 'N/D',             b: compareData.beta > 0 ? fmt(compareData.beta) : 'N/D' },
                                  { label: 'Dividende',          a: data.dividendRate > 0 ? `${fmt(data.dividendRate)} $ (${fmtPct(data.dividendYield)})` : 'Aucun', b: compareData.dividendRate > 0 ? `${fmt(compareData.dividendRate)} $ (${fmtPct(compareData.dividendYield)})` : 'Aucun' },
                                  { label: 'Cible 12m (moy.)',   a: data.targetMean != null ? `${fmt(data.targetMean)} $` : 'N/D', b: compareData.targetMean != null ? `${fmt(compareData.targetMean)} $` : 'N/D' },
                                ].map(({ label, a, b }) => (
                                  <tr key={label} className="border-b border-gray-50 hover:bg-gray-50">
                                    <td className="px-3 py-2.5 text-gray-500 text-xs font-medium">{label}</td>
                                    <td className="px-3 py-2.5 text-center font-semibold text-xs">{a}</td>
                                    <td className="px-3 py-2.5 text-center font-semibold text-xs">{b}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </Card>
                      </>
                    )}

                    {!compareData && !compareLoading && (
                      <div className="text-center py-10 text-gray-400">
                        <p className="text-sm">Entrez un ticker pour le comparer avec {data.symbol}</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </Tabs>
        </>
      )}

      {/* État initial */}
      {!data && !loading && !error && (
        <div className="text-center py-14 text-gray-400">
          <BarChart2 className="h-14 w-14 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">Entrez un ticker pour commencer l&apos;analyse</p>
          <p className="text-sm mt-2 opacity-70">Supporte les titres US, TSX (.TO), TSX Venture (.V), et plus</p>
        </div>
      )}

      {/* ── SCREENER ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader><CardTitle>Screener — Analyse multi-titres</CardTitle></CardHeader>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-500 mb-2">Sélectionnez les titres à analyser (max 10) — cliquez sur une ligne pour l&apos;analyser en détail</p>
            <div className="flex flex-wrap gap-2">
              {SCREENER_PRESETS.map((t) => (
                <button
                  key={t}
                  onClick={() => setScreenerSel((prev) =>
                    prev.includes(t) ? prev.filter((x) => x !== t) : prev.length < 10 ? [...prev, t] : prev
                  )}
                  className={`px-3 py-1.5 rounded-full text-xs font-mono font-medium transition-colors ${
                    screenerSel.includes(t)
                      ? 'bg-brand-primary text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">P/E max</label>
              <input
                type="number"
                value={screenerMaxPE}
                onChange={(e) => setScreenerMaxPE(Number(e.target.value))}
                className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Croiss. revenus min (%)</label>
              <input
                type="number"
                value={screenerMinGrowth}
                onChange={(e) => setScreenerMinGrowth(Number(e.target.value))}
                className="w-28 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>
            <button
              onClick={runScreener}
              disabled={screenerLoading || screenerSel.length === 0}
              className="px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-medium hover:bg-brand-primary/90 disabled:opacity-50 flex items-center gap-2"
            >
              {screenerLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Analyser'}
              {screenerSel.length > 0 && !screenerLoading && ` (${screenerSel.length})`}
            </button>
            {Object.keys(screenerData).length > 0 && (
              <button
                onClick={() => { setScreenerData({}); setScreenerSel([]); }}
                className="px-3 py-2 text-gray-400 hover:text-gray-600 text-sm"
              >
                Réinitialiser
              </button>
            )}
          </div>

          {Object.keys(screenerData).length > 0 && (() => {
            const filtered = Object.values(screenerData)
              .filter((d) =>
                (screenerMaxPE >= 100 || d.pe <= 0 || d.pe <= screenerMaxPE) &&
                d.revenueGrowth * 100 >= screenerMinGrowth
              )
              .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
            return (
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['Ticker', 'Nom', 'Prix', 'Market Cap', 'P/E', 'P/S', 'Marge nette', 'Croiss. Rev.', 'ROE', 'FCF', 'Dividende', 'Cible 12m'].map((h) => (
                        <th key={h} className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((d) => (
                      <tr
                        key={d.symbol}
                        className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors"
                        onClick={() => { setSearch(d.symbol); analyze(d.symbol); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      >
                        <td className="px-3 py-2.5 font-bold text-brand-dark text-xs font-mono">{d.symbol}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-600 max-w-[140px] truncate">{d.name}</td>
                        <td className="px-3 py-2.5 text-xs font-medium">{fmt(d.currentPrice)} $</td>
                        <td className="px-3 py-2.5 text-xs">{fmtB(d.marketCap)}</td>
                        <td className={`px-3 py-2.5 text-xs font-medium ${d.pe > 0 && d.pe < 25 ? 'text-green-600' : d.pe > 50 ? 'text-red-500' : 'text-gray-700'}`}>
                          {d.pe > 0 ? `${fmt(d.pe, 1)}x` : 'N/D'}
                        </td>
                        <td className="px-3 py-2.5 text-xs">{d.ps > 0 ? `${fmt(d.ps, 1)}x` : 'N/D'}</td>
                        <td className={`px-3 py-2.5 text-xs font-medium ${d.profitMargin > 0.15 ? 'text-green-600' : d.profitMargin < 0 ? 'text-red-500' : 'text-gray-700'}`}>
                          {fmtPct(d.profitMargin)}
                        </td>
                        <td className={`px-3 py-2.5 text-xs font-medium ${d.revenueGrowth > 0.1 ? 'text-green-600' : d.revenueGrowth < 0 ? 'text-red-500' : 'text-gray-700'}`}>
                          {fmtPct(d.revenueGrowth)}
                        </td>
                        <td className="px-3 py-2.5 text-xs">{fmtPct(d.returnOnEquity)}</td>
                        <td className="px-3 py-2.5 text-xs">{d.fcf > 0 ? fmtB(d.fcf) : 'N/D'}</td>
                        <td className="px-3 py-2.5 text-xs">{d.dividendRate > 0 ? fmtPct(d.dividendYield) : '-'}</td>
                        <td className="px-3 py-2.5 text-xs font-medium text-brand-dark">{d.targetMean != null ? `${fmt(d.targetMean)} $` : 'N/D'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">Aucun titre ne correspond aux filtres.</p>
                )}
              </div>
            );
          })()}
        </div>
      </Card>
    </div>
  );
}
