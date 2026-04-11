'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import useSWR from 'swr';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { parseCroesusData, ASSET_TYPE_CONFIG, ACCOUNT_TYPE_MAP, type ParseResult, type ParsedHolding, type AssetType } from '@/lib/parsers/croesus-parser';
import { usePriceTargetConsensus } from '@/lib/hooks/usePriceTargets';
import { useSymbolLogos } from '@/lib/hooks/useLogos';
import {
  ClipboardPaste, Sparkles, RotateCcw, TrendingUp,
  DollarSign, BarChart3, Shield, Landmark, Wallet, Package, AlertTriangle,
  Check, Pencil, X, Download, ChevronDown, ChevronUp, Eye, Info, FileText,
  BookOpen, CheckCircle2, Clock, AlertCircle, Upload, Globe, Copy,
  ArrowUpDown, ArrowUp, ArrowDown, Trophy, TrendingDown, Rocket,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(value);
}

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

// ─── Duolingo-style colors ───────────────────────────────────────────────────

const DUO = {
  green: '#58CC02', greenDark: '#45a300',
  blue: '#1CB0F6', blueDark: '#1899d6',
  purple: '#CE82FF', purpleDark: '#b06edb',
  orange: '#FF9600', orangeDark: '#e08600',
  red: '#FF4B4B', redDark: '#ea2b2b',
  yellow: '#FFC800', yellowDark: '#e0b200',
  teal: '#00CD9C', tealDark: '#00b386',
} as const;

const DUO_COLORS = [DUO.green, DUO.purple, DUO.blue, DUO.orange, DUO.red, DUO.yellow, DUO.teal];

function duoColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return DUO_COLORS[Math.abs(hash) % DUO_COLORS.length];
}

// ─── Symbol Logo (inline, small) ────────────────────────────────────────────

function SymbolLogo({ symbol, logos }: { symbol: string; logos: Record<string, string | null> }) {
  const [fmpError, setFmpError] = useState(false);
  const ticker = symbol.replace('.TO', '').replace('.V', '').replace('.CN', '').replace('.NE', '');
  const tvLogo = logos[symbol];
  const color = duoColor(ticker);

  if (tvLogo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={tvLogo} alt={ticker} className="w-7 h-7 rounded-lg object-contain bg-white border border-gray-100" />
    );
  }

  if (!fmpError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`https://financialmodelingprep.com/image-stock/${encodeURIComponent(symbol)}.png`}
        alt={ticker}
        className="w-7 h-7 rounded-lg object-contain bg-white border border-gray-100"
        onError={() => setFmpError(true)}
      />
    );
  }

  // Letter fallback with Duolingo-style color
  return (
    <div
      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: color + '18', border: `2px solid ${color}40` }}
    >
      <span className="text-[10px] font-extrabold" style={{ color }}>{ticker.slice(0, 2)}</span>
    </div>
  );
}

const ASSET_ICONS: Record<AssetType, typeof TrendingUp> = {
  EQUITY: TrendingUp,
  FIXED_INCOME: Landmark,
  ETF: BarChart3,
  FUND: Package,
  PREFERRED: Shield,
  CASH: Wallet,
  OTHER: DollarSign,
};

// ─── Maturity color scale ────────────────────────────────────────────────────

