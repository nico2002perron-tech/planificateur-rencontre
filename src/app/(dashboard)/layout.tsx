'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { VaultProvider } from '@/components/security/VaultProvider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <VaultProvider>
      <div className="min-h-screen bg-bg-light">
        <Sidebar />
        {/* Mobile : la barre devient un tiroir par-dessus → aucune marge, tout
            l'écran au contenu. Desktop : la marge suit --sidebar-width, que la
            barre met à jour quand on la réduit. */}
        <div className="ml-0 lg:ml-[var(--sidebar-width)] transition-all duration-300">
          <Header />
          <main className="p-4 sm:p-6">
            <Breadcrumbs />
            {children}
          </main>
        </div>
      </div>
    </VaultProvider>
  );
}
