'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useInvestmentProfiles } from '@/lib/hooks/useInvestmentProfiles';
import { parseCroesusData, type ParsedHolding } from '@/lib/parsers/croesus-parser';
import {
  ArrowLeft, Zap, ArrowRightLeft, ClipboardPaste,
  TrendingUp, TrendingDown, Minus, AlertTriangle, Check,
  ShoppingCart, Ban, Copy, ArrowUpCircle, ArrowDownCircle,
} from 'lucide-react';

// ── Types miroir du generateur ──

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
  generatedAt: string;
}

// ── Constantes ──

const BRAND = '#00b4d8';
const GREEN = '#10b981';
const RED = '#ef4444';
const AMBER = '#f59e0b';

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

// ── Types de comparaison ──

interface ComparedPosition {
  symbol: string;
  name: string;
  // Modele
  modelQty: number;
  modelValue: number;
  modelWeight: number;
  // Actuel
  actualQty: number;
  actualValue: number;
  actualWeight: number;
  // Ecart
  qtyDiff: number;
  valueDiff: number;
  weightDiff: number;
  status: 'match' | 'overweight' | 'underweight' | 'missing' | 'extra';
  sector?: string;
}

// ════════════════════════════════════════
// PAGE PRINCIPALE
// ════════════════════════════════════════

