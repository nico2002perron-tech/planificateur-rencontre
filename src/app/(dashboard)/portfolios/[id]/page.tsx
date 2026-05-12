'use client';

import { use, useState, useMemo } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { CurrencyToggle } from '@/components/ui/CurrencyToggle';
import { Spinner } from '@/components/ui/Spinner';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { usePortfolio } from '@/lib/hooks/usePortfolio';
import { useSymbolsNews } from '@/lib/hooks/useNews';
import { useSymbolLogos } from '@/lib/hooks/useLogos';
import { formatCurrency, formatPercent } from '@/lib/utils/format';
import { AdvancedChart } from '@/components/tradingview/AdvancedChart';
import { TechnicalAnalysis } from '@/components/tradingview/TechnicalAnalysis';
import { FundamentalData } from '@/components/tradingview/FundamentalData';
import { SymbolInfo } from '@/components/tradingview/SymbolInfo';
import { NewsBadge } from '@/components/portfolios/NewsBadge';
import { NewsModal } from '@/components/portfolios/NewsModal';
import { GitCompare, FileText, Plus, Trash2 } from 'lucide-react';

const tabs = [
  { id: 'holdings', label: 'Positions' },
  { id: 'performance', label: 'Performance' },
  { id: 'analysis', label: 'Analyse' },
];

function toTVSymbol(symbol: string): string {
  if (!symbol) return 'TSX:RY';
  if (symbol.includes(':')) return symbol;
  if (symbol.endsWith('.TO')) return `TSX:${symbol.replace('.TO', '')}`;
  if (symbol.endsWith('.V')) return `TSXV:${symbol.replace('.V', '')}`;
  return symbol;
}

