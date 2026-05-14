'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { RefreshCw, ExternalLink, TrendingUp, TrendingDown, Minus, Newspaper, Zap } from 'lucide-react';

interface Driver {
  titleFr: string;
  impact: 'positif' | 'negatif' | 'neutre';
  why: string;
  source: string;
  link: string;
  time: string;
  sector: string;
}

interface TopStory {
  index: number;
  title: string;
  source: string;
  link: string;
  time: string;
  lang: string;
  description: string;
}

interface BriefingData {
  sentiment: 'haussier' | 'baissier' | 'mixte' | null;
  thesis: string | null;
  drivers: Driver[];
  topStories: TopStory[];
  articleCount: number;
  feedCount: number;
  generatedAt: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const SOURCE_DOMAINS: Record<string, string> = {
  'Radio-Canada': 'ici.radio-canada.ca',
  'La Presse': 'lapresse.ca',
  'Les Affaires': 'lesaffaires.com',
  'Le Devoir': 'ledevoir.com',
  'Les Echos': 'lesechos.fr',
  'CNBC': 'cnbc.com',
  'MarketWatch': 'marketwatch.com',
  'BBC': 'bbc.com',
  'Yahoo Finance': 'finance.yahoo.com',
  'CoinDesk': 'coindesk.com',
  'TechCrunch': 'techcrunch.com',
  'OilPrice': 'oilprice.com',
  'Bloomberg': 'bloomberg.com',
  'Reuters': 'reuters.com',
};

function getSourceLogo(source: string): string | null {
  const domain = SOURCE_DOMAINS[source];
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

const sourceColors: Record<string, string> = {
  'Radio-Canada': 'bg-blue-100 text-blue-800',
  'La Presse': 'bg-purple-100 text-purple-800',
  'Les Affaires': 'bg-emerald-100 text-emerald-800',
  'Le Devoir': 'bg-amber-100 text-amber-800',
  'Les Echos': 'bg-orange-100 text-orange-800',
  'CNBC': 'bg-sky-100 text-sky-800',
  'MarketWatch': 'bg-green-100 text-green-800',
  'BBC': 'bg-red-100 text-red-800',
  'Yahoo Finance': 'bg-violet-100 text-violet-800',
  'CoinDesk': 'bg-yellow-100 text-yellow-800',
  'TechCrunch': 'bg-lime-100 text-lime-800',
  'OilPrice': 'bg-orange-100 text-orange-800',
  'Bloomberg': 'bg-indigo-100 text-indigo-800',
  'Reuters': 'bg-teal-100 text-teal-800',
};

const sectorLabels: Record<string, string> = {
  finance: 'Finance',
  tech: 'Tech',
  energy: 'Energie',
  health: 'Sante',
  industrial: 'Industriel',
  crypto: 'Crypto',
  defensive: 'Defensif',
  macro: 'Macro',
};

const sectorColors: Record<string, string> = {
  finance: 'bg-blue-50 text-blue-700 border-blue-200',
  tech: 'bg-purple-50 text-purple-700 border-purple-200',
  energy: 'bg-amber-50 text-amber-700 border-amber-200',
  health: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  industrial: 'bg-slate-50 text-slate-700 border-slate-200',
  crypto: 'bg-orange-50 text-orange-700 border-orange-200',
  defensive: 'bg-sky-50 text-sky-700 border-sky-200',
  macro: 'bg-gray-50 text-gray-700 border-gray-200',
};

const sentimentConfig = {
  haussier: {
    label: 'Haussier',
    bg: 'from-emerald-600 to-green-500',
    icon: TrendingUp,
  },
  baissier: {
    label: 'Baissier',
    bg: 'from-red-600 to-rose-500',
    icon: TrendingDown,
  },
  mixte: {
    label: 'Mixte',
    bg: 'from-amber-600 to-orange-500',
    icon: Minus,
  },
};

const impactConfig = {
  positif: { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', icon: TrendingUp },
  negatif: { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500', icon: TrendingDown },
  neutre: { color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', dot: 'bg-gray-400', icon: Minus },
};

export function MorningBriefing() {
  const { data, isLoading, mutate } = useSWR<BriefingData>(
    '/api/dashboard/briefing',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 600_000 }
  );

  const [mounted, setMounted] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAllStories, setShowAllStories] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  async function handleRefresh() {
    setIsRefreshing(true);
    await mutate();
    setIsRefreshing(false);
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
        <style>{`
          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
        `}</style>
        <div className="h-36 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" style={{
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s ease-in-out infinite',
        }} />
        <div className="p-6 space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl" style={{
              background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)',
              backgroundSize: '200% 100%',
              animation: `shimmer 1.5s ease-in-out infinite`,
              animationDelay: `${i * 0.15}s`,
            }} />
          ))}
        </div>
      </div>
    );
  }

  const sentiment = data?.sentiment ?? null;
  const thesis = data?.thesis ?? null;
  const drivers = data?.drivers ?? [];
  const topStories = data?.topStories ?? [];
  const articleCount = data?.articleCount ?? 0;
  const feedCount = data?.feedCount ?? 0;
  const generatedAt = data?.generatedAt;
  const config = sentiment ? sentimentConfig[sentiment] : null;
  const SentimentIcon = config?.icon ?? Minus;

  const visibleStories = showAllStories ? topStories : topStories.slice(0, 5);

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
        @keyframes driverSlide {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* Hero Section */}
      {config && thesis ? (
        <div className={`bg-gradient-to-r ${config.bg} p-7 pb-6 relative overflow-hidden`}>
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white rounded-full blur-3xl" style={{ animation: 'pulseGlow 3s ease-in-out infinite' }} />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white rounded-full blur-3xl" style={{ animation: 'pulseGlow 3s ease-in-out infinite 1.5s' }} />
          </div>

          <div className="relative z-10">
            {/* Top bar */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3.5 py-1.5 rounded-full">
                  <Zap className="h-4 w-4 text-white" />
                  <span className="text-sm font-extrabold text-white font-[family-name:var(--font-heading)]">
                    A la une aujourd&apos;hui
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  <SentimentIcon className="h-3.5 w-3.5 text-white" />
                  <span className="text-xs font-bold text-white/90">
                    Marches {config.label}s
                  </span>
                </div>
              </div>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white disabled:opacity-50"
                title="Rafraichir"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Main Thesis - BIG */}
            <p className="text-white text-xl leading-relaxed font-semibold tracking-tight">
              {thesis}
            </p>

            <div className="flex items-center gap-3 mt-5 text-white/50 text-[10px]">
              <span>{articleCount} articles de {feedCount} sources</span>
              {generatedAt && (
                <>
                  <span>·</span>
                  <span>{new Date(generatedAt).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}</span>
                </>
              )}
              <span>·</span>
              <span>Synthese IA</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-[var(--brand-dark)] via-[var(--brand-accent)] to-[var(--brand-primary)] p-6 pb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 backdrop-blur-sm p-2.5 rounded-xl">
                <Newspaper className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white font-[family-name:var(--font-heading)]">
                  A la une aujourd&apos;hui
                </h3>
                <p className="text-[10px] text-white/60">
                  {articleCount} articles analyses
                  {generatedAt && ` · ${new Date(generatedAt).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}`}
                </p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white disabled:opacity-50"
              title="Rafraichir"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      )}

      <div className="p-5">
        {/* Drivers */}
        {drivers.length > 0 && (
          <div className="mb-5">
            <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">
              Ce qui fait bouger les marches
            </h4>
            <div className="space-y-2.5">
              {drivers.map((driver, i) => {
                const ic = impactConfig[driver.impact] || impactConfig.neutre;
                const Icon = ic.icon;
                const logo = getSourceLogo(driver.source);
                const sc = sectorColors[driver.sector] || sectorColors.macro;
                return (
                  <a
                    key={`${driver.link}-${i}`}
                    href={driver.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`
                      block rounded-xl border ${ic.border} ${ic.bg} p-4
                      hover:shadow-md transition-all duration-200 group
                    `}
                    style={{ animation: mounted ? `driverSlide 0.3s ease-out ${0.1 + i * 0.08}s both` : 'none' }}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 mt-0.5 w-7 h-7 rounded-full ${ic.border} border bg-white flex items-center justify-center`}>
                        <Icon className={`h-4 w-4 ${ic.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${ic.color} leading-snug`}>
                          {driver.titleFr}
                        </p>
                        <p className="text-xs text-text-muted leading-relaxed mt-1">
                          {driver.why}
                        </p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${sourceColors[driver.source] || 'bg-gray-100 text-gray-700'}`}>
                            {logo && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={logo} alt="" className="w-3 h-3 rounded-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            )}
                            {driver.source}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sc}`}>
                            {sectorLabels[driver.sector] || driver.sector}
                          </span>
                          {driver.time && (
                            <span className="text-[10px] text-text-light">il y a {driver.time}</span>
                          )}
                          <ExternalLink className="h-3 w-3 text-text-light opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                        </div>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Top Stories */}
        {topStories.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">
              Autres manchettes
            </h4>
            <div className="space-y-1.5">
              {visibleStories.map((story, i) => {
                const colorClass = sourceColors[story.source] || 'bg-gray-100 text-gray-700';
                const logo = getSourceLogo(story.source);
                return (
                  <a
                    key={`${story.link}-${i}`}
                    href={story.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-50 transition-colors group"
                    style={{ animation: mounted ? `driverSlide 0.2s ease-out ${0.4 + i * 0.05}s both` : 'none' }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-text-main leading-snug group-hover:text-brand-accent transition-colors truncate">
                        {story.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${colorClass}`}>
                          {logo && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={logo} alt="" className="w-2.5 h-2.5 rounded-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          )}
                          {story.source}
                        </span>
                        {story.time && <span className="text-[9px] text-text-light">il y a {story.time}</span>}
                      </div>
                    </div>
                    <ExternalLink className="h-3 w-3 text-text-light flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                );
              })}
            </div>
            {topStories.length > 5 && (
              <button
                onClick={() => setShowAllStories(!showAllStories)}
                className="w-full text-center text-xs font-semibold text-brand-primary hover:text-brand-accent mt-2 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {showAllStories ? 'Voir moins' : `Voir les ${topStories.length - 5} autres manchettes`}
              </button>
            )}
          </div>
        )}

        {/* Empty state */}
        {topStories.length === 0 && drivers.length === 0 && (
          <div className="text-center py-8">
            <Newspaper className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-text-muted">Aucune nouvelle disponible</p>
          </div>
        )}
      </div>
    </div>
  );
}