const MATURITY_BANDS = [
  { maxYears: 1,  label: '< 1 an',  color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200',    dot: 'bg-red-500' },
  { maxYears: 2,  label: '1–2 ans', color: 'text-orange-600', bg: 'bg-orange-50',  border: 'border-orange-200', dot: 'bg-orange-500' },
  { maxYears: 3,  label: '2–3 ans', color: 'text-amber-600',  bg: 'bg-amber-50',   border: 'border-amber-200',  dot: 'bg-amber-500' },
  { maxYears: 5,  label: '3–5 ans', color: 'text-green-600',  bg: 'bg-green-50',   border: 'border-green-200',  dot: 'bg-green-500' },
  { maxYears: Infinity, label: '5+ ans', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200',   dot: 'bg-blue-500' },
] as const;

const MONTH_PARSE: Record<string, number> = {
  jan: 0, fév: 1, mar: 2, avr: 3, mai: 4, jun: 5,
  jul: 6, aoû: 7, sep: 8, oct: 9, nov: 10, déc: 11,
};

function getMaturityBand(dateStr?: string) {
  if (!dateStr) return null;

  let matDate: Date | null = null;

  // ISO: "2028-06-01"
  const iso = dateStr.match(/^(20\d{2})-(\d{2})-(\d{2})$/);
  if (iso) matDate = new Date(+iso[1], +iso[2] - 1, +iso[3]);

  // French: "16 sep 2026"
  if (!matDate) {
    const fr = dateStr.match(/^(\d{1,2})\s+(\S+)\s+(\d{4})$/);
    if (fr) {
      const month = MONTH_PARSE[fr[2].toLowerCase()];
      if (month !== undefined) matDate = new Date(+fr[3], month, +fr[1]);
    }
  }

  // Year only: "2034"
  if (!matDate) {
    const yr = dateStr.match(/^(20\d{2})$/);
    if (yr) matDate = new Date(+yr[1], 6, 1);
  }

  if (!matDate) return null;
  const yearsToMat = (matDate.getTime() - Date.now()) / (365.25 * 24 * 3600 * 1000);
  return MATURITY_BANDS.find(b => yearsToMat < b.maxYears) || MATURITY_BANDS[MATURITY_BANDS.length - 1];
}

const ACCOUNT_COLORS: Record<string, string> = {
  A: 'bg-gray-100 text-gray-700',
  E: 'bg-orange-50 text-orange-700',
  W: 'bg-emerald-50 text-emerald-700',
  S: 'bg-blue-50 text-blue-700',
  T: 'bg-purple-50 text-purple-700',
  Y: 'bg-purple-50 text-purple-600',
  P: 'bg-rose-50 text-rose-700',
  N: 'bg-amber-50 text-amber-700',
  F: 'bg-cyan-50 text-cyan-700',
};

interface YahooPrice {
  symbol: string;
  price: number;
  currency: string;
  name: string;
  dividendRate?: number;   // Forward annual dividend per share
  dividendYield?: number;  // Forward dividend yield (decimal, e.g. 0.025 = 2.5%)
}

const priceFetcher = (url: string) => fetch(url).then(r => r.json());

function useYahooPrices(symbols: string[]) {
  const key = symbols.length > 0
    ? `/api/prices?symbols=${symbols.join(',')}`
    : null;

  const { data, isLoading } = useSWR<YahooPrice[]>(key, priceFetcher, {
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
  });

  const pricesMap = new Map<string, YahooPrice>();
  if (Array.isArray(data)) {
    data.forEach(p => { if (p.price > 0) pricesMap.set(p.symbol, p); });
  }

  return { prices: pricesMap, isLoading };
}

// ─── Paste Zone ──────────────────────────────────────────────────────────────

function PasteZone({ onPaste }: { onPaste: (text: string) => void }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [textValue, setTextValue] = useState('');

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text/plain');
    if (text.trim()) {
      e.preventDefault();
      onPaste(text);
    }
  }, [onPaste]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const text = e.dataTransfer.getData('text/plain');
    if (text.trim()) {
      onPaste(text);
    }
  }, [onPaste]);

  const steps = [
    { num: 1, title: 'Sélectionnez', desc: 'Vos positions dans Croesus', color: DUO.blue, dark: DUO.blueDark },
    { num: 2, title: 'Copiez', desc: 'Ctrl+C les données', color: DUO.purple, dark: DUO.purpleDark },
    { num: 3, title: 'Collez ici', desc: 'Ctrl+V et on s\'occupe du reste', color: DUO.green, dark: DUO.greenDark },
  ];

  return (
    <div className="space-y-6">
      {/* Step cards — Duolingo 3D style */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {steps.map((s) => (
          <div
            key={s.num}
            className="relative flex gap-3 items-center p-4 rounded-2xl bg-white transition-transform hover:scale-[1.02]"
            style={{ border: `2px solid ${s.color}30`, borderBottom: `4px solid ${s.dark}40` }}
          >
            <div
              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-extrabold"
              style={{ backgroundColor: s.color, boxShadow: `0 3px 0 0 ${s.dark}` }}
            >
              {s.num}
            </div>
            <div>
              <p className="text-sm font-bold text-text-main">{s.title}</p>
              <p className="text-xs text-text-muted">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Drop zone */}
      <div
        className={`
          relative rounded-2xl transition-all duration-300 cursor-pointer overflow-hidden
          ${isDragOver
            ? 'scale-[1.01] ring-4 ring-[#58CC02]/30'
            : 'hover:ring-2 hover:ring-[#1CB0F6]/20'}
        `}
        style={{
          border: `3px dashed ${isDragOver ? DUO.green : '#d1d5db'}`,
          background: isDragOver ? `${DUO.green}08` : 'white',
        }}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => textareaRef.current?.focus()}
      >
        <div className="px-6 pt-8 pb-4 text-center">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 transition-all duration-300"
            style={{
              backgroundColor: isDragOver ? DUO.green : `${DUO.blue}15`,
              color: isDragOver ? 'white' : DUO.blue,
              boxShadow: isDragOver ? `0 4px 0 0 ${DUO.greenDark}` : `0 4px 0 0 ${DUO.blueDark}20`,
              transform: isDragOver ? 'scale(1.1)' : 'scale(1)',
            }}
          >
            <ClipboardPaste className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-extrabold text-text-main mb-1">
            Collez vos positions ici
          </h3>
          <p className="text-sm text-text-muted max-w-md mx-auto">
            Actions, obligations, FNB, fonds — tout sera détecté automatiquement
          </p>
        </div>

        <div className="px-6 pb-6">
          <textarea
            ref={textareaRef}
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onPaste={handlePaste}
            placeholder={"Ctrl+V pour coller les données de Croesus..."}
            className="w-full h-32 px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm font-mono
              text-text-main placeholder-text-muted/40 resize-none
              focus:outline-none focus:ring-2 focus:ring-[#1CB0F6]/30 focus:border-[#1CB0F6]
              transition-all duration-200"
          />
        </div>
      </div>

      {/* Analyse button — Duolingo 3D green */}
      {textValue.trim() && (
        <div className="flex justify-center">
          <button
            onClick={() => onPaste(textValue)}
            className="flex items-center gap-2.5 px-8 py-3.5 rounded-2xl text-white font-extrabold text-base
              transition-all duration-150 active:translate-y-[2px] active:shadow-none hover:brightness-105"
            style={{
              backgroundColor: DUO.green,
              boxShadow: `0 4px 0 0 ${DUO.greenDark}`,
            }}
          >
            <Rocket className="h-5 w-5" />
            Analyser les positions
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Category summary card ───────────────────────────────────────────────────

const CATEGORY_DUO: Record<AssetType, { color: string; dark: string }> = {
  EQUITY: { color: DUO.blue, dark: DUO.blueDark },
  FIXED_INCOME: { color: DUO.orange, dark: DUO.orangeDark },
  ETF: { color: DUO.purple, dark: DUO.purpleDark },
  FUND: { color: DUO.teal, dark: DUO.tealDark },
  PREFERRED: { color: '#6366f1', dark: '#4f46e5' },
  CASH: { color: DUO.green, dark: DUO.greenDark },
  OTHER: { color: '#94a3b8', dark: '#64748b' },
};

function CategoryCard({ type, count, value, active, onClick }: {
  type: AssetType;
  count: number;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  const config = ASSET_TYPE_CONFIG[type];
  const duo = CATEGORY_DUO[type];
  const Icon = ASSET_ICONS[type];

  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 rounded-2xl text-left w-full transition-all duration-150 active:translate-y-[2px] active:shadow-none"
      style={{
        border: `2px solid ${active ? duo.color : '#e5e7eb'}`,
        borderBottom: `4px solid ${active ? duo.dark : '#d1d5db'}`,
        backgroundColor: active ? `${duo.color}08` : 'white',
      }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: active ? duo.color : `${duo.color}15`,
          boxShadow: active ? `0 2px 0 0 ${duo.dark}` : 'none',
        }}
      >
        <Icon className="h-4 w-4" style={{ color: active ? 'white' : duo.color }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: active ? duo.color : '#9ca3af' }}>
          {config.label}
        </p>
        <p className="text-sm font-extrabold text-text-main">{count}</p>
      </div>
      <p className="text-[11px] font-bold whitespace-nowrap" style={{ color: active ? duo.color : '#6b7280' }}>
        {formatCurrency(value)}
      </p>
    </button>
  );
}

// ─── Results view ────────────────────────────────────────────────────────────

interface AICorrection {
  symbol: string;
  assetType: AssetType;
  reason?: string;
}

function ResultsView({ result, onReset }: { result: ParseResult; onReset: () => void }) {
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState<AssetType | 'ALL'>('ALL');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);
  const [symbolOverrides, setSymbolOverrides] = useState<Record<string, string>>({});
  const [typeOverrides, setTypeOverrides] = useState<Record<string, AssetType>>({});
  const [customTargets, setCustomTargets] = useState<Record<string, number>>({});
  const [editingTarget, setEditingTarget] = useState<string | null>(null);
  const [customCurrentPrices, setCustomCurrentPrices] = useState<Record<string, number>>({});
  const [editingCurrentPrice, setEditingCurrentPrice] = useState<string | null>(null);
  const [showTargets, setShowTargets] = useState(false);
  const [excludedRows, setExcludedRows] = useState<Set<string>>(new Set());
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // PDF builder state
  const [showPdfBuilder, setShowPdfBuilder] = useState(false);
  const [pdfOptions, setPdfOptions] = useState({
    includeCover: true,
    includeEquities: true,
    includeFixedIncome: true,
    includeCashOther: true,
    fundCodesToInclude: [] as string[],
  });
  const [fundUploading, setFundUploading] = useState<Record<string, boolean>>({});
  const [fundDragOver, setFundDragOver] = useState<string | null>(null);

  // Upload a fund report PDF inline from the builder
  const handleFundUpload = useCallback(async (fundCode: string, file: File) => {
    if (!file.type.includes('pdf')) {
      toast('error', 'Seuls les fichiers PDF sont acceptés');
      return;
    }
    setFundUploading(prev => ({ ...prev, [fundCode]: true }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fund_code', fundCode);

      const res = await fetch('/api/fund-reports', { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur d\'upload');
      }
      const result = await res.json();
      toast('success', `${fundCode} uploadé avec succès`);

      // Update fund check result to 'ok' so it becomes selectable
      setFundCheckResults(prev =>
        prev.map(f => f.fund_code === fundCode
          ? { ...f, status: 'ok' as const, fund_name: result.fund_name || f.fund_name, updated_at: new Date().toISOString(), months_old: 0 }
          : f
        )
      );
      // Auto-select the newly uploaded fund
      setPdfOptions(prev => ({
        ...prev,
        fundCodesToInclude: prev.fundCodesToInclude.includes(fundCode)
          ? prev.fundCodesToInclude
          : [...prev.fundCodesToInclude, fundCode],
      }));
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Erreur d\'upload');
    } finally {
      setFundUploading(prev => ({ ...prev, [fundCode]: false }));
    }
  }, [toast]);

  // Sort state
  type SortColumn = 'symbol' | 'name' | 'marketValue' | 'weight' | 'gainPct' | 'gainDollar' | 'targetPrice' | 'annualIncome' | 'currentPrice';
  type SortDir = 'asc' | 'desc';
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDir>('desc');

  const toggleSort = useCallback((col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDirection('desc');
    }
  }, [sortColumn]);

  const [aiCorrections, setAiCorrections] = useState<AICorrection[]>([]);
  const [aiChecking, setAiChecking] = useState(false);
  const [aiChecked, setAiChecked] = useState(false);

  // Fund document status check
  interface FundCheckResult {
    fund_code: string;
    status: 'ok' | 'outdated' | 'missing';
    fund_name?: string;
    updated_at?: string;
    months_old?: number;
  }
  const [fundCheckResults, setFundCheckResults] = useState<FundCheckResult[]>([]);
  const [fundCheckDone, setFundCheckDone] = useState(false);

  // AI classification check — runs once on mount
  const aiCheckRan = useRef(false);
  useEffect(() => {
    if (aiCheckRan.current) return;
    aiCheckRan.current = true;

    const runAiCheck = async () => {
      setAiChecking(true);
      try {
        const payload = result.holdings.map(h => ({
          symbol: h.symbol,
          name: h.name,
          assetType: h.assetType,
          modifiedDuration: h.modifiedDuration,
          couponRate: h.couponRate,
          maturityDate: h.maturityDate,
        }));

        const res = await fetch('/api/ai/classify-holdings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ holdings: payload }),
        });

        if (res.ok) {
          const { corrections } = await res.json();
          if (corrections && corrections.length > 0) {
            setAiCorrections(corrections);
          }
        }
      } catch {
        // Silently fail — AI check is optional
      } finally {
        setAiChecking(false);
        setAiChecked(true);
      }
    };

    runAiCheck();
  }, [result.holdings]);

  // Fund document status check — reactive to computed holdings (with type overrides)
  // Tracks which symbols we've already checked to avoid redundant API calls
  const checkedFundSymbols = useRef(new Set<string>());

  // Apply symbol & type overrides
  const holdings = useMemo(() => {
    return result.holdings.map((h, idx) => ({
      ...h,
      symbol: symbolOverrides[`${idx}_${h.symbol}`] || h.symbol,
      assetType: typeOverrides[h.symbol] || h.assetType,
      _key: `${idx}_${h.symbol}_${h.accountType}`,
      _originalKey: `${idx}_${h.symbol}`,
    }));
  }, [result.holdings, symbolOverrides, typeOverrides]);

  // Effective FUND symbols (from current holdings after overrides)
  const currentFundSymbols = useMemo(() => {
    return [...new Set(holdings.filter(h => h.assetType === 'FUND').map(h => h.symbol))];
  }, [holdings]);

  // Fund check — reactive: re-runs when new FUND symbols appear (via AI corrections or manual override)
  useEffect(() => {
    if (!aiChecked) return; // Wait for AI classification first

    const newSymbols = currentFundSymbols.filter(s => !checkedFundSymbols.current.has(s));
    if (newSymbols.length === 0) {
      if (currentFundSymbols.length === 0) setFundCheckDone(true);
      return;
    }

    // Mark as checked immediately to prevent duplicate calls
    newSymbols.forEach(s => checkedFundSymbols.current.add(s));

    const checkFunds = async () => {
      try {
        const res = await fetch('/api/fund-reports/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fund_codes: newSymbols }),
        });
        if (res.ok) {
          const { results } = await res.json();
          if (results && results.length > 0) {
            setFundCheckResults(prev => {
              // Merge new results, replacing any duplicates
              const existing = new Map(prev.map(r => [r.fund_code, r]));
              for (const r of results) existing.set(r.fund_code, r);
              return Array.from(existing.values());
            });
          }
        }
      } catch {
        // Silently fail
      } finally {
        setFundCheckDone(true);
      }
    };

    checkFunds();
  }, [aiChecked, currentFundSymbols]);

  // Also remove fund check results for symbols no longer classified as FUND
  useEffect(() => {
    if (fundCheckResults.length === 0) return;
    const fundSet = new Set(currentFundSymbols);
    const filtered = fundCheckResults.filter(r => fundSet.has(r.fund_code));
    if (filtered.length !== fundCheckResults.length) {
      setFundCheckResults(filtered);
      // Clean up tracked symbols for removed funds so they can be re-checked if re-added
      fundCheckResults.forEach(r => {
        if (!fundSet.has(r.fund_code)) checkedFundSymbols.current.delete(r.fund_code);
      });
    }
  }, [currentFundSymbols, fundCheckResults]);

  // Auto-populate PDF builder fund selections when fund check completes
  useEffect(() => {
    const okFunds = fundCheckResults.filter(f => f.status === 'ok').map(f => f.fund_code);
    setPdfOptions(prev => ({ ...prev, fundCodesToInclude: okFunds }));
  }, [fundCheckResults]);

  // Total portfolio value for weight calculation
  const totalPortfolioValue = useMemo(() => {
    return holdings.reduce((s, h) => s + Math.abs(h.marketValue), 0);
  }, [holdings]);

  // Get priceable symbols + CDR map
  const { priceableSymbols, cdrMap } = useMemo(() => {
    const symbols = new Set<string>();
    const cdrs: Record<string, string> = {};
    holdings.forEach(h => {
      if (!['CASH', 'FIXED_INCOME', 'OTHER'].includes(h.assetType)) {
        symbols.add(h.symbol);
        if (h.isCDR && h.underlyingSymbol) {
          cdrs[h.symbol] = h.underlyingSymbol;
        }
      }
    });
    return { priceableSymbols: Array.from(symbols), cdrMap: cdrs };
  }, [holdings]);

  // Fetch logos for all symbols (not just equities — logos available for ETFs, funds too)
  const allSymbols = useMemo(() => {
    return [...new Set(holdings.filter(h => h.assetType !== 'CASH').map(h => h.symbol))];
  }, [holdings]);
  const { logos } = useSymbolLogos(allSymbols);

  // Fetch prices & targets (CDR map passed to target hook)
  const { prices, isLoading: pricesLoading } = useYahooPrices(showTargets ? priceableSymbols : []);
  const { targets, isLoading: targetsLoading } = usePriceTargetConsensus(showTargets ? priceableSymbols : [], cdrMap);

  const isLoadingPrices = pricesLoading || targetsLoading;

  // Compute target data
  const targetData = useMemo(() => {
    if (!showTargets) return new Map<string, { currentPrice: number; targetPrice: number; gainPct: number; source: string }>();
    const map = new Map<string, { currentPrice: number; targetPrice: number; gainPct: number; source: string }>();

    priceableSymbols.forEach(sym => {
      // For CDR detection: check if ANY holding with this symbol is a CDR
      // (handles case where .find() returns a non-CDR duplicate)
      const holding = holdings.find(h => h.symbol === sym);
      if (!holding) return;

      const isCDR = holding.isCDR || sym in cdrMap;
      const cdrHolding = isCDR ? holdings.find(h => h.symbol === sym && h.isCDR) : null;

      const yahoo = prices.get(sym);
      const target = targets[sym];
      // CDR holdings: always use Croesus market price (CAD), never Yahoo US price
      const currentPriceRaw = isCDR
        ? (cdrHolding?.marketPrice || holding.marketPrice)
        : (yahoo?.price || holding.marketPrice);
      // User override for current market price (to fix errors)
      const currentPrice = customCurrentPrices[sym] ?? currentPriceRaw;
      const hasCustom = sym in customTargets;

      let targetPrice: number;
      let source: string;

      if (hasCustom) {
        targetPrice = customTargets[sym];
        source = 'Manuel';
      } else if (isCDR && target?.cdrGainPct !== undefined) {
        // CDR: apply the US underlying's gain % to the Croesus CAD price
        targetPrice = Math.round(currentPrice * (1 + target.cdrGainPct) * 100) / 100;
        source = 'CDR';
      } else if (target?.targetConsensus && target.targetConsensus > 0) {
        targetPrice = target.targetConsensus;
        source = target.source === 'historical' ? 'Est. hist.' : 'Analyste';
      } else {
        targetPrice = 0;
        source = 'N/D';
      }

      const gainPct = targetPrice > 0 && currentPrice > 0 ? ((targetPrice - currentPrice) / currentPrice) * 100 : 0;

      map.set(sym, { currentPrice, targetPrice, gainPct, source });
    });

    // Include custom targets for symbols not yet in the map (e.g. API returned nothing)
    for (const sym of Object.keys(customTargets)) {
      if (!map.has(sym)) {
        const holding = holdings.find(h => h.symbol === sym);
        if (!holding) continue;
        const currentPriceBase = prices.get(sym)?.price || holding.marketPrice;
        const currentPrice = customCurrentPrices[sym] ?? currentPriceBase;
        const targetPrice = customTargets[sym];
        const gainPct = targetPrice > 0 && currentPrice > 0 ? ((targetPrice - currentPrice) / currentPrice) * 100 : 0;
        map.set(sym, { currentPrice, targetPrice, gainPct, source: 'Manuel' });
      }
    }

    return map;
  }, [showTargets, holdings, prices, targets, customTargets, customCurrentPrices, priceableSymbols, cdrMap]);

  // Forward annual income per holding (extremely reliable — uses best source available).
  //
  // Source priority:
  //   - EQUITY/ETF/FUND/PREFERRED: Yahoo forward dividendRate × quantity (most accurate, forward-looking)
  //                                Falls back to Croesus annualIncome (trailing actual) if Yahoo missing.
  //   - FIXED_INCOME:               Croesus annualIncome (actual coupon paid by broker).
  //                                Falls back to quantity × (couponRate/100) if Croesus missing.
  //   - CASH/OTHER:                 0
  //
  // Source codes: 'forward' | 'croesus' | 'coupon' | 'none'
  const incomeData = useMemo(() => {
    const map = new Map<string, { annualIncome: number; yieldPct: number; source: 'forward' | 'croesus' | 'coupon' | 'none' }>();

    holdings.forEach(h => {
      const isEquityLike = ['EQUITY', 'ETF', 'FUND', 'PREFERRED'].includes(h.assetType);
      const isFixed = h.assetType === 'FIXED_INCOME';
      let annualIncome = 0;
      let source: 'forward' | 'croesus' | 'coupon' | 'none' = 'none';

      if (isEquityLike) {
        // Prefer Yahoo forward dividend rate (most reliable forward estimate)
        const yahoo = prices.get(h.symbol);
        if (yahoo?.dividendRate && yahoo.dividendRate > 0 && h.quantity > 0) {
          annualIncome = h.quantity * yahoo.dividendRate;
          source = 'forward';
        } else if (h.annualIncome > 0) {
          // Fallback: Croesus trailing actual
          annualIncome = h.annualIncome;
          source = 'croesus';
        }
      } else if (isFixed) {
        if (h.annualIncome > 0) {
          // Croesus reports the actual annual coupon income — most reliable for bonds
          annualIncome = h.annualIncome;
          source = 'croesus';
        } else if (h.couponRate && h.couponRate > 0 && h.quantity > 0) {
          // Fallback: compute coupon from rate (assumes face value ≈ quantity, which is
          // true for Croesus exports where quantity is the bond face value in $).
          annualIncome = h.quantity * (h.couponRate / 100);
          source = 'coupon';
        }
      }

      const yieldPct = h.marketValue > 0 && annualIncome > 0
        ? (annualIncome / h.marketValue) * 100
        : 0;

      map.set(h._key, { annualIncome, yieldPct, source });
    });

    return map;
  }, [holdings, prices]);

  // Totals by category (forward-looking when possible)
  const incomeTotals = useMemo(() => {
    let equityDividends = 0;
    let fixedIncomeCoupons = 0;
    let equityWithForward = 0;
    let equityWithCroesus = 0;
    let equityNoData = 0;
    let fixedWithCroesus = 0;
    let fixedWithCoupon = 0;
    let fixedNoData = 0;

    holdings.forEach(h => {
      if (excludedRows.has(h._key)) return;
      const entry = incomeData.get(h._key);
      if (!entry) return;
      const isEquityLike = ['EQUITY', 'ETF', 'FUND', 'PREFERRED'].includes(h.assetType);
      const isFixed = h.assetType === 'FIXED_INCOME';

      if (isEquityLike) {
        equityDividends += entry.annualIncome;
        if (entry.source === 'forward') equityWithForward++;
        else if (entry.source === 'croesus') equityWithCroesus++;
        else equityNoData++;
      } else if (isFixed) {
        fixedIncomeCoupons += entry.annualIncome;
        if (entry.source === 'croesus') fixedWithCroesus++;
        else if (entry.source === 'coupon') fixedWithCoupon++;
        else fixedNoData++;
      }
    });

    const total = equityDividends + fixedIncomeCoupons;
    return {
      equityDividends,
      fixedIncomeCoupons,
      total,
      equityWithForward,
      equityWithCroesus,
      equityNoData,
      fixedWithCroesus,
      fixedWithCoupon,
      fixedNoData,
    };
  }, [holdings, excludedRows, incomeData]);

  // Filtered + sorted holdings (after targetData so sort by gain works)
  const filteredHoldings = useMemo(() => {
    let list = activeFilter === 'ALL' ? [...holdings] : holdings.filter(h => h.assetType === activeFilter);

    if (sortColumn) {
      list = [...list].sort((a, b) => {
        let va: number | string = 0;
        let vb: number | string = 0;

        switch (sortColumn) {
          case 'symbol': va = a.symbol; vb = b.symbol; break;
          case 'name': va = a.name; vb = b.name; break;
          case 'marketValue': va = a.marketValue; vb = b.marketValue; break;
          case 'annualIncome': va = a.annualIncome; vb = b.annualIncome; break;
          case 'weight': va = Math.abs(a.marketValue); vb = Math.abs(b.marketValue); break;
          case 'currentPrice': {
            const tdA = targetData.get(a.symbol);
            const tdB = targetData.get(b.symbol);
            va = tdA?.currentPrice || a.marketPrice;
            vb = tdB?.currentPrice || b.marketPrice;
            break;
          }
          case 'targetPrice': {
            const tdA = targetData.get(a.symbol);
            const tdB = targetData.get(b.symbol);
            va = tdA?.targetPrice || 0;
            vb = tdB?.targetPrice || 0;
            break;
          }
          case 'gainPct': {
            const tdA = targetData.get(a.symbol);
            const tdB = targetData.get(b.symbol);
            va = tdA?.gainPct || 0;
            vb = tdB?.gainPct || 0;
            break;
          }
          case 'gainDollar': {
            const tdA = targetData.get(a.symbol);
            const tdB = targetData.get(b.symbol);
            va = tdA && tdA.targetPrice > 0 ? a.quantity * (tdA.targetPrice - tdA.currentPrice) : 0;
            vb = tdB && tdB.targetPrice > 0 ? b.quantity * (tdB.targetPrice - tdB.currentPrice) : 0;
            break;
          }
        }

        if (typeof va === 'string' && typeof vb === 'string') {
          return sortDirection === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        }
        return sortDirection === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
      });
    }

    return list;
  }, [holdings, activeFilter, sortColumn, sortDirection, targetData]);

  // Category values
  const categoryValues = useMemo(() => {
    const map: Record<AssetType, number> = {
      EQUITY: 0, FIXED_INCOME: 0, ETF: 0, FUND: 0, PREFERRED: 0, CASH: 0, OTHER: 0,
    };
    holdings.forEach(h => { map[h.assetType] += h.marketValue; });
    return map;
  }, [holdings]);

  // Summary stats when targets are loaded
  const targetSummary = useMemo(() => {
    if (!showTargets || targetData.size === 0) return null;
    let totalCurrent = 0;
    let totalTarget = 0;
    let analystCount = 0;
    let historicalCount = 0;
    let manualCount = 0;
    let cdrCount = 0;
    let noTargetCount = 0;

    holdings.forEach(h => {
      const data = targetData.get(h.symbol);
      if (data && !['CASH', 'FIXED_INCOME', 'OTHER'].includes(h.assetType)) {
        totalCurrent += h.quantity * data.currentPrice;
        if (data.targetPrice > 0) {
          totalTarget += h.quantity * data.targetPrice;
          if (data.source === 'CDR') cdrCount++;
          else if (data.source === 'Est. hist.') historicalCount++;
          else if (data.source === 'Manuel') manualCount++;
          else analystCount++;
        } else {
          totalTarget += h.quantity * data.currentPrice;
          noTargetCount++;
        }
      }
    });

    const gain = totalTarget - totalCurrent;
    const gainPct = totalCurrent > 0 ? (gain / totalCurrent) * 100 : 0;
    const withTargets = analystCount + historicalCount + manualCount + cdrCount;

    // Gains breakdown by category
    const fixedIncomeHoldings = holdings.filter(h => h.assetType === 'FIXED_INCOME');
    const fixedIncomeAnnualIncome = fixedIncomeHoldings.reduce((s, h) => s + h.annualIncome, 0);
    const fixedIncomeMarketValue = fixedIncomeHoldings.reduce((s, h) => s + h.marketValue, 0);
    const fixedIncomeGainPct = fixedIncomeMarketValue > 0 ? (fixedIncomeAnnualIncome / fixedIncomeMarketValue) * 100 : 0;

    const equityGain = gain; // target gain is already equity-only
    const equityGainPct = gainPct; // same as gainPct (equity-only)
    const totalEstimated = equityGain + fixedIncomeAnnualIncome;
    const totalPortfolioValue = totalCurrent + fixedIncomeMarketValue;
    const totalEstimatedPct = totalPortfolioValue > 0 ? (totalEstimated / totalPortfolioValue) * 100 : 0;

    return { totalCurrent, totalTarget, gain, gainPct, withTargets, total: priceableSymbols.length, analystCount, historicalCount, manualCount, cdrCount, noTargetCount, equityGain, equityGainPct, fixedIncomeAnnualIncome, fixedIncomeMarketValue, fixedIncomeGainPct, totalEstimated, totalEstimatedPct };
  }, [showTargets, targetData, holdings, priceableSymbols.length]);

  const handleDownloadPdf = useCallback(async () => {
    setGeneratingPdf(true);
    try {
      // Build PDF data payload (exclude removed rows)
      const pdfHoldings = holdings.filter(h => !excludedRows.has(h._key)).map(h => {
        const td = targetData.get(h.symbol);
        return {
          symbol: h.symbol,
          name: h.name,
          quantity: h.quantity,
          averageCost: h.averageCost,
          marketPrice: h.marketPrice,
          marketValue: h.marketValue,
          bookValue: h.bookValue,
          assetType: h.assetType,
          accountType: h.accountType,
          accountLabel: h.accountLabel,
          annualIncome: h.annualIncome,
          currentPrice: td?.currentPrice || h.marketPrice,
          targetPrice: td?.targetPrice || 0,
          gainPct: td?.gainPct || 0,
          targetSource: td?.source || '',
          couponRate: h.couponRate,
          maturityDate: h.maturityDate,
          modifiedDuration: h.modifiedDuration,
          accruedInterest: h.accruedInterest,
        };
      });

      const equities = pdfHoldings.filter(h => !['CASH', 'FIXED_INCOME', 'OTHER'].includes(h.assetType));
      const totalCurrentValue = equities.reduce((s, h) => s + h.quantity * (h.currentPrice || h.marketPrice), 0);
      const totalTargetValue = equities.reduce((s, h) => {
        const price = h.targetPrice > 0 ? h.targetPrice : (h.currentPrice || h.marketPrice);
        return s + h.quantity * price;
      }, 0);

      const payload = {
        holdings: pdfHoldings,
        generatedAt: new Date().toISOString(),
        fundCodes: pdfOptions.fundCodesToInclude,
        options: {
          includeCover: pdfOptions.includeCover,
          includeEquities: pdfOptions.includeEquities,
          includeFixedIncome: pdfOptions.includeFixedIncome,
          includeCashOther: pdfOptions.includeCashOther,
        },
        summary: (() => {
          const incl = holdings.filter(h => !excludedRows.has(h._key));
          const fiIncl = incl.filter(h => h.assetType === 'FIXED_INCOME');
          const fiMv = fiIncl.reduce((s, h) => s + h.marketValue, 0);
          const fiAi = fiIncl.reduce((s, h) => s + h.annualIncome, 0);
          const eqGain = totalTargetValue - totalCurrentValue;
          const totalPv = totalCurrentValue + fiMv;
          return {
            totalMarketValue: incl.reduce((s, h) => s + h.marketValue, 0),
            totalBookValue: incl.reduce((s, h) => s + h.bookValue, 0),
            totalAnnualIncome: incl.reduce((s, h) => s + h.annualIncome, 0),
            totalCurrentValue,
            totalTargetValue,
            totalGain: totalTargetValue - totalCurrentValue,
            totalGainPct: totalCurrentValue > 0 ? ((totalTargetValue - totalCurrentValue) / totalCurrentValue) * 100 : 0,
            equityCount: incl.filter(h => !['CASH', 'FIXED_INCOME', 'OTHER'].includes(h.assetType)).length,
            fixedIncomeCount: fiIncl.length,
            cashCount: incl.filter(h => h.assetType === 'CASH').length,
            otherCount: incl.filter(h => ['FUND', 'OTHER'].includes(h.assetType)).length,
            pricesFound: prices.size,
            targetsFound: Array.from(targetData.values()).filter(t => t.targetPrice > 0).length,
            equityGain: eqGain,
            equityGainPct: totalCurrentValue > 0 ? (eqGain / totalCurrentValue) * 100 : 0,
            fixedIncomeAnnualIncome: fiAi,
            fixedIncomeMarketValue: fiMv,
            fixedIncomeGainPct: fiMv > 0 ? (fiAi / fiMv) * 100 : 0,
            totalEstimated: eqGain + fiAi,
            totalEstimatedPct: totalPv > 0 ? ((eqGain + fiAi) / totalPv) * 100 : 0,
          };
        })(),
      };

      const res = await fetch('/api/exports/price-targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur de génération');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cours-cibles-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast('success', 'PDF téléchargé');
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Erreur de génération PDF');
    } finally {
      setGeneratingPdf(false);
    }
  }, [holdings, targetData, prices, result.summary, toast, pdfOptions, excludedRows]);

  // Copy target summary to clipboard
  const handleCopySummary = useCallback(() => {
    if (!targetSummary) return;
    const lines: string[] = [
      `RÉSUMÉ DES COURS CIBLES — ${new Date().toLocaleDateString('fr-CA')}`,
      ``,
      `Positions analysées: ${targetSummary.total}`,
      `Avec cours cible: ${targetSummary.withTargets} (${targetSummary.analystCount} analystes, ${targetSummary.historicalCount} hist., ${targetSummary.cdrCount} CDR, ${targetSummary.manualCount} manuels)`,
      `Sans données: ${targetSummary.noTargetCount}`,
      ``,
      `ACTIONS (gain en capital):`,
      `  Valeur actuelle: ${formatCurrency(targetSummary.totalCurrent)}`,
      `  Valeur cible 12 mois: ${formatCurrency(targetSummary.totalTarget)}`,
      `  Gain estimé: ${formatCurrency(targetSummary.equityGain)} (${formatPercent(targetSummary.equityGainPct)})`,
      ``,
      `REVENUS FIXES (revenu annuel):`,
      `  Valeur marchande: ${formatCurrency(targetSummary.fixedIncomeMarketValue)}`,
      `  Revenu annuel: ${formatCurrency(targetSummary.fixedIncomeAnnualIncome)} (${formatPercent(targetSummary.fixedIncomeGainPct)})`,
      ``,
      `TOTAL ESTIMÉ: ${formatCurrency(targetSummary.totalEstimated)} (${formatPercent(targetSummary.totalEstimatedPct)})`,
    ];

    // Add top/worst positions
    const equityHoldings = holdings
      .filter(h => !['CASH', 'FIXED_INCOME', 'OTHER'].includes(h.assetType))
      .map(h => ({ ...h, td: targetData.get(h.symbol) }))
      .filter(h => h.td && h.td.targetPrice > 0);

    const sorted = [...equityHoldings].sort((a, b) => (b.td?.gainPct || 0) - (a.td?.gainPct || 0));
    if (sorted.length > 0) {
      lines.push(``, `TOP 5 MEILLEURS:`);
      sorted.slice(0, 5).forEach((h, i) => {
        const gain$ = h.quantity * ((h.td?.targetPrice || 0) - (h.td?.currentPrice || 0));
        lines.push(`  ${i + 1}. ${h.symbol} — ${formatPercent(h.td?.gainPct || 0)} (${formatCurrency(gain$)})`);
      });
      const worst = sorted.slice(-5).reverse();
      if (worst.length > 0 && (worst[0].td?.gainPct || 0) < 0) {
        lines.push(``, `TOP 5 PIRES:`);
        worst.forEach((h, i) => {
          const gain$ = h.quantity * ((h.td?.targetPrice || 0) - (h.td?.currentPrice || 0));
          lines.push(`  ${i + 1}. ${h.symbol} — ${formatPercent(h.td?.gainPct || 0)} (${formatCurrency(gain$)})`);
        });
      }
    }

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedSummary(true);
    toast('success', 'Résumé copié dans le presse-papiers');
    setTimeout(() => setCopiedSummary(false), 2000);
  }, [targetSummary, holdings, targetData, toast]);

  // Export targets to CSV
  const handleExportCSV = useCallback(() => {
    const BOM = '\uFEFF';
    const headers = ['Symbole', 'Description', 'Type', 'Compte', 'Qté', 'PRU', 'Prix actuel', 'Val. marché', 'Poids %', 'Cours cible', 'Source', 'Gain %', 'Gain $', 'Revenu annuel'];
    const rows = holdings.map(h => {
      const td = targetData.get(h.symbol);
      const weight = totalPortfolioValue > 0 ? (Math.abs(h.marketValue) / totalPortfolioValue * 100) : 0;
      const currentPrice = td?.currentPrice || h.marketPrice;
      const gainDollar = td && td.targetPrice > 0 ? h.quantity * (td.targetPrice - currentPrice) : 0;
      return [
        h.symbol,
        `"${h.name.replace(/"/g, '""')}"`,
        h.assetType,
        h.accountLabel,
        h.quantity,
        h.averageCost.toFixed(2),
        currentPrice.toFixed(2),
        h.marketValue.toFixed(2),
        weight.toFixed(1),
        td?.targetPrice ? td.targetPrice.toFixed(2) : '',
        td?.source || '',
        td?.gainPct ? td.gainPct.toFixed(1) : '',
        gainDollar ? gainDollar.toFixed(2) : '',
        h.annualIncome.toFixed(2),
      ].join(',');
    });

    const csv = BOM + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cours-cibles-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('success', 'CSV exporté');
  }, [holdings, targetData, totalPortfolioValue, toast]);

  // Top/worst movers for quick analysis
  const movers = useMemo(() => {
    if (!showTargets || targetData.size === 0) return null;
    const equityHoldings = holdings
      .filter(h => !['CASH', 'FIXED_INCOME', 'OTHER'].includes(h.assetType))
      .map(h => {
        const td = targetData.get(h.symbol);
        if (!td || td.targetPrice <= 0) return null;
        const gainDollar = h.quantity * (td.targetPrice - td.currentPrice);
        return { symbol: h.symbol, name: h.name, gainPct: td.gainPct, gainDollar, weight: totalPortfolioValue > 0 ? (Math.abs(h.marketValue) / totalPortfolioValue * 100) : 0 };
      })
      .filter(Boolean) as { symbol: string; name: string; gainPct: number; gainDollar: number; weight: number }[];

    if (equityHoldings.length === 0) return null;
    const sorted = [...equityHoldings].sort((a, b) => b.gainPct - a.gainPct);
    const top = sorted.slice(0, 5);
    const worst = sorted.slice(-5).reverse().filter(h => h.gainPct < 0);
    return { top, worst };
  }, [showTargets, targetData, holdings, totalPortfolioValue]);

  return (
    <div className="space-y-6">
      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-800">
            {result.warnings.map((w, i) => <p key={i}>{w}</p>)}
          </div>
        </div>
      )}

      {/* AI classification check */}
      {aiChecking && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-indigo-50 border border-indigo-200">
          <Spinner size="sm" />
          <span className="text-sm text-indigo-700 font-medium">Vérification IA des classifications en cours...</span>
        </div>
      )}

      {aiChecked && aiCorrections.length > 0 && (() => {
        // Group corrections: show original type → new type for clarity
        const correctionsWithOriginal = aiCorrections.map(c => {
          const original = result.holdings.find(h => h.symbol === c.symbol);
          const origType = original?.assetType || 'OTHER';
          const origConfig = ASSET_TYPE_CONFIG[origType as AssetType];
          return { ...c, origType, origConfig };
        });

        return (
          <div className="px-4 py-3 rounded-xl bg-indigo-50 border border-indigo-200 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-600 flex-shrink-0" />
              <span className="text-sm font-bold text-indigo-900">
                IA — {aiCorrections.length} correction{aiCorrections.length > 1 ? 's' : ''} suggérée{aiCorrections.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-1.5">
              {correctionsWithOriginal.map((c) => {
                const newConfig = ASSET_TYPE_CONFIG[c.assetType as AssetType];
                const applied = typeOverrides[c.symbol] === c.assetType;
                return (
                  <div key={c.symbol} className="flex items-center gap-2 text-xs flex-wrap">
                    <span className="font-mono font-semibold text-brand-primary">{c.symbol}</span>
                    <span className={`px-1.5 py-0.5 rounded font-semibold ${c.origConfig?.bg || 'bg-gray-100'} ${c.origConfig?.color || 'text-gray-700'}`}>
                      {c.origConfig?.label || c.origType}
                    </span>
                    <span className="text-text-muted">→</span>
                    <span className={`px-1.5 py-0.5 rounded font-semibold ${newConfig?.bg || ''} ${newConfig?.color || ''}`}>
                      {newConfig?.label || c.assetType}
                    </span>
                    {c.reason && <span className="text-text-muted italic">({c.reason})</span>}
                    {applied ? (
                      <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                        <Check className="h-3 w-3" /> Appliqué
                      </span>
                    ) : (
                      <button
                        onClick={() => setTypeOverrides(prev => ({ ...prev, [c.symbol]: c.assetType as AssetType }))}
                        className="px-2 py-0.5 rounded bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
                      >
                        Appliquer
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Grouped apply buttons — separate "to FUND" from other corrections */}
            {(() => {
              const unapplied = aiCorrections.filter(c => typeOverrides[c.symbol] !== c.assetType);
              const toFund = unapplied.filter(c => c.assetType === 'FUND');
              const others = unapplied.filter(c => c.assetType !== 'FUND');
              if (unapplied.length === 0) return null;
              return (
                <div className="flex flex-wrap gap-2 mt-1">
                  {toFund.length > 0 && (
                    <button
                      onClick={() => {
                        const overrides: Record<string, AssetType> = { ...typeOverrides };
                        toFund.forEach(c => { overrides[c.symbol] = c.assetType as AssetType; });
                        setTypeOverrides(overrides);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 transition-colors"
                    >
                      Appliquer {toFund.length} → Fonds
                    </button>
                  )}
                  {others.length > 0 && (
                    <button
                      onClick={() => {
                        const overrides: Record<string, AssetType> = { ...typeOverrides };
                        others.forEach(c => { overrides[c.symbol] = c.assetType as AssetType; });
                        setTypeOverrides(overrides);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
                    >
                      Appliquer {others.length} autre{others.length > 1 ? 's' : ''}
                    </button>
                  )}
                  {toFund.length > 0 && others.length > 0 && (
                    <button
                      onClick={() => {
                        const overrides: Record<string, AssetType> = { ...typeOverrides };
                        unapplied.forEach(c => { overrides[c.symbol] = c.assetType as AssetType; });
                        setTypeOverrides(overrides);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-indigo-300 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition-colors"
                    >
                      Appliquer toutes ({unapplied.length})
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })()}

      {aiChecked && aiCorrections.length === 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
          <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span className="text-sm text-emerald-700 font-medium">IA — Classifications vérifiées, tout semble correct</span>
        </div>
      )}

      {/* Fund document status banner */}
      {fundCheckDone && fundCheckResults.length > 0 && (
        <div className="px-4 py-3 rounded-xl border border-blue-200 bg-blue-50/50 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-600 flex-shrink-0" />
              <span className="text-sm font-bold text-text-main">
                Rapports de fonds — {fundCheckResults.length} fonds détectés
              </span>
            </div>
            <a href="/fund-reports" target="_blank" className="text-xs text-brand-primary hover:underline font-medium">
              Gérer la bibliothèque
            </a>
          </div>
          <div className="space-y-1.5">
            {fundCheckResults.map((f) => (
              <div key={f.fund_code} className="flex items-center gap-2 text-xs">
                <span className="font-mono font-semibold text-brand-primary w-20">{f.fund_code}</span>
                {f.status === 'ok' && (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-emerald-700 font-medium">À jour</span>
                    {f.fund_name && <span className="text-text-muted">— {f.fund_name}</span>}
                  </>
                )}
                {f.status === 'outdated' && (
                  <>
                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-amber-700 font-medium">
                      Périmé ({Math.round(f.months_old || 0)} mois)
                    </span>
                    {f.fund_name && <span className="text-text-muted">— {f.fund_name}</span>}
                    <a href="/fund-reports" target="_blank" className="px-2 py-0.5 rounded bg-amber-600 text-white font-semibold hover:bg-amber-700 transition-colors">
                      Mettre à jour
                    </a>
                  </>
                )}
                {f.status === 'missing' && (
                  <>
                    <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-red-700 font-medium">Non uploadé</span>
                    <a href="/fund-reports" target="_blank" className="px-2 py-0.5 rounded bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors">
                      Uploader
                    </a>
                  </>
                )}
              </div>
            ))}
          </div>
          {fundCheckResults.every(f => f.status === 'ok') && (
            <div className="flex items-center gap-1.5 pt-1">
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs text-emerald-700 font-medium">
                Tous les rapports de fonds sont à jour — ils seront inclus dans le PDF
              </span>
            </div>
          )}
          {fundCheckResults.some(f => f.status === 'missing') && (
            <div className="flex items-center gap-1.5 pt-1">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs text-amber-700">
                Les fonds manquants ne seront pas inclus dans le rapport PDF
              </span>
            </div>
          )}
        </div>
      )}

      {/* Top bar: success banner — Duolingo style */}
      <div
        className="flex items-center justify-between p-4 rounded-2xl"
        style={{ backgroundColor: `${DUO.green}10`, border: `2px solid ${DUO.green}30`, borderBottom: `4px solid ${DUO.greenDark}25` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-white"
            style={{ backgroundColor: DUO.green, boxShadow: `0 3px 0 0 ${DUO.greenDark}` }}
          >
            <Check className="h-6 w-6" strokeWidth={3} />
          </div>
          <div>
            <p className="text-base font-extrabold text-text-main">
              {result.holdings.length} position{result.holdings.length > 1 ? 's' : ''} détectée{result.holdings.length > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-text-muted">
              Valeur marchande: <span className="font-bold">{formatCurrency(result.summary.totalMarketValue)}</span>
              {result.summary.totalAnnualIncome > 0 && (
                <> — Revenu: <span className="font-bold" style={{ color: DUO.green }}>{formatCurrency(result.summary.totalAnnualIncome)}</span></>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-gray-600 bg-white transition-all hover:bg-gray-50 active:translate-y-[1px]"
          style={{ border: '2px solid #e5e7eb', borderBottom: '3px solid #d1d5db' }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Recommencer
        </button>
      </div>

      {/* Account type badges */}
      {result.summary.accountTypes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {result.summary.accountTypes.map(code => {
            const label = ACCOUNT_TYPE_MAP[code] || code;
            const count = holdings.filter(h => h.accountType === code).length;
            const colorClass = ACCOUNT_COLORS[code] || 'bg-gray-100 text-gray-700';
            return (
              <span key={code} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${colorClass}`}>
                {label} ({count})
              </span>
            );
          })}
        </div>
      )}

      {/* Category cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <button
          onClick={() => setActiveFilter('ALL')}
          className="flex items-center gap-2 px-4 py-3 rounded-2xl transition-all duration-150 active:translate-y-[2px] active:shadow-none"
          style={{
            border: `2px solid ${activeFilter === 'ALL' ? DUO.blue : '#e5e7eb'}`,
            borderBottom: `4px solid ${activeFilter === 'ALL' ? DUO.blueDark : '#d1d5db'}`,
            backgroundColor: activeFilter === 'ALL' ? `${DUO.blue}08` : 'white',
          }}
        >
          <Eye className="h-4 w-4" style={{ color: DUO.blue }} />
          <span className="text-sm font-extrabold" style={{ color: activeFilter === 'ALL' ? DUO.blue : '#374151' }}>
            Tout ({holdings.length})
          </span>
        </button>
        {(Object.keys(ASSET_TYPE_CONFIG) as AssetType[]).map(type => (
          <CategoryCard
            key={type}
            type={type}
            count={result.summary[
              type === 'EQUITY' ? 'equities' :
              type === 'FIXED_INCOME' ? 'fixedIncome' :
              type === 'ETF' ? 'etfs' :
              type === 'FUND' ? 'funds' :
              type === 'PREFERRED' ? 'preferred' :
              type === 'CASH' ? 'cash' : 'other'
            ]}
            value={categoryValues[type]}
            active={activeFilter === type}
            onClick={() => setActiveFilter(type)}
          />
        ))}
      </div>

      {/* Maturity legend (shown when fixed income visible) */}
      {(activeFilter === 'ALL' || activeFilter === 'FIXED_INCOME') && result.summary.fixedIncome > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
          <span className="text-xs font-semibold text-text-muted">Échéance :</span>
          {MATURITY_BANDS.map((band) => (
            <div key={band.label} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-sm ${band.dot}`} />
              <span className={`text-xs font-medium ${band.color}`}>{band.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Source breakdown banner */}
      {showTargets && targetSummary && !isLoadingPrices && (
        <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 space-y-2">
          <p className="text-sm font-bold text-text-main">Sources des cours cibles</p>
          <div className="flex flex-wrap gap-3">
            {targetSummary.analystCount > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                <span className="text-xs font-medium text-text-main">
                  {targetSummary.analystCount} titre{targetSummary.analystCount > 1 ? 's' : ''} — <span className="text-purple-700">Consensus analyste</span>
                </span>
              </div>
            )}
            {targetSummary.historicalCount > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                <span className="text-xs font-medium text-text-main">
                  {targetSummary.historicalCount} titre{targetSummary.historicalCount > 1 ? 's' : ''} — <span className="text-sky-700">Estimation historique 12 mois</span>
                </span>
              </div>
            )}
            {targetSummary.cdrCount > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-xs font-medium text-text-main">
                  {targetSummary.cdrCount} titre{targetSummary.cdrCount > 1 ? 's' : ''} — <span className="text-emerald-700">CDR C$HDG (sous-jacent US)</span>
                </span>
              </div>
            )}
            {targetSummary.manualCount > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-xs font-medium text-text-main">
                  {targetSummary.manualCount} titre{targetSummary.manualCount > 1 ? 's' : ''} — <span className="text-amber-700">Manuel</span>
                </span>
              </div>
            )}
            {targetSummary.noTargetCount > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                <span className="text-xs font-medium text-text-main">
                  {targetSummary.noTargetCount} titre{targetSummary.noTargetCount > 1 ? 's' : ''} — <span className="text-text-muted">Aucune donnée</span>
                </span>
              </div>
            )}
          </div>
          {targetSummary.historicalCount > 0 && (
            <p className="text-[11px] text-sky-700 bg-sky-50 px-3 py-1.5 rounded-lg border border-sky-200 mt-1">
              Les estimations historiques projettent le rendement des 12 derniers mois sur le prix actuel.
              Ce n&apos;est pas une prévision — vous pouvez modifier ces cibles manuellement avec le crayon.
            </p>
          )}
        </div>
      )}

      {/* Top/Worst movers */}
      {showTargets && movers && !isLoadingPrices && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Top movers */}
          <Card className="bg-emerald-50/30 border-emerald-200/50">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-bold text-emerald-800">Meilleurs potentiels</span>
            </div>
            <div className="space-y-1.5">
              {movers.top.map((h, i) => (
                <div key={h.symbol} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-600 w-4">{i + 1}.</span>
                  <span className="font-mono text-xs font-semibold text-brand-primary w-16 truncate">{h.symbol}</span>
                  <div className="flex-1 h-4 bg-emerald-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${Math.min(Math.max(h.gainPct, 0), 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-emerald-700 w-14 text-right">{formatPercent(h.gainPct)}</span>
                  <span className="text-[10px] text-emerald-600 w-20 text-right">{formatCurrency(h.gainDollar)}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Worst movers */}
          <Card className={`${movers.worst.length > 0 ? 'bg-red-50/30 border-red-200/50' : 'bg-gray-50/30 border-gray-200/50'}`}>
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-sm font-bold text-red-800">Sous pression</span>
            </div>
            {movers.worst.length > 0 ? (
              <div className="space-y-1.5">
                {movers.worst.map((h, i) => (
                  <div key={h.symbol} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-red-500 w-4">{i + 1}.</span>
                    <span className="font-mono text-xs font-semibold text-brand-primary w-16 truncate">{h.symbol}</span>
                    <div className="flex-1 h-4 bg-red-100 rounded-full overflow-hidden flex justify-end">
                      <div
                        className="h-full bg-red-400 rounded-full transition-all"
                        style={{ width: `${Math.min(Math.abs(h.gainPct), 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-red-600 w-14 text-right">{formatPercent(h.gainPct)}</span>
                    <span className="text-[10px] text-red-500 w-20 text-right">{formatCurrency(h.gainDollar)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-muted italic">Aucun titre avec gain négatif estimé</p>
            )}
          </Card>
        </div>
      )}

      {/* Holdings table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-text-muted bg-gray-50/50">
                <th className="w-8 py-3 px-1"></th>
                <th className="text-left py-3 px-3 font-semibold text-xs">Type</th>
                <th className="text-center py-3 px-2 font-semibold text-xs">Compte</th>
                <th className="text-right py-3 px-3 font-semibold text-xs">Quantité</th>
                <th
                  className="text-left py-3 px-3 font-semibold text-xs cursor-pointer hover:text-brand-primary select-none"
                  onClick={() => toggleSort('name')}
                >
                  <span className="inline-flex items-center gap-1">
                    Description
                    {sortColumn === 'name' ? (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                  </span>
                </th>
                <th
                  className="text-left py-3 px-3 font-semibold text-xs cursor-pointer hover:text-brand-primary select-none"
                  onClick={() => toggleSort('symbol')}
                >
                  <span className="inline-flex items-center gap-1">
                    Symbole
                    {sortColumn === 'symbol' ? (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                  </span>
                </th>
                <th className="text-right py-3 px-3 font-semibold text-xs">Coût</th>
                <th
                  className="text-right py-3 px-3 font-semibold text-xs cursor-pointer hover:text-brand-primary select-none"
                  onClick={() => toggleSort('currentPrice')}
                >
                  <span className="inline-flex items-center gap-1 justify-end">
                    Prix au marché
                    {sortColumn === 'currentPrice' ? (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                  </span>
                </th>
                {showTargets && (
                  <th
                    className="text-right py-3 px-3 font-semibold text-xs cursor-pointer hover:text-brand-primary select-none"
                    onClick={() => toggleSort('targetPrice')}
                  >
                    <span className="inline-flex items-center gap-1 justify-end">
                      Cours cible
                      {sortColumn === 'targetPrice' ? (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                    </span>
                  </th>
                )}
                <th className="text-right py-3 px-3 font-semibold text-xs">Coût total</th>
                <th
                  className="text-right py-3 px-3 font-semibold text-xs cursor-pointer hover:text-brand-primary select-none"
                  onClick={() => toggleSort('marketValue')}
                >
                  <span className="inline-flex items-center gap-1 justify-end">
                    Valeur au marché totale
                    {sortColumn === 'marketValue' ? (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                  </span>
                </th>
                {showTargets && (
                  <>
                    <th className="text-right py-3 px-3 font-semibold text-xs">Cours cible total 12 mois</th>
                    <th
                      className="text-right py-3 px-3 font-semibold text-xs cursor-pointer hover:text-brand-primary select-none"
                      onClick={() => toggleSort('gainDollar')}
                    >
                      <span className="inline-flex items-center gap-1 justify-end">
                        Gain espéré en $
                        {sortColumn === 'gainDollar' ? (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </span>
                    </th>
                    <th
                      className="text-right py-3 px-3 font-semibold text-xs cursor-pointer hover:text-brand-primary select-none"
                      onClick={() => toggleSort('gainPct')}
                    >
                      <span className="inline-flex items-center gap-1 justify-end">
                        Estimation variation 12 mois
                        {sortColumn === 'gainPct' ? (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </span>
                    </th>
                  </>
                )}
                <th
                  className="text-right py-3 px-3 font-semibold text-xs cursor-pointer hover:text-brand-primary select-none"
                  onClick={() => toggleSort('annualIncome')}
                  title="Dividendes (actions) ou coupons / intérêts (revenus fixes) attendus sur 12 mois"
                >
                  <span className="inline-flex items-center gap-1 justify-end">
                    Dividende / Intérêt
                    {sortColumn === 'annualIncome' ? (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredHoldings.map((h) => {
                const config = ASSET_TYPE_CONFIG[h.assetType];
                const Icon = ASSET_ICONS[h.assetType];
                const rowKey = h._key;
                const isExpanded = expandedRow === rowKey;
                const isExcluded = excludedRows.has(rowKey);
                const td = targetData.get(h.symbol);
                const acctColor = ACCOUNT_COLORS[h.accountType] || 'bg-gray-100 text-gray-700';

                return (
                  <tr
                    key={rowKey}
                    className={`border-b border-gray-50 transition-colors ${isExcluded ? 'opacity-40' : ''} ${isExpanded ? 'bg-gray-50/80' : 'hover:bg-gray-50/50'}`}
                  >
                    <td className="py-2.5 px-1 text-center">
                      {isExcluded ? (
                        <button
                          onClick={() => setExcludedRows(prev => { const next = new Set(prev); next.delete(rowKey); return next; })}
                          className="p-1 rounded-full hover:bg-green-50 text-green-400 hover:text-green-600 transition-colors"
                          title="Réinclure"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => setExcludedRows(prev => new Set(prev).add(rowKey))}
                          className="p-1 rounded-full hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                          title="Exclure du rapport"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${config.bg} ${config.color}`}>
                        <Icon className="h-3 w-3" />
                        {config.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${acctColor}`}>
                        {h.accountLabel}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium tabular-nums text-xs">
                      {h.quantity !== 0 ? h.quantity.toLocaleString('fr-CA') : '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        onClick={() => setExpandedRow(isExpanded ? null : rowKey)}
                        className="flex items-center gap-1 text-left text-text-main hover:text-brand-primary transition-colors"
                      >
                        <span className="truncate max-w-[200px] text-xs">{h.name}</span>
                        {(h.couponRate || h.maturityDate || h.modifiedDuration || h.accruedInterest) && (
                          isExpanded
                            ? <ChevronUp className="h-3 w-3 text-text-muted flex-shrink-0" />
                            : <ChevronDown className="h-3 w-3 text-text-muted flex-shrink-0" />
                        )}
                      </button>
                      {isExpanded && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {h.couponRate !== undefined && h.couponRate > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                              Coupon: {h.couponRate.toFixed(2)}%
                            </span>
                          )}
                          {h.maturityDate && (() => {
                            const band = getMaturityBand(h.maturityDate);
                            return (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${band ? `${band.bg} ${band.color} ${band.border}` : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                {band && <span className={`inline-block w-1.5 h-1.5 rounded-full ${band.dot}`} />}
                                Éch: {h.maturityDate}
                              </span>
                            );
                          })()}
                          {h.modifiedDuration !== undefined && h.modifiedDuration > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
                              Durée mod: {h.modifiedDuration.toFixed(2)}
                            </span>
                          )}
                          {h.accruedInterest !== undefined && h.accruedInterest !== 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700">
                              Int. courus: {formatCurrencyFull(h.accruedInterest)}
                            </span>
                          )}
                          {h.averageCost > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-text-muted">
                              Val. compt: {formatCurrency(h.bookValue)}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-2">
                        {h.assetType !== 'CASH' && (
                          <SymbolLogo symbol={h.symbol} logos={logos} />
                        )}
                        <div>
                          {editingSymbol === h._originalKey ? (
                            <input
                              type="text"
                              autoFocus
                              defaultValue={h.symbol}
                              className="w-24 px-1.5 py-0.5 text-sm font-mono border border-brand-primary rounded focus:outline-none focus:ring-1 focus:ring-brand-primary"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const val = (e.target as HTMLInputElement).value.trim().toUpperCase();
                                  if (val) setSymbolOverrides(prev => ({ ...prev, [h._originalKey]: val }));
                                  setEditingSymbol(null);
                                } else if (e.key === 'Escape') {
                                  setEditingSymbol(null);
                                }
                              }}
                              onBlur={(e) => {
                                const val = e.target.value.trim().toUpperCase();
                                if (val) setSymbolOverrides(prev => ({ ...prev, [h._originalKey]: val }));
                                setEditingSymbol(null);
                              }}
                            />
                          ) : (
                            <div className="flex items-center gap-1 group">
                              <span className="font-mono font-bold text-xs" style={{ color: duoColor(h.symbol.replace('.TO', '')) }}>{h.symbol}</span>
                              {h.isCDR && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium" title={`CDR → sous-jacent: ${h.underlyingSymbol || '?'}, devise: ${h.currency}`}>
                                  CDR→{h.underlyingSymbol || '?'}
                                </span>
                              )}
                              <button
                                onClick={() => setEditingSymbol(h._originalKey)}
                            className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-100 text-text-muted hover:text-brand-primary transition-opacity"
                            title="Modifier le symbole"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-xs text-text-muted">
                      {h.averageCost > 0 ? formatCurrencyFull(h.averageCost) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-xs">
                      {editingCurrentPrice === h._key ? (
                        <input
                          type="number"
                          step="0.01"
                          autoFocus
                          defaultValue={(showTargets && td ? td.currentPrice : h.marketPrice) || ''}
                          className="w-20 px-1.5 py-0.5 text-right text-sm border border-brand-primary rounded focus:outline-none focus:ring-1 focus:ring-brand-primary"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const val = parseFloat((e.target as HTMLInputElement).value);
                              if (!isNaN(val) && val > 0) setCustomCurrentPrices(prev => ({ ...prev, [h.symbol]: val }));
                              setEditingCurrentPrice(null);
                            } else if (e.key === 'Escape') {
                              setEditingCurrentPrice(null);
                            }
                          }}
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val) && val > 0) setCustomCurrentPrices(prev => ({ ...prev, [h.symbol]: val }));
                            setEditingCurrentPrice(null);
                          }}
                        />
                      ) : (() => {
                        const displayPrice = customCurrentPrices[h.symbol]
                          ?? (showTargets && td ? td.currentPrice : h.marketPrice);
                        const hasOverride = h.symbol in customCurrentPrices;
                        return (
                          <div className="flex items-center justify-end gap-1 group">
                            {displayPrice > 0 ? (
                              <span className={`font-semibold ${hasOverride ? 'text-amber-700' : ''}`}>{formatCurrencyFull(displayPrice)}</span>
                            ) : (
                              <span className="text-text-muted">—</span>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingCurrentPrice(h._key); }}
                              className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-100 text-text-muted hover:text-brand-primary transition-opacity"
                              title="Modifier le prix marché"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            {hasOverride && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setCustomCurrentPrices(prev => { const next = { ...prev }; delete next[h.symbol]; return next; }); }}
                                className="p-0.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600"
                                title="Réinitialiser"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    {showTargets && (
                      <td className="py-2.5 px-3 text-right">
                        {editingTarget === h._key ? (
                          <input
                            type="number"
                            step="0.01"
                            autoFocus
                            defaultValue={td?.targetPrice || ''}
                            className="w-20 px-1.5 py-0.5 text-right text-sm border border-brand-primary rounded focus:outline-none focus:ring-1 focus:ring-brand-primary"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = parseFloat((e.target as HTMLInputElement).value);
                                if (!isNaN(val) && val > 0) setCustomTargets(prev => ({ ...prev, [h.symbol]: val }));
                                setEditingTarget(null);
                              } else if (e.key === 'Escape') {
                                setEditingTarget(null);
                              }
                            }}
                            onBlur={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val) && val > 0) setCustomTargets(prev => ({ ...prev, [h.symbol]: val }));
                              setEditingTarget(null);
                            }}
                          />
                        ) : td && td.targetPrice > 0 ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="font-semibold text-xs">{formatCurrencyFull(td.targetPrice)}</span>
                            <span className={`text-[10px] px-1 py-0.5 rounded ${
                              td.source === 'Manuel' ? 'bg-amber-100 text-amber-700'
                                : td.source === 'CDR' ? 'bg-emerald-100 text-emerald-700'
                                : td.source === 'Est. hist.' ? 'bg-sky-100 text-sky-700'
                                : 'bg-purple-100 text-purple-700'
                            }`}>
                              {td.source}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingTarget(h._key); }}
                              className="p-1 rounded hover:bg-gray-100 text-text-muted hover:text-brand-primary"
                              title="Modifier le cours cible"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            {h.symbol in customTargets && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setCustomTargets(prev => { const next = { ...prev }; delete next[h.symbol]; return next; }); }}
                                className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600"
                                title="Réinitialiser"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingTarget(h._key); }}
                            className="px-2 py-1 text-xs border border-amber-300 bg-amber-50 text-amber-700 rounded hover:bg-amber-100 cursor-pointer"
                          >
                            Saisir
                          </button>
                        )}
                      </td>
                    )}
                    <td className="py-2.5 px-3 text-right tabular-nums text-xs text-text-muted">
                      {h.averageCost > 0 && h.quantity !== 0 ? formatCurrency(h.quantity * h.averageCost) : '—'}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-semibold tabular-nums text-xs ${h.marketValue < 0 ? 'text-red-500' : ''}`}>
                      {h.marketValue !== 0 ? formatCurrency(h.marketValue) : '—'}
                    </td>
                    {showTargets && (
                      <>
                        <td className="py-2.5 px-3 text-right font-semibold tabular-nums text-xs">
                          {td && td.targetPrice > 0 ? formatCurrency(h.quantity * td.targetPrice) : '—'}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-semibold tabular-nums text-xs ${
                          td && td.targetPrice > 0 && td.gainPct > 0 ? 'text-emerald-600' : td && td.targetPrice > 0 && td.gainPct < 0 ? 'text-red-500' : 'text-text-muted'
                        }`}>
                          {td && td.targetPrice > 0 ? formatCurrency(h.quantity * (td.targetPrice - td.currentPrice)) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {td && td.targetPrice > 0 ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <div className="w-10 h-3 bg-gray-100 rounded-sm overflow-hidden flex items-center">
                                {td.gainPct >= 0 ? (
                                  <div className="h-full bg-emerald-400 rounded-sm" style={{ width: `${Math.min(td.gainPct, 50) * 2}%` }} />
                                ) : (
                                  <div className="h-full bg-red-400 rounded-sm ml-auto" style={{ width: `${Math.min(Math.abs(td.gainPct), 50) * 2}%` }} />
                                )}
                              </div>
                              <span className={`font-bold tabular-nums text-xs ${td.gainPct > 0 ? 'text-emerald-600' : td.gainPct < 0 ? 'text-red-500' : 'text-text-muted'}`}>
                                {formatPercent(td.gainPct)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-text-muted text-xs">—</span>
                          )}
                        </td>
                      </>
                    )}
                    <td className="py-2.5 px-3 text-right tabular-nums text-xs">
                      {(() => {
                        const entry = incomeData.get(h._key);
                        if (!entry || entry.annualIncome <= 0) {
                          return <span className="text-text-muted">—</span>;
                        }
                        const isFixed = h.assetType === 'FIXED_INCOME';
                        const sourceLabel =
                          entry.source === 'forward' ? 'Forward'
                            : entry.source === 'croesus' ? 'Croesus'
                              : entry.source === 'coupon' ? 'Coupon'
                                : '';
                        const sourceBadge =
                          entry.source === 'forward' ? 'bg-emerald-100 text-emerald-700'
                            : entry.source === 'croesus' ? 'bg-sky-100 text-sky-700'
                              : 'bg-amber-100 text-amber-700';
                        return (
                          <div className="flex flex-col items-end leading-tight gap-0.5">
                            <div className="flex items-center gap-1">
                              <span className={`font-semibold ${isFixed ? 'text-sky-700' : 'text-emerald-600'}`}>
                                {formatCurrency(entry.annualIncome)}
                              </span>
                              <span
                                className={`text-[9px] px-1 py-0.5 rounded ${sourceBadge}`}
                                title={
                                  entry.source === 'forward' ? 'Dividende forward Yahoo Finance (estimation 12 mois)'
                                    : entry.source === 'croesus' ? 'Revenu annuel rapporté par Croesus'
                                      : entry.source === 'coupon' ? 'Calculé à partir du taux de coupon × quantité'
                                        : ''
                                }
                              >
                                {sourceLabel}
                              </span>
                            </div>
                            {entry.yieldPct > 0 && (
                              <span className="text-[10px] text-text-muted">
                                {isFixed ? 'Coupon' : 'Div.'} {entry.yieldPct.toFixed(2)}%
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {(incomeTotals.total > 0) && (
              <tfoot>
                <tr className="border-t-2 border-brand-primary/20 bg-gradient-to-r from-emerald-50/50 to-sky-50/50">
                  <td colSpan={showTargets ? 14 : 10} className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-4 text-xs">
                      <span className="text-text-muted">Revenus projetés 12 mois:</span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-text-muted">Dividendes</span>
                        <span className="font-bold text-emerald-700">{formatCurrency(incomeTotals.equityDividends)}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-sky-500" />
                        <span className="text-text-muted">Revenus fixes</span>
                        <span className="font-bold text-sky-700">{formatCurrency(incomeTotals.fixedIncomeCoupons)}</span>
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex flex-col items-end leading-tight">
                      <span className="text-[10px] text-text-muted uppercase tracking-wide">Total</span>
                      <span className="font-bold text-brand-primary text-sm">{formatCurrency(incomeTotals.total)}</span>
                    </div>
                  </td>
                </tr>
                {(incomeTotals.equityNoData > 0 || incomeTotals.fixedNoData > 0 || incomeTotals.equityWithCroesus > 0 || incomeTotals.fixedWithCoupon > 0) && (
                  <tr className="border-t border-gray-100 bg-gray-50/30">
                    <td colSpan={showTargets ? 15 : 11} className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end gap-3 text-[10px] text-text-muted flex-wrap">
                        <span>Sources:</span>
                        {incomeTotals.equityWithForward > 0 && (
                          <span className="flex items-center gap-1">
                            <span className="inline-block px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">Forward</span>
                            <span>{incomeTotals.equityWithForward} action{incomeTotals.equityWithForward > 1 ? 's' : ''}</span>
                          </span>
                        )}
                        {incomeTotals.equityWithCroesus > 0 && (
                          <span className="flex items-center gap-1">
                            <span className="inline-block px-1 py-0.5 rounded bg-sky-100 text-sky-700 font-medium">Croesus</span>
                            <span>{incomeTotals.equityWithCroesus} action{incomeTotals.equityWithCroesus > 1 ? 's' : ''} (trailing)</span>
                          </span>
                        )}
                        {incomeTotals.fixedWithCroesus > 0 && (
                          <span className="flex items-center gap-1">
                            <span className="inline-block px-1 py-0.5 rounded bg-sky-100 text-sky-700 font-medium">Croesus</span>
                            <span>{incomeTotals.fixedWithCroesus} revenu{incomeTotals.fixedWithCroesus > 1 ? 's' : ''} fixe{incomeTotals.fixedWithCroesus > 1 ? 's' : ''}</span>
                          </span>
                        )}
                        {incomeTotals.fixedWithCoupon > 0 && (
                          <span className="flex items-center gap-1">
                            <span className="inline-block px-1 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">Coupon</span>
                            <span>{incomeTotals.fixedWithCoupon} calculé{incomeTotals.fixedWithCoupon > 1 ? 's' : ''}</span>
                          </span>
                        )}
                        {(incomeTotals.equityNoData > 0 || incomeTotals.fixedNoData > 0) && (
                          <span className="text-red-500">
                            {incomeTotals.equityNoData + incomeTotals.fixedNoData} sans donnée
                          </span>
                        )}
                        {!showTargets && (
                          <span className="italic">Active &laquo; Cours cibles &raquo; pour les dividendes forward Yahoo</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* Target price summary */}
      {showTargets && targetSummary && !isLoadingPrices && (
        <div className="p-5 bg-gradient-to-r from-brand-primary/5 to-emerald-50 rounded-xl border border-brand-primary/10 space-y-4">
          {/* Top row: overview KPIs */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-text-muted">Prix temps réel</p>
              <p className="text-sm font-bold text-text-main">{prices.size}/{priceableSymbols.length}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Valeur actuelle (actions)</p>
              <p className="text-lg font-bold text-text-main">{formatCurrency(targetSummary.totalCurrent)}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Valeur cible 12 mois</p>
              <p className="text-lg font-bold text-brand-primary">{formatCurrency(targetSummary.totalTarget)}</p>
            </div>
          </div>

          {/* Gains breakdown */}
          <div className="border-t border-brand-primary/10 pt-4">
            <p className="text-xs font-bold text-text-main mb-3 uppercase tracking-wide">Gains estimés par catégorie</p>
            <div className="grid grid-cols-2 gap-3">
              {/* Actions */}
              <div className="p-3 rounded-lg bg-white/80 border border-emerald-200">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-text-main">Actions (gain en capital)</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${targetSummary.equityGainPct >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                    {formatPercent(targetSummary.equityGainPct)}
                  </span>
                </div>
                <p className={`text-xl font-bold ${targetSummary.equityGain >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {formatCurrency(targetSummary.equityGain)}
                </p>
              </div>
              {/* Revenus fixes */}
              <div className="p-3 rounded-lg bg-white/80 border border-emerald-200">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-text-main">Revenus fixes (revenu annuel)</p>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    {formatPercent(targetSummary.fixedIncomeGainPct)}
                  </span>
                </div>
                <p className="text-xl font-bold text-emerald-600">
                  {formatCurrency(targetSummary.fixedIncomeAnnualIncome)}
                </p>
              </div>
            </div>
            {/* Total */}
            <div className="mt-3 p-3 rounded-lg bg-emerald-50 border-2 border-emerald-300">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-text-main">Total estimé</p>
                <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${targetSummary.totalEstimatedPct >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                  {formatPercent(targetSummary.totalEstimatedPct)}
                </span>
              </div>
              <p className={`text-2xl font-bold ${targetSummary.totalEstimated >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {formatCurrency(targetSummary.totalEstimated)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      {!showTargets ? (
        <div className="flex justify-center">
          <button
            onClick={() => setShowTargets(true)}
            className="flex items-center gap-2.5 px-8 py-3.5 rounded-2xl text-white font-extrabold text-base
              transition-all duration-150 active:translate-y-[2px] active:shadow-none hover:brightness-105"
            style={{ backgroundColor: DUO.blue, boxShadow: `0 4px 0 0 ${DUO.blueDark}` }}
          >
            <TrendingUp className="h-5 w-5" />
            Charger les cours cibles
          </button>
        </div>
      ) : isLoadingPrices ? (
        <div className="flex justify-center">
          <div
            className="flex items-center gap-2.5 px-8 py-3.5 rounded-2xl text-sm font-bold"
            style={{ backgroundColor: `${DUO.blue}12`, color: DUO.blue, border: `2px solid ${DUO.blue}30` }}
          >
            <Spinner size="sm" />
            Chargement des prix et cours cibles...
          </div>
        </div>
      ) : showPdfBuilder ? (
        <div className="space-y-4">
          {/* ── PDF Builder Panel ── */}
          <div
            className="p-6 rounded-2xl"
            style={{ backgroundColor: `${DUO.purple}06`, border: `2px solid ${DUO.purple}25`, borderBottom: `4px solid ${DUO.purpleDark}20` }}
          >
            {/* Header */}
            <div className="text-center mb-6">
              <div
                className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
                style={{ backgroundColor: `${DUO.purple}15`, boxShadow: `0 3px 0 0 ${DUO.purpleDark}20` }}
              >
                <FileText className="h-7 w-7" style={{ color: DUO.purple }} />
              </div>
              <h3 className="text-xl font-extrabold text-text-main">Composez votre rapport</h3>
              <p className="text-sm text-text-muted mt-1">Cochez les sections à inclure dans le PDF</p>
            </div>

            {/* Section toggle cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              {/* Cover page */}
              <button
                onClick={() => setPdfOptions(p => ({ ...p, includeCover: !p.includeCover }))}
                className="relative text-left p-4 rounded-2xl transition-all duration-200 active:translate-y-[1px]"
                style={{
                  border: `2px solid ${pdfOptions.includeCover ? DUO.orange : '#e5e7eb'}`,
                  borderBottom: `4px solid ${pdfOptions.includeCover ? DUO.orangeDark : '#d1d5db'}`,
                  backgroundColor: pdfOptions.includeCover ? `${DUO.orange}08` : '#fafafa',
                }}
              >
                <div
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: pdfOptions.includeCover ? DUO.green : '#d1d5db', boxShadow: pdfOptions.includeCover ? `0 2px 0 0 ${DUO.greenDark}` : 'none' }}
                >
                  <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                </div>
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center mb-2"
                  style={{ backgroundColor: pdfOptions.includeCover ? `${DUO.orange}20` : '#f3f4f6' }}
                >
                  <BookOpen className="h-5 w-5" style={{ color: pdfOptions.includeCover ? DUO.orange : '#9ca3af' }} />
                </div>
                <p className="text-xs font-extrabold" style={{ color: pdfOptions.includeCover ? '#1f2937' : '#9ca3af' }}>
                  Page couverture
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: pdfOptions.includeCover ? '#6b7280' : '#d1d5db' }}>
                  Résumé & KPIs
                </p>
              </button>

              {/* Equities / price targets */}
              {(() => {
                const count = holdings.filter(h => !['CASH', 'FIXED_INCOME', 'OTHER'].includes(h.assetType)).length;
                if (count === 0) return null;
                return (
                  <button
                    onClick={() => setPdfOptions(p => ({ ...p, includeEquities: !p.includeEquities }))}
                    className="relative text-left p-4 rounded-2xl transition-all duration-200 active:translate-y-[1px]"
                    style={{
                      border: `2px solid ${pdfOptions.includeEquities ? DUO.blue : '#e5e7eb'}`,
                      borderBottom: `4px solid ${pdfOptions.includeEquities ? DUO.blueDark : '#d1d5db'}`,
                      backgroundColor: pdfOptions.includeEquities ? `${DUO.blue}08` : '#fafafa',
                    }}
                  >
                    <div
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: pdfOptions.includeEquities ? DUO.green : '#d1d5db', boxShadow: pdfOptions.includeEquities ? `0 2px 0 0 ${DUO.greenDark}` : 'none' }}
                    >
                      <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                    </div>
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center mb-2"
                      style={{ backgroundColor: pdfOptions.includeEquities ? `${DUO.blue}20` : '#f3f4f6' }}
                    >
                      <TrendingUp className="h-5 w-5" style={{ color: pdfOptions.includeEquities ? DUO.blue : '#9ca3af' }} />
                    </div>
                    <p className="text-xs font-extrabold" style={{ color: pdfOptions.includeEquities ? '#1f2937' : '#9ca3af' }}>
                      Cours cibles
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: pdfOptions.includeEquities ? '#6b7280' : '#d1d5db' }}>
                      {count} position{count > 1 ? 's' : ''}
                    </p>
                  </button>
                );
              })()}

              {/* Fixed income */}
              {(() => {
                const count = holdings.filter(h => h.assetType === 'FIXED_INCOME').length;
                if (count === 0) return null;
                return (
                  <button
                    onClick={() => setPdfOptions(p => ({ ...p, includeFixedIncome: !p.includeFixedIncome }))}
                    className="relative text-left p-4 rounded-2xl transition-all duration-200 active:translate-y-[1px]"
                    style={{
                      border: `2px solid ${pdfOptions.includeFixedIncome ? DUO.orange : '#e5e7eb'}`,
                      borderBottom: `4px solid ${pdfOptions.includeFixedIncome ? DUO.orangeDark : '#d1d5db'}`,
                      backgroundColor: pdfOptions.includeFixedIncome ? `${DUO.orange}08` : '#fafafa',
                    }}
                  >
                    <div
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: pdfOptions.includeFixedIncome ? DUO.green : '#d1d5db', boxShadow: pdfOptions.includeFixedIncome ? `0 2px 0 0 ${DUO.greenDark}` : 'none' }}
                    >
                      <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                    </div>
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center mb-2"
                      style={{ backgroundColor: pdfOptions.includeFixedIncome ? `${DUO.orange}20` : '#f3f4f6' }}
                    >
                      <Landmark className="h-5 w-5" style={{ color: pdfOptions.includeFixedIncome ? DUO.orange : '#9ca3af' }} />
                    </div>
                    <p className="text-xs font-extrabold" style={{ color: pdfOptions.includeFixedIncome ? '#1f2937' : '#9ca3af' }}>
                      Revenus fixes
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: pdfOptions.includeFixedIncome ? '#6b7280' : '#d1d5db' }}>
                      {count} position{count > 1 ? 's' : ''}
                    </p>
                  </button>
                );
              })()}

              {/* Cash & other */}
              {(() => {
                const count = holdings.filter(h => ['CASH', 'FUND', 'OTHER'].includes(h.assetType)).length;
                if (count === 0) return null;
                return (
                  <button
                    onClick={() => setPdfOptions(p => ({ ...p, includeCashOther: !p.includeCashOther }))}
                    className="relative text-left p-4 rounded-2xl transition-all duration-200 active:translate-y-[1px]"
                    style={{
                      border: `2px solid ${pdfOptions.includeCashOther ? DUO.green : '#e5e7eb'}`,
                      borderBottom: `4px solid ${pdfOptions.includeCashOther ? DUO.greenDark : '#d1d5db'}`,
                      backgroundColor: pdfOptions.includeCashOther ? `${DUO.green}08` : '#fafafa',
                    }}
                  >
                    <div
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: pdfOptions.includeCashOther ? DUO.green : '#d1d5db', boxShadow: pdfOptions.includeCashOther ? `0 2px 0 0 ${DUO.greenDark}` : 'none' }}
                    >
                      <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                    </div>
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center mb-2"
                      style={{ backgroundColor: pdfOptions.includeCashOther ? `${DUO.green}20` : '#f3f4f6' }}
                    >
                      <Wallet className="h-5 w-5" style={{ color: pdfOptions.includeCashOther ? DUO.green : '#9ca3af' }} />
                    </div>
                    <p className="text-xs font-extrabold" style={{ color: pdfOptions.includeCashOther ? '#1f2937' : '#9ca3af' }}>
                      Liquidités & autres
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: pdfOptions.includeCashOther ? '#6b7280' : '#d1d5db' }}>
                      {count} position{count > 1 ? 's' : ''}
                    </p>
                  </button>
                );
              })()}
            </div>

            {/* Fund reports section with inline upload */}
            {fundCheckResults.length > 0 && (
              <div className="mb-5 p-4 rounded-xl bg-white border border-gray-200">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="h-4 w-4" style={{ color: DUO.teal }} />
                  <span className="text-sm font-bold text-text-main">Rapports de fonds</span>
                  <span className="text-xs text-text-muted">
                    ({pdfOptions.fundCodesToInclude.length} sélectionné{pdfOptions.fundCodesToInclude.length !== 1 ? 's' : ''})
                  </span>
                </div>
                <div className="space-y-2">
                  {fundCheckResults.map(f => {
                    const isOk = f.status === 'ok';
                    const isIncluded = pdfOptions.fundCodesToInclude.includes(f.fund_code);
                    const isUploading = fundUploading[f.fund_code];
                    const isDragHover = fundDragOver === f.fund_code;
                    const needsUpload = f.status === 'missing' || f.status === 'outdated';

                    // Fund row with optional drop zone for missing/outdated
                    return (
                      <div
                        key={f.fund_code}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-all duration-200 ${
                          isDragHover ? 'ring-2 scale-[1.01]' : ''
                        }`}
                        style={{
                          backgroundColor: isDragHover ? `${DUO.teal}10` : isUploading ? '#f0fdf4' : 'transparent',
                          borderColor: isDragHover ? DUO.teal : 'transparent',
                          ...(isDragHover ? { ringColor: `${DUO.teal}40` } : {}),
                        }}
                        onDragOver={needsUpload && !isUploading ? (e) => { e.preventDefault(); e.stopPropagation(); setFundDragOver(f.fund_code); } : undefined}
                        onDragLeave={needsUpload ? () => setFundDragOver(null) : undefined}
                        onDrop={needsUpload && !isUploading ? (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setFundDragOver(null);
                          const file = e.dataTransfer.files?.[0];
                          if (file) handleFundUpload(f.fund_code, file);
                        } : undefined}
                      >
                        {/* Checkbox / status icon */}
                        {isOk ? (
                          <button
                            onClick={() => setPdfOptions(p => ({
                              ...p,
                              fundCodesToInclude: isIncluded
                                ? p.fundCodesToInclude.filter(c => c !== f.fund_code)
                                : [...p.fundCodesToInclude, f.fund_code],
                            }))}
                            className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all"
                            style={{
                              backgroundColor: isIncluded ? DUO.green : 'white',
                              border: `2px solid ${isIncluded ? DUO.green : '#d1d5db'}`,
                              boxShadow: isIncluded ? `0 2px 0 0 ${DUO.greenDark}` : 'none',
                            }}
                          >
                            {isIncluded && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                          </button>
                        ) : isUploading ? (
                          <Spinner size="sm" />
                        ) : (
                          <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 bg-gray-100 border-2 border-gray-200">
                            <Upload className="h-3 w-3 text-gray-400" />
                          </div>
                        )}

                        {/* Fund code */}
                        <span className="font-mono text-xs font-bold" style={{ color: isOk ? DUO.teal : '#9ca3af' }}>
                          {f.fund_code}
                        </span>

                        {/* Fund name */}
                        {f.fund_name && (
                          <span className="text-xs text-text-muted truncate">{f.fund_name}</span>
                        )}

                        {/* Status badges + actions */}
                        {f.status === 'ok' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">À jour</span>
                        )}

                        {f.status === 'outdated' && !isUploading && (
                          <>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">Périmé</span>
                            {isDragHover ? (
                              <span className="text-[10px] font-bold animate-pulse" style={{ color: DUO.teal }}>
                                Déposez le PDF ici
                              </span>
                            ) : (
                              <label className="text-[10px] font-semibold px-2 py-0.5 rounded-lg cursor-pointer transition-all hover:brightness-105 text-white"
                                style={{ backgroundColor: DUO.teal, boxShadow: `0 2px 0 0 ${DUO.tealDark}` }}
                              >
                                <input
                                  type="file"
                                  accept=".pdf"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFundUpload(f.fund_code, file);
                                    e.target.value = '';
                                  }}
                                />
                                Glisser ou cliquer
                              </label>
                            )}
                          </>
                        )}

                        {f.status === 'missing' && !isUploading && (
                          <>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold">Non uploadé</span>
                            {isDragHover ? (
                              <span className="text-[10px] font-bold animate-pulse" style={{ color: DUO.teal }}>
                                Déposez le PDF ici
                              </span>
                            ) : (
                              <label className="text-[10px] font-semibold px-2 py-0.5 rounded-lg cursor-pointer transition-all hover:brightness-105 text-white"
                                style={{ backgroundColor: DUO.teal, boxShadow: `0 2px 0 0 ${DUO.tealDark}` }}
                              >
                                <input
                                  type="file"
                                  accept=".pdf"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFundUpload(f.fund_code, file);
                                    e.target.value = '';
                                  }}
                                />
                                Glisser ou cliquer
                              </label>
                            )}
                          </>
                        )}

                        {isUploading && (
                          <span className="text-[10px] font-semibold" style={{ color: DUO.teal }}>
                            Upload en cours...
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Helper text for drag & drop */}
                {fundCheckResults.some(f => f.status === 'missing' || f.status === 'outdated') && (
                  <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: `${DUO.teal}08`, border: `1px dashed ${DUO.teal}30` }}>
                    <Upload className="h-3.5 w-3.5 flex-shrink-0" style={{ color: DUO.teal }} />
                    <p className="text-[11px]" style={{ color: DUO.tealDark }}>
                      Glissez un PDF directement sur un fonds pour l&apos;uploader instantanément
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Excluded rows indicator */}
            {excludedRows.size > 0 && (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 mb-4">
                <span className="text-xs text-amber-700 font-medium">
                  {excludedRows.size} position{excludedRows.size > 1 ? 's' : ''} exclue{excludedRows.size > 1 ? 's' : ''} du rapport
                </span>
                <button
                  onClick={() => setExcludedRows(new Set())}
                  className="text-xs font-bold text-amber-700 hover:text-amber-900 underline"
                >
                  Tout réinclure
                </button>
              </div>
            )}

            {/* Footer: page estimate + buttons */}
            <div className="flex items-center justify-between">
              <div className="text-xs text-text-muted">
                {(() => {
                  const incl = holdings.filter(h => !excludedRows.has(h._key));
                  const eqCount = incl.filter(h => !['CASH', 'FIXED_INCOME', 'OTHER'].includes(h.assetType)).length;
                  const fiCount = incl.filter(h => h.assetType === 'FIXED_INCOME').length;
                  const coCount = incl.filter(h => ['CASH', 'FUND', 'OTHER'].includes(h.assetType)).length;
                  let pages = 0;
                  if (pdfOptions.includeCover) pages += 1;
                  if (pdfOptions.includeEquities && eqCount > 0) pages += Math.ceil(eqCount / 25);
                  if (pdfOptions.includeFixedIncome && fiCount > 0) pages += 1;
                  if (pdfOptions.includeCashOther && coCount > 0) pages += 1;
                  pages += pdfOptions.fundCodesToInclude.length * 2;
                  return (
                    <span className="font-semibold">
                      ~{pages} page{pages > 1 ? 's' : ''} estimée{pages > 1 ? 's' : ''}
                    </span>
                  );
                })()}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowPdfBuilder(false)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 bg-white transition-all hover:bg-gray-50 active:translate-y-[1px]"
                  style={{ border: '2px solid #e5e7eb', borderBottom: '3px solid #d1d5db' }}
                >
                  Retour
                </button>
                <button
                  onClick={handleDownloadPdf}
                  disabled={generatingPdf || (!pdfOptions.includeCover && !pdfOptions.includeEquities && !pdfOptions.includeFixedIncome && !pdfOptions.includeCashOther && pdfOptions.fundCodesToInclude.length === 0)}
                  className="flex items-center gap-2.5 px-7 py-3 rounded-2xl text-white font-extrabold text-sm
                    transition-all duration-150 active:translate-y-[2px] active:shadow-none hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: DUO.green, boxShadow: `0 4px 0 0 ${DUO.greenDark}` }}
                >
                  {generatingPdf ? <Spinner size="sm" /> : <Download className="h-4 w-4" />}
                  {generatingPdf ? 'Génération...' : 'Générer le PDF'}
                </button>
              </div>
            </div>
          </div>

          {/* CSV + Copy buttons remain accessible */}
          <div className="flex justify-center gap-3">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm
                transition-all duration-150 active:translate-y-[2px] active:shadow-none hover:brightness-105"
              style={{ backgroundColor: 'white', color: DUO.purple, border: `2px solid ${DUO.purple}40`, borderBottom: `4px solid ${DUO.purpleDark}30` }}
            >
              <Download className="h-4 w-4" />
              Exporter CSV
            </button>
            {targetSummary && (
              <button
                onClick={handleCopySummary}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm
                  transition-all duration-150 active:translate-y-[2px] active:shadow-none hover:brightness-105"
                style={{ backgroundColor: 'white', color: '#6b7280', border: '2px solid #e5e7eb', borderBottom: '4px solid #d1d5db' }}
              >
                {copiedSummary ? <Check className="h-4 w-4" style={{ color: DUO.green }} /> : <Copy className="h-4 w-4" />}
                {copiedSummary ? 'Copié' : 'Copier le résumé'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
          <button
            onClick={() => setShowPdfBuilder(true)}
            className="flex items-center gap-2.5 px-7 py-3 rounded-2xl text-white font-extrabold text-sm
              transition-all duration-150 active:translate-y-[2px] active:shadow-none hover:brightness-105"
            style={{ backgroundColor: DUO.green, boxShadow: `0 4px 0 0 ${DUO.greenDark}` }}
          >
            <FileText className="h-4 w-4" />
            Préparer le rapport PDF
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm
              transition-all duration-150 active:translate-y-[2px] active:shadow-none hover:brightness-105"
            style={{ backgroundColor: 'white', color: DUO.purple, border: `2px solid ${DUO.purple}40`, borderBottom: `4px solid ${DUO.purpleDark}30` }}
          >
            <Download className="h-4 w-4" />
            Exporter CSV
          </button>
          {targetSummary && (
            <button
              onClick={handleCopySummary}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm
                transition-all duration-150 active:translate-y-[2px] active:shadow-none hover:brightness-105"
              style={{ backgroundColor: 'white', color: '#6b7280', border: '2px solid #e5e7eb', borderBottom: '4px solid #d1d5db' }}
            >
              {copiedSummary ? <Check className="h-4 w-4" style={{ color: DUO.green }} /> : <Copy className="h-4 w-4" />}
              {copiedSummary ? 'Copié' : 'Copier le résumé'}
            </button>
          )}
        </div>
      )}

      {/* Info */}
      <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-blue-50/50 border border-blue-100">
        <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-700">
          Les cours cibles proviennent du consensus des analystes (Yahoo Finance). Pour les titres sans couverture analyste,
          une estimation basée sur le rendement historique 12 mois est utilisée (identifiée &quot;Est. hist.&quot;).
          Vous pouvez modifier manuellement n&apos;importe quel cours cible en cliquant sur &quot;Saisir&quot; ou l&apos;icône de crayon.
        </p>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function PretAColler() {
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);

  const handlePaste = useCallback((text: string) => {
    const result = parseCroesusData(text);
    setParseResult(result);
  }, []);

  const handleReset = useCallback(() => {
    setParseResult(null);
  }, []);

  if (parseResult && parseResult.holdings.length > 0) {
    return <ResultsView result={parseResult} onReset={handleReset} />;
  }

  return (
    <div>
      <PasteZone onPaste={handlePaste} />
      {parseResult && parseResult.holdings.length === 0 && parseResult.warnings.length > 0 && (
        <div className="mt-4 flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-800">
            {parseResult.warnings.map((w, i) => <p key={i}>{w}</p>)}
          </div>
        </div>
      )}
    </div>
  );
}
