'use client';

import { useState, useRef, useEffect } from 'react';
import { SearchInput } from '@/components/ui/SearchInput';
import { useSymbolSearch } from '@/lib/hooks/useQuotes';
import { Spinner } from '@/components/ui/Spinner';

interface SymbolSearchProps {
  onSelect: (symbol: string, name: string) => void;
  placeholder?: string;
}

export function SymbolSearch({ onSelect, placeholder = 'Rechercher un titre (ex: AAPL, RY.TO)...' }: SymbolSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const { results, isLoading } = useSymbolSearch(query);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <SearchInput
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onClear={() => {
          setQuery('');
          setOpen(false);
        }}
        placeholder={placeholder}
        onFocus={() => query && setOpen(true)}
      />

      {open && query.length >= 1 && (
        <div className="absolute z-20 top-full mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-100 max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-4"><Spinner size="sm" /></div>
          ) : results.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-4">Aucun résultat</p>
          ) : (
            results.map((r: { symbol: string; name: string; exchangeShortName: string }) => (
              <button
                key={r.symbol}
                className="w-full text-left px-4 py-2.5 hover:bg-bg-light transition-colors flex items-center justify-between"
                onClick={() => {
                  onSelect(r.symbol, r.name);
                  setQuery('');
                  setOpen(false);
                }}
              >
                <div>
                  <span className="font-semibold text-sm text-text-main">{r.symbol}</span>
                  <span className="text-xs text-text-muted ml-2">{r.name}</span>
                </div>
                <span className="text-xs text-text-light">{r.exchangeShortName}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
