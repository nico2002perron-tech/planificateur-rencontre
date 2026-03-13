'use client';

import { useState, useMemo, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useModel } from '@/lib/hooks/useModels';
import { useClients } from '@/lib/hooks/useClients';
import { ACCOUNT_TYPES } from '@/lib/utils/constants';
import { ArrowLeft, Rocket, DollarSign, Wifi, AlertCircle } from 'lucide-react';

const currencies = [
  { value: 'CAD', label: 'CAD — Dollar canadien' },
  { value: 'USD', label: 'USD — Dollar américain' },
];

function formatCurrency(value: number, curr = 'CAD'): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: curr }).format(value);
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface YahooPrice {
  symbol: string;
  price: number;
  currency: string;
  name: string;
}

function useYahooPrices(symbols: string[]) {
  const key = symbols.length > 0
    ? `/api/prices?symbols=${symbols.join(',')}`
    : null;

  const { data, isLoading } = useSWR<YahooPrice[]>(key, fetcher, {
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
  });

  const pricesMap = new Map<string, YahooPrice>();
  if (Array.isArray(data)) {
    data.forEach(p => { if (p.price > 0) pricesMap.set(p.symbol, p); });
  }

  return { prices: pricesMap, isLoading };
}

export default function ApplyModelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const { model, isLoading: modelLoading } = useModel(id);
  const { clients, isLoading: clientsLoading } = useClients();

  const [clientId, setClientId] = useState('');
  const [portfolioName, setPortfolioName] = useState('');
  const [accountType, setAccountType] = useState('NON_ENREGISTRE');
  const [currency, setCurrency] = useState('CAD');
  const [totalInvestment, setTotalInvestment] = useState<number>(100000);
  const [manualPrices, setManualPrices] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const symbols = useMemo(() => model?.holdings?.map(h => h.symbol) || [], [model]);
  const { prices: yahooPrices, isLoading: pricesLoading } = useYahooPrices(symbols);

  // Effective price: Yahoo first, then manual override
  function getPrice(symbol: string): { price: number; source: 'yahoo' | 'manual' } {
    if (manualPrices[symbol] !== undefined) return { price: manualPrices[symbol], source: 'manual' };
    const yp = yahooPrices.get(symbol);
    if (yp && yp.price > 0) return { price: yp.price, source: 'yahoo' };
    return { price: 0, source: 'manual' };
  }

  const yahooCount = symbols.filter(s => yahooPrices.has(s)).length;

  const preview = useMemo(() => {
    if (!model?.holdings) return [];
    return model.holdings.map((h, i) => {
      const { price, source } = getPrice(h.symbol);
      const allocated = (totalInvestment * h.weight) / 100;
      const quantity = price > 0 ? allocated / price : 0;
      return { index: i + 1, symbol: h.symbol, name: h.name, weight: h.weight, price, source, allocated, quantity };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, yahooPrices, manualPrices, totalInvestment]);

  async function handleSubmit() {
    if (!clientId) { toast('warning', 'Sélectionnez un client'); return; }
    if (!portfolioName.trim()) { toast('warning', 'Entrez un nom de portefeuille'); return; }
    if (totalInvestment <= 0) { toast('warning', 'Le montant doit être > 0'); return; }

    // Check all prices are set
    const missing = preview.filter(p => p.price <= 0);
    if (missing.length > 0) {
      toast('error', `Prix manquant: ${missing.map(p => p.symbol).join(', ')}`);
      return;
    }

    setSubmitting(true);
    try {
      const priceMap: Record<string, number> = {};
      preview.forEach(p => { priceMap[p.symbol] = p.price; });

      const res = await fetch(`/api/models/${id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          portfolio_name: portfolioName,
          account_type: accountType,
          currency,
          total_investment: totalInvestment,
          prices: priceMap,
        }),
      });

      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
      const data = await res.json();
      toast('success', `Portefeuille créé avec ${data.holdings_created} positions`);
      router.push(`/portfolios/${data.portfolio.id}`);
    } catch (err) {
      toast('error', err instanceof Error ? err.message : "Erreur lors de l'application");
    } finally {
      setSubmitting(false);
    }
  }

  if (modelLoading || clientsLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (!model) return <Card className="text-center py-16"><p className="text-text-muted">Modèle introuvable</p></Card>;

  const clientOptions = (clients || []).map(c => ({ value: c.id, label: `${c.first_name} ${c.last_name}` }));

  return (
    <div>
      <PageHeader
        title={`Appliquer: ${model.name}`}
        description="Créer un portefeuille client à partir de ce modèle"
        action={
          <Button variant="ghost" onClick={() => router.push(`/models/${id}`)} icon={<ArrowLeft className="h-4 w-4" />}>
            Retour au modèle
          </Button>
        }
      />

      <div className="space-y-6 max-w-4xl">
        {/* Configuration */}
        <Card>
          <h3 className="font-semibold text-text-main mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-brand-primary" />
            Configuration du portefeuille
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="Client" options={[{ value: '', label: 'Sélectionner un client...' }, ...clientOptions]} value={clientId} onChange={e => setClientId(e.target.value)} />
            <Input label="Nom du portefeuille" value={portfolioName} onChange={e => setPortfolioName(e.target.value)} placeholder={`${model.name} — Client`} />
            <Select label="Type de compte" options={[...ACCOUNT_TYPES]} value={accountType} onChange={e => setAccountType(e.target.value)} />
            <Select label="Devise" options={currencies} value={currency} onChange={e => setCurrency(e.target.value)} />
            <div className="md:col-span-2">
              <Input label="Montant total d'investissement ($)" type="number" min={0} step={1000} value={totalInvestment} onChange={e => setTotalInvestment(Number(e.target.value) || 0)} />
            </div>
          </div>
        </Card>

        {/* Preview with auto prices */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-text-main">Aperçu de la répartition</h3>
            <div className="flex items-center gap-2 text-xs">
              {pricesLoading ? (
                <span className="flex items-center gap-1 text-text-muted"><Spinner size="sm" /> Chargement des prix...</span>
              ) : yahooCount > 0 ? (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                  <Wifi className="h-3 w-3" />
                  {yahooCount}/{symbols.length} prix temps réel
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
                  <AlertCircle className="h-3 w-3" /> En attente des prix
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-text-muted">
                  <th className="text-left py-2 font-semibold w-8">#</th>
                  <th className="text-left py-2 font-semibold">Symbole</th>
                  <th className="text-left py-2 font-semibold">Nom</th>
                  <th className="text-right py-2 font-semibold">Poids</th>
                  <th className="text-right py-2 font-semibold">Prix</th>
                  <th className="text-right py-2 font-semibold">Montant</th>
                  <th className="text-right py-2 font-semibold">Quantité</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => (
                  <tr key={row.symbol} className="border-b border-gray-50 hover:bg-bg-light/50">
                    <td className="py-2.5">
                      <span className="w-6 h-6 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center text-[11px] font-bold">
                        {row.index}
                      </span>
                    </td>
                    <td className="py-2.5 font-mono font-semibold text-brand-primary">{row.symbol}</td>
                    <td className="py-2.5 text-text-main">{row.name}</td>
                    <td className="py-2.5 text-right">{row.weight}%</td>
                    <td className="py-2.5 text-right">
                      {row.source === 'yahoo' ? (
                        <span className="text-emerald-700 font-semibold">{formatCurrency(row.price)}</span>
                      ) : (
                        <div className="relative inline-block">
                          <span className="absolute left-1 top-1/2 -translate-y-1/2 text-xs text-text-muted">$</span>
                          <input type="number" min={0} step="any"
                            className={`w-24 pl-5 pr-2 py-1 rounded border text-sm text-right focus:border-brand-primary focus:outline-none ${row.price > 0 ? 'border-emerald-300 bg-emerald-50/50' : 'border-amber-300'}`}
                            placeholder="0.00"
                            defaultValue={manualPrices[row.symbol] || ''}
                            onBlur={e => {
                              const val = parseFloat(e.target.value);
                              setManualPrices(prev => ({ ...prev, [row.symbol]: isNaN(val) || val <= 0 ? 0 : val }));
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                          />
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 text-right font-semibold">{row.price > 0 ? formatCurrency(row.allocated) : '—'}</td>
                    <td className="py-2.5 text-right font-mono">{row.price > 0 ? row.quantity.toFixed(4) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200">
                  <td className="py-2.5 font-semibold" colSpan={3}>Total</td>
                  <td className="py-2.5 text-right font-bold">{model.holdings.reduce((s, h) => s + h.weight, 0).toFixed(1)}%</td>
                  <td></td>
                  <td className="py-2.5 text-right font-bold">{formatCurrency(totalInvestment)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => router.back()}>Annuler</Button>
          <Button loading={submitting} onClick={handleSubmit} icon={<Rocket className="h-4 w-4" />}>
            Appliquer le modèle
          </Button>
        </div>
      </div>
    </div>
  );
}
