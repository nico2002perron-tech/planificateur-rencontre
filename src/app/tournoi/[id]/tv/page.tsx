'use client';

/**
 * MODE TV — à projeter au gymnase (public, sans connexion).
 * Fond marine, gros caractères, rafraîchi aux 10 s.
 * Gauche : parties en cours + prochaines. Droite : classement, en alternance
 * automatique avec le bracket des séries quand il existe (15 s).
 */

import { useState, useEffect, useMemo, useCallback, use } from 'react';
import { Loader2 } from 'lucide-react';
import { DessinTerrain } from '@/components/tournament/SchemaTerrain';
import { nombreTerrains, nomTerrain, normaliserSport, journeeCourante } from '@/lib/tournament/terrains';

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
  played: number; wins: number; ties: number; losses: number; diff: number; points: number;
}

interface TournamentState {
  event: { id: string; title: string; date: string; location: string };
  config: { status: 'draft' | 'published'; sport?: string; courts?: number } | null;
  teams: Team[];
  matches: Match[];
  standings: Standing[];
  published_at: string | null;
}

const PHASE_LABELS: Record<string, string> = {
  quart: 'QUART', demi: 'DEMI-FINALE', bronze: 'BRONZE', finale: 'FINALE',
};

export default function TournamentTvPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  const [state, setState] = useState<TournamentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<'classement' | 'series'>('classement');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/tournament`, { cache: 'no-store' });
      if (res.ok) setState(await res.json());
    } catch {
      // le prochain tick réessaie
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [load]);

  const playoffMatches = useMemo(() => (state?.matches || []).filter(m => m.phase !== 'garantie'), [state?.matches]);

  // Alternance automatique Classement ↔ Séries quand les séries existent
  useEffect(() => {
    if (playoffMatches.length === 0) { setPanel('classement'); return; }
    const timer = setInterval(() => setPanel(p => (p === 'classement' ? 'series' : 'classement')), 15000);
    return () => clearInterval(timer);
  }, [playoffMatches.length]);

  const teamName = useMemo(() => {
    const map = new Map((state?.teams || []).map(t => [t.id, t.name]));
    return (id: string | null, source: string) => (id ? map.get(id) : '') || source || 'À déterminer';
  }, [state?.teams]);

  // L'écran ne montre QUE la journée en cours : au gymnase, personne n'a
  // besoin de voir le lendemain pendant que ça joue.
  const sport = normaliserSport(state?.config?.sport);
  const jourAffiche = useMemo(
    () => journeeCourante(state?.matches || [], state?.event.date || ''),
    [state?.matches, state?.event.date],
  );

  // Un tableau par TERRAIN : ce qui s'y joue maintenant, puis ce qui s'en vient
  // SUR CE TERRAIN. Les terrains ne sont jamais fondus en une seule liste.
  const parTerrain = useMemo(() => {
    const ms = (state?.matches || []).filter(m => (m.scheduled_date || state?.event.date || '') === jourAffiche);
    const nb = nombreTerrains(state?.matches || [], state?.config?.courts ?? 1);
    return Array.from({ length: nb }, (_, i) => {
      const court = i + 1;
      const aJouer = ms
        .filter(m => Math.max(Math.floor(m.court) || 1, 1) === court && m.status !== 'finished' && m.status !== 'cancelled')
        .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));
      const enCours = aJouer.find(m => m.status === 'in_progress') ?? aJouer[0] ?? null;
      return {
        court,
        enCours,
        suite: aJouer.filter(m => m.id !== enCours?.id).slice(0, 3),
      };
    });
  }, [state, jourAffiche]);

  // Sur plusieurs jours, l'écran dit clairement quelle journée il montre.
  const joursTournoi = useMemo(
    () => [...new Set((state?.matches || []).map(m => m.scheduled_date || state?.event.date || ''))].filter(Boolean).sort(),
    [state],
  );
  const etiquetteJour = joursTournoi.length > 1 && jourAffiche
    ? new Date(jourAffiche + 'T12:00:00').toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' })
    : '';

  if (loading || !state) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#03045e' }}>
        <Loader2 className="h-14 w-14 animate-spin text-white" />
      </div>
    );
  }

  const published = state.config?.status === 'published' && state.matches.length > 0;

  return (
    <div className="min-h-screen text-white flex flex-col" style={{ background: 'linear-gradient(160deg, #03045e 0%, #023e8a 60%, #0057a3 100%)' }}>
      {/* En-tête */}
      <div className="flex items-center justify-between px-10 pt-7 pb-4">
        <div>
          <div className="flex items-center gap-3 text-sm font-extrabold uppercase tracking-widest opacity-80">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: '#7CFC00' }} />
              <span className="relative inline-flex rounded-full h-3 w-3" style={{ backgroundColor: '#7CFC00' }} />
            </span>
            En direct
          </div>
          <h1 className="text-4xl font-extrabold mt-1">{state.event.title}</h1>
        </div>
      </div>

      {!published ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-3xl font-extrabold opacity-80">L&apos;horaire sera publié bientôt…</p>
        </div>
      ) : (
        <div className="flex-1 flex gap-8 px-10 pb-8 min-h-0">
          {/* Colonne gauche : UN TABLEAU PAR TERRAIN, jamais fondus ensemble */}
          <div className="flex-[3] flex flex-col gap-4 min-w-0">
            <p className="text-sm font-extrabold uppercase tracking-widest opacity-70">
              🏟️ Sur les terrains{etiquetteJour ? ` · ${etiquetteJour}` : ''}
            </p>
            <div className="grid gap-4 flex-1 min-h-0" style={{ gridTemplateColumns: `repeat(${Math.min(parTerrain.length, 2)}, minmax(0, 1fr))` }}>
              {parTerrain.map(({ court, enCours, suite }) => (
                <div key={court} className="rounded-3xl bg-white/10 backdrop-blur px-6 py-5 flex flex-col min-w-0">
                  {/* En-tête : le terrain dessiné + son nom */}
                  <div className="flex items-center gap-3 mb-3">
                    <DessinTerrain sport={sport} court={court} variante="sombre" style={{ width: 62, height: 'auto', flexShrink: 0 }} />
                    <span className="text-2xl font-extrabold tracking-wide">{nomTerrain(court).toUpperCase()}</span>
                  </div>

                  {/* Ce qui s'y joue maintenant */}
                  {!enCours ? (
                    <div className="rounded-2xl bg-white/[0.06] px-5 py-6 text-center text-xl font-extrabold opacity-60">
                      🏁 Terrain libre
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-white/[0.10] px-5 py-4">
                      <div className="flex items-center justify-between text-xs font-extrabold opacity-75 mb-2">
                        <span>{enCours.status === 'in_progress' ? 'EN COURS' : 'PROCHAINE'}{enCours.phase !== 'garantie' ? ` · ${PHASE_LABELS[enCours.phase] || ''}` : ''}</span>
                        <span className="tabular-nums">{enCours.scheduled_time}</span>
                      </div>
                      {/* Une équipe par ligne : les noms longs restent lisibles de loin */}
                      {([
                        { id: enCours.team_a_id, source: enCours.source_a, score: enCours.score_a },
                        { id: enCours.team_b_id, source: enCours.source_b, score: enCours.score_b },
                      ]).map((e, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 py-0.5">
                          <span className="text-3xl font-extrabold truncate">{teamName(e.id, e.source)}</span>
                          <span className="text-3xl font-extrabold tabular-nums flex-shrink-0 opacity-90">
                            {e.score === null ? '–' : e.score}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Puis la suite, sur CE terrain seulement */}
                  {suite.length > 0 && (
                    <div className="flex flex-col gap-2 mt-3">
                      <p className="text-[11px] font-extrabold uppercase tracking-widest opacity-60">⏭️ Ensuite ici</p>
                      {suite.map(m => (
                        <div key={m.id} className="rounded-xl bg-white/[0.06] px-4 py-2.5 flex items-center gap-4">
                          <span className="text-xl font-extrabold tabular-nums flex-shrink-0 w-[70px]">{m.scheduled_time}</span>
                          <span className="text-base font-extrabold truncate">
                            {teamName(m.team_a_id, m.source_a)} <span className="opacity-50">vs</span> {teamName(m.team_b_id, m.source_b)}
                          </span>
                          {m.phase !== 'garantie' && (
                            <span className="ml-auto text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-white/15 flex-shrink-0">{PHASE_LABELS[m.phase]}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Colonne droite : classement ⇄ séries */}
          <div className="flex-[2] min-w-0">
            {panel === 'series' && playoffMatches.length > 0 ? (
              <div className="rounded-3xl bg-white/10 backdrop-blur p-6 h-full flex flex-col">
                <p className="text-sm font-extrabold uppercase tracking-widest opacity-70 mb-4">🏆 Séries éliminatoires</p>
                <div className="flex flex-col gap-3 justify-around flex-1">
                  {playoffMatches.sort((a, b) => a.match_number - b.match_number).map(m => {
                    const finished = m.status === 'finished' && m.score_a !== null && m.score_b !== null;
                    const aWins = finished && (m.score_a as number) > (m.score_b as number);
                    const bWins = finished && (m.score_b as number) > (m.score_a as number);
                    return (
                      <div key={m.id} className="rounded-2xl bg-white/[0.08] px-5 py-3">
                        <p className="text-[11px] font-extrabold opacity-60 mb-1">{PHASE_LABELS[m.phase] || m.phase} · {m.scheduled_time}</p>
                        <div className="flex items-center justify-between gap-3 text-lg font-extrabold">
                          <span className="truncate" style={{ opacity: m.team_a_id ? (bWins ? 0.5 : 1) : 0.4, color: aWins ? '#7CFC00' : 'white' }}>
                            {teamName(m.team_a_id, m.source_a)}
                          </span>
                          <span className="tabular-nums flex-shrink-0 opacity-80">
                            {m.score_a !== null && m.score_b !== null ? `${m.score_a}–${m.score_b}` : ''}
                          </span>
                          <span className="truncate text-right" style={{ opacity: m.team_b_id ? (aWins ? 0.5 : 1) : 0.4, color: bWins ? '#7CFC00' : 'white' }}>
                            {teamName(m.team_b_id, m.source_b)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-3xl bg-white/10 backdrop-blur p-6 h-full flex flex-col">
                <p className="text-sm font-extrabold uppercase tracking-widest opacity-70 mb-4">🏅 Classement</p>
                <div className="flex flex-col gap-1.5 flex-1 justify-around">
                  {state.standings.slice(0, 10).map(r => (
                    <div key={r.teamId} className="flex items-center gap-4 rounded-xl px-4 py-2"
                      style={{ backgroundColor: r.rank <= 3 ? 'rgba(255,255,255,0.10)' : 'transparent' }}>
                      <span className="text-xl font-extrabold w-9 flex-shrink-0">
                        {r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : r.rank}
                      </span>
                      <span className="text-xl font-extrabold truncate flex-1">{r.teamName}</span>
                      <span className="text-sm font-bold opacity-70 flex-shrink-0">{r.wins}V-{r.losses}D</span>
                      <span className="text-xl font-extrabold tabular-nums w-12 text-right flex-shrink-0">{r.points}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <p className="text-center text-xs font-bold opacity-50 pb-4">
        Groupe Financier Ste-Foy · iA Gestion privée de patrimoine · mise à jour automatique
      </p>
    </div>
  );
}
