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
import { Document, Page, View, Text, StyleSheet, Svg, Rect, Line, Circle, Path, renderToBuffer } from '@react-pdf/renderer';
import type { StandingRow } from '../tournament/standings';
import type { TournamentMatch } from '../tournament/state';
import { computeQualification, type QualStatus } from '../tournament/qualification';
import {
  construireGrilleParJour, schemaTerrain, accentTerrain, nomTerrain, libelleTerrain,
  normaliserSport, LIBELLE_CASE_LIBRE, type SportId, type Forme,
} from '../tournament/terrains';

export interface SheetInput {
  event: { title: string; date: string; location: string };
  config: {
    guaranteed_games: number;
    /** Nombre de terrains — une colonne d'horaire par terrain. */
    courts?: number;
    /** Sport du tournoi — dessin du terrain en tête de colonne. */
    sport?: SportId;
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

/** Largeur de la colonne d'heures — le bandeau des terrains s'aligne dessus. */
const LARGEUR_HEURES = 30;

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
  // Bandeau des terrains, puis UNE grille : colonne d'heures + une colonne par terrain
  bandeau: { flexDirection: 'row', gap: 8, marginBottom: 5 },
  colonne: { flex: 1 },
  enteteTerrain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 6, padding: 5 },
  nomTerrain: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  sousTerrain: { fontSize: 6.5, marginTop: 1 },
  ligneHeure: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 3 },
  heure: { width: 30, fontFamily: 'Helvetica-Bold', fontSize: 8.5, paddingTop: 6, textAlign: 'right' },
  // Pas de `flex: 1` ici : la case est empilée dans une colonne, où `flex`
  // agirait sur la HAUTEUR et l'écraserait à zéro (les équipes se superposent).
  cellule: { borderWidth: 0.7, borderColor: LINE, borderRadius: 4, paddingVertical: 2, paddingHorizontal: 5, marginBottom: 2 },
  celluleLibre: { flex: 1, borderWidth: 0.7, borderColor: '#eef2f7', borderRadius: 4, paddingVertical: 7, alignItems: 'center' },
  texteLibre: { fontSize: 7, color: '#cbd5e1', fontFamily: 'Helvetica-Bold' },
  // Hauteur explicite : react-pdf ne réserve pas la place d'une case de
  // pointage (Text à hauteur fixe) dans le calcul de la rangée.
  ligneEquipe: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 18 },
  nomEquipe: { flex: 1, fontSize: 8, paddingRight: 4 },
  etiquettePhase: { fontSize: 6, color: BLUE, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 1 },
  // Rangée de partie (séries)
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

/**
 * Le terrain dessiné — exactement les mêmes formes que le web
 * (`lib/tournament/terrains.ts`), pour que le terrain A soit reconnaissable
 * autant sur la feuille imprimée qu'à l'écran.
 */
