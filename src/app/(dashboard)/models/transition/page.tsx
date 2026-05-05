'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar,
  XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useInvestmentProfiles, type InvestmentProfile } from '@/lib/hooks/useInvestmentProfiles';
import { parseCroesusData, type ParsedHolding, ASSET_TYPE_CONFIG } from '@/lib/parsers/croesus-parser';
import { StepNav } from '@/components/models/StepNav';
import {
  ArrowLeft, ClipboardPaste, RefreshCw, Target, ArrowRightLeft,
  ShoppingCart, Ban, Copy, Check, AlertTriangle, Sparkles,
  ChevronDown, ChevronUp, ArrowUpCircle, ArrowDownCircle, Scale,
  FileText, Download,
} from 'lucide-react';

// ── Couleurs ──

const BRAND = '#00b4d8';
const NAVY = '#03045e';
const GREEN = '#10b981';
const RED = '#ef4444';
const AMBER = '#f59e0b';
const INDIGO = '#6366f1';
const PURPLE = '#8b5cf6';
const PINK = '#ec4899';
const CYAN = '#06b6d4';
const ORANGE = '#f97316';

const SECTOR_COLORS: Record<string, string> = {
  TECHNOLOGIE: '#3b82f6',
  FINANCE: '#10b981',
  SANTE: '#ef4444',
  ENERGIE: '#f59e0b',
  CONSOMMATION_BASE: '#8b5cf6',
  CONSOMMATION_DISCR: '#ec4899',
  INDUSTRIE: '#6366f1',
  MATERIAUX: '#14b8a6',
  IMMOBILIER: '#f97316',
  SERVICES_COMM: '#06b6d4',
  SERVICES_PUBLICS: '#84cc16',
  AUTRE: '#94a3b8',
};

const ALLOC_COLORS = [BRAND, INDIGO, GREEN, PURPLE, PINK, CYAN, ORANGE, AMBER];

const tooltipStyle = {
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  fontSize: 12,
};

