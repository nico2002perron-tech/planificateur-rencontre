'use client';

/**
 * Bracket des séries — partagé entre la console organisateur et la page
 * publique en direct. Colonnes par ronde (Quarts | Demis | Bronze + Finale),
 * défilement horizontal sur mobile. Une case non résolue affiche sa source
 * (« 1er au classement », « Gagnant M9 ») en gris.
 */

export interface BracketMatch {
  id: string;
  phase: string;                 // quart | demi | bronze | finale
  match_number: number;
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

interface BracketProps {
  matches: BracketMatch[];                                   // parties de séries seulement
  teamName: (id: string | null, source: string) => string;
  highlightTeam?: string;                                    // équipe du joueur (page publique)
  multiDay?: boolean;
  accent?: string;                                           // couleur d'accent (défaut bleu GFSF)
}

const COLUMN_TITLES: Record<string, string> = {
  quart: 'Quarts de finale', demi: 'Demi-finales', bronze: 'Bronze', finale: 'Finale',
};

function shortDay(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-CA', { weekday: 'short' });
}

function Slot({ name, resolved, score, winner, highlighted, accent }: {
  name: string; resolved: boolean; score: number | null; winner: boolean; highlighted: boolean; accent: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2"
      style={{ backgroundColor: highlighted ? `${accent}14` : 'transparent' }}>
      <span className="text-sm truncate"
        style={{
          fontWeight: 800,
          color: !resolved ? '#94a3b8' : winner ? '#15803d' : '#1e293b',
          fontStyle: resolved ? 'normal' : 'italic',
        }}>
        {name}
      </span>
      {score !== null && (
        <span className="text-sm font-extrabold tabular-nums flex-shrink-0"
          style={{ color: winner ? '#15803d' : '#94a3b8' }}>
          {score}
        </span>
      )}
    </div>
  );
}

export default function Bracket({ matches, teamName, highlightTeam, multiDay, accent = '#0077b6' }: BracketProps) {
  const phases = ['quart', 'demi', 'bronze', 'finale'].filter(p => matches.some(m => m.phase === p));
  if (phases.length === 0) return null;

  // Champion : gagnant de la finale terminée (sans égalité). Bannière festive.
  const finale = matches.find(m => m.phase === 'finale');
  const champId = finale && finale.status === 'finished' && finale.score_a !== null && finale.score_b !== null && finale.score_a !== finale.score_b
    ? (finale.score_a > finale.score_b ? finale.team_a_id : finale.team_b_id)
    : null;
  const championName = champId ? teamName(champId, '') : null;

  // Bronze et finale partagent la dernière colonne (empilés)
  const columns: { title: string; items: BracketMatch[] }[] = [];
  for (const p of phases) {
    const items = matches.filter(m => m.phase === p).sort((a, b) => a.match_number - b.match_number);
    if (p === 'bronze' && phases.includes('finale')) continue;
    if (p === 'finale' && phases.includes('bronze')) {
      columns.push({
        title: 'Finale',
        items: [...items, ...matches.filter(m => m.phase === 'bronze')],
      });
    } else {
      columns.push({ title: COLUMN_TITLES[p] || p, items });
    }
  }

  return (
    <div>
      {championName && (
        <div className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 mb-3 text-center"
          style={{ background: 'linear-gradient(90deg,#fffbeb,#fef3c7,#fffbeb)', border: '1.5px solid #f59e0b' }}>
          <span className="text-2xl" aria-hidden>🏆</span>
          <span className="text-base font-extrabold" style={{ color: '#b45309' }}>
            Champion : <span style={{ color: '#92400e' }}>{championName}</span>
          </span>
        </div>
      )}
    <div className="overflow-x-auto pb-1 -mx-1 px-1">
      <div className="flex gap-3 items-stretch w-max min-w-full">
        {columns.map(col => (
          <div key={col.title} className="flex flex-col justify-around gap-3 min-w-[190px] flex-1">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400 text-center -mb-1">{col.title}</p>
            {col.items.map(m => {
              const finished = m.status === 'finished' && m.score_a !== null && m.score_b !== null;
              const aWins = finished && (m.score_a as number) > (m.score_b as number);
              const bWins = finished && (m.score_b as number) > (m.score_a as number);
              const isFinal = m.phase === 'finale';
              return (
                <div key={m.id} className="rounded-xl bg-white overflow-hidden"
                  style={{ border: isFinal ? `2px solid ${accent}80` : '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(2,6,23,0.06)' }}>
                  <div className="flex items-center justify-between px-3 pt-1.5 text-[10px] font-extrabold text-slate-400">
                    <span>{m.phase === 'bronze' ? '🥉 Bronze · ' : isFinal ? '🏆 ' : ''}M{m.match_number}</span>
                    <span>{multiDay && m.scheduled_date ? `${shortDay(m.scheduled_date)} ` : ''}{m.scheduled_time}</span>
                  </div>
                  <Slot
                    name={teamName(m.team_a_id, m.source_a)}
                    resolved={!!m.team_a_id}
                    score={m.score_a}
                    winner={aWins}
                    highlighted={!!highlightTeam && m.team_a_id === highlightTeam}
                    accent={accent}
                  />
                  <div style={{ height: 1, backgroundColor: '#f1f5f9' }} />
                  <Slot
                    name={teamName(m.team_b_id, m.source_b)}
                    resolved={!!m.team_b_id}
                    score={m.score_b}
                    winner={bWins}
                    highlighted={!!highlightTeam && m.team_b_id === highlightTeam}
                    accent={accent}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}