function TerrainPdf({ sport, court, largeur = 44 }: { sport: SportId; court: number; largeur?: number }) {
  const schema = schemaTerrain(sport);
  const accent = accentTerrain(court);
  const hauteur = (largeur * schema.hauteur) / schema.largeur;
  const peinture = (f: Forme) => {
    switch (f.role) {
      case 'surface': return { fill: accent.pale, stroke: accent.base, strokeWidth: 1.2 };
      case 'zone': return { fill: '#dde5ee', stroke: 'none', strokeWidth: 0 };
      case 'trait': return { fill: 'none', stroke: '#9aa8b8', strokeWidth: 0.9 };
      case 'filet': return { fill: 'none', stroke: '#64748b', strokeWidth: 1.4 };
      case 'objet': return { fill: '#64748b', stroke: 'none', strokeWidth: 0 };
    }
  };
  return (
    <Svg viewBox={`0 0 ${schema.largeur} ${schema.hauteur}`} width={largeur} height={hauteur}>
      {schema.formes.map((f, i) => {
        const p = peinture(f);
        switch (f.forme) {
          case 'rect':
            return <Rect key={i} x={f.x} y={f.y} width={f.l} height={f.h} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} />;
          case 'ligne':
            return <Line key={i} x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke={p.stroke === 'none' ? p.fill : p.stroke} strokeWidth={p.strokeWidth || 1} />;
          case 'cercle':
            return <Circle key={i} cx={f.cx} cy={f.cy} r={f.r} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} />;
          case 'chemin':
            return <Path key={i} d={f.d} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} />;
        }
      })}
    </Svg>
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

  // Regroupe l'horaire garanti par journée (date '' = journée de l'événement),
  // puis par TERRAIN : une colonne chacun, avec la même échelle d'heures.
  const sport = normaliserSport(config.sport);
  const grilles = construireGrilleParJour(garantie, config.courts ?? 1);
  const days = grilles.map(g => g.date);
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

  /** Une partie dans la colonne de son terrain : deux équipes empilées, une
      case de pointage chacune — on écrit au crayon directement dessus. */
  const CelluleMatch = ({ m }: { m: TournamentMatch }) => (
    <View style={s.cellule}>
      {m.phase !== 'garantie' && PHASE_SHORT[m.phase] && (
        <Text style={s.etiquettePhase}>{PHASE_SHORT[m.phase]}</Text>
      )}
      <View style={s.ligneEquipe}>
        <Text style={[s.nomEquipe, win(m, 'a') ? { fontFamily: 'Helvetica-Bold', color: GREEN } : {}]}>
          {sideLabel(m, 'a')}
        </Text>
        <ScoreBox value={m.score_a} win={win(m, 'a')} />
      </View>
      <View style={[s.ligneEquipe, { borderTopWidth: 0.5, borderTopColor: '#f1f5f9' }]}>
        <Text style={[s.nomEquipe, win(m, 'b') ? { fontFamily: 'Helvetica-Bold', color: GREEN } : {}]}>
          {sideLabel(m, 'b')}
        </Text>
        <ScoreBox value={m.score_b} win={win(m, 'b')} />
      </View>
      {m.status === 'cancelled' && <Text style={{ fontSize: 6, color: GREY, marginTop: 1 }}>Partie annulée</Text>}
    </View>
  );

  const MatchRow = ({ m, showPhase }: { m: TournamentMatch; showPhase?: boolean }) => (
    <View style={s.row} wrap={false}>
      <Text style={s.time}>{m.scheduled_time || '—'}</Text>
      <Text style={s.court}>{libelleTerrain(m.court)}</Text>
      {showPhase && <Text style={s.phaseTag}>{PHASE_SHORT[m.phase] ?? ''}</Text>}
      <Text style={[s.teamR, win(m, 'a') ? { fontFamily: 'Helvetica-Bold', color: GREEN } : {}]}>{sideLabel(m, 'a')}</Text>
      <ScoreBox value={m.score_a} win={win(m, 'a')} />
      <Text style={s.dash}>–</Text>
      <ScoreBox value={m.score_b} win={win(m, 'b')} />
      <Text style={[s.teamL, win(m, 'b') ? { fontFamily: 'Helvetica-Bold', color: GREEN } : {}]}>{sideLabel(m, 'b')}</Text>
    </View>
  );

  const dayLabel = (d: string) => (d ? frDate(d) : (event.date ? frDate(event.date) : 'Journée du tournoi'));
  const plageJours = multiDay
    // « au » et non « → » : Helvetica ne code pas la flèche (sortait en apostrophe).
    ? `${dayLabel(days.filter(Boolean)[0])} au ${dayLabel(days.filter(Boolean).slice(-1)[0])}`
    : dayLabel(days[0] ?? '');

  // Fonctions (et non composants) : ces morceaux ne portent aucun état, et
  // React n'aime pas voir naître un composant pendant le rendu.
  /** Le même bandeau en tête de chaque page : on sait toujours quelle feuille on tient. */
  const enTete = (sousTitre: string) => (
    <View style={s.header}>
      <View style={{ flex: 1 }}>
        <Text style={s.kicker}>FEUILLE DE TOURNOI</Text>
        <Text style={s.title}>{event.title}</Text>
        <Text style={s.sub}>
          {sousTitre}
          {event.location ? `  ·  ${event.location}` : ''}
          {`  ·  ${config.guaranteed_games} partie${config.guaranteed_games > 1 ? 's' : ''} garantie${config.guaranteed_games > 1 ? 's' : ''}`}
        </Text>
      </View>
      <Text style={s.updated}>{input.updatedLabel ?? 'Feuille à remplir'}</Text>
    </View>
  );

  /** Les terrains en bandeau, l'horaire dessous : UNE colonne d'heures pour tous. */
  const horaireDuJour = (grille: (typeof grilles)[number]['grille']) => (
    <>
      <View style={s.bandeau}>
        <View style={{ width: LARGEUR_HEURES }} />
        {grille.colonnes.map(col => {
          const accent = accentTerrain(col.terrain);
          return (
            <View key={`b-${col.terrain}`}
              style={[s.enteteTerrain, { backgroundColor: accent.pale, borderWidth: 0.8, borderColor: accent.base }]}
              wrap={false}>
              <TerrainPdf sport={sport} court={col.terrain} />
              <View>
                <Text style={[s.nomTerrain, { color: accent.fonce }]}>{nomTerrain(col.terrain)}</Text>
                <Text style={[s.sousTerrain, { color: accent.fonce }]}>
                  {col.nbParties === 0 ? 'Aucune partie' : `${col.nbParties} partie${col.nbParties > 1 ? 's' : ''}`}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
      {grille.heures.map((h, i) => (
        <View key={`h-${h}`} style={s.ligneHeure} wrap={false}>
          <Text style={s.heure}>{h}</Text>
          {grille.colonnes.map(col => (
            <View key={`c-${col.terrain}-${h}`} style={s.colonne}>
              {col.cases[i].length === 0 ? (
                <View style={s.celluleLibre}>
                  <Text style={s.texteLibre}>{LIBELLE_CASE_LIBRE}</Text>
                </View>
              ) : (
                col.cases[i].map(m => <CelluleMatch key={m.id} m={m} />)
              )}
            </View>
          ))}
        </View>
      ))}
    </>
  );

  return (
    <Document title={`Feuille de tournoi — ${event.title}`}>
      {/* UNE PAGE PAR JOURNÉE : la feuille du vendredi reste la feuille du vendredi */}
      {grilles.map(({ date, grille }) => (
        <Page key={`page-${date}`} size="A4" style={s.page}>
          {enTete(dayLabel(date))}
          <Text style={s.sectionTitle}>
            Horaire &amp; pointages{' '}
            <Text style={s.sectionNote}>(un terrain par colonne — « Libre » = rien de prévu à cette heure)</Text>
          </Text>
          {horaireDuJour(grille)}
        </Page>
      ))}

      {/* Classement et séries : leur propre page, à afficher à la table des pointages */}
      <Page size="A4" style={s.page}>
        {enTete(plageJours)}
        {garantie.length === 0 && (
          <Text style={s.sectionNote}>Aucune partie générée pour l&apos;instant.</Text>
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
