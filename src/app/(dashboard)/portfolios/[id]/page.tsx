'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { CurrencyToggle } from '@/components/ui/CurrencyToggle';
import { Spinner } from '@/components/ui/Spinner';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { usePortfolio } from '@/lib/hooks/usePortfolio';
import { formatCurrency, formatPercent } from '@/lib/utils/format';
import { BarChart3, GitCompare, FileText, Plus } from 'lucide-react';

const tabs = [
  { id: 'holdings', label: 'Positions' },
  { id: 'performance', label: 'Performance' },
  { id: 'analysis', label: 'Analyse' },
];

export default function PortfolioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { portfolio, holdings, isLoading } = usePortfolio(id);
  const [currency, setCurrency] = useState<'CAD' | 'USD'>('CAD');

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
                    <Button variant="ghost" size="sm" icon={<Plus className="h-4 w-4" />}>Ajouter</Button>
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
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {holdings.map((h) => (
                          <TableRow key={h.id}>
                            <TableCell className="font-semibold">{h.symbol}</TableCell>
                            <TableCell className="text-text-muted">{h.name}</TableCell>
                            <TableCell className="text-right">{h.quantity}</TableCell>
                            <TableCell className="text-right">{formatCurrency(h.average_cost, currency)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(h.current_price || 0, currency)}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(h.market_value || 0, currency)}</TableCell>
                            <TableCell className={`text-right font-semibold ${(h.gain_loss || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {formatPercent(h.gain_loss_pct || 0)}
                            </TableCell>
                            <TableCell className="text-right">{(h.weight || 0).toFixed(1)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}
              {activeTab === 'performance' && (
                <div className="text-center py-12">
                  <BarChart3 className="h-12 w-12 text-text-light mx-auto mb-3" />
                  <p className="text-text-muted">Les graphiques de performance apparaîtront ici.</p>
                  <Link href={`/portfolios/${id}/compare`}>
                    <Button variant="outline" size="sm" className="mt-3">Voir la comparaison</Button>
                  </Link>
                </div>
              )}
              {activeTab === 'analysis' && (
                <div className="text-center py-12">
                  <p className="text-text-muted">L&apos;analyse détaillée (cibles, risque, scénarios) apparaîtra ici.</p>
                  <Link href={`/portfolios/${id}/simulation`}>
                    <Button variant="outline" size="sm" className="mt-3">Lancer une simulation</Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </Tabs>
      </Card>
    </div>
  );
}
