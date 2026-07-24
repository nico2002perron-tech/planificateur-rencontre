'use client';

import {
  CalendarRange,
  ClipboardPaste,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import type {
  ActivityPeriod,
  PortfolioActivitySummary,
} from '@/lib/portfolio/year-activity';

const COLORS = {
  blue: '#1CB0F6',
  blueDark: '#1899d6',
  green: '#58CC02',
  greenDark: '#45a300',
  navy: '#15324b',
};

const PERIODS: Array<{ value: ActivityPeriod; label: string; hint: string }> = [
  { value: 'six_months', label: '6 mois', hint: '6 mois civils' },
  { value: 'year_to_date', label: 'Depuis janvier', hint: 'Année en cours' },
  { value: 'one_year', label: '1 an', hint: '12 mois civils' },
];

function formatMoney(value: number): string {
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface YearActivityBuilderProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  /** Page « Le parcours de votre argent » (dépôts → achats → valeur). */
  deploymentEnabled: boolean;
  onDeploymentEnabledChange: (enabled: boolean) => void;
  /** Des achats ont été détectés dans la période (la page peut se rendre). */
  deploymentDetected: boolean;
  period: ActivityPeriod;
  onPeriodChange: (period: ActivityPeriod) => void;
  paste: string;
  onPasteChange: (value: string) => void;
  startValue: string;
  onStartValueChange: (value: string) => void;
  contributionsOverride: string;
  onContributionsOverrideChange: (value: string) => void;
  withdrawalsOverride: string;
  onWithdrawalsOverrideChange: (value: string) => void;
  summary: PortfolioActivitySummary | null;
  error: string | null;
  onClear: () => void;
}

export function YearActivityBuilder({
  enabled,
  onEnabledChange,
  deploymentEnabled,
  onDeploymentEnabledChange,
  deploymentDetected,
  period,
  onPeriodChange,
  paste,
  onPasteChange,
  startValue,
  onStartValueChange,
  contributionsOverride,
  onContributionsOverrideChange,
  withdrawalsOverride,
  onWithdrawalsOverrideChange,
  summary,
  error,
  onClear,
}: YearActivityBuilderProps) {
  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-sky-200 bg-white">
      <div className="flex items-center justify-between gap-4 border-b border-sky-100 bg-sky-50/70 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${COLORS.blue}18` }}
          >
            <CalendarRange className="h-5 w-5" style={{ color: COLORS.blueDark }} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-extrabold text-gray-900">Activité du portefeuille</h4>
              <span className="rounded-md bg-sky-600 px-2 py-0.5 text-[10px] font-extrabold uppercase text-white">
                Cours cibles 1.2
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Ajoute le bilan, l’activité mensuelle et la provenance de la croissance.
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => onEnabledChange(!enabled)}
          className="relative h-7 w-12 flex-shrink-0 rounded-full transition-colors"
          style={{ backgroundColor: enabled ? COLORS.green : '#d1d5db' }}
          title={enabled ? 'Bilan de période inclus' : 'Bilan de période exclu'}
        >
          <span
            className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white transition-transform"
            style={{ transform: enabled ? 'translateX(20px)' : 'translateX(0)' }}
          />
        </button>
      </div>

      <div className={`space-y-4 p-4 ${enabled ? '' : 'pointer-events-none opacity-45'}`}>
        <div>
          <p className="mb-2 text-xs font-bold text-gray-700">Période analysée</p>
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-gray-100 p-1">
            {PERIODS.map(option => {
              const active = period === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onPeriodChange(option.value)}
                  className="min-w-0 rounded-lg px-2 py-2 text-center transition-all"
                  style={active
                    ? { backgroundColor: 'white', boxShadow: '0 1px 4px rgba(15, 23, 42, 0.12)' }
                    : { backgroundColor: 'transparent' }}
                >
                  <span className={`block text-xs font-extrabold ${active ? 'text-sky-700' : 'text-gray-500'}`}>
                    {option.label}
                  </span>
                  <span className="mt-0.5 block text-[9px] text-gray-400">{option.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor="croesus-year-activity" className="flex items-center gap-2 text-xs font-bold text-gray-700">
              <ClipboardPaste className="h-4 w-4 text-sky-600" />
              Transactions Croesus
            </label>
            {paste && (
              <button
                type="button"
                onClick={onClear}
                className="flex items-center gap-1 text-[11px] font-bold text-gray-400 hover:text-gray-700"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Effacer
              </button>
            )}
          </div>
          <textarea
            id="croesus-year-activity"
            value={paste}
            onChange={event => onPasteChange(event.target.value)}
            rows={6}
            spellCheck={false}
            placeholder={'Copiez les lignes dans Croesus, puis collez-les ici.\nLes 18 colonnes sont reconnues automatiquement, même sans en-têtes.'}
            className="w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 font-mono text-[11px] leading-5 text-gray-700 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
          />
          {error && (
            <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700">
              {error}
            </p>
          )}
        </div>

        {summary && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {[
                { label: 'Revenus encaissés', value: formatMoney(summary.income) },
                { label: 'Cotisations', value: formatMoney(summary.contributions) },
                { label: 'Retraits', value: formatMoney(summary.withdrawals) },
                { label: 'Transactions de revenu', value: String(summary.incomeTransactionCount) },
              ].map(metric => (
                <div key={metric.label} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                  <p className="text-[9px] font-semibold uppercase text-gray-400">{metric.label}</p>
                  <p className="mt-1 text-sm font-extrabold text-gray-900">{metric.value}</p>
                </div>
              ))}
            </div>

            {/* Page « Le parcours de votre argent » : dérivée du MÊME collage, zéro saisie de plus. */}
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-orange-200 bg-orange-50/60 px-3 py-2.5">
              <input
                type="checkbox"
                checked={deploymentEnabled}
                onChange={event => onDeploymentEnabledChange(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-orange-500"
              />
              <span className="min-w-0">
                <span className="block text-xs font-bold text-gray-800">
                  Inclure la page « Le parcours de votre argent » (dépôts → achats → valeur)
                </span>
                <span className="mt-0.5 block text-[11px] text-gray-500">
                  {deploymentDetected
                    ? 'Des achats ont été détectés dans la période — la page sera générée.'
                    : "Nécessite l'historique collé ; la page n'apparaît que si des achats sont détectés dans la période."}
                </span>
              </span>
            </label>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold text-gray-700">
                  Valeur au début de la période
                </span>
                <input
                  value={startValue}
                  onChange={event => onStartValueChange(event.target.value)}
                  inputMode="decimal"
                  placeholder="Ex. 782 000"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
                <span className="mt-1 block text-[9px] leading-4 text-gray-400">
                  Requis pour calculer l’appréciation des placements.
                </span>
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-bold text-gray-700">
                  Corriger les cotisations
                </span>
                <input
                  value={contributionsOverride}
                  onChange={event => onContributionsOverrideChange(event.target.value)}
                  inputMode="decimal"
                  placeholder={`Détecté: ${formatMoney(summary.contributions)}`}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
                <span className="mt-1 block text-[9px] leading-4 text-gray-400">
                  Utile pour les transferts externes non identifiés.
                </span>
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-bold text-gray-700">
                  Corriger les retraits
                </span>
                <input
                  value={withdrawalsOverride}
                  onChange={event => onWithdrawalsOverrideChange(event.target.value)}
                  inputMode="decimal"
                  placeholder={`Détecté: ${formatMoney(summary.withdrawals)}`}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
                <span className="mt-1 block text-[9px] leading-4 text-gray-400">
                  Les transferts internes sont exclus par prudence.
                </span>
              </label>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
              <div className="mb-1.5 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                <p className="text-[11px] font-extrabold uppercase text-emerald-800">Résumé automatique</p>
              </div>
              <p className="text-xs leading-5 text-gray-700">{summary.narrative}</p>
              {summary.startingPortfolioValue == null && (
                <p className="mt-2 text-[10px] font-semibold text-amber-700">
                  Ajoutez la valeur de départ pour activer la page « D’où vient la croissance? ».
                </p>
              )}
            </div>
          </>
        )}

        <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" />
          <p className="text-[10px] leading-4 text-slate-500">
            Le collage est analysé dans votre navigateur. Les lignes détaillées ne sont pas envoyées au serveur;
            seul le résumé agrégé nécessaire au PDF est transmis.
          </p>
        </div>
      </div>
    </section>
  );
}
