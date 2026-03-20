'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import useSWR from 'swr';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { parseCroesusData, ASSET_TYPE_CONFIG, type ParseResult, type ParsedHolding, type AssetType } from '@/lib/parsers/croesus-parser';
import { usePriceTargetConsensus } from '@/lib/hooks/usePriceTargets';
import {
  ClipboardPaste, Sparkles, RotateCcw, TrendingUp,
  DollarSign, BarChart3, Shield, Landmark, Wallet, Package, AlertTriangle,
  Check, Pencil, X, Download, ChevronDown, ChevronUp, Eye, Info, Clock,
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
      {/* Hero zone */}
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
            placeholder="Ctrl+V pour coller les données de Croesus...&#10;&#10;Exemple (Qté, Description, Symbole, Prix marché, Val. compt., Val. marché, Durée Mod., Int. courus):&#10;150    Banque Royale du Canada    RY    165,20    22 500,00    24 780,00        125,50&#10;50 000    Canada 3,5% 2028-06-01    CAN 3.5 28    101,25    50 000,00    50 625,00    2,85    875,00&#10;500    iShares Core Cdn Bond    XBB    27,85    14 200,00    13 925,00        45,20"
            className="w-full h-40 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-mono
              text-text-main placeholder-text-muted/50 resize-none
              focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary
              transition-all duration-200"
          />
        </div>
      </div>

      {/* Manual paste button */}
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

      {/* Tips */}
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
      {value > 0 && (
        <p className="text-xs font-semibold text-text-muted whitespace-nowrap">{formatCurrency(value)}</p>
      )}
    </button>
  );
}

// ─── Results view ────────────────────────────────────────────────────────────

