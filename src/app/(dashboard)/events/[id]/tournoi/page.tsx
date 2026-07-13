'use client';

/**
 * Console de tournoi — l'écran de l'organisateur le jour J (pensé mobile).
 *
 * 1. Configure (parties garanties, terrains, heure, durée) → Génère l'horaire.
 * 2. Publie → la page publique /tournoi/[id] devient vivante.
 * 3. « Envoyer l'horaire aux équipes » → chaque joueur reçoit SON horaire.
 * 4. Pendant le tournoi : saisis les pointages, le classement se met à jour seul.
 */

import { useState, useEffect, useMemo, useCallback, use } from 'react';
import {
  Loader2, ArrowLeft, Trophy, CalendarClock, Send, RefreshCw, Eye, Copy, Check,
  AlertTriangle, MapPin, Medal, X,
} from 'lucide-react';

const DUO = {
  green: '#58CC02', greenDark: '#45a300',
  blue: '#1CB0F6', blueDark: '#1899d6',
  orange: '#FF9600', orangeDark: '#e08600',
  red: '#FF4B4B',
} as const;

interface Config {
  guaranteed_games: number;
  courts: number;
  start_time: string;
  game_minutes: number;
  break_minutes: number;
  status: 'draft' | 'published';
  schedule_sent_at: string | null;
}

interface Team { id: string; name: string; logo_url: string | null }

interface Match {
  id: string;
  phase: string;
  match_number: number;
  court: number;
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
}

const DEFAULT_CONFIG: Config = {
  guaranteed_games: 2, courts: 2, start_time: '09:00',
  game_minutes: 25, break_minutes: 5, status: 'draft', schedule_sent_at: null,
};

