'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { Bell, User, UserCircle, LogOut, ChevronDown } from 'lucide-react';

export function Header() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const initials = (session?.user?.name || 'U')
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

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

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2.5 pl-3 border-l border-gray-100 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center">
              <span className="text-xs font-bold text-brand-primary">{initials}</span>
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-semibold text-text-main leading-tight">
                {session?.user?.name || 'Conseiller'}
              </p>
              <p className="text-xs text-text-muted leading-tight">
                {session?.user?.email || ''}
              </p>
            </div>
            <ChevronDown className={`h-4 w-4 text-text-muted transition-transform hidden sm:block ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50">
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-main hover:bg-bg-light transition-colors"
              >
                <UserCircle className="h-4 w-4 text-text-muted" />
                Mon profil
              </Link>
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors w-full"
              >
                <LogOut className="h-4 w-4" />
                Deconnexion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
