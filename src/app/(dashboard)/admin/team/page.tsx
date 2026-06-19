'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Users, Plus, Loader2, CheckCircle, XCircle, AlertTriangle,
  Pencil, Trash2, Eye, EyeOff, ChevronDown, ChevronUp,
  Linkedin, Instagram, Facebook, Globe, Award, Languages, Clock,
  Key, Copy, Shield, UserCircle, Camera, ImagePlus, X,
  Phone, CalendarCheck, GraduationCap, Quote, Briefcase,
} from 'lucide-react';
import { PhotoStudio } from '@/components/team/PhotoStudio';

const DUO = {
  green: '#58CC02', greenDark: '#45a300',
  blue: '#1CB0F6', blueDark: '#1899d6',
  purple: '#CE82FF', purpleDark: '#b06edb',
  orange: '#FF9600', orangeDark: '#e08600',
} as const;

const ROLE_TITLES = [
  'Conseiller en placement',
  'Conseiller en placement adjoint',
  'Conseiller associe en placement',
  'Gestionnaire de portefeuille',
  'Planificateur financier',
  'Directeur de succursale',
  'Adjoint administratif',
  'Adjointe administrative',
  'Associe en placement',
  'Analyste financier',
  'Fiscaliste',
  'Notaire',
  'Comptable',
];

const CERTIFICATIONS = [
  'CFA', 'CIM', 'Pl. Fin.', 'FCSI', 'CFP', 'CPA', 'MBA',
  'TEP', 'CLU', 'CAIA', 'FMA', 'B.A.A.', 'M.Sc.', 'LL.B.',
];

const LANGUAGES = [
  'Francais', 'Anglais', 'Espagnol', 'Mandarin',
  'Arabe', 'Portugais', 'Italien', 'Allemand',
];

const YEARS_OPTIONS = [
  'Moins de 5 ans', '5-10 ans', '10-15 ans', '15-20 ans',
  '20-25 ans', '25-30 ans', '30+ ans',
];

const CATEGORIES = [
  { value: 'conseiller', label: 'Conseillers' },
  { value: 'adjoint', label: 'Assistants' },
  { value: 'parent-brassard', label: 'Equipe Parent & Brassard' },
  { value: 'buisson', label: 'Equipe Buisson' },
];

const BADGES = ['Conseiller', 'Assistant', 'Assistante', 'Partenaire'];

const SPECIALTIES = [
  'Planification de retraite',
  'Gestion successorale',
  'Optimisation fiscale',
  'Placements alternatifs',
  'Gestion de portefeuille',
  'Assurance et protection',
  'Planification financiere',
  'Gestion de patrimoine',
  'Investissement responsable (ESG)',
  'Gestion de risques',
  'Strategies de revenus',
  'Planification testamentaire',
];

const UNIVERSITIES = [
  { name: 'HEC Montreal', domain: 'hec.ca' },
  { name: 'Universite Laval', domain: 'ulaval.ca' },
  { name: 'Universite de Montreal', domain: 'umontreal.ca' },
  { name: 'McGill University', domain: 'mcgill.ca' },
  { name: 'Concordia University', domain: 'concordia.ca' },
  { name: 'UQAM', domain: 'uqam.ca' },
  { name: 'Universite de Sherbrooke', domain: 'usherbrooke.ca' },
  { name: 'Polytechnique Montreal', domain: 'polymtl.ca' },
  { name: "Universite d'Ottawa", domain: 'uottawa.ca' },
  { name: 'University of Toronto', domain: 'utoronto.ca' },
  { name: 'Western University (Ivey)', domain: 'uwo.ca' },
  { name: "Queen's University", domain: 'queensu.ca' },
  { name: 'York University (Schulich)', domain: 'yorku.ca' },
  { name: 'University of British Columbia', domain: 'ubc.ca' },
  { name: 'Universite du Quebec', domain: 'uquebec.ca' },
];

interface TeamLogo {
  id: string;
  name: string;
  image_url: string;
}

interface LinkedUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'advisor';
  status: 'active' | 'inactive';
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
}

interface Member {
  id: string;
  user_id: string | null;
  display_name: string;
  role_title: string;
  bio: string;
  photo_url: string;
  certifications: string[];
  languages: string[];
  years_experience: string;
  linkedin_url: string;
  instagram_url: string;
  facebook_url: string;
  twitter_url: string;
  website_url: string;
  badge: string;
  category: string;
  initials: string;
  logo_id: string | null;
  quote: string;
  specialties: string[];
  booking_url: string;
  phone: string;
  education: { institution: string; program: string; logo_domain: string }[];
  sort_order: number;
  is_visible: boolean;
  created_at: string;
  linked_user: LinkedUser | null;
}

function toggleArr(arr: string[], item: string): string[] {
  return arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item];
}

const SITE_BASE = 'https://groupefinancierstefoy.com';

function resolvePhoto(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${SITE_BASE}/${url}`;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Jamais';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "A l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Il y a ${days}j`;
  const months = Math.floor(days / 30);
  return `Il y a ${months} mois`;
}

function generatePw() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const special = '!@#$%&*';
  let pw = '';
  for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  pw += special[Math.floor(Math.random() * special.length)];
  pw += Math.floor(Math.random() * 10);
  return pw;
}

