'use client';

import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';

const STEPS = [
  { num: 1, title: 'Definir ma strategie', href: '/models/profiles' },
  { num: 2, title: 'Choisir mes titres', href: '/models/universe' },
  { num: 3, title: 'Construire', href: '/models/generate' },
  { num: 4, title: 'Evaluer la qualite', href: '/models/scoring' },
  { num: 5, title: 'Backtester', href: '/models/backtest' },
  { num: 6, title: 'Comparer', href: '/models/compare' },
  { num: 7, title: 'Reequilibrer', href: '/models/rebalance' },
];

export function StepNav({ current }: { current: number }) {
  const next = current < 7 ? STEPS[current] : null;

  return (
    <div className="mt-10 pt-6 border-t border-gray-100">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1.5 mb-3">
        {STEPS.map((s) => (
          <Link key={s.num} href={s.href}>
            <div
              className={`h-2 rounded-full transition-all cursor-pointer hover:opacity-80 ${
                s.num === current ? 'w-8 bg-brand-primary' :
                s.num < current ? 'w-4 bg-green-400' :
                'w-4 bg-gray-200'
              }`}
              title={`Etape ${s.num}: ${s.title}`}
            />
          </Link>
        ))}
      </div>

      <p className="text-xs text-text-muted text-center mb-4">
        Etape {current} de 7
      </p>

      {next ? (
        <div className="flex justify-center">
          <Link
            href={next.href}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-primary/5 border border-brand-primary/20 text-brand-primary text-sm font-semibold hover:bg-brand-primary/10 transition-colors group"
          >
            Etape suivante: {next.title}
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      ) : (
        <div className="flex justify-center">
          <Link
            href="/models"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-semibold hover:bg-green-100 transition-colors"
          >
            <Check className="h-4 w-4" />
            Parcours complete!
          </Link>
        </div>
      )}
    </div>
  );
}
