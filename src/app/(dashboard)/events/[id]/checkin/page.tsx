'use client';

import { useState, useEffect, useMemo, useRef, useCallback, use } from 'react';
import jsQR from 'jsqr';
import {
  Loader2, Search, CheckCircle2, Circle, ArrowLeft, Trophy, Users, Shirt, PartyPopper,
  ScanLine, X, AlertTriangle,
} from 'lucide-react';

const DUO = {
  green: '#58CC02', greenDark: '#45a300',
  blue: '#1CB0F6', blueDark: '#1899d6',
  purple: '#CE82FF', purpleDark: '#b06edb',
  orange: '#FF9600', orangeDark: '#e08600',
} as const;

interface Person {
  id: string;
  kind: 'registration' | 'member';
  first_name: string;
  last_name: string;
  phone: string;
  shirt_size: string;
  team_name: string;   // '' = individuel
  is_captain: boolean;
  checked_in_at: string | null;
}

interface EventInfo {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  form_options?: { show_shirt_size?: boolean };
}

export default function CheckinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'arrived'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Scanner QR
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const [scanFeedback, setScanFeedback] = useState<{ status: 'ok' | 'already' | 'unknown'; label: string; detail?: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peopleRef = useRef<Person[]>([]);
  const lastScanRef = useRef<{ payload: string; at: number }>({ payload: '', at: 0 });
  useEffect(() => { peopleRef.current = people; }, [people]);

  useEffect(() => {
    async function load() {
      try {
        const [evRes, regRes] = await Promise.all([
          fetch('/api/events?all=1'),
          fetch(`/api/events/${eventId}/registrations`),
        ]);
        if (!evRes.ok || !regRes.ok) { setError('Impossible de charger les donnees.'); return; }

        const events = await evRes.json();
        const found = (events || []).find((e: EventInfo) => e.id === eventId);
        if (!found) { setError('Evenement introuvable.'); return; }
        setEvent(found);

        const data = await regRes.json();
        const regs = Array.isArray(data) ? data : (data.registrations || []);
        const teams = Array.isArray(data) ? [] : (data.teams || []);

        const list: Person[] = [];
        for (const t of teams) {
          for (const m of t.members || []) {
            list.push({
              id: m.id, kind: 'member',
              first_name: m.first_name, last_name: m.last_name, phone: m.phone || '',
              shirt_size: m.shirt_size || '', team_name: t.team_name,
              is_captain: !!m.is_captain, checked_in_at: m.checked_in_at || null,
            });
          }
        }
        for (const r of regs) {
          if (r.status === 'cancelled') continue;
          list.push({
            id: r.id, kind: 'registration',
            first_name: r.first_name, last_name: r.last_name, phone: r.phone || '',
            shirt_size: r.shirt_size || '', team_name: '',
            is_captain: false, checked_in_at: r.checked_in_at || null,
          });
        }
        setPeople(list);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [eventId]);

  async function toggle(p: Person) {
    if (busyId) return;
    setBusyId(p.id);
    const newChecked = !p.checked_in_at;
    // Optimiste
    setPeople(prev => prev.map(x => x.id === p.id ? { ...x, checked_in_at: newChecked ? new Date().toISOString() : null } : x));
    try {
      const res = await fetch(`/api/events/${eventId}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: p.kind, id: p.id, checked: newChecked }),
      });
      if (!res.ok) {
        // Rollback
        setPeople(prev => prev.map(x => x.id === p.id ? { ...x, checked_in_at: p.checked_in_at } : x));
      }
    } catch {
      setPeople(prev => prev.map(x => x.id === p.id ? { ...x, checked_in_at: p.checked_in_at } : x));
    } finally {
      setBusyId(null);
    }
  }

  // ── Scanner QR : « GFSF:<kind>:<id> » dans les courriels de confirmation ──
  const handleScanPayload = useCallback(async (payload: string) => {
    const now = Date.now();
    if (lastScanRef.current.payload === payload && now - lastScanRef.current.at < 3000) return;
    lastScanRef.current = { payload, at: now };

    const m = /^GFSF:(registration|member):([0-9a-f-]{36})$/i.exec(payload.trim());
    if (!m) {
      setScanFeedback({ status: 'unknown', label: 'Code non reconnu' });
      return;
    }
    const kind = m[1].toLowerCase() as 'registration' | 'member';
    const id = m[2].toLowerCase();
    const person = peopleRef.current.find(p => p.kind === kind && p.id.toLowerCase() === id);

    if (!person) {
      setScanFeedback({ status: 'unknown', label: 'Laissez-passer d\'un autre evenement' });
      return;
    }
    if (person.checked_in_at) {
      setScanFeedback({
        status: 'already',
        label: `${person.first_name} ${person.last_name} — deja enregistre`,
        detail: `Arrive a ${new Date(person.checked_in_at).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}`,
      });
      return;
    }

    // Enregistrement
    setPeople(prev => prev.map(x => x.id === person.id ? { ...x, checked_in_at: new Date().toISOString() } : x));
    if (navigator.vibrate) navigator.vibrate(120);
    setScanFeedback({
      status: 'ok',
      label: `Bienvenue ${person.first_name} ${person.last_name}!`,
      detail: [person.team_name || 'Individuel', person.shirt_size ? `Chandail ${person.shirt_size}` : ''].filter(Boolean).join(' · '),
    });
    try {
      const res = await fetch(`/api/events/${eventId}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: person.kind, id: person.id, checked: true }),
      });
      if (!res.ok) {
        setPeople(prev => prev.map(x => x.id === person.id ? { ...x, checked_in_at: null } : x));
        setScanFeedback({ status: 'unknown', label: 'Erreur d\'enregistrement — reessayez' });
      }
    } catch {
      setPeople(prev => prev.map(x => x.id === person.id ? { ...x, checked_in_at: null } : x));
      setScanFeedback({ status: 'unknown', label: 'Erreur de connexion — reessayez' });
    }
  }, [eventId]);

  useEffect(() => {
    if (!scannerOpen) return;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        interval = setInterval(() => {
          if (!video.videoWidth || !ctx) return;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
          if (code?.data) handleScanPayload(code.data);
        }, 250);
      } catch {
        setScannerError('Impossible d\'acceder a la camera. Verifiez les permissions du navigateur.');
      }
    }
    start();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [scannerOpen, handleScanPayload]);

  function closeScanner() {
    setScannerOpen(false);
    setScannerError('');
    setScanFeedback(null);
  }

  const arrived = people.filter(p => p.checked_in_at).length;
  const total = people.length;
  const pct = total > 0 ? Math.round((arrived / total) * 100) : 0;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people.filter(p => {
      if (filter === 'pending' && p.checked_in_at) return false;
      if (filter === 'arrived' && !p.checked_in_at) return false;
      if (!q) return true;
      return (`${p.first_name} ${p.last_name} ${p.team_name}`).toLowerCase().includes(q);
    });
  }, [people, search, filter]);

  // Groupe : equipes d'abord (ordre alpha), puis individuels
  const grouped = useMemo(() => {
    const groups = new Map<string, Person[]>();
    for (const p of visible) {
      const key = p.team_name || '__indiv__';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }
    const teamKeys = [...groups.keys()].filter(k => k !== '__indiv__').sort((a, b) => a.localeCompare(b, 'fr'));
    const ordered: { label: string; isTeam: boolean; people: Person[] }[] = [];
    for (const k of teamKeys) ordered.push({ label: k, isTeam: true, people: groups.get(k)! });
    if (groups.has('__indiv__')) ordered.push({ label: 'Individuels', isTeam: false, people: groups.get('__indiv__')! });
    return ordered;
  }, [visible]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: DUO.green }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <p className="font-extrabold text-text-main">{error}</p>
        <a href="/events" className="text-sm font-bold mt-3 inline-block" style={{ color: DUO.blue }}>&larr; Retour aux evenements</a>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto pb-24">
      {/* Header */}
      <div className="mb-4">
        <a href="/events" className="inline-flex items-center gap-1.5 text-sm font-bold text-text-muted hover:text-text-main transition-colors mb-2">
          <ArrowLeft className="h-4 w-4" /> Evenements
        </a>
        <h1 className="text-2xl font-extrabold text-text-main">{event?.title}</h1>
        <p className="text-sm text-text-muted mt-0.5">Prise des presences {event?.time ? `· ${event.time}` : ''} {event?.location ? `· ${event.location}` : ''}</p>
      </div>

      {/* Progress */}
      <div className="rounded-2xl bg-white p-4 mb-4" style={{ border: '2px solid #e5e7eb40', borderBottom: '4px solid #d1d5db40' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-extrabold text-text-main flex items-center gap-1.5">
            {arrived === total && total > 0
              ? <><PartyPopper className="h-4 w-4" style={{ color: DUO.green }} /> Tout le monde est la!</>
              : <>Arrives</>}
          </span>
          <span className="text-sm font-extrabold" style={{ color: DUO.greenDark }}>{arrived}/{total}</span>
        </div>
        <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: DUO.green }} />
        </div>
      </div>

      {/* Scanner QR */}
      <button onClick={() => setScannerOpen(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl text-white text-base font-extrabold mb-4 transition-all active:translate-y-[2px] active:shadow-none hover:brightness-105"
        style={{ backgroundColor: DUO.blue, boxShadow: `0 3px 0 0 ${DUO.blueDark}` }}
      >
        <ScanLine className="h-5 w-5" /> Scanner les laissez-passer
      </button>

      {/* Search + filters */}
      <div className="sticky top-0 z-10 bg-[#f7f7f7] pt-1 pb-3 space-y-2">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-light" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Chercher un nom ou une equipe..."
            className="w-full rounded-xl border-2 border-gray-200 bg-white pl-10 pr-4 py-3 text-base text-text-main focus:outline-none focus:border-[#58CC02] transition-all"
          />
        </div>
        <div className="flex gap-2">
          {([['all', 'Tous'], ['pending', 'Restants'], ['arrived', 'Arrives']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)}
              className="flex-1 px-3 py-2 rounded-xl text-sm font-extrabold transition-all"
              style={{
                backgroundColor: filter === key ? `${DUO.green}15` : 'white',
                color: filter === key ? DUO.greenDark : '#9ca3af',
                border: filter === key ? `2px solid ${DUO.green}50` : '2px solid #e5e7eb',
              }}
            >{label} ({key === 'all' ? total : key === 'pending' ? total - arrived : arrived})</button>
          ))}
        </div>
      </div>

      {/* List */}
      {grouped.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-10">
          {total === 0 ? 'Aucun inscrit pour cet evenement.' : 'Aucun resultat pour ce filtre.'}
        </p>
      ) : (
        <div className="space-y-4">
          {grouped.map(group => (
            <div key={group.label}>
              <p className="text-xs font-extrabold text-text-muted mb-1.5 flex items-center gap-1.5 px-1">
                {group.isTeam ? <Trophy className="h-3.5 w-3.5" style={{ color: DUO.blue }} /> : <Users className="h-3.5 w-3.5" />}
                {group.label}
                <span className="font-bold">({group.people.filter(p => p.checked_in_at).length}/{group.people.length})</span>
              </p>
              <div className="space-y-1.5">
                {group.people.map(p => {
                  const checked = !!p.checked_in_at;
                  return (
                    <button key={p.id} onClick={() => toggle(p)} disabled={busyId === p.id}
                      className="w-full flex items-center gap-3 rounded-xl px-4 py-3.5 text-left transition-all active:scale-[0.99]"
                      style={{
                        backgroundColor: checked ? `${DUO.green}10` : 'white',
                        border: checked ? `2px solid ${DUO.green}50` : '2px solid #e5e7eb',
                      }}
                    >
                      {busyId === p.id
                        ? <Loader2 className="h-6 w-6 animate-spin flex-shrink-0" style={{ color: DUO.green }} />
                        : checked
                          ? <CheckCircle2 className="h-6 w-6 flex-shrink-0" style={{ color: DUO.green }} />
                          : <Circle className="h-6 w-6 flex-shrink-0 text-gray-300" />}
                      <span className="flex-1 min-w-0">
                        <span className="block font-extrabold text-text-main truncate" style={{ textDecoration: 'none' }}>
                          {p.first_name} {p.last_name}{p.is_captain ? ' (capitaine)' : ''}
                        </span>
                        {checked && p.checked_in_at && (
                          <span className="block text-[11px] font-bold" style={{ color: DUO.greenDark }}>
                            Arrive a {new Date(p.checked_in_at).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </span>
                      {event?.form_options?.show_shirt_size && p.shirt_size && (
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold flex-shrink-0"
                          style={{ backgroundColor: `${DUO.purple}12`, color: DUO.purpleDark }}>
                          <Shirt className="h-3 w-3" /> {p.shirt_size}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Overlay scanner */}
      {scannerOpen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-black/80">
            <p className="text-white font-extrabold text-sm flex items-center gap-2">
              <ScanLine className="h-4 w-4" style={{ color: DUO.blue }} /> Scanner un laissez-passer
            </p>
            <button onClick={closeScanner} className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="relative flex-1 overflow-hidden">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />

            {/* Cadre de visee */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-60 h-60 rounded-3xl" style={{ border: `3px solid ${DUO.blue}`, boxShadow: '0 0 0 9999px rgba(0,0,0,.45)' }} />
            </div>

            {scannerError && (
              <div className="absolute inset-x-4 top-4 bg-red-50 text-red-700 text-sm font-bold px-4 py-3 rounded-xl flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {scannerError}
              </div>
            )}

            {/* Feedback du dernier scan */}
            {scanFeedback && (
              <div className="absolute inset-x-4 bottom-6 rounded-2xl px-5 py-4 flex items-center gap-3"
                style={{
                  backgroundColor: scanFeedback.status === 'ok' ? DUO.green : scanFeedback.status === 'already' ? DUO.orange : '#ef4444',
                }}
              >
                {scanFeedback.status === 'ok'
                  ? <CheckCircle2 className="h-8 w-8 text-white flex-shrink-0" />
                  : <AlertTriangle className="h-8 w-8 text-white flex-shrink-0" />}
                <div className="min-w-0">
                  <p className="text-white font-extrabold truncate">{scanFeedback.label}</p>
                  {scanFeedback.detail && <p className="text-white/85 text-sm font-bold truncate">{scanFeedback.detail}</p>}
                </div>
              </div>
            )}
          </div>

          <div className="px-4 py-3 bg-black/80 text-center">
            <p className="text-white/70 text-xs font-bold">{arrived}/{total} arrives · le compteur se met a jour a chaque scan</p>
          </div>
        </div>
      )}
    </div>
  );
}
