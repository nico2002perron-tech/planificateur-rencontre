'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { ExternalLink, RefreshCw } from 'lucide-react';

interface NewsArticle {
  title: string;
  summary: string;
  source: string;
  time: string;
  link: string;
  sectors: string[];
  impact: number;
  isNew: boolean;
}

interface NewsData {
  articles: Record<string, NewsArticle[]>;
  ticker: { title: string; source: string; time: string }[];
  generatedAt?: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const SECTOR_FILTERS = [
  { key: 'all', label: 'Tout', icon: '🌍' },
  { key: 'finance', label: 'Finance', icon: '🏦' },
  { key: 'tech', label: 'Tech', icon: '💻' },
  { key: 'energy', label: 'Énergie', icon: '⚡' },
  { key: 'health', label: 'Santé', icon: '🏥' },
  { key: 'industrial', label: 'Industriel', icon: '🏗️' },
  { key: 'crypto', label: 'Crypto', icon: '₿' },
  { key: 'defensive', label: 'Défensif', icon: '🛒' },
];

function ImpactDots({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5" title={`Impact: ${level}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${
            i <= level
              ? level >= 4 ? 'bg-red-400' : level >= 3 ? 'bg-amber-400' : 'bg-gray-300'
              : 'bg-gray-200'
          }`}
        />
      ))}
    </div>
  );
}

export function NewsRadar() {
  const { data, isLoading, mutate } = useSWR<NewsData>(
    '/api/dashboard/news',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 600_000 }
  );

  const [mounted, setMounted] = useState(false);
  const [activeSector, setActiveSector] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const articles = Array.isArray(data?.articles?.[activeSector]) ? data.articles[activeSector] : [];

  async function handleRefresh() {
    setIsRefreshing(true);
    await mutate();
    setIsRefreshing(false);
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-[var(--shadow-card)] p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-40 bg-gray-200 rounded" />
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-7 w-16 bg-gray-100 rounded-full" />
            ))}
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-50 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // Count articles per sector for badges
  const sectorCounts: Record<string, number> = {};
  for (const filter of SECTOR_FILTERS) {
    const arr = data?.articles?.[filter.key];
    sectorCounts[filter.key] = Array.isArray(arr) ? arr.length : 0;
  }

  return (
    <div
      className={`
        bg-white rounded-2xl shadow-[var(--shadow-card)] p-6
        transition-all duration-500 ease-out
        hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)]
        ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}
      `}
    >
      <style>{`
        @keyframes newBadgePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
        @keyframes newsSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold font-[family-name:var(--font-heading)] text-text-main flex items-center gap-2">
          <span>📡</span>
          Radar des nouvelles
          <span className="text-[10px] font-normal text-text-muted bg-gray-100 px-2 py-0.5 rounded-full">
            {sectorCounts.all || 0} articles
          </span>
        </h3>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-2 rounded-lg hover:bg-gray-50 transition-colors text-text-muted hover:text-brand-primary disabled:opacity-50"
          title="Rafraîchir les nouvelles"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Sector filters with counts */}
      <div className="flex gap-1.5 overflow-x-auto pb-3 mb-4 -mx-1 px-1">
        {SECTOR_FILTERS.map((filter) => {
          const count = sectorCounts[filter.key] || 0;
          return (
            <button
              key={filter.key}
              onClick={() => setActiveSector(filter.key)}
              className={`
                flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold
                whitespace-nowrap transition-all duration-200 flex-shrink-0
                ${activeSector === filter.key
                  ? 'bg-brand-primary text-white shadow-md scale-105'
                  : count > 0
                    ? 'bg-gray-50 text-text-muted hover:bg-gray-100 hover:text-text-main'
                    : 'bg-gray-50 text-text-light opacity-50'
                }
              `}
            >
              <span>{filter.icon}</span>
              {filter.label}
              {count > 0 && activeSector !== filter.key && (
                <span className="text-[9px] bg-gray-200 text-text-muted rounded-full px-1 ml-0.5">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Articles */}
      <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
        {articles.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-sm text-text-muted">Aucune nouvelle dans cette catégorie</p>
          </div>
        ) : (
          articles.map((article, i) => (
            <a
              key={`${article.link}-${i}`}
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 rounded-xl border border-gray-100 hover:border-brand-primary/30 hover:bg-blue-50/30 transition-all duration-200 group"
              style={{ animation: mounted ? `newsSlideIn 0.3s ease-out ${0.05 * i}s both` : 'none' }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {article.isNew && (
                      <span
                        className="text-[9px] font-bold bg-gradient-to-r from-rose-500 to-pink-500 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                        style={{ animation: 'newBadgePulse 2s ease-in-out infinite' }}
                      >
                        NEW
                      </span>
                    )}
                    <span className="text-[10px] font-semibold text-brand-accent bg-blue-50 px-1.5 py-0.5 rounded">
                      {article.source}
                    </span>
                    <span className="text-[10px] text-text-light">{article.time}</span>
                    <ImpactDots level={article.impact} />
                    {article.sectors.length > 0 && (
                      <div className="flex gap-1">
                        {article.sectors.map((s) => {
                          const filter = SECTOR_FILTERS.find(f => f.key === s);
                          return filter ? (
                            <span key={s} className="text-[9px] bg-gray-100 text-text-muted px-1 rounded" title={filter.label}>
                              {filter.icon}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-text-main leading-snug group-hover:text-brand-accent transition-colors line-clamp-2">
                    {article.title}
                  </p>
                  {article.summary && (
                    <p className="text-xs text-text-muted mt-1 line-clamp-2">{article.summary}</p>
                  )}
                </div>
                <ExternalLink className="h-4 w-4 text-text-light flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  );
}
