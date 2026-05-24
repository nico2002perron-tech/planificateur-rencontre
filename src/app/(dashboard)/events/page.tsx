'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  CalendarDays, Plus, Loader2, Pencil, Trash2, Eye, EyeOff,
  ChevronDown, ChevronUp, MapPin, Clock, Users, AlertTriangle,
  CheckCircle, XCircle, X, Upload, ImagePlus, Handshake,
  Download, Phone, Mail, UserCheck, Trophy, UtensilsCrossed,
  Mic, PartyPopper, Dumbbell, Star, Copy,
} from 'lucide-react';

const DUO = {
  green: '#58CC02', greenDark: '#45a300',
  blue: '#1CB0F6', blueDark: '#1899d6',
  purple: '#CE82FF', purpleDark: '#b06edb',
  orange: '#FF9600', orangeDark: '#e08600',
} as const;

const EVENT_TYPES = [
  { value: 'tournoi', label: 'Tournoi', icon: Trophy, color: DUO.green },
  { value: 'souper', label: 'Souper', icon: UtensilsCrossed, color: DUO.orange },
  { value: 'presentation', label: 'Presentation', icon: Mic, color: DUO.blue },
  { value: 'gala', label: 'Gala', icon: PartyPopper, color: DUO.purple },
  { value: 'conference', label: 'Conference', icon: Users, color: DUO.blueDark },
  { value: 'activite', label: 'Activite', icon: Dumbbell, color: DUO.greenDark },
  { value: 'autre', label: 'Autre', icon: Star, color: '#6b7280' },
];

const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const SKILL_LEVELS = ['Debutant', 'Intermediaire', 'Avance'];

interface EventData {
  id: string;
  created_by: string;
  title: string;
  description: string;
  event_type: string;
  date: string;
  time: string;
  end_date: string | null;
  location: string;
  location_url: string;
  cover_image: string;
  images: string[];
  collab_logos: { name: string; image_url: string }[];
  max_attendees: number | null;
  registration_deadline: string | null;
  is_registration_open: boolean;
  registration_mode: 'individual' | 'team' | 'both';
  team_size: number;
  team_label: string;
  allow_team_logo: boolean;
  pricing: { label: string; price: string }[];
  form_options: {
    show_company: boolean;
    show_dietary: boolean;
    show_skill_level: boolean;
    show_shirt_size: boolean;
    show_is_client: boolean;
  };
  contact_email: string;
  contact_phone: string;
  status: string;
  created_at: string;
  registration_count: number;
  creator: { id: string; name: string; email: string } | null;
}

interface Registration {
  id: string;
  event_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  is_client: boolean;
  registration_type: string;
  team_name: string;
  team_members: { name: string; email: string; phone: string }[];
  guests: number;
  pricing_option: string;
  dietary_restrictions: string;
  skill_level: string;
  shirt_size: string;
  notes: string;
  status: string;
  registered_at: string;
}

const emptyForm = () => ({
  title: '',
  description: '',
  event_type: 'autre',
  date: '',
  time: '',
  end_date: '',
  location: '',
  location_url: '',
  cover_image: '',
  images: [] as string[],
  collab_logos: [] as { name: string; image_url: string }[],
  max_attendees: '' as string | number,
  registration_deadline: '',
  is_registration_open: true,
  registration_mode: 'individual' as 'individual' | 'team' | 'both',
  team_size: 4,
  team_label: 'Equipe',
  allow_team_logo: false,
  pricing: [] as { label: string; price: string }[],
  form_options: {
    show_company: true,
    show_dietary: false,
    show_skill_level: false,
    show_shirt_size: false,
    show_is_client: false,
  },
  contact_email: '',
  contact_phone: '',
  status: 'draft' as string,
});

type FormData = ReturnType<typeof emptyForm>;

