'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { RefreshCw, ExternalLink, ChevronDown, ChevronUp, Newspaper } from 'lucide-react';

interface TopStory {
  title: string;
  source: string;
  link: string;
  time: string;
  lang: string;
  description: string;
}

interface BriefingData {
  topStories: TopStory[];
  synthesis: string | null;
  sectorSummary: { sector: string; change: number | string }[];
  articleCount: number;
  generatedAt: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const sourceColors: Record<string, string> = {
  'Radio-Canada': 'bg-blue-100 text-blue-800',
  'La Presse': 'bg-purple-100 text-purple-800',
  'Les Affaires': 'bg-emerald-100 text-emerald-800',
  'Le Devoir': 'bg-amber-100 text-amber-800',
  'CNBC': 'bg-sky-100 text-sky-800',
  'MarketWatch': 'bg-green-100 text-green-800',
  'BBC': 'bg-red-100 text-red-800',
};

export function MorningBriefing() {
  const { data, isLoading, mutate } = useSWR<BriefingData>(
    '/api/dashboard/briefing',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 600_000 }
  );

  const [mounted, setMounted] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSynthesis, setShowSynthesis] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  async function handleRefresh() {
    setIsRefreshing(true);
    await mutate();
    setIsRefreshing(false);
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-[var(--shadow-card)] p-6">
        <style>{`
          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
        `}</style>
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-xl bg-gray-200 animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 rounded-xl mb-2" style={{
            background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)',
            backgroundSize: '200% 100%',
            animation: `shimmer 1.5s ease-in-out infinite`,
            animationDelay: `${i * 0.1}s`,
          }} />
        ))}
      </div>
    );
  }

  const topStories = data?.topStories ?? [];
  const synthesis = data?.synthesis;
  const generatedAt = data?.generatedAt;
  const articleCount = data?.articleCount ?? 0;

  return (
    <div
      className={`
        bg-white rounded-2xl shadow-[var(--shadow-card)] overflow-hidden
        transition-all duration-500 ease-out
        hover:shadow-[var(--shadow-hover)]
        ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}
      `}
    >
      <style>{`
        @keyframes storySlide {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* Header */}
      <div className="bg-gradient-to-r from-[var(--brand-dark)] via-[var(--brand-accent)] to-[var(--brand-primary)] p-5 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 backdrop-blur-sm p-2 rounded-xl">
              <Newspaper className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white font-[family-name:var(--font-heading)]">
                À la une aujourd&apos;hui
              </h3>
              <p className="text-[10px] text-white/60">
                {articleCount} articles analysés
                {generatedAt && ` · ${new Date(generatedAt).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}`}
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white disabled:opacity-50"
            title="Rafraîchir"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="p-5">
        {/* Top stories - REAL articles with REAL links */}
        {topStories.length > 0 ? (
          <div className="space-y-2">
            {topStories.map((story, i) => {
              const colorClass = sourceColors[story.source] || 'bg-gray-100 text-gray-700';
              const isFirst = i === 0;
              return (
                <a
                  key={`${story.link}-${i}`}
                  href={story.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`
                    block rounded-xl border transition-all duration-200 group
                    ${isFirst
                      ? 'border-brand-primary/20 bg-blue-50/30 p-4 hover:bg-blue-50/60 hover:border-brand-primary/40'
                      : 'border-gray-100 p-3 hover:bg-gray-50 hover:border-gray-200'
                    }
                  `}
                  style={{ animation: mounted ? `storySlide 0.3s ease-out ${0.1 + i * 0.08}s both` : 'none' }}
                >
                  <div className="flex items-start gap-3">
                    {isFirst && (
                      <span className="text-2xl flex-shrink-0 mt-0.5">📰</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${colorClass}`}>
                          {story.source}
                        </span>
                        {story.time && (
                          <span className="text-[10px] text-text-light">il y a {story.time}</span>
                        )}
                        {story.lang === 'en' && (
                          <span className="text-[10px] text-text-light">🇬🇧</span>
                        )}
                      </div>
                      <p className={`font-semibold text-text-main leading-snug group-hover:text-brand-accent transition-colors ${isFirst ? 'text-sm' : 'text-xs'}`}>
                        {story.title}
                      </p>
                      {isFirst && story.description && (
                        <p className="text-xs text-text-muted mt-1.5 line-clamp-2 leading-relaxed">
                          {story.description}
                        </p>
                      )}
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-text-light flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </a>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-2xl mb-2">📭</p>
            <p className="text-sm text-text-muted">Aucune nouvelle disponible</p>
          </div>
        )}

        {/* AI Synthesis (expandable, clearly labeled as AI) */}
        {synthesis && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <button
              onClick={() => setShowSynthesis(!showSynthesis)}
              className="flex items-center gap-2 text-xs font-semibold text-text-muted hover:text-brand-primary transition-colors w-full"
            >
              <span>🤖</span>
              <span>Synthèse IA des manchettes</span>
              <span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded-full">généré par IA</span>
              <span className="flex-1" />
              {showSynthesis ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {showSynthesis && (
              <div className="mt-3 text-sm text-text-main leading-relaxed whitespace-pre-line bg-gray-50 rounded-xl p-4 border border-gray-100">
                {synthesis}
                <p className="text-[10px] text-text-light mt-3 italic">
                  Cette synthèse est générée par IA à partir des manchettes réelles ci-dessus. Vérifiez toujours les sources originales.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
