'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  PieChart,
  FileText,
  Settings,
  LogOut,
  ChevronLeft,
  TrendingUp,
  BarChart2,
} from 'lucide-react';
import { useState } from 'react';
import { signOut } from 'next-auth/react';

const navItems = [
  { href: '/', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/portfolios', label: 'Portefeuilles', icon: Briefcase },
  { href: '/models', label: 'Modèles', icon: PieChart },
  { href: '/markets', label: 'Marchés', icon: TrendingUp },
  { href: '/valuation', label: 'Valorisation', icon: BarChart2 },
  { href: '/reports', label: 'Rapports', icon: FileText },
  { href: '/admin', label: 'Administration', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen bg-brand-dark flex flex-col z-40 transition-all duration-300',
        collapsed ? 'w-[72px]' : 'w-[var(--sidebar-width)]'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-[var(--header-height)] px-5 border-b border-white/10">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-brand-primary flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">GF</span>
          </div>
          {!collapsed && (
            <span className="text-white font-bold text-sm whitespace-nowrap font-[family-name:var(--font-heading)]">
              Groupe Financier SF
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                active
                  ? 'bg-brand-primary text-white shadow-md'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200 w-full"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Déconnexion</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/40 hover:text-white/60 transition-all duration-200 w-full"
        >
          <ChevronLeft className={cn('h-5 w-5 flex-shrink-0 transition-transform', collapsed && 'rotate-180')} />
          {!collapsed && <span className="text-sm">Réduire</span>}
        </button>
      </div>
    </aside>
  );
}