function ResultsView({ result, onReset }: { result: ParseResult; onReset: () => void }) {
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState<AssetType | 'ALL'>('ALL');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);
  const [symbolOverrides, setSymbolOverrides] = useState<Record<string, string>>({});
  const [customTargets, setCustomTargets] = useState<Record<string, number>>({});
  const [editingTarget, setEditingTarget] = useState<string | null>(null);
  const [showTargets, setShowTargets] = useState(false);

  // Apply symbol overrides
  const holdings = useMemo(() => {
    return result.holdings.map(h => ({
      ...h,
      symbol: symbolOverrides[h.symbol] || h.symbol,
      _originalSymbol: h.symbol,
    }));
  }, [result.holdings, symbolOverrides]);

  // Filtered holdings
  const filteredHoldings = useMemo(() => {
    if (activeFilter === 'ALL') return holdings;
    return holdings.filter(h => h.assetType === activeFilter);
  }, [holdings, activeFilter]);

  // Get priceable symbols (equities + ETFs + preferred)
  const priceableSymbols = useMemo(() => {
    return holdings
      .filter(h => ['EQUITY', 'ETF', 'PREFERRED'].includes(h.assetType))
      .map(h => h.symbol);
  }, [holdings]);

  // Fetch prices & targets
  const { prices, isLoading: pricesLoading } = useYahooPrices(showTargets ? priceableSymbols : []);
  const { targets, isLoading: targetsLoading } = usePriceTargetConsensus(showTargets ? priceableSymbols : []);

  const isLoadingPrices = pricesLoading || targetsLoading;

  // Compute target data
  const targetData = useMemo(() => {
    if (!showTargets) return new Map<string, { currentPrice: number; targetPrice: number; gainPct: number; source: string }>();
    const map = new Map<string, { currentPrice: number; targetPrice: number; gainPct: number; source: string }>();

    holdings.forEach(h => {
      if (!['EQUITY', 'ETF', 'PREFERRED'].includes(h.assetType)) return;

      const yahoo = prices.get(h.symbol);
      const target = targets[h.symbol];
      const currentPrice = yahoo?.price || h.marketPrice;
      const hasCustom = h.symbol in customTargets;
      const apiTarget = target?.targetConsensus || 0;
      const targetPrice = hasCustom ? customTargets[h.symbol] : (apiTarget > 0 ? apiTarget : 0);
      const gainPct = targetPrice > 0 && currentPrice > 0 ? ((targetPrice - currentPrice) / currentPrice) * 100 : 0;
      const source = hasCustom ? 'Manuel' : (apiTarget > 0 ? 'Analyste' : 'N/D');

      map.set(h.symbol, { currentPrice, targetPrice, gainPct, source });
    });

    return map;
  }, [showTargets, holdings, prices, targets, customTargets]);

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
    let withTargets = 0;

    holdings.forEach(h => {
      const data = targetData.get(h.symbol);
      if (data) {
        totalCurrent += h.quantity * data.currentPrice;
        if (data.targetPrice > 0) {
          totalTarget += h.quantity * data.targetPrice;
          withTargets++;
        } else {
          totalTarget += h.quantity * data.currentPrice;
        }
      } else {
        totalCurrent += h.marketValue;
        totalTarget += h.marketValue;
      }
    });

    const gain = totalTarget - totalCurrent;
    const gainPct = totalCurrent > 0 ? (gain / totalCurrent) * 100 : 0;

    return { totalCurrent, totalTarget, gain, gainPct, withTargets, total: priceableSymbols.length };
  }, [showTargets, targetData, holdings, priceableSymbols.length]);

  const handleExportTargets = useCallback(() => {
    if (targetData.size === 0) return;

    const lines = ['Symbole\tNom\tPrix actuel\tCours cible\tGain estimé %\tSource'];
    holdings.forEach(h => {
      const data = targetData.get(h.symbol);
      if (data) {
        lines.push(`${h.symbol}\t${h.name}\t${data.currentPrice.toFixed(2)}\t${data.targetPrice > 0 ? data.targetPrice.toFixed(2) : 'N/D'}\t${data.targetPrice > 0 ? data.gainPct.toFixed(1) + '%' : 'N/D'}\t${data.source}`);
      }
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cours-cibles-${new Date().toISOString().split('T')[0]}.tsv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('success', 'Cours cibles exportés');
  }, [targetData, holdings, toast]);

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
              {result.summary.currencies.length > 0 && ` — ${result.summary.currencies.join(', ')}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onReset} icon={<RotateCcw className="h-3.5 w-3.5" />}>
            Recommencer
          </Button>
        </div>
      </div>

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

      {/* Holdings table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-text-muted bg-gray-50/50">
                <th className="text-left py-3 px-4 font-semibold text-xs">Type</th>
                <th className="text-left py-3 px-4 font-semibold text-xs">Symbole</th>
                <th className="text-left py-3 px-4 font-semibold text-xs">Description</th>
                <th className="text-right py-3 px-4 font-semibold text-xs">Qté</th>
                <th className="text-right py-3 px-4 font-semibold text-xs">Prix marché</th>
                <th className="text-right py-3 px-4 font-semibold text-xs">Valeur</th>
                {showTargets && (
                  <>
                    <th className="text-right py-3 px-4 font-semibold text-xs">Cours cible</th>
                    <th className="text-right py-3 px-4 font-semibold text-xs">Gain est.</th>
                  </>
                )}
                <th className="text-center py-3 px-4 font-semibold text-xs">Dev.</th>
              </tr>
            </thead>
            <tbody>
              {filteredHoldings.map((h) => {
                const config = ASSET_TYPE_CONFIG[h.assetType];
                const Icon = ASSET_ICONS[h.assetType];
                const isExpanded = expandedRow === h.symbol;
                const td = targetData.get(h.symbol);
                const originalSymbol = (h as ParsedHolding & { _originalSymbol: string })._originalSymbol;

                return (
                  <tr
                    key={h.symbol + h.name}
                    className={`border-b border-gray-50 transition-colors ${isExpanded ? 'bg-gray-50/80' : 'hover:bg-gray-50/50'}`}
                  >
                    <td className="py-2.5 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${config.bg} ${config.color}`}>
                        <Icon className="h-3 w-3" />
                        {config.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      {editingSymbol === originalSymbol ? (
                        <input
                          type="text"
                          autoFocus
                          defaultValue={h.symbol}
                          className="w-24 px-1.5 py-0.5 text-sm font-mono border border-brand-primary rounded focus:outline-none focus:ring-1 focus:ring-brand-primary"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const val = (e.target as HTMLInputElement).value.trim().toUpperCase();
                              if (val) setSymbolOverrides(prev => ({ ...prev, [originalSymbol]: val }));
                              setEditingSymbol(null);
                            } else if (e.key === 'Escape') {
                              setEditingSymbol(null);
                            }
                          }}
                          onBlur={(e) => {
                            const val = e.target.value.trim().toUpperCase();
                            if (val) setSymbolOverrides(prev => ({ ...prev, [originalSymbol]: val }));
                            setEditingSymbol(null);
                          }}
                        />
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="font-mono font-semibold text-brand-primary">{h.symbol}</span>
                          <button
                            onClick={() => setEditingSymbol(originalSymbol)}
                            className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-100 text-text-muted hover:text-brand-primary transition-opacity"
                            title="Modifier le symbole"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      <button
                        onClick={() => setExpandedRow(isExpanded ? null : h.symbol)}
                        className="flex items-center gap-1 text-left text-text-main hover:text-brand-primary transition-colors"
                      >
                        <span className="truncate max-w-[200px]">{h.name}</span>
                        {(h.couponRate || h.maturityDate || h.modifiedDuration || h.accruedInterest) && (
                          isExpanded
                            ? <ChevronUp className="h-3 w-3 text-text-muted flex-shrink-0" />
                            : <ChevronDown className="h-3 w-3 text-text-muted flex-shrink-0" />
                        )}
                      </button>
                      {isExpanded && (h.couponRate || h.maturityDate || h.modifiedDuration || h.accruedInterest || h.sector) && (
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          {h.couponRate !== undefined && h.couponRate > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                              Coupon: {h.couponRate.toFixed(2)}%
                            </span>
                          )}
                          {h.maturityDate && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                              Éch: {h.maturityDate}
                            </span>
                          )}
                          {h.modifiedDuration !== undefined && h.modifiedDuration > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
                              Durée mod: {h.modifiedDuration.toFixed(2)}
                            </span>
                          )}
                          {h.yieldToMaturity !== undefined && h.yieldToMaturity > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                              Rend: {h.yieldToMaturity.toFixed(2)}%
                            </span>
                          )}
                          {h.accruedInterest !== undefined && h.accruedInterest !== 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700">
                              Int. courus: {formatCurrencyFull(h.accruedInterest)}
                            </span>
                          )}
                          {h.sector && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-text-muted">
                              {h.sector}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right font-medium tabular-nums">
                      {h.quantity > 0 ? h.quantity.toLocaleString('fr-CA') : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums">
                      {showTargets && td ? (
                        <span className="font-semibold">{formatCurrencyFull(td.currentPrice)}</span>
                      ) : (
                        h.marketPrice > 0 ? formatCurrencyFull(h.marketPrice) : '—'
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right font-semibold tabular-nums">
                      {h.marketValue > 0 ? formatCurrency(h.marketValue) : '—'}
                    </td>
                    {showTargets && (
                      <>
                        <td className="py-2.5 px-4 text-right">
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
                                <span className="font-semibold">{formatCurrencyFull(td.targetPrice)}</span>
                                <span className={`text-[10px] px-1 py-0.5 rounded ${
                                  td.source === 'Manuel' ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700'
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
                        <td className={`py-2.5 px-4 text-right font-semibold tabular-nums ${
                          td && td.gainPct > 0 ? 'text-emerald-600' : td && td.gainPct < 0 ? 'text-red-500' : 'text-text-muted'
                        }`}>
                          {td && td.targetPrice > 0 ? formatPercent(td.gainPct) : '—'}
                        </td>
                      </>
                    )}
                    <td className="py-2.5 px-4 text-center">
                      <span className="text-xs text-text-muted">{h.currency}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Target price summary */}
      {showTargets && targetSummary && !isLoadingPrices && (
        <div className="p-4 bg-gradient-to-r from-brand-primary/5 to-emerald-50 rounded-xl border border-brand-primary/10">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xs text-text-muted">Prix temps réel</p>
              <p className="text-sm font-bold text-text-main">{prices.size}/{priceableSymbols.length}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Valeur actuelle</p>
              <p className="text-lg font-bold text-text-main">{formatCurrency(targetSummary.totalCurrent)}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Valeur cible 12 mois</p>
              <p className="text-lg font-bold text-brand-primary">{formatCurrency(targetSummary.totalTarget)}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Gain estimé</p>
              <p className={`text-lg font-bold ${targetSummary.gain >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {formatCurrency(targetSummary.gain)} ({formatPercent(targetSummary.gainPct)})
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
        ) : (
          <Button
            onClick={handleExportTargets}
            variant="outline"
            icon={<Download className="h-4 w-4" />}
          >
            Exporter les cours cibles (TSV)
          </Button>
        )}
      </div>

      {/* Info */}
      <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-blue-50/50 border border-blue-100">
        <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-700">
          Les cours cibles proviennent du consensus des analystes (Yahoo Finance). Vous pouvez modifier
          manuellement n&apos;importe quel cours cible en cliquant sur le bouton &quot;Saisir&quot; ou l&apos;icône de crayon.
          Cliquez sur un symbole pour le corriger si nécessaire (ex: ajouter .TO pour la Bourse de Toronto).
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