export default function ComparePage() {
  const { profiles, isLoading: profilesLoading } = useInvestmentProfiles();
  const { toast } = useToast();

  // Step 1: Generer le modele
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [portfolioValue, setPortfolioValue] = useState(0); // sera calcule depuis Croesus
  const [generating, setGenerating] = useState(false);
  const [model, setModel] = useState<GeneratedPortfolio | null>(null);

  // Step 2: Coller Croesus
  const [rawText, setRawText] = useState('');
  const [holdings, setHoldings] = useState<ParsedHolding[]>([]);
  const [parsed, setParsed] = useState(false);

  // Parse Croesus
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

    // Calculer la valeur totale du portefeuille
    const total = result.holdings.reduce((sum, h) => sum + h.marketValue, 0);
    setPortfolioValue(total);

    toast('success', `${result.holdings.length} positions detectees (${fmt(total)})`);
  }

  // Generer le modele basé sur la valeur du portefeuille Croesus
  async function handleGenerate() {
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
        body: JSON.stringify({
          profile_id: selectedProfileId,
          portfolio_value: portfolioValue,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      const data = await res.json();
      setModel(data.portfolio);
      toast('success', 'Modele genere — comparaison prete');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Erreur');
    } finally {
      setGenerating(false);
    }
  }

  if (profilesLoading) {
    return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  }

  return (
    <div>
      <PageHeader
        title="Comparaison Modele vs Positions"
        description="Comparez un portefeuille modele avec les positions reelles d'un client"
        action={
          <Link href="/models">
            <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />}>Retour</Button>
          </Link>
        }
      />

      {/* ── Etape 1 & 2 cote a cote ── */}
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
            rows={6}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary resize-none mb-3"
          />
          <div className="flex items-center justify-between">
            <Button size="sm" onClick={handleParse} disabled={!rawText.trim()}>
              Analyser
            </Button>
            {parsed && (
              <div className="flex items-center gap-2">
                <Badge variant="success">{holdings.length} positions</Badge>
                <Badge variant="info">{fmt(portfolioValue)}</Badge>
              </div>
            )}
          </div>
        </Card>

        {/* Generer modele */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-text-muted" />
            <h3 className="text-sm font-semibold text-text-main">2. Portefeuille modele</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Profil d'investissement</label>
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
              <label className="block text-xs text-text-muted mb-1">Valeur cible</label>
              <input
                type="text"
                readOnly
                value={portfolioValue > 0 ? fmt(portfolioValue) : 'Detectee automatiquement depuis Croesus'}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-text-muted"
              />
            </div>

            <Button
              size="sm"
              loading={generating}
              disabled={!selectedProfileId || portfolioValue <= 0}
              onClick={handleGenerate}
              icon={<ArrowRightLeft className="h-3.5 w-3.5" />}
            >
              Generer et comparer
            </Button>

            {model && (
              <div className="flex gap-2">
                <Badge variant="success">{model.stats.nbStocks} actions</Badge>
                <Badge variant="info">{model.stats.nbBonds} obligations</Badge>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ── Resultat comparaison ── */}
      {generating && (
        <div className="flex flex-col items-center justify-center py-16">
          <Spinner size="lg" />
          <p className="text-sm text-text-muted mt-4">Generation du modele...</p>
        </div>
      )}

      {model && parsed && !generating && (
        <ComparisonView model={model} holdings={holdings} totalValue={portfolioValue} />
      )}
    </div>
  );
}

// ════════════════════════════════════════
// VUE COMPARAISON
// ════════════════════════════════════════

function ComparisonView({ model, holdings, totalValue }: {
  model: GeneratedPortfolio;
  holdings: ParsedHolding[];
  totalValue: number;
}) {
  // ── Construire la comparaison actions ──
  const comparison = useMemo(() => {
    // Collecter les actions du modele
    const modelStocks = new Map<string, GeneratedStock>();
    for (const sec of model.sectors) {
      for (const s of sec.stocks) {
        modelStocks.set(s.symbol.toUpperCase(), s);
      }
    }

    // Collecter les equities actuelles (EQUITY + ETF + PREFERRED)
    const actualEquities = new Map<string, ParsedHolding>();
    for (const h of holdings) {
      if (['EQUITY', 'ETF', 'PREFERRED'].includes(h.assetType) && h.marketValue > 0) {
        actualEquities.set(h.symbol.toUpperCase(), h);
      }
    }

    // Collecter les fixed income actuelles
    const actualBonds = holdings.filter(h => h.assetType === 'FIXED_INCOME' && h.marketValue > 0);

    const positions: ComparedPosition[] = [];

    // 1. Positions dans le modele
    for (const [sym, ms] of modelStocks) {
      const actual = actualEquities.get(sym);
      const actualValue = actual?.marketValue ?? 0;
      const actualQty = actual?.quantity ?? 0;
      const actualWeight = totalValue > 0 ? (actualValue / totalValue) * 100 : 0;
      const weightDiff = actualWeight - ms.realWeight;

      let status: ComparedPosition['status'];
      if (!actual) {
        status = 'missing';
      } else if (Math.abs(weightDiff) < 0.5) {
        status = 'match';
      } else if (weightDiff > 0) {
        status = 'overweight';
      } else {
        status = 'underweight';
      }

      positions.push({
        symbol: ms.symbol,
        name: ms.name,
        modelQty: ms.quantity,
        modelValue: ms.realValue,
        modelWeight: ms.realWeight,
        actualQty,
        actualValue,
        actualWeight: Math.round(actualWeight * 100) / 100,
        qtyDiff: actualQty - ms.quantity,
        valueDiff: actualValue - ms.realValue,
        weightDiff: Math.round(weightDiff * 100) / 100,
        status,
        sector: ms.sector,
      });

      // Retirer du set actuel
      actualEquities.delete(sym);
    }

    // 2. Positions extra (dans le portefeuille mais pas dans le modele)
    for (const [sym, h] of actualEquities) {
      const actualWeight = totalValue > 0 ? (h.marketValue / totalValue) * 100 : 0;
      positions.push({
        symbol: sym,
        name: h.name,
        modelQty: 0,
        modelValue: 0,
        modelWeight: 0,
        actualQty: h.quantity,
        actualValue: h.marketValue,
        actualWeight: Math.round(actualWeight * 100) / 100,
        qtyDiff: h.quantity,
        valueDiff: h.marketValue,
        weightDiff: Math.round(actualWeight * 100) / 100,
        status: 'extra',
      });
    }

    // Stats
    const match = positions.filter(p => p.status === 'match').length;
    const overweight = positions.filter(p => p.status === 'overweight').length;
    const underweight = positions.filter(p => p.status === 'underweight').length;
    const missing = positions.filter(p => p.status === 'missing').length;
    const extra = positions.filter(p => p.status === 'extra').length;
    const adherence = positions.length > 0
      ? Math.round(((match + overweight + underweight) / (positions.length - extra)) * 100)
      : 0;

    // Allocation actuelle
    const actualEquityTotal = holdings
      .filter(h => ['EQUITY', 'ETF', 'PREFERRED'].includes(h.assetType))
      .reduce((s, h) => s + h.marketValue, 0);
    const actualBondTotal = actualBonds.reduce((s, h) => s + h.marketValue, 0);
    const actualCash = holdings
      .filter(h => h.assetType === 'CASH')
      .reduce((s, h) => s + h.marketValue, 0);

    return {
      positions: positions.sort((a, b) => {
        const order = { missing: 0, underweight: 1, overweight: 2, match: 3, extra: 4 };
        return order[a.status] - order[b.status];
      }),
      stats: { match, overweight, underweight, missing, extra, adherence },
      allocation: {
        modelEquity: model.realEquityPct,
        modelBond: model.realBondPct,
        modelCash: model.realCashPct,
        actualEquity: totalValue > 0 ? Math.round((actualEquityTotal / totalValue) * 10000) / 100 : 0,
        actualBond: totalValue > 0 ? Math.round((actualBondTotal / totalValue) * 10000) / 100 : 0,
        actualCash: totalValue > 0 ? Math.round((actualCash / totalValue) * 10000) / 100 : 0,
      },
      modelBonds: model.bonds,
      actualBonds,
    };
  }, [model, holdings, totalValue]);

  const { positions, stats, allocation } = comparison;

  // Donnees bar chart allocation
  const allocChart = [
    { name: 'Actions', modele: allocation.modelEquity, actuel: allocation.actualEquity },
    { name: 'Obligations', modele: allocation.modelBond, actuel: allocation.actualBond },
    { name: 'Liquidites', modele: allocation.modelCash, actuel: allocation.actualCash },
  ];

  return (
    <div className="space-y-6">
      {/* ── Stats resume ── */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card padding="sm" className="text-center">
          <p className="text-2xl font-bold text-emerald-600">{stats.adherence}%</p>
          <p className="text-xs text-text-muted">Adherence</p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className="text-2xl font-semibold text-emerald-600">{stats.match}</p>
          <p className="text-xs text-text-muted">Conformes</p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className="text-2xl font-semibold text-amber-500">{stats.overweight}</p>
          <p className="text-xs text-text-muted">Surponderes</p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className="text-2xl font-semibold text-orange-500">{stats.underweight}</p>
          <p className="text-xs text-text-muted">Sous-ponderes</p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className="text-2xl font-semibold text-red-500">{stats.missing}</p>
          <p className="text-xs text-text-muted">Manquants</p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className="text-2xl font-semibold text-gray-400">{stats.extra}</p>
          <p className="text-xs text-text-muted">Hors modele</p>
        </Card>
      </div>

      {/* ── Allocation chart ── */}
      <Card>
        <h3 className="text-sm font-semibold text-text-main mb-4">Allocation globale : Modele vs Actuel</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={allocChart} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#586e82' }} />
            <YAxis tick={{ fontSize: 11, fill: '#586e82' }} tickFormatter={(v: number) => `${v}%`} />
            <Tooltip
              contentStyle={tooltipStyle}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, name: any) => [
                `${fmtDec(Number(value) || 0)}%`,
                name === 'modele' ? 'Modele' : 'Actuel',
              ]}
            />
            <Bar dataKey="modele" fill={BRAND} radius={[4, 4, 0, 0]} />
            <Bar dataKey="actuel" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-6 mt-2">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: BRAND }} /> Modele
          </div>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#6366f1' }} /> Actuel
          </div>
        </div>
      </Card>

      {/* ── Ecart par position (bar chart) ── */}
      {positions.filter(p => p.status !== 'extra').length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-text-main mb-4">Ecart de poids par position</h3>
          <ResponsiveContainer width="100%" height={Math.max(200, positions.filter(p => p.status !== 'extra').length * 28)}>
            <BarChart
              data={positions.filter(p => p.status !== 'extra').map(p => ({
                name: p.symbol,
                ecart: p.weightDiff,
              }))}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 60, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#586e82' }} tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v}%`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#586e82' }} width={55} />
              <Tooltip
                contentStyle={tooltipStyle}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [`${Number(value) > 0 ? '+' : ''}${fmtDec(Number(value))}%`, 'Ecart']}
              />
              <Bar dataKey="ecart" radius={[0, 4, 4, 0]}>
                {positions.filter(p => p.status !== 'extra').map((p, i) => (
                  <Cell
                    key={i}
                    fill={
                      p.status === 'missing' ? RED
                      : p.status === 'underweight' ? AMBER
                      : p.status === 'overweight' ? '#6366f1'
                      : GREEN
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* ── Tableau detail ── */}
      <Card padding="none">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-text-main">Detail des positions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-text-muted uppercase tracking-wider border-b border-gray-100">
                <th className="px-4 py-2.5 w-8"></th>
                <th className="px-3 py-2.5">Symbole</th>
                <th className="px-3 py-2.5">Nom</th>
                <th className="px-3 py-2.5 text-right">Qte Modele</th>
                <th className="px-3 py-2.5 text-right">Qte Actuel</th>
                <th className="px-3 py-2.5 text-right">Ecart Qte</th>
                <th className="px-3 py-2.5 text-right">Poids Modele</th>
                <th className="px-3 py-2.5 text-right">Poids Actuel</th>
                <th className="px-3 py-2.5 text-right">Ecart Poids</th>
                <th className="px-3 py-2.5 text-center">Statut</th>
              </tr>
            </thead>
            <tbody>
              {positions.map(p => (
                <tr key={p.symbol} className={`border-t border-gray-50 hover:bg-gray-50/50 ${
                  p.status === 'missing' ? 'bg-red-50/30' : p.status === 'extra' ? 'bg-gray-50/50' : ''
                }`}>
                  <td className="px-4 py-2">
                    <StatusIcon status={p.status} />
                  </td>
                  <td className="px-3 py-2 font-mono font-medium text-text-main">{p.symbol}</td>
                  <td className="px-3 py-2 text-text-muted max-w-[180px] truncate">{p.name}</td>
                  <td className="px-3 py-2 text-right font-mono">{p.modelQty || '—'}</td>
                  <td className="px-3 py-2 text-right font-mono">{p.actualQty || '—'}</td>
                  <td className={`px-3 py-2 text-right font-mono font-semibold ${
                    p.qtyDiff > 0 ? 'text-emerald-600' : p.qtyDiff < 0 ? 'text-red-500' : 'text-text-muted'
                  }`}>
                    {p.qtyDiff > 0 ? '+' : ''}{p.qtyDiff || '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-text-muted">{p.modelWeight ? `${fmtDec(p.modelWeight)}%` : '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-text-muted">{p.actualWeight ? `${fmtDec(p.actualWeight)}%` : '—'}</td>
                  <td className={`px-3 py-2 text-right font-mono font-semibold ${
                    p.weightDiff > 0.5 ? 'text-emerald-600' : p.weightDiff < -0.5 ? 'text-red-500' : 'text-text-muted'
                  }`}>
                    {p.weightDiff !== 0 ? `${p.weightDiff > 0 ? '+' : ''}${fmtDec(p.weightDiff)}%` : '—'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <StatusBadge status={p.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Transactions suggerees ── */}
      <SuggestedTransactions positions={positions} holdings={holdings} model={model} />
    </div>
  );
}

// ════════════════════════════════════════
// TRANSACTIONS SUGGEREES
// ════════════════════════════════════════

interface Transaction {
  action: 'BUY' | 'SELL';
  symbol: string;
  name: string;
  quantity: number;
  estimatedPrice: number;
  estimatedValue: number;
  reason: string;
}

function SuggestedTransactions({ positions, holdings, model }: {
  positions: ComparedPosition[];
  holdings: ParsedHolding[];
  model: GeneratedPortfolio;
}) {
  const { toast } = useToast();
  const [showSells, setShowSells] = useState(true);

  const transactions = useMemo(() => {
    const txs: Transaction[] = [];

    // Prix lookup depuis les holdings Croesus
    const holdingPrices = new Map<string, number>();
    for (const h of holdings) {
      if (h.marketPrice > 0) holdingPrices.set(h.symbol.toUpperCase(), h.marketPrice);
    }

    // Prix lookup depuis le modele
    const modelPrices = new Map<string, number>();
    for (const sec of model.sectors) {
      for (const s of sec.stocks) {
        modelPrices.set(s.symbol.toUpperCase(), s.price);
      }
    }

    for (const p of positions) {
      const sym = p.symbol.toUpperCase();
      const price = modelPrices.get(sym) || holdingPrices.get(sym) || 0;

      if (p.status === 'missing') {
        // Acheter la totalite
        txs.push({
          action: 'BUY',
          symbol: p.symbol,
          name: p.name,
          quantity: p.modelQty,
          estimatedPrice: price,
          estimatedValue: p.modelQty * price,
          reason: 'Position absente du portefeuille',
        });
      } else if (p.status === 'underweight' && p.qtyDiff < 0) {
        // Acheter la difference
        const qty = Math.abs(p.qtyDiff);
        txs.push({
          action: 'BUY',
          symbol: p.symbol,
          name: p.name,
          quantity: qty,
          estimatedPrice: price,
          estimatedValue: qty * price,
          reason: `Sous-pondere de ${fmtDec(Math.abs(p.weightDiff))}%`,
        });
      } else if (p.status === 'overweight' && p.qtyDiff > 0) {
        // Vendre l'exces
        const qty = p.qtyDiff;
        txs.push({
          action: 'SELL',
          symbol: p.symbol,
          name: p.name,
          quantity: qty,
          estimatedPrice: price,
          estimatedValue: qty * price,
          reason: `Surpondere de ${fmtDec(p.weightDiff)}%`,
        });
      } else if (p.status === 'extra') {
        // Vendre la totalite
        txs.push({
          action: 'SELL',
          symbol: p.symbol,
          name: p.name,
          quantity: p.actualQty,
          estimatedPrice: price,
          estimatedValue: p.actualQty * price,
          reason: 'Position hors modele',
        });
      }
    }

    return txs;
  }, [positions, holdings, model]);

  const buys = transactions.filter(t => t.action === 'BUY');
  const sells = transactions.filter(t => t.action === 'SELL');
  const totalBuys = buys.reduce((s, t) => s + t.estimatedValue, 0);
  const totalSells = sells.reduce((s, t) => s + t.estimatedValue, 0);
  const net = totalSells - totalBuys;

  const displayedTxs = showSells ? transactions : buys;

  // Copier au clipboard
  function handleCopy() {
    const lines = [
      'Action\tSymbole\tNom\tQuantite\tPrix est.\tValeur est.\tRaison',
      ...displayedTxs.map(t =>
        `${t.action}\t${t.symbol}\t${t.name}\t${t.quantity}\t${fmtDec(t.estimatedPrice)}\t${fmt(t.estimatedValue)}\t${t.reason}`
      ),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    toast('success', 'Transactions copiees au presse-papier');
  }

  if (transactions.length === 0) {
    return (
      <Card className="text-center py-8">
        <Check className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
        <h3 className="font-semibold text-text-main">Aucune transaction necessaire</h3>
        <p className="text-sm text-text-muted">Le portefeuille est conforme au modele.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-main">Transactions suggerees</h3>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={showSells}
              onChange={(e) => setShowSells(e.target.checked)}
              className="rounded border-gray-300"
            />
            Afficher les ventes
          </label>
          <Button variant="ghost" size="sm" onClick={handleCopy} icon={<Copy className="h-3.5 w-3.5" />}>
            Copier
          </Button>
        </div>
      </div>

      {/* Resume financier */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
            <ArrowRightLeft className="h-4 w-4 text-text-muted" />
            <span className="text-xs text-text-muted">Flux net</span>
          </div>
          <p className={`text-lg font-semibold ${net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {net >= 0 ? '+' : ''}{fmt(net)}
          </p>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart className="h-4 w-4 text-text-muted" />
            <span className="text-xs text-text-muted">Total transactions</span>
          </div>
          <p className="text-lg font-semibold text-text-main">{transactions.length}</p>
        </Card>
      </div>

      {/* Tableau transactions */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-text-muted uppercase tracking-wider border-b border-gray-100">
                <th className="px-4 py-2.5 w-20">Action</th>
                <th className="px-3 py-2.5">Symbole</th>
                <th className="px-3 py-2.5">Nom</th>
                <th className="px-3 py-2.5 text-right">Quantite</th>
                <th className="px-3 py-2.5 text-right">Prix est.</th>
                <th className="px-3 py-2.5 text-right">Valeur est.</th>
                <th className="px-3 py-2.5">Raison</th>
              </tr>
            </thead>
            <tbody>
              {displayedTxs.map((t, i) => (
                <tr key={`${t.symbol}-${i}`} className={`border-t border-gray-50 hover:bg-gray-50/50 ${
                  t.action === 'BUY' ? 'bg-emerald-50/20' : 'bg-red-50/20'
                }`}>
                  <td className="px-4 py-2.5">
                    <Badge variant={t.action === 'BUY' ? 'success' : 'danger'}>
                      {t.action === 'BUY' ? (
                        <span className="flex items-center gap-1"><ShoppingCart className="h-3 w-3" /> Achat</span>
                      ) : (
                        <span className="flex items-center gap-1"><Ban className="h-3 w-3" /> Vente</span>
                      )}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 font-mono font-medium text-text-main">{t.symbol}</td>
                  <td className="px-3 py-2.5 text-text-muted max-w-[160px] truncate">{t.name}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold">{t.quantity}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-text-muted">
                    {t.estimatedPrice > 0 ? `${fmtDec(t.estimatedPrice)}` : '—'}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-mono font-semibold ${
                    t.action === 'BUY' ? 'text-emerald-600' : 'text-red-500'
                  }`}>
                    {t.estimatedValue > 0 ? fmt(t.estimatedValue) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-text-muted text-xs">{t.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-text-light">
        Les prix estimes proviennent de Yahoo Finance et Croesus. Les quantites sont indicatives et doivent etre validees avant execution.
      </p>
    </div>
  );
}

// ── Composants utilitaires ──

function StatusIcon({ status }: { status: ComparedPosition['status'] }) {
  switch (status) {
    case 'match':
      return <Check className="h-4 w-4 text-emerald-500" />;
    case 'overweight':
      return <TrendingUp className="h-4 w-4 text-amber-500" />;
    case 'underweight':
      return <TrendingDown className="h-4 w-4 text-orange-500" />;
    case 'missing':
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case 'extra':
      return <Minus className="h-4 w-4 text-gray-400" />;
  }
}

function StatusBadge({ status }: { status: ComparedPosition['status'] }) {
  const map: Record<string, { variant: 'success' | 'warning' | 'danger' | 'default' | 'info'; label: string }> = {
    match: { variant: 'success', label: 'Conforme' },
    overweight: { variant: 'warning', label: 'Surpondere' },
    underweight: { variant: 'warning', label: 'Sous-pondere' },
    missing: { variant: 'danger', label: 'Manquant' },
    extra: { variant: 'default', label: 'Hors modele' },
  };
  const m = map[status];
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
