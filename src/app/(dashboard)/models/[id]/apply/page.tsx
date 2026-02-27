'use client';

import { useState, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
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
import { ArrowLeft, Rocket, DollarSign } from 'lucide-react';

const currencies = [
  { value: 'CAD', label: 'CAD — Dollar canadien' },
  { value: 'USD', label: 'USD — Dollar américain' },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(value);
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
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  // Initialize prices when model loads
  useMemo(() => {
    if (model?.holdings) {
      const initial: Record<string, number> = {};
      model.holdings.forEach((h) => {
        if (!prices[h.symbol]) {
          initial[h.symbol] = 100;
        }
      });
      if (Object.keys(initial).length > 0) {
        setPrices((prev) => ({ ...initial, ...prev }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  const preview = useMemo(() => {
    if (!model?.holdings) return [];
    return model.holdings.map((h) => {
      const price = prices[h.symbol] || 100;
      const allocated = (totalInvestment * h.weight) / 100;
      const quantity = price > 0 ? allocated / price : 0;
      return {
        symbol: h.symbol,
        name: h.name,
        weight: h.weight,
        price,
        allocated,
        quantity,
      };
    });
  }, [model, prices, totalInvestment]);

  async function handleSubmit() {
    if (!clientId) {
      toast('warning', 'Veuillez sélectionner un client');
      return;
    }
    if (!portfolioName.trim()) {
      toast('warning', 'Veuillez entrer un nom de portefeuille');
      return;
    }
    if (totalInvestment <= 0) {
      toast('warning', 'Le montant doit être supérieur à 0');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/models/${id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          portfolio_name: portfolioName,
          account_type: accountType,
          currency,
          total_investment: totalInvestment,
          prices,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed');
      }

      const data = await res.json();
      toast('success', `Portefeuille créé avec ${data.holdings_created} positions`);
      router.push(`/portfolios/${data.portfolio.id}`);
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Erreur lors de l\'application du modèle');
    } finally {
      setSubmitting(false);
    }
  }

  if (modelLoading || clientsLoading) {
    return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  }

  if (!model) {
    return (
      <Card className="text-center py-16">
        <p className="text-text-muted">Modèle introuvable</p>
      </Card>
    );
  }

  const clientOptions = (clients || []).map((c) => ({
    value: c.id,
    label: `${c.first_name} ${c.last_name}`,
  }));

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
            <Select
              label="Client"
              options={[{ value: '', label: 'Sélectionner un client...' }, ...clientOptions]}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
            <Input
              label="Nom du portefeuille"
              value={portfolioName}
              onChange={(e) => setPortfolioName(e.target.value)}
              placeholder={`${model.name} — Client`}
            />
            <Select
              label="Type de compte"
              options={[...ACCOUNT_TYPES]}
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
            />
            <Select
              label="Devise"
              options={currencies}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            />
            <div className="md:col-span-2">
              <Input
                label="Montant total d'investissement ($)"
                type="number"
                min={0}
                step={1000}
                value={totalInvestment}
                onChange={(e) => setTotalInvestment(Number(e.target.value) || 0)}
              />
            </div>
          </div>
        </Card>

        {/* Prix par position */}
        <Card>
          <h3 className="font-semibold text-text-main mb-4">
            Prix par position
            <span className="ml-2 text-xs font-normal text-text-muted">
              (Ajustez les prix si vous les connaissez. Par défaut: 100$)
            </span>
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {model.holdings.map((h) => (
              <div key={h.symbol}>
                <label className="block text-xs font-semibold text-text-muted mb-1">
                  {h.symbol}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">$</span>
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    className="w-full pl-7 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none"
                    value={prices[h.symbol] || 100}
                    onChange={(e) => setPrices((prev) => ({ ...prev, [h.symbol]: Number(e.target.value) || 0 }))}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Preview */}
        <Card>
          <h3 className="font-semibold text-text-main mb-4">Aperçu de la répartition</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-text-muted">
                  <th className="text-left py-2 font-semibold">Symbole</th>
                  <th className="text-left py-2 font-semibold">Nom</th>
                  <th className="text-right py-2 font-semibold">Poids</th>
                  <th className="text-right py-2 font-semibold">Prix</th>
                  <th className="text-right py-2 font-semibold">Montant alloué</th>
                  <th className="text-right py-2 font-semibold">Quantité</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => (
                  <tr key={row.symbol} className="border-b border-gray-50 hover:bg-bg-light/50">
                    <td className="py-2.5 font-mono font-semibold text-brand-primary">{row.symbol}</td>
                    <td className="py-2.5 text-text-main">{row.name}</td>
                    <td className="py-2.5 text-right">{row.weight}%</td>
                    <td className="py-2.5 text-right">{formatCurrency(row.price)}</td>
                    <td className="py-2.5 text-right font-semibold">{formatCurrency(row.allocated)}</td>
                    <td className="py-2.5 text-right font-mono">{row.quantity.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200">
                  <td className="py-2.5 font-semibold" colSpan={2}>Total</td>
                  <td className="py-2.5 text-right font-bold">
                    {model.holdings.reduce((s, h) => s + h.weight, 0).toFixed(1)}%
                  </td>
                  <td></td>
                  <td className="py-2.5 text-right font-bold">{formatCurrency(totalInvestment)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => router.back()}>Annuler</Button>
          <Button
            loading={submitting}
            onClick={handleSubmit}
            icon={<Rocket className="h-4 w-4" />}
          >
            Appliquer le modèle
          </Button>
        </div>
      </div>
    </div>
  );
}
