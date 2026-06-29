'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  CalendarDays, Plus, Loader2, Pencil, Trash2, Eye, EyeOff,
  ChevronDown, ChevronUp, MapPin, Clock, Users, AlertTriangle,
  CheckCircle, XCircle, X, Upload, ImagePlus, Handshake,
  Download, Phone, Mail, UserCheck, Trophy, UtensilsCrossed,
  Mic, PartyPopper, Dumbbell, Star, Copy, Crown, Shirt, ClipboardCheck,
  Sparkles, Timer, Search, ExternalLink, CalendarRange, ScrollText,
} from 'lucide-react';

const SITE_BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://groupefinancierstefoy.com';

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

// Couleurs d'accent (sobres, dans la charte du site)
const ACCENT_SWATCHES = [
  { value: '', label: 'Bleu (defaut)', color: '#0077b6' },
  { value: '#03045e', label: 'Marine', color: '#03045e' },
  { value: '#0a9396', label: 'Sarcelle', color: '#0a9396' },
  { value: '#5e60ce', label: 'Indigo', color: '#5e60ce' },
  { value: '#2a9d8f', label: 'Emeraude', color: '#2a9d8f' },
  { value: '#9d4edd', label: 'Violet', color: '#9d4edd' },
  { value: '#bb3e03', label: 'Cuivre', color: '#bb3e03' },
];

// Icones suggerees pour les atouts/inclus (noms Lucide)
const HL_ICONS = ['check', 'utensils-crossed', 'wine', 'coffee', 'mic', 'music', 'gift', 'award', 'trophy', 'car', 'map-pin', 'users', 'sparkles', 'star', 'camera', 'ticket', 'heart', 'shield-check', 'clock', 'graduation-cap'];

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
  team_gender_composition?: { enabled: boolean; male_spots: number; female_spots: number } | null;
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
  tagline?: string;
  highlights?: { icon: string; text: string }[];
  program?: { time: string; label: string }[];
  accent_color?: string;
  cta_label?: string;
  show_countdown?: boolean;
  featured?: boolean;
  reminder_dates?: string[];
  shirt_order_deadline?: string | null;
  rules_images?: string[];
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
  checked_in_at?: string | null;
}

interface TeamMember {
  id: string;
  team_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  skill_level: string;
  shirt_size: string;
  dietary_restrictions: string;
  notes: string;
  is_captain: boolean;
  status: string;
  joined_at: string;
  checked_in_at?: string | null;
}

interface Team {
  id: string;
  team_name: string;
  team_code: string;
  captain_email: string;
  logo_url: string | null;
  max_members: number;
  created_at: string;
  members: TeamMember[];
}

// Les coéquipiers inscrits par le capitaine sans courriel ont un placeholder « .sans-courriel »
function displayEmail(email: string): string {
  return email && email.endsWith('.sans-courriel') ? '' : email;
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
  rules_images: [] as string[],
  collab_logos: [] as { name: string; image_url: string }[],
  max_attendees: '' as string | number,
  registration_deadline: '',
  is_registration_open: true,
  registration_mode: 'individual' as 'individual' | 'team' | 'both',
  team_size: 4,
  team_label: 'Equipe',
  allow_team_logo: false,
  team_gender_composition: { enabled: false, male_spots: 8, female_spots: 2 },
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
  // Carte d'invitation personnalisable
  tagline: '',
  highlights: [] as { icon: string; text: string }[],
  program: [] as { time: string; label: string }[],
  accent_color: '',
  cta_label: '',
  show_countdown: true,
  featured: false,
  reminder_dates: [] as string[],
  shirt_order_deadline: '',
});

type FormData = ReturnType<typeof emptyForm>;

