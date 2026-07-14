'use client';

/**
 * Page publique EN DIRECT d'un tournoi — le lien envoyé aux joueurs.
 * Sans connexion. Horaire + classement, rafraîchis automatiquement (~10 s).
 * ?equipe=<id> : met l'équipe du joueur en vedette (sa prochaine partie en gros).
 */

import { useState, useEffect, useMemo, useCallback, use, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, MapPin, CalendarDays, Radio, Medal, Clock3 } from 'lucide-react';
import Bracket from '@/components/tournament/Bracket';

const BRAND = {
  navy: '#03045e',
  blue: '#0077b6',
  cyan: '#00b4d8',
  green: '#58CC02',
  greenDark: '#45a300',
  red: '#FF4B4B',
} as const;

interface Team { id: string; name: string; logo_url: string | null }

interface Match {
  id: string;
  phase: string;
  match_number: number;
  court: number;
  scheduled_date: string;
  scheduled_time: string;
  team_a_id: string | null;
  team_b_id: string | null;
  source_a: string;
  source_b: string;
  score_a: number | null;
  score_b: number | null;
  status: string;
}

interface Standing {
  teamId: string; teamName: string; rank: number;
  played: number; wins: number; ties: number; losses: number;
  pointsFor: number; pointsAgainst: number; diff: number; points: number;
}

interface TournamentState {
  event: { id: string; title: string; date: string; location: string };
  config: { status: 'draft' | 'published' } | null;
  teams: Team[];
  matches: Match[];
  standings: Standing[];
  published_at: string | null;
}

const PHASE_LABELS: Record<string, string> = {
  garantie: '', quart: 'Quart de finale', demi: 'Demi-finale', bronze: 'Bronze', finale: 'FINALE',
};

function formatEventDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
}

