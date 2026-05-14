'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';

interface TickerItem {
  title: string;
  link: string;
  source: string;
  sector: string;
  time: string;
}

interface NewsData {
  ticker: TickerItem[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const sectorEmoji: Record<string, string> = {
  finance: '🏦',
  tech: '💻',
  energy: '⚡',
  health: '🏥',
  industrial: '🏗️',
  crypto: '₿',
  defensive: '🛒',
  all: '🌍',
};

export function NewsTicker() {
  const { data } = useSWR<NewsData>('/api/dashboard/news', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 600_000,
  });

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const items = data?.ticker ?? [];

  if (items.length === 0) {
    return (
      <div className="bg-gradient-to-r from-[var(--brand-dark)] to-[var(--brand-accent)] h-10 flex items-center justify-center">
        <span className="text-white/60 text-xs">Chargement des nouvelles...</span>
      </div>
    );
  }

  // Duplicate items for seamless loop
  const doubled = [...items, ...items];

  return (
    <div className="bg-gradient-to-r from-[var(--brand-dark)] to-[var(--brand-accent)] overflow-hidden relative">
      <style>{`
        @keyframes tickerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-track {
          animation: tickerScroll ${items.length * 5}s linear infinite;
        }
        .ticker-track:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* Live indicator */}
      <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center px-3 bg-gradient-to-r from-[var(--brand-dark)] via-[var(--brand-dark)] to-transparent">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          <span className="text-[10px] font-bold text-white uppercase tracking-wider">EN DIRECT</span>
        </div>
      </div>

      {/* Scrolling content */}
      <div className={`ticker-track flex items-center whitespace-nowrap py-2.5 pl-28 ${mounted ? '' : 'opacity-0'}`}>
        {doubled.map((item, i) => (
          <a
            key={`${item.link}-${i}`}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 text-white/90 hover:text-white transition-colors group"
          >
            <span className="text-xs">{sectorEmoji[item.sector] || '📰'}</span>
            <span className="text-xs font-semibold group-hover:underline">{item.title}</span>
            <span className="text-[10px] text-white/40 font-medium">{item.source} · {item.time}</span>
            <span className="text-white/20 mx-2">|</span>
          </a>
        ))}
      </div>

      {/* Right fade */}
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[var(--brand-accent)] to-transparent pointer-events-none" />
    </div>
  );
}
