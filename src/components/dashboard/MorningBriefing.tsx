'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Highlight {
  title: string;
  detail: string;
  impact: 'positif' | 'negatif' | 'neutre';
}

interface BriefingData {
  briefing: string;
  highlights: Highlight[];
  generatedAt: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function TypewriterText({ text, speed = 12 }: { text: string; speed?: number }) {
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

const impactConfig = {
  positif: { icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-400' },
  negatif: { icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-400' },
  neutre: { icon: Minus, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-400' },
};

export function MorningBriefing() {
  const { data, isLoading, mutate } = useSWR<BriefingData>(
    '/api/dashboard/briefing',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 600_000 }
  );

  const [mounted, setMounted] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleRefresh() {
    setIsRefreshing(true);
    await mutate();
    setIsRefreshing(false);
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-[var(--shadow-card)] p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)]">
        <style>{`
          @keyframes shimmerBriefing {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
        `}</style>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🤖</span>
          <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-3 rounded"
              style={{
                width: `${100 - i * 15}%`,
                background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
                backgroundSize: '200% 100%',
                animation: `shimmerBriefing 1.5s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  const summary = data?.briefing ?? 'Aucun briefing disponible pour le moment.';
  const highlights = data?.highlights ?? [];
  const generatedAt = data?.generatedAt;

  return (
    <div
      className={`
        bg-white rounded-2xl shadow-[var(--shadow-card)] p-6
        transition-all duration-500 ease-out
        hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)]
        ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="bg-gradient-to-br from-violet-100 to-blue-100 text-lg p-1.5 rounded-lg">
            🤖
          </span>
          <div>
            <h3 className="text-sm font-bold font-[family-name:var(--font-heading)] text-text-main">
              Briefing du matin
            </h3>
            {generatedAt && (
              <p className="text-[10px] text-text-muted">
                Mis à jour {new Date(generatedAt).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-2 rounded-lg hover:bg-gray-50 transition-colors text-text-muted hover:text-brand-primary disabled:opacity-50"
          title="Rafraîchir"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Summary with typewriter */}
      <div className="text-sm text-text-main leading-relaxed mb-5 min-h-[60px]">
        {mounted ? <TypewriterText text={summary} speed={8} /> : summary}
      </div>

      {/* Economic highlights */}
      {highlights.length > 0 && (
        <div>
          <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <span>📊</span>
            Faits saillants de l&apos;économie
          </p>
          <div className="space-y-2">
            {highlights.map((h, i) => {
              const config = impactConfig[h.impact] || impactConfig.neutre;
              const Icon = config.icon;
              return (
                <div
                  key={i}
                  className={`flex items-start gap-3 ${config.bg} border ${config.border} rounded-xl p-3 transition-all duration-200 hover:scale-[1.01]`}
                  style={{
                    animation: mounted ? `fadeSlideUp 0.3s ease-out ${0.8 + i * 0.12}s both` : 'none',
                  }}
                >
                  <div className={`flex-shrink-0 p-1.5 rounded-lg ${config.bg}`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold ${config.color}`}>{h.title}</p>
                    <p className="text-xs text-text-main leading-relaxed mt-0.5">{h.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
