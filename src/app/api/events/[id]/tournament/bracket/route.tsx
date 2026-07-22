import { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import { createClient } from '@/lib/supabase/server';
import { fetchTournamentState, type TournamentMatch } from '@/lib/tournament/state';

// GET /api/events/[id]/tournament/bracket — image PNG du bracket des séries.
// Publique (embarquée dans les courriels : les clients courriel la chargent à
// l'ouverture, donc elle montre toujours l'état PUBLIÉ le plus récent).
// Un paramètre ?ts=… à l'envoi contourne les caches d'images (Gmail…).

const NAVY = '#03045e';
const BLUE = '#0077b6';
const GREEN = '#15803d';
const SLATE = '#94a3b8';
const DARK = '#1e293b';

const COLUMN_TITLES: Record<string, string> = {
  quart: 'QUARTS', demi: 'DEMI-FINALES', bronze: 'BRONZE', finale: 'FINALE',
};

function MatchBox({ m, nameOf }: { m: TournamentMatch; nameOf: (id: string | null, source: string) => string }) {
  const finished = m.status === 'finished' && m.score_a !== null && m.score_b !== null;
  const aWins = finished && (m.score_a as number) > (m.score_b as number);
  const bWins = finished && (m.score_b as number) > (m.score_a as number);
  const row = (id: string | null, source: string, score: number | null, winner: boolean) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px' }}>
      <span style={{
        fontSize: 16, fontWeight: 700, maxWidth: 190, overflow: 'hidden',
        color: !id ? SLATE : winner ? GREEN : DARK,
        fontStyle: id ? 'normal' : 'italic',
      }}>
        {nameOf(id, source)}
      </span>
      {score !== null && (
        <span style={{ fontSize: 16, fontWeight: 800, color: winner ? GREEN : SLATE }}>{score}</span>
      )}
    </div>
  );
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', width: 250, backgroundColor: '#ffffff',
      borderRadius: 12, border: m.phase === 'finale' ? `3px solid ${BLUE}` : '1px solid #e2e8f0',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px 0', fontSize: 11, fontWeight: 800, color: SLATE }}>
        <span>{m.phase === 'bronze' ? 'BRONZE · ' : ''}M{m.match_number}</span>
        <span>{m.scheduled_time}</span>
      </div>
      {row(m.team_a_id, m.source_a, m.score_a, aWins)}
      <div style={{ display: 'flex', height: 1, backgroundColor: '#f1f5f9' }} />
      {row(m.team_b_id, m.source_b, m.score_b, bWins)}
    </div>
  );
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const supabase = createClient();

  // État PUBLIÉ : l'image montre ce que le site montre, jamais un brouillon
  const state = await fetchTournamentState(supabase, eventId, false);
  const playoffs = (state?.matches || []).filter(m => m.phase !== 'garantie');

  const teamNames = new Map((state?.teams || []).map(t => [t.id, t.name]));
  const nameOf = (id: string | null, source: string) => (id ? teamNames.get(id) : '') || source || 'À déterminer';

  const phases = ['quart', 'demi', 'bronze', 'finale'].filter(p => playoffs.some(m => m.phase === p));
  const columns: { title: string; items: TournamentMatch[] }[] = [];
  for (const p of phases) {
    const items = playoffs.filter(m => m.phase === p).sort((a, b) => a.match_number - b.match_number);
    if (p === 'bronze' && phases.includes('finale')) continue;
    if (p === 'finale' && phases.includes('bronze')) {
      columns.push({ title: 'FINALE', items: [...items, ...playoffs.filter(m => m.phase === 'bronze')] });
    } else {
      columns.push({ title: COLUMN_TITLES[p] || p.toUpperCase(), items });
    }
  }

  const width = 900;
  const height = 500;

  if (playoffs.length === 0) {
    return new ImageResponse(
      (
        <div style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', backgroundColor: '#f2f6fa',
        }}>
          <span style={{ fontSize: 34, fontWeight: 800, color: NAVY }}>Séries à venir</span>
          <span style={{ fontSize: 18, color: SLATE, marginTop: 10 }}>Le bracket apparaîtra ici dès qu&apos;il sera publié.</span>
        </div>
      ),
      { width, height: 300 },
    );
  }

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        backgroundColor: '#f2f6fa', padding: 28,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: NAVY }}>Séries éliminatoires</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: SLATE }}>{state?.event.title || ''}</span>
        </div>
        <div style={{ display: 'flex', flex: 1, gap: 24 }}>
          {columns.map(col => (
            <div key={col.title} style={{
              display: 'flex', flexDirection: 'column', justifyContent: 'space-around',
              flex: 1, gap: 12, alignItems: 'center',
            }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: SLATE, letterSpacing: 2 }}>{col.title}</span>
              {col.items.map(m => <MatchBox key={m.id} m={m} nameOf={nameOf} />)}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      width,
      height,
      headers: {
        // Les clients courriel rechargent l'image à l'ouverture → toujours à jour
        'Cache-Control': 'public, max-age=60',
      },
    },
  );
}
