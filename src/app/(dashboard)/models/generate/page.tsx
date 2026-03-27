'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useInvestmentProfiles } from '@/lib/hooks/useInvestmentProfiles';
import { Modal } from '@/components/ui/Modal';
import {
  ArrowLeft, Zap, Download, Save, ChevronDown, ChevronRight,
  DollarSign, TrendingUp, Percent, BarChart3,
} from 'lucide-react';

// ── Types (miroir du backend) ──

interface GeneratedStock {
  symbol: string;
  name: string;
  sector: string;
  stock_type: 'obligatoire' | 'variable';
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
  stats: {
    nbStocks: number;
    nbBonds: number;
    nbSectors: number;
    avgDividendYield: number;
    avgBondYield: number;
    estimatedAnnualIncome: number;
  };
  generatedAt: string;
}

// ── Constantes ──

const BRAND = '#00b4d8';
const DARK = '#03045e';
const COLORS = [BRAND, '#0077b6', DARK, '#f4a261', '#2ecc71', '#e63946', '#8b5cf6', '#14b8a6', '#f59e0b', '#6366f1', '#ec4899', '#84cc16'];

const tooltipStyle = {
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  fontSize: 12,
};

function fmt(n: number) {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function fmtDec(n: number, dec = 2) {
  return new Intl.NumberFormat('fr-CA', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
}

// ════════════════════════════════════════
// PAGE PRINCIPALE
// ════════════════════════════════════════

export default function GeneratePage() {
  const { profiles, isLoading: profilesLoading } = useInvestmentProfiles();
  const { toast } = useToast();

  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [portfolioValue, setPortfolioValue] = useState(100000);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<GeneratedPortfolio | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [modelName, setModelName] = useState('');

  const handleGenerate = useCallback(async () => {
    if (!selectedProfileId) {
      toast('warning', 'Selectionnez un profil');
      return;
    }
    if (portfolioValue < 10000) {
      toast('warning', 'Valeur minimum : 10 000 $');
      return;
    }

    setGenerating(true);
    setResult(null);
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
        throw new Error(err.error || 'Erreur de generation');
      }
      const data = await res.json();
      setResult(data.portfolio);
      toast('success', 'Portefeuille genere');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Erreur');
    } finally {
      setGenerating(false);
    }
  }, [selectedProfileId, portfolioValue, toast]);

  const handleSaveAsModel = useCallback(async () => {
    if (!result || !modelName.trim()) return;
    setSaving(true);
    try {
      // Map generated stocks to model holdings format
      const allStocks = result.sectors.flatMap(s => s.stocks);
      const totalValue = result.totalStockValue + result.totalBondValue + result.cashRemaining;
      const holdings = allStocks.map(s => ({
        symbol: s.symbol,
        name: s.name,
        weight: Math.round((s.realValue / totalValue) * 10000) / 100,
        asset_class: 'EQUITY' as const,
        region: s.symbol.endsWith('.TO') || s.symbol.endsWith('.V') ? 'CA' : 'US',
      }));

      // Risk level from profile
      const profile = profiles.find(p => p.id === selectedProfileId);
      const riskMap: Record<number, string> = { 1: 'CONSERVATEUR', 2: 'CONSERVATEUR', 3: 'MODERE', 4: 'EQUILIBRE', 5: 'CROISSANCE', 6: 'DYNAMIQUE' };
      const riskLevel = profile ? (riskMap[profile.profile_number] || 'EQUILIBRE') : 'EQUILIBRE';

      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: modelName.trim(),
          description: `Profil ${result.profileNumber} — ${result.profileName} (${result.equityPct}/${result.bondPct}) — ${fmt(result.portfolioValue)}`,
          risk_level: riskLevel,
          holdings,
        }),
      });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      toast('success', 'Modele sauvegarde');
      setSaveModalOpen(false);
      setModelName('');
      // Redirect to model detail
      window.location.href = `/models/${saved.id}`;
    } catch {
      toast('error', 'Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  }, [result, modelName, selectedProfileId, profiles, toast]);

  if (profilesLoading) {
    return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  }

  return (
    <div>
      <PageHeader
        title="Generateur de portefeuille"
        description="Construisez un portefeuille modele en temps reel selon le profil d'investissement"
        action={
          <Link href="/models">
            <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />}>Retour</Button>
          </Link>
        }
      />

      {/* ── Parametres ── */}
      <Card className="mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          {/* Profil */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-text-main mb-1">Profil d'investissement</label>
            <select
              value={selectedProfileId}
              onChange={(e) => { setSelectedProfileId(e.target.value); setResult(null); }}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
            >
              <option value="">-- Selectionnez un profil --</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>
                  {p.profile_number}. {p.name} ({p.equity_pct}/{p.bond_pct})
                </option>
              ))}
            </select>
          </div>

          {/* Valeur */}
          <div className="w-full md:w-56">
            <label className="block text-sm font-medium text-text-main mb-1">Valeur du portefeuille ($)</label>
            <input
              type="number"
              min={10000}
              step={5000}
              value={portfolioValue}
              onChange={(e) => { setPortfolioValue(parseInt(e.target.value) || 0); setResult(null); }}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
            />
          </div>

          {/* Bouton */}
          <Button
            size="lg"
            loading={generating}
            onClick={handleGenerate}
            icon={<Zap className="h-4 w-4" />}
          >
            Generer
          </Button>
        </div>

        {/* Presets rapides */}
        <div className="flex gap-2 mt-3 flex-wrap">
          {[50000, 100000, 250000, 500000, 1000000].map(v => (
            <button
              key={v}
              onClick={() => { setPortfolioValue(v); setResult(null); }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                portfolioValue === v
                  ? 'bg-brand-primary text-white'
                  : 'bg-gray-100 text-text-muted hover:bg-gray-200'
              }`}
            >
              {fmt(v)}
            </button>
          ))}
        </div>
      </Card>

      {/* ── Resultat ── */}
      {generating && (
        <div className="flex flex-col items-center justify-center py-20">
          <Spinner size="lg" />
          <p className="text-sm text-text-muted mt-4">Recuperation des prix et generation en cours...</p>
        </div>
      )}

      {result && !generating && (
        <PortfolioPreview
          portfolio={result}
          onSave={() => {
            setModelName(`${result.profileName} — ${new Date().toLocaleDateString('fr-CA')}`);
            setSaveModalOpen(true);
          }}
          saving={false}
        />
      )}

      {/* Modal de sauvegarde */}
      <Modal open={saveModalOpen} onClose={() => setSaveModalOpen(false)} title="Sauvegarder comme modele" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Nom du modele</label>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="Ex: Croissance Q1 2026"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && modelName.trim()) handleSaveAsModel(); }}
            />
          </div>
          {result && (
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-text-muted space-y-1">
              <p>Profil {result.profileNumber} — {result.profileName}</p>
              <p>{result.stats.nbStocks} actions, {result.stats.nbBonds} obligations</p>
              <p>Valeur: {fmt(result.portfolioValue)}</p>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setSaveModalOpen(false)}>Annuler</Button>
            <Button loading={saving} disabled={!modelName.trim()} onClick={handleSaveAsModel} icon={<Save className="h-4 w-4" />}>
              Sauvegarder
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ════════════════════════════════════════
// PREVIEW DU PORTEFEUILLE
// ════════════════════════════════════════

function PortfolioPreview({ portfolio: p, onSave, saving }: {
  portfolio: GeneratedPortfolio;
  onSave: () => void;
  saving: boolean;
}) {
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(
    new Set(p.sectors.map(s => s.sector))
  );

  function toggleSector(sector: string) {
    setExpandedSectors(prev => {
      const next = new Set(prev);
      if (next.has(sector)) next.delete(sector);
      else next.add(sector);
      return next;
    });
  }

  // Données pour les charts
  const allocationData = [
    { name: 'Actions', value: p.totalStockValue, color: BRAND },
    { name: 'Obligations', value: p.totalBondValue, color: '#f4a261' },
    ...(p.cashRemaining > 0 ? [{ name: 'Liquidites', value: p.cashRemaining, color: '#e5e7eb' }] : []),
  ];

  const sectorChartData = p.sectors
    .filter(s => s.stocks.length > 0)
    .map(s => ({
      name: s.sectorLabel.length > 12 ? s.sectorLabel.slice(0, 12) + '.' : s.sectorLabel,
      fullName: s.sectorLabel,
      cible: s.targetWeight,
      reel: s.realWeight,
    }));

  return (
    <div className="space-y-6">
      {/* ── En-tete + Actions ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-text-main">
            Profil {p.profileNumber} — {p.profileName}
          </h2>
          <p className="text-sm text-text-muted">
            {p.equityPct}% actions / {p.bondPct}% obligations — {fmt(p.portfolioValue)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" loading={saving} onClick={onSave} icon={<Save className="h-3.5 w-3.5" />}>
            Sauvegarder
          </Button>
          <Button variant="ghost" size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={() => {
            const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `portefeuille-${p.profileName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}>
            Exporter JSON
          </Button>
        </div>
      </div>

      {/* ── Cartes resume ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Actions"
          value={fmt(p.totalStockValue)}
          sub={`${p.realEquityPct}% reel`}
          color="text-brand-primary"
        />
        <StatCard
          icon={<BarChart3 className="h-5 w-5" />}
          label="Obligations"
          value={fmt(p.totalBondValue)}
          sub={`${p.realBondPct}% reel`}
          color="text-amber-500"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Revenu annuel est."
          value={fmt(p.stats.estimatedAnnualIncome)}
          sub={`${fmtDec(p.stats.estimatedAnnualIncome / p.portfolioValue * 100)}% du ptf`}
          color="text-emerald-600"
        />
        <StatCard
          icon={<Percent className="h-5 w-5" />}
          label="Liquidites"
          value={fmt(p.cashRemaining)}
          sub={`${p.realCashPct}% restant`}
          color="text-gray-500"
        />
      </div>

      {/* ── Stats secondaires ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Titres', value: String(p.stats.nbStocks) },
          { label: 'Obligations', value: String(p.stats.nbBonds) },
          { label: 'Secteurs', value: String(p.stats.nbSectors) },
          { label: 'Div. moy.', value: `${fmtDec(p.stats.avgDividendYield)}%` },
          { label: 'Yield obl. moy.', value: `${fmtDec(p.stats.avgBondYield)}%` },
        ].map(s => (
          <Card key={s.label} padding="sm" className="text-center">
            <p className="text-xl font-semibold text-text-main">{s.value}</p>
            <p className="text-xs text-text-muted">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Allocation Pie */}
        <Card>
          <h3 className="text-sm font-semibold text-text-main mb-4">Repartition globale</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={allocationData}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
              >
                {allocationData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, _: any, entry: any) => [
                  `${fmt(Number(value) || 0)} (${fmtDec((Number(value) || 0) / p.portfolioValue * 100)}%)`,
                  entry?.payload?.name ?? '',
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-2">
            {allocationData.map(d => (
              <div key={d.name} className="flex items-center gap-2 text-xs text-text-muted">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                {d.name}
              </div>
            ))}
          </div>
        </Card>

        {/* Secteurs Bar */}
        <Card>
          <h3 className="text-sm font-semibold text-text-main mb-4">Poids par secteur (cible vs reel)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={sectorChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#586e82' }} interval={0} angle={-25} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11, fill: '#586e82' }} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip
                contentStyle={tooltipStyle}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, name: any) => [
                  `${fmtDec(Number(value) || 0)}%`,
                  name === 'cible' ? 'Cible' : 'Reel',
                ]}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                labelFormatter={(label: any, payload: any) =>
                  payload?.[0]?.payload?.fullName || label
                }
              />
              <Bar dataKey="cible" fill={BRAND} radius={[4, 4, 0, 0]} opacity={0.4} />
              <Bar dataKey="reel" fill={BRAND} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-2">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: BRAND, opacity: 0.4 }} />
              Cible
            </div>
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: BRAND }} />
              Reel
            </div>
          </div>
        </Card>
      </div>

      {/* ── Detail Actions par secteur ── */}
      <div>
        <h3 className="text-sm font-semibold text-text-main mb-3">Detail des actions</h3>
        <div className="space-y-2">
          {p.sectors.filter(s => s.stocks.length > 0).map((sec, si) => {
            const isExpanded = expandedSectors.has(sec.sector);
            return (
              <Card key={sec.sector} padding="none">
                <button
                  onClick={() => toggleSector(sec.sector)}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4 text-text-muted" />
                      : <ChevronRight className="h-4 w-4 text-text-muted" />
                    }
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[si % COLORS.length] }} />
                    <span className="font-semibold text-sm text-text-main">{sec.sectorLabel}</span>
                    <Badge variant="outline">{sec.stocks.length} titre{sec.stocks.length > 1 ? 's' : ''}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-text-muted">
                    <span>{fmt(sec.totalValue)}</span>
                    <Badge variant={Math.abs(sec.realWeight - sec.targetWeight) < 1 ? 'success' : 'warning'}>
                      {fmtDec(sec.realWeight)}%
                    </Badge>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-text-muted uppercase tracking-wider">
                          <th className="px-5 py-2">Symbole</th>
                          <th className="px-3 py-2">Nom</th>
                          <th className="px-3 py-2 text-center">Type</th>
                          <th className="px-3 py-2 text-right">Prix</th>
                          <th className="px-3 py-2 text-right">Qte</th>
                          <th className="px-3 py-2 text-right">Valeur</th>
                          <th className="px-3 py-2 text-right">Poids</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sec.stocks.map(stock => (
                          <tr key={stock.symbol} className="border-t border-gray-50 hover:bg-gray-50/50">
                            <td className="px-5 py-2 font-mono font-medium text-text-main">{stock.symbol}</td>
                            <td className="px-3 py-2 text-text-muted">{stock.name}</td>
                            <td className="px-3 py-2 text-center">
                              <Badge variant={stock.stock_type === 'obligatoire' ? 'info' : 'default'}>
                                {stock.stock_type === 'obligatoire' ? 'Oblig.' : 'Var.'}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-right font-mono">{fmtDec(stock.price)}</td>
                            <td className="px-3 py-2 text-right font-mono font-semibold">{stock.quantity}</td>
                            <td className="px-3 py-2 text-right font-mono">{fmt(stock.realValue)}</td>
                            <td className="px-3 py-2 text-right font-mono text-text-muted">{fmtDec(stock.realWeight)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── Detail Obligations ── */}
      {p.bonds.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text-main mb-3">
            Detail des obligations ({p.bonds.length})
          </h3>
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-text-muted uppercase tracking-wider border-b border-gray-100">
                    <th className="px-4 py-2.5">Emetteur</th>
                    <th className="px-3 py-2.5">CUSIP</th>
                    <th className="px-3 py-2.5 text-right">Coupon</th>
                    <th className="px-3 py-2.5">Echeance</th>
                    <th className="px-3 py-2.5 text-right">Prix</th>
                    <th className="px-3 py-2.5 text-right">Yield</th>
                    <th className="px-3 py-2.5 text-right">Qte</th>
                    <th className="px-3 py-2.5 text-right">Valeur</th>
                    <th className="px-3 py-2.5 text-right">Poids</th>
                    <th className="px-3 py-2.5">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {p.bonds.map((bond, i) => (
                    <tr key={i} className="border-t border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-2 text-text-main max-w-[180px] truncate" title={bond.issuer || bond.description}>
                        <div className="flex items-center gap-2">
                          {bond.is_mandatory && <span className="w-1.5 h-1.5 rounded-full bg-brand-primary shrink-0" title="Obligatoire" />}
                          {bond.issuer || bond.description}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-text-muted text-xs">{bond.cusip || '—'}</td>
                      <td className="px-3 py-2 text-right font-mono">{bond.coupon != null ? `${fmtDec(bond.coupon)}%` : '—'}</td>
                      <td className="px-3 py-2 text-text-muted">
                        {bond.maturity ? new Date(bond.maturity).toLocaleDateString('fr-CA') : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{fmtDec(bond.price)}</td>
                      <td className="px-3 py-2 text-right font-mono">{bond.yieldPct != null ? `${fmtDec(bond.yieldPct)}%` : '—'}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">{bond.quantity}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(bond.realValue)}</td>
                      <td className="px-3 py-2 text-right font-mono text-text-muted">{fmtDec(bond.realWeight)}%</td>
                      <td className="px-3 py-2">
                        <Badge variant={bond.source === 'CAD' ? 'info' : bond.source === 'US' ? 'warning' : 'default'}>
                          {bond.source}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── Timestamp ── */}
      <p className="text-xs text-text-light text-right">
        Genere le {new Date(p.generatedAt).toLocaleString('fr-CA')}
      </p>
    </div>
  );
}

// ── Composant carte stat ──

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <Card className="flex items-start gap-3">
      <div className={`p-2 rounded-lg bg-gray-50 ${color}`}>{icon}</div>
      <div>
        <p className="text-xs text-text-muted">{label}</p>
        <p className="text-lg font-semibold text-text-main leading-tight">{value}</p>
        <p className="text-xs text-text-muted mt-0.5">{sub}</p>
      </div>
    </Card>
  );
}
