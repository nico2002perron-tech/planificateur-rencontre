'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import {
  LayoutDashboard,
  Users,
  PhoneCall,
  PieChart,
  FileText,
  Settings,
  ChevronLeft,
  TrendingUp,
  BarChart2,
  BookOpen,
  CalendarDays,
  Compass,
  History,
  ReceiptText,
  Briefcase,
  Inbox,
  FolderOpen,
  UserCog,
  Menu,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';

// Entrées visibles UNIQUEMENT quand l'app tourne sur le poste du planificateur.
// ⚠ Ceci n'est PAS une garde de sécurité — le navigateur peut mentir. La vraie
// protection est côté serveur : la page /documents répond 404 hors local, et sa
// route API aussi. Cette liste ne fait qu'éviter d'afficher un menu mort en
// production.
const navItemsLocaux = [
  { href: '/documents', label: 'Documents', icon: FolderOpen },
  { href: '/profils', label: 'Profils fiscaux', icon: UserCog },
];

const navItems = [
  { href: '/', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/prospection', label: 'Prospection', icon: PhoneCall },
  { href: '/analyses-recues', label: 'Analyses reçues', icon: Inbox },
  { href: '/models', label: 'Modèles', icon: PieChart },
  { href: '/proposition', label: 'Proposition', icon: Briefcase },
  { href: '/markets', label: 'Marchés', icon: TrendingUp },
  { href: '/valuation', label: 'Valorisation', icon: BarChart2 },
  { href: '/reports', label: 'Cours Cibles', icon: FileText },
  { href: '/transactions-du-jour', label: 'Transactions du jour', icon: ReceiptText },
  { href: '/journal', label: 'Journal des cibles', icon: History },
  { href: '/strategies', label: 'Stratégies', icon: Compass },
  { href: '/fund-reports', label: 'Rapports de fonds', icon: BookOpen },
  { href: '/events', label: 'Événements', icon: CalendarDays },
  { href: '/admin', label: 'Administration', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  // Tiroir mobile : la barre est cachée sous ~1024 px et s'ouvre par-dessus le
  // contenu (le contenu garde toute la largeur de l'écran — indispensable pour
  // gérer un tournoi au téléphone sur le bord du terrain).
  const [openMobile, setOpenMobile] = useState(false);
  // Exécution locale ? Décidé après le montage pour ne pas casser l'hydratation
  // (le serveur rend toujours la liste de base). Confort d'affichage seulement :
  // la sécurité est le 404 côté serveur — voir navItemsLocaux ci-dessus.
  const [local, setLocal] = useState(false);
  useEffect(() => {
    const h = window.location.hostname;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydratation : lecture navigateur impossible au rendu serveur
    setLocal(h === 'localhost' || h === '127.0.0.1' || h === '[::1]');
  }, []);

  // La marge du contenu suit la barre : la variable pilote AUSSI le ml-[…] du
  // layout, donc « Réduire » libère enfin l'espace au lieu de laisser un trou.
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', collapsed ? '72px' : '260px');
  }, [collapsed]);

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <>
    {/* Bouton menu — visible seulement sur petit écran */}
    <button
      onClick={() => setOpenMobile(v => !v)}
      aria-label={openMobile ? 'Fermer le menu' : 'Ouvrir le menu'}
      className="lg:hidden fixed top-3 left-3 z-50 w-10 h-10 rounded-xl bg-brand-dark text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
    >
      {openMobile ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
    </button>
    {/* Voile derrière le tiroir mobile — un tap le referme */}
    {openMobile && (
      <div className="lg:hidden fixed inset-0 bg-slate-900/50 z-30" onClick={() => setOpenMobile(false)} />
    )}
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen bg-brand-dark flex flex-col z-40 transition-all duration-300',
        'w-[260px] lg:w-[var(--sidebar-width)] lg:translate-x-0',
        openMobile ? 'translate-x-0' : '-translate-x-full'
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
        {[...navItems, ...(local ? navItemsLocaux : [])].map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpenMobile(false)}
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

      {/* Footer — collapse toggle (desktop seulement : le mobile a son tiroir) */}
      <div className="px-3 py-4 border-t border-white/10 hidden lg:block">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/40 hover:text-white/60 transition-all duration-200 w-full"
        >
          <ChevronLeft className={cn('h-5 w-5 flex-shrink-0 transition-transform', collapsed && 'rotate-180')} />
          {!collapsed && <span className="text-sm">Réduire</span>}
        </button>
      </div>
    </aside>
    </>
  );
}
