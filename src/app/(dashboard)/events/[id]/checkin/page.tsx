'use client';

import { useState, useEffect, useMemo, use } from 'react';
import {
  Loader2, Search, CheckCircle2, Circle, ArrowLeft, Trophy, Users, Shirt, PartyPopper,
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
    </div>
  );
}