export default function TournamentConsolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  const [state, setState] = useState<TournamentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<Config>(DEFAULT_CONFIG);
  const [busy, setBusy] = useState('');           // 'config' | 'generate' | 'publish' | 'send' | match id
  const [toast, setToast] = useState('');
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [copied, setCopied] = useState(false);
  // Brouillons de pointage en cours de frappe (id de match → scores affichés)
  const [drafts, setDrafts] = useState<Record<string, { a: string; b: string }>>({});

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }, []);

  const applyState = useCallback((s: TournamentState) => {
    setState(s);
    if (s.config) {
      const c = s.config;
      setForm({
        guaranteed_games: c.guaranteed_games,
        courts: c.courts,
        start_time: c.start_time,
        game_minutes: c.game_minutes,
        break_minutes: c.break_minutes,
        status: c.status,
        schedule_sent_at: c.schedule_sent_at,
      });
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

  const bySlot = useMemo(() => {
    const groups = new Map<string, Match[]>();
    for (const m of state?.matches || []) {
      const key = m.scheduled_time || '—';
      groups.set(key, [...(groups.get(key) || []), m]);
    }
    return [...groups.entries()];
  }, [state?.matches]);

  const finishedCount = (state?.matches || []).filter(m => m.status === 'finished').length;
  const liveUrl = typeof window !== 'undefined' ? `${window.location.origin}/tournoi/${eventId}` : `/tournoi/${eventId}`;

  // ── Actions ────────────────────────────────────────────────────────────────

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
      showToast(`Horaire généré : ${data.matches.length} parties${extra ? ` (${extra} équipe(s) avec une partie de plus)` : ''}.`);
    } finally {
      setBusy('');
    }
  }

  async function setPublished(published: boolean) {
    setBusy('publish');
    try {
      const res = await fetch(`/api/events/${eventId}/tournament`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: published ? 'published' : 'draft' }),
      });
      if (!res.ok) { showToast('Erreur.'); return; }
      applyState(await res.json());
      showToast(published ? 'Horaire publié — la page en direct est en ligne !' : 'Horaire remis en brouillon.');
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
      applyState(await res.json());
      setDrafts(prev => {
        const next = { ...prev };
        delete next[m.id];
        return next;
      });
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
    <div className="max-w-2xl mx-auto pb-24">
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
        <div className="flex gap-2">
          <button onClick={() => { navigator.clipboard.writeText(liveUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold bg-gray-50 text-text-muted hover:bg-gray-100 transition-all">
            {copied ? <Check className="h-3.5 w-3.5" style={{ color: DUO.green }} /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copié !' : 'Copier'}
          </button>
          <a href={liveUrl} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold transition-all"
            style={{ backgroundColor: `${DUO.blue}12`, color: DUO.blueDark }}>
            <Eye className="h-3.5 w-3.5" /> Ouvrir
          </a>
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
          <div>
            <label className="text-xs font-extrabold text-text-muted block mb-1">Début</label>
            <input type="time" value={form.start_time}
              onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
              className="w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-sm font-bold text-text-main focus:outline-none focus:border-[#FF9600] transition-all" />
          </div>
          <div className="grid grid-cols-2 gap-2">
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
        </div>

        <button onClick={() => generate(false)} disabled={busy !== ''}
          className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-white text-base font-extrabold transition-all active:translate-y-[2px] active:shadow-none hover:brightness-105 disabled:opacity-60"
          style={{ backgroundColor: DUO.orange, boxShadow: `0 3px 0 0 ${DUO.orangeDark}` }}>
          {busy === 'generate' ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
          {hasSchedule ? 'Régénérer l\'horaire' : 'Générer l\'horaire'}
        </button>
        {state.teams.length < 2 && (
          <p className="text-xs font-bold mt-2 flex items-center gap-1" style={{ color: DUO.red }}>
            <AlertTriangle className="h-3.5 w-3.5" /> Il faut au moins 2 équipes inscrites.
          </p>
        )}
      </div>

      {/* Publication + envoi */}
      {hasSchedule && (
        <div className="rounded-2xl bg-white p-4 mb-4 space-y-2.5" style={{ border: '2px solid #e5e7eb40', borderBottom: '4px solid #d1d5db40' }}>
          {!published ? (
            <button onClick={() => setPublished(true)} disabled={busy !== ''}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-white text-base font-extrabold transition-all active:translate-y-[2px] active:shadow-none hover:brightness-105 disabled:opacity-60"
              style={{ backgroundColor: DUO.green, boxShadow: `0 3px 0 0 ${DUO.greenDark}` }}>
              {busy === 'publish' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Eye className="h-5 w-5" />}
              Publier l&apos;horaire (page en direct)
            </button>
          ) : (
            <>
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
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-sm font-extrabold text-text-main flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4" style={{ color: DUO.blue }} /> Horaire &amp; pointages
            </h2>
            <span className="text-xs font-extrabold" style={{ color: DUO.greenDark }}>{finishedCount}/{state.matches.length} jouées</span>
          </div>
          <div className="space-y-3">
            {bySlot.map(([time, matches]) => (
              <div key={time}>
                <p className="text-xs font-extrabold text-text-muted mb-1.5 px-1">🕐 {time}</p>
                <div className="space-y-1.5">
                  {matches.map(m => {
                    const d = drafts[m.id] ?? { a: m.score_a === null ? '' : String(m.score_a), b: m.score_b === null ? '' : String(m.score_b) };
                    const finished = m.status === 'finished';
                    const dirty = drafts[m.id] !== undefined;
                    const aWins = finished && m.score_a !== null && m.score_b !== null && m.score_a > m.score_b;
                    const bWins = finished && m.score_a !== null && m.score_b !== null && m.score_b > m.score_a;
                    return (
                      <div key={m.id} className="rounded-2xl bg-white p-3"
                        style={{ border: finished ? `2px solid ${DUO.green}50` : '2px solid #e5e7eb', borderBottom: finished ? `4px solid ${DUO.green}50` : '4px solid #e5e7eb' }}>
                        <div className="flex items-center justify-between text-[11px] font-extrabold text-text-muted mb-1.5">
                          <span>M{m.match_number} · Terrain {m.court}</span>
                          {finished && <span style={{ color: DUO.greenDark }}>✓ Terminée</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="flex-1 text-sm font-extrabold truncate text-right" style={{ color: aWins ? DUO.greenDark : '#334155' }}>
                            {teamName(m.team_a_id, m.source_a)}
                          </span>
                          <input inputMode="numeric" value={d.a}
                            onChange={e => setDrafts(prev => ({ ...prev, [m.id]: { ...d, a: e.target.value.replace(/\D/g, '') } }))}
                            className="w-12 text-center rounded-lg border-2 border-gray-200 py-1.5 text-sm font-extrabold text-text-main focus:outline-none focus:border-[#1CB0F6]"
                            placeholder="—" />
                          <span className="text-xs font-extrabold text-text-light">vs</span>
                          <input inputMode="numeric" value={d.b}
                            onChange={e => setDrafts(prev => ({ ...prev, [m.id]: { ...d, b: e.target.value.replace(/\D/g, '') } }))}
                            className="w-12 text-center rounded-lg border-2 border-gray-200 py-1.5 text-sm font-extrabold text-text-main focus:outline-none focus:border-[#1CB0F6]"
                            placeholder="—" />
                          <span className="flex-1 text-sm font-extrabold truncate" style={{ color: bWins ? DUO.greenDark : '#334155' }}>
                            {teamName(m.team_b_id, m.source_b)}
                          </span>
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
                  })}
                </div>
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
            <span className="text-[11px] text-text-muted font-bold">(mis à jour à chaque pointage)</span>
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
                  <th className="text-center py-1.5 px-1.5">+/−</th>
                  <th className="text-center py-1.5 pl-1.5">Pts</th>
                </tr>
              </thead>
              <tbody>
                {state.standings.map(r => (
                  <tr key={r.teamId} className="border-t border-gray-100">
                    <td className="py-2 pr-2 font-extrabold" style={{ color: r.rank <= 3 ? DUO.orangeDark : '#9ca3af' }}>
                      {r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : r.rank}
                    </td>
                    <td className="py-2 pr-2 font-extrabold text-text-main">{r.teamName}</td>
                    <td className="py-2 px-1.5 text-center font-bold text-text-muted">{r.played}</td>
                    <td className="py-2 px-1.5 text-center font-bold" style={{ color: DUO.greenDark }}>{r.wins}</td>
                    <td className="py-2 px-1.5 text-center font-bold text-text-muted">{r.ties}</td>
                    <td className="py-2 px-1.5 text-center font-bold" style={{ color: DUO.red }}>{r.losses}</td>
                    <td className="py-2 px-1.5 text-center font-bold text-text-muted">{r.diff > 0 ? `+${r.diff}` : r.diff}</td>
                    <td className="py-2 pl-1.5 text-center font-extrabold text-text-main">{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
          body={`Chaque joueur confirmé recevra par courriel l'horaire de son équipe et le lien de la page en direct. ${state.config?.schedule_sent_at ? 'Un envoi a déjà été fait — ceci renverra à tout le monde.' : ''}`}
          confirmLabel="Envoyer maintenant"
          color={DUO.blue}
          onConfirm={sendSchedule}
          onClose={() => setConfirmSend(false)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-white text-sm font-extrabold shadow-lg"
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
