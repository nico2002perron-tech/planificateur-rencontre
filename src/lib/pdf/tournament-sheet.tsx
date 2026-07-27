/**
 * « Feuille de tournoi » — PDF complet, utile AVANT (imprimé vierge, on écrit
 * les scores au crayon aux terrains) ET PENDANT (état en direct).
 *
 * Contenu : en-tête, HORAIRE avec cases de pointage (remplies ou vides),
 * CLASSEMENT avec la ligne des séries (qui passe / qui sort), SÉRIES (bracket
 * par ronde + champion). Police Helvetica intégrée (aucun fichier à charger),
 * sans émoji (Helvetica ne les rend pas) : les statuts sont en toutes lettres.
 */
import React from 'react';
import { Document, Page, View, Text, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import type { StandingRow } from '../tournament/standings';
import type { TournamentMatch } from '../tournament/state';
import { computeQualification, type QualStatus } from '../tournament/qualification';

export interface SheetInput {
  event: { title: string; date: string; location: string };
  config: {
    guaranteed_games: number;
    playoffs_enabled: boolean;
    playoffs_team_count: number;
    points_win: number;
    points_tie: number;
    points_loss: number;
  };
  teams: { id: string; name: string }[];
  matches: TournamentMatch[];
  standings: StandingRow[];
  /** « mis à jour le … » ; absent = feuille vierge à imprimer. */
  updatedLabel?: string;
}

const NAVY = '#0f2a4a';
const BLUE = '#2563eb';
const GREEN = '#15803d';
const GREY = '#94a3b8';
const LINE = '#e2e8f0';

const s = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 34, paddingHorizontal: 30, fontFamily: 'Helvetica', color: '#0f172a', fontSize: 9 },
  // En-tête
  header: { backgroundColor: NAVY, borderRadius: 8, padding: 14, marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  kicker: { color: '#93c5fd', fontSize: 7.5, fontFamily: 'Helvetica-Bold', letterSpacing: 1.2 },
  title: { color: '#ffffff', fontSize: 17, fontFamily: 'Helvetica-Bold', marginTop: 3 },
  sub: { color: '#cbd5e1', fontSize: 8.5, marginTop: 3 },
  updated: { color: '#93c5fd', fontSize: 7.5 },
  // Sections
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: NAVY, marginTop: 6, marginBottom: 6 },
  sectionNote: { fontSize: 8, color: GREY, fontFamily: 'Helvetica' },
  dayHeader: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: BLUE, marginTop: 8, marginBottom: 3, textTransform: 'uppercase' },
  // Rangée de partie
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3.5, borderBottomWidth: 0.5, borderBottomColor: LINE },
  time: { width: 34, fontFamily: 'Helvetica-Bold', fontSize: 8.5 },
  court: { width: 26, fontSize: 7.5, color: GREY },
  phaseTag: { width: 40, fontSize: 6.5, color: BLUE, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  teamR: { flex: 1, textAlign: 'right', paddingRight: 6, fontSize: 8.5 },
  teamL: { flex: 1, textAlign: 'left', paddingLeft: 6, fontSize: 8.5 },
  box: { width: 24, height: 15, borderWidth: 1, borderColor: '#94a3b8', borderRadius: 3, textAlign: 'center', paddingTop: 2.5, fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
  dash: { width: 10, textAlign: 'center', color: GREY },
  // Classement
  th: { flexDirection: 'row', alignItems: 'center', backgroundColor: NAVY, paddingVertical: 4, paddingHorizontal: 6, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  thc: { color: '#ffffff', fontSize: 7.5, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3.5, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: LINE },
  cutLine: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3, paddingHorizontal: 6, backgroundColor: '#eff6ff' },
  cutText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: BLUE, textTransform: 'uppercase', letterSpacing: 0.5 },
  // Bracket
  champBanner: { backgroundColor: '#fffbeb', borderWidth: 1.2, borderColor: '#f59e0b', borderRadius: 7, padding: 10, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  champText: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#b45309' },
  brRound: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: GREY, textTransform: 'uppercase', marginTop: 6, marginBottom: 2, letterSpacing: 0.5 },
  brRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: LINE },
});

