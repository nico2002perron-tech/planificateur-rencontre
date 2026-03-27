'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  PieChart, Pie,
} from 'recharts';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useInvestmentProfiles } from '@/lib/hooks/useInvestmentProfiles';
import { parseCroesusData, type ParsedHolding } from '@/lib/parsers/croesus-parser';
import { StepNav } from '@/components/models/StepNav';
import {
  ArrowLeft, Scale, ClipboardPaste, Zap, AlertTriangle, Check,
  Copy, ShoppingCart, Ban, ArrowUpCircle, ArrowDownCircle,
} from 'lucide-react';

// ── Types ──

interface GeneratedStock {
  symbol: string;
  name: string;
  sector: string;
  stock_type: string;
  price: number;
  quantity: number;
  realValue: number;
  targetWeight: number;
  realWeight: number;
}

interface GeneratedBond {
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
}

interface SectorSummary {
  sector: string;
  sectorLabel: string;
  targetWeight: number;
  realWeight: number;
  stocks: GeneratedStock[];
  totalValue: number;
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
  sectors: SectorSummary[];
  bonds: GeneratedBond[];
  stats: { nbStocks: number; nbBonds: number; nbSectors: number; avgDividendYield: number; avgBondYield: number; estimatedAnnualIncome: number };
}

// Drift par secteur
interface SectorDrift {
  sector: string;
  sectorLabel: string;
  modelWeight: number;
  actualWeight: number;
  drift: number; // actualWeight - modelWeight
  absDrift: number;
  inAlert: boolean;
}

// Drift par titre
interface StockDrift {
  symbol: string;
  name: string;
  sector: string;
  modelWeight: number;
  actualWeight: number;
  drift: number;
  absDrift: number;
  modelQty: number;
  actualQty: number;
  price: number;
  inAlert: boolean;
  status: 'match' | 'overweight' | 'underweight' | 'missing' | 'extra';
}

// Transaction de reequilibrage
interface RebalanceTx {
  priority: number;
  action: 'BUY' | 'SELL';
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  value: number;
  reason: string;
  driftPct: number;
}

// ── Constantes ──

const BRAND = '#00b4d8';
const GREEN = '#10b981';
const RED = '#ef4444';
const AMBER = '#f59e0b';
const INDIGO = '#6366f1';

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

// ════════════════════════════════════════
// PAGE
// ════════════════════════════════════════

