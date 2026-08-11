'use client';

/**
 * Console de tournoi — l'écran de l'organisateur le jour J (pensé mobile).
 *
 * 1. Configure (parties garanties, terrains, heure, durée) → Génère l'horaire.
 * 2. Publie → la page publique /tournoi/[id] devient vivante.
 * 3. « Envoyer l'horaire aux équipes » → chaque joueur reçoit SON horaire.
 * 4. Pendant le tournoi : saisis les pointages, le classement se met à jour seul.
 */

import { useState, useEffect, useMemo, useCallback, use, Fragment } from 'react';
import {
  Loader2, ArrowLeft, Trophy, CalendarClock, Send, RefreshCw, Eye, Copy, Check,
  AlertTriangle, MapPin, Medal, X, Pencil, ArrowLeftRight, Globe, Tv, Mail, FileText,
} from 'lucide-react';
import Bracket from '@/components/tournament/Bracket';
import GrilleHoraire from '@/components/tournament/GrilleHoraire';
import { computeQualification, type QualStatus } from '@/lib/tournament/qualification';
import type { TournamentMatch } from '@/lib/tournament/state';
import {
  construireGrilleParJour, journeeCourante, nomTerrain, libelleTerrain,
  normaliserSport, SPORTS, SPORT_PAR_DEFAUT, type SportId,
} from '@/lib/tournament/terrains';

// Couleur d'étiquette de qualification (qui passe / qui sort / champion)
const QUAL_COLOR: Record<QualStatus, string> = {
  champion: '#b45309', finalist: '#0f2a4a', bronze: '#b45309', qualified: '#15803d',
  contention: '#64748b', eliminated: '#94a3b8', none: '#64748b',
};

const PHASE_LABELS: Record<string, string> = {
  quart: 'Quart', demi: 'Demi-finale', bronze: 'Bronze', finale: 'FINALE',
};

const DUO = {
  green: '#58CC02', greenDark: '#45a300',
  blue: '#1CB0F6', blueDark: '#1899d6',
  orange: '#FF9600', orangeDark: '#e08600',
  red: '#FF4B4B',
} as const;

interface Day { date: string; start: string; end: string }

interface Config {
  guaranteed_games: number;
  courts: number;
  sport: SportId;
  start_time: string;
  days: Day[];
  game_minutes: number;
  break_minutes: number;
  playoffs_enabled: boolean;
  playoffs_team_count: number;
  points_win?: number;
  points_tie?: number;
  points_loss?: number;
  status: 'draft' | 'published';
  schedule_sent_at: string | null;
  published_at: string | null;
}

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
  config: Config | null;
  teams: Team[];
  matches: Match[];
  standings: Standing[];
  published_at: string | null;
  has_unpublished_changes?: boolean;
}

const DEFAULT_CONFIG: Config = {
  guaranteed_games: 2, courts: 2, sport: SPORT_PAR_DEFAUT, start_time: '09:00', days: [],
  game_minutes: 25, break_minutes: 5, playoffs_enabled: true, playoffs_team_count: 4,
  status: 'draft', schedule_sent_at: null, published_at: null,
};

function formatDayLong(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
}

