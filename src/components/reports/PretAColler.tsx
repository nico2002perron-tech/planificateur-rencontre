'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import useSWR from 'swr';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { parseCroesusData, ASSET_TYPE_CONFIG, ACCOUNT_TYPE_MAP, type ParseResult, type ParsedHolding, type AssetType } from '@/lib/parsers/croesus-parser';
import { usePriceTargetConsensus } from '@/lib/hooks/usePriceTargets';
import {
  ClipboardPaste, Sparkles, RotateCcw, TrendingUp,
  DollarSign, BarChart3, Shield, Landmark, Wallet, Package, AlertTriangle,
  Check, Pencil, X, Download, ChevronDown, ChevronUp, Eye, Info, FileText,
  BookOpen, CheckCircle2, Clock, AlertCircle, Upload, Globe,
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

  return (
    <div className="space-y-6">
      <div
        className={`
          relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer
          ${isDragOver
            ? 'border-brand-primary bg-brand-primary/5 scale-[1.01]'
            : 'border-gray-300 hover:border-brand-primary/50 hover:bg-gray-50/50'}
        `}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => textareaRef.current?.focus()}
      >
        <div className="px-6 pt-8 pb-4 text-center">
          <div className={`
            inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 transition-all duration-300
            ${isDragOver ? 'bg-brand-primary text-white scale-110' : 'bg-brand-primary/10 text-brand-primary'}
          `}>
            <ClipboardPaste className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-text-main mb-1">
            Collez vos positions Croesus ici
          </h3>
          <p className="text-sm text-text-muted max-w-lg mx-auto">
            Sélectionnez vos positions dans Croesus, copiez-les (Ctrl+C), puis collez-les ci-dessous (Ctrl+V).
            Actions, revenus fixes, FNB, fonds — tout sera détecté automatiquement.
          </p>
        </div>

        <div className="px-6 pb-6">
          <textarea
            ref={textareaRef}
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onPaste={handlePaste}
            placeholder={"Ctrl+V pour coller les données de Croesus...\n\nFormat détecté automatiquement:\nQté | Description | Compte | Symbole | PRU | Prix marché | Val. compt. | Val. marché | Dur. Mod. | Int. courus | Revenu"}
            className="w-full h-40 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-mono
              text-text-main placeholder-text-muted/50 resize-none
              focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary
              transition-all duration-200"
          />
        </div>
      </div>

      {textValue.trim() && (
        <div className="flex justify-center">
          <Button
            onClick={() => onPaste(textValue)}
            icon={<Sparkles className="h-4 w-4" />}
            size="lg"
          >
            Analyser les positions
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { icon: '1', title: 'Sélectionnez', desc: 'Dans Croesus, sélectionnez toutes les lignes de positions du client' },
          { icon: '2', title: 'Copiez', desc: 'Ctrl+C pour copier les données dans le presse-papiers' },
          { icon: '3', title: 'Collez', desc: 'Ctrl+V ici — le système détecte automatiquement le format' },
        ].map((tip) => (
          <div key={tip.icon} className="flex gap-3 items-start p-3 rounded-xl bg-gray-50/80">
            <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-brand-primary text-white text-sm font-bold flex items-center justify-center">
              {tip.icon}
            </span>
            <div>
              <p className="text-sm font-semibold text-text-main">{tip.title}</p>
              <p className="text-xs text-text-muted">{tip.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Category summary card ───────────────────────────────────────────────────

function CategoryCard({ type, count, value, active, onClick }: {
  type: AssetType;
  count: number;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  const config = ASSET_TYPE_CONFIG[type];
  const Icon = ASSET_ICONS[type];

  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all duration-200 text-left w-full
        ${active
          ? 'border-brand-primary bg-brand-primary/5 shadow-sm'
          : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}
      `}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${config.bg}`}>
        <Icon className={`h-4.5 w-4.5 ${config.color}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-text-muted">{config.label}{count > 1 ? 's' : ''}</p>
        <p className="text-sm font-bold text-text-main">{count} position{count > 1 ? 's' : ''}</p>
      </div>
      <p className="text-xs font-semibold text-text-muted whitespace-nowrap">{formatCurrency(value)}</p>
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
  const [showTargets, setShowTargets] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
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

  // Fund document status check — runs once AFTER AI check completes
  const fundCheckRan = useRef(false);
  useEffect(() => {
    if (!aiChecked || fundCheckRan.current) return;
    fundCheckRan.current = true;

    // Build a set of symbols that the AI reclassified away from FUND
    const correctedAwayFromFund = new Set(
      aiCorrections
        .filter(c => c.assetType !== 'FUND')
        .map(c => c.symbol)
    );

    // Only check holdings that are FUND and NOT reclassified by AI
    const fundHoldings = result.holdings.filter(
      h => h.assetType === 'FUND' && !correctedAwayFromFund.has(h.symbol)
    );
    if (fundHoldings.length === 0) {
      setFundCheckDone(true);
      return;
    }

    const checkFunds = async () => {
      try {
        const fundCodes = fundHoldings.map(h => h.symbol);
        const res = await fetch('/api/fund-reports/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fund_codes: fundCodes }),
        });
        if (res.ok) {
          const { results } = await res.json();
          setFundCheckResults(results || []);
        }
      } catch {
        // Silently fail
      } finally {
        setFundCheckDone(true);
      }
    };

    checkFunds();
  }, [aiChecked, aiCorrections, result.holdings]);

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

  // Filtered holdings
  const filteredHoldings = useMemo(() => {
    if (activeFilter === 'ALL') return holdings;
    return holdings.filter(h => h.assetType === activeFilter);
  }, [holdings, activeFilter]);

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
      const currentPrice = isCDR
        ? (cdrHolding?.marketPrice || holding.marketPrice)
        : (yahoo?.price || holding.marketPrice);
      const hasCustom = sym in customTargets;

      // Debug CDR holdings
      if (isCDR) {
        console.log(`[CDR client] ${sym}: isCDR=${holding.isCDR}, inCdrMap=${sym in cdrMap}, underlying=${cdrMap[sym]}, currency=${holding.currency}`);
        console.log(`[CDR client] ${sym}: target=`, target, `currentPrice=${currentPrice}, cdrGainPct=${target?.cdrGainPct}`);
      }

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

      if (isCDR) {
        console.log(`[CDR client] ${sym}: RESULT → targetPrice=${targetPrice}, source=${source}`);
      }

      const gainPct = targetPrice > 0 && currentPrice > 0 ? ((targetPrice - currentPrice) / currentPrice) * 100 : 0;

      map.set(sym, { currentPrice, targetPrice, gainPct, source });
    });

    return map;
  }, [showTargets, holdings, prices, targets, customTargets, priceableSymbols, cdrMap]);

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
      // Build PDF data payload
      const pdfHoldings = holdings.map(h => {
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

      // Collect fund codes for automatic PDF merging
      const fundCodes = holdings
        .filter(h => h.assetType === 'FUND')
        .map(h => h.symbol);

      const payload = {
        holdings: pdfHoldings,
        generatedAt: new Date().toISOString(),
        fundCodes,
        summary: {
          totalMarketValue: result.summary.totalMarketValue,
          totalBookValue: holdings.reduce((s, h) => s + h.bookValue, 0),
          totalAnnualIncome: result.summary.totalAnnualIncome,
          totalCurrentValue,
          totalTargetValue,
          totalGain: totalTargetValue - totalCurrentValue,
          totalGainPct: totalCurrentValue > 0 ? ((totalTargetValue - totalCurrentValue) / totalCurrentValue) * 100 : 0,
          equityCount: result.summary.equities + result.summary.etfs + (result.summary.preferred || 0),
          fixedIncomeCount: result.summary.fixedIncome,
          cashCount: result.summary.cash,
          otherCount: result.summary.funds + result.summary.other,
          pricesFound: prices.size,
          targetsFound: Array.from(targetData.values()).filter(t => t.targetPrice > 0).length,
          equityGain: totalTargetValue - totalCurrentValue,
          equityGainPct: totalCurrentValue > 0 ? ((totalTargetValue - totalCurrentValue) / totalCurrentValue) * 100 : 0,
          fixedIncomeAnnualIncome: holdings.filter(h => h.assetType === 'FIXED_INCOME').reduce((s, h) => s + h.annualIncome, 0),
          fixedIncomeMarketValue: holdings.filter(h => h.assetType === 'FIXED_INCOME').reduce((s, h) => s + h.marketValue, 0),
          fixedIncomeGainPct: (() => { const mv = holdings.filter(h => h.assetType === 'FIXED_INCOME').reduce((s, h) => s + h.marketValue, 0); const ai = holdings.filter(h => h.assetType === 'FIXED_INCOME').reduce((s, h) => s + h.annualIncome, 0); return mv > 0 ? (ai / mv) * 100 : 0; })(),
          totalEstimated: (totalTargetValue - totalCurrentValue) + holdings.filter(h => h.assetType === 'FIXED_INCOME').reduce((s, h) => s + h.annualIncome, 0),
          totalEstimatedPct: (() => { const fiMv = holdings.filter(h => h.assetType === 'FIXED_INCOME').reduce((s, h) => s + h.marketValue, 0); const fiAi = holdings.filter(h => h.assetType === 'FIXED_INCOME').reduce((s, h) => s + h.annualIncome, 0); const eqGain = totalTargetValue - totalCurrentValue; const totalPv = totalCurrentValue + fiMv; return totalPv > 0 ? ((eqGain + fiAi) / totalPv) * 100 : 0; })(),
        },
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
  }, [holdings, targetData, prices, result.summary, toast]);

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

      {aiChecked && aiCorrections.length > 0 && (
        <div className="px-4 py-3 rounded-xl bg-indigo-50 border border-indigo-200 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-600 flex-shrink-0" />
            <span className="text-sm font-bold text-indigo-900">
              IA — {aiCorrections.length} correction{aiCorrections.length > 1 ? 's' : ''} suggérée{aiCorrections.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-1.5">
            {aiCorrections.map((c) => {
              const newConfig = ASSET_TYPE_CONFIG[c.assetType as AssetType];
              const applied = typeOverrides[c.symbol] === c.assetType;
              return (
                <div key={c.symbol} className="flex items-center gap-2 text-xs">
                  <span className="font-mono font-semibold text-brand-primary">{c.symbol}</span>
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
          {aiCorrections.length > 0 && !aiCorrections.every(c => typeOverrides[c.symbol] === c.assetType) && (
            <button
              onClick={() => {
                const overrides: Record<string, AssetType> = { ...typeOverrides };
                aiCorrections.forEach(c => { overrides[c.symbol] = c.assetType as AssetType; });
                setTypeOverrides(overrides);
              }}
              className="mt-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
            >
              Appliquer toutes les corrections
            </button>
          )}
        </div>
      )}

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

      {/* Top bar: summary + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Check className="h-5 w-5 text-emerald-700" />
          </div>
          <div>
            <p className="text-sm font-bold text-text-main">
              {result.holdings.length} position{result.holdings.length > 1 ? 's' : ''} détectée{result.holdings.length > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-text-muted">
              Valeur marchande: {formatCurrency(result.summary.totalMarketValue)}
              {result.summary.totalAnnualIncome > 0 && (
                <> — Revenu annuel: <span className="font-semibold text-emerald-600">{formatCurrency(result.summary.totalAnnualIncome)}</span></>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onReset} icon={<RotateCcw className="h-3.5 w-3.5" />}>
            Recommencer
          </Button>
        </div>
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
          className={`
            flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all duration-200
            ${activeFilter === 'ALL'
              ? 'border-brand-primary bg-brand-primary/5'
              : 'border-gray-100 hover:border-gray-200'}
          `}
        >
          <Eye className="h-4 w-4 text-brand-primary" />
          <span className="text-sm font-semibold">Tout ({holdings.length})</span>
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

      {/* Holdings table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-text-muted bg-gray-50/50">
                <th className="text-left py-3 px-3 font-semibold text-xs">Type</th>
                <th className="text-center py-3 px-2 font-semibold text-xs">Compte</th>
                <th className="text-left py-3 px-3 font-semibold text-xs">Symbole</th>
                <th className="text-left py-3 px-3 font-semibold text-xs">Description</th>
                <th className="text-right py-3 px-3 font-semibold text-xs">Qté</th>
                <th className="text-right py-3 px-3 font-semibold text-xs">PRU</th>
                <th className="text-right py-3 px-3 font-semibold text-xs">Prix marché</th>
                <th className="text-right py-3 px-3 font-semibold text-xs">Val. marché</th>
                <th className="text-right py-3 px-3 font-semibold text-xs">Revenu</th>
                {showTargets && (
                  <>
                    <th className="text-right py-3 px-3 font-semibold text-xs">Cours cible</th>
                    <th className="text-right py-3 px-3 font-semibold text-xs">Gain est.</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredHoldings.map((h) => {
                const config = ASSET_TYPE_CONFIG[h.assetType];
                const Icon = ASSET_ICONS[h.assetType];
                const rowKey = h._key;
                const isExpanded = expandedRow === rowKey;
                const td = targetData.get(h.symbol);
                const acctColor = ACCOUNT_COLORS[h.accountType] || 'bg-gray-100 text-gray-700';

                return (
                  <tr
                    key={rowKey}
                    className={`border-b border-gray-50 transition-colors ${isExpanded ? 'bg-gray-50/80' : 'hover:bg-gray-50/50'}`}
                  >
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
                    <td className="py-2.5 px-3">
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
                          <span className="font-mono font-semibold text-brand-primary text-xs">{h.symbol}</span>
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
                    <td className="py-2.5 px-3 text-right font-medium tabular-nums text-xs">
                      {h.quantity !== 0 ? h.quantity.toLocaleString('fr-CA') : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-xs text-text-muted">
                      {h.averageCost > 0 ? formatCurrencyFull(h.averageCost) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-xs">
                      {showTargets && td ? (
                        <span className="font-semibold">{formatCurrencyFull(td.currentPrice)}</span>
                      ) : (
                        h.marketPrice > 0 ? formatCurrencyFull(h.marketPrice) : '—'
                      )}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-semibold tabular-nums text-xs ${h.marketValue < 0 ? 'text-red-500' : ''}`}>
                      {h.marketValue !== 0 ? formatCurrency(h.marketValue) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-xs text-emerald-600">
                      {h.annualIncome > 0 ? formatCurrency(h.annualIncome) : '—'}
                    </td>
                    {showTargets && (
                      <>
                        <td className="py-2.5 px-3 text-right">
                          {td ? (
                            editingTarget === h.symbol ? (
                              <input
                                type="number"
                                step="0.01"
                                autoFocus
                                defaultValue={td.targetPrice || ''}
                                className="w-20 px-1.5 py-0.5 text-right text-sm border border-brand-primary rounded focus:outline-none focus:ring-1 focus:ring-brand-primary"
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
                            ) : td.targetPrice > 0 ? (
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
                                  onClick={() => setEditingTarget(h.symbol)}
                                  className="p-0.5 rounded hover:bg-gray-100 text-text-muted hover:text-brand-primary"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                {h.symbol in customTargets && (
                                  <button
                                    onClick={() => setCustomTargets(prev => { const next = { ...prev }; delete next[h.symbol]; return next; })}
                                    className="p-0.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <button
                                onClick={() => setEditingTarget(h.symbol)}
                                className="px-2 py-0.5 text-xs border border-amber-300 bg-amber-50 text-amber-700 rounded hover:bg-amber-100"
                              >
                                Saisir
                              </button>
                            )
                          ) : (
                            <span className="text-text-muted text-xs">—</span>
                          )}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-semibold tabular-nums text-xs ${
                          td && td.gainPct > 0 ? 'text-emerald-600' : td && td.gainPct < 0 ? 'text-red-500' : 'text-text-muted'
                        }`}>
                          {td && td.targetPrice > 0 ? formatPercent(td.gainPct) : '—'}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
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
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {!showTargets ? (
          <Button
            onClick={() => setShowTargets(true)}
            icon={<TrendingUp className="h-4 w-4" />}
            size="lg"
          >
            Charger les cours cibles
          </Button>
        ) : isLoadingPrices ? (
          <div className="flex items-center gap-2 px-6 py-3 rounded-full bg-blue-50 text-blue-700 text-sm font-semibold">
            <Spinner size="sm" />
            Chargement des prix et cours cibles...
          </div>
        ) : fundCheckResults.some(f => f.status === 'missing' || f.status === 'outdated') ? (
          <div className="flex flex-col items-center gap-2">
            <Button
              disabled
              icon={<FileText className="h-4 w-4" />}
              size="lg"
              className="opacity-50 cursor-not-allowed"
            >
              Télécharger le PDF
            </Button>
            <p className="text-xs text-red-600 font-medium flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              {fundCheckResults.filter(f => f.status === 'missing').length > 0
                ? `${fundCheckResults.filter(f => f.status === 'missing').length} rapport(s) de fonds manquant(s)`
                : `${fundCheckResults.filter(f => f.status === 'outdated').length} rapport(s) de fonds périmé(s)`
              }
              {' — '}
              <a href="/fund-reports" target="_blank" className="underline hover:text-red-800">
                Mettre à jour
              </a>
            </p>
          </div>
        ) : (
          <Button
            onClick={handleDownloadPdf}
            loading={generatingPdf}
            icon={<FileText className="h-4 w-4" />}
            size="lg"
          >
            Télécharger le PDF
          </Button>
        )}
      </div>

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
