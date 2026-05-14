'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { RefreshCw, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';

interface TopStory {
  emoji: string;
  headline: string;
  summary: string;
  impact: 'positif' | 'negatif' | 'neutre';
  tag: string;
}

interface KeyData {
  label: string;
  value: string;
  trend: 'up' | 'down' | 'stable';
  context: string;
}

interface BriefingData {
  topStories: TopStory[];
  briefing: string;
  keyData: KeyData[];
  generatedAt: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function TypewriterText({ text, speed = 8 }: { text: string; speed?: number }) {
  const [displayText, setDisplayText] = useState('');
  const [isDone, setIsDone] = useState(false);
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayText('');
    indexRef.current = 0;
    setIsDone(false);
    const interval = setInterval(() => {
      if (indexRef.current < text.length) {
        setDisplayText(text.slice(0, indexRef.current + 1));
        indexRef.current++;
      } else {
        setIsDone(true);
        clearInterval(interval);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return (
    <span>
      {displayText}
      {!isDone && <span className="inline-block w-0.5 h-4 bg-brand-primary ml-0.5 animate-pulse" />}
    </span>
  );
}

const impactStyles = {
  positif: { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', accent: 'text-emerald-700' },
  negatif: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700', accent: 'text-red-700' },
  neutre: { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700', accent: 'text-blue-700' },
};

const trendConfig = {
  up: { icon: TrendingUp, color: 'text-emerald-600', label: '↑' },
  down: { icon: TrendingDown, color: 'text-red-600', label: '↓' },
  stable: { icon: Minus, color: 'text-amber-600', label: '→' },
};

export function MorningBriefing() {
  const { data, isLoading, mutate } = useSWR<BriefingData>(
    '/api/dashboard/briefing',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 600_000 }
  );

  const [mounted, setMounted] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFullBriefing, setShowFullBriefing] = useState(false);

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
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-gray-200 animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl" style={{
              background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)',
              backgroundSize: '200% 100%',
              animation: `shimmer 1.5s ease-in-out infinite`,
              animationDelay: `${i * 0.15}s`,
            }} />
          ))}
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-3 bg-gray-100 rounded" style={{ width: `${100 - i * 12}%` }} />)}
        </div>
      </div>
    );
  }

  const topStories = data?.topStories ?? [];
  const briefing = data?.briefing ?? 'Aucun briefing disponible.';
  const keyData = data?.keyData ?? [];
  const generatedAt = data?.generatedAt;

  // Show first 2 paragraphs or full
  const briefingParagraphs = briefing.split('\n').filter(p => p.trim());
  const previewText = briefingParagraphs.slice(0, 2).join('\n\n');
  const hasMore = briefingParagraphs.length > 2;
  const displayBriefing = showFullBriefing ? briefing : previewText;

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
        @keyframes storyPop {
          from { opacity: 0; transform: scale(0.92) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes dataSlide {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-[var(--brand-dark)] via-[var(--brand-accent)] to-[var(--brand-primary)] p-5 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 backdrop-blur-sm p-2 rounded-xl">
              <span className="text-xl">☀️</span>
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white font-[family-name:var(--font-heading)]">
                Journal du matin
              </h3>
              {generatedAt && (
                <p className="text-[10px] text-white/60">
                  Mis à jour à {new Date(generatedAt).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
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
        {/* Top Stories — "À la une" */}
        {topStories.length > 0 && (
          <div className="mb-5">
            <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-3 flex items-center gap-1.5">
              🔥 À la une aujourd&apos;hui
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {topStories.map((story, i) => {
                const styles = impactStyles[story.impact] || impactStyles.neutre;
                return (
                  <div
                    key={i}
                    className={`${styles.bg} border ${styles.border} rounded-xl p-3.5 transition-all duration-200 hover:scale-[1.02] hover:shadow-md cursor-default`}
                    style={{ animation: mounted ? `storyPop 0.4s ease-out ${0.1 + i * 0.12}s both` : 'none' }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{story.emoji}</span>
                      <span className={`text-[9px] font-bold ${styles.badge} px-1.5 py-0.5 rounded-full uppercase`}>
                        {story.tag}
                      </span>
                    </div>
                    <p className={`text-sm font-bold ${styles.accent} leading-snug mb-1.5`}>
                      {story.headline}
                    </p>
                    <p className="text-xs text-text-main leading-relaxed">
                      {story.summary}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Key economic data */}
        {keyData.length > 0 && (
          <div className="mb-5">
            <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-3 flex items-center gap-1.5">
              📊 Données clés
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {keyData.map((d, i) => {
                const trend = trendConfig[d.trend] || trendConfig.stable;
                const TrendIcon = trend.icon;
                return (
                  <div
                    key={i}
                    className="bg-gray-50 rounded-xl p-3 hover:bg-gray-100 transition-colors group"
                    style={{ animation: mounted ? `dataSlide 0.3s ease-out ${0.5 + i * 0.08}s both` : 'none' }}
                    title={d.context}
                  >
                    <p className="text-[10px] font-semibold text-text-muted mb-1 truncate">{d.label}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-base font-extrabold text-text-main">{d.value}</span>
                      <TrendIcon className={`h-3.5 w-3.5 ${trend.color}`} />
                    </div>
                    <p className="text-[10px] text-text-light mt-1 line-clamp-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {d.context}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Briefing text */}
        <div>
          <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-3 flex items-center gap-1.5">
            📝 Le briefing complet
          </p>
          <div className="text-sm text-text-main leading-relaxed whitespace-pre-line">
            {mounted ? <TypewriterText text={displayBriefing} speed={6} /> : displayBriefing}
          </div>
          {hasMore && (
            <button
              onClick={() => setShowFullBriefing(!showFullBriefing)}
              className="flex items-center gap-1 mt-3 text-xs font-semibold text-brand-primary hover:text-brand-accent transition-colors"
            >
              {showFullBriefing ? (
                <>Réduire <ChevronUp className="h-3 w-3" /></>
              ) : (
                <>Lire la suite <ChevronDown className="h-3 w-3" /></>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