function formatDate(d: string) {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function EventsPage() {
  const { data: session } = useSession();
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'draft'>('upcoming');

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Images
  const [uploading, setUploading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const collabInputRef = useRef<HTMLInputElement>(null);
  const [collabName, setCollabName] = useState('');

  // Expanded + registrations
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(false);

  // Delete
  const [confirmDelete, setConfirmDelete] = useState<EventData | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = session?.user?.role === 'admin';

  useEffect(() => { fetchEvents(); }, []);

  async function fetchEvents() {
    const res = await fetch('/api/events?all=1');
    if (res.ok) setEvents(await res.json());
    setLoading(false);
  }

  async function fetchRegistrations(eventId: string) {
    setLoadingRegs(true);
    const res = await fetch(`/api/events/${eventId}/registrations`);
    if (res.ok) setRegistrations(await res.json());
    setLoadingRegs(false);
  }

  function openCreate() {
    setEditId(null);
    setForm(emptyForm());
    setFormError('');
    setShowForm(true);
  }

  function openEdit(e: EventData) {
    setEditId(e.id);
    setForm({
      title: e.title,
      description: e.description,
      event_type: e.event_type,
      date: e.date,
      time: e.time,
      end_date: e.end_date || '',
      location: e.location,
      location_url: e.location_url,
      cover_image: e.cover_image,
      images: e.images || [],
      collab_logos: e.collab_logos || [],
      max_attendees: e.max_attendees || '',
      registration_deadline: e.registration_deadline || '',
      is_registration_open: e.is_registration_open,
      registration_mode: e.registration_mode,
      team_size: e.team_size,
      team_label: e.team_label,
      allow_team_logo: e.allow_team_logo ?? false,
      pricing: e.pricing || [],
      form_options: e.form_options || emptyForm().form_options,
      contact_email: e.contact_email,
      contact_phone: e.contact_phone,
      status: e.status,
    });
    setFormError('');
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const payload = {
        ...form,
        max_attendees: form.max_attendees ? Number(form.max_attendees) : null,
        end_date: form.end_date || null,
        registration_deadline: form.registration_deadline || null,
      };
      const url = editId ? `/api/events/${editId}` : '/api/events';
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error); return; }
      setShowForm(false);
      await fetchEvents();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/events/${confirmDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        setEvents(prev => prev.filter(e => e.id !== confirmDelete.id));
        setConfirmDelete(null);
      }
    } finally {
      setDeleting(false);
    }
  }

  async function toggleStatus(ev: EventData, newStatus: string) {
    const res = await fetch(`/api/events/${ev.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setEvents(prev => prev.map(e => e.id === ev.id ? { ...e, status: newStatus } : e));
    }
  }

  async function uploadImage(file: File, type: 'cover' | 'gallery' | 'collab') {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/events/images', { method: 'POST', body: fd });
      if (!res.ok) return;
      const { url } = await res.json();

      if (type === 'cover') {
        setForm(prev => ({ ...prev, cover_image: url }));
      } else if (type === 'gallery') {
        setForm(prev => ({ ...prev, images: [...prev.images, url] }));
      } else if (type === 'collab') {
        if (collabName.trim()) {
          setForm(prev => ({ ...prev, collab_logos: [...prev.collab_logos, { name: collabName.trim(), image_url: url }] }));
          setCollabName('');
        }
      }
    } finally {
      setUploading(false);
    }
  }

  async function cancelRegistration(eventId: string, regId: string) {
    const res = await fetch(`/api/events/${eventId}/registrations`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registration_id: regId }),
    });
    if (res.ok) {
      setRegistrations(prev => prev.map(r => r.id === regId ? { ...r, status: 'cancelled' } : r));
    }
  }

  function exportCSV(eventTitle: string) {
    const active = registrations.filter(r => r.status !== 'cancelled');
    const rows = [['Prenom', 'Nom', 'Courriel', 'Telephone', 'Entreprise', 'Client', 'Type', 'Equipe', 'Coequipiers', 'Accompagnateurs', 'Tarif', 'Restrictions', 'Niveau', 'Taille', 'Notes', 'Statut', 'Date'].join(',')];
    active.forEach(r => {
      const members = (r.team_members || []).map((m: { name: string }) => m.name).join('; ');
      rows.push([r.first_name, r.last_name, r.email, r.phone, r.company, r.is_client ? 'Oui' : 'Non', r.registration_type, r.team_name, members, r.guests, r.pricing_option, r.dietary_restrictions, r.skill_level, r.shirt_size, r.notes.replace(/,/g, ';'), r.status, new Date(r.registered_at).toLocaleDateString('fr-CA')].map(v => `"${v || ''}"`).join(','));
    });
    const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inscriptions-${eventTitle.replace(/[^a-zA-Z0-9]/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function updateForm(key: string, value: unknown) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function updateFormOption(key: string, value: boolean) {
    setForm(prev => ({ ...prev, form_options: { ...prev.form_options, [key]: value } }));
  }

  const today = new Date().toISOString().split('T')[0];
  const filtered = events.filter(e => {
    if (filter === 'draft') return e.status === 'draft';
    if (filter === 'past') return e.date < today && e.status !== 'draft';
    return e.date >= today && e.status !== 'draft';
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: DUO.orange }} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-text-main">Evenements</h1>
          <p className="text-base text-text-muted mt-1">Creez, gerez et suivez vos evenements</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-extrabold transition-all active:translate-y-[2px] active:shadow-none hover:brightness-105"
          style={{ backgroundColor: DUO.orange, boxShadow: `0 3px 0 0 ${DUO.orangeDark}` }}
        >
          <Plus className="h-4 w-4" /> Nouvel evenement
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {([['upcoming', 'A venir'], ['past', 'Passes'], ['draft', 'Brouillons']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)}
            className="px-4 py-2 rounded-xl text-sm font-extrabold transition-all"
            style={{
              backgroundColor: filter === key ? `${DUO.orange}15` : 'transparent',
              color: filter === key ? DUO.orange : '#9ca3af',
              border: filter === key ? `2px solid ${DUO.orange}40` : '2px solid transparent',
            }}
          >{label} ({events.filter(e => {
            if (key === 'draft') return e.status === 'draft';
            if (key === 'past') return e.date < today && e.status !== 'draft';
            return e.date >= today && e.status !== 'draft';
          }).length})</button>
        ))}
      </div>

      {/* Events list */}
      <div className="space-y-3">
        {filtered.map(ev => {
          const typeInfo = EVENT_TYPES.find(t => t.value === ev.event_type) || EVENT_TYPES[6];
          const TypeIcon = typeInfo.icon;
          return (
            <div key={ev.id} className="rounded-2xl bg-white overflow-hidden transition-all duration-200"
              style={{ border: '2px solid #e5e7eb20', borderBottom: '4px solid #d1d5db20' }}
            >
              <div className="p-5 flex items-center gap-4">
                {/* Type icon */}
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${typeInfo.color}15` }}
                >
                  {ev.cover_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ev.cover_image} alt="" className="w-full h-full rounded-2xl object-cover" />
                  ) : (
                    <TypeIcon className="h-5 w-5" style={{ color: typeInfo.color }} />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-extrabold text-text-main truncate">{ev.title}</p>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: typeInfo.color }}>{typeInfo.label}</span>
                    {ev.status === 'draft' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-text-light">Brouillon</span>}
                    {ev.status === 'cancelled' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600">Annule</span>}
                    {ev.status === 'completed' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">Termine</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-sm text-text-muted">
                    <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {formatDate(ev.date)}{ev.time ? ` a ${ev.time}` : ''}</span>
                    {ev.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {ev.location}</span>}
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {ev.registration_count}{ev.max_attendees ? `/${ev.max_attendees}` : ''} inscrit{ev.registration_count !== 1 ? 's' : ''}</span>
                    {ev.creator && <span className="text-[11px] text-text-light">par {ev.creator.name}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {ev.status === 'draft' && (
                    <button onClick={() => toggleStatus(ev, 'published')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all"
                      style={{ backgroundColor: `${DUO.green}12`, color: DUO.greenDark }}
                    ><Eye className="h-3 w-3" /> Publier</button>
                  )}
                  {ev.status === 'published' && (
                    <button onClick={() => toggleStatus(ev, 'draft')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold bg-gray-50 text-text-muted hover:bg-gray-100 transition-all"
                    ><EyeOff className="h-3 w-3" /> Depublier</button>
                  )}
                  <button onClick={() => openEdit(ev)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all"
                    style={{ backgroundColor: `${DUO.blue}12`, color: DUO.blueDark }}
                  ><Pencil className="h-3 w-3" /> Modifier</button>
                  <button onClick={() => setConfirmDelete(ev)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-text-light hover:text-red-600 transition-all"
                  ><Trash2 className="h-3.5 w-3.5" /></button>
                  <button onClick={() => {
                    if (expandedId === ev.id) { setExpandedId(null); } else { setExpandedId(ev.id); fetchRegistrations(ev.id); }
                  }} className="p-1.5 rounded-lg hover:bg-gray-100 text-text-muted transition-all">
                    {expandedId === ev.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Expanded — Registrations */}
              {expandedId === ev.id && (
                <div className="px-5 pb-5 pt-0 border-t border-gray-100">
                  {/* Collab logos preview */}
                  {ev.collab_logos?.length > 0 && (
                    <div className="flex items-center gap-3 mt-4 mb-3 p-3 rounded-xl bg-gray-50">
                      <Handshake className="h-4 w-4 text-text-muted flex-shrink-0" />
                      <div className="flex items-center gap-2">
                        {ev.collab_logos.map((logo, i) => (
                          <div key={i} className="flex items-center gap-2">
                            {i > 0 && <span className="text-lg font-bold text-text-light">&times;</span>}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={logo.image_url} alt={logo.name} className="h-8 w-auto object-contain" />
                            <span className="text-xs font-bold text-text-main">{logo.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-4 mb-3">
                    <h4 className="text-sm font-extrabold text-text-main flex items-center gap-1.5">
                      <UserCheck className="h-4 w-4" style={{ color: DUO.blue }} />
                      Inscriptions ({registrations.filter(r => r.status !== 'cancelled').length})
                    </h4>
                    <div className="flex gap-2">
                      <button onClick={() => exportCSV(ev.title)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold bg-gray-50 text-text-muted hover:bg-gray-100 transition-all"
                      ><Download className="h-3 w-3" /> CSV</button>
                      <button onClick={() => {
                        const link = `${window.location.origin}/api/events/${ev.id}/register`;
                        navigator.clipboard.writeText(link);
                      }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold bg-gray-50 text-text-muted hover:bg-gray-100 transition-all"
                      ><Copy className="h-3 w-3" /> Lien</button>
                    </div>
                  </div>

                  {loadingRegs ? (
                    <div className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin mx-auto" style={{ color: DUO.blue }} /></div>
                  ) : registrations.filter(r => r.status !== 'cancelled').length === 0 ? (
                    <p className="text-sm text-text-muted text-center py-6">Aucune inscription pour le moment</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left py-2 px-2 text-xs font-bold text-text-muted">Nom</th>
                            <th className="text-left py-2 px-2 text-xs font-bold text-text-muted">Courriel</th>
                            <th className="text-left py-2 px-2 text-xs font-bold text-text-muted">Tel.</th>
                            {ev.registration_mode !== 'individual' && <th className="text-left py-2 px-2 text-xs font-bold text-text-muted">Equipe</th>}
                            {ev.form_options?.show_is_client && <th className="text-left py-2 px-2 text-xs font-bold text-text-muted">Client</th>}
                            {ev.pricing?.length > 0 && <th className="text-left py-2 px-2 text-xs font-bold text-text-muted">Tarif</th>}
                            {ev.form_options?.show_dietary && <th className="text-left py-2 px-2 text-xs font-bold text-text-muted">Restrictions</th>}
                            {ev.form_options?.show_skill_level && <th className="text-left py-2 px-2 text-xs font-bold text-text-muted">Niveau</th>}
                            {ev.form_options?.show_shirt_size && <th className="text-left py-2 px-2 text-xs font-bold text-text-muted">Taille</th>}
                            <th className="text-right py-2 px-2 text-xs font-bold text-text-muted"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {registrations.filter(r => r.status !== 'cancelled').map(r => (
                            <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                              <td className="py-2 px-2 font-bold text-text-main">{r.first_name} {r.last_name}</td>
                              <td className="py-2 px-2 text-text-muted">{r.email}</td>
                              <td className="py-2 px-2 text-text-muted">{r.phone}</td>
                              {ev.registration_mode !== 'individual' && (
                                <td className="py-2 px-2">
                                  {r.team_name && (
                                    <div>
                                      <span className="font-bold text-text-main">{r.team_name}</span>
                                      {r.team_members?.length > 0 && (
                                        <p className="text-[11px] text-text-muted">{r.team_members.map((m: { name: string }) => m.name).join(', ')}</p>
                                      )}
                                    </div>
                                  )}
                                </td>
                              )}
                              {ev.form_options?.show_is_client && <td className="py-2 px-2">{r.is_client ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 text-gray-300" />}</td>}
                              {ev.pricing?.length > 0 && <td className="py-2 px-2 text-text-muted">{r.pricing_option}</td>}
                              {ev.form_options?.show_dietary && <td className="py-2 px-2 text-text-muted text-xs">{r.dietary_restrictions}</td>}
                              {ev.form_options?.show_skill_level && <td className="py-2 px-2 text-text-muted text-xs">{r.skill_level}</td>}
                              {ev.form_options?.show_shirt_size && <td className="py-2 px-2 text-text-muted text-xs">{r.shirt_size}</td>}
                              <td className="py-2 px-2 text-right">
                                <button onClick={() => cancelRegistration(ev.id, r.id)} className="text-red-400 hover:text-red-600 transition-colors"><XCircle className="h-3.5 w-3.5" /></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <CalendarDays className="h-12 w-12 text-text-light mx-auto mb-3" />
            <p className="font-extrabold text-text-main">Aucun evenement</p>
            <p className="text-sm text-text-muted mt-1">Creez votre premier evenement pour commencer</p>
          </div>
        )}
      </div>

      {/* Create/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full my-8 overflow-hidden">
            <div className="px-6 py-4 flex-shrink-0" style={{ background: `linear-gradient(135deg, ${DUO.orange}, ${DUO.orangeDark})` }}>
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                {editId ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                {editId ? 'Modifier l\'evenement' : 'Nouvel evenement'}
              </h2>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">

              {/* Title + Type */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-extrabold text-text-main mb-1.5">Titre *</label>
                  <input type="text" value={form.title} onChange={e => updateForm('title', e.target.value)} required placeholder="Tournoi de golf annuel" className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-[#FF9600] transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-text-main mb-1.5">Type *</label>
                  <select value={form.event_type} onChange={e => updateForm('event_type', e.target.value)} className="w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-[#FF9600] transition-all">
                    {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Date + Time + Location */}
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-text-main mb-1.5">Date *</label>
                  <input type="date" value={form.date} onChange={e => updateForm('date', e.target.value)} required className="w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-[#FF9600] transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-text-main mb-1.5">Heure</label>
                  <input type="text" value={form.time} onChange={e => updateForm('time', e.target.value)} placeholder="18h00" className="w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-[#FF9600] transition-all" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-extrabold text-text-main mb-1.5">Lieu</label>
                  <input type="text" value={form.location} onChange={e => updateForm('location', e.target.value)} placeholder="Club de golf Lorette" className="w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-[#FF9600] transition-all" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-text-main mb-1.5">Lien Google Maps</label>
                <input type="url" value={form.location_url} onChange={e => updateForm('location_url', e.target.value)} placeholder="https://maps.google.com/..." className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-[#FF9600] transition-all" />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-extrabold text-text-main mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => updateForm('description', e.target.value)} rows={4} placeholder="Decrivez votre evenement..." className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-text-main focus:outline-none focus:border-[#FF9600] transition-all resize-none" />
              </div>

              {/* Cover Image */}
              <div>
                <label className="block text-xs font-extrabold text-text-main mb-1.5 flex items-center gap-1"><ImagePlus className="h-3 w-3" style={{ color: DUO.orange }} /> Image de couverture</label>
                <div className="flex items-center gap-3">
                  {form.cover_image ? (
                    <div className="relative w-32 h-20 rounded-xl overflow-hidden border-2 border-gray-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={form.cover_image} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => updateForm('cover_image', '')} className="absolute top-1 right-1 p-0.5 rounded-full bg-white/90 text-red-500 hover:bg-white"><X className="h-3 w-3" /></button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => coverInputRef.current?.click()}
                      className="w-32 h-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-text-muted hover:border-[#FF9600] transition-all"
                    >{uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}</button>
                  )}
                  <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0], 'cover')} />
                </div>
              </div>

              {/* Gallery */}
              <div>
                <label className="block text-xs font-extrabold text-text-main mb-1.5 flex items-center gap-1"><ImagePlus className="h-3 w-3" style={{ color: DUO.blue }} /> Images supplementaires (carousel)</label>
                <div className="flex flex-wrap gap-2">
                  {form.images.map((img, i) => (
                    <div key={i} className="relative w-20 h-14 rounded-lg overflow-hidden border border-gray-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setForm(prev => ({ ...prev, images: prev.images.filter((_, j) => j !== i) }))} className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-white/90 text-red-500"><X className="h-2.5 w-2.5" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => imageInputRef.current?.click()}
                    className="w-20 h-14 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-text-muted hover:border-[#1CB0F6] transition-all"
                  ><Plus className="h-4 w-4" /></button>
                  <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0], 'gallery')} />
                </div>
              </div>

              {/* Collaboration logos */}
              <div>
                <label className="block text-xs font-extrabold text-text-main mb-1.5 flex items-center gap-1"><Handshake className="h-3 w-3" style={{ color: DUO.purple }} /> Logos partenaires</label>
                {form.collab_logos.length > 0 && (
                  <div className="flex items-center gap-2 mb-2 p-2 rounded-xl bg-gray-50">
                    {form.collab_logos.map((logo, i) => (
                      <div key={i} className="flex items-center gap-1">
                        {i > 0 && <span className="text-lg font-bold text-text-light mx-1">&times;</span>}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={logo.image_url} alt={logo.name} className="h-8 w-auto object-contain" />
                        <span className="text-xs font-bold">{logo.name}</span>
                        <button type="button" onClick={() => setForm(prev => ({ ...prev, collab_logos: prev.collab_logos.filter((_, j) => j !== i) }))} className="p-0.5 text-red-400 hover:text-red-600"><X className="h-3 w-3" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input type="text" value={collabName} onChange={e => setCollabName(e.target.value)} placeholder="Nom du partenaire" className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:border-[#CE82FF]" />
                  <button type="button" onClick={() => collabInputRef.current?.click()} disabled={!collabName.trim()}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 hover:border-[#CE82FF] disabled:opacity-40 transition-all"
                  ><Upload className="h-3.5 w-3.5" /></button>
                  <input ref={collabInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0], 'collab')} />
                </div>
              </div>

              {/* Registration settings */}
              <div className="p-4 rounded-xl border-2 border-gray-100 space-y-4">
                <h3 className="text-sm font-extrabold text-text-main flex items-center gap-1.5"><UserCheck className="h-4 w-4" style={{ color: DUO.green }} /> Inscription</h3>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-extrabold text-text-main mb-1.5">Mode</label>
                    <select value={form.registration_mode} onChange={e => updateForm('registration_mode', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#58CC02]">
                      <option value="individual">Individuel</option>
                      <option value="team">Equipe</option>
                      <option value="both">Les deux</option>
                    </select>
                  </div>
                  {form.registration_mode !== 'individual' && (
                    <>
                      <div>
                        <label className="block text-xs font-extrabold text-text-main mb-1.5">Joueurs/equipe</label>
                        <input type="number" value={form.team_size} onChange={e => updateForm('team_size', parseInt(e.target.value) || 4)} min={2} max={20} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#58CC02]" />
                      </div>
                      <div>
                        <label className="block text-xs font-extrabold text-text-main mb-1.5">Label</label>
                        <input type="text" value={form.team_label} onChange={e => updateForm('team_label', e.target.value)} placeholder="Equipe" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#58CC02]" />
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label className="flex items-center gap-2 text-xs font-extrabold text-text-main cursor-pointer">
                          <input type="checkbox" checked={form.allow_team_logo} onChange={e => updateForm('allow_team_logo', e.target.checked)} />
                          Permettre un logo d&apos;equipe (le capitaine peut televerser un logo)
                        </label>
                      </div>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-extrabold text-text-main mb-1.5">Places max</label>
                    <input type="number" value={form.max_attendees} onChange={e => updateForm('max_attendees', e.target.value)} placeholder="Illimite" min={1} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#58CC02]" />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-text-main mb-1.5">Date limite</label>
                    <input type="date" value={form.registration_deadline} onChange={e => updateForm('registration_deadline', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#58CC02]" />
                  </div>
                </div>

                {/* Pricing */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-extrabold text-text-main">Tarification</label>
                    <button type="button" onClick={() => updateForm('pricing', [...form.pricing, { label: '', price: '' }])} className="text-[11px] font-bold hover:underline" style={{ color: DUO.orange }}>+ Ajouter un tarif</button>
                  </div>
                  {form.pricing.map((p, i) => (
                    <div key={i} className="flex gap-2 mb-1.5">
                      <input type="text" value={p.label} onChange={e => { const arr = [...form.pricing]; arr[i] = { ...arr[i], label: e.target.value }; updateForm('pricing', arr); }} placeholder="Ex: Client" className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm" />
                      <input type="text" value={p.price} onChange={e => { const arr = [...form.pricing]; arr[i] = { ...arr[i], price: e.target.value }; updateForm('pricing', arr); }} placeholder="Gratuit / 75$" className="w-28 rounded-lg border border-gray-200 px-3 py-1.5 text-sm" />
                      <button type="button" onClick={() => updateForm('pricing', form.pricing.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>

                {/* Form options toggles */}
                <div>
                  <label className="text-xs font-extrabold text-text-main mb-2 block">Champs du formulaire</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: 'show_company', label: 'Entreprise' },
                      { key: 'show_is_client', label: 'Client oui/non' },
                      { key: 'show_dietary', label: 'Restrictions alimentaires' },
                      { key: 'show_skill_level', label: 'Niveau (sport)' },
                      { key: 'show_shirt_size', label: 'Taille chandail' },
                    ].map(opt => (
                      <button key={opt.key} type="button"
                        onClick={() => updateFormOption(opt.key, !form.form_options[opt.key as keyof typeof form.form_options])}
                        className="px-3 py-1.5 rounded-full text-xs font-bold transition-all border-2"
                        style={{
                          borderColor: form.form_options[opt.key as keyof typeof form.form_options] ? DUO.green : '#e5e7eb',
                          backgroundColor: form.form_options[opt.key as keyof typeof form.form_options] ? `${DUO.green}10` : 'white',
                          color: form.form_options[opt.key as keyof typeof form.form_options] ? DUO.greenDark : '#9ca3af',
                        }}
                      >{opt.label}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-text-main mb-1.5 flex items-center gap-1"><Mail className="h-3 w-3" /> Courriel contact</label>
                  <input type="email" value={form.contact_email} onChange={e => updateForm('contact_email', e.target.value)} placeholder="info@groupefinancier.com" className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:border-[#FF9600] transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-text-main mb-1.5 flex items-center gap-1"><Phone className="h-3 w-3" /> Telephone contact</label>
                  <input type="tel" value={form.contact_phone} onChange={e => updateForm('contact_phone', e.target.value)} placeholder="418-555-1234" className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:border-[#FF9600] transition-all" />
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: `${DUO.green}08` }}>
                <button type="button" onClick={() => updateForm('status', form.status === 'published' ? 'draft' : 'published')}
                  className="relative w-11 h-6 rounded-full transition-all flex-shrink-0"
                  style={{ backgroundColor: form.status === 'published' ? DUO.green : '#d1d5db' }}
                >
                  <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: form.status === 'published' ? '22px' : '2px' }} />
                </button>
                <p className="text-xs font-extrabold text-text-main">{form.status === 'published' ? 'Publie sur le site' : 'Brouillon (non visible)'}</p>
              </div>

              {formError && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-2.5 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {formError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-extrabold text-text-muted hover:bg-gray-50 transition-all">Annuler</button>
                <button type="submit" disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-extrabold transition-all active:translate-y-[2px] active:shadow-none hover:brightness-105 disabled:opacity-60"
                  style={{ backgroundColor: DUO.orange, boxShadow: `0 3px 0 0 ${DUO.orangeDark}` }}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  {editId ? 'Sauvegarder' : 'Creer l\'evenement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="px-6 py-4 bg-red-500">
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2"><Trash2 className="h-5 w-5" /> Supprimer</h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-text-main">Supprimer definitivement <strong>{confirmDelete.title}</strong> et toutes ses inscriptions ?</p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-extrabold text-text-muted hover:bg-gray-50 transition-all">Annuler</button>
                <button onClick={handleDelete} disabled={deleting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-extrabold transition-all active:translate-y-[2px] bg-red-500 hover:bg-red-600 disabled:opacity-60"
                  style={{ boxShadow: '0 3px 0 0 #b91c1c' }}
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
