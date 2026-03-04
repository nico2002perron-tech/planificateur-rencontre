'use client';

import { Suspense, useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useClients } from '@/lib/hooks/useClients';
import { usePortfolios } from '@/lib/hooks/usePortfolio';
import { useQuotes } from '@/lib/hooks/useQuotes';
import { usePriceTargetConsensus } from '@/lib/hooks/usePriceTargets';
import {
  FileText, ChevronRight, ChevronLeft, Download, Check, User, Briefcase, Settings, Eye, Wifi, AlertCircle,
  TrendingUp, X, Sparkles, BarChart3,
} from 'lucide-react';

const REPORT_SECTIONS = [
  { key: 'summary', label: 'Sommaire du portefeuille (Morningstar)', default: true },
  { key: 'composition', label: 'Rendement + Composition détaillée', default: true },
  { key: 'targets', label: 'Cours cibles des analystes', default: true },
  { key: 'profiles', label: 'Fiches descriptives des titres', default: true },
  { key: 'risk', label: 'Métriques de risque & Scénarios', default: true },
  { key: 'stress', label: 'Tests de résistance', default: true },
  { key: 'disclaimers', label: 'Avertissements complets', default: true },
];

const STEPS = [
  { label: 'Client', icon: User },
  { label: 'Portefeuille', icon: Briefcase },
  { label: 'Vérification', icon: Eye },
  { label: 'Configuration', icon: Settings },
  { label: 'Générer', icon: FileText },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(value);
}

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2 }).format(value);
}

function NewReportWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { clients, isLoading: clientsLoading } = useClients();
  const { portfolios, isLoading: portfoliosLoading } = usePortfolios();

  const preselectedPortfolio = searchParams.get('portfolio') || '';

  const [step, setStep] = useState(0);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedPortfolioId, setSelectedPortfolioId] = useState(preselectedPortfolio);
  const [sections, setSections] = useState<string[]>(REPORT_SECTIONS.filter(s => s.default).map(s => s.key));
  const [projectionYears, setProjectionYears] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [customTargets, setCustomTargets] = useState<Record<string, number>>({});
  const [editingTarget, setEditingTarget] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [includeValuation, setIncludeValuation] = useState(false);

  // Filter portfolios by selected client
  const filteredPortfolios = useMemo(() => {
    if (!portfolios || !selectedClientId) return [];
    return portfolios.filter((p) => p.client_id === selectedClientId);
  }, [portfolios, selectedClientId]);

  // Auto-select client if portfolio is preselected
  useMemo(() => {
    if (preselectedPortfolio && portfolios) {
      const p = portfolios.find((p) => p.id === preselectedPortfolio);
      if (p) {
        setSelectedClientId(p.client_id);
        setSelectedPortfolioId(p.id);
        setStep(2); // Jump to verification
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolios, preselectedPortfolio]);

  const selectedClient = clients?.find((c) => c.id === selectedClientId);
  const selectedPortfolio = portfolios?.find((p) => p.id === selectedPortfolioId);

  // Get holdings from selected portfolio for verification step
  const [portfolioHoldings, setPortfolioHoldings] = useState<
    { symbol: string; name: string; quantity: number; average_cost: number; sector: string }[]
  >([]);
  const [holdingsLoading, setHoldingsLoading] = useState(false);

  // Fetch portfolio holdings when portfolio is selected
  useEffect(() => {
    if (selectedPortfolioId && step >= 2) {
      setHoldingsLoading(true);
      fetch(`/api/portfolios/${selectedPortfolioId}`)
        .then((r) => r.json())
        .then((data) => {
          setPortfolioHoldings(data.holdings || []);
        })
        .catch(() => setPortfolioHoldings([]))
        .finally(() => setHoldingsLoading(false));
    }
  }, [selectedPortfolioId, step]);

  // Get symbols for FMP fetch
  const holdingSymbols = useMemo(() => portfolioHoldings.map((h) => h.symbol), [portfolioHoldings]);

  // Fetch real-time prices
  const { quotes, quotesMap, isLoading: quotesLoading } = useQuotes(step >= 2 ? holdingSymbols : []);

  // Fetch price targets
  const { targets, isLoading: targetsLoading } = usePriceTargetConsensus(step >= 2 ? holdingSymbols : []);

  // Compute verification table data
  const verificationData = useMemo(() => {
    return portfolioHoldings.map((h) => {
      const quote = quotesMap.get(h.symbol);
      const target = targets[h.symbol];
      const currentPrice = quote?.price || h.average_cost;
      const marketValue = h.quantity * currentPrice;
      const apiTargetPrice = target?.targetConsensus || 0;
      const apiSource = target?.source || null;
      // Custom target only used when no API target exists
      const hasApiTarget = apiTargetPrice > 0;
      const targetPrice = hasApiTarget ? apiTargetPrice : (customTargets[h.symbol] ?? 0);
      const hasCustomTarget = !hasApiTarget && h.symbol in customTargets;
      const gainPercent = targetPrice > 0 && currentPrice > 0
        ? ((targetPrice - currentPrice) / currentPrice) * 100
        : 0;
      const sector = quote?.exchange || h.sector || '';
      return {
        symbol: h.symbol,
        name: quote?.company_name || h.name,
        currentPrice,
        hasFmpPrice: !!quote,
        targetPrice,
        apiTargetPrice,
        apiSource,
        hasApiTarget,
        hasCustomTarget,
        gainPercent,
        sector,
        marketValue,
      };
    });
  }, [portfolioHoldings, quotesMap, targets, customTargets]);

  const totalCurrentValue = verificationData.reduce((sum, v) => sum + v.marketValue, 0);
  const totalTargetValue = verificationData.reduce((sum, v) => {
    return sum + (v.targetPrice > 0 ? portfolioHoldings.find(h => h.symbol === v.symbol)!.quantity * v.targetPrice : v.marketValue);
  }, 0);
  const totalEstimatedGain = totalTargetValue - totalCurrentValue;
  const totalEstimatedGainPct = totalCurrentValue > 0 ? (totalEstimatedGain / totalCurrentValue) * 100 : 0;

  const fmpPriceCount = verificationData.filter((v) => v.hasFmpPrice).length;
  const targetCount = verificationData.filter((v) => v.targetPrice > 0).length;

  function toggleSection(key: string) {
    setSections((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
    );
  }

  async function handleGenerate() {
    if (!selectedClientId || !selectedPortfolioId) {
      toast('warning', 'Veuillez sélectionner un client et un portefeuille');
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolio_id: selectedPortfolioId,
          client_id: selectedClientId,
          config: {
            sections,
            projection_years: projectionYears,
            custom_targets: Object.keys(customTargets).length > 0 ? customTargets : undefined,
            ai_enabled: aiEnabled,
            include_valuation: includeValuation,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Generation failed');
      }

      // Download the PDF
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = res.headers.get('Content-Disposition')?.split('filename="')[1]?.replace('"', '') || 'rapport.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast('success', 'Rapport généré et téléchargé');
      router.push('/reports');
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Erreur de génération');
    } finally {
      setGenerating(false);
    }
  }

  const isLoading = clientsLoading || portfoliosLoading;

  if (isLoading) {
    return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  }

  return (
    <div className="max-w-4xl">
      {/* Stepper */}
      <div className="flex items-center justify-between mb-8 px-4">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone = i < step;
          return (
            <div key={i} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold
                  transition-all duration-200
                  ${isActive ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/30' :
                    isDone ? 'bg-emerald-100 text-emerald-700' :
                      'bg-gray-100 text-text-muted'}
                `}>
                  {isDone ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </div>
                <span className={`text-xs mt-1 ${isActive ? 'text-brand-primary font-semibold' : 'text-text-muted'}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 w-8 mx-1.5 mt-[-12px] ${i < step ? 'bg-emerald-300' : 'bg-gray-200'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step 0: Select Client */}
      {step === 0 && (
        <Card>
          <h3 className="font-semibold text-text-main mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-brand-primary" />
            Sélectionnez un client
          </h3>
          {!clients || clients.length === 0 ? (
            <p className="text-sm text-text-muted py-8 text-center">Aucun client disponible</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {clients.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedClientId(c.id); setSelectedPortfolioId(''); }}
                  className={`
                    w-full text-left px-4 py-3 rounded-lg border transition-all
                    ${selectedClientId === c.id
                      ? 'border-brand-primary bg-brand-primary/5 ring-2 ring-brand-primary/20'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
                  `}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-text-main">{c.first_name} {c.last_name}</p>
                      <p className="text-xs text-text-muted">{c.email} — {c.risk_profile}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.type === 'client' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {c.type === 'client' ? 'Client' : 'Prospect'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="flex justify-end mt-6">
            <Button
              disabled={!selectedClientId}
              onClick={() => setStep(1)}
              icon={<ChevronRight className="h-4 w-4" />}
            >
              Suivant
            </Button>
          </div>
        </Card>
      )}

      {/* Step 1: Select Portfolio */}
      {step === 1 && (
        <Card>
          <h3 className="font-semibold text-text-main mb-4 flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-brand-primary" />
            Sélectionnez un portefeuille
            {selectedClient && (
              <span className="text-sm font-normal text-text-muted">
                — {selectedClient.first_name} {selectedClient.last_name}
              </span>
            )}
          </h3>

          {filteredPortfolios.length === 0 ? (
            <p className="text-sm text-text-muted py-8 text-center">
              Ce client n&apos;a aucun portefeuille. Créez-en un d&apos;abord.
            </p>
          ) : (
            <div className="space-y-2">
              {filteredPortfolios.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPortfolioId(p.id)}
                  className={`
                    w-full text-left px-4 py-3 rounded-lg border transition-all
                    ${selectedPortfolioId === p.id
                      ? 'border-brand-primary bg-brand-primary/5 ring-2 ring-brand-primary/20'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
                  `}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-text-main">{p.name}</p>
                      <p className="text-xs text-text-muted">{p.account_type} — {p.currency} — {p.holdings_count} positions</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-between mt-6">
            <Button variant="ghost" onClick={() => setStep(0)} icon={<ChevronLeft className="h-4 w-4" />}>
              Retour
            </Button>
            <Button
              disabled={!selectedPortfolioId}
              onClick={() => setStep(2)}
              icon={<ChevronRight className="h-4 w-4" />}
            >
              Suivant
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: Vérification des prix & Secteurs */}
      {step === 2 && (
        <Card>
          <h3 className="font-semibold text-text-main mb-4 flex items-center gap-2">
            <Eye className="h-5 w-5 text-brand-primary" />
            Vérification des prix &amp; Cours cibles
          </h3>

          {holdingsLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size="lg" />
            </div>
          ) : portfolioHoldings.length === 0 ? (
            <p className="text-sm text-text-muted py-8 text-center">
              Aucun titre dans ce portefeuille.
            </p>
          ) : (
            <>
              {/* Status badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                {quotesLoading || targetsLoading ? (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs">
                    <Spinner size="sm" /> Chargement des données FMP...
                  </span>
                ) : (
                  <>
                    <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs ${fmpPriceCount > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                      {fmpPriceCount > 0 ? <Wifi className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                      {fmpPriceCount}/{holdingSymbols.length} prix temps réel
                    </span>
                    <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs ${targetCount > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-text-muted'
                      }`}>
                      <TrendingUp className="h-3 w-3" />
                      {targetCount}/{holdingSymbols.length} cours cibles
                    </span>
                  </>
                )}
              </div>

              {/* Verification table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-text-muted">
                      <th className="text-left py-2 font-semibold text-xs">Symbole</th>
                      <th className="text-left py-2 font-semibold text-xs">Nom</th>
                      <th className="text-right py-2 font-semibold text-xs">Prix actuel</th>
                      <th className="text-right py-2 font-semibold text-xs">Cours cible</th>
                      <th className="text-right py-2 font-semibold text-xs">Gain est. %</th>
                      <th className="text-right py-2 font-semibold text-xs">Valeur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verificationData.map((v) => (
                      <tr key={v.symbol} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="py-2.5">
                          <span className="font-mono font-semibold text-brand-primary">{v.symbol}</span>
                          {v.hasFmpPrice ? (
                            <span className="ml-1.5 px-1 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-700">FMP</span>
                          ) : (
                            <span className="ml-1.5 px-1 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700">Coût</span>
                          )}
                        </td>
                        <td className="py-2.5 text-text-main">{v.name}</td>
                        <td className="py-2.5 text-right font-semibold">{formatCurrencyFull(v.currentPrice)}</td>
                        <td className="py-2.5 text-right">
                          {editingTarget === v.symbol ? (
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                step="0.01"
                                autoFocus
                                defaultValue={v.targetPrice || ''}
                                className="w-20 px-1.5 py-0.5 text-right text-sm border border-brand-primary rounded focus:outline-none focus:ring-1 focus:ring-brand-primary"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const val = parseFloat((e.target as HTMLInputElement).value);
                                    if (!isNaN(val) && val > 0) {
                                      setCustomTargets((prev) => ({ ...prev, [v.symbol]: val }));
                                    }
                                    setEditingTarget(null);
                                  } else if (e.key === 'Escape') {
                                    setEditingTarget(null);
                                  }
                                }}
                                onBlur={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val) && val > 0) {
                                    setCustomTargets((prev) => ({ ...prev, [v.symbol]: val }));
                                  }
                                  setEditingTarget(null);
                                }}
                              />
                            </div>
                          ) : v.hasApiTarget ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="font-semibold">{formatCurrencyFull(v.targetPrice)}</span>
                              <span className={`ml-1 px-1 py-0.5 rounded text-[10px] ${v.apiSource === 'yahoo'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-blue-100 text-blue-700'
                                }`}>
                                {v.apiSource === 'yahoo' ? 'Yahoo' : 'FMP'}
                              </span>
                            </div>
                          ) : v.hasCustomTarget ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="font-semibold text-brand-primary">{formatCurrencyFull(v.targetPrice)}</span>
                              <span className="ml-1 px-1 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700">Manuel</span>
                              <button
                                onClick={() => setCustomTargets((prev) => {
                                  const next = { ...prev };
                                  delete next[v.symbol];
                                  return next;
                                })}
                                className="p-0.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600"
                                title="Supprimer"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setEditingTarget(v.symbol)}
                                className="px-2 py-0.5 text-xs border border-amber-300 bg-amber-50 text-amber-700 rounded hover:bg-amber-100"
                              >
                                Saisir
                              </button>
                            </div>
                          )}
                        </td>
                        <td className={`py-2.5 text-right font-semibold ${v.gainPercent > 0 ? 'text-emerald-600' : v.gainPercent < 0 ? 'text-red-500' : 'text-text-muted'
                          }`}>
                          {v.targetPrice > 0 ? `${v.gainPercent >= 0 ? '+' : ''}${v.gainPercent.toFixed(1)}%` : '—'}
                        </td>
                        <td className="py-2.5 text-right">{formatCurrency(v.marketValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="mt-4 p-4 bg-bg-light rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-text-muted">Valeur totale</p>
                    <p className="text-lg font-bold text-text-main">{formatCurrency(totalCurrentValue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Valeur cible 12 mois</p>
                    <p className="text-lg font-bold text-brand-primary">{formatCurrency(totalTargetValue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Gain estimé total</p>
                    <p className={`text-lg font-bold ${totalEstimatedGain >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {formatCurrency(totalEstimatedGain)} ({totalEstimatedGainPct >= 0 ? '+' : ''}{totalEstimatedGainPct.toFixed(1)}%)
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-between mt-6">
            <Button variant="ghost" onClick={() => setStep(1)} icon={<ChevronLeft className="h-4 w-4" />}>
              Retour
            </Button>
            <Button
              onClick={() => setStep(3)}
              icon={<ChevronRight className="h-4 w-4" />}
            >
              Configuration
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: Configuration */}
      {step === 3 && (
        <Card>
          <h3 className="font-semibold text-text-main mb-4 flex items-center gap-2">
            <Settings className="h-5 w-5 text-brand-primary" />
            Configuration du rapport
          </h3>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-text-main mb-2">
              Sections à inclure
            </label>
            <div className="space-y-2">
              {REPORT_SECTIONS.map((s) => (
                <label key={s.key} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sections.includes(s.key)}
                    onChange={() => toggleSection(s.key)}
                    className="w-4 h-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                  />
                  <span className="text-sm text-text-main">{s.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-text-main mb-2">
              Années de projection
            </label>
            <div className="flex gap-2">
              {[3, 5, 7, 10].map((y) => (
                <button
                  key={y}
                  onClick={() => setProjectionYears(y)}
                  className={`
                    px-4 py-2 rounded-lg text-sm font-semibold transition-all
                    ${projectionYears === y
                      ? 'bg-brand-primary text-white'
                      : 'bg-gray-100 text-text-muted hover:bg-gray-200'}
                  `}
                >
                  {y} ans
                </button>
              ))}
            </div>
          </div>

          {/* AI & Valuation toggles */}
          <div className="mb-6 border-t border-gray-100 pt-6">
            <label className="block text-sm font-semibold text-text-main mb-3">
              Fonctionnalites avancees
            </label>

            <label className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-gray-200 mb-2">
              <input
                type="checkbox"
                checked={aiEnabled}
                onChange={() => setAiEnabled(!aiEnabled)}
                className="w-4 h-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
              />
              <Sparkles className="h-4 w-4 text-purple-500" />
              <div>
                <span className="text-sm text-text-main font-medium">Activer les analyses IA (Groq)</span>
                <p className="text-xs text-text-muted">
                  Sommaire executif, descriptions en francais, commentaire d&apos;allocation, analyse des risques
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-gray-200">
              <input
                type="checkbox"
                checked={includeValuation}
                onChange={() => setIncludeValuation(!includeValuation)}
                className="w-4 h-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
              />
              <BarChart3 className="h-4 w-4 text-cyan-600" />
              <div>
                <span className="text-sm text-text-main font-medium">Inclure la page Valorisation intrinseque</span>
                <p className="text-xs text-text-muted">
                  DCF, P/S, P/E, reverse DCF, matrice de sensibilite, scorecard (Valuation Master Pro)
                </p>
              </div>
            </label>
          </div>

          <div className="flex justify-between mt-6">
            <Button variant="ghost" onClick={() => setStep(2)} icon={<ChevronLeft className="h-4 w-4" />}>
              Retour
            </Button>
            <Button onClick={() => setStep(4)} icon={<ChevronRight className="h-4 w-4" />}>
              Aperçu
            </Button>
          </div>
        </Card>
      )}

      {/* Step 4: Preview + Generate */}
      {step === 4 && (
        <Card>
          <h3 className="font-semibold text-text-main mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-brand-primary" />
            Aperçu du rapport
          </h3>

          <div className="bg-bg-light rounded-lg p-4 mb-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Client</span>
              <span className="font-semibold text-text-main">
                {selectedClient ? `${selectedClient.first_name} ${selectedClient.last_name}` : '—'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Portefeuille</span>
              <span className="font-semibold text-text-main">{selectedPortfolio?.name || '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Type de compte</span>
              <span className="text-text-main">{selectedPortfolio?.account_type || '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Positions</span>
              <span className="text-text-main">{selectedPortfolio?.holdings_count || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Prix FMP temps réel</span>
              <span className={`font-semibold ${fmpPriceCount > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {fmpPriceCount}/{holdingSymbols.length}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Cours cibles analystes</span>
              <span className={`font-semibold ${targetCount > 0 ? 'text-emerald-600' : 'text-text-muted'}`}>
                {targetCount}/{holdingSymbols.length}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Projection</span>
              <span className="text-text-main">{projectionYears} ans</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Pages</span>
              <span className="font-semibold text-brand-primary">{8 + (includeValuation ? 1 : 0)} pages (style Morningstar)</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Analyses IA</span>
              {aiEnabled ? (
                <span className="flex items-center gap-1 font-semibold text-purple-600">
                  <Sparkles className="h-3 w-3" /> Activees
                </span>
              ) : (
                <span className="text-text-muted">Desactivees</span>
              )}
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Valorisation intrinseque</span>
              {includeValuation ? (
                <span className="flex items-center gap-1 font-semibold text-cyan-600">
                  <BarChart3 className="h-3 w-3" /> Incluse
                </span>
              ) : (
                <span className="text-text-muted">Non incluse</span>
              )}
            </div>
          </div>

          <div className="mb-6">
            <p className="text-xs font-semibold text-text-muted mb-2">Sections incluses:</p>
            <div className="flex flex-wrap gap-2">
              {sections.map((key) => {
                const label = REPORT_SECTIONS.find(s => s.key === key)?.label || key;
                return (
                  <span key={key} className="text-xs px-2 py-1 bg-brand-primary/10 text-brand-primary rounded-full">
                    {label}
                  </span>
                );
              })}
            </div>
          </div>

          {totalEstimatedGain !== 0 && (
            <div className="mb-6 p-3 bg-bg-light rounded-lg">
              <p className="text-xs text-text-muted mb-1">Estimation consensus 12 mois</p>
              <p className={`text-sm font-bold ${totalEstimatedGain >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                Gain estimé: {formatCurrency(totalEstimatedGain)} ({totalEstimatedGainPct >= 0 ? '+' : ''}{totalEstimatedGainPct.toFixed(1)}%)
              </p>
            </div>
          )}

          <div className="flex justify-between mt-6">
            <Button variant="ghost" onClick={() => setStep(3)} icon={<ChevronLeft className="h-4 w-4" />}>
              Retour
            </Button>
            <Button
              loading={generating}
              onClick={handleGenerate}
              icon={<Download className="h-4 w-4" />}
            >
              Générer le rapport PDF
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function NewReportPage() {
  return (
    <div>
      <PageHeader title="Nouveau rapport" description="Rapport professionnel style Morningstar — 8-9 pages avec cours cibles, fiches descriptives, valorisation et analyses IA" />
      <Suspense fallback={<div className="flex justify-center py-12"><Spinner size="lg" /></div>}>
        <NewReportWizard />
      </Suspense>
    </div>
  );
}