function LivePageInner({ eventId }: { eventId: string }) {
  const searchParams = useSearchParams();
  const [state, setState] = useState<TournamentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'horaire' | 'series' | 'classement'>('horaire');
  const [selectedTeam, setSelectedTeam] = useState<string>(searchParams.get('equipe') || '');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/tournament`, { cache: 'no-store' });
      if (!res.ok) { setError('Tournoi introuvable.'); return; }
      setState(await res.json());
      setError('');
    } catch {
      // silencieux : on garde le dernier état affiché, le prochain tick réessaie
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  // Chargement initial + rafraîchissement automatique (la page « en direct »)
  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [load]);

  const teamName = useMemo(() => {
    const map = new Map((state?.teams || []).map(t => [t.id, t.name]));
    return (id: string | null, source: string) => (id ? map.get(id) : '') || source || 'À déterminer';
  }, [state?.teams]);

  // Horaire groupé par JOURNÉE puis par heure — tri chronologique partout
  // ('' = partie d'avant la v3 → date de l'événement)
  const byDay = useMemo(() => {
    const days = new Map<string, Map<string, Match[]>>();
    for (const m of state?.matches || []) {
      const dk = m.scheduled_date || state?.event.date || '';
      const tk = m.scheduled_time || '—';
      const slots = days.get(dk) || new Map<string, Match[]>();
      slots.set(tk, [...(slots.get(tk) || []), m]);
      days.set(dk, slots);
    }
    return [...days.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, slots]) => ({ date, slots: [...slots.entries()].sort((a, b) => a[0].localeCompare(b[0])) }));
  }, [state?.matches, state?.event.date]);

  const multiDay = byDay.length > 1;
  const playoffMatches = useMemo(() => (state?.matches || []).filter(m => m.phase !== 'garantie'), [state?.matches]);

  // Prochaine partie de l'équipe sélectionnée — la plus tôt en JOUR + HEURE
  // (pas en numéro de partie : l'organisateur peut déplacer des matchs)
  const nextMatch = useMemo(() => {
    if (!selectedTeam || !state) return null;
    const when = (m: Match) => `${m.scheduled_date || state.event.date || ''}|${m.scheduled_time || '99:99'}`;
    return state.matches
      .filter(m =>
        (m.team_a_id === selectedTeam || m.team_b_id === selectedTeam) &&
        m.status !== 'finished' && m.status !== 'cancelled')
      .sort((a, b) => when(a).localeCompare(when(b)))[0] || null;
  }, [selectedTeam, state]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f2f6fa' }}>
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: BRAND.blue }} />
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center" style={{ backgroundColor: '#f2f6fa' }}>
        <p className="font-extrabold text-slate-700">{error || 'Erreur de chargement.'}</p>
      </div>
    );
  }

  const published = state.config?.status === 'published' && state.matches.length > 0;

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: '#f2f6fa' }}>
      {/* En-tête de marque */}
      <div style={{ background: `linear-gradient(135deg, ${BRAND.navy} 0%, ${BRAND.blue} 60%, ${BRAND.cyan} 100%)` }}>
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-5 text-white">
          <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider opacity-90">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: '#7CFC00' }} />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: '#7CFC00' }} />
            </span>
            Tournoi en direct · Groupe Financier Ste-Foy
          </div>
          <h1 className="text-2xl font-extrabold mt-1.5 leading-tight">{state.event.title}</h1>
          <p className="text-sm mt-1 opacity-90 flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1 capitalize">
              <CalendarDays className="h-3.5 w-3.5" />
              {multiDay
                ? `${formatEventDate(byDay[0].date)} au ${formatEventDate(byDay[byDay.length - 1].date)}`
                : formatEventDate(state.event.date)}
            </span>
            {state.event.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{state.event.location}</span>}
          </p>
          {state.published_at && (
            <p className="text-[11px] mt-2 opacity-75 font-bold">
              Horaire mis à jour le {new Date(state.published_at).toLocaleString('fr-CA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4">
        {!published ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mt-6 text-center">
            <Clock3 className="h-10 w-10 mx-auto mb-3" style={{ color: BRAND.blue }} />
            <p className="font-extrabold text-slate-800 text-lg">L&apos;horaire s&apos;en vient !</p>
            <p className="text-sm text-slate-500 mt-1.5">
              L&apos;organisateur n&apos;a pas encore publié l&apos;horaire du tournoi.
              Cette page se mettra à jour automatiquement — pas besoin de rafraîchir.
            </p>
          </div>
        ) : (
          <>
            {/* Sélecteur d'équipe */}
            <div className="mt-4 -mx-4 px-4 overflow-x-auto">
              <div className="flex gap-1.5 pb-1 w-max">
                <button onClick={() => setSelectedTeam('')}
                  className="px-3.5 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition-all border-2"
                  style={{
                    backgroundColor: !selectedTeam ? BRAND.navy : 'white',
                    color: !selectedTeam ? 'white' : '#64748b',
                    borderColor: !selectedTeam ? BRAND.navy : '#e2e8f0',
                  }}>Toutes</button>
                {state.teams.map(t => (
                  <button key={t.id} onClick={() => setSelectedTeam(t.id === selectedTeam ? '' : t.id)}
                    className="px-3.5 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition-all border-2"
                    style={{
                      backgroundColor: selectedTeam === t.id ? BRAND.blue : 'white',
                      color: selectedTeam === t.id ? 'white' : '#64748b',
                      borderColor: selectedTeam === t.id ? BRAND.blue : '#e2e8f0',
                    }}>{t.name}</button>
                ))}
              </div>
            </div>

            {/* Prochaine partie de l'équipe en vedette */}
            {selectedTeam && (
              <div className="mt-3 rounded-2xl p-4 text-white shadow-md"
                style={{ background: `linear-gradient(135deg, ${BRAND.blue}, ${BRAND.cyan})` }}>
                {nextMatch ? (
                  <>
                    <p className="text-[11px] font-extrabold uppercase tracking-wider opacity-90">Votre prochaine partie</p>
                    <div className="flex items-end justify-between gap-3 mt-1">
                      <div>
                        {multiDay && (
                          <p className="text-xs font-extrabold capitalize opacity-90 mb-0.5">
                            {formatEventDate(nextMatch.scheduled_date || state.event.date)}
                          </p>
                        )}
                        <p className="text-3xl font-extrabold leading-none">{nextMatch.scheduled_time}</p>
                        <p className="text-sm font-bold mt-1.5 opacity-95">
                          Terrain {nextMatch.court} · vs {teamName(
                            nextMatch.team_a_id === selectedTeam ? nextMatch.team_b_id : nextMatch.team_a_id,
                            nextMatch.team_a_id === selectedTeam ? nextMatch.source_b : nextMatch.source_a,
                          )}
                        </p>
                      </div>
                      {PHASE_LABELS[nextMatch.phase] && (
                        <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-white/20">{PHASE_LABELS[nextMatch.phase]}</span>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm font-extrabold">🎉 Toutes vos parties sont jouées — merci et bravo !</p>
                )}
              </div>
            )}

            {/* Onglets */}
            <div className="flex gap-2 mt-4">
              {([['horaire', 'Horaire'], ...(playoffMatches.length > 0 ? [['series', 'Séries']] : []), ['classement', 'Classement']] as ['horaire' | 'series' | 'classement', string][]).map(([key, label]) => (
                <button key={key} onClick={() => setTab(key)}
                  className="flex-1 px-3 py-2.5 rounded-xl text-sm font-extrabold transition-all border-2"
                  style={{
                    backgroundColor: tab === key ? 'white' : 'transparent',
                    color: tab === key ? BRAND.navy : '#94a3b8',
                    borderColor: tab === key ? `${BRAND.blue}50` : 'transparent',
                    boxShadow: tab === key ? '0 1px 3px rgba(2,6,23,0.08)' : 'none',
                  }}>{label}</button>
              ))}
            </div>

            {/* Horaire */}
            {tab === 'horaire' && (
              <div className="mt-3 space-y-4">
                {byDay.map(({ date, slots }) => {
                  const daySlots = slots
                    .map(([time, matches]) => [time, selectedTeam
                      ? matches.filter(m => m.team_a_id === selectedTeam || m.team_b_id === selectedTeam)
                      : matches] as const)
                    .filter(([, ms]) => ms.length > 0);
                  if (daySlots.length === 0) return null;
                  return (
                    <div key={date || 'sans-date'}>
                      {multiDay && (
                        <p className="text-sm font-extrabold mt-5 mb-2 px-1 capitalize" style={{ color: BRAND.navy }}>
                          📆 {formatEventDate(date)}
                        </p>
                      )}
                      {daySlots.map(([time, visible]) => (
                    <div key={time} className="mb-4">
                      <p className="text-xs font-extrabold text-slate-400 uppercase tracking-wide mb-1.5 px-1">{time}</p>
                      <div className="space-y-1.5">
                        {visible.map(m => {
                          const finished = m.status === 'finished';
                          const aWins = finished && m.score_a !== null && m.score_b !== null && m.score_a > m.score_b;
                          const bWins = finished && m.score_a !== null && m.score_b !== null && m.score_b > m.score_a;
                          return (
                            <div key={m.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3">
                              <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-400 mb-1">
                                <span>Terrain {m.court}{PHASE_LABELS[m.phase] ? ` · ${PHASE_LABELS[m.phase]}` : ''}</span>
                                {finished
                                  ? <span style={{ color: BRAND.greenDark }}>Terminée</span>
                                  : m.status === 'in_progress'
                                    ? <span className="inline-flex items-center gap-1" style={{ color: BRAND.red }}><Radio className="h-3 w-3" /> En cours</span>
                                    : <span>À venir</span>}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="flex-1 text-right text-sm font-extrabold truncate"
                                  style={{ color: aWins ? BRAND.greenDark : '#1e293b', opacity: bWins ? 0.55 : 1 }}>
                                  {teamName(m.team_a_id, m.source_a)}
                                </span>
                                <span className="text-base font-extrabold tabular-nums px-2.5 py-0.5 rounded-lg"
                                  style={{ backgroundColor: finished ? '#f0fdf4' : '#f1f5f9', color: finished ? BRAND.greenDark : '#64748b' }}>
                                  {m.score_a !== null && m.score_b !== null ? `${m.score_a} – ${m.score_b}` : 'vs'}
                                </span>
                                <span className="flex-1 text-sm font-extrabold truncate"
                                  style={{ color: bWins ? BRAND.greenDark : '#1e293b', opacity: aWins ? 0.55 : 1 }}>
                                  {teamName(m.team_b_id, m.source_b)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Séries éliminatoires */}
            {tab === 'series' && playoffMatches.length > 0 && (
              <div className="mt-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <h2 className="text-sm font-extrabold text-slate-800 mb-3">🏆 Séries éliminatoires</h2>
                <Bracket
                  matches={playoffMatches}
                  teamName={teamName}
                  highlightTeam={selectedTeam || undefined}
                  multiDay={multiDay}
                  accent={BRAND.blue}
                />
                <p className="text-[11px] text-slate-400 font-bold mt-3 text-center">
                  Les cases se remplissent automatiquement à mesure que les résultats rentrent.
                </p>
              </div>
            )}

            {/* Classement */}
            {tab === 'classement' && (
              <div className="mt-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <h2 className="text-sm font-extrabold text-slate-800 mb-3 flex items-center gap-1.5">
                  <Medal className="h-4 w-4" style={{ color: BRAND.blue }} /> Classement
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] font-extrabold text-slate-400">
                        <th className="text-left py-1.5 pr-2">#</th>
                        <th className="text-left py-1.5 pr-2">Équipe</th>
                        <th className="text-center py-1.5 px-1.5">J</th>
                        <th className="text-center py-1.5 px-1.5">V</th>
                        <th className="text-center py-1.5 px-1.5">N</th>
                        <th className="text-center py-1.5 px-1.5">D</th>
                        <th className="text-center py-1.5 px-1.5">+/−</th>
                        <th className="text-center py-1.5 pl-1.5">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.standings.map(r => {
                        const highlighted = r.teamId === selectedTeam;
                        return (
                          <tr key={r.teamId} className="border-t border-slate-100"
                            style={{ backgroundColor: highlighted ? '#eff9ff' : 'transparent' }}>
                            <td className="py-2 pr-2 font-extrabold text-slate-400">
                              {r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : r.rank}
                            </td>
                            <td className="py-2 pr-2 font-extrabold" style={{ color: highlighted ? BRAND.blue : '#1e293b' }}>{r.teamName}</td>
                            <td className="py-2 px-1.5 text-center font-bold text-slate-500">{r.played}</td>
                            <td className="py-2 px-1.5 text-center font-bold" style={{ color: BRAND.greenDark }}>{r.wins}</td>
                            <td className="py-2 px-1.5 text-center font-bold text-slate-500">{r.ties}</td>
                            <td className="py-2 px-1.5 text-center font-bold" style={{ color: BRAND.red }}>{r.losses}</td>
                            <td className="py-2 px-1.5 text-center font-bold text-slate-500">{r.diff > 0 ? `+${r.diff}` : r.diff}</td>
                            <td className="py-2 pl-1.5 text-center font-extrabold text-slate-800">{r.points}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        <p className="text-center text-[11px] text-slate-400 font-bold mt-8">
          Mise à jour automatique · Groupe Financier Ste-Foy · iA Gestion privée de patrimoine
        </p>
      </div>
    </div>
  );
}

export default function TournamentLivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f2f6fa' }}>
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: BRAND.blue }} />
      </div>
    }>
      <LivePageInner eventId={eventId} />
    </Suspense>
  );
}