function formatDate(d: string) {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Plage de dates « du ... au ... » avec formulation courte et naturelle (fr-CA).
// Ex. même mois : « Du 14 au 16 août 2026 » ; mois différents : « Du 30 août au 2 septembre 2026 ».
function formatDateRange(start: string, end?: string | null) {
  if (!start) return '';
  if (!end || end <= start) return formatDate(start);
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  const sameYear = s.getFullYear() === e.getFullYear();
  const sameMonth = sameYear && s.getMonth() === e.getMonth();
  if (sameMonth) {
    const month = s.toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' });
    return `Du ${s.getDate()} au ${e.getDate()} ${month}`;
  }
  const startStr = s.toLocaleDateString('fr-CA', sameYear
    ? { day: 'numeric', month: 'long' }
    : { day: 'numeric', month: 'long', year: 'numeric' });
  return `Du ${startStr} au ${formatDate(end)}`;
}

// Nombre de jours (entiers) entre aujourd'hui et une date 'YYYY-MM-DD'.
// Négatif = échéance passée, 0 = aujourd'hui.
function daysUntil(dateStr: string): number {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((new Date(dateStr + 'T12:00:00').getTime() - t.getTime()) / 86400000);
}

// Libellé de décompte court : « dans 5 jours », « demain », « aujourd'hui », « échéance dépassée ».
function countdownLabel(days: number): string {
  if (days < 0) return 'échéance dépassée';
  if (days === 0) return "aujourd'hui";
  if (days === 1) return 'demain';
  return `dans ${days} jours`;
}

function lighten(hex: string, amt: number): string {
  try {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.round(r + (255 - r) * amt); g = Math.round(g + (255 - g) * amt); b = Math.round(b + (255 - b) * amt);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  } catch { return '#00b4d8'; }
}

// Aperçu en direct de la carte d'invitation (miroir du rendu public)
function CardPreview({ form }: { form: FormData }) {
  const accent = form.accent_color || '#0077b6';
  const accent2 = lighten(accent, 0.3);
  const typeInfo = EVENT_TYPES.find(t => t.value === form.event_type) || EVENT_TYPES[6];
  const TypeIcon = typeInfo.icon;
  let cd = '';
  if (form.date && form.show_countdown) {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const d = Math.round((new Date(form.date + 'T12:00:00').getTime() - t.getTime()) / 86400000);
    cd = d <= 0 ? "C'est aujourd'hui" : d === 1 ? "C'est demain" : `Dans ${d} jours`;
  }
  const cta = (form.cta_label && form.cta_label.trim()) || 'Je reserve ma place';
  const hl = form.highlights.filter(h => h.text).slice(0, 2);
  return (
    <div style={{ width: 300, borderRadius: 18, overflow: 'hidden', background: '#fff', border: '1px solid rgba(3,4,94,.08)', boxShadow: '0 10px 26px -14px rgba(3,4,94,.25)' }}>
      <div style={{ position: 'relative', height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', background: form.cover_image ? '#03045e' : `linear-gradient(140deg,#03045e,${accent} 75%,${accent2})` }}>
        {form.cover_image
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={form.cover_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <TypeIcon className="h-10 w-10" style={{ color: 'rgba(255,255,255,.85)' }} />}
        {form.featured && <span style={{ position: 'absolute', top: 12, left: 12, padding: '5px 10px', borderRadius: 99, fontSize: 10, fontWeight: 800, color: '#fff', background: `linear-gradient(135deg,${accent},${accent2})`, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Star className="h-3 w-3" /> A la une</span>}
        <span style={{ position: 'absolute', top: 12, right: 12, padding: '5px 10px', borderRadius: 99, fontSize: 10, fontWeight: 700, color: '#fff', background: 'rgba(3,4,94,.6)', display: 'inline-flex', alignItems: 'center', gap: 5 }}><TypeIcon className="h-3 w-3" /> {typeInfo.label}</span>
        {cd && <span style={{ position: 'absolute', bottom: 12, left: 12, padding: '5px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, color: '#03045e', background: 'rgba(255,255,255,.94)' }}>{cd}</span>}
      </div>
      <div style={{ padding: '16px 16px 18px' }}>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 16, color: '#03045e', lineHeight: 1.25 }}>{form.title || 'Titre de l’evenement'}</div>
        {form.tagline && <div style={{ fontSize: 12.5, fontWeight: 600, color: accent, marginTop: 4 }}>{form.tagline}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 12.5, color: '#1a2a3a', fontWeight: 600 }}>
          <span style={{ width: 26, height: 26, borderRadius: 7, display: 'inline-grid', placeItems: 'center', background: `${accent}1a`, color: accent }}>{form.end_date && form.end_date > form.date ? <CalendarRange className="h-3.5 w-3.5" /> : <CalendarDays className="h-3.5 w-3.5" />}</span>
          {form.date ? formatDateRange(form.date, form.end_date) : 'Date'}{form.time ? ` · ${form.time}` : ''}
        </div>
        {hl.map((h, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 12, color: '#586e82' }}>
            <CheckCircle className="h-3.5 w-3.5" style={{ color: accent, flexShrink: 0 }} /> {h.text}
          </div>
        ))}
        <button type="button" style={{ marginTop: 14, width: '100%', padding: '11px', borderRadius: 11, border: 'none', color: '#fff', fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: 13.5, background: `linear-gradient(135deg,${accent2},${accent})`, cursor: 'default' }}>{cta} &rarr;</button>
      </div>
    </div>
  );
}

interface GeoResult { label: string; full: string; lat: string; lon: string; maps_url: string; }

// Barre de recherche d'adresse (autocomplétion OpenStreetMap via /api/geocode).
// La sélection remplit le lieu (si vide) et génère le lien Google Maps.
function AddressSearch({
  location, locationUrl, onPick, onClear,
}: {
  location: string;
  locationUrl: string;
  onPick: (r: GeoResult) => void;
  onClear: () => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 3) { setResults([]); setOpen(false); return; }
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(term)}`);
        if (res.ok) { setResults(await res.json()); setOpen(true); }
      } finally { setLoading(false); }
    }, 400);
    return () => clearTimeout(id);
  }, [q]);

  // Fermer la liste au clic à l'extérieur
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <label className="block text-xs font-extrabold text-text-main mb-1.5 flex items-center gap-1">
        <MapPin className="h-3 w-3" style={{ color: DUO.orange }} /> Adresse (recherche)
      </label>

      {/* Adresse / lien de carte déjà enregistré */}
      {locationUrl && (
        <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl text-sm" style={{ backgroundColor: `${DUO.green}10`, border: `1px solid ${DUO.green}30` }}>
          <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: DUO.greenDark }} />
          <span className="flex-1 truncate font-bold text-text-main">{location || 'Adresse enregistree'}</span>
          <a href={locationUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-bold hover:underline" style={{ color: DUO.blueDark }}>
            <ExternalLink className="h-3.5 w-3.5" /> Carte
          </a>
          <button type="button" onClick={onClear} className="p-0.5 text-red-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-light" />
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={locationUrl ? 'Modifier l’adresse…' : 'Ex. Parc Paul-Emile-Beaulieu, Quebec'}
          className="w-full rounded-xl border-2 border-gray-200 bg-white pl-9 pr-9 py-2.5 text-sm text-text-main focus:outline-none focus:border-[#FF9600] transition-all"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-text-light" />}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border-2 border-gray-100 bg-white shadow-xl overflow-hidden max-h-64 overflow-y-auto">
          {results.map((r, i) => (
            <button key={i} type="button"
              onClick={() => { onPick(r); setQ(''); setResults([]); setOpen(false); }}
              className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors flex items-start gap-2 border-b border-gray-50 last:border-0"
            >
              <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: DUO.orange }} />
              <span className="min-w-0">
                <span className="block font-bold text-sm text-text-main leading-tight truncate">{r.label}</span>
                <span className="block text-[11px] text-text-muted truncate">{r.full}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <p className="text-[11px] text-text-muted mt-1">La selection remplit le lieu et genere le lien de carte automatiquement.</p>
    </div>
  );
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
  const rulesInputRef = useRef<HTMLInputElement>(null);
  const collabInputRef = useRef<HTMLInputElement>(null);
  const [collabName, setCollabName] = useState('');

  // Expanded + registrations
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [logoPreview, setLogoPreview] = useState<Team | null>(null);
  const [logoDownloading, setLogoDownloading] = useState(false);
  // Modele de courriel a copier-coller (aucun envoi automatique)
  const [mailCtx, setMailCtx] = useState<{ ev: EventData; team: Team | null } | null>(null);
  const [mailType, setMailType] = useState<'welcome' | 'details' | 'incomplete' | 'shirt'>('details');
  const [mailSubject, setMailSubject] = useState('');
  const [mailBody, setMailBody] = useState('');
  const [mailCopied, setMailCopied] = useState(false);

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
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        setRegistrations(data);
        setTeams([]);
      } else {
        setRegistrations(data.registrations || []);
        setTeams(data.teams || []);
      }
    }
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
      rules_images: e.rules_images || [],
      collab_logos: e.collab_logos || [],
      max_attendees: e.max_attendees || '',
      registration_deadline: e.registration_deadline || '',
      is_registration_open: e.is_registration_open,
      registration_mode: e.registration_mode,
      team_size: e.team_size,
      team_label: e.team_label,
      allow_team_logo: e.allow_team_logo ?? false,
      team_gender_composition: e.team_gender_composition || { enabled: false, male_spots: 8, female_spots: 2 },
      pricing: e.pricing || [],
      form_options: e.form_options || emptyForm().form_options,
      contact_email: e.contact_email,
      contact_phone: e.contact_phone,
      status: e.status,
      tagline: e.tagline || '',
      highlights: e.highlights || [],
      program: e.program || [],
      accent_color: e.accent_color || '',
      cta_label: e.cta_label || '',
      show_countdown: e.show_countdown ?? true,
      featured: e.featured ?? false,
      reminder_dates: e.reminder_dates || [],
      shirt_order_deadline: e.shirt_order_deadline || '',
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
        shirt_order_deadline: form.shirt_order_deadline || null,
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

  async function uploadImage(file: File, type: 'cover' | 'gallery' | 'rules' | 'collab') {
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
      } else if (type === 'rules') {
        setForm(prev => ({ ...prev, rules_images: [...prev.rules_images, url] }));
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

  async function removeTeamMember(eventId: string, teamId: string, memberId: string) {
    const res = await fetch(`/api/events/${eventId}/registrations`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId }),
    });
    if (res.ok) {
      setTeams(prev => prev.map(t => t.id === teamId ? { ...t, members: t.members.filter(m => m.id !== memberId) } : t));
    }
  }

  async function deleteTeam(eventId: string, team: Team) {
    if (!window.confirm(`Supprimer l'equipe \u00AB ${team.team_name} \u00BB et ses ${team.members.length} membre(s) ?`)) return;
    const res = await fetch(`/api/events/${eventId}/registrations`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: team.id }),
    });
    if (res.ok) {
      setTeams(prev => prev.filter(t => t.id !== team.id));
    }
  }

  // Telecharge le logo d'une equipe avec un nom de fichier propre. L'URL est
  // un objet public Supabase (CORS ouvert) -> fetch en blob puis download ;
  // repli sur l'ouverture dans un onglet si le fetch echoue.
  async function downloadTeamLogo(team: Team) {
    if (!team.logo_url || logoDownloading) return;
    const slug = team.team_name
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'equipe';
    setLogoDownloading(true);
    try {
      const res = await fetch(team.logo_url);
      if (!res.ok) throw new Error('fetch');
      const blob = await res.blob();
      const ext = ((blob.type.split('/')[1] || team.logo_url.split('.').pop() || 'png')
        .replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '') || 'png').toLowerCase();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `logo-${slug}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch {
      window.open(team.logo_url, '_blank');
    } finally {
      setLogoDownloading(false);
    }
  }

  // ── Modeles de courriel a copier-coller (le conseiller envoie lui-meme) ──
  // Liste des courriels reels d'un destinataire (equipe precise, ou tous).
  function recipientEmails(team: Team | null): string[] {
    const clean = (e: string) => !!e && !e.endsWith('.sans-courriel');
    if (team) return team.members.map(m => m.email).filter(clean);
    const indiv = registrations.filter(r => r.status !== 'cancelled').map(r => r.email).filter(clean);
    const fromTeams = teams.flatMap(t => t.members.map(m => m.email)).filter(clean);
    return Array.from(new Set([...indiv, ...fromTeams]));
  }

  function genMail(ev: EventData, team: Team | null, type: 'welcome' | 'details' | 'incomplete' | 'shirt'): { subject: string; body: string } {
    const captain = team?.members.find(m => m.is_captain);
    const greetName = captain?.first_name || '';
    const bonjour = greetName ? `Bonjour ${greetName},` : 'Bonjour,';
    const when = `${formatDateRange(ev.date, ev.end_date)}${ev.time ? ` à ${ev.time}` : ''}`;
    const where = ev.location || '';
    const publicLink = `${SITE_BASE}/evenements.html?event=${ev.id}`;
    const joinLink = team ? `${SITE_BASE}/evenements.html?event=${ev.id}&team=${team.id}` : '';
    const sign = `Au plaisir,\nNicolas Perron\nGroupe Financier Ste-Foy`;

    if (type === 'welcome' && team) {
      const datePhrase = ev.date
        ? (ev.end_date && ev.end_date > ev.date
            ? formatDateRange(ev.date, ev.end_date).replace(/^Du /, 'du ')
            : `le ${formatDate(ev.date)}`)
        : '';
      const subject = `${ev.title} — merci pour votre inscription !`;
      const body =
`${bonjour}
J'espère que tu vas bien!

Merci beaucoup de vous être inscrit à notre ${ev.title}${datePhrase ? `, qui aura lieu ${datePhrase}` : ''}!

Si vous souhaitez apporter des changements à votre équipe (ajouter ou retirer des joueurs, modifier des informations, etc.), vous pouvez le faire en consultant le courriel de confirmation reçu lors de votre inscription et en cliquant sur « Gérer mon équipe ».

Aussi, s'il vous manque des joueurs pour compléter votre équipe, n'hésitez pas à m'en aviser. Nous pourrons voir s'il est possible de vous jumeler avec d'autres participants.

Une fois que votre équipe sera complète, je communiquerai avec vous afin de vous transmettre les informations concernant le paiement.

Finalement, puisque les profits du tournoi sont remis à un organisme à but non lucratif, les frais d'inscription sont considérés comme un don. Vous pourrez donc obtenir un reçu à des fins fiscales.

Si jamais tu as des questions n'hésite pas!

Au plaisir de vous voir au tournoi et merci beaucoup encore!

Nicolas Perron
Groupe Financier Ste-Foy`;
      return { subject, body };
    }

    if (type === 'incomplete' && team) {
      const filled = team.members.length;
      const max = team.max_members;
      const missing = Math.max(0, max - filled);
      const subject = `${ev.title} — il reste ${missing} place${missing > 1 ? 's' : ''} dans votre équipe`;
      const body =
`${bonjour}

Votre équipe « ${team.team_name} » compte présentement ${filled} membre${filled > 1 ? 's' : ''} sur ${max} : il vous manque donc ${missing} joueur${missing > 1 ? 's' : ''} pour être complète.

Pour la compléter, partagez ce lien avec les personnes qui vous manquent — elles s'inscrivent en quelques secondes, sans code :
${joinLink}

(Au besoin, le code d'équipe est : ${team.team_code})

Petit rappel des détails :
Quand : ${when}${where ? `\nOù : ${where}` : ''}

Merci, et au plaisir de vous voir au ${ev.title} !

${sign}`;
      return { subject, body };
    }

    if (type === 'shirt') {
      const noSize = team
        ? team.members.filter(m => !m.shirt_size).map(m => `- ${m.first_name} ${m.last_name}`)
        : [
            ...registrations.filter(r => r.status !== 'cancelled' && !r.shirt_size).map(r => `- ${r.first_name} ${r.last_name}`),
            ...teams.flatMap(t => t.members.filter(m => !m.shirt_size).map(m => `- ${m.first_name} ${m.last_name} (${t.team_name})`)),
          ];
      const deadline = ev.shirt_order_deadline ? ` (avant le ${formatDate(ev.shirt_order_deadline)})` : '';
      const subject = `${ev.title} — votre taille de chandail`;
      const body = noSize.length
        ? `${bonjour}

Pour finaliser la commande des chandails${deadline}, il nous manque la taille de quelques personnes :

${noSize.join('\n')}

Pourriez-vous me transmettre leur taille (XS, S, M, L, XL ou XXL) dès que possible ?

Merci beaucoup !

${sign}`
        : `${bonjour}

Un petit rappel concernant les chandails${deadline} : merci de confirmer la taille (XS, S, M, L, XL ou XXL) de chaque personne si ce n'est pas déjà fait.

Merci beaucoup !

${sign}`;
      return { subject, body };
    }

    // details (défaut)
    const subject = `${ev.title} — les détails`;
    const body =
`${bonjour}

Merci de votre inscription à « ${ev.title} » ! Voici les informations à retenir :

Quand : ${when}${where ? `\nOù : ${where}` : ''}${ev.location_url ? `\nPlan : ${ev.location_url}` : ''}
${ev.description ? `\n${ev.description}\n` : ''}${ev.shirt_order_deadline ? `\nPensez à confirmer votre taille de chandail avant le ${formatDate(ev.shirt_order_deadline)}.\n` : ''}
Tous les détails sont aussi disponibles ici : ${publicLink}

Pour toute question, répondez simplement à ce courriel.
Au plaisir de vous y voir !

${sign}`;
    return { subject, body };
  }

  function openMail(ev: EventData, team: Team | null) {
    const type: 'welcome' | 'details' = team ? 'welcome' : 'details';
    const { subject, body } = genMail(ev, team, type);
    setMailCtx({ ev, team });
    setMailType(type);
    setMailSubject(subject);
    setMailBody(body);
    setMailCopied(false);
  }

  function pickMailType(type: 'welcome' | 'details' | 'incomplete' | 'shirt') {
    if (!mailCtx) return;
    const { subject, body } = genMail(mailCtx.ev, mailCtx.team, type);
    setMailType(type);
    setMailSubject(subject);
    setMailBody(body);
    setMailCopied(false);
  }

  function copyMail() {
    navigator.clipboard.writeText(`Objet : ${mailSubject}\n\n${mailBody}`).then(() => {
      setMailCopied(true);
      setTimeout(() => setMailCopied(false), 2500);
    });
  }

  function openMailClient() {
    if (!mailCtx) return;
    const to = mailCtx.team ? mailCtx.team.captain_email : '';
    const bcc = mailCtx.team ? '' : recipientEmails(null).join(',');
    const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}${bcc ? `&bcc=${encodeURIComponent(bcc)}` : ''}`;
    window.location.href = url;
  }

  // Tous les participants actifs (individuels + membres d'equipes)
  function activeParticipantCount(): number {
    return registrations.filter(r => r.status !== 'cancelled').length
      + teams.reduce((sum, t) => sum + t.members.length, 0);
  }

  // Resume des tailles de chandails (individuels + equipes)
  function shirtSummary(): { size: string; count: number }[] {
    const counts: Record<string, number> = {};
    registrations.filter(r => r.status !== 'cancelled' && r.shirt_size).forEach(r => { counts[r.shirt_size] = (counts[r.shirt_size] || 0) + 1; });
    teams.forEach(t => t.members.filter(m => m.shirt_size).forEach(m => { counts[m.shirt_size] = (counts[m.shirt_size] || 0) + 1; }));
    return SHIRT_SIZES.filter(s => counts[s]).map(s => ({ size: s, count: counts[s] }));
  }

  function exportCSV(eventTitle: string) {
    const rows = [['Type', 'Equipe', 'Capitaine', 'Prenom', 'Nom', 'Courriel', 'Telephone', 'Entreprise', 'Client', 'Tarif', 'Restrictions', 'Niveau', 'Taille', 'Notes', 'Present', 'Date inscription'].join(',')];

    registrations.filter(r => r.status !== 'cancelled').forEach(r => {
      rows.push([
        'Individuel', r.team_name, '', r.first_name, r.last_name, r.email, r.phone, r.company,
        r.is_client ? 'Oui' : 'Non', r.pricing_option, r.dietary_restrictions, r.skill_level,
        r.shirt_size, (r.notes || '').replace(/,/g, ';'), r.checked_in_at ? 'Oui' : '',
        new Date(r.registered_at).toLocaleDateString('fr-CA'),
      ].map(v => `"${v || ''}"`).join(','));
    });

    teams.forEach(t => t.members.forEach(m => {
      rows.push([
        'Equipe', t.team_name, m.is_captain ? 'Oui' : '', m.first_name, m.last_name, displayEmail(m.email), m.phone, '',
        '', '', m.dietary_restrictions, m.skill_level,
        m.shirt_size, (m.notes || '').replace(/,/g, ';'), m.checked_in_at ? 'Oui' : '',
        new Date(m.joined_at).toLocaleDateString('fr-CA'),
      ].map(v => `"${v || ''}"`).join(','));
    }));

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
                  <div className="flex items-center gap-3 mt-0.5 text-sm text-text-muted flex-wrap">
                    <span className="flex items-center gap-1">{ev.end_date && ev.end_date > ev.date ? <CalendarRange className="h-3 w-3" /> : <CalendarDays className="h-3 w-3" />} {formatDateRange(ev.date, ev.end_date)}{ev.time ? ` a ${ev.time}` : ''}</span>
                    {ev.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {ev.location}</span>}
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {ev.registration_count}{ev.max_attendees ? `/${ev.max_attendees}` : ''} inscrit{ev.registration_count !== 1 ? 's' : ''}</span>
                    {ev.shirt_order_deadline && (() => {
                      const d = daysUntil(ev.shirt_order_deadline);
                      const over = d < 0;
                      return (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold"
                          style={{ backgroundColor: over ? '#fee2e2' : `${DUO.purple}14`, color: over ? '#dc2626' : DUO.purpleDark }}
                          title={`Commande de chandails : ${formatDate(ev.shirt_order_deadline)}`}
                        ><Shirt className="h-3 w-3" /> Chandails {countdownLabel(d)}</span>
                      );
                    })()}
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

                  <div className="flex items-center justify-between mt-4 mb-3 flex-wrap gap-2">
                    <h4 className="text-sm font-extrabold text-text-main flex items-center gap-1.5">
                      <UserCheck className="h-4 w-4" style={{ color: DUO.blue }} />
                      Participants ({activeParticipantCount()})
                    </h4>
                    <div className="flex gap-2 flex-wrap">
                      <a href={`/events/${ev.id}/checkin`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all"
                        style={{ backgroundColor: `${DUO.green}12`, color: DUO.greenDark }}
                      ><ClipboardCheck className="h-3 w-3" /> Presences (jour J)</a>
                      <button onClick={() => exportCSV(ev.title)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold bg-gray-50 text-text-muted hover:bg-gray-100 transition-all"
                      ><Download className="h-3 w-3" /> CSV</button>
                      <button onClick={() => {
                        const link = `${SITE_BASE}/evenements.html?event=${ev.id}`;
                        navigator.clipboard.writeText(link);
                      }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold bg-gray-50 text-text-muted hover:bg-gray-100 transition-all"
                      ><Copy className="h-3 w-3" /> Lien public</button>
                      <button onClick={() => openMail(ev, null)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all"
                        style={{ backgroundColor: `${DUO.blue}12`, color: DUO.blueDark }}
                      ><Mail className="h-3 w-3" /> Modele de courriel</button>
                    </div>
                  </div>

                  {/* Decompte — commande de chandails personnalises */}
                  {ev.shirt_order_deadline && (() => {
                    const d = daysUntil(ev.shirt_order_deadline);
                    const over = d < 0;
                    const accentC = over ? '#dc2626' : DUO.purple;
                    return (
                      <div className="flex items-center gap-3 mb-3 p-3.5 rounded-xl" style={{ backgroundColor: over ? '#fef2f2' : `${DUO.purple}0c`, border: `1px solid ${over ? '#fecaca' : `${DUO.purple}30`}` }}>
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: over ? '#fee2e2' : `${DUO.purple}18` }}>
                          <Shirt className="h-5 w-5" style={{ color: accentC }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-extrabold text-text-main">
                            Commande de chandails &mdash; {over ? 'echeance depassee' : d === 0 ? "c'est aujourd'hui" : `il reste ${d} jour${d > 1 ? 's' : ''}`}
                          </p>
                          <p className="text-xs text-text-muted">
                            Confirmation des equipes avant le <b>{formatDate(ev.shirt_order_deadline)}</b> &middot; {activeParticipantCount()} participant{activeParticipantCount() !== 1 ? 's' : ''} confirme{activeParticipantCount() !== 1 ? 's' : ''}
                          </p>
                        </div>
                        {!over && (
                          <div className="text-right flex-shrink-0 pr-1">
                            <div className="text-2xl font-extrabold leading-none" style={{ color: accentC }}>{d}</div>
                            <div className="text-[10px] font-bold uppercase tracking-wide text-text-light">jour{d > 1 ? 's' : ''}</div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Resume des tailles de chandails */}
                  {ev.form_options?.show_shirt_size && shirtSummary().length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap mb-3 p-3 rounded-xl" style={{ backgroundColor: `${DUO.purple}08` }}>
                      <Shirt className="h-4 w-4 flex-shrink-0" style={{ color: DUO.purple }} />
                      <span className="text-xs font-extrabold text-text-main">Chandails :</span>
                      {shirtSummary().map(({ size, count }) => (
                        <span key={size} className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-white border" style={{ borderColor: `${DUO.purple}30`, color: DUO.purpleDark }}>
                          {size} &times; {count}
                        </span>
                      ))}
                      <span className="text-[11px] text-text-muted ml-1">
                        ({activeParticipantCount() - shirtSummary().reduce((s, x) => s + x.count, 0)} sans taille)
                      </span>
                    </div>
                  )}

                  {loadingRegs ? (
                    <div className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin mx-auto" style={{ color: DUO.blue }} /></div>
                  ) : activeParticipantCount() === 0 ? (
                    <p className="text-sm text-text-muted text-center py-6">Aucune inscription pour le moment</p>
                  ) : (
                    <div className="space-y-4">
                      {/* Equipes */}
                      {teams.length > 0 && (
                        <div className="space-y-3">
                          {teams.map(team => (
                            <div key={team.id} className="rounded-xl border-2 border-gray-100 overflow-hidden">
                              <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: `${DUO.blue}08` }}>
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {team.logo_url ? (
                                    <button type="button" onClick={() => setLogoPreview(team)} title="Voir le logo en grand" className="flex-shrink-0">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={team.logo_url} alt={`Logo ${team.team_name}`} className="w-8 h-8 rounded-lg object-cover border border-gray-200 cursor-pointer hover:ring-2 hover:ring-blue-300 hover:ring-offset-1 transition-all" />
                                    </button>
                                  ) : (
                                    <Trophy className="h-4 w-4 flex-shrink-0" style={{ color: DUO.blue }} />
                                  )}
                                  <span className="font-extrabold text-sm text-text-main truncate">{team.team_name}</span>
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-white border border-gray-200 text-text-muted tracking-wider">{team.team_code}</span>
                                  <span className="text-[11px] font-bold text-text-muted flex-shrink-0">{team.members.length}/{team.max_members}</span>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button onClick={() => openMail(ev, team)}
                                    className="p-1 rounded-md hover:bg-blue-50 text-text-light hover:text-blue-600 transition-all"
                                    title="Modele de courriel pour cette equipe"
                                  ><Mail className="h-3.5 w-3.5" /></button>
                                  {team.logo_url && (
                                    <button onClick={() => downloadTeamLogo(team)} disabled={logoDownloading}
                                      className="p-1 rounded-md hover:bg-blue-50 text-text-light hover:text-blue-600 transition-all disabled:opacity-50"
                                      title="Telecharger le logo"
                                    ><Download className="h-3.5 w-3.5" /></button>
                                  )}
                                  <button onClick={() => deleteTeam(ev.id, team)}
                                    className="p-1 rounded-md hover:bg-red-50 text-text-light hover:text-red-600 transition-all"
                                    title="Supprimer l'equipe"
                                  ><Trash2 className="h-3.5 w-3.5" /></button>
                                </div>
                              </div>
                              <table className="w-full text-sm">
                                <tbody>
                                  {team.members.map(m => (
                                    <tr key={m.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                                      <td className="py-2 px-4 font-bold text-text-main">
                                        <span className="flex items-center gap-1.5">
                                          {m.is_captain && <Crown className="h-3 w-3 flex-shrink-0" style={{ color: DUO.orange }} />}
                                          {m.first_name} {m.last_name}
                                        </span>
                                      </td>
                                      <td className="py-2 px-2 text-text-muted text-xs">{displayEmail(m.email)}</td>
                                      <td className="py-2 px-2 text-text-muted text-xs">{m.phone}</td>
                                      {ev.form_options?.show_skill_level && <td className="py-2 px-2 text-text-muted text-xs">{m.skill_level}</td>}
                                      {ev.form_options?.show_shirt_size && (
                                        <td className="py-2 px-2">
                                          {m.shirt_size && <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold" style={{ backgroundColor: `${DUO.purple}12`, color: DUO.purpleDark }}>{m.shirt_size}</span>}
                                        </td>
                                      )}
                                      <td className="py-2 px-3 text-right">
                                        {!m.is_captain && (
                                          <button onClick={() => removeTeamMember(ev.id, team.id, m.id)} className="text-red-400 hover:text-red-600 transition-colors" title="Retirer ce membre"><XCircle className="h-3.5 w-3.5" /></button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Inscriptions individuelles */}
                      {registrations.filter(r => r.status !== 'cancelled').length > 0 && (
                        <div className="overflow-x-auto">
                          {teams.length > 0 && (
                            <p className="text-xs font-extrabold text-text-muted mb-2 flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Inscriptions individuelles</p>
                          )}
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-100">
                                <th className="text-left py-2 px-2 text-xs font-bold text-text-muted">Nom</th>
                                <th className="text-left py-2 px-2 text-xs font-bold text-text-muted">Courriel</th>
                                <th className="text-left py-2 px-2 text-xs font-bold text-text-muted">Tel.</th>
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
                                  {ev.form_options?.show_is_client && <td className="py-2 px-2">{r.is_client ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 text-gray-300" />}</td>}
                                  {ev.pricing?.length > 0 && <td className="py-2 px-2 text-text-muted">{r.pricing_option}</td>}
                                  {ev.form_options?.show_dietary && <td className="py-2 px-2 text-text-muted text-xs">{r.dietary_restrictions}</td>}
                                  {ev.form_options?.show_skill_level && <td className="py-2 px-2 text-text-muted text-xs">{r.skill_level}</td>}
                                  {ev.form_options?.show_shirt_size && (
                                    <td className="py-2 px-2">
                                      {r.shirt_size && <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold" style={{ backgroundColor: `${DUO.purple}12`, color: DUO.purpleDark }}>{r.shirt_size}</span>}
                                    </td>
                                  )}
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

              {/* Dates (plage du ... au ...) + Heure */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-text-main mb-1.5">Date de debut *</label>
                  <input type="date" value={form.date} onChange={e => updateForm('date', e.target.value)} required className="w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-[#FF9600] transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-text-main mb-1.5 flex items-center gap-1"><CalendarRange className="h-3 w-3" style={{ color: DUO.blue }} /> Date de fin <span className="font-normal text-text-light">(option.)</span></label>
                  <input type="date" value={form.end_date} min={form.date || undefined} onChange={e => updateForm('end_date', e.target.value)} className="w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-[#FF9600] transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-text-main mb-1.5">Heure</label>
                  <input type="text" value={form.time} onChange={e => updateForm('time', e.target.value)} placeholder="18h00" className="w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-[#FF9600] transition-all" />
                </div>
              </div>
              {form.end_date && form.end_date > form.date && (
                <div className="-mt-3 flex items-center gap-1.5 text-[11px] font-bold" style={{ color: DUO.blueDark }}>
                  <CalendarRange className="h-3.5 w-3.5" /> {formatDateRange(form.date, form.end_date)} &middot; s&apos;affichera ainsi sur la publicite
                </div>
              )}

              {/* Lieu (nom de l'endroit) */}
              <div>
                <label className="block text-xs font-extrabold text-text-main mb-1.5">Lieu <span className="font-normal text-text-light">(nom de l&apos;endroit)</span></label>
                <input type="text" value={form.location} onChange={e => updateForm('location', e.target.value)} placeholder="Parc Paul-Emile-Beaulieu" className="w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-[#FF9600] transition-all" />
              </div>

              {/* Recherche d'adresse -> remplit le lien de carte (remplace le lien Google Maps manuel) */}
              <AddressSearch
                location={form.location}
                locationUrl={form.location_url}
                onPick={(r) => setForm(prev => ({
                  ...prev,
                  location_url: r.maps_url,
                  location: prev.location.trim() ? prev.location : r.label,
                }))}
                onClear={() => updateForm('location_url', '')}
              />

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

              {/* Reglements (photos) — surtout pour les tournois */}
              <div>
                <label className="block text-xs font-extrabold text-text-main mb-1.5 flex items-center gap-1"><ScrollText className="h-3 w-3" style={{ color: DUO.green }} /> Reglements (photos) <span className="font-normal text-text-light">(tournois)</span></label>
                <div className="flex flex-wrap gap-2">
                  {form.rules_images.map((img, i) => (
                    <div key={i} className="relative w-20 h-14 rounded-lg overflow-hidden border border-gray-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setForm(prev => ({ ...prev, rules_images: prev.rules_images.filter((_, j) => j !== i) }))} className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-white/90 text-red-500"><X className="h-2.5 w-2.5" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => rulesInputRef.current?.click()}
                    className="w-20 h-14 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-text-muted hover:border-[#58CC02] transition-all"
                  >{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}</button>
                  <input ref={rulesInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0], 'rules')} />
                </div>
                <p className="text-[11px] text-text-muted mt-1.5">Affiche une section &laquo; R&egrave;glements &raquo; sur la page publique. Les photos sont cliquables en plein &eacute;cran.</p>
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

              {/* ── Carte d'invitation (personnalisation + apercu) ── */}
              <div className="p-4 rounded-xl border-2 space-y-4" style={{ borderColor: `${DUO.purple}30`, backgroundColor: `${DUO.purple}06` }}>
                <h3 className="text-sm font-extrabold text-text-main flex items-center gap-1.5"><Sparkles className="h-4 w-4" style={{ color: DUO.purple }} /> Carte d&apos;invitation</h3>

                <div>
                  <label className="block text-xs font-extrabold text-text-main mb-1.5">Slogan d&apos;accroche</label>
                  <input type="text" value={form.tagline} onChange={e => updateForm('tagline', e.target.value)} placeholder="Une soiree prestige au profit de..." className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#CE82FF]" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-extrabold text-text-main mb-1.5">Couleur d&apos;accent</label>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {ACCENT_SWATCHES.map(s => {
                        const active = form.accent_color === s.value;
                        return (
                          <button key={s.value} type="button" title={s.label} onClick={() => updateForm('accent_color', s.value)}
                            className="w-7 h-7 rounded-full transition-all"
                            style={{ background: s.color, boxShadow: active ? `0 0 0 2px #fff, 0 0 0 4px ${s.color}` : 'none' }}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-text-main mb-1.5">Texte du bouton</label>
                    <input type="text" value={form.cta_label} onChange={e => updateForm('cta_label', e.target.value)} placeholder="Je reserve ma place" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#CE82FF]" />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {([['featured', 'A la une', Star], ['show_countdown', 'Afficher le decompte', Timer]] as const).map(([key, label, Ico]) => {
                    const on = !!form[key as keyof FormData];
                    return (
                      <button key={key} type="button" onClick={() => updateForm(key, !on)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border-2"
                        style={{ borderColor: on ? DUO.purple : '#e5e7eb', backgroundColor: on ? `${DUO.purple}10` : 'white', color: on ? DUO.purpleDark : '#9ca3af' }}
                      ><Ico className="h-3.5 w-3.5" /> {label}</button>
                    );
                  })}
                </div>

                {/* Atouts / inclus */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-extrabold text-text-main flex items-center gap-1"><Sparkles className="h-3 w-3" style={{ color: DUO.purple }} /> Atouts / inclus</label>
                    <button type="button" onClick={() => updateForm('highlights', [...form.highlights, { icon: 'check', text: '' }])} className="text-[11px] font-bold hover:underline" style={{ color: DUO.purple }}>+ Ajouter</button>
                  </div>
                  {form.highlights.map((h, i) => (
                    <div key={i} className="flex gap-2 mb-1.5">
                      <select value={h.icon} onChange={e => { const arr = [...form.highlights]; arr[i] = { ...arr[i], icon: e.target.value }; updateForm('highlights', arr); }} className="w-36 rounded-lg border border-gray-200 px-2 py-1.5 text-xs">
                        {HL_ICONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                      </select>
                      <input type="text" value={h.text} onChange={e => { const arr = [...form.highlights]; arr[i] = { ...arr[i], text: e.target.value }; updateForm('highlights', arr); }} placeholder="Souper 5 services" className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm" />
                      <button type="button" onClick={() => updateForm('highlights', form.highlights.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>

                {/* Programme / horaire */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-extrabold text-text-main flex items-center gap-1"><Clock className="h-3 w-3" style={{ color: DUO.purple }} /> Programme / horaire</label>
                    <button type="button" onClick={() => updateForm('program', [...form.program, { time: '', label: '' }])} className="text-[11px] font-bold hover:underline" style={{ color: DUO.purple }}>+ Ajouter</button>
                  </div>
                  {form.program.map((p, i) => (
                    <div key={i} className="flex gap-2 mb-1.5">
                      <input type="text" value={p.time} onChange={e => { const arr = [...form.program]; arr[i] = { ...arr[i], time: e.target.value }; updateForm('program', arr); }} placeholder="18h00" className="w-24 rounded-lg border border-gray-200 px-3 py-1.5 text-sm" />
                      <input type="text" value={p.label} onChange={e => { const arr = [...form.program]; arr[i] = { ...arr[i], label: e.target.value }; updateForm('program', arr); }} placeholder="Cocktail de bienvenue" className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm" />
                      <button type="button" onClick={() => updateForm('program', form.program.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>

                {/* Apercu en direct */}
                <div>
                  <label className="text-xs font-extrabold text-text-main mb-2 block flex items-center gap-1"><Eye className="h-3 w-3" style={{ color: DUO.purple }} /> Apercu en direct</label>
                  <div className="flex justify-center p-4 rounded-xl" style={{ background: 'linear-gradient(180deg,#f1f6fc,#e4ecf5)' }}>
                    <CardPreview form={form} />
                  </div>
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

                      {/* Composition d'equipe par genre (gars / filles) */}
                      <div style={{ gridColumn: '1 / -1', background: '#1CB0F608', border: '1px solid #1CB0F622', borderRadius: 12, padding: 12 }}>
                        <label className="flex items-center gap-2 text-xs font-extrabold text-text-main cursor-pointer">
                          <input type="checkbox" checked={!!form.team_gender_composition?.enabled} onChange={e => updateForm('team_gender_composition', { ...form.team_gender_composition, enabled: e.target.checked })} />
                          Composition par genre (gars / filles)
                        </label>
                        {form.team_gender_composition?.enabled && (
                          <div className="mt-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[11px] font-extrabold mb-1 flex items-center gap-1.5" style={{ color: '#1899d6' }}>
                                  <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: '#1CB0F6' }} /> Places gars
                                </label>
                                <input type="number" min={0} max={20} value={form.team_gender_composition?.male_spots ?? 0}
                                  onChange={e => { const v = parseInt(e.target.value) || 0; const comp = { ...form.team_gender_composition!, male_spots: v }; updateForm('team_gender_composition', comp); updateForm('team_size', v + (comp.female_spots || 0)); }}
                                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ border: '1px solid #1CB0F655' }} />
                              </div>
                              <div>
                                <label className="text-[11px] font-extrabold mb-1 flex items-center gap-1.5" style={{ color: '#db2777' }}>
                                  <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: '#EC4899' }} /> Places filles
                                </label>
                                <input type="number" min={0} max={20} value={form.team_gender_composition?.female_spots ?? 0}
                                  onChange={e => { const v = parseInt(e.target.value) || 0; const comp = { ...form.team_gender_composition!, female_spots: v }; updateForm('team_gender_composition', comp); updateForm('team_size', (comp.male_spots || 0) + v); }}
                                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ border: '1px solid #EC489955' }} />
                              </div>
                            </div>
                            <p className="text-[11px] text-text-muted mt-2">
                              Equipe de <b>{(form.team_gender_composition?.male_spots || 0) + (form.team_gender_composition?.female_spots || 0)}</b> joueurs : {form.team_gender_composition?.male_spots || 0} gars + {form.team_gender_composition?.female_spots || 0} filles. A l&apos;inscription, le visiteur verra les places restantes par genre (bleu / rose).
                            </p>
                          </div>
                        )}
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

                {/* Date limite — commande de chandails personnalises */}
                <div className="p-3 rounded-xl" style={{ backgroundColor: `${DUO.purple}08`, border: `1px solid ${DUO.purple}22` }}>
                  <label className="block text-xs font-extrabold text-text-main mb-1.5 flex items-center gap-1"><Shirt className="h-3.5 w-3.5" style={{ color: DUO.purple }} /> Date limite &mdash; commande de chandails</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input type="date" value={form.shirt_order_deadline} onChange={e => updateForm('shirt_order_deadline', e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#CE82FF]" />
                    {form.shirt_order_deadline && (
                      <span className="text-xs font-extrabold px-2.5 py-1 rounded-full" style={{ backgroundColor: `${DUO.purple}14`, color: DUO.purpleDark }}>
                        {countdownLabel(daysUntil(form.shirt_order_deadline))}
                      </span>
                    )}
                    {form.shirt_order_deadline && (
                      <button type="button" onClick={() => updateForm('shirt_order_deadline', '')} className="text-[11px] font-bold text-text-light hover:text-red-500">Retirer</button>
                    )}
                  </div>
                  <p className="text-[11px] text-text-muted mt-1.5">Les equipes doivent confirmer avant cette date. Un decompte s&apos;affiche dans la liste des evenements.</p>
                </div>

                {/* Rappels par courriel */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-extrabold text-text-main flex items-center gap-1"><Timer className="h-3.5 w-3.5" /> Rappels par courriel</label>
                    <button type="button" onClick={() => updateForm('reminder_dates', [...form.reminder_dates, ''])} className="text-[11px] font-bold hover:underline" style={{ color: DUO.blue }}>+ Ajouter une date</button>
                  </div>
                  {form.reminder_dates.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-200 px-3 py-2.5 text-[11px] text-gray-500">
                      Par d&eacute;faut, un rappel part automatiquement <b>2 semaines</b> et <b>1 semaine</b> avant l&apos;&eacute;v&eacute;nement.
                      {form.date && (
                        <button type="button" onClick={() => {
                          const base = new Date(form.date + 'T12:00:00Z').getTime();
                          const d = (n: number) => new Date(base - n * 86400000).toISOString().slice(0, 10);
                          updateForm('reminder_dates', [d(14), d(7)]);
                        }} className="ml-1 font-bold hover:underline" style={{ color: DUO.blue }}>Personnaliser &rarr;</button>
                      )}
                    </div>
                  ) : (
                    <>
                      {form.reminder_dates.map((rd, i) => (
                        <div key={i} className="flex gap-2 mb-1.5 items-center">
                          <input type="date" value={rd} onChange={e => { const arr = [...form.reminder_dates]; arr[i] = e.target.value; updateForm('reminder_dates', arr); }} className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:border-[#1CB0F6]" />
                          <button type="button" onClick={() => updateForm('reminder_dates', form.reminder_dates.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
                        </div>
                      ))}
                      <p className="text-[11px] text-gray-500 mt-1">Un rappel part le matin de chaque date, &agrave; tous les inscrits.</p>
                    </>
                  )}
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

      {/* Apercu / telechargement du logo d'equipe */}
      {logoPreview && logoPreview.logo_url && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setLogoPreview(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h2 className="text-base font-extrabold text-text-main truncate flex items-center gap-2">
                <ImagePlus className="h-4 w-4 flex-shrink-0" style={{ color: DUO.blue }} />
                Logo &laquo; {logoPreview.team_name} &raquo;
              </h2>
              <button type="button" onClick={() => setLogoPreview(null)} className="p-1 rounded-md text-text-light hover:bg-gray-100 hover:text-text-main transition-all flex-shrink-0"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-6 flex items-center justify-center bg-gray-50" style={{ minHeight: 240 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoPreview.logo_url} alt={`Logo ${logoPreview.team_name}`} className="max-h-[55vh] max-w-full object-contain rounded-lg" />
            </div>
            <div className="flex gap-3 p-4 border-t border-gray-100">
              <a href={logoPreview.logo_url} target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-extrabold text-text-muted hover:bg-gray-50 transition-all">
                <ExternalLink className="h-4 w-4" /> Ouvrir
              </a>
              <button onClick={() => downloadTeamLogo(logoPreview)} disabled={logoDownloading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-extrabold transition-all active:translate-y-[2px] disabled:opacity-60"
                style={{ backgroundColor: DUO.blue, boxShadow: `0 3px 0 0 ${DUO.blueDark}` }}>
                {logoDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Telecharger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modele de courriel a copier-coller */}
      {mailCtx && (() => {
        const { ev, team } = mailCtx;
        const types: { key: 'welcome' | 'details' | 'incomplete' | 'shirt'; label: string; show: boolean }[] = [
          { key: 'welcome', label: 'Merci au capitaine', show: !!team },
          { key: 'details', label: "Details de l'evenement", show: true },
          { key: 'incomplete', label: 'Il vous manque des joueurs', show: !!team },
          { key: 'shirt', label: 'Rappel taille de chandail', show: !!ev.form_options?.show_shirt_size },
        ];
        const audience = team ? `Equipe « ${team.team_name} »` : 'Tous les participants';
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMailCtx(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
                <div className="min-w-0">
                  <h2 className="text-base font-extrabold text-text-main flex items-center gap-2"><Mail className="h-4 w-4 flex-shrink-0" style={{ color: DUO.blue }} /> Modele de courriel</h2>
                  <p className="text-xs text-text-muted mt-0.5 truncate">{audience} &middot; a copier-coller dans ton courriel</p>
                </div>
                <button type="button" onClick={() => setMailCtx(null)} className="p-1 rounded-md text-text-light hover:bg-gray-100 hover:text-text-main transition-all flex-shrink-0"><X className="h-4 w-4" /></button>
              </div>

              <div className="p-5 space-y-4">
                {/* Choix du modele */}
                <div className="flex flex-wrap gap-2">
                  {types.filter(t => t.show).map(t => (
                    <button key={t.key} type="button" onClick={() => pickMailType(t.key)}
                      className="px-3 py-1.5 rounded-lg text-xs font-extrabold border-2 transition-all"
                      style={mailType === t.key
                        ? { backgroundColor: DUO.blue, borderColor: DUO.blue, color: '#fff' }
                        : { backgroundColor: '#fff', borderColor: '#e5e7eb', color: '#6b7280' }}
                    >{t.label}</button>
                  ))}
                </div>

                {/* Objet */}
                <div>
                  <label className="block text-xs font-extrabold text-text-muted mb-1">Objet</label>
                  <input value={mailSubject} onChange={e => setMailSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 text-sm font-bold text-text-main focus:outline-none focus:border-blue-300" />
                </div>

                {/* Corps */}
                <div>
                  <label className="block text-xs font-extrabold text-text-muted mb-1">Message <span className="font-bold text-text-light">(modifiable avant d&apos;envoyer)</span></label>
                  <textarea value={mailBody} onChange={e => setMailBody(e.target.value)} rows={16}
                    className="w-full px-3 py-2.5 rounded-lg border-2 border-gray-200 text-sm text-text-main leading-relaxed focus:outline-none focus:border-blue-300 font-mono" style={{ whiteSpace: 'pre-wrap' }} />
                </div>

                <p className="text-xs text-text-light flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  Rien n&apos;est envoye automatiquement : tu copies le texte (ou tu l&apos;ouvres dans ton courriel) et tu l&apos;envoies toi-meme.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 p-4 border-t border-gray-100 sticky bottom-0 bg-white">
                <button onClick={openMailClient}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-extrabold text-text-muted hover:bg-gray-50 transition-all">
                  <ExternalLink className="h-4 w-4" /> Ouvrir dans mon courriel
                </button>
                <button onClick={copyMail}
                  className="flex-1 min-w-[160px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-extrabold transition-all active:translate-y-[2px]"
                  style={{ backgroundColor: mailCopied ? DUO.green : DUO.blue, boxShadow: `0 3px 0 0 ${mailCopied ? DUO.greenDark : DUO.blueDark}` }}>
                  {mailCopied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {mailCopied ? 'Copie !' : 'Copier le courriel'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