function fmt(n: number) {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function fmtDec(n: number, d = 2) {
  return new Intl.NumberFormat('fr-CA', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
}

// ── Types ──

interface ProfileMatch {
  profile: InvestmentProfile;
  score: number; // 0-100, higher = closer match
  allocDrift: number; // absolute drift in equity/bond split
  details: string;
}

interface TransitionTx {
  priority: number;
  action: 'BUY' | 'SELL';
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  value: number;
  reason: string;
  assetType: string;
}

interface AIAnalysis {
  profileAnalysis: string;
  transitionRisks: string;
  recommendations: string;
  taxConsiderations: string;
}

interface GeneratedPortfolio {
  profileName: string;
  profileNumber: number;
  portfolioValue: number;
  equityPct: number;
  bondPct: number;
  totalStockValue: number;
  totalBondValue: number;
  cashRemaining: number;
  realEquityPct: number;
  realBondPct: number;
  realCashPct: number;
  sectors: {
    sector: string;
    sectorLabel: string;
    targetWeight: number;
    realWeight: number;
    stocks: {
      symbol: string;
      name: string;
      sector: string;
      stock_type: string;
      price: number;
      quantity: number;
      realValue: number;
      targetWeight: number;
      realWeight: number;
    }[];
    totalValue: number;
  }[];
  bonds: {
    description: string;
    issuer: string | null;
    cusip: string | null;
    coupon: number | null;
    maturity: string | null;
    price: number;
    yieldPct: number | null;
    quantity: number;
    realValue: number;
    targetWeight: number;
    realWeight: number;
    is_mandatory: boolean;
    source: string;
  }[];
  stats: {
    nbStocks: number;
    nbBonds: number;
    nbSectors: number;
    avgDividendYield: number;
    avgBondYield: number;
    estimatedAnnualIncome: number;
  };
}

// ════════════════════════════════════════
// PROFILE MATCHING ALGORITHM
// ════════════════════════════════════════

function matchProfiles(
  holdings: ParsedHolding[],
  profiles: InvestmentProfile[],
  totalValue: number
): ProfileMatch[] {
  if (totalValue <= 0 || profiles.length === 0) return [];

  // Calculate actual allocation
  const equityValue = holdings
    .filter(h => ['EQUITY', 'ETF', 'PREFERRED'].includes(h.assetType))
    .reduce((s, h) => s + h.marketValue, 0);
  const bondValue = holdings
    .filter(h => h.assetType === 'FIXED_INCOME')
    .reduce((s, h) => s + h.marketValue, 0);
  const fundValue = holdings
    .filter(h => h.assetType === 'FUND')
    .reduce((s, h) => s + h.marketValue, 0);

  // For funds, split 60/40 equity/bond as estimate (common balanced fund assumption)
  const estimatedEquityFromFunds = fundValue * 0.6;
  const estimatedBondFromFunds = fundValue * 0.4;

  const totalEquityEst = equityValue + estimatedEquityFromFunds;
  const totalBondEst = bondValue + estimatedBondFromFunds;
  const totalInvested = totalEquityEst + totalBondEst;

  const actualEquityPct = totalInvested > 0 ? (totalEquityEst / totalInvested) * 100 : 50;
  const actualBondPct = totalInvested > 0 ? (totalBondEst / totalInvested) * 100 : 50;

  return profiles
    .filter(p => p.is_active)
    .map(profile => {
      // Primary score: how close is the equity/bond split?
      const equityDrift = Math.abs(actualEquityPct - profile.equity_pct);
      const bondDrift = Math.abs(actualBondPct - profile.bond_pct);
      const allocDrift = (equityDrift + bondDrift) / 2;

      // Score: 100 = perfect match, 0 = completely off
      const score = Math.max(0, 100 - allocDrift * 2);

      let details = `Actions: ${fmtDec(actualEquityPct, 0)}% vs ${profile.equity_pct}% cible`;
      details += ` | Obligations: ${fmtDec(actualBondPct, 0)}% vs ${profile.bond_pct}% cible`;
      if (fundValue > 0) {
        details += ` | Fonds inclus: estimation 60/40`;
      }

      return { profile, score, allocDrift, details };
    })
    .sort((a, b) => b.score - a.score);
}

// ════════════════════════════════════════
// TRANSITION CALCULATION
// ════════════════════════════════════════

function calculateTransitions(
  holdings: ParsedHolding[],
  model: GeneratedPortfolio,
  totalValue: number
): TransitionTx[] {
  const transactions: TransitionTx[] = [];
  let priority = 1;

  // Build maps
  const modelStocks = new Map<string, { symbol: string; name: string; quantity: number; price: number; realWeight: number; sector: string }>();
  for (const sec of model.sectors) {
    for (const s of sec.stocks) {
      modelStocks.set(s.symbol.toUpperCase(), { ...s, sector: sec.sector });
    }
  }

  const actualEquities = new Map<string, ParsedHolding>();
  for (const h of holdings) {
    if (['EQUITY', 'ETF', 'PREFERRED'].includes(h.assetType) && h.marketValue > 0) {
      actualEquities.set(h.symbol.toUpperCase(), h);
    }
  }

  // 1. SELL: Funds first (transitioning away from funds to direct holdings)
  const funds = holdings.filter(h => h.assetType === 'FUND' && h.marketValue > 0);
  for (const f of funds) {
    transactions.push({
      priority: priority++,
      action: 'SELL',
      symbol: f.symbol,
      name: f.name,
      quantity: f.quantity,
      price: f.marketPrice,
      value: f.marketValue,
      reason: 'Fonds commun — transition vers titres individuels',
      assetType: f.assetType,
    });
  }

  // 2. SELL: Extra equities not in the model
  for (const [sym, h] of actualEquities) {
    if (!modelStocks.has(sym)) {
      transactions.push({
        priority: priority++,
        action: 'SELL',
        symbol: h.symbol,
        name: h.name,
        quantity: h.quantity,
        price: h.marketPrice,
        value: h.marketValue,
        reason: 'Hors modele — non inclus dans le portefeuille cible',
        assetType: h.assetType,
      });
    }
  }

  // 3. SELL: Overweight equities in model
  for (const [sym, ms] of modelStocks) {
    const actual = actualEquities.get(sym);
    if (actual && actual.quantity > ms.quantity) {
      const qtyDiff = actual.quantity - ms.quantity;
      transactions.push({
        priority: priority++,
        action: 'SELL',
        symbol: ms.symbol,
        name: ms.name,
        quantity: qtyDiff,
        price: ms.price,
        value: qtyDiff * ms.price,
        reason: `Surpondere — reduire de ${actual.quantity} a ${ms.quantity} actions`,
        assetType: 'EQUITY',
      });
    }
  }

  // 4. BUY: Missing or underweight equities
  for (const [sym, ms] of modelStocks) {
    const actual = actualEquities.get(sym);
    const actualQty = actual?.quantity ?? 0;
    if (actualQty < ms.quantity) {
      const qtyDiff = ms.quantity - actualQty;
      transactions.push({
        priority: priority++,
        action: 'BUY',
        symbol: ms.symbol,
        name: ms.name,
        quantity: qtyDiff,
        price: ms.price,
        value: qtyDiff * ms.price,
        reason: actualQty === 0 ? 'Nouvelle position dans le modele' : `Sous-pondere — augmenter de ${actualQty} a ${ms.quantity} actions`,
        assetType: 'EQUITY',
      });
    }
  }

  // 5. Bond transitions — sell bonds not in model, buy model bonds
  const actualBonds = holdings.filter(h => h.assetType === 'FIXED_INCOME' && h.marketValue > 0);
  const modelBondCusips = new Set(model.bonds.map(b => b.cusip?.toUpperCase()).filter(Boolean));

  for (const b of actualBonds) {
    if (!modelBondCusips.has(b.symbol.toUpperCase())) {
      transactions.push({
        priority: priority++,
        action: 'SELL',
        symbol: b.symbol,
        name: b.name,
        quantity: b.quantity,
        price: b.marketPrice,
        value: b.marketValue,
        reason: 'Obligation hors modele',
        assetType: 'FIXED_INCOME',
      });
    }
  }

  for (const mb of model.bonds) {
    const cusip = mb.cusip?.toUpperCase();
    const exists = cusip && actualBonds.some(b => b.symbol.toUpperCase() === cusip);
    if (!exists && mb.realValue > 0) {
      transactions.push({
        priority: priority++,
        action: 'BUY',
        symbol: mb.cusip || mb.description.slice(0, 15),
        name: mb.description,
        quantity: mb.quantity,
        price: mb.price,
        value: mb.realValue,
        reason: 'Nouvelle obligation du modele',
        assetType: 'FIXED_INCOME',
      });
    }
  }

  return transactions;
}

// ════════════════════════════════════════
// PAGE
// ════════════════════════════════════════

export default function TransitionPage() {
  const { profiles, isLoading: profilesLoading } = useInvestmentProfiles();
  const { toast } = useToast();

  // Step state
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Step 1: Paste data
  const [rawText, setRawText] = useState('');
  const [holdings, setHoldings] = useState<ParsedHolding[]>([]);
  const [totalValue, setTotalValue] = useState(0);

  // Step 2: Profile match
  const [matches, setMatches] = useState<ProfileMatch[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');

  // Step 3: Generate model + transitions
  const [generating, setGenerating] = useState(false);
  const [model, setModel] = useState<GeneratedPortfolio | null>(null);
  const [transactions, setTransactions] = useState<TransitionTx[]>([]);

  // Step 4: AI analysis
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);

  // Step 5: PDF
  const [pdfLoading, setPdfLoading] = useState(false);

  // ── Allocations ──
  const allocations = useMemo(() => {
    if (holdings.length === 0) return null;
    const total = holdings.reduce((s, h) => s + Math.max(0, h.marketValue), 0);
    if (total <= 0) return null;
    const byType = (type: string) => holdings.filter(h => h.assetType === type).reduce((s, h) => s + h.marketValue, 0);
    return {
      equityPct: (byType('EQUITY') / total) * 100,
      bondPct: (byType('FIXED_INCOME') / total) * 100,
      etfPct: (byType('ETF') / total) * 100,
      fundPct: (byType('FUND') / total) * 100,
      preferredPct: (byType('PREFERRED') / total) * 100,
      cashPct: (byType('CASH') / total) * 100,
      otherPct: (byType('OTHER') / total) * 100,
    };
  }, [holdings]);

  // ── Step 1: Parse ──
  function handleParse() {
    if (!rawText.trim()) { toast('warning', 'Collez les donnees Croesus'); return; }
    const result = parseCroesusData(rawText);
    if (result.holdings.length === 0) { toast('error', 'Aucune position detectee'); return; }
    setHoldings(result.holdings);
    const total = result.holdings.reduce((s, h) => s + h.marketValue, 0);
    setTotalValue(total);
    setModel(null);
    setTransactions([]);
    setAiAnalysis(null);

    // Auto-match profiles
    const m = matchProfiles(result.holdings, profiles, total);
    setMatches(m);
    if (m.length > 0) setSelectedProfileId(m[0].profile.id);

    setStep(2);
    toast('success', `${result.holdings.length} positions detectees (${fmt(total)})`);
  }

  // ── Step 3: Generate model ──
  const handleGenerate = useCallback(async () => {
    if (!selectedProfileId) { toast('warning', 'Selectionnez un profil'); return; }
    setGenerating(true);
    try {
      const res = await fetch('/api/models/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: selectedProfileId, portfolio_value: totalValue }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      const data = await res.json();
      setModel(data.portfolio);
      const txs = calculateTransitions(holdings, data.portfolio, totalValue);
      setTransactions(txs);
      setStep(4);
      toast('success', 'Plan de transition genere');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Erreur');
    } finally {
      setGenerating(false);
    }
  }, [selectedProfileId, totalValue, holdings, toast]);

  // ── Step 4: AI analysis ──
  const handleAIAnalysis = useCallback(async () => {
    if (!model || !allocations) return;
    const selectedProfile = profiles.find(p => p.id === selectedProfileId);
    if (!selectedProfile) return;

    setAiLoading(true);
    try {
      const res = await fetch('/api/transition/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holdings: holdings.map(h => ({
            symbol: h.symbol, name: h.name, assetType: h.assetType,
            weight: h.weight, marketValue: h.marketValue, sector: h.sector,
          })),
          allocations,
          matchedProfile: {
            id: selectedProfile.id,
            name: selectedProfile.name,
            profile_number: selectedProfile.profile_number,
            equity_pct: selectedProfile.equity_pct,
            bond_pct: selectedProfile.bond_pct,
          },
          totalValue,
        }),
      });
      if (!res.ok) throw new Error('Erreur IA');
      const data = await res.json();
      setAiAnalysis(data.analysis);
    } catch {
      toast('error', 'Erreur lors de l\'analyse IA');
    } finally {
      setAiLoading(false);
    }
  }, [model, allocations, holdings, profiles, selectedProfileId, totalValue, toast]);

  // ── Derived transaction data ──
  const buys = transactions.filter(t => t.action === 'BUY');
  const sells = transactions.filter(t => t.action === 'SELL');
  const totalBuys = buys.reduce((s, t) => s + t.value, 0);
  const totalSells = sells.reduce((s, t) => s + t.value, 0);

  // ── Sector comparison data ──
  const sectorComparison = useMemo(() => {
    if (!model || holdings.length === 0) return [];

    const actualSectors = new Map<string, number>();
    for (const h of holdings) {
      if (['EQUITY', 'ETF', 'PREFERRED'].includes(h.assetType) && h.marketValue > 0) {
        let sector = 'AUTRE';
        const sym = h.symbol.toUpperCase();
        for (const sec of model.sectors) {
          if (sec.stocks.some(s => s.symbol.toUpperCase() === sym)) {
            sector = sec.sector;
            break;
          }
        }
        actualSectors.set(sector, (actualSectors.get(sector) || 0) + h.marketValue);
      }
    }

    const allSectors = new Set([
      ...model.sectors.map(s => s.sector),
      ...actualSectors.keys(),
    ]);

    return Array.from(allSectors).map(sector => {
      const modelSec = model.sectors.find(s => s.sector === sector);
      const actualValue = actualSectors.get(sector) || 0;
      const actualWeight = totalValue > 0 ? (actualValue / totalValue) * 100 : 0;
      return {
        name: modelSec?.sectorLabel || sector,
        beforePct: Math.round(actualWeight * 10) / 10,
        afterPct: Math.round((modelSec?.realWeight || 0) * 10) / 10,
      };
    }).filter(d => d.beforePct > 0.5 || d.afterPct > 0.5)
      .sort((a, b) => Math.max(b.beforePct, b.afterPct) - Math.max(a.beforePct, a.afterPct));
  }, [holdings, model, totalValue]);

  // ── Generate PDF ──
  const handleGeneratePDF = useCallback(async () => {
    const profile = profiles.find(p => p.id === selectedProfileId);
    if (!model || !allocations || !profile) return;
    setPdfLoading(true);
    try {
      const bestMatch = matches.find(m => m.profile.id === selectedProfileId);
      const pdfData = {
        clientName: undefined,
        date: new Date().toLocaleDateString('fr-CA'),
        totalValue,
        profileName: profile.name,
        profileEquityPct: profile.equity_pct,
        profileBondPct: profile.bond_pct,
        matchScore: bestMatch?.score ?? 0,
        before: {
          equityPct: allocations.equityPct,
          bondPct: allocations.bondPct,
          etfPct: allocations.etfPct,
          fundPct: allocations.fundPct,
          preferredPct: allocations.preferredPct,
          cashPct: allocations.cashPct,
          otherPct: allocations.otherPct,
        },
        after: {
          equityPct: model.realEquityPct,
          bondPct: model.realBondPct,
          cashPct: model.realCashPct,
        },
        sectors: sectorComparison,
        transactions: transactions.map(t => ({
          priority: t.priority,
          action: t.action,
          symbol: t.symbol,
          name: t.name,
          assetType: t.assetType,
          quantity: t.quantity,
          price: t.price,
          value: t.value,
          reason: t.reason,
        })),
        totalBuys,
        totalSells,
        netFlow: totalSells - totalBuys,
        estimatedFees: transactions.length * 9.95,
        aiAnalysis: aiAnalysis || undefined,
        holdingsCount: holdings.length,
        modelStocksCount: model.stats.nbStocks,
        modelBondsCount: model.stats.nbBonds,
      };

      const res = await fetch('/api/transition/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pdfData),
      });
      if (!res.ok) throw new Error('Erreur generation PDF');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transition-${profile.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast('success', 'PDF telecharge');
    } catch {
      toast('error', 'Erreur lors de la generation du PDF');
    } finally {
      setPdfLoading(false);
    }
  }, [model, allocations, profiles, matches, selectedProfileId, totalValue, sectorComparison, transactions, totalBuys, totalSells, aiAnalysis, holdings, toast]);

  // ── Copy transactions ──
  function handleCopyTx() {
    const lines = [
      'Priorite\tAction\tSymbole\tNom\tType\tQuantite\tPrix\tValeur\tRaison',
      ...transactions.map(t =>
        `${t.priority}\t${t.action}\t${t.symbol}\t${t.name}\t${t.assetType}\t${t.quantity}\t${fmtDec(t.price)}\t${fmt(t.value)}\t${t.reason}`
      ),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    toast('success', 'Plan de transition copie');
  }

  if (profilesLoading) {
    return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  }

  const selectedProfile = profiles.find(p => p.id === selectedProfileId);

  return (
    <div>
      <PageHeader
        title="Transition discretionnaire"
        description="Detectez le profil du client, generez un plan de transition vers votre portefeuille modele"
        action={
          <Link href="/models">
            <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />}>Retour</Button>
          </Link>
        }
      />

      {/* ── Progress Steps ── */}
      <div className="flex items-center gap-2 mb-8">
        {[
          { n: 1, label: 'Coller les positions' },
          { n: 2, label: 'Detecter le profil' },
          { n: 3, label: 'Generer le plan' },
          { n: 4, label: 'Analyse IA' },
          { n: 5, label: 'Rapport PDF' },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            {i > 0 && <div className={`h-px w-6 ${step >= s.n ? 'bg-brand-primary' : 'bg-gray-200'}`} />}
            <button
              onClick={() => { if (s.n <= step) setStep(s.n as 1 | 2 | 3 | 4 | 5); }}
              disabled={s.n > step}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                s.n === step ? 'bg-brand-primary text-white' :
                s.n < step ? 'bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer' :
                'bg-gray-100 text-text-light cursor-not-allowed'
              }`}
            >
              {s.n < step ? <Check className="h-3 w-3" /> : <span>{s.n}</span>}
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          </div>
        ))}
      </div>

      {/* ════════════ STEP 1: PASTE ════════════ */}
      {step === 1 && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <ClipboardPaste className="h-5 w-5 text-brand-primary" />
            <h2 className="text-base font-semibold text-text-main">Coller les positions Croesus du client</h2>
          </div>
          <p className="text-sm text-text-muted mb-4">
            Copiez les positions du client depuis Croesus (meme format que Pret a coller) et collez-les ci-dessous.
            Le systeme detectera automatiquement le type de portefeuille le plus proche de vos 6 modeles.
          </p>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Collez ici les positions copiees depuis Croesus (Ctrl+V)..."
            rows={10}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary resize-none mb-4"
          />
          <Button onClick={handleParse} disabled={!rawText.trim()} icon={<Target className="h-4 w-4" />}>
            Analyser et detecter le profil
          </Button>
        </Card>
      )}

      {/* ════════════ STEP 2: PROFILE MATCH ════════════ */}
      {step === 2 && allocations && (
        <div className="space-y-6">
          {/* Current allocation summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <h3 className="text-sm font-semibold text-text-main mb-4">Repartition actuelle du client</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Actions', value: allocations.equityPct, fill: BRAND },
                      { name: 'Obligations', value: allocations.bondPct, fill: INDIGO },
                      { name: 'FNB', value: allocations.etfPct, fill: PURPLE },
                      { name: 'Fonds', value: allocations.fundPct, fill: AMBER },
                      { name: 'Privilegiees', value: allocations.preferredPct, fill: PINK },
                      { name: 'Liquidites', value: allocations.cashPct, fill: GREEN },
                      { name: 'Autre', value: allocations.otherPct, fill: '#94a3b8' },
                    ].filter(d => d.value > 0.5)}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {[
                      { name: 'Actions', value: allocations.equityPct, fill: BRAND },
                      { name: 'Obligations', value: allocations.bondPct, fill: INDIGO },
                      { name: 'FNB', value: allocations.etfPct, fill: PURPLE },
                      { name: 'Fonds', value: allocations.fundPct, fill: AMBER },
                      { name: 'Privilegiees', value: allocations.preferredPct, fill: PINK },
                      { name: 'Liquidites', value: allocations.cashPct, fill: GREEN },
                      { name: 'Autre', value: allocations.otherPct, fill: '#94a3b8' },
                    ].filter(d => d.value > 0.5).map((d, i) => (
                      <Cell key={i} fill={d.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => [`${fmtDec(Number(value))}%`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {[
                  { name: 'Actions', value: allocations.equityPct, fill: BRAND },
                  { name: 'Obligations', value: allocations.bondPct, fill: INDIGO },
                  { name: 'FNB', value: allocations.etfPct, fill: PURPLE },
                  { name: 'Fonds', value: allocations.fundPct, fill: AMBER },
                  { name: 'Privilegiees', value: allocations.preferredPct, fill: PINK },
                  { name: 'Liquidites', value: allocations.cashPct, fill: GREEN },
                ].filter(d => d.value > 0.5).map(d => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs text-text-muted">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                    {d.name} ({fmtDec(d.value)}%)
                  </div>
                ))}
              </div>
            </Card>

            {/* Quick stats */}
            <Card>
              <h3 className="text-sm font-semibold text-text-main mb-4">Resume du portefeuille</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-text-muted">Valeur totale</p>
                  <p className="text-lg font-bold text-text-main">{fmt(totalValue)}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-text-muted">Positions</p>
                  <p className="text-lg font-bold text-text-main">{holdings.length}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-text-muted">Actions</p>
                  <p className="text-lg font-bold" style={{ color: BRAND }}>{holdings.filter(h => h.assetType === 'EQUITY').length}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-text-muted">Obligations</p>
                  <p className="text-lg font-bold" style={{ color: INDIGO }}>{holdings.filter(h => h.assetType === 'FIXED_INCOME').length}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-text-muted">FNB</p>
                  <p className="text-lg font-bold" style={{ color: PURPLE }}>{holdings.filter(h => h.assetType === 'ETF').length}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-text-muted">Fonds communs</p>
                  <p className="text-lg font-bold" style={{ color: AMBER }}>{holdings.filter(h => h.assetType === 'FUND').length}</p>
                </div>
              </div>

              {/* Holdings by type */}
              <div className="mt-4">
                <p className="text-xs text-text-muted mb-2">Top 5 positions par poids</p>
                {holdings
                  .sort((a, b) => b.weight - a.weight)
                  .slice(0, 5)
                  .map((h, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-brand-primary">{h.symbol}</span>
                        <Badge variant="outline">{ASSET_TYPE_CONFIG[h.assetType]?.label || h.assetType}</Badge>
                      </div>
                      <span className="text-xs font-medium">{fmtDec(h.weight)}%</span>
                    </div>
                  ))}
              </div>
            </Card>
          </div>

          {/* Profile matches */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Target className="h-5 w-5 text-brand-primary" />
              <h3 className="text-base font-semibold text-text-main">Detection du profil</h3>
            </div>
            <p className="text-sm text-text-muted mb-4">
              Basee sur l&apos;allocation actions/obligations du portefeuille actuel, voici la correspondance avec vos modeles:
            </p>

            <div className="space-y-3">
              {matches.map((m, i) => {
                const isSelected = m.profile.id === selectedProfileId;
                const isBest = i === 0;
                return (
                  <button
                    key={m.profile.id}
                    onClick={() => setSelectedProfileId(m.profile.id)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-brand-primary bg-brand-primary/5 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {isBest && <Badge variant="success">Meilleur match</Badge>}
                        <h4 className="font-semibold text-text-main">
                          {m.profile.profile_number}. {m.profile.name}
                        </h4>
                        <span className="text-xs text-text-muted">
                          ({m.profile.equity_pct}% / {m.profile.bond_pct}%)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`text-sm font-bold ${
                          m.score >= 80 ? 'text-emerald-600' :
                          m.score >= 60 ? 'text-amber-600' :
                          'text-red-500'
                        }`}>
                          {fmtDec(m.score, 0)}%
                        </div>
                        <div className={`h-2 w-20 bg-gray-100 rounded-full overflow-hidden`}>
                          <div
                            className={`h-full rounded-full ${
                              m.score >= 80 ? 'bg-emerald-500' :
                              m.score >= 60 ? 'bg-amber-500' :
                              'bg-red-400'
                            }`}
                            style={{ width: `${m.score}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-text-muted">{m.details}</p>
                    {isSelected && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-brand-primary font-medium">
                        <Check className="h-3 w-3" /> Profil selectionne pour la transition
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end mt-6">
              <Button
                onClick={() => setStep(3)}
                disabled={!selectedProfileId}
                icon={<ArrowRightLeft className="h-4 w-4" />}
              >
                Continuer avec {selectedProfile?.name || '...'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ════════════ STEP 3: GENERATE PLAN ════════════ */}
      {step === 3 && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <RefreshCw className="h-5 w-5 text-brand-primary" />
            <h2 className="text-base font-semibold text-text-main">Generation du plan de transition</h2>
          </div>
          <p className="text-sm text-text-muted mb-4">
            Le systeme va generer le portefeuille modele <strong>{selectedProfile?.name}</strong> ({selectedProfile?.equity_pct}/{selectedProfile?.bond_pct})
            pour une valeur de <strong>{fmt(totalValue)}</strong>, puis calculer toutes les transactions
            necessaires pour transitionner le portefeuille du client.
          </p>
          <div className="flex gap-3">
            <Button
              onClick={handleGenerate}
              loading={generating}
              icon={<RefreshCw className="h-4 w-4" />}
            >
              Generer le plan de transition
            </Button>
            <Button variant="ghost" onClick={() => setStep(2)}>
              Modifier le profil
            </Button>
          </div>
          {generating && (
            <div className="flex flex-col items-center justify-center py-12">
              <Spinner size="lg" />
              <p className="text-sm text-text-muted mt-4">Generation du modele et calcul des transactions...</p>
            </div>
          )}
        </Card>
      )}

      {/* ════════════ STEP 4: RESULTS + AI ════════════ */}
      {step === 4 && model && (
        <div className="space-y-6">
          {/* Dashboard stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card padding="sm" className="text-center">
              <p className="text-2xl font-bold text-text-main">{transactions.length}</p>
              <p className="text-xs text-text-muted">Transactions</p>
            </Card>
            <Card padding="sm" className="text-center">
              <p className="text-2xl font-bold text-emerald-600">{buys.length}</p>
              <p className="text-xs text-text-muted">Achats</p>
            </Card>
            <Card padding="sm" className="text-center">
              <p className="text-2xl font-bold text-red-500">{sells.length}</p>
              <p className="text-xs text-text-muted">Ventes</p>
            </Card>
            <Card padding="sm" className="text-center">
              <p className="text-2xl font-bold text-text-main">{model.stats.nbStocks}</p>
              <p className="text-xs text-text-muted">Titres modele</p>
            </Card>
            <Card padding="sm" className="text-center">
              <p className="text-2xl font-bold text-text-main">{model.stats.nbBonds}</p>
              <p className="text-xs text-text-muted">Obligations modele</p>
            </Card>
          </div>

          {/* Before/After allocation comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <h3 className="text-sm font-semibold text-text-main mb-3 text-center">Allocation AVANT</h3>
              {allocations && (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Actions', value: allocations.equityPct + allocations.etfPct + allocations.preferredPct },
                          { name: 'Obligations', value: allocations.bondPct },
                          { name: 'Fonds', value: allocations.fundPct },
                          { name: 'Liquidites', value: allocations.cashPct },
                        ].filter(d => d.value > 0.5)}
                        dataKey="value"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        strokeWidth={0}
                      >
                        {[BRAND, INDIGO, AMBER, GREEN].map((c, i) => (
                          <Cell key={i} fill={c} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: any) => [`${fmtDec(Number(v))}%`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-4 text-xs text-text-muted">
                    <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: BRAND }} /> Actions {fmtDec(allocations.equityPct + allocations.etfPct + allocations.preferredPct, 0)}%</span>
                    <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: INDIGO }} /> Oblig. {fmtDec(allocations.bondPct, 0)}%</span>
                    {allocations.fundPct > 0.5 && <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: AMBER }} /> Fonds {fmtDec(allocations.fundPct, 0)}%</span>}
                  </div>
                </>
              )}
            </Card>

            <Card>
              <h3 className="text-sm font-semibold text-text-main mb-3 text-center">Allocation APRES (modele)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Actions', value: model.realEquityPct },
                      { name: 'Obligations', value: model.realBondPct },
                      { name: 'Liquidites', value: model.realCashPct },
                    ].filter(d => d.value > 0.5)}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {[BRAND, INDIGO, GREEN].map((c, i) => (
                      <Cell key={i} fill={c} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: any) => [`${fmtDec(Number(v))}%`, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 text-xs text-text-muted">
                <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: BRAND }} /> Actions {fmtDec(model.realEquityPct, 0)}%</span>
                <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: INDIGO }} /> Oblig. {fmtDec(model.realBondPct, 0)}%</span>
                <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: GREEN }} /> Liq. {fmtDec(model.realCashPct, 0)}%</span>
              </div>
            </Card>
          </div>

          {/* Sector comparison before/after */}
          {model.sectors.length > 0 && (
            <Card>
              <h3 className="text-sm font-semibold text-text-main mb-4">Comparaison sectorielle</h3>
              <SectorComparisonChart holdings={holdings} model={model} totalValue={totalValue} />
            </Card>
          )}

          {/* Transaction summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card padding="sm">
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownCircle className="h-4 w-4 text-red-500" />
                <span className="text-xs text-text-muted">Ventes ({sells.length})</span>
              </div>
              <p className="text-lg font-semibold text-red-500">{fmt(totalSells)}</p>
            </Card>
            <Card padding="sm">
              <div className="flex items-center gap-2 mb-1">
                <ArrowUpCircle className="h-4 w-4 text-emerald-500" />
                <span className="text-xs text-text-muted">Achats ({buys.length})</span>
              </div>
              <p className="text-lg font-semibold text-emerald-600">{fmt(totalBuys)}</p>
            </Card>
            <Card padding="sm">
              <div className="flex items-center gap-2 mb-1">
                <Scale className="h-4 w-4 text-text-muted" />
                <span className="text-xs text-text-muted">Flux net</span>
              </div>
              <p className={`text-lg font-semibold ${(totalSells - totalBuys) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {(totalSells - totalBuys) >= 0 ? '+' : ''}{fmt(totalSells - totalBuys)}
              </p>
            </Card>
            <Card padding="sm">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-xs text-text-muted">Frais est.</span>
              </div>
              <p className="text-lg font-semibold text-amber-600">~{fmt(transactions.length * 9.95)}</p>
              <p className="text-[10px] text-text-muted">{transactions.length} x 9,95$</p>
            </Card>
          </div>

          {/* Transaction table */}
          <Card padding="none">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-main">Plan de transition complet</h3>
              <Button variant="ghost" size="sm" onClick={handleCopyTx} icon={<Copy className="h-3.5 w-3.5" />}>
                Copier
              </Button>
            </div>

            {/* Sells section */}
            {sells.length > 0 && (
              <>
                <div className="px-5 py-2 bg-red-50/50 border-b border-red-100">
                  <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">
                    Ventes ({sells.length}) — {fmt(totalSells)}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-text-muted uppercase tracking-wider border-b border-gray-100">
                        <th className="px-4 py-2 w-12">#</th>
                        <th className="px-3 py-2">Symbole</th>
                        <th className="px-3 py-2">Nom</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2 text-right">Qte</th>
                        <th className="px-3 py-2 text-right">Prix</th>
                        <th className="px-3 py-2 text-right">Valeur</th>
                        <th className="px-3 py-2">Raison</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sells.map(t => (
                        <tr key={`${t.symbol}-${t.priority}`} className="border-t border-gray-50 hover:bg-red-50/30">
                          <td className="px-4 py-2 text-text-light font-mono text-xs">{t.priority}</td>
                          <td className="px-3 py-2 font-mono font-medium text-text-main">{t.symbol}</td>
                          <td className="px-3 py-2 text-text-muted text-xs max-w-[150px] truncate">{t.name}</td>
                          <td className="px-3 py-2"><Badge variant="outline">{ASSET_TYPE_CONFIG[t.assetType as keyof typeof ASSET_TYPE_CONFIG]?.label || t.assetType}</Badge></td>
                          <td className="px-3 py-2 text-right font-mono font-semibold">{t.quantity}</td>
                          <td className="px-3 py-2 text-right font-mono text-text-muted">{fmtDec(t.price)}</td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-red-500">{fmt(t.value)}</td>
                          <td className="px-3 py-2 text-text-muted text-xs max-w-[200px]">{t.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Buys section */}
            {buys.length > 0 && (
              <>
                <div className="px-5 py-2 bg-emerald-50/50 border-b border-emerald-100 border-t border-gray-100">
                  <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                    Achats ({buys.length}) — {fmt(totalBuys)}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-text-muted uppercase tracking-wider border-b border-gray-100">
                        <th className="px-4 py-2 w-12">#</th>
                        <th className="px-3 py-2">Symbole</th>
                        <th className="px-3 py-2">Nom</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2 text-right">Qte</th>
                        <th className="px-3 py-2 text-right">Prix</th>
                        <th className="px-3 py-2 text-right">Valeur</th>
                        <th className="px-3 py-2">Raison</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buys.map(t => (
                        <tr key={`${t.symbol}-${t.priority}`} className="border-t border-gray-50 hover:bg-emerald-50/30">
                          <td className="px-4 py-2 text-text-light font-mono text-xs">{t.priority}</td>
                          <td className="px-3 py-2 font-mono font-medium text-text-main">{t.symbol}</td>
                          <td className="px-3 py-2 text-text-muted text-xs max-w-[150px] truncate">{t.name}</td>
                          <td className="px-3 py-2"><Badge variant="outline">{ASSET_TYPE_CONFIG[t.assetType as keyof typeof ASSET_TYPE_CONFIG]?.label || t.assetType}</Badge></td>
                          <td className="px-3 py-2 text-right font-mono font-semibold">{t.quantity}</td>
                          <td className="px-3 py-2 text-right font-mono text-text-muted">{fmtDec(t.price)}</td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-600">{fmt(t.value)}</td>
                          <td className="px-3 py-2 text-text-muted text-xs max-w-[200px]">{t.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card>

          {/* AI Analysis section */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-brand-primary" />
                <h3 className="text-base font-semibold text-text-main">Analyse IA de la transition</h3>
              </div>
              {!aiAnalysis && (
                <Button
                  size="sm"
                  onClick={handleAIAnalysis}
                  loading={aiLoading}
                  icon={<Sparkles className="h-3.5 w-3.5" />}
                >
                  Generer l&apos;analyse
                </Button>
              )}
            </div>

            {aiLoading && (
              <div className="flex flex-col items-center py-8">
                <Spinner size="md" />
                <p className="text-sm text-text-muted mt-3">Analyse en cours...</p>
              </div>
            )}

            {aiAnalysis && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-100">
                  <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2">Analyse du profil</h4>
                  <p className="text-sm text-text-main leading-relaxed">{aiAnalysis.profileAnalysis}</p>
                </div>
                <div className="p-4 bg-amber-50/50 rounded-lg border border-amber-100">
                  <h4 className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">Risques de transition</h4>
                  <p className="text-sm text-text-main leading-relaxed">{aiAnalysis.transitionRisks}</p>
                </div>
                <div className="p-4 bg-emerald-50/50 rounded-lg border border-emerald-100">
                  <h4 className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">Approche recommandee</h4>
                  <p className="text-sm text-text-main leading-relaxed">{aiAnalysis.recommendations}</p>
                </div>
                <div className="p-4 bg-purple-50/50 rounded-lg border border-purple-100">
                  <h4 className="text-xs font-semibold text-purple-700 uppercase tracking-wider mb-2">Considerations fiscales</h4>
                  <p className="text-sm text-text-main leading-relaxed">{aiAnalysis.taxConsiderations}</p>
                </div>
              </div>
            )}
          </Card>

          {/* PDF Generation */}
          <Card>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-50 rounded-xl">
                  <FileText className="h-6 w-6 text-rose-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-text-main">Rapport PDF de transition</h3>
                  <p className="text-sm text-text-muted">
                    Inclut les allocations avant/apres, la comparaison sectorielle,
                    le plan de transactions{aiAnalysis ? ' et l\'analyse IA' : ''}.
                  </p>
                </div>
              </div>
              <Button
                onClick={handleGeneratePDF}
                loading={pdfLoading}
                icon={<Download className="h-4 w-4" />}
              >
                Telecharger le PDF
              </Button>
            </div>
          </Card>
        </div>
      )}

      <StepNav current={10} />
    </div>
  );
}

// ════════════════════════════════════════
// SECTOR COMPARISON CHART
// ════════════════════════════════════════

function SectorComparisonChart({ holdings, model, totalValue }: {
  holdings: ParsedHolding[];
  model: GeneratedPortfolio;
  totalValue: number;
}) {
  const data = useMemo(() => {
    // Actual sector weights from holdings (equity only)
    const actualSectors = new Map<string, number>();
    for (const h of holdings) {
      if (['EQUITY', 'ETF', 'PREFERRED'].includes(h.assetType) && h.marketValue > 0) {
        // Try to find sector from model
        let sector = 'AUTRE';
        const sym = h.symbol.toUpperCase();
        for (const sec of model.sectors) {
          if (sec.stocks.some(s => s.symbol.toUpperCase() === sym)) {
            sector = sec.sector;
            break;
          }
        }
        actualSectors.set(sector, (actualSectors.get(sector) || 0) + h.marketValue);
      }
    }

    // Build comparison data
    const allSectors = new Set([
      ...model.sectors.map(s => s.sector),
      ...actualSectors.keys(),
    ]);

    return Array.from(allSectors).map(sector => {
      const modelSec = model.sectors.find(s => s.sector === sector);
      const actualValue = actualSectors.get(sector) || 0;
      const actualWeight = totalValue > 0 ? (actualValue / totalValue) * 100 : 0;

      return {
        name: modelSec?.sectorLabel || sector,
        avant: Math.round(actualWeight * 10) / 10,
        apres: Math.round((modelSec?.realWeight || 0) * 10) / 10,
      };
    }).filter(d => d.avant > 0.5 || d.apres > 0.5)
      .sort((a, b) => Math.max(b.avant, b.apres) - Math.max(a.avant, a.apres));
  }, [holdings, model, totalValue]);

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v}%`} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={95} />
        <Tooltip
          contentStyle={tooltipStyle}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(v: any, name: any) => [`${fmtDec(Number(v))}%`, name === 'avant' ? 'Avant' : 'Apres']}
        />
        <Bar dataKey="avant" fill={RED} name="avant" radius={[0, 4, 4, 0]} barSize={12} opacity={0.7} />
        <Bar dataKey="apres" fill={BRAND} name="apres" radius={[0, 4, 4, 0]} barSize={12} />
      </BarChart>
    </ResponsiveContainer>
  );
}
