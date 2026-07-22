'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { useSymbolSearch } from '@/lib/hooks/useQuotes';

interface SearchResult {
  symbol: string;
  name: string;
  exchangeShortName: string;
}

/**
 * Recherche de titre en ligne — composant PARTAGÉ (models/compare + proposition).
 * Style « candy » établi (bordure épaisse pointillée, hover #1CB0F6).
 * Pilotable au clavier : ↑/↓ naviguent, Enter sélectionne, Échap ferme ;
 * clic à l'extérieur ferme aussi. La liste s'ouvre dès 1 caractère (les
 * tickers d'une lettre — V, F, T — doivent être trouvables).
 */
export function SymbolSearchInline({ onSelect, placeholder }: {
  onSelect: (symbol: string, name: string, exchangeShortName?: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const { results, isLoading } = useSymbolSearch(query);
  const showList = open && query.length >= 1;
  const list: SearchResult[] = showList ? results : [];

  // Fermer au clic/tap à l'extérieur.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  function pick(r: SearchResult) {
    onSelect(r.symbol, r.name, r.exchangeShortName);
    setQuery('');
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (!showList || list.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, list.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(list[Math.min(active, list.length - 1)]); }
  }

  return (
    <div className="relative" ref={rootRef}>
      <div className="flex items-center gap-2 px-4 py-3 rounded-2xl border-[3px] border-dashed border-gray-200 bg-gray-50/50 hover:border-[#1CB0F6] transition-all">
        <Search className="h-4 w-4 text-text-muted flex-shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
          onFocus={() => query && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder ?? 'Ajouter un titre (ex: AAPL, RY.TO)...'}
          className="flex-1 bg-transparent text-sm font-semibold text-text-main placeholder:text-text-muted/50 focus:outline-none"
        />
        {query && (
          <button onClick={() => { setQuery(''); setOpen(false); }} className="text-text-muted hover:text-text-main">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {showList && (
        <div className="absolute z-30 top-full mt-1 w-full bg-white rounded-2xl shadow-xl border-[3px] border-gray-100 max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-4"><Spinner size="sm" /></div>
          ) : list.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-4">Aucun résultat</p>
          ) : (
            list.map((r, i) => (
              <button
                key={r.symbol}
                className={`w-full text-left px-4 py-3 transition-colors flex items-center justify-between ${
                  i === active ? 'bg-[#1CB0F6]/10' : 'hover:bg-[#1CB0F6]/5'
                }`}
                onPointerEnter={() => setActive(i)}
                onClick={() => pick(r)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="px-2 py-0.5 rounded-lg bg-[#1CB0F6]/10 text-[#1CB0F6] font-extrabold text-xs flex-shrink-0">{r.symbol}</span>
                  <span className="text-sm font-semibold text-text-main truncate max-w-[200px]">{r.name}</span>
                </div>
                <span className="text-[10px] font-bold text-text-muted bg-gray-100 px-2 py-0.5 rounded-lg flex-shrink-0 ml-2">{r.exchangeShortName}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
