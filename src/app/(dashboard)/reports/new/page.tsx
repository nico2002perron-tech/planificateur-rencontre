'use client';

import { Suspense, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useClients } from '@/lib/hooks/useClients';
import { usePortfolios } from '@/lib/hooks/usePortfolio';
import { FileText, ChevronRight, ChevronLeft, Download, Check, User, Briefcase, Settings } from 'lucide-react';

const REPORT_SECTIONS = [
  { key: 'summary', label: 'Résumé exécutif + Profil client', default: true },
  { key: 'composition', label: 'Composition détaillée', default: true },
  { key: 'allocation', label: 'Allocations (classe, secteur, région)', default: true },
  { key: 'risk', label: 'Métriques de risque', default: true },
  { key: 'scenarios', label: 'Scénarios de projection', default: true },
  { key: 'stress', label: 'Tests de résistance', default: true },
  { key: 'disclaimers', label: 'Avertissements complets', default: true },
];

const STEPS = [
  { label: 'Client', icon: User },
  { label: 'Portefeuille', icon: Briefcase },
  { label: 'Configuration', icon: Settings },
  { label: 'Générer', icon: FileText },
];

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
        setStep(2); // Jump to config
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolios, preselectedPortfolio]);

  const selectedClient = clients?.find((c) => c.id === selectedClientId);
  const selectedPortfolio = portfolios?.find((p) => p.id === selectedPortfolioId);

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
    <div className="max-w-3xl">
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
                <div className={`h-0.5 w-12 mx-2 mt-[-12px] ${i < step ? 'bg-emerald-300' : 'bg-gray-200'}`} />
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

      {/* Step 2: Configuration */}
      {step === 2 && (
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

          <div className="flex justify-between mt-6">
            <Button variant="ghost" onClick={() => setStep(1)} icon={<ChevronLeft className="h-4 w-4" />}>
              Retour
            </Button>
            <Button onClick={() => setStep(3)} icon={<ChevronRight className="h-4 w-4" />}>
              Aperçu
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: Preview + Generate */}
      {step === 3 && (
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
              <span className="text-text-muted">Projection</span>
              <span className="text-text-main">{projectionYears} ans</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Pages</span>
              <span className="font-semibold text-brand-primary">8 pages</span>
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

          <div className="flex justify-between mt-6">
            <Button variant="ghost" onClick={() => setStep(2)} icon={<ChevronLeft className="h-4 w-4" />}>
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
      <PageHeader title="Nouveau rapport" description="Configurez et générez un rapport PDF détaillé" />
      <Suspense fallback={<div className="flex justify-center py-12"><Spinner size="lg" /></div>}>
        <NewReportWizard />
      </Suspense>
    </div>
  );
}