// ── Utilitaires ──
const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
function frDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${WEEKDAYS[d.getDay()]} ${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}`;
}
const PHASE_SHORT: Record<string, string> = { quart: 'Quart', demi: 'Demi', bronze: 'Bronze', finale: 'Finale' };
const STATUS_COLOR: Record<QualStatus, string> = {
  champion: '#b45309', finalist: NAVY, bronze: '#b45309', qualified: GREEN,
  contention: '#334155', eliminated: GREY, none: '#334155',
};

/** Une case de pointage : score si connu (gagnant en gras implicite), sinon vide. */
function ScoreBox({ value, win }: { value: number | null; win: boolean }) {
  return (
    <Text style={[s.box, win ? { borderColor: GREEN, color: GREEN } : {}]}>
      {value === null ? ' ' : String(value)}
    </Text>
  );
}

export function TournamentSheet({ input }: { input: SheetInput }) {
  const { event, config, teams, matches, standings } = input;
  const nameOf = (id: string | null) => (id ? teams.find(t => t.id === id)?.name ?? '—' : '—');
  const qual = computeQualification(standings, matches, {
    playoffsEnabled: config.playoffs_enabled,
    playoffSize: config.playoffs_team_count,
  });

  const garantie = matches.filter(m => m.phase === 'garantie').sort((a, b) => a.match_number - b.match_number);
  const playoffs = matches.filter(m => m.phase !== 'garantie' && m.status !== 'cancelled').sort((a, b) => a.match_number - b.match_number);

  // Regroupe l'horaire garanti par journée (date '' = journée de l'événement).
  const days = [...new Set(garantie.map(m => m.scheduled_date || ''))];
  const multiDay = days.filter(Boolean).length > 1;

  const sideLabel = (m: TournamentMatch, side: 'a' | 'b') => {
    const id = side === 'a' ? m.team_a_id : m.team_b_id;
    if (id) return nameOf(id);
    const src = side === 'a' ? m.source_a : m.source_b;
    return src || 'À déterminer';
  };
  const win = (m: TournamentMatch, side: 'a' | 'b') =>
    m.status === 'finished' && m.score_a !== null && m.score_b !== null && m.score_a !== m.score_b &&
    (side === 'a' ? m.score_a > m.score_b : m.score_b > m.score_a);

  const MatchRow = ({ m, showPhase }: { m: TournamentMatch; showPhase?: boolean }) => (
    <View style={s.row} wrap={false}>
      <Text style={s.time}>{m.scheduled_time || '—'}</Text>
      <Text style={s.court}>T{m.court}</Text>
      {showPhase && <Text style={s.phaseTag}>{PHASE_SHORT[m.phase] ?? ''}</Text>}
      <Text style={[s.teamR, win(m, 'a') ? { fontFamily: 'Helvetica-Bold', color: GREEN } : {}]}>{sideLabel(m, 'a')}</Text>
      <ScoreBox value={m.score_a} win={win(m, 'a')} />
      <Text style={s.dash}>–</Text>
      <ScoreBox value={m.score_b} win={win(m, 'b')} />
      <Text style={[s.teamL, win(m, 'b') ? { fontFamily: 'Helvetica-Bold', color: GREEN } : {}]}>{sideLabel(m, 'b')}</Text>
    </View>
  );

  const dayLabel = (d: string) => (d ? frDate(d) : (event.date ? frDate(event.date) : 'Journée du tournoi'));

  return (
    <Document title={`Feuille de tournoi — ${event.title}`}>
      <Page size="A4" style={s.page}>
        {/* En-tête */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.kicker}>FEUILLE DE TOURNOI</Text>
            <Text style={s.title}>{event.title}</Text>
            <Text style={s.sub}>
              {multiDay ? `${dayLabel(days.filter(Boolean)[0])} → ${dayLabel(days.filter(Boolean).slice(-1)[0])}` : dayLabel(days[0] ?? '')}
              {event.location ? `  ·  ${event.location}` : ''}
              {`  ·  ${config.guaranteed_games} partie${config.guaranteed_games > 1 ? 's' : ''} garantie${config.guaranteed_games > 1 ? 's' : ''}`}
            </Text>
          </View>
          <Text style={s.updated}>{input.updatedLabel ?? 'Feuille à remplir'}</Text>
        </View>

        {/* HORAIRE */}
        <Text style={s.sectionTitle}>Horaire &amp; pointages</Text>
        {garantie.length === 0 ? (
          <Text style={s.sectionNote}>Aucune partie générée pour l&apos;instant.</Text>
        ) : (
          days.map(d => (
            <View key={`day-${d}`}>
              {(multiDay || d) && <Text style={s.dayHeader}>{dayLabel(d)}</Text>}
              {garantie.filter(m => (m.scheduled_date || '') === d).map(m => <MatchRow key={m.id} m={m} />)}
            </View>
          ))
        )}

        {/* CLASSEMENT */}
        {standings.length > 0 && (
          <>
            <Text style={s.sectionTitle}>
              Classement <Text style={s.sectionNote}>(phase garantie — {config.points_win} pt/victoire, {config.points_tie} nulle)</Text>
            </Text>
            <View style={s.th}>
              <Text style={[s.thc, { width: 18, textAlign: 'left' }]}>#</Text>
              <Text style={[s.thc, { flex: 1, textAlign: 'left' }]}>Équipe</Text>
              <Text style={[s.thc, { width: 20 }]}>J</Text>
              <Text style={[s.thc, { width: 20 }]}>V</Text>
              <Text style={[s.thc, { width: 20 }]}>N</Text>
              <Text style={[s.thc, { width: 20 }]}>D</Text>
              <Text style={[s.thc, { width: 34 }]}>+/−</Text>
              <Text style={[s.thc, { width: 26 }]}>Pts</Text>
              <Text style={[s.thc, { width: 84, textAlign: 'right' }]}>Statut</Text>
            </View>
            {standings.map((r, i) => {
              const tq = qual.byTeam.get(r.teamId);
              const showCut = qual.playoffSize > 0 && qual.guaranteedComplete && i === qual.cutRank && qual.cutRank < standings.length;
              return (
                <View key={r.teamId} wrap={false}>
                  {showCut && (
                    <View style={s.cutLine}>
                      <Text style={s.cutText}>
                        {`——  Ligne des séries : les ${qual.playoffSize} premières passent  ——`}
                      </Text>
                    </View>
                  )}
                  <View style={[s.tr, tq && !tq.inPlayoffs && qual.guaranteedComplete ? { backgroundColor: '#f8fafc' } : {}]}>
                    <Text style={{ width: 18, fontFamily: 'Helvetica-Bold' }}>{r.rank}</Text>
                    <Text style={{ flex: 1, fontFamily: tq?.inPlayoffs ? 'Helvetica-Bold' : 'Helvetica' }}>{r.teamName}</Text>
                    <Text style={{ width: 20, textAlign: 'center', color: GREY }}>{r.played}</Text>
                    <Text style={{ width: 20, textAlign: 'center' }}>{r.wins}</Text>
                    <Text style={{ width: 20, textAlign: 'center' }}>{r.ties}</Text>
                    <Text style={{ width: 20, textAlign: 'center' }}>{r.losses}</Text>
                    <Text style={{ width: 34, textAlign: 'center', color: r.diff > 0 ? GREEN : r.diff < 0 ? '#b91c1c' : GREY }}>{r.diff > 0 ? '+' : ''}{r.diff}</Text>
                    <Text style={{ width: 26, textAlign: 'center', fontFamily: 'Helvetica-Bold' }}>{r.points}</Text>
                    <Text style={{ width: 84, textAlign: 'right', fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: STATUS_COLOR[tq?.status ?? 'none'] }}>
                      {tq?.label ?? ''}
                    </Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* SÉRIES */}
        {playoffs.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Séries éliminatoires</Text>
            {qual.championId && (
              <View style={s.champBanner}>
                <Text style={s.champText}>CHAMPION : {nameOf(qual.championId)}</Text>
              </View>
            )}
            {['quart', 'demi', 'bronze', 'finale'].map(phase => {
              const ms = playoffs.filter(m => m.phase === phase);
              if (ms.length === 0) return null;
              return (
                <View key={`ph-${phase}`}>
                  <Text style={s.brRound}>{phase === 'bronze' ? 'Petite finale (3e place)' : PHASE_SHORT[phase]}</Text>
                  {ms.map(m => <MatchRow key={m.id} m={m} showPhase={false} />)}
                </View>
              );
            })}
            {qual.guaranteedComplete && (qual.runnerUpId || qual.bronzeId) && (
              <Text style={[s.sectionNote, { marginTop: 6 }]}>
                {qual.championId ? `Champion : ${nameOf(qual.championId)}. ` : ''}
                {qual.runnerUpId ? `Finaliste : ${nameOf(qual.runnerUpId)}. ` : ''}
                {qual.bronzeId ? `Bronze : ${nameOf(qual.bronzeId)}.` : ''}
              </Text>
            )}
          </>
        )}
      </Page>
    </Document>
  );
}

/** Rend la feuille en Buffer PDF (route API ou script de prévisualisation). */
export function renderTournamentSheet(input: SheetInput): Promise<Buffer> {
  return renderToBuffer(<TournamentSheet input={input} />);
}