export default function RebalancePage() {
  const { profiles, isLoading: profilesLoading } = useInvestmentProfiles();
  const { toast } = useToast();

  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [rawText, setRawText] = useState('');
  const [holdings, setHoldings] = useState<ParsedHolding[]>([]);
  const [parsed, setParsed] = useState(false);
  const [portfolioValue, setPortfolioValue] = useState(0);
  const [driftThreshold, setDriftThreshold] = useState(2); // %

  const [generating, setGenerating] = useState(false);
  const [model, setModel] = useState<GeneratedPortfolio | null>(null);

  function handleParse() {
    if (!rawText.trim()) {
      toast('warning', 'Collez les donnees Croesus');
      return;
    }
    const result = parseCroesusData(rawText);
    if (result.holdings.length === 0) {
      toast('error', 'Aucune position detectee');
      return;
    }
    setHoldings(result.holdings);
    setParsed(true);
    const total = result.holdings.reduce((sum, h) => sum + h.marketValue, 0);
    setPortfolioValue(total);
    setModel(null);
    toast('success', `${result.holdings.length} positions (${fmt(total)})`);
  }

  const handleGenerate = useCallback(async () => {
    if (!selectedProfileId) {
      toast('warning', 'Selectionnez un profil');
      return;
    }
    if (portfolioValue <= 0) {
      toast('warning', 'Collez d\'abord les positions Croesus');
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch('/api/models/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: selectedProfileId, portfolio_value: portfolioValue }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      const data = await res.json();
      setModel(data.portfolio);
      toast('success', 'Analyse de derive prete');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Erreur');
    } finally {
      setGenerating(false);
    }
  }, [selectedProfileId, portfolioValue, toast]);

  if (profilesLoading) {
    return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  }

  return (
    <div>
      <PageHeader
        title="Detection de derive et reequilibrage"
        description="Identifiez les ecarts par rapport au modele et generez un plan de reequilibrage"
        action={
          <Link href="/models">
            <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />}>Retour</Button>
          </Link>
        }
      />

      {/* Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Coller Croesus */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <ClipboardPaste className="h-4 w-4 text-text-muted" />
            <h3 className="text-sm font-semibold text-text-main">1. Positions actuelles (Croesus)</h3>
          </div>
          <textarea
            value={rawText}
            onChange={(e) => { setRawText(e.target.value); setParsed(false); setModel(null); }}
            placeholder="Collez ici les positions depuis Croesus (Ctrl+V)..."
            rows={5}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary resize-none mb-3"
          />
          <div className="flex items-center justify-between">
            <Button size="sm" onClick={handleParse} disabled={!rawText.trim()}>Analyser</Button>
            {parsed && (
              <div className="flex gap-2">
                <Badge variant="success">{holdings.length} positions</Badge>
                <Badge variant="info">{fmt(portfolioValue)}</Badge>
              </div>
            )}
          </div>
        </Card>

        {/* Profil + seuil */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-text-muted" />
            <h3 className="text-sm font-semibold text-text-main">2. Parametres</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Profil d&apos;investissement</label>
              <select
                value={selectedProfileId}
                onChange={(e) => { setSelectedProfileId(e.target.value); setModel(null); }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
              >
                <option value="">-- Selectionnez --</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.profile_number}. {p.name} ({p.equity_pct}/{p.bond_pct})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1">
                Seuil de derive: <strong className="text-text-main">{driftThreshold}%</strong>
              </label>
              <input
                type="range"
                min={0.5}
                max={10}
                step={0.5}
                value={driftThreshold}
                onChange={(e) => setDriftThreshold(Number(e.target.value))}
                className="w-full accent-brand-primary"
              />
              <div className="flex justify-between text-[10px] text-text-light">
                <span>0.5%</span>
                <span>5%</span>
                <span>10%</span>
              </div>
            </div>

            <Button
              size="sm"
              loading={generating}
              disabled={!selectedProfileId || portfolioValue <= 0}
              onClick={handleGenerate}
              icon={<Scale className="h-3.5 w-3.5" />}
            >
              Analyser la derive
            </Button>
          </div>
        </Card>
      </div>

      {generating && (
        <div className="flex flex-col items-center justify-center py-16">
          <Spinner size="lg" />
          <p className="text-sm text-text-muted mt-4">Generation du modele et analyse...</p>
        </div>
      )}

      {model && parsed && !generating && (
        <DriftView
          model={model}
          holdings={holdings}
          totalValue={portfolioValue}
          threshold={driftThreshold}
        />
      )}

      <StepNav current={7} />
    </div>
  );
}

// ════════════════════════════════════════
// VUE DERIVE
// ════════════════════════════════════════

function DriftView({ model, holdings, totalValue, threshold }: {
  model: GeneratedPortfolio;
  holdings: ParsedHolding[];
  totalValue: number;
  threshold: number;
}) {
  const { toast } = useToast();

  const analysis = useMemo(() => {
    // ── Sector drift ──
    const sectorDrifts: SectorDrift[] = [];

    // Actual sector weights from holdings
    const actualSectorValues = new Map<string, number>();
    for (const h of holdings) {
      if (['EQUITY', 'ETF', 'PREFERRED'].includes(h.assetType) && h.marketValue > 0) {
        // Try to find the sector from the model
        const sym = h.symbol.toUpperCase();
        let sector = 'AUTRE';
        for (const sec of model.sectors) {
          if (sec.stocks.some(s => s.symbol.toUpperCase() === sym)) {
            sector = sec.sector;
            break;
          }
        }
        actualSectorValues.set(sector, (actualSectorValues.get(sector) || 0) + h.marketValue);
      }
    }

    for (const sec of model.sectors) {
      const actualValue = actualSectorValues.get(sec.sector) || 0;
      const actualWeight = totalValue > 0 ? (actualValue / totalValue) * 100 : 0;
      const drift = actualWeight - sec.realWeight;
      sectorDrifts.push({
        sector: sec.sector,
        sectorLabel: sec.sectorLabel,
        modelWeight: sec.realWeight,
        actualWeight: Math.round(actualWeight * 100) / 100,
        drift: Math.round(drift * 100) / 100,
        absDrift: Math.abs(Math.round(drift * 100) / 100),
        inAlert: Math.abs(drift) >= threshold,
      });
      actualSectorValues.delete(sec.sector);
    }

    // Extra sectors not in model
    for (const [sector, value] of actualSectorValues) {
      const actualWeight = totalValue > 0 ? (value / totalValue) * 100 : 0;
      sectorDrifts.push({
        sector,
        sectorLabel: sector,
        modelWeight: 0,
        actualWeight: Math.round(actualWeight * 100) / 100,
        drift: Math.round(actualWeight * 100) / 100,
        absDrift: Math.round(actualWeight * 100) / 100,
        inAlert: actualWeight >= threshold,
      });
    }

    // ── Stock drift ──
    const stockDrifts: StockDrift[] = [];

    const modelStocks = new Map<string, GeneratedStock & { sector: string }>();
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

    for (const [sym, ms] of modelStocks) {
      const actual = actualEquities.get(sym);
      const actualValue = actual?.marketValue ?? 0;
      const actualQty = actual?.quantity ?? 0;
      const actualWeight = totalValue > 0 ? (actualValue / totalValue) * 100 : 0;
      const drift = actualWeight - ms.realWeight;

      let status: StockDrift['status'];
      if (!actual) status = 'missing';
      else if (Math.abs(drift) < threshold / 2) status = 'match';
      else if (drift > 0) status = 'overweight';
      else status = 'underweight';

      stockDrifts.push({
        symbol: ms.symbol,
        name: ms.name,
        sector: ms.sector,
        modelWeight: ms.realWeight,
        actualWeight: Math.round(actualWeight * 100) / 100,
        drift: Math.round(drift * 100) / 100,
        absDrift: Math.abs(Math.round(drift * 100) / 100),
        modelQty: ms.quantity,
        actualQty,
        price: ms.price,
        inAlert: Math.abs(drift) >= threshold / 2,
        status,
      });
      actualEquities.delete(sym);
    }

    for (const [sym, h] of actualEquities) {
      const actualWeight = totalValue > 0 ? (h.marketValue / totalValue) * 100 : 0;
      stockDrifts.push({
        symbol: sym,
        name: h.name,
        sector: 'AUTRE',
        modelWeight: 0,
        actualWeight: Math.round(actualWeight * 100) / 100,
        drift: Math.round(actualWeight * 100) / 100,
        absDrift: Math.round(actualWeight * 100) / 100,
        modelQty: 0,
        actualQty: h.quantity,
        price: h.marketPrice,
        inAlert: actualWeight >= threshold / 2,
        status: 'extra',
      });
    }

    // ── Allocation drift ──
    const actualEquityTotal = holdings
      .filter(h => ['EQUITY', 'ETF', 'PREFERRED'].includes(h.assetType))
      .reduce((s, h) => s + h.marketValue, 0);
    const actualBondTotal = holdings
      .filter(h => h.assetType === 'FIXED_INCOME')
      .reduce((s, h) => s + h.marketValue, 0);
    const actualCash = holdings
      .filter(h => h.assetType === 'CASH')
      .reduce((s, h) => s + h.marketValue, 0);

    const allocDrift = {
      equity: {
        model: model.realEquityPct,
        actual: totalValue > 0 ? Math.round((actualEquityTotal / totalValue) * 10000) / 100 : 0,
        drift: 0,
        inAlert: false,
      },
      bond: {
        model: model.realBondPct,
        actual: totalValue > 0 ? Math.round((actualBondTotal / totalValue) * 10000) / 100 : 0,
        drift: 0,
        inAlert: false,
      },
      cash: {
        model: model.realCashPct,
        actual: totalValue > 0 ? Math.round((actualCash / totalValue) * 10000) / 100 : 0,
        drift: 0,
        inAlert: false,
      },
    };
    allocDrift.equity.drift = Math.round((allocDrift.equity.actual - allocDrift.equity.model) * 100) / 100;
    allocDrift.bond.drift = Math.round((allocDrift.bond.actual - allocDrift.bond.model) * 100) / 100;
    allocDrift.cash.drift = Math.round((allocDrift.cash.actual - allocDrift.cash.model) * 100) / 100;
    allocDrift.equity.inAlert = Math.abs(allocDrift.equity.drift) >= threshold;
    allocDrift.bond.inAlert = Math.abs(allocDrift.bond.drift) >= threshold;
    allocDrift.cash.inAlert = Math.abs(allocDrift.cash.drift) >= threshold;

    // ── Rebalancing transactions ──
    const transactions: RebalanceTx[] = [];
    let priority = 1;

    const sorted = [...stockDrifts].sort((a, b) => b.absDrift - a.absDrift);
    for (const sd of sorted) {
      if (sd.status === 'match') continue;

      if (sd.status === 'missing') {
        transactions.push({
          priority: priority++,
          action: 'BUY',
          symbol: sd.symbol,
          name: sd.name,
          quantity: sd.modelQty,
          price: sd.price,
          value: sd.modelQty * sd.price,
          reason: 'Position absente',
          driftPct: sd.drift,
        });
      } else if (sd.status === 'extra') {
        transactions.push({
          priority: priority++,
          action: 'SELL',
          symbol: sd.symbol,
          name: sd.name,
          quantity: sd.actualQty,
          price: sd.price,
          value: sd.actualQty * sd.price,
          reason: 'Hors modele',
          driftPct: sd.drift,
        });
      } else if (sd.status === 'underweight') {
        const qtyDiff = sd.modelQty - sd.actualQty;
        if (qtyDiff > 0) {
          transactions.push({
            priority: priority++,
            action: 'BUY',
            symbol: sd.symbol,
            name: sd.name,
            quantity: qtyDiff,
            price: sd.price,
            value: qtyDiff * sd.price,
            reason: `Sous-pondere (${sd.drift > 0 ? '+' : ''}${fmtDec(sd.drift)}%)`,
            driftPct: sd.drift,
          });
        }
      } else if (sd.status === 'overweight') {
        const qtyDiff = sd.actualQty - sd.modelQty;
        if (qtyDiff > 0) {
          transactions.push({
            priority: priority++,
            action: 'SELL',
            symbol: sd.symbol,
            name: sd.name,
            quantity: qtyDiff,
            price: sd.price,
            value: qtyDiff * sd.price,
            reason: `Surpondere (+${fmtDec(sd.drift)}%)`,
            driftPct: sd.drift,
          });
        }
      }
    }

    // Summary stats
    const alertSectors = sectorDrifts.filter(s => s.inAlert).length;
    const alertStocks = stockDrifts.filter(s => s.inAlert).length;
    const maxDrift = stockDrifts.length > 0 ? Math.max(...stockDrifts.map(s => s.absDrift)) : 0;
    const avgDrift = stockDrifts.length > 0 ? stockDrifts.reduce((s, d) => s + d.absDrift, 0) / stockDrifts.length : 0;

    return {
      sectorDrifts: sectorDrifts.sort((a, b) => b.absDrift - a.absDrift),
      stockDrifts: stockDrifts.sort((a, b) => b.absDrift - a.absDrift),
      allocDrift,
      transactions,
      summary: { alertSectors, alertStocks, maxDrift, avgDrift, totalStocks: stockDrifts.length },
    };
  }, [model, holdings, totalValue, threshold]);

  const { sectorDrifts, stockDrifts, allocDrift, transactions, summary } = analysis;

  const buys = transactions.filter(t => t.action === 'BUY');
  const sells = transactions.filter(t => t.action === 'SELL');
  const totalBuys = buys.reduce((s, t) => s + t.value, 0);
  const totalSells = sells.reduce((s, t) => s + t.value, 0);

  // Donut data for allocation drift
  const donutData = [
    { name: 'Actions', value: allocDrift.equity.actual, fill: BRAND },
    { name: 'Obligations', value: allocDrift.bond.actual, fill: INDIGO },
    { name: 'Liquidites', value: allocDrift.cash.actual, fill: GREEN },
  ].filter(d => d.value > 0);

  // Sector drift chart
  const sectorChartData = sectorDrifts.map(s => ({
    name: s.sectorLabel.length > 12 ? s.sectorLabel.substring(0, 12) + '...' : s.sectorLabel,
    drift: s.drift,
    inAlert: s.inAlert,
  }));

  // Copy transactions
  function handleCopy() {
    const lines = [
      'Priorite\tAction\tSymbole\tNom\tQuantite\tPrix\tValeur\tRaison',
      ...transactions.map(t =>
        `${t.priority}\t${t.action}\t${t.symbol}\t${t.name}\t${t.quantity}\t${fmtDec(t.price)}\t${fmt(t.value)}\t${t.reason}`
      ),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    toast('success', 'Plan de reequilibrage copie');
  }

  return (
    <div className="space-y-6">
      {/* ── Dashboard stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card padding="sm" className="text-center">
          <p className={`text-2xl font-bold ${summary.alertSectors > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
            {summary.alertSectors}
          </p>
          <p className="text-xs text-text-muted">Secteurs en alerte</p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className={`text-2xl font-bold ${summary.alertStocks > 0 ? 'text-amber-500' : 'text-emerald-600'}`}>
            {summary.alertStocks}
          </p>
          <p className="text-xs text-text-muted">Titres en alerte</p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className={`text-2xl font-bold ${summary.maxDrift >= threshold ? 'text-red-500' : 'text-text-main'}`}>
            {fmtDec(summary.maxDrift, 1)}%
          </p>
          <p className="text-xs text-text-muted">Derive max</p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className="text-2xl font-bold text-text-main">{fmtDec(summary.avgDrift, 1)}%</p>
          <p className="text-xs text-text-muted">Derive moy.</p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className="text-2xl font-bold text-text-main">{transactions.length}</p>
          <p className="text-xs text-text-muted">Transactions</p>
        </Card>
      </div>

      {/* ── Allocation drift + Donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-sm font-semibold text-text-main mb-4">Derive d&apos;allocation globale</h3>
          <div className="space-y-4">
            {[
              { label: 'Actions', ...allocDrift.equity },
              { label: 'Obligations', ...allocDrift.bond },
              { label: 'Liquidites', ...allocDrift.cash },
            ].map(a => (
              <div key={a.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-text-main">{a.label}</span>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-text-muted">Modele: <strong>{fmtDec(a.model)}%</strong></span>
                    <span className="text-text-muted">Actuel: <strong>{fmtDec(a.actual)}%</strong></span>
                    <span className={`font-bold ${a.inAlert ? 'text-red-500' : Math.abs(a.drift) > 0.5 ? 'text-amber-500' : 'text-emerald-600'}`}>
                      {a.drift > 0 ? '+' : ''}{fmtDec(a.drift)}%
                      {a.inAlert && <AlertTriangle className="h-3.5 w-3.5 inline ml-1" />}
                    </span>
                  </div>
                </div>
                <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="absolute h-full bg-gray-300 rounded-full opacity-50"
                    style={{ width: `${Math.min(a.model, 100)}%` }}
                  />
                  <div
                    className={`absolute h-full rounded-full ${a.inAlert ? 'bg-red-400' : 'bg-brand-primary'}`}
                    style={{ width: `${Math.min(a.actual, 100)}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="flex gap-4 text-xs text-text-muted pt-2">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-2 bg-gray-300 rounded-sm opacity-50" /> Modele
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-2 bg-brand-primary rounded-sm" /> Actuel
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-text-main mb-2 text-center">Repartition actuelle</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={donutData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                strokeWidth={0}
              >
                {donutData.map((d, i) => (
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
          <div className="flex justify-center gap-4">
            {donutData.map(d => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-text-muted">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                {d.name} ({fmtDec(d.value)}%)
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Derive sectorielle ── */}
      {sectorChartData.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-text-main mb-4">
            Derive sectorielle
            <span className="text-xs text-text-light font-normal ml-2">(seuil: {threshold}%)</span>
          </h3>
          <ResponsiveContainer width="100%" height={Math.max(180, sectorChartData.length * 36)}>
            <BarChart data={sectorChartData} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#586e82' }} tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v}%`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#586e82' }} width={75} />
              <Tooltip
                contentStyle={tooltipStyle}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [`${Number(value) > 0 ? '+' : ''}${fmtDec(Number(value))}%`, 'Derive']}
              />
              <Bar dataKey="drift" radius={[0, 4, 4, 0]}>
                {sectorChartData.map((s, i) => (
                  <Cell key={i} fill={s.inAlert ? RED : Math.abs(s.drift) > threshold / 2 ? AMBER : GREEN} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* ── Tableau derive par titre ── */}
      <Card padding="none">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-main">Derive par titre</h3>
          <div className="flex gap-3 text-xs text-text-muted">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500" /> Alerte ({stockDrifts.filter(s => s.inAlert).length})
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500" /> OK ({stockDrifts.filter(s => !s.inAlert).length})
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-text-muted uppercase tracking-wider border-b border-gray-100">
                <th className="px-4 py-2.5 w-8"></th>
                <th className="px-3 py-2.5">Symbole</th>
                <th className="px-3 py-2.5">Secteur</th>
                <th className="px-3 py-2.5 text-right">Modele</th>
                <th className="px-3 py-2.5 text-right">Actuel</th>
                <th className="px-3 py-2.5 text-right">Derive</th>
                <th className="px-3 py-2.5 text-center">Statut</th>
              </tr>
            </thead>
            <tbody>
              {stockDrifts.map(sd => (
                <tr
                  key={sd.symbol}
                  className={`border-t border-gray-50 hover:bg-gray-50/50 ${
                    sd.inAlert ? 'bg-red-50/30' : ''
                  }`}
                >
                  <td className="px-4 py-2">
                    {sd.inAlert
                      ? <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                      : <Check className="h-3.5 w-3.5 text-emerald-500" />
                    }
                  </td>
                  <td className="px-3 py-2 font-mono font-medium text-text-main">{sd.symbol}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">{sd.sector}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-text-muted">{fmtDec(sd.modelWeight)}%</td>
                  <td className="px-3 py-2 text-right font-mono text-text-muted">{fmtDec(sd.actualWeight)}%</td>
                  <td className={`px-3 py-2 text-right font-mono font-semibold ${
                    sd.inAlert ? 'text-red-500' : Math.abs(sd.drift) > 0.3 ? 'text-amber-500' : 'text-emerald-600'
                  }`}>
                    {sd.drift > 0 ? '+' : ''}{fmtDec(sd.drift)}%
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Badge variant={
                      sd.status === 'match' ? 'success'
                      : sd.status === 'missing' ? 'danger'
                      : sd.status === 'extra' ? 'default'
                      : 'warning'
                    }>
                      {sd.status === 'match' ? 'OK'
                      : sd.status === 'missing' ? 'Absent'
                      : sd.status === 'extra' ? 'Hors mod.'
                      : sd.status === 'overweight' ? 'Surpond.'
                      : 'Sous-pond.'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Plan de reequilibrage ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-main">Plan de reequilibrage (par priorite)</h3>
          <Button variant="ghost" size="sm" onClick={handleCopy} icon={<Copy className="h-3.5 w-3.5" />}>
            Copier
          </Button>
        </div>

        {transactions.length === 0 ? (
          <Card className="text-center py-8">
            <Check className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
            <h3 className="font-semibold text-text-main">Portefeuille aligne</h3>
            <p className="text-sm text-text-muted">Aucune derive significative detectee au seuil de {threshold}%.</p>
          </Card>
        ) : (
          <>
            {/* Resume achats/ventes */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Card padding="sm">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowUpCircle className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs text-text-muted">Achats ({buys.length})</span>
                </div>
                <p className="text-lg font-semibold text-emerald-600">{fmt(totalBuys)}</p>
              </Card>
              <Card padding="sm">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowDownCircle className="h-4 w-4 text-red-500" />
                  <span className="text-xs text-text-muted">Ventes ({sells.length})</span>
                </div>
                <p className="text-lg font-semibold text-red-500">{fmt(totalSells)}</p>
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
            </div>

            {/* Tableau transactions */}
            <Card padding="none">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-text-muted uppercase tracking-wider border-b border-gray-100">
                      <th className="px-4 py-2.5 w-12">#</th>
                      <th className="px-3 py-2.5 w-20">Action</th>
                      <th className="px-3 py-2.5">Symbole</th>
                      <th className="px-3 py-2.5">Nom</th>
                      <th className="px-3 py-2.5 text-right">Qte</th>
                      <th className="px-3 py-2.5 text-right">Prix</th>
                      <th className="px-3 py-2.5 text-right">Valeur</th>
                      <th className="px-3 py-2.5">Raison</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(t => (
                      <tr
                        key={`${t.symbol}-${t.priority}`}
                        className={`border-t border-gray-50 hover:bg-gray-50/50 ${
                          t.action === 'BUY' ? 'bg-emerald-50/20' : 'bg-red-50/20'
                        }`}
                      >
                        <td className="px-4 py-2.5 text-text-light font-mono">{t.priority}</td>
                        <td className="px-3 py-2.5">
                          <Badge variant={t.action === 'BUY' ? 'success' : 'danger'}>
                            {t.action === 'BUY' ? (
                              <span className="flex items-center gap-1"><ShoppingCart className="h-3 w-3" /> Achat</span>
                            ) : (
                              <span className="flex items-center gap-1"><Ban className="h-3 w-3" /> Vente</span>
                            )}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 font-mono font-medium text-text-main">{t.symbol}</td>
                        <td className="px-3 py-2.5 text-text-muted max-w-[150px] truncate">{t.name}</td>
                        <td className="px-3 py-2.5 text-right font-mono font-semibold">{t.quantity}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-text-muted">
                          {t.price > 0 ? fmtDec(t.price) : '—'}
                        </td>
                        <td className={`px-3 py-2.5 text-right font-mono font-semibold ${
                          t.action === 'BUY' ? 'text-emerald-600' : 'text-red-500'
                        }`}>
                          {t.value > 0 ? fmt(t.value) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-text-muted text-xs">{t.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>

      <p className="text-xs text-text-light">
        Les transactions sont classees par amplitude de derive (priorite 1 = derive la plus importante).
        Les quantites et prix sont indicatifs — validez avant execution.
      </p>
    </div>
  );
}
