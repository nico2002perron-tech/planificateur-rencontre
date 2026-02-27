'use client';

import { useSession } from 'next-auth/react';
import { Bell, User } from 'lucide-react';

export function Header() {
  const { data: session } = useSession();

  return (
    <header className="h-[var(--header-height)] bg-white border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <h2 className="text-sm font-semibold text-text-muted">
          Planificateur de rencontre
        </h2>
      </div>

      <div className="flex items-center gap-3">
        <button className="relative p-2 rounded-lg hover:bg-bg-light transition-colors">
          <Bell className="h-5 w-5 text-text-muted" />
        </button>

        <div className="flex items-center gap-3 pl-3 border-l border-gray-100">
          <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center">
            <User className="h-4 w-4 text-brand-primary" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-text-main leading-tight">
              {session?.user?.name || 'Conseiller'}
            </p>
            <p className="text-xs text-text-muted leading-tight">
              {session?.user?.email || ''}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
