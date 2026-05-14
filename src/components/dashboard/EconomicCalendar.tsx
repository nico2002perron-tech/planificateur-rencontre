'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';

interface EconomicEvent {
  date: string;
  event: string;
  country: string;
  impact: string;
  actual: number | null;
  estimate: number | null;
  previous: number | null;
}

interface CalendarResponse {
  events: EconomicEvent[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const countryFlag: Record<string, string> = {
  CA: '🇨🇦',
  US: '🇺🇸',
};

const impactDot: Record<string, string> = {
  high: '🔴',
  medium: '🟡',
  low: '🟢',
};

const impactLabel: Record<string, string> = {
  high: 'Élevé',
  medium: 'Moyen',
  low: 'Faible',
};

function isToday(dateStr: string) {
  const now = new Date();
  const d = new Date(dateStr);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function formatEventDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(dateStr)) return "Aujourd'hui";
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate()
  )
    return 'Demain';
  return d.toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function EconomicCalendar() {
  const { data, isLoading } = useSWR<CalendarResponse>(
    '/api/dashboard/economic-calendar',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 600_000 }
  );

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Skeleton
  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-[var(--shadow-card)] p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)]">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">📅</span>
          <div className="h-5 w-44 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="h-8 w-8 rounded-full bg-gray-200" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-2/3 bg-gray-200 rounded" />
                <div className="h-2 w-1/3 bg-gray-100 rounded" />
              </div>
              <div className="h-4 w-4 rounded-full bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const events = data?.events ?? [];

  // Group by date
  const grouped: Record<string, EconomicEvent[]> = {};
  for (const ev of events) {
    const label = formatEventDate(ev.date);
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(ev);
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
        @keyframes calSlideIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes todayBadgePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0,180,216,0.3); }
          50% { box-shadow: 0 0 0 4px rgba(0,180,216,0.1); }
        }
      `}</style>

      {/* Header */}
      <h3 className="text-sm font-bold font-[family-name:var(--font-heading)] text-text-main flex items-center gap-2 mb-4">
        <span>📅</span>
        Calendrier économique
      </h3>

      {events.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-6">
          Aucun événement à venir 😴
        </p>
      ) : (
        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
          {Object.entries(grouped).map(([dateLabel, dayEvents]) => {
            const isTodayGroup = dateLabel === "Aujourd'hui";
            return (
              <div key={dateLabel}>
                {/* Date header */}
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`
                      text-xs font-bold px-2 py-0.5 rounded-full
                      ${isTodayGroup ? 'bg-brand-primary text-white' : 'bg-gray-100 text-text-muted'}
                    `}
                    style={isTodayGroup ? { animation: 'todayBadgePulse 2s ease-in-out infinite' } : {}}
                  >
                    {dateLabel}
                  </span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>

                {/* Events list */}
                <div className="space-y-1.5">
                  {dayEvents.map((ev, i) => (
                    <div
                      key={`${ev.date}-${ev.event}-${i}`}
                      className={`
                        flex items-center gap-3 px-3 py-2 rounded-lg
                        transition-colors duration-200
                        ${isTodayGroup ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-gray-50'}
                      `}
                      style={{
                        animation: mounted ? `calSlideIn 0.3s ease-out ${0.05 * i}s both` : 'none',
                      }}
                    >
                      {/* Country flag */}
                      <span className="text-lg flex-shrink-0">{countryFlag[ev.country] ?? '🌐'}</span>

                      {/* Event info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-text-main truncate">
                          {ev.event}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {ev.estimate !== null && (
                            <span className="text-[10px] text-text-muted">
                              Prévu: {ev.estimate}
                            </span>
                          )}
                          {ev.previous !== null && (
                            <span className="text-[10px] text-text-light">
                              Préc: {ev.previous}
                            </span>
                          )}
                          {ev.actual !== null && (
                            <span className="text-[10px] font-bold text-brand-primary">
                              Réel: {ev.actual}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Impact level */}
                      <div className="flex-shrink-0 flex items-center gap-1" title={impactLabel[ev.impact]}>
                        <span className="text-xs">{impactDot[ev.impact]}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
