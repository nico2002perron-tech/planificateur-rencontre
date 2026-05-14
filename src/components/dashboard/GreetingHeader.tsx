'use client';

import { useState, useEffect } from 'react';

interface GreetingHeaderProps {
  userName: string;
}

function getGreeting(hour: number) {
  if (hour < 12) return { text: 'Bonjour', emoji: '☀️' };
  if (hour < 18) return { text: 'Bon après-midi', emoji: '🌤️' };
  return { text: 'Bonsoir', emoji: '🌙' };
}

function getMarketStatus(now: Date) {
  const day = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const totalMinutes = hour * 60 + minute;
  const isWeekday = day >= 1 && day <= 5;

  if (!isWeekday) return { label: 'Fermé', color: 'bg-red-400', pulse: false };
  if (totalMinutes >= 570 && totalMinutes < 960) return { label: 'Ouvert', color: 'bg-emerald-400', pulse: true }; // 9:30 - 16:00
  if (totalMinutes >= 540 && totalMinutes < 570) return { label: 'Pré-marché', color: 'bg-amber-400', pulse: true }; // 9:00 - 9:30
  if (totalMinutes >= 960 && totalMinutes < 1080) return { label: 'Après-marché', color: 'bg-amber-400', pulse: true }; // 16:00 - 18:00
  return { label: 'Fermé', color: 'bg-red-400', pulse: false };
}

function formatDateFr(date: Date) {
  return date.toLocaleDateString('fr-CA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function GreetingHeader({ userName }: GreetingHeaderProps) {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const greeting = getGreeting(now.getHours());
  const market = getMarketStatus(now);
  const dateStr = formatDateFr(now);

  return (
    <div
      className={`
        bg-white rounded-2xl shadow-[var(--shadow-card)] p-6 mb-6
        transition-all duration-700 ease-out
        ${mounted ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}
      `}
    >
      <style>{`
        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0) rotate(0deg); }
          50% { opacity: 1; transform: scale(1) rotate(180deg); }
        }
        @keyframes bounceIn {
          0% { transform: scale(0); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        @keyframes streakGlow {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.3); }
        }
        .sparkle-container {
          position: relative;
        }
        .sparkle-star {
          position: absolute;
          animation: sparkle 2s ease-in-out infinite;
          font-size: 10px;
          pointer-events: none;
        }
        .sparkle-star:nth-child(1) { top: -8px; right: -4px; animation-delay: 0s; }
        .sparkle-star:nth-child(2) { bottom: -4px; left: -6px; animation-delay: 0.7s; }
        .sparkle-star:nth-child(3) { top: 2px; left: -10px; animation-delay: 1.4s; }
      `}</style>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Greeting */}
        <div>
          <h1
            className="text-2xl sm:text-3xl font-extrabold font-[family-name:var(--font-heading)] text-text-main leading-tight"
            style={{ animationDelay: '0.1s' }}
          >
            <span className="inline-block mr-2" style={{ animation: mounted ? 'bounceIn 0.6s ease-out 0.3s both' : 'none', fontSize: '1.3em' }}>
              {greeting.emoji}
            </span>
            {greeting.text}, {userName} !
          </h1>
          <p className="text-text-muted mt-1 text-sm capitalize">{dateStr}</p>
        </div>

        {/* Right side: Market status + Streak */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Market status */}
          <div className="flex items-center gap-2 bg-gray-50 rounded-full px-4 py-2">
            <span className="relative flex h-2.5 w-2.5">
              {market.pulse && (
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${market.color} opacity-75`} />
              )}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${market.color}`} />
            </span>
            <span className="text-xs font-semibold text-text-main">
              Marché {market.label}
            </span>
          </div>

          {/* Streak counter */}
          <div
            className="sparkle-container flex items-center gap-2 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50 rounded-full px-4 py-2 cursor-default"
            style={{ animation: mounted ? 'streakGlow 3s ease-in-out infinite' : 'none' }}
          >
            <span className="sparkle-star">✨</span>
            <span className="sparkle-star">✨</span>
            <span className="sparkle-star">✨</span>
            <span className="text-lg" role="img" aria-label="fire">🔥</span>
            <span className="text-xs font-bold text-amber-700">
              5 jours d&apos;affilée
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
