'use client';

import type { SymbolNews } from '@/lib/yahoo/types';

interface NewsBadgeProps {
  symbolNews?: SymbolNews;
  onClick: () => void;
}

export function NewsBadge({ symbolNews, onClick }: NewsBadgeProps) {
  if (!symbolNews?.hasNews) return null;

  if (symbolNews.hasEarnings) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold
          bg-amber-100 text-amber-800 border border-amber-300
          hover:bg-amber-200 transition-colors cursor-pointer animate-pulse"
        title="Résultats financiers publiés"
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
        Earnings out!
      </button>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold
        bg-blue-50 text-blue-700 border border-blue-200
        hover:bg-blue-100 transition-colors cursor-pointer"
      title={`${symbolNews.articles.length} nouvelle(s)`}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
      {symbolNews.articles.length} news
    </button>
  );
}
