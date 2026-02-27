'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

const labels: Record<string, string> = {
  '': 'Tableau de bord',
  clients: 'Clients',
  portfolios: 'Portefeuilles',
  models: 'Modèles',
  reports: 'Rapports',
  admin: 'Administration',
  new: 'Nouveau',
  edit: 'Modifier',
  compare: 'Comparaison',
  simulation: 'Simulation',
  preview: 'Aperçu',
  users: 'Utilisateurs',
  settings: 'Paramètres',
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((seg, i) => {
    const href = '/' + segments.slice(0, i + 1).join('/');
    const label = labels[seg] || seg;
    const isLast = i === segments.length - 1;
    return { href, label, isLast };
  });

  return (
    <nav className="flex items-center gap-1.5 text-sm mb-6">
      <Link href="/" className="text-text-muted hover:text-brand-primary transition-colors">
        <Home className="h-4 w-4" />
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.href} className="flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5 text-text-light" />
          {crumb.isLast ? (
            <span className="text-text-main font-medium">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="text-text-muted hover:text-brand-primary transition-colors">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