// Journée suivante (YYYY-MM-DD + 1 jour) pour le bouton « Ajouter une journée »
function nextDate(dateStr: string): string {
  const d = new Date((dateStr || new Date().toISOString().slice(0, 10)) + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function TournamentConsolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  const [state, setState] = useState<TournamentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<Config>(DEFAULT_CONFIG);
  const [busy, setBusy] = useState('');           // 'config' | 'generate' | 'publish' | 'send' | match id
  const [toast, setToast] = useState('');
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [confirmRegenPlayoffs, setConfirmRegenPlayoffs] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [copied, setCopied] = useState(false);
  // Brouillons de pointage en cours de frappe (id de match → scores affichés)
  const [drafts, setDrafts] = useState<Record<string, { a: string; b: string }>>({});
  // Édition heure/terrain d'une partie (déplacer une partie avant ou pendant le tournoi)
  const [editing, setEditing] = useState<string>('');
  const [editDraft, setEditDraft] = useState<{ date: string; time: string; court: number }>({ date: '', time: '', court: 1 });
  // Mode « Échanger » : deux taps sur des noms d'équipes pour les échanger de place
  const [swapMode, setSwapMode] = useState(false);
  const [swapSel, setSwapSel] = useState<{ matchId: string; side: 'a' | 'b' } | null>(null);
  // Prévisualisation « Aviser les équipes » après un pointage (1 tap → courriels)
  const [notifyMatch, setNotifyMatch] = useState<Match | null>(null);
  // Décaler tout le reste (retard)
  const [confirmShift, setConfirmShift] = useState<number | null>(null);
  // Journée affichée (tournoi de plusieurs jours) — fixée au chargement sur la
  // journée en cours, puis elle ne bouge plus toute seule : saisir le dernier
  // pointage du vendredi ne doit pas faire sauter l'écran au samedi.
  const [jourChoisi, setJourChoisi] = useState<string>('');

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }, []);

  const applyState = useCallback((s: TournamentState) => {
    setState(s);
    // Première arrivée seulement (`prev ||`) : ensuite c'est Nicolas qui choisit.
    setJourChoisi(prev => prev || journeeCourante(s.matches, s.event.date));
    const fallbackDays = [{ date: s.event.date || '', start: s.config?.start_time || '09:00', end: '17:00' }];
    if (s.config) {
      const c = s.config;
      setForm({
        guaranteed_games: c.guaranteed_games,
        courts: c.courts,
        sport: normaliserSport(c.sport),
        start_time: c.start_time,
        days: Array.isArray(c.days) && c.days.length > 0 ? c.days : fallbackDays,
        game_minutes: c.game_minutes,
        break_minutes: c.break_minutes,
        playoffs_enabled: c.playoffs_enabled,
        playoffs_team_count: c.playoffs_team_count,
        status: c.status,
        schedule_sent_at: c.schedule_sent_at,
        published_at: c.published_at,
      });
    } else {
      // Pas encore de tournoi : préremplit une journée = date de l'événement
      setForm(f => (f.days.length === 0 ? { ...f, days: fallbackDays } : f));
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/events/${eventId}/tournament`);
        if (!res.ok) { setError('Impossible de charger le tournoi.'); return; }
        applyState(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId, applyState]);

  const teamName = useMemo(() => {
    const map = new Map((state?.teams || []).map(t => [t.id, t.name]));
    return (id: string | null, source: string) => (id ? map.get(id) : '') || source || 'À déterminer';
  }, [state?.teams]);

  // Horaire groupé par JOURNÉE puis par TERRAIN : chaque terrain garde son
  // propre fil d'heures, les deux fils partagent la même échelle (les trous
  // restent visibles). ('' = partie d'avant la v3 → date de l'événement)
  const grillesParJour = useMemo(
    () => construireGrilleParJour(state?.matches || [], form.courts, state?.event.date || ''),
    [state?.matches, form.courts, state?.event.date],
  );

  const multiDay = grillesParJour.length > 1 || form.days.length > 1;

  // La journée réellement affichée : le choix de l'organisateur s'il tient
  // encore (une régénération peut changer les dates), sinon la première.
  const jourAffiche = useMemo(() => {
    const dates = grillesParJour.map(j => j.date);
    return dates.includes(jourChoisi) ? jourChoisi : (dates[0] ?? '');
  }, [grillesParJour, jourChoisi]);

  // Conflits créés par des déplacements manuels — signalés en rouge, jamais
  // bloquants (inverser deux parties passe par un conflit temporaire).
  const conflicts = useMemo(() => {
    const map = new Map<string, string>();
    const ms = (state?.matches || []).filter(m => m.status !== 'cancelled' && m.scheduled_time);
    for (let i = 0; i < ms.length; i++) {
      for (let j = i + 1; j < ms.length; j++) {
        const a = ms[i], b = ms[j];
        if ((a.scheduled_date || '') !== (b.scheduled_date || '') || a.scheduled_time !== b.scheduled_time) continue;
        const sharesTeam = [a.team_a_id, a.team_b_id].some(id => id && (id === b.team_a_id || id === b.team_b_id));
        if (sharesTeam) {
          map.set(a.id, 'équipe déjà en jeu à cette heure');
          map.set(b.id, 'équipe déjà en jeu à cette heure');
        } else if (a.court === b.court) {
          map.set(a.id, `${nomTerrain(a.court)} en double à cette heure`);
          map.set(b.id, `${nomTerrain(b.court)} en double à cette heure`);
        }
      }
    }
    return map;
  }, [state?.matches]);

  // Nombre de parties de chaque équipe dans l'horaire vivant (annulées exclues) —
  // affiché dans la banque d'équipes pour repérer d'un coup d'œil les déséquilibres.
  const partiesParEquipe = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of state?.matches || []) {
      if (m.status === 'cancelled') continue;
      for (const id of [m.team_a_id, m.team_b_id]) {
        if (id) map.set(id, (map.get(id) || 0) + 1);
      }
    }
    return map;
  }, [state?.matches]);

  const finishedCount = (state?.matches || []).filter(m => m.status === 'finished').length;
  const playoffMatches = useMemo(() => (state?.matches || []).filter(m => m.phase !== 'garantie'), [state?.matches]);

  // Qui passe / qui sort / champion — recalculé à chaque pointage (moteur pur).
  const qual = useMemo(() => computeQualification(
    state?.standings || [],
    (state?.matches || []) as unknown as TournamentMatch[],
    {
      playoffsEnabled: !!state?.config?.playoffs_enabled,
      playoffSize: state?.config?.playoffs_team_count ?? 0,
      points: {
        win: state?.config?.points_win ?? 2,
        tie: state?.config?.points_tie ?? 1,
        loss: state?.config?.points_loss ?? 0,
      },
    },
  ), [state?.standings, state?.matches, state?.config?.playoffs_enabled, state?.config?.playoffs_team_count,
      state?.config?.points_win, state?.config?.points_tie, state?.config?.points_loss]);
  const showCut = qual.guaranteedComplete && qual.playoffSize > 0 && qual.cutRank < (state?.standings.length ?? 0);
  const liveUrl = typeof window !== 'undefined' ? `${window.location.origin}/tournoi/${eventId}` : `/tournoi/${eventId}`;

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * Le sport ne change aucune règle : il choisit le dessin du terrain. On
   * l'enregistre tout de suite (le reste de la config attend « Générer »),
   * mais seulement si le tournoi existe déjà — sinon la réponse écraserait
   * la configuration en cours de saisie.
   */
  const changerSport = useCallback(async (sport: SportId) => {
    setForm(f => ({ ...f, sport }));
    if (!state?.config) return;
    try {
      const res = await fetch(`/api/events/${eventId}/tournament`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { showToast('Le sport n\'a pas pu être enregistré.'); return; }
      if (data?.avertissement) showToast(data.avertissement);
      setState(s => (s && s.config ? { ...s, config: { ...s.config, sport } } : s));
    } catch {
      showToast('Le sport n\'a pas pu être enregistré.');
    }
  }, [eventId, state?.config, showToast]);

  async function generate(force = false) {
    setBusy('generate');
    setConfirmRegen(false);
    try {
      // La config affichée est celle qui doit servir : on la sauvegarde d'abord.
      const putRes = await fetch(`/api/events/${eventId}/tournament`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!putRes.ok) { showToast('Erreur de sauvegarde de la configuration.'); return; }

      const res = await fetch(`/api/events/${eventId}/tournament/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (res.status === 409 && data.needsForce) { setConfirmRegen(true); return; }
      if (!res.ok) { showToast(data.error || 'Erreur de génération.'); return; }
      applyState(data);
      setDrafts({});
      const extra = data.summary?.teamsWithExtraGame?.length || 0;
      const overflow = data.summary?.overflowMatches || 0;
      showToast(
        `Horaire généré : ${data.matches.length} parties${extra ? ` (${extra} équipe(s) avec une partie de plus)` : ''}.` +
        (overflow ? ` ⚠ ${overflow} partie(s) dépassent la fin de la dernière journée — ajoute une journée, un terrain ou raccourcis les parties.` : ''),
      );
    } finally {
      setBusy('');
    }
  }

  // « Mettre à jour le site » : prend une photo des parties vivantes → le site
  // public affiche exactement ça (et rien ne bougera avant le prochain clic).
  async function publishSite() {
    setBusy('publish');
    try {
      const res = await fetch(`/api/events/${eventId}/tournament/publish`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Erreur de publication.'); return; }
      applyState(data);
      showToast('✓ Le site affiche maintenant ta dernière version.');
    } finally {
      setBusy('');
    }
  }

  async function sendSchedule() {
    setBusy('send');
    setConfirmSend(false);
    try {
      const res = await fetch(`/api/events/${eventId}/tournament/send-schedule`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Erreur d\'envoi.'); return; }
      showToast(`${data.emailsSent} courriel(s) envoyé(s) à ${data.teamsNotified} équipe(s).`);
      const s = await fetch(`/api/events/${eventId}/tournament`).then(r => r.json());
      applyState(s);
    } finally {
      setBusy('');
    }
  }

  async function saveScore(m: Match) {
    const d = drafts[m.id];
    if (!d) return;
    const a = d.a.trim() === '' ? null : parseInt(d.a, 10);
    const b = d.b.trim() === '' ? null : parseInt(d.b, 10);
    if ((a !== null && !Number.isFinite(a)) || (b !== null && !Number.isFinite(b))) return;
    // Les deux vides = effacement ; sinon il faut les deux pointages.
    if ((a === null) !== (b === null)) { showToast('Entre les deux pointages.'); return; }

    setBusy(m.id);
    try {
      const res = await fetch(`/api/events/${eventId}/tournament/matches/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score_a: a, score_b: b }),
      });
      if (!res.ok) { showToast('Erreur de sauvegarde du pointage.'); return; }
      const data: TournamentState = await res.json();
      applyState(data);
      setDrafts(prev => {
        const next = { ...prev };
        delete next[m.id];
        return next;
      });
      // Partie terminée → propose d'aviser les 2 équipes (prévisualisation + 1 tap)
      const saved = data.matches.find(x => x.id === m.id);
      if (saved && saved.status === 'finished' && saved.team_a_id && saved.team_b_id) {
        setNotifyMatch(saved);
      }
    } finally {
      setBusy('');
    }
  }

  // Envoi « résultat + prochaine partie » aux joueurs des 2 équipes
  async function notifyTeams(m: Match) {
    setBusy('notify');
    try {
      const res = await fetch(`/api/events/${eventId}/tournament/notify-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: m.id }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Erreur d\'envoi.'); return; }
      setNotifyMatch(null);
      showToast(`✉️ ${data.emailsSent} courriel(s) envoyé(s) à ${(data.notified || []).join(' et ')}.`);
    } finally {
      setBusy('');
    }
  }

  // Retard : décale toutes les parties restantes de ± X minutes
  async function shiftAll(minutes: number) {
    setBusy('shift');
    setConfirmShift(null);
    try {
      const res = await fetch(`/api/events/${eventId}/tournament/shift`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Erreur de décalage.'); return; }
      applyState(data);
      showToast(`⏱ ${data.shifted} partie(s) décalée(s) de ${minutes > 0 ? '+' : ''}${minutes} min — pense à « Mettre à jour le site ».`);
    } finally {
      setBusy('');
    }
  }

  // Forfait : l'équipe désignée perd 0-1, la partie est terminée (classement + séries suivent)
  async function forfeit(m: Match, side: 'a' | 'b') {
    setBusy(m.id);
    try {
      const res = await fetch(`/api/events/${eventId}/tournament/matches/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score_a: side === 'a' ? 0 : 1, score_b: side === 'b' ? 0 : 1, status: 'finished' }),
      });
      if (!res.ok) { showToast('Erreur.'); return; }
      applyState(await res.json());
      setEditing('');
      showToast(`Forfait enregistré (${teamName(side === 'a' ? m.team_a_id : m.team_b_id, '')} perd 0-1).`);
    } finally {
      setBusy('');
    }
  }

  // Annuler / rétablir une partie (annulée = exclue du classement et des conflits)
  async function setCancelled(m: Match, cancelled: boolean) {
    setBusy(m.id);
    try {
      const res = await fetch(`/api/events/${eventId}/tournament/matches/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: cancelled ? 'cancelled' : 'scheduled' }),
      });
      if (!res.ok) { showToast('Erreur.'); return; }
      applyState(await res.json());
      setEditing('');
      showToast(cancelled ? 'Partie annulée.' : 'Partie rétablie.');
    } finally {
      setBusy('');
    }
  }

  async function saveTimeCourt(m: Match) {
    if (!/^\d{1,2}:\d{2}$/.test(editDraft.time)) { showToast('Heure invalide.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(editDraft.date)) { showToast('Date invalide.'); return; }
    setBusy(m.id);
    try {
      const res = await fetch(`/api/events/${eventId}/tournament/matches/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_date: editDraft.date, scheduled_time: editDraft.time, court: editDraft.court }),
      });
      if (!res.ok) { showToast('Erreur de déplacement.'); return; }
      applyState(await res.json());
      setEditing('');
      showToast(`M${m.match_number} déplacée au ${formatDayLong(editDraft.date)} ${editDraft.time} · ${nomTerrain(editDraft.court)}.`);
    } finally {
      setBusy('');
    }
  }

  // Génère (ou régénère) le bracket des séries à la suite de l'horaire
  async function generatePlayoffs(force = false) {
    setBusy('playoffs');
    setConfirmRegenPlayoffs(false);
    try {
      // La config affichée (taille des séries, journées…) doit être celle qui sert
      const putRes = await fetch(`/api/events/${eventId}/tournament`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!putRes.ok) { showToast('Erreur de sauvegarde de la configuration.'); return; }

      const res = await fetch(`/api/events/${eventId}/tournament/playoffs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (res.status === 409 && data.needsForce) { setConfirmRegenPlayoffs(true); return; }
      if (!res.ok) { showToast(data.error || 'Erreur de génération des séries.'); return; }
      applyState(data);
      showToast(
        `Séries générées : ${data.playoffsGenerated} parties. Chaque case se remplit dès que c'est sûr : qui passe, contre qui, à quelle heure.` +
        (data.overflowMatches ? ` ⚠ ${data.overflowMatches} partie(s) dépassent la fin de la dernière journée.` : ''),
      );
    } finally {
      setBusy('');
    }
  }

  // Mode Échanger : 1er tap = sélection, 2e tap = échange via l'API
  async function handleSwapTap(m: Match, side: 'a' | 'b') {
    if (m.status === 'finished' || m.status === 'cancelled') {
      showToast('Partie terminée — équipes verrouillées.');
      return;
    }
    if (!swapSel) {
      setSwapSel({ matchId: m.id, side });
      return;
    }
    if (swapSel.matchId === m.id && swapSel.side === side) {
      setSwapSel(null); // re-tap sur la même position = désélection
      return;
    }
    setBusy('swap');
    try {
      const res = await fetch(`/api/events/${eventId}/tournament/swap-teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ a: swapSel, b: { matchId: m.id, side } }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Erreur d\'échange.'); return; }
      applyState(data);
      setSwapSel(null);
      showToast('✓ Équipes échangées — n\'oublie pas « Mettre à jour le site ».');
    } finally {
      setBusy('');
    }
  }

  // Banque d'équipes : place l'équipe choisie (parmi TOUTES les inscrites)
  // dans la case sélectionnée — pas besoin qu'elle soit déjà dans l'horaire.
  async function assignFromBank(team: Team) {
    if (!swapSel) return;
    setBusy('swap');
    try {
      const res = await fetch(`/api/events/${eventId}/tournament/swap-teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ a: swapSel, teamId: team.id }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Erreur de placement.'); return; }
      applyState(data);
      setSwapSel(null);
      showToast(`✓ ${team.name} placée — n'oublie pas « Mettre à jour le site ».`);
    } finally {
      setBusy('');
    }
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: DUO.orange }} />
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <p className="font-extrabold text-text-main">{error || 'Erreur.'}</p>
        <a href="/events" className="text-sm font-bold mt-3 inline-block" style={{ color: DUO.blue }}>&larr; Retour aux événements</a>
      </div>
    );
  }

  const published = state.config?.status === 'published';
  const hasSchedule = state.matches.length > 0;

  return (
    <div className="max-w-2xl mx-auto pb-36">
      {/* Header */}
      <div className="mb-4">
        <a href="/events" className="inline-flex items-center gap-1.5 text-sm font-bold text-text-muted hover:text-text-main transition-colors mb-2">
          <ArrowLeft className="h-4 w-4" /> Événements
        </a>
        <h1 className="text-2xl font-extrabold text-text-main flex items-center gap-2">
          <Trophy className="h-6 w-6" style={{ color: DUO.orange }} /> {state.event.title}
        </h1>
        <p className="text-sm text-text-muted mt-0.5 flex items-center gap-1.5 flex-wrap">
          Console de tournoi
          {state.event.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{state.event.location}</span>}
          <span>· {state.teams.length} équipes</span>
        </p>
      </div>

      {/* Lien page en direct */}
      <div className="rounded-2xl bg-white p-4 mb-4 flex items-center justify-between gap-3 flex-wrap" style={{ border: '2px solid #e5e7eb40', borderBottom: '4px solid #d1d5db40' }}>
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-text-main flex items-center gap-1.5">
            <Eye className="h-4 w-4" style={{ color: DUO.blue }} /> Page publique en direct
            <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: published ? `${DUO.green}18` : '#f3f4f6', color: published ? DUO.greenDark : '#9ca3af' }}>
              {published ? 'EN LIGNE' : 'BROUILLON'}
            </span>
          </p>
          <p className="text-xs text-text-muted mt-0.5 truncate">{liveUrl}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => { navigator.clipboard.writeText(liveUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold bg-gray-50 text-text-muted hover:bg-gray-100 transition-all">
            {copied ? <Check className="h-3.5 w-3.5" style={{ color: DUO.green }} /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copié !' : 'Copier'}
          </button>
          <a href={liveUrl} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold transition-all"
            style={{ backgroundColor: `${DUO.blue}12`, color: DUO.blueDark }}>
            <Eye className="h-3.5 w-3.5" /> Ouvrir
          </a>
          <a href={`${liveUrl}/tv`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold transition-all"
            style={{ backgroundColor: '#1e293b', color: 'white' }}
            title="Grand écran à projeter au gymnase (rotation classement/séries automatique)">
            <Tv className="h-3.5 w-3.5" /> Mode TV
          </a>
          {hasSchedule && (
            <a href={`/api/events/${eventId}/tournament/pdf`} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold transition-all"
              style={{ backgroundColor: `${DUO.orange}18`, color: DUO.orangeDark }}
              title="Feuille de tournoi PDF : horaire avec cases de pointage, classement (qui passe/qui sort), bracket et champion — à imprimer vierge ou en direct">
              <FileText className="h-3.5 w-3.5" /> Feuille PDF
            </a>
          )}
        </div>
      </div>

      {/* Configuration */}
      <div className="rounded-2xl bg-white p-4 mb-4" style={{ border: '2px solid #e5e7eb40', borderBottom: '4px solid #d1d5db40' }}>
        <h2 className="text-sm font-extrabold text-text-main mb-3 flex items-center gap-1.5">
          <CalendarClock className="h-4 w-4" style={{ color: DUO.orange }} /> Configuration de l&apos;horaire
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-extrabold text-text-muted block mb-1">Parties garanties / équipe</label>
            <div className="flex gap-1.5">
              {[1, 2, 3].map(n => (
                <button key={n} onClick={() => setForm(f => ({ ...f, guaranteed_games: n }))}
                  className="flex-1 py-2 rounded-xl text-sm font-extrabold transition-all"
                  style={{
                    backgroundColor: form.guaranteed_games === n ? `${DUO.orange}15` : 'white',
                    color: form.guaranteed_games === n ? DUO.orangeDark : '#9ca3af',
                    border: form.guaranteed_games === n ? `2px solid ${DUO.orange}60` : '2px solid #e5e7eb',
                  }}>{n}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-extrabold text-text-muted block mb-1">Terrains</label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4].map(n => (
                <button key={n} onClick={() => setForm(f => ({ ...f, courts: n }))}
                  className="flex-1 py-2 rounded-xl text-sm font-extrabold transition-all"
                  style={{
                    backgroundColor: form.courts === n ? `${DUO.orange}15` : 'white',
                    color: form.courts === n ? DUO.orangeDark : '#9ca3af',
                    border: form.courts === n ? `2px solid ${DUO.orange}60` : '2px solid #e5e7eb',
                  }}>{n}</button>
              ))}
            </div>
          </div>
          {/* Sport : ne change aucune règle, sert à dessiner le bon terrain */}
          <div className="col-span-2">
            <label className="text-xs font-extrabold text-text-muted block mb-1">
              Sport <span className="font-bold text-text-light">(dessin du terrain)</span>
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {SPORTS.map(sp => {
                const selected = form.sport === sp.id;
                return (
                  <button key={sp.id} onClick={() => changerSport(sp.id)}
                    title={sp.apercu}
                    className="px-3 py-2 rounded-xl text-xs font-extrabold transition-all"
                    style={{
                      backgroundColor: selected ? `${DUO.orange}15` : 'white',
                      color: selected ? DUO.orangeDark : '#9ca3af',
                      border: selected ? `2px solid ${DUO.orange}60` : '2px solid #e5e7eb',
                    }}>{sp.label}</button>
                );
              })}
            </div>
          </div>

          <div className="col-span-2 grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-extrabold text-text-muted block mb-1">Partie (min)</label>
              <input type="number" min={5} max={240} value={form.game_minutes}
                onChange={e => setForm(f => ({ ...f, game_minutes: parseInt(e.target.value) || 25 }))}
                className="w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-sm font-bold text-text-main focus:outline-none focus:border-[#FF9600] transition-all" />
            </div>
            <div>
              <label className="text-xs font-extrabold text-text-muted block mb-1">Pause (min)</label>
              <input type="number" min={0} max={60} value={form.break_minutes}
                onChange={e => setForm(f => ({ ...f, break_minutes: parseInt(e.target.value) || 0 }))}
                className="w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-sm font-bold text-text-main focus:outline-none focus:border-[#FF9600] transition-all" />
            </div>
          </div>

          {/* Journées du tournoi : chaque journée a sa fenêtre d'heures */}
          <div className="col-span-2">
            <label className="text-xs font-extrabold text-text-muted block mb-1">Jours et heures du tournoi</label>
            <div className="space-y-1.5">
              {form.days.map((d, i) => (
                <div key={i} className="flex items-center gap-1.5 flex-wrap">
                  <input type="date" value={d.date}
                    onChange={e => setForm(f => ({ ...f, days: f.days.map((x, j) => j === i ? { ...x, date: e.target.value } : x) }))}
                    className="flex-1 min-w-[130px] rounded-xl border-2 border-gray-200 bg-white px-2.5 py-2 text-sm font-bold text-text-main focus:outline-none focus:border-[#FF9600] transition-all" />
                  <span className="text-xs font-bold text-text-muted">de</span>
                  <input type="time" value={d.start}
                    onChange={e => setForm(f => ({ ...f, days: f.days.map((x, j) => j === i ? { ...x, start: e.target.value } : x) }))}
                    className="w-[92px] rounded-xl border-2 border-gray-200 bg-white px-2 py-2 text-sm font-bold text-text-main focus:outline-none focus:border-[#FF9600] transition-all" />
                  <span className="text-xs font-bold text-text-muted">à</span>
                  <input type="time" value={d.end}
                    onChange={e => setForm(f => ({ ...f, days: f.days.map((x, j) => j === i ? { ...x, end: e.target.value } : x) }))}
                    className="w-[92px] rounded-xl border-2 border-gray-200 bg-white px-2 py-2 text-sm font-bold text-text-main focus:outline-none focus:border-[#FF9600] transition-all" />
                  {form.days.length > 1 && (
                    <button onClick={() => setForm(f => ({ ...f, days: f.days.filter((_, j) => j !== i) }))}
                      className="p-1.5 rounded-lg hover:bg-red-50 transition-all" title="Retirer cette journée">
                      <X className="h-4 w-4" style={{ color: DUO.red }} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => setForm(f => ({
                ...f,
                days: [...f.days, { date: nextDate(f.days[f.days.length - 1]?.date || state.event.date), start: '09:00', end: '17:00' }],
              }))}
              className="mt-1.5 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all"
              style={{ backgroundColor: `${DUO.orange}12`, color: DUO.orangeDark }}>
              + Ajouter une journée
            </button>
            <p className="text-[11px] text-text-muted mt-1">
              Une partie n&apos;est cédulée dans une journée que si elle peut finir avant l&apos;heure de fin. Le surplus continue sur la journée suivante.
            </p>
          </div>

          {/* Séries éliminatoires après les parties garanties */}
          <div className="col-span-2">
            <label className="text-xs font-extrabold text-text-muted block mb-1">Séries éliminatoires (après les parties garanties)</label>
            <div className="flex gap-1.5">
              {([[0, 'Aucune'], [2, 'Finale'], [4, 'Top 4'], [8, 'Top 8']] as const).map(([val, label]) => {
                const selected = val === 0 ? !form.playoffs_enabled : (form.playoffs_enabled && form.playoffs_team_count === val);
                return (
                  <button key={val}
                    onClick={() => setForm(f => val === 0
                      ? { ...f, playoffs_enabled: false }
                      : { ...f, playoffs_enabled: true, playoffs_team_count: val })}
                    className="flex-1 py-2 rounded-xl text-sm font-extrabold transition-all"
                    style={{
                      backgroundColor: selected ? `${DUO.orange}15` : 'white',
                      color: selected ? DUO.orangeDark : '#9ca3af',
                      border: selected ? `2px solid ${DUO.orange}60` : '2px solid #e5e7eb',
                    }}>{label}</button>
                );
              })}
            </div>
          </div>
        </div>

        <button onClick={() => generate(false)} disabled={busy !== ''}
          className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-white text-base font-extrabold transition-all active:translate-y-[2px] active:shadow-none hover:brightness-105 disabled:opacity-60"
          style={{ backgroundColor: DUO.orange, boxShadow: `0 3px 0 0 ${DUO.orangeDark}` }}>
          {busy === 'generate' ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
          {hasSchedule ? 'Régénérer l\'horaire' : 'Générer l\'horaire'}
        </button>
        {hasSchedule && form.playoffs_enabled && (
          <button onClick={() => generatePlayoffs(false)} disabled={busy !== ''}
            className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-base font-extrabold transition-all active:translate-y-[2px] disabled:opacity-60"
            style={{ backgroundColor: `${DUO.orange}12`, color: DUO.orangeDark, border: `2px solid ${DUO.orange}50` }}>
            {busy === 'playoffs' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trophy className="h-5 w-5" />}
            {playoffMatches.length > 0 ? 'Régénérer les séries' : `Générer les séries (top ${form.playoffs_team_count})`}
          </button>
        )}
        {state.teams.length < 2 && (
          <p className="text-xs font-bold mt-2 flex items-center gap-1" style={{ color: DUO.red }}>
            <AlertTriangle className="h-3.5 w-3.5" /> Il faut au moins 2 équipes inscrites.
          </p>
        )}
      </div>

      {/* Publication + envoi — rien ne part sur le site sans un geste explicite */}
      {hasSchedule && (
        <div className="rounded-2xl bg-white p-4 mb-4 space-y-2.5" style={{ border: '2px solid #e5e7eb40', borderBottom: '4px solid #d1d5db40' }}>
          {!published ? (
            <>
              <button onClick={publishSite} disabled={busy !== ''}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-white text-base font-extrabold transition-all active:translate-y-[2px] active:shadow-none hover:brightness-105 disabled:opacity-60"
                style={{ backgroundColor: DUO.green, boxShadow: `0 3px 0 0 ${DUO.greenDark}` }}>
                {busy === 'publish' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Globe className="h-5 w-5" />}
                Publier l&apos;horaire sur le site
              </button>
              <p className="text-xs text-text-muted text-center">
                Rien n&apos;est visible publiquement tant que tu n&apos;as pas publié. Tu pourras continuer d&apos;ajuster ensuite.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs font-extrabold text-text-muted">
                  🌐 En ligne · Dernière mise à jour :{' '}
                  {state.published_at
                    ? new Date(state.published_at).toLocaleString('fr-CA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : '—'}
                </p>
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: state.has_unpublished_changes ? `${DUO.orange}18` : `${DUO.green}18`,
                    color: state.has_unpublished_changes ? DUO.orangeDark : DUO.greenDark,
                  }}>
                  {state.has_unpublished_changes ? 'CHANGEMENTS NON PUBLIÉS' : 'SITE À JOUR'}
                </span>
              </div>
              {state.has_unpublished_changes && (
                <button onClick={publishSite} disabled={busy !== ''}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-white text-base font-extrabold transition-all active:translate-y-[2px] active:shadow-none hover:brightness-105 disabled:opacity-60"
                  style={{ backgroundColor: DUO.orange, boxShadow: `0 3px 0 0 ${DUO.orangeDark}` }}>
                  {busy === 'publish' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Globe className="h-5 w-5" />}
                  Mettre à jour le site
                </button>
              )}
              <button onClick={() => setConfirmSend(true)} disabled={busy !== ''}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-white text-base font-extrabold transition-all active:translate-y-[2px] active:shadow-none hover:brightness-105 disabled:opacity-60"
                style={{ backgroundColor: DUO.blue, boxShadow: `0 3px 0 0 ${DUO.blueDark}` }}>
                {busy === 'send' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                Envoyer l&apos;horaire aux équipes
              </button>
              <p className="text-xs text-text-muted text-center">
                {state.config?.schedule_sent_at
                  ? `Dernier envoi : ${new Date(state.config.schedule_sent_at).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' })}`
                  : 'Chaque joueur recevra l\'horaire de son équipe + le lien de la page en direct.'}
              </p>
            </>
          )}
        </div>
      )}

      {/* Horaire + pointages */}
      {hasSchedule && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2 px-1 gap-2 flex-wrap">
            <h2 className="text-sm font-extrabold text-text-main flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4" style={{ color: DUO.blue }} /> Horaire &amp; pointages
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold" style={{ color: DUO.greenDark }}>{finishedCount}/{state.matches.length} jouées</span>
              <button onClick={() => { setSwapMode(!swapMode); setSwapSel(null); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all"
                style={{
                  backgroundColor: swapMode ? DUO.blue : `${DUO.blue}12`,
                  color: swapMode ? 'white' : DUO.blueDark,
                }}>
                <ArrowLeftRight className="h-3.5 w-3.5" /> {swapMode ? 'Terminer' : 'Échanger des équipes'}
              </button>
            </div>
          </div>
          {swapMode && (
            <div className="rounded-xl px-3.5 py-2.5 mb-2 text-xs font-bold"
              style={{ backgroundColor: `${DUO.blue}10`, color: DUO.blueDark, border: `2px solid ${DUO.blue}30` }}>
              {swapSel
                ? '👆 Touche un autre nom dans l\'horaire pour ÉCHANGER, ou choisis une équipe dans la banque au bas de l\'écran pour la PLACER ici.'
                : '👇 Touche un nom d\'équipe : la banque de toutes les équipes inscrites s\'ouvre, ou touche un 2e nom pour échanger leur place. Les parties terminées sont verrouillées.'}
            </div>
          )}
          {/* Retard ? Tout le reste se décale d'un coup */}
          <div className="flex items-center gap-1.5 mb-2 px-1 flex-wrap">
            <span className="text-[11px] font-extrabold text-text-muted">⏱ Décaler le reste :</span>
            {[-10, 10, 15, 30].map(mn => (
              <button key={mn} onClick={() => setConfirmShift(mn)} disabled={busy !== ''}
                className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all disabled:opacity-50"
                style={{ backgroundColor: '#f3f4f6', color: '#64748b', border: '1px solid #e5e7eb' }}>
                {mn > 0 ? `+${mn}` : mn} min
              </button>
            ))}
          </div>
          {/* Une journée à la fois : on ne gère pas samedi pendant vendredi */}
          {multiDay && (
            <div className="flex gap-1.5 mb-2.5 flex-wrap">
              {grillesParJour.map(({ date, grille }) => {
                const actif = date === jourAffiche;
                const nb = grille.colonnes.reduce((t, c) => t + c.nbParties, 0);
                return (
                  <button key={date || 'sans-date'} onClick={() => setJourChoisi(date)}
                    className="px-3 py-2 rounded-xl text-xs font-extrabold transition-all"
                    style={{
                      backgroundColor: actif ? `${DUO.blue}15` : 'white',
                      color: actif ? DUO.blueDark : '#9ca3af',
                      border: actif ? `2px solid ${DUO.blue}60` : '2px solid #e5e7eb',
                    }}>
                    <span className="capitalize">📆 {formatDayLong(date) || 'Journée à déterminer'}</span>
                    <span className="font-bold opacity-70"> · {nb} partie{nb > 1 ? 's' : ''}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="space-y-3">
            {grillesParJour.filter(({ date }) => date === jourAffiche).map(({ date, grille }) => (
              <div key={date || 'sans-date'}>
                {/* Les terrains en bandeau, l'horaire dessous : une seule
                    colonne d'heures, donc les deux terrains restent alignés. */}
                <GrilleHoraire
                  grille={grille}
                  sport={form.sport}
                  rendreCase={(m) => {
                    const d = drafts[m.id] ?? { a: m.score_a === null ? '' : String(m.score_a), b: m.score_b === null ? '' : String(m.score_b) };
                    const finished = m.status === 'finished';
                    const cancelled = m.status === 'cancelled';
                    const dirty = drafts[m.id] !== undefined;
                    const aWins = finished && m.score_a !== null && m.score_b !== null && m.score_a > m.score_b;
                    const bWins = finished && m.score_a !== null && m.score_b !== null && m.score_b > m.score_a;
                    return (
                      <div key={m.id} className="rounded-2xl bg-white p-3"
                        style={{ border: finished ? `2px solid ${DUO.green}50` : '2px solid #e5e7eb', borderBottom: finished ? `4px solid ${DUO.green}50` : '4px solid #e5e7eb' }}>
                        <div className="flex items-center justify-between text-[11px] font-extrabold text-text-muted mb-1.5 gap-2">
                          {/* Le terrain est déjà en tête de colonne : pas de répétition. */}
                          <span className="whitespace-nowrap">
                            M{m.match_number}
                            {m.phase !== 'garantie' && (
                              <span style={{ color: DUO.orangeDark }}> · {PHASE_LABELS[m.phase] || m.phase}</span>
                            )}
                          </span>
                          <div className="flex items-center gap-2 min-w-0">
                            {conflicts.has(m.id) && (
                              <span className="truncate" style={{ color: DUO.red }}>⚠ {conflicts.get(m.id)}</span>
                            )}
                            {finished && <span className="whitespace-nowrap" style={{ color: DUO.greenDark }}>✓ Terminée</span>}
                            {cancelled && <span className="whitespace-nowrap" style={{ color: '#9ca3af' }}>✕ Annulée</span>}
                            {finished && m.team_a_id && m.team_b_id && (
                              <button onClick={() => setNotifyMatch(m)}
                                className="p-1 rounded-md hover:bg-gray-100 transition-all flex-shrink-0"
                                title="Aviser les 2 équipes (résultat + prochaine partie)">
                                <Mail className="h-3.5 w-3.5" style={{ color: DUO.blueDark }} />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                if (editing === m.id) { setEditing(''); return; }
                                setEditing(m.id);
                                setEditDraft({ date: m.scheduled_date || date || state.event.date, time: m.scheduled_time, court: m.court });
                              }}
                              className="p-1 rounded-md hover:bg-gray-100 transition-all flex-shrink-0"
                              title="Déplacer / forfait / annuler">
                              <Pencil className="h-3.5 w-3.5" style={{ color: editing === m.id ? DUO.blueDark : '#9ca3af' }} />
                            </button>
                          </div>
                        </div>
                        {editing === m.id && (
                          <div className="mb-2 p-2.5 rounded-xl flex items-center gap-2 flex-wrap" style={{ backgroundColor: '#f8fafc', border: '2px solid #e5e7eb' }}>
                            {multiDay && (
                              <input type="date" value={editDraft.date}
                                onChange={e => setEditDraft(d => ({ ...d, date: e.target.value }))}
                                className="rounded-lg border-2 border-gray-200 bg-white px-2 py-1.5 text-sm font-bold text-text-main focus:outline-none focus:border-[#1CB0F6]" />
                            )}
                            <input type="time" value={editDraft.time}
                              onChange={e => setEditDraft(d => ({ ...d, time: e.target.value }))}
                              className="rounded-lg border-2 border-gray-200 bg-white px-2 py-1.5 text-sm font-bold text-text-main focus:outline-none focus:border-[#1CB0F6]" />
                            <div className="flex gap-1">
                              {Array.from({ length: Math.max(form.courts, m.court) }, (_, i) => i + 1).map(c => (
                                <button key={c} onClick={() => setEditDraft(d => ({ ...d, court: c }))}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition-all"
                                  style={{
                                    backgroundColor: editDraft.court === c ? `${DUO.blue}15` : 'white',
                                    color: editDraft.court === c ? DUO.blueDark : '#9ca3af',
                                    border: editDraft.court === c ? `2px solid ${DUO.blue}60` : '2px solid #e5e7eb',
                                  }}>{libelleTerrain(c)}</button>
                              ))}
                            </div>
                            <button onClick={() => saveTimeCourt(m)} disabled={busy !== ''}
                              className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg text-white text-xs font-extrabold transition-all active:translate-y-[1px] disabled:opacity-60"
                              style={{ backgroundColor: DUO.blue, boxShadow: `0 2px 0 0 ${DUO.blueDark}` }}>
                              {busy === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                              Déplacer
                            </button>
                            {/* Cas de force majeure : forfait (l'autre gagne 0-1) ou annulation */}
                            <div className="w-full flex items-center gap-1.5 flex-wrap pt-1.5 mt-0.5" style={{ borderTop: '1px dashed #e5e7eb' }}>
                              {!finished && !cancelled && m.team_a_id && m.team_b_id && (
                                <>
                                  <button onClick={() => forfeit(m, 'a')} disabled={busy !== ''}
                                    className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all disabled:opacity-50"
                                    style={{ backgroundColor: '#fef2f2', color: DUO.red, border: '1px solid #fecaca' }}>
                                    Forfait {teamName(m.team_a_id, m.source_a)}
                                  </button>
                                  <button onClick={() => forfeit(m, 'b')} disabled={busy !== ''}
                                    className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all disabled:opacity-50"
                                    style={{ backgroundColor: '#fef2f2', color: DUO.red, border: '1px solid #fecaca' }}>
                                    Forfait {teamName(m.team_b_id, m.source_b)}
                                  </button>
                                </>
                              )}
                              {!finished && (
                                <button onClick={() => setCancelled(m, !cancelled)} disabled={busy !== ''}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all disabled:opacity-50"
                                  style={{ backgroundColor: '#f3f4f6', color: '#64748b', border: '1px solid #e5e7eb' }}>
                                  {cancelled ? 'Rétablir la partie' : 'Annuler la partie'}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                        {/* Une équipe par ligne, sa case de pointage à droite —
                            même forme que la feuille PDF, et le nom au complet
                            même dans une colonne étroite. */}
                        <div>
                          {(['a', 'b'] as const).map(cote => {
                            const equipeId = cote === 'a' ? m.team_a_id : m.team_b_id;
                            const source = cote === 'a' ? m.source_a : m.source_b;
                            const gagne = cote === 'a' ? aWins : bWins;
                            const choisi = swapSel?.matchId === m.id && swapSel?.side === cote;
                            return (
                              <div key={cote} className="flex items-center gap-2 py-0.5"
                                style={cote === 'b' ? { borderTop: '1px solid #f1f5f9' } : undefined}>
                                {swapMode ? (
                                  <button onClick={() => handleSwapTap(m, cote)} disabled={busy !== '' || finished}
                                    className="flex-1 min-w-0 text-sm font-extrabold truncate text-left px-2 py-1.5 rounded-lg transition-all disabled:opacity-40"
                                    style={{
                                      backgroundColor: choisi ? DUO.blue : `${DUO.blue}0d`,
                                      color: choisi ? 'white' : DUO.blueDark,
                                      border: `2px dashed ${DUO.blue}60`,
                                    }}>
                                    {teamName(equipeId, source)}
                                  </button>
                                ) : (
                                  <span className="flex-1 min-w-0 text-sm font-extrabold truncate"
                                    style={{ color: gagne ? DUO.greenDark : '#334155' }}>
                                    {teamName(equipeId, source)}
                                  </span>
                                )}
                                <input inputMode="numeric" value={d[cote]}
                                  onChange={e => setDrafts(prev => ({ ...prev, [m.id]: { ...d, [cote]: e.target.value.replace(/\D/g, '') } }))}
                                  className="w-12 flex-shrink-0 text-center rounded-lg border-2 border-gray-200 py-1.5 text-sm font-extrabold text-text-main focus:outline-none focus:border-[#1CB0F6]"
                                  placeholder="—" />
                              </div>
                            );
                          })}
                        </div>
                        {dirty && (
                          <button onClick={() => saveScore(m)} disabled={busy !== ''}
                            className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-white text-sm font-extrabold transition-all active:translate-y-[1px] disabled:opacity-60"
                            style={{ backgroundColor: DUO.green, boxShadow: `0 2px 0 0 ${DUO.greenDark}` }}>
                            {busy === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            Sauvegarder le pointage
                          </button>
                        )}
                      </div>
                    );
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Classement */}
      {hasSchedule && (
        <div className="rounded-2xl bg-white p-4" style={{ border: '2px solid #e5e7eb40', borderBottom: '4px solid #d1d5db40' }}>
          <h2 className="text-sm font-extrabold text-text-main mb-3 flex items-center gap-1.5">
            <Medal className="h-4 w-4" style={{ color: DUO.orange }} /> Classement
            <span className="text-[11px] text-text-muted font-bold">(égalité brisée par le moins de points contre)</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] font-extrabold text-text-muted">
                  <th className="text-left py-1.5 pr-2">#</th>
                  <th className="text-left py-1.5 pr-2">Équipe</th>
                  <th className="text-center py-1.5 px-1.5">J</th>
                  <th className="text-center py-1.5 px-1.5">V</th>
                  <th className="text-center py-1.5 px-1.5">N</th>
                  <th className="text-center py-1.5 px-1.5">D</th>
                  <th className="text-center py-1.5 px-1.5" title="Points contre — le moins = devant en cas d'égalité">PC</th>
                  <th className="text-center py-1.5 px-1.5">+/−</th>
                  <th className="text-center py-1.5 px-1.5">Pts</th>
                  <th className="text-right py-1.5 pl-1.5">Statut</th>
                </tr>
              </thead>
              <tbody>
                {state.standings.map((r, i) => {
                  const tq = qual.byTeam.get(r.teamId);
                  const out = qual.guaranteedComplete && tq && !tq.inPlayoffs && qual.playoffSize > 0;
                  return (
                  <Fragment key={r.teamId}>
                    {showCut && i === qual.cutRank && (
                      <tr><td colSpan={10} className="py-1">
                        <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wide" style={{ color: DUO.blue }}>
                          <span className="flex-1 border-t-2 border-dashed" style={{ borderColor: `${DUO.blue}66` }} />
                          Ligne des séries · les {qual.playoffSize} premières passent
                          <span className="flex-1 border-t-2 border-dashed" style={{ borderColor: `${DUO.blue}66` }} />
                        </div>
                      </td></tr>
                    )}
                    <tr className="border-t border-gray-100" style={{ opacity: out ? 0.6 : 1 }}>
                      <td className="py-2 pr-2 font-extrabold" style={{ color: r.rank <= 3 ? DUO.orangeDark : '#9ca3af' }}>
                        {r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : r.rank}
                      </td>
                      <td className="py-2 pr-2 font-extrabold text-text-main">{r.teamName}</td>
                      <td className="py-2 px-1.5 text-center font-bold text-text-muted">{r.played}</td>
                      <td className="py-2 px-1.5 text-center font-bold" style={{ color: DUO.greenDark }}>{r.wins}</td>
                      <td className="py-2 px-1.5 text-center font-bold text-text-muted">{r.ties}</td>
                      <td className="py-2 px-1.5 text-center font-bold" style={{ color: DUO.red }}>{r.losses}</td>
                      <td className="py-2 px-1.5 text-center font-bold text-text-muted">{r.pointsAgainst}</td>
                      <td className="py-2 px-1.5 text-center font-bold text-text-muted">{r.diff > 0 ? `+${r.diff}` : r.diff}</td>
                      <td className="py-2 px-1.5 text-center font-extrabold text-text-main">{r.points}</td>
                      <td className="py-2 pl-1.5 text-right text-[11px] font-extrabold whitespace-nowrap" style={{ color: QUAL_COLOR[tq?.status ?? 'none'] }}>
                        {tq && tq.status !== 'none' ? tq.label : ''}
                      </td>
                    </tr>
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bracket des séries */}
      {playoffMatches.length > 0 && (
        <div className="rounded-2xl bg-white p-4 mt-4" style={{ border: '2px solid #e5e7eb40', borderBottom: '4px solid #d1d5db40' }}>
          <h2 className="text-sm font-extrabold text-text-main mb-3 flex items-center gap-1.5">
            <Trophy className="h-4 w-4" style={{ color: DUO.orange }} /> Séries éliminatoires
            <span className="text-[11px] text-text-muted font-bold">
              (chaque case se remplit dès que la place est mathématiquement assurée)
            </span>
          </h2>
          <Bracket matches={playoffMatches} teamName={teamName} multiDay={multiDay} accent={DUO.blue} />
        </div>
      )}

      {/* Modale — régénérer les séries avec pointages */}
      {confirmRegenPlayoffs && (
        <ConfirmModal
          title="Régénérer les séries ?"
          body="Des pointages de séries sont déjà saisis. Régénérer efface toutes les parties de séries et leurs résultats (les parties garanties ne bougent pas)."
          confirmLabel="Oui, régénérer les séries"
          color={DUO.red}
          onConfirm={() => generatePlayoffs(true)}
          onClose={() => setConfirmRegenPlayoffs(false)}
        />
      )}

      {/* Modale — régénérer avec pointages */}
      {confirmRegen && (
        <ConfirmModal
          title="Écraser l'horaire ?"
          body="Des pointages sont déjà saisis. Régénérer efface TOUTES les parties et TOUS les résultats. Cette action est irréversible."
          confirmLabel="Oui, tout régénérer"
          color={DUO.red}
          onConfirm={() => generate(true)}
          onClose={() => setConfirmRegen(false)}
        />
      )}

      {/* Modale — envoi de l'horaire */}
      {confirmSend && (
        <ConfirmModal
          title="Envoyer l'horaire aux équipes ?"
          body={`Chaque joueur confirmé recevra par courriel l'horaire de son équipe (version publiée sur le site) et le lien de la page en direct. ${state.has_unpublished_changes ? '⚠ Tu as des changements NON PUBLIÉS : clique d\'abord « Mettre à jour le site », sinon les courriels enverront l\'ancienne version. ' : ''}${state.config?.schedule_sent_at ? 'Un envoi a déjà été fait — ceci renverra à tout le monde.' : ''}`}
          confirmLabel="Envoyer maintenant"
          color={DUO.blue}
          onConfirm={sendSchedule}
          onClose={() => setConfirmSend(false)}
        />
      )}

      {/* Modale — aviser les 2 équipes après un pointage (prévisualisation + 1 tap) */}
      {notifyMatch && (() => {
        const nm = notifyMatch;
        const nextFor = (teamId: string | null) => teamId ? (state.matches
          .filter(x => x.id !== nm.id && (x.team_a_id === teamId || x.team_b_id === teamId) && x.status !== 'finished' && x.status !== 'cancelled')
          .sort((x, y) => `${x.scheduled_date || ''}|${x.scheduled_time}`.localeCompare(`${y.scheduled_date || ''}|${y.scheduled_time}`))[0] || null) : null;
        const sides = [
          { teamId: nm.team_a_id, scoreFor: nm.score_a ?? 0, scoreAgainst: nm.score_b ?? 0, opponentId: nm.team_b_id },
          { teamId: nm.team_b_id, scoreFor: nm.score_b ?? 0, scoreAgainst: nm.score_a ?? 0, opponentId: nm.team_a_id },
        ];
        const hasPlayoffs = state.matches.some(x => x.phase !== 'garantie');
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15,23,42,0.55)' }} onClick={() => setNotifyMatch(null)}>
            <div className="bg-white rounded-2xl p-5 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-base font-extrabold text-text-main flex items-center gap-1.5">
                  <Mail className="h-4 w-4" style={{ color: DUO.blue }} /> Aviser les équipes ?
                </h3>
                <button onClick={() => setNotifyMatch(null)} className="text-text-light hover:text-text-main"><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-2 mb-3">
                {sides.map(s => {
                  const next = nextFor(s.teamId);
                  const won = s.scoreFor > s.scoreAgainst;
                  const tie = s.scoreFor === s.scoreAgainst;
                  return (
                    <div key={s.teamId || 'x'} className="rounded-xl p-3" style={{ backgroundColor: '#f8fafc', border: '2px solid #e7edf3' }}>
                      <p className="text-sm font-extrabold text-text-main">{teamName(s.teamId, '')}</p>
                      <p className="text-xs font-bold mt-0.5" style={{ color: tie ? '#64748b' : won ? DUO.greenDark : DUO.red }}>
                        {tie ? 'Nulle' : won ? 'Victoire' : 'Défaite'} {s.scoreFor}–{s.scoreAgainst} contre {teamName(s.opponentId, '')}
                      </p>
                      <p className="text-xs font-bold text-text-muted mt-1">
                        {next
                          ? <>⏭ Prochaine : <span style={{ color: DUO.blueDark }}>{multiDay && (next.scheduled_date || '') !== '' ? `${formatDayLong(next.scheduled_date)} · ` : ''}{next.scheduled_time} · Terrain {next.court} · vs {teamName(next.team_a_id === s.teamId ? next.team_b_id : next.team_a_id, next.team_a_id === s.teamId ? next.source_b : next.source_a)}</span></>
                          : '🏁 Aucune autre partie — courriel de remerciement'}
                      </p>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-text-muted mb-4">
                Chaque joueur des deux équipes reçoit ce résumé par courriel avec le lien de la page en direct{hasPlayoffs ? ' et l\'image du bracket' : ''}.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setNotifyMatch(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-extrabold bg-gray-100 text-text-muted hover:bg-gray-200 transition-all">
                  Pas maintenant
                </button>
                <button onClick={() => notifyTeams(nm)} disabled={busy !== ''}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-extrabold text-white transition-all active:translate-y-[1px] disabled:opacity-60"
                  style={{ backgroundColor: DUO.blue }}>
                  {busy === 'notify' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Envoyer
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modale — décaler tout le reste */}
      {confirmShift !== null && (
        <ConfirmModal
          title={`Décaler le reste de ${confirmShift > 0 ? '+' : ''}${confirmShift} min ?`}
          body={`Toutes les parties pas encore jouées seront décalées de ${confirmShift > 0 ? '+' : ''}${confirmShift} minutes (les journées ne changent pas). Pense à « Mettre à jour le site » ensuite.`}
          confirmLabel="Décaler"
          color={DUO.orange}
          onConfirm={() => shiftAll(confirmShift)}
          onClose={() => setConfirmShift(null)}
        />
      )}

      {/* Banque d'équipes — toutes les équipes inscrites, pour remplir la case
          sélectionnée en mode Échanger (même une équipe pas encore à l'horaire). */}
      {swapMode && swapSel && (() => {
        const sel = swapSel;
        const m = state.matches.find(x => x.id === sel.matchId);
        if (!m) return null;
        const currentId = sel.side === 'a' ? m.team_a_id : m.team_b_id;
        const currentLabel = teamName(currentId, sel.side === 'a' ? m.source_a : m.source_b);
        return (
          <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4">
            <div className="max-w-2xl mx-auto rounded-2xl bg-white p-4 shadow-2xl"
              style={{ border: `2px solid ${DUO.blue}50`, borderBottom: `4px solid ${DUO.blue}50` }}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm font-extrabold text-text-main">
                  Banque d&apos;équipes
                  <span className="block text-[11px] font-bold text-text-muted mt-0.5">
                    M{m.match_number} · {m.scheduled_time} · {nomTerrain(m.court)} — remplacer{' '}
                    <span style={{ color: DUO.blueDark }}>{currentLabel}</span> par :
                  </span>
                </p>
                <button onClick={() => setSwapSel(null)} className="text-text-light hover:text-text-main flex-shrink-0 p-1"
                  title="Fermer la banque">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex gap-1.5 flex-wrap max-h-[38vh] overflow-y-auto">
                {state.teams.map(t => {
                  const ici = t.id === currentId;
                  const nb = partiesParEquipe.get(t.id) || 0;
                  return (
                    <button key={t.id} onClick={() => assignFromBank(t)} disabled={busy !== '' || ici}
                      className="px-3 py-2 rounded-xl text-xs font-extrabold transition-all disabled:opacity-40"
                      style={{
                        backgroundColor: ici ? `${DUO.blue}15` : 'white',
                        color: ici ? DUO.blueDark : '#334155',
                        border: ici ? `2px solid ${DUO.blue}60` : '2px solid #e5e7eb',
                      }}>
                      {t.name}
                      <span className="font-bold opacity-60"> · {ici ? 'déjà ici' : `${nb} partie${nb > 1 ? 's' : ''}`}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-text-muted mt-2">
                Touche une équipe pour la placer dans cette case, ou touche un autre nom dans l&apos;horaire pour faire un échange.
              </p>
            </div>
          </div>
        );
      })()}

      {/* Barre collante — le site n'affiche pas la dernière version
          (cachée pendant que la banque d'équipes occupe le bas de l'écran) */}
      {published && state.has_unpublished_changes && !(swapMode && swapSel) && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-3 rounded-2xl px-4 py-3 shadow-lg"
            style={{ backgroundColor: '#1e293b' }}>
            <p className="text-white text-sm font-extrabold leading-tight">
              ⚠ Le site n&apos;affiche pas tes derniers changements
            </p>
            <button onClick={publishSite} disabled={busy !== ''}
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-extrabold transition-all active:translate-y-[1px] disabled:opacity-60"
              style={{ backgroundColor: DUO.orange, boxShadow: `0 2px 0 0 ${DUO.orangeDark}` }}>
              {busy === 'publish' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
              Mettre à jour le site
            </button>
          </div>
        </div>
      )}

      {/* Toast (au-dessus de la barre collante) */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-white text-sm font-extrabold shadow-lg max-w-[92vw] text-center"
          style={{ backgroundColor: '#1e293b' }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function ConfirmModal({ title, body, confirmLabel, color, onConfirm, onClose }: {
  title: string; body: string; confirmLabel: string; color: string;
  onConfirm: () => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15,23,42,0.55)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-base font-extrabold text-text-main">{title}</h3>
          <button onClick={onClose} className="text-text-light hover:text-text-main"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-sm text-text-muted mb-4">{body}</p>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-extrabold bg-gray-100 text-text-muted hover:bg-gray-200 transition-all">
            Annuler
          </button>
          <button onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-extrabold text-white transition-all active:translate-y-[1px]"
            style={{ backgroundColor: color }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