const emptyForm = () => ({
  display_name: '',
  role_title: '',
  bio: '',
  photo_url: '',
  certifications: [] as string[],
  languages: [] as string[],
  years_experience: '',
  linkedin_url: '',
  instagram_url: '',
  facebook_url: '',
  twitter_url: '',
  website_url: '',
  badge: 'Conseiller',
  category: 'conseiller',
  logo_id: '' as string,
  quote: '',
  specialties: [] as string[],
  booking_url: '',
  phone: '',
  education: [] as { institution: string; program: string; logo_domain: string }[],
  sort_order: 99,
  is_visible: false,
  // Account fields
  create_account: false,
  account_email: '',
  account_password: '',
  account_role: 'advisor' as 'advisor' | 'admin',
});

type FormData = ReturnType<typeof emptyForm>;

export default function AdminTeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Form modal (create/edit profile)
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm());
  const [customTitle, setCustomTitle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);

  // Logos
  const [logos, setLogos] = useState<TeamLogo[]>([]);
  const [showLogoUpload, setShowLogoUpload] = useState(false);
  const [logoName, setLogoName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Expanded card
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Deactivate confirmation
  const [confirmDeactivate, setConfirmDeactivate] = useState<Member | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Reset password
  const [resetTarget, setResetTarget] = useState<Member | null>(null);
  const [resetting, setResetting] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => { fetchMembers(); fetchLogos(); }, []);

  async function fetchMembers() {
    const res = await fetch('/api/admin/team-profiles');
    if (res.ok) setMembers(await res.json());
    setLoading(false);
  }

  async function fetchLogos() {
    const res = await fetch('/api/admin/team-logos');
    if (res.ok) setLogos(await res.json());
  }

  async function handleLogoUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!logoFile || !logoName.trim()) return;
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('logo', logoFile);
      fd.append('name', logoName.trim());
      const res = await fetch('/api/admin/team-logos', { method: 'POST', body: fd });
      if (res.ok) {
        await fetchLogos();
        setShowLogoUpload(false);
        setLogoName('');
        setLogoFile(null);
      }
    } finally {
      setUploadingLogo(false);
    }
  }

  async function deleteLogo(id: string) {
    const res = await fetch('/api/admin/team-logos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setLogos(prev => prev.filter(l => l.id !== id));
      setMembers(prev => prev.map(m => m.logo_id === id ? { ...m, logo_id: null } : m));
    }
  }

  function openCreate() {
    setEditId(null);
    const f = emptyForm();
    f.account_password = generatePw();
    setForm(f);
    setCustomTitle(false);
    setFormError('');
    setShowPw(false);
    setShowForm(true);
  }

  function openEdit(m: Member) {
    setEditId(m.id);
    setForm({
      display_name: m.display_name,
      role_title: m.role_title,
      bio: m.bio,
      photo_url: m.photo_url,
      certifications: m.certifications || [],
      languages: m.languages || [],
      years_experience: m.years_experience,
      linkedin_url: m.linkedin_url,
      instagram_url: m.instagram_url,
      facebook_url: m.facebook_url,
      twitter_url: m.twitter_url,
      website_url: m.website_url,
      badge: m.badge,
      category: m.category,
      logo_id: m.logo_id || '',
      quote: m.quote || '',
      specialties: m.specialties || [],
      booking_url: m.booking_url || '',
      phone: m.phone || '',
      education: m.education || [],
      sort_order: m.sort_order,
      is_visible: m.is_visible,
      create_account: false,
      account_email: '',
      account_password: '',
      account_role: 'advisor',
    });
    setCustomTitle(!ROLE_TITLES.includes(m.role_title || ''));
    setFormError('');
    setShowForm(true);
  }

  // Reçoit le WebP déjà détouré + cadré par le Studio photo, puis l'upload.
  async function uploadProcessedPhoto(file: File, profileId: string) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('profile_id', profileId);
      const res = await fetch('/api/admin/team-profiles/photo', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('upload failed');
      const { url } = await res.json();
      setForm(prev => ({ ...prev, photo_url: url }));
      setMembers(prev => prev.map(m => m.id === profileId ? { ...m, photo_url: url } : m));
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const url = editId ? `/api/admin/team-profiles/${editId}` : '/api/admin/team-profiles';
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error); return; }
      setShowForm(false);
      await fetchMembers();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/team-profiles/${confirmDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        setMembers(prev => prev.filter(m => m.id !== confirmDelete.id));
        setConfirmDelete(null);
      }
    } finally {
      setDeleting(false);
    }
  }

  async function toggleVisibility(m: Member) {
    const res = await fetch(`/api/admin/team-profiles/${m.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_visible: !m.is_visible }),
    });
    if (res.ok) {
      setMembers(prev => prev.map(x => x.id === m.id ? { ...x, is_visible: !x.is_visible } : x));
    }
  }

  async function toggleStatus(m: Member) {
    if (!m.linked_user) return;
    const newStatus = m.linked_user.status === 'active' ? 'inactive' : 'active';
    setTogglingId(m.id);
    setConfirmDeactivate(null);
    try {
      const res = await fetch(`/api/admin/users/${m.linked_user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setMembers(prev => prev.map(x =>
          x.id === m.id && x.linked_user
            ? { ...x, linked_user: { ...x.linked_user!, status: newStatus as 'active' | 'inactive' } }
            : x
        ));
      }
    } finally {
      setTogglingId(null);
    }
  }

  async function handleResetPassword() {
    if (!resetTarget?.linked_user) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/admin/users/${resetTarget.linked_user.id}/reset-password`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setTempPassword(data.tempPassword);
        setMembers(prev => prev.map(m =>
          m.id === resetTarget.id && m.linked_user
            ? { ...m, linked_user: { ...m.linked_user!, must_change_password: true } }
            : m
        ));
      }
    } finally {
      setResetting(false);
    }
  }

  function handleStatusClick(m: Member) {
    if (m.linked_user?.status === 'active') {
      setConfirmDeactivate(m);
    } else {
      toggleStatus(m);
    }
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function closeResetModal() {
    setResetTarget(null);
    setTempPassword('');
    setCopied(false);
  }

  function updateForm(key: string, value: unknown) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: DUO.purple }} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-text-main">Gestion de l&apos;equipe</h1>
          <p className="text-base text-text-muted mt-1">Profils, comptes et acces — tout au meme endroit</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-extrabold transition-all active:translate-y-[2px] active:shadow-none hover:brightness-105"
          style={{ backgroundColor: DUO.green, boxShadow: `0 3px 0 0 ${DUO.greenDark}` }}
        >
          <Plus className="h-4 w-4" />
          Nouveau membre
        </button>
      </div>

      {/* Members list */}
      <div className="space-y-3">
        {members.map((m) => (
          <div
            key={m.id}
            className="rounded-2xl bg-white overflow-hidden transition-all duration-200"
            style={{ border: '2px solid #e5e7eb20', borderBottom: '4px solid #d1d5db20' }}
          >
            <div className="p-5 flex items-center gap-4">
              {/* Avatar */}
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                style={{ backgroundColor: `${DUO.purple}15` }}
              >
                {resolvePhoto(m.photo_url) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolvePhoto(m.photo_url)} alt={m.display_name} className="w-full h-full object-contain" />
                ) : (
                  <span className="text-sm font-extrabold" style={{ color: DUO.purple }}>
                    {m.initials || m.display_name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-extrabold text-text-main truncate">{m.display_name}</p>
                  {/* Account badge */}
                  {m.linked_user ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                      style={{ backgroundColor: m.linked_user.role === 'admin' ? DUO.orange : DUO.blue }}
                    >
                      {m.linked_user.role === 'admin' ? 'Admin' : 'Conseiller'}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-text-light">
                      Pas de compte
                    </span>
                  )}
                  {/* Status */}
                  {m.linked_user && m.linked_user.status !== 'active' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600">
                      Desactive
                    </span>
                  )}
                  {m.linked_user?.must_change_password && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                      MDP temporaire
                    </span>
                  )}
                  {/* Visibility */}
                  {!m.is_visible && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-text-light flex items-center gap-0.5">
                      <EyeOff className="h-2.5 w-2.5" /> Masque
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <p className="text-sm text-text-muted truncate">{m.role_title || 'Aucun titre'}</p>
                  {m.linked_user && (
                    <>
                      <span className="text-[11px] text-text-light">|</span>
                      <span className="text-[11px] text-text-light truncate">{m.linked_user.email}</span>
                      <span className="text-[11px] text-text-light flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {timeAgo(m.linked_user.last_login_at)}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => toggleVisibility(m)}
                  className={`p-1.5 rounded-lg transition-all ${
                    m.is_visible ? 'text-emerald-600 hover:bg-emerald-50' : 'text-text-light hover:bg-gray-100'
                  }`}
                  title={m.is_visible ? 'Visible sur le site' : 'Masque du site'}
                >
                  {m.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>

                <button
                  onClick={() => openEdit(m)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all"
                  style={{ backgroundColor: `${DUO.blue}12`, color: DUO.blueDark }}
                >
                  <Pencil className="h-3 w-3" />
                  Modifier
                </button>

                {m.linked_user && (
                  <>
                    <button
                      onClick={() => handleStatusClick(m)}
                      disabled={togglingId === m.id}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                        m.linked_user.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-red-50 text-red-600 hover:bg-red-100'
                      }`}
                    >
                      {togglingId === m.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : m.linked_user.status === 'active' ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      {m.linked_user.status === 'active' ? 'Actif' : 'Inactif'}
                    </button>

                    <button
                      onClick={() => setResetTarget(m)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold bg-gray-50 text-text-muted hover:bg-gray-100 transition-all"
                    >
                      <Key className="h-3 w-3" />
                    </button>
                  </>
                )}

                <button
                  onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-text-muted transition-all"
                >
                  {expandedId === m.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Expanded details */}
            {expandedId === m.id && (
              <div className="px-5 pb-5 pt-0 border-t border-gray-100">
                <div className="mt-4 space-y-4">
                  {/* Quote */}
                  {m.quote && (
                    <div className="flex gap-2 p-3 rounded-xl" style={{ backgroundColor: `${DUO.orange}06` }}>
                      <Quote className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: DUO.orange }} />
                      <p className="text-sm text-text-main italic">&laquo; {m.quote} &raquo;</p>
                    </div>
                  )}

                  {/* Specialties */}
                  {m.specialties?.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-text-muted mb-1.5 flex items-center gap-1"><Briefcase className="h-3 w-3" /> Specialites</p>
                      <div className="flex flex-wrap gap-1.5">
                        {m.specialties.map(s => (
                          <span key={s} className="px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ backgroundColor: `${DUO.green}15`, color: DUO.greenDark }}>{s}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs font-bold text-text-muted mb-1">Categorie</p>
                      <p className="text-text-main">{CATEGORIES.find(c => c.value === m.category)?.label || m.category}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-text-muted mb-1">Badge / Ordre</p>
                      <p className="text-text-main">{m.badge} — #{m.sort_order}</p>
                    </div>
                    {m.phone && (
                      <div>
                        <p className="text-xs font-bold text-text-muted mb-1 flex items-center gap-1"><Phone className="h-3 w-3" /> Telephone</p>
                        <p className="text-text-main">{m.phone}</p>
                      </div>
                    )}
                    {m.booking_url && (
                      <div>
                        <p className="text-xs font-bold text-text-muted mb-1 flex items-center gap-1"><CalendarCheck className="h-3 w-3" /> Rendez-vous</p>
                        <a href={m.booking_url} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline" style={{ color: DUO.blue }}>{m.booking_url.replace(/^https?:\/\//, '').slice(0, 35)}...</a>
                      </div>
                    )}
                    {m.years_experience && (
                      <div>
                        <p className="text-xs font-bold text-text-muted mb-1 flex items-center gap-1"><Clock className="h-3 w-3" /> Experience</p>
                        <p className="text-text-main">{m.years_experience}</p>
                      </div>
                    )}
                    {m.languages?.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-text-muted mb-1 flex items-center gap-1"><Languages className="h-3 w-3" /> Langues</p>
                        <p className="text-text-main">{m.languages.join(', ')}</p>
                      </div>
                    )}
                  </div>

                  {/* Education */}
                  {m.education?.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-text-muted mb-1.5 flex items-center gap-1"><GraduationCap className="h-3 w-3" /> Formation</p>
                      <div className="space-y-1.5">
                        {m.education.map((edu: { institution: string; program: string; logo_domain: string }, i: number) => (
                          <div key={i} className="flex items-center gap-2.5 p-2 rounded-lg bg-gray-50">
                            {edu.logo_domain ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={`https://logo.clearbit.com/${edu.logo_domain}`} alt="" className="w-6 h-6 rounded object-contain flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            ) : (
                              <GraduationCap className="h-5 w-5 flex-shrink-0 text-text-light" />
                            )}
                            <div>
                              <p className="text-sm font-bold text-text-main">{edu.institution}</p>
                              <p className="text-xs text-text-muted">{edu.program}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {m.certifications?.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-text-muted mb-1 flex items-center gap-1"><Award className="h-3 w-3" /> Certifications</p>
                      <div className="flex flex-wrap gap-1.5">
                        {m.certifications.map(c => (
                          <span key={c} className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ backgroundColor: `${DUO.purple}15`, color: DUO.purpleDark }}>{c}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {(m.linkedin_url || m.instagram_url || m.facebook_url || m.twitter_url || m.website_url) && (
                    <div>
                      <p className="text-xs font-bold text-text-muted mb-1">Reseaux sociaux</p>
                      <div className="flex gap-2">
                        {m.linkedin_url && <a href={m.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-[#0077B5] hover:opacity-70"><Linkedin className="h-4 w-4" /></a>}
                        {m.instagram_url && <a href={m.instagram_url} target="_blank" rel="noopener noreferrer" className="text-[#E4405F] hover:opacity-70"><Instagram className="h-4 w-4" /></a>}
                        {m.facebook_url && <a href={m.facebook_url} target="_blank" rel="noopener noreferrer" className="text-[#1877F2] hover:opacity-70"><Facebook className="h-4 w-4" /></a>}
                        {m.website_url && <a href={m.website_url} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:opacity-70"><Globe className="h-4 w-4" /></a>}
                      </div>
                    </div>
                  )}

                  {m.linked_user && (
                    <div className="p-3 rounded-xl bg-gray-50">
                      <p className="text-xs font-bold text-text-muted mb-1 flex items-center gap-1">
                        {m.linked_user.role === 'admin' ? <Shield className="h-3 w-3" /> : <UserCircle className="h-3 w-3" />}
                        Compte
                      </p>
                      <p className="text-sm text-text-main">{m.linked_user.email} — {m.linked_user.role === 'admin' ? 'Administrateur' : 'Conseiller'}</p>
                      <p className="text-[11px] text-text-light mt-0.5">Derniere connexion : {timeAgo(m.linked_user.last_login_at)}</p>
                    </div>
                  )}

                  {!m.linked_user && !m.user_id && (
                    <div className="flex justify-end">
                      <button
                        onClick={() => setConfirmDelete(m)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold bg-red-50 text-red-600 hover:bg-red-100 transition-all"
                      >
                        <Trash2 className="h-3 w-3" />
                        Supprimer le profil
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {members.length === 0 && (
          <div className="text-center py-16">
            <Users className="h-12 w-12 text-text-light mx-auto mb-3" />
            <p className="font-extrabold text-text-main">Aucun membre</p>
            <p className="text-sm text-text-muted mt-1">Ajoutez le premier membre de l&apos;equipe</p>
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 flex-shrink-0" style={{ background: `linear-gradient(135deg, ${editId ? DUO.blue : DUO.green}, ${editId ? DUO.blueDark : DUO.greenDark})` }}>
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                {editId ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                {editId ? 'Modifier le membre' : 'Nouveau membre'}
              </h2>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1">

              {/* Photo */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden flex-shrink-0 relative group cursor-pointer"
                  style={{ backgroundColor: `${DUO.purple}15` }}
                  onClick={() => editId && setStudioOpen(true)}
                  title={editId ? 'Studio photo' : 'Enregistrez le membre avant d’ajouter une photo'}
                >
                  {resolvePhoto(form.photo_url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={resolvePhoto(form.photo_url)} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <Camera className="h-6 w-6" style={{ color: DUO.purple }} />
                  )}
                  {editId && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                      {uploading ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-extrabold text-text-main mb-1.5">Nom complet *</label>
                  <input
                    type="text"
                    value={form.display_name}
                    onChange={(e) => updateForm('display_name', e.target.value)}
                    placeholder="Ex: Martin Brassard"
                    required
                    className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-[#58CC02]/20 focus:border-[#58CC02] transition-all"
                  />
                </div>
              </div>

              {/* Role title */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-extrabold text-text-main">Titre</label>
                  <button type="button" onClick={() => setCustomTitle(!customTitle)} className="text-[11px] font-bold hover:underline" style={{ color: DUO.purple }}>
                    {customTitle ? 'Liste' : 'Personnalise'}
                  </button>
                </div>
                {customTitle ? (
                  <input type="text" value={form.role_title} onChange={(e) => updateForm('role_title', e.target.value)} placeholder="Titre personnalise" className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-[#CE82FF]/20 focus:border-[#CE82FF] transition-all" />
                ) : (
                  <select value={form.role_title} onChange={(e) => updateForm('role_title', e.target.value)} className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-[#CE82FF]/20 focus:border-[#CE82FF] transition-all">
                    <option value="">Selectionner un titre</option>
                    {ROLE_TITLES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                )}
              </div>

              {/* Category + Badge + Sort */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-text-main mb-1.5">Categorie</label>
                  <select value={form.category} onChange={(e) => updateForm('category', e.target.value)} className="w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-[#CE82FF] transition-all">
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-text-main mb-1.5">Badge</label>
                  <select value={form.badge} onChange={(e) => updateForm('badge', e.target.value)} className="w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-[#CE82FF] transition-all">
                    {BADGES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-text-main mb-1.5">Ordre</label>
                  <input type="number" value={form.sort_order} onChange={(e) => updateForm('sort_order', parseInt(e.target.value) || 0)} min={0} className="w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-[#CE82FF] transition-all" />
                </div>
              </div>

              {/* Experience */}
              <div>
                <label className="block text-xs font-extrabold text-text-main mb-1.5">Experience</label>
                <select value={form.years_experience} onChange={(e) => updateForm('years_experience', e.target.value)} className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-[#CE82FF] transition-all">
                  <option value="">Ne pas afficher</option>
                  {YEARS_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              {/* Logo badge */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-extrabold text-text-main flex items-center gap-1">
                    <ImagePlus className="h-3 w-3" style={{ color: DUO.orange }} /> Logo sur la fiche
                  </label>
                  <button type="button" onClick={() => setShowLogoUpload(true)} className="text-[11px] font-bold hover:underline" style={{ color: DUO.orange }}>
                    + Ajouter un logo
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {/* No logo option */}
                  <button type="button" onClick={() => updateForm('logo_id', '')}
                    className="px-3 py-2 rounded-xl text-xs font-bold transition-all border-2"
                    style={{
                      borderColor: !form.logo_id ? DUO.orange : '#e5e7eb',
                      backgroundColor: !form.logo_id ? `${DUO.orange}10` : 'white',
                      color: !form.logo_id ? DUO.orangeDark : '#9ca3af',
                    }}
                  >Aucun</button>
                  {logos.map(l => (
                    <button key={l.id} type="button" onClick={() => updateForm('logo_id', l.id)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border-2"
                      style={{
                        borderColor: form.logo_id === l.id ? DUO.orange : '#e5e7eb',
                        backgroundColor: form.logo_id === l.id ? `${DUO.orange}10` : 'white',
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={l.image_url} alt={l.name} className="h-5 w-auto object-contain" />
                      <span style={{ color: form.logo_id === l.id ? DUO.orangeDark : '#6b7280' }}>{l.name}</span>
                    </button>
                  ))}
                </div>
                {logos.length === 0 && (
                  <p className="text-[11px] text-text-muted mt-1">Aucun logo disponible. Cliquez &quot;+ Ajouter un logo&quot; pour en importer.</p>
                )}
              </div>

              {/* Biographie */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-extrabold text-text-main flex items-center gap-1">
                    <UserCircle className="h-3 w-3" style={{ color: DUO.purple }} /> Biographie
                  </label>
                  <span className={`text-[11px] font-bold ${form.bio.length > 450 ? 'text-amber-500' : 'text-text-muted'}`}>{form.bio.length}/500</span>
                </div>
                <textarea
                  value={form.bio}
                  onChange={(e) => { if (e.target.value.length <= 500) updateForm('bio', e.target.value); }}
                  placeholder="Experience, approche et specialites du membre..."
                  rows={4}
                  className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-text-main placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-[#CE82FF]/20 focus:border-[#CE82FF] transition-all resize-none"
                />
                <p className="text-[11px] text-text-muted mt-1">Texte affiche dans la fiche detaillee du membre sur le site.</p>
              </div>

              {/* Quote / Devise */}
              <div>
                <label className="block text-xs font-extrabold text-text-main mb-1.5 flex items-center gap-1">
                  <Quote className="h-3 w-3" style={{ color: DUO.orange }} /> Citation / Devise
                </label>
                <input type="text" value={form.quote} onChange={(e) => updateForm('quote', e.target.value)} placeholder="Ma philosophie : investir avec patience..." maxLength={200} className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-text-main italic focus:outline-none focus:ring-2 focus:ring-[#FF9600]/20 focus:border-[#FF9600] transition-all" />
              </div>

              {/* Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-text-main mb-1.5 flex items-center gap-1">
                    <Phone className="h-3 w-3" style={{ color: DUO.blue }} /> Telephone
                  </label>
                  <input type="tel" value={form.phone} onChange={(e) => updateForm('phone', e.target.value)} placeholder="418-555-1234" className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-[#1CB0F6]/20 focus:border-[#1CB0F6] transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-text-main mb-1.5 flex items-center gap-1">
                    <CalendarCheck className="h-3 w-3" style={{ color: DUO.green }} /> Lien rendez-vous
                  </label>
                  <input type="url" value={form.booking_url} onChange={(e) => updateForm('booking_url', e.target.value)} placeholder="https://calendly.com/..." className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-[#58CC02]/20 focus:border-[#58CC02] transition-all" />
                </div>
              </div>

              {/* Specialties */}
              <div>
                <label className="block text-xs font-extrabold text-text-main mb-1.5 flex items-center gap-1">
                  <Briefcase className="h-3 w-3" style={{ color: DUO.green }} /> Specialites
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {SPECIALTIES.map(s => {
                    const active = form.specialties.includes(s);
                    return (
                      <button key={s} type="button" onClick={() => updateForm('specialties', toggleArr(form.specialties, s))}
                        className="px-2.5 py-1 rounded-full text-xs font-bold transition-all"
                        style={{ backgroundColor: active ? `${DUO.green}20` : '#f3f4f6', color: active ? DUO.greenDark : '#9ca3af', border: active ? `2px solid ${DUO.green}40` : '2px solid transparent' }}
                      >{s}</button>
                    );
                  })}
                </div>
              </div>

              {/* Education */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-extrabold text-text-main flex items-center gap-1">
                    <GraduationCap className="h-3 w-3" style={{ color: DUO.blue }} /> Formation
                  </label>
                  <button type="button" onClick={() => updateForm('education', [...form.education, { institution: '', program: '', logo_domain: '' }])} className="text-[11px] font-bold hover:underline" style={{ color: DUO.blue }}>
                    + Ajouter
                  </button>
                </div>
                {form.education.map((edu, i) => (
                  <div key={i} className="flex gap-2 items-start mb-2 p-2.5 rounded-xl bg-gray-50">
                    <div className="flex-1 space-y-2">
                      <select
                        value={UNIVERSITIES.find(u => u.name === edu.institution) ? edu.institution : '__custom'}
                        onChange={(e) => {
                          const arr = [...form.education];
                          if (e.target.value === '__custom') {
                            arr[i] = { ...arr[i], institution: '', logo_domain: '' };
                          } else {
                            const uni = UNIVERSITIES.find(u => u.name === e.target.value);
                            arr[i] = { ...arr[i], institution: e.target.value, logo_domain: uni?.domain || '' };
                          }
                          updateForm('education', arr);
                        }}
                        className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:border-[#1CB0F6]"
                      >
                        <option value="" disabled>Selectionner une universite</option>
                        {UNIVERSITIES.map(u => <option key={u.domain} value={u.name}>{u.name}</option>)}
                        <option value="__custom">Autre...</option>
                      </select>
                      {!UNIVERSITIES.find(u => u.name === edu.institution) && edu.institution !== '' && (
                        <input type="text" value={edu.institution} onChange={(e) => { const arr = [...form.education]; arr[i] = { ...arr[i], institution: e.target.value }; updateForm('education', arr); }} placeholder="Nom de l'institution" className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:border-[#1CB0F6]" />
                      )}
                      <input type="text" value={edu.program} onChange={(e) => { const arr = [...form.education]; arr[i] = { ...arr[i], program: e.target.value }; updateForm('education', arr); }} placeholder="Programme (ex: B.A.A. Finance)" className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:border-[#1CB0F6]" />
                    </div>
                    <button type="button" onClick={() => { const arr = [...form.education]; arr.splice(i, 1); updateForm('education', arr); }} className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors mt-1">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Certifications */}
              <div>
                <label className="block text-xs font-extrabold text-text-main mb-1.5 flex items-center gap-1">
                  <Award className="h-3 w-3" style={{ color: DUO.purple }} /> Certifications
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {CERTIFICATIONS.map(c => {
                    const active = form.certifications.includes(c);
                    return (
                      <button key={c} type="button" onClick={() => updateForm('certifications', toggleArr(form.certifications, c))}
                        className="px-2.5 py-1 rounded-full text-xs font-bold transition-all"
                        style={{ backgroundColor: active ? `${DUO.purple}20` : '#f3f4f6', color: active ? DUO.purpleDark : '#9ca3af', border: active ? `2px solid ${DUO.purple}40` : '2px solid transparent' }}
                      >{c}</button>
                    );
                  })}
                </div>
              </div>

              {/* Languages */}
              <div>
                <label className="block text-xs font-extrabold text-text-main mb-1.5 flex items-center gap-1">
                  <Languages className="h-3 w-3" style={{ color: DUO.blue }} /> Langues
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {LANGUAGES.map(l => {
                    const active = form.languages.includes(l);
                    return (
                      <button key={l} type="button" onClick={() => updateForm('languages', toggleArr(form.languages, l))}
                        className="px-2.5 py-1 rounded-full text-xs font-bold transition-all"
                        style={{ backgroundColor: active ? `${DUO.blue}20` : '#f3f4f6', color: active ? DUO.blueDark : '#9ca3af', border: active ? `2px solid ${DUO.blue}40` : '2px solid transparent' }}
                      >{l}</button>
                    );
                  })}
                </div>
              </div>

              {/* Social links */}
              <div>
                <label className="block text-xs font-extrabold text-text-main mb-1.5">Reseaux sociaux</label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Linkedin className="h-4 w-4 flex-shrink-0" style={{ color: '#0077B5' }} />
                    <input type="url" value={form.linkedin_url} onChange={(e) => updateForm('linkedin_url', e.target.value)} placeholder="https://linkedin.com/in/..." className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:border-[#CE82FF]" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Instagram className="h-4 w-4 flex-shrink-0" style={{ color: '#E4405F' }} />
                    <input type="url" value={form.instagram_url} onChange={(e) => updateForm('instagram_url', e.target.value)} placeholder="https://instagram.com/..." className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:border-[#CE82FF]" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Facebook className="h-4 w-4 flex-shrink-0" style={{ color: '#1877F2' }} />
                    <input type="url" value={form.facebook_url} onChange={(e) => updateForm('facebook_url', e.target.value)} placeholder="https://facebook.com/..." className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:border-[#CE82FF]" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 flex-shrink-0 text-gray-500" />
                    <input type="url" value={form.website_url} onChange={(e) => updateForm('website_url', e.target.value)} placeholder="https://monsite.com" className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:border-[#CE82FF]" />
                  </div>
                </div>
              </div>

              {/* Visibility toggle */}
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: `${DUO.green}08` }}>
                <button type="button" onClick={() => updateForm('is_visible', !form.is_visible)}
                  className="relative w-11 h-6 rounded-full transition-all flex-shrink-0"
                  style={{ backgroundColor: form.is_visible ? DUO.green : '#d1d5db' }}
                >
                  <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                    style={{ left: form.is_visible ? '22px' : '2px' }}
                  />
                </button>
                <p className="text-xs font-extrabold text-text-main">
                  {form.is_visible ? 'Visible sur le site web' : 'Masque du site web'}
                </p>
              </div>

              {/* Account creation section (only for new members) */}
              {!editId && (
                <div className="border-t border-gray-100 pt-4">
                  <div className="flex items-center gap-3 mb-4">
                    <button type="button" onClick={() => updateForm('create_account', !form.create_account)}
                      className="relative w-11 h-6 rounded-full transition-all flex-shrink-0"
                      style={{ backgroundColor: form.create_account ? DUO.blue : '#d1d5db' }}
                    >
                      <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                        style={{ left: form.create_account ? '22px' : '2px' }}
                      />
                    </button>
                    <div>
                      <p className="text-xs font-extrabold text-text-main flex items-center gap-1.5">
                        <Key className="h-3 w-3" style={{ color: DUO.blue }} />
                        Creer un compte d&apos;acces
                      </p>
                      <p className="text-[11px] text-text-muted">Permet au membre de se connecter au planificateur</p>
                    </div>
                  </div>

                  {form.create_account && (
                    <div className="space-y-3 p-4 rounded-xl" style={{ backgroundColor: `${DUO.blue}06` }}>
                      <div>
                        <label className="block text-xs font-extrabold text-text-main mb-1.5">Courriel de connexion</label>
                        <input type="email" value={form.account_email} onChange={(e) => updateForm('account_email', e.target.value)}
                          placeholder="martin@groupefinancier.com" required={form.create_account}
                          className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-[#1CB0F6]/20 focus:border-[#1CB0F6] transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-extrabold text-text-main mb-1.5">Role</label>
                        <select value={form.account_role} onChange={(e) => updateForm('account_role', e.target.value)}
                          className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-[#1CB0F6]/20 focus:border-[#1CB0F6] transition-all"
                        >
                          <option value="advisor">Conseiller</option>
                          <option value="admin">Administrateur</option>
                        </select>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-extrabold text-text-main">Mot de passe temporaire</label>
                          <button type="button" onClick={() => updateForm('account_password', generatePw())} className="text-[11px] font-bold hover:underline" style={{ color: DUO.blue }}>
                            Regenerer
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type={showPw ? 'text' : 'password'}
                            value={form.account_password}
                            onChange={(e) => updateForm('account_password', e.target.value)}
                            required={form.create_account}
                            minLength={8}
                            className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-text-main font-mono focus:outline-none focus:ring-2 focus:ring-[#1CB0F6]/20 focus:border-[#1CB0F6] transition-all pr-20"
                          />
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                            <button type="button" onClick={() => setShowPw(!showPw)} className="p-1.5 rounded-lg hover:bg-gray-100 text-text-muted">
                              {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                            <button type="button" onClick={() => copyToClipboard(form.account_password)} className="p-1.5 rounded-lg hover:bg-gray-100 text-text-muted">
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-[11px] text-text-muted mt-1">Changement obligatoire a la premiere connexion.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {formError && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-2.5 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {formError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-extrabold text-text-muted hover:bg-gray-50 transition-all"
                >Annuler</button>
                <button type="submit" disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-extrabold transition-all active:translate-y-[2px] active:shadow-none hover:brightness-105 disabled:opacity-60"
                  style={{ backgroundColor: editId ? DUO.blue : DUO.green, boxShadow: `0 3px 0 0 ${editId ? DUO.blueDark : DUO.greenDark}` }}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  {editId ? 'Sauvegarder' : 'Ajouter le membre'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm deactivation modal */}
      {confirmDeactivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDeactivate(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="px-6 py-4 bg-red-500">
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> Desactiver le compte
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-text-main">
                Desactiver le compte de <strong>{confirmDeactivate.display_name}</strong> ?
              </p>
              <p className="text-xs text-text-muted">Le membre ne pourra plus se connecter. Vous pourrez le reactiver a tout moment.</p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setConfirmDeactivate(null)} className="flex-1 px-4 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-extrabold text-text-muted hover:bg-gray-50 transition-all">Annuler</button>
                <button onClick={() => toggleStatus(confirmDeactivate)} disabled={togglingId === confirmDeactivate.id}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-extrabold transition-all active:translate-y-[2px] active:shadow-none bg-red-500 hover:bg-red-600 disabled:opacity-60"
                  style={{ boxShadow: '0 3px 0 0 #b91c1c' }}
                >
                  {togglingId === confirmDeactivate.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  Desactiver
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="px-6 py-4 bg-red-500">
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                <Trash2 className="h-5 w-5" /> Supprimer le profil
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-text-main">Supprimer definitivement le profil de <strong>{confirmDelete.display_name}</strong> ?</p>
              <p className="text-xs text-text-muted">Cette action est irreversible.</p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-extrabold text-text-muted hover:bg-gray-50 transition-all">Annuler</button>
                <button onClick={handleDelete} disabled={deleting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-extrabold transition-all active:translate-y-[2px] active:shadow-none bg-red-500 hover:bg-red-600 disabled:opacity-60"
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

      {/* Logo upload modal */}
      {showLogoUpload && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowLogoUpload(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="px-6 py-4" style={{ background: `linear-gradient(135deg, ${DUO.orange}, ${DUO.orangeDark})` }}>
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                <ImagePlus className="h-5 w-5" /> Ajouter un logo
              </h2>
            </div>
            <form onSubmit={handleLogoUpload} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-text-main mb-1.5">Nom du logo</label>
                <input type="text" value={logoName} onChange={(e) => setLogoName(e.target.value)} placeholder="Ex: Equipe Buisson" required
                  className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-[#FF9600]/20 focus:border-[#FF9600] transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-text-main mb-1.5">Fichier (PNG, WebP, SVG — max 2 Mo)</label>
                <input ref={logoInputRef} type="file" accept="image/png,image/webp,image/svg+xml,image/jpeg" required
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-text-muted file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-orange-50 file:text-orange-600 hover:file:bg-orange-100"
                />
              </div>

              {/* Existing logos management */}
              {logos.length > 0 && (
                <div>
                  <p className="text-xs font-extrabold text-text-main mb-2">Logos existants</p>
                  <div className="space-y-2">
                    {logos.map(l => (
                      <div key={l.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={l.image_url} alt={l.name} className="h-8 w-auto object-contain" />
                        <span className="flex-1 text-sm font-bold text-text-main">{l.name}</span>
                        <button type="button" onClick={() => deleteLogo(l.id)} className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowLogoUpload(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-extrabold text-text-muted hover:bg-gray-50 transition-all"
                >Fermer</button>
                <button type="submit" disabled={uploadingLogo || !logoFile || !logoName.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-extrabold transition-all active:translate-y-[2px] active:shadow-none hover:brightness-105 disabled:opacity-60"
                  style={{ backgroundColor: DUO.orange, boxShadow: `0 3px 0 0 ${DUO.orangeDark}` }}
                >
                  {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  Importer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeResetModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4" style={{ background: `linear-gradient(135deg, ${DUO.orange}, ${DUO.orangeDark})` }}>
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                <Key className="h-5 w-5" /> Reinitialiser le mot de passe
              </h2>
            </div>
            <div className="p-6">
              {tempPassword ? (
                <div className="space-y-4">
                  <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
                    <p className="text-xs font-bold text-amber-800 mb-2">Mot de passe temporaire pour {resetTarget.display_name} :</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-white rounded-lg px-3 py-2 text-sm font-mono font-bold text-text-main border border-amber-200">{tempPassword}</code>
                      <button onClick={() => copyToClipboard(tempPassword)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-extrabold transition-all"
                        style={{ backgroundColor: copied ? DUO.green : `${DUO.orange}15`, color: copied ? 'white' : DUO.orange }}
                      >
                        {copied ? <CheckCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? 'Copie!' : 'Copier'}
                      </button>
                    </div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <p className="text-xs font-bold text-red-700 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Ce mot de passe ne sera plus jamais affiche.
                    </p>
                  </div>
                  <button onClick={closeResetModal} className="w-full px-4 py-2.5 rounded-xl text-white text-sm font-extrabold transition-all active:translate-y-[2px] active:shadow-none"
                    style={{ backgroundColor: DUO.orange, boxShadow: `0 3px 0 0 ${DUO.orangeDark}` }}
                  >Fermer</button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-text-main">Generer un nouveau mot de passe temporaire pour <strong>{resetTarget.display_name}</strong> ?</p>
                  <p className="text-xs text-text-muted">L&apos;ancien mot de passe sera invalide immediatement.</p>
                  <div className="flex gap-3">
                    <button type="button" onClick={closeResetModal} className="flex-1 px-4 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-extrabold text-text-muted hover:bg-gray-50 transition-all">Annuler</button>
                    <button onClick={handleResetPassword} disabled={resetting}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-extrabold transition-all active:translate-y-[2px] active:shadow-none hover:brightness-105 disabled:opacity-60"
                      style={{ backgroundColor: DUO.orange, boxShadow: `0 3px 0 0 ${DUO.orangeDark}` }}
                    >
                      {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                      Reinitialiser
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <PhotoStudio
        open={studioOpen}
        onClose={() => setStudioOpen(false)}
        onApply={(file) => (editId ? uploadProcessedPhoto(file, editId) : Promise.resolve())}
        displayName={form.display_name}
        roleTitle={form.role_title}
      />
    </div>
  );
}