export default function PortfolioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { portfolio, holdings, isLoading, mutate } = usePortfolio(id);
  const [currency, setCurrency] = useState<'CAD' | 'USD'>('CAD');

  // News system
  const symbols = useMemo(() => (holdings || []).map((h) => h.symbol), [holdings]);
  const { newsMap } = useSymbolsNews(symbols);
  const { logos } = useSymbolLogos(symbols);
  const [newsModalSymbol, setNewsModalSymbol] = useState<string | null>(null);
  const selectedNews = newsModalSymbol ? newsMap[newsModalSymbol] : null;

  // Add holding modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ symbol: '', name: '', quantity: '', average_cost: '', asset_class: 'EQUITY', sector: '', region: 'CA' });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  async function handleAddHolding(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.symbol || !addForm.quantity || !addForm.average_cost) {
      setAddError('Symbole, quantité et coût moyen requis');
      return;
    }
    setAddLoading(true);
    setAddError('');
    try {
      const res = await fetch(`/api/portfolios/${id}/holdings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: addForm.symbol.toUpperCase().trim(),
          name: addForm.name.trim() || addForm.symbol.toUpperCase().trim(),
          quantity: parseFloat(addForm.quantity),
          average_cost: parseFloat(addForm.average_cost),
          asset_class: addForm.asset_class || null,
          sector: addForm.sector || null,
          region: addForm.region || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur lors de l\'ajout');
      }
      setShowAddModal(false);
      setAddForm({ symbol: '', name: '', quantity: '', average_cost: '', asset_class: 'EQUITY', sector: '', region: 'CA' });
      mutate();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setAddLoading(false);
    }
  }

  async function handleDeleteHolding(holdingId: string, symbol: string) {
    if (!confirm(`Supprimer ${symbol} du portefeuille ?`)) return;
    try {
      await fetch(`/api/portfolios/${id}/holdings`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holding_id: holdingId }),
      });
      mutate();
    } catch {
      // silent
    }
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!portfolio) return <p className="text-text-muted p-6">Portefeuille introuvable</p>;

  return (
    <div>
      <PageHeader
        title={portfolio.name}
        description={`${portfolio.account_type} — ${portfolio.client_name}`}
        action={
          <div className="flex items-center gap-3">
            <CurrencyToggle value={currency} onChange={setCurrency} />
            <Link href={`/portfolios/${id}/compare`}>
              <Button variant="outline" icon={<GitCompare className="h-4 w-4" />}>Comparer</Button>
            </Link>
            <Link href={`/reports/new?portfolio=${id}`}>
              <Button icon={<FileText className="h-4 w-4" />}>Rapport</Button>
            </Link>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <p className="text-sm text-text-muted">Valeur totale</p>
          <p className="text-2xl font-bold">{formatCurrency(portfolio.total_value || 0, currency)}</p>
        </Card>
        <Card>
          <p className="text-sm text-text-muted">Rendement YTD</p>
          <p className="text-2xl font-bold text-emerald-600">{formatPercent(portfolio.ytd_return || 0)}</p>
        </Card>
        <Card>
          <p className="text-sm text-text-muted">Positions</p>
          <p className="text-2xl font-bold">{holdings?.length || 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-text-muted">Devise</p>
          <p className="text-2xl font-bold">{portfolio.currency}</p>
        </Card>
      </div>

      <Card padding="none">
        <Tabs tabs={tabs}>
          {(activeTab) => (
            <div className="p-6">
              {activeTab === 'holdings' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold">Positions</h3>
                    <Button variant="ghost" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setShowAddModal(true)}>Ajouter</Button>
                  </div>
                  {!holdings || holdings.length === 0 ? (
                    <p className="text-sm text-text-muted text-center py-8">Aucune position. Ajoutez des titres à ce portefeuille.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Symbole</TableHead>
                          <TableHead>Nom</TableHead>
                          <TableHead className="text-right">Quantité</TableHead>
                          <TableHead className="text-right">Coût moyen</TableHead>
                          <TableHead className="text-right">Prix actuel</TableHead>
                          <TableHead className="text-right">Valeur</TableHead>
                          <TableHead className="text-right">Gain/Perte</TableHead>
                          <TableHead className="text-right">Poids</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {holdings.map((h) => (
                          <TableRow key={h.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {logos[h.symbol] ? (
                                  <img
                                    src={logos[h.symbol]!}
                                    alt=""
                                    className="h-7 w-7 rounded-full object-contain bg-white border border-gray-100 shrink-0"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                  />
                                ) : (
                                  <span className="flex items-center justify-center h-7 w-7 rounded-full bg-gray-100 text-[10px] font-bold text-text-muted shrink-0">
                                    {h.symbol.replace(/\.(TO|V|NE)$/, '').slice(0, 2)}
                                  </span>
                                )}
                                <span className="font-semibold">{h.symbol}</span>
                                <NewsBadge
                                  symbolNews={newsMap[h.symbol]}
                                  onClick={() => setNewsModalSymbol(h.symbol)}
                                />
                              </div>
                            </TableCell>
                            <TableCell className="text-text-muted">{h.name}</TableCell>
                            <TableCell className="text-right">{h.quantity}</TableCell>
                            <TableCell className="text-right">{formatCurrency(h.average_cost, currency)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(h.current_price || 0, currency)}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(h.market_value || 0, currency)}</TableCell>
                            <TableCell className={`text-right font-semibold ${(h.gain_loss || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {formatPercent(h.gain_loss_pct || 0)}
                            </TableCell>
                            <TableCell className="text-right">{(h.weight || 0).toFixed(1)}%</TableCell>
                            <TableCell>
                              <button
                                onClick={() => handleDeleteHolding(h.id, h.symbol)}
                                className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                title="Supprimer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}
              {activeTab === 'performance' && (
                <div className="space-y-6">
                  {holdings && holdings.length > 0 ? (
                    <>
                      <div>
                        <h3 className="font-semibold mb-3">Graphique — {holdings[0]?.symbol}</h3>
                        <div className="rounded-xl overflow-hidden border border-gray-100" style={{ height: 450 }}>
                          <AdvancedChart
                            symbol={toTVSymbol(holdings[0]?.symbol)}
                            height={450}
                          />
                        </div>
                      </div>
                      {holdings.length > 1 && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {holdings.slice(1, 5).map((h) => (
                            <div key={h.id} className="border border-gray-100 rounded-xl overflow-hidden">
                              <SymbolInfo symbol={toTVSymbol(h.symbol)} />
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-text-muted text-center py-8">Ajoutez des positions pour voir la performance.</p>
                  )}
                  <div className="flex justify-center">
                    <Link href={`/portfolios/${id}/compare`}>
                      <Button variant="outline" size="sm">Comparer avec un indice</Button>
                    </Link>
                  </div>
                </div>
              )}
              {activeTab === 'analysis' && (
                <div className="space-y-6">
                  {holdings && holdings.length > 0 ? (
                    <>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div>
                          <h3 className="font-semibold mb-3">Analyse technique — {holdings[0]?.symbol}</h3>
                          <div className="rounded-xl overflow-hidden border border-gray-100">
                            <TechnicalAnalysis symbol={toTVSymbol(holdings[0]?.symbol)} height={425} />
                          </div>
                        </div>
                        <div>
                          <h3 className="font-semibold mb-3">Données fondamentales — {holdings[0]?.symbol}</h3>
                          <div className="rounded-xl overflow-hidden border border-gray-100">
                            <FundamentalData symbol={toTVSymbol(holdings[0]?.symbol)} height={425} />
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-text-muted text-center py-8">Ajoutez des positions pour voir l&apos;analyse.</p>
                  )}
                  <div className="flex justify-center">
                    <Link href={`/portfolios/${id}/simulation`}>
                      <Button variant="outline" size="sm">Lancer une simulation</Button>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </Tabs>
      </Card>

      {/* News Modal */}
      <NewsModal
        open={!!newsModalSymbol}
        onClose={() => setNewsModalSymbol(null)}
        symbol={newsModalSymbol || ''}
        articles={selectedNews?.articles || []}
      />

      {/* Add Holding Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Ajouter un titre">
        <form onSubmit={handleAddHolding} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Symbole"
              placeholder="ex: RY.TO"
              value={addForm.symbol}
              onChange={(e) => setAddForm(f => ({ ...f, symbol: e.target.value }))}
              required
            />
            <Input
              label="Nom"
              placeholder="ex: Banque Royale"
              value={addForm.name}
              onChange={(e) => setAddForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Quantité"
              type="number"
              step="any"
              placeholder="100"
              value={addForm.quantity}
              onChange={(e) => setAddForm(f => ({ ...f, quantity: e.target.value }))}
              required
            />
            <Input
              label="Coût moyen ($)"
              type="number"
              step="0.01"
              placeholder="50.00"
              value={addForm.average_cost}
              onChange={(e) => setAddForm(f => ({ ...f, average_cost: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-text-main">Classe d&apos;actif</label>
              <select
                className="w-full px-4 py-2.5 rounded-[var(--radius-sm)] border border-gray-200 bg-white text-sm"
                value={addForm.asset_class}
                onChange={(e) => setAddForm(f => ({ ...f, asset_class: e.target.value }))}
              >
                <option value="EQUITY">Actions</option>
                <option value="FIXED_INCOME">Revenu fixe</option>
                <option value="CASH">Liquidités</option>
                <option value="ALTERNATIVE">Alternatifs</option>
                <option value="REAL_ESTATE">Immobilier</option>
              </select>
            </div>
            <Input
              label="Secteur"
              placeholder="Technology"
              value={addForm.sector}
              onChange={(e) => setAddForm(f => ({ ...f, sector: e.target.value }))}
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-text-main">Région</label>
              <select
                className="w-full px-4 py-2.5 rounded-[var(--radius-sm)] border border-gray-200 bg-white text-sm"
                value={addForm.region}
                onChange={(e) => setAddForm(f => ({ ...f, region: e.target.value }))}
              >
                <option value="CA">Canada</option>
                <option value="US">États-Unis</option>
                <option value="INTL">International</option>
                <option value="EM">Marchés émergents</option>
              </select>
            </div>
          </div>
          {addError && <p className="text-sm text-red-500">{addError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>Annuler</Button>
            <Button type="submit" disabled={addLoading}>
              {addLoading ? 'Ajout...' : 'Ajouter'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
