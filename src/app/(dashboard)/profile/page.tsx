'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Input } from '@/components/ui/Input';
import {
  Save, Upload, Loader2, CheckCircle, Linkedin, UserCircle,
  Camera, Sparkles, Eye, EyeOff, GripVertical, Shield,
  ExternalLink, Instagram, Facebook, Globe, Award, Languages, Clock,
  Phone, CalendarCheck, GraduationCap, Quote, Briefcase, X,
} from 'lucide-react';
import { PhotoStudio } from '@/components/team/PhotoStudio';

// Duolingo palette (same as Reports page)
const DUO = {
  green: '#58CC02', greenDark: '#45a300',
  blue: '#1CB0F6', blueDark: '#1899d6',
  purple: '#CE82FF', purpleDark: '#b06edb',
  orange: '#FF9600', orangeDark: '#e08600',
} as const;

const SITE_BASE = 'https://groupefinancierstefoy.com';
function resolvePhoto(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${SITE_BASE}/${url}`;
}

interface TeamProfile {
  user_id: string;
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
  logo_id: string | null;
  quote: string;
  specialties: string[];
  booking_url: string;
  phone: string;
  education: { institution: string; program: string; logo_domain: string }[];
  initials: string;
  sort_order: number;
  is_visible: boolean;
}

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
  'CFA',
  'CIM',
  'Pl. Fin.',
  'FCSI',
  'CFP',
  'CPA',
  'MBA',
  'TEP',
  'CLU',
  'CAIA',
  'FMA',
  'B.A.A.',
  'M.Sc.',
  'LL.B.',
];

const LANGUAGES = [
  'Francais',
  'Anglais',
  'Espagnol',
  'Mandarin',
  'Arabe',
  'Portugais',
  'Italien',
  'Allemand',
];

const YEARS_OPTIONS = [
  'Moins de 5 ans',
  '5-10 ans',
  '10-15 ans',
  '15-20 ans',
  '20-25 ans',
  '25-30 ans',
  '30+ ans',
];

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

const CATEGORY_LABELS: Record<string, string> = {
  'conseiller': 'Conseillers',
  'adjoint': 'Assistants',
  'parent-brassard': 'Equipe Parent & Brassard',
  'buisson': 'Equipe Buisson',
};

export default function ProfilePage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoHover, setPhotoHover] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState(false);
  const [logos, setLogos] = useState<{ id: string; name: string; image_url: string }[]>([]);

  useEffect(() => {
    fetch('/api/team-profile')
      .then(res => res.json())
      .then(data => {
        setProfile(data);
        if (data.role_title && !ROLE_TITLES.includes(data.role_title)) {
          setCustomTitle(true);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
    fetch('/api/admin/team-logos')
      .then(res => res.ok ? res.json() : [])
      .then(data => setLogos(data))
      .catch(() => {});
  }, []);

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/team-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setSaved(true);
        setTimeout(() => setSaved(false), 4000);
      }
    } finally {
      setSaving(false);
    }
  }

  // Reçoit le WebP déjà détouré + cadré par le Studio photo, puis l'upload.
  async function uploadProcessedPhoto(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const res = await fetch('/api/team-profile/photo', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('upload failed');
      const { url } = await res.json();
      setProfile(prev => prev ? { ...prev, photo_url: url } : prev);
    } finally {
      setUploading(false);
    }
  }

  function updateField(field: keyof TeamProfile, value: string | boolean | number | string[] | { institution: string; program: string; logo_domain: string }[]) {
    setProfile(prev => prev ? { ...prev, [field]: value } : prev);
  }

  function toggleArrayItem(field: 'certifications' | 'languages' | 'specialties', item: string) {
    if (!profile) return;
    const arr = profile[field] || [];
    const next = arr.includes(item) ? arr.filter(v => v !== item) : [...arr, item];
    updateField(field, next);
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4" style={{ color: DUO.blue }} />
            <p className="text-sm text-text-muted animate-pulse">Chargement de votre profil...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const isAdmin = session?.user.role === 'admin';

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header - Duo style */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-extrabold text-text-main mb-2">Mon Profil</h1>
        <p className="text-base text-text-muted max-w-lg mx-auto">
          Votre vitrine sur le site web du Groupe Financier Ste-Foy.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left column: Photo + Live Preview */}
        <div className="lg:col-span-2 space-y-6">
          {/* Photo upload card */}
          <div
            className="rounded-2xl bg-white p-6 transition-all duration-200"
            style={{ border: `2px solid ${DUO.blue}30`, borderBottom: `5px solid ${DUO.blueDark}30` }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: `${DUO.blue}15`, boxShadow: `0 3px 0 0 ${DUO.blueDark}20` }}
              >
                <Camera className="h-5 w-5" style={{ color: DUO.blue }} />
              </div>
              <h3 className="text-lg font-extrabold text-text-main">Photo de profil</h3>
            </div>

            <div className="flex flex-col items-center">
              <div
                className="relative w-44 h-44 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden cursor-pointer group transition-all duration-300 hover:border-[#1CB0F6]"
                onClick={() => setStudioOpen(true)}
                onMouseEnter={() => setPhotoHover(true)}
                onMouseLeave={() => setPhotoHover(false)}
              >
                {resolvePhoto(profile.photo_url) ? (
                  <>
                    <img src={resolvePhoto(profile.photo_url)} alt={profile.display_name} className="w-full h-full object-contain" />
                    <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity duration-200 ${photoHover ? 'opacity-100' : 'opacity-0'}`}>
                      <div className="text-center text-white">
                        <Camera className="h-6 w-6 mx-auto mb-1" />
                        <span className="text-xs font-extrabold">Changer</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center">
                    {uploading ? (
                      <Loader2 className="h-10 w-10 animate-spin mx-auto" style={{ color: DUO.blue }} />
                    ) : (
                      <>
                        <div
                          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform"
                          style={{ backgroundColor: `${DUO.blue}15` }}
                        >
                          <Upload className="h-7 w-7" style={{ color: DUO.blue }} />
                        </div>
                        <p className="text-sm font-extrabold text-text-main">Cliquez pour ajouter</p>
                        <p className="text-xs text-text-muted mt-1">Détourage + cadrage automatiques</p>
                      </>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => setStudioOpen(true)}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-extrabold text-[#1899d6] hover:underline"
              >
                <Camera className="h-3.5 w-3.5" /> {resolvePhoto(profile.photo_url) ? 'Changer la photo' : 'Ouvrir le studio photo'}
              </button>
            </div>
          </div>

          {/* Live preview — Card (as seen on public site) */}
          <div
            className="rounded-2xl bg-white p-6 transition-all duration-200"
            style={{ border: `2px solid ${DUO.purple}30`, borderBottom: `5px solid ${DUO.purpleDark}30` }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: `${DUO.purple}15`, boxShadow: `0 3px 0 0 ${DUO.purpleDark}20` }}
              >
                <Eye className="h-5 w-5" style={{ color: DUO.purple }} />
              </div>
              <h3 className="text-lg font-extrabold text-text-main">Apercu en direct</h3>
            </div>

            {/* Mini card — replica of the public site card (cutout transparent, fond clair) */}
            <div className="relative overflow-hidden rounded-2xl mx-auto" style={{ aspectRatio: '3 / 3.4', maxHeight: 280, background: 'linear-gradient(160deg,#edf4ff 0%,#e2edfb 32%,#f2f7ff 58%,#e8f1fc 82%,#eef5ff 100%)' }}>
              {resolvePhoto(profile.photo_url) ? (
                <img src={resolvePhoto(profile.photo_url)} alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: 'contain', objectPosition: 'bottom center' }} />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '3.5rem', fontWeight: 800, color: 'rgba(0,119,182,0.35)' }}>
                    {profile.initials || '??'}
                  </span>
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-16" style={{ background: 'linear-gradient(to top, rgba(245,249,255,0.97) 0%, rgba(245,249,255,0.7) 55%, transparent 100%)' }}>
                <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.88rem', fontWeight: 800, color: '#03045e', lineHeight: 1.25, margin: '0 0 3px' }}>
                  {profile.display_name || 'Votre nom'}
                </p>
                <p style={{ fontSize: '0.65rem', color: '#5a7d95', fontStyle: 'italic', margin: 0 }}>
                  {profile.role_title || 'Votre titre'}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-text-muted text-center mt-2 uppercase tracking-wider font-bold">Carte sur le site</p>

            {/* Popup replica — what visitors see when clicking the card */}
            <div className="mt-4 rounded-2xl overflow-hidden" style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
              {/* Popup photo header */}
              <div className="relative overflow-hidden" style={{ height: 120, background: 'linear-gradient(160deg,#edf4ff 0%,#e2edfb 45%,#eef5ff 100%)' }}>
                {resolvePhoto(profile.photo_url) ? (
                  <img src={resolvePhoto(profile.photo_url)} alt="" className="w-full h-full object-contain" style={{ objectPosition: 'bottom center' }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(150deg, #023e8a 0%, #0077b6 55%, #00b4d8 100%)' }}>
                    <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '2.8rem', fontWeight: 800, color: 'rgba(255,255,255,0.88)' }}>
                      {profile.initials || '??'}
                    </span>
                  </div>
                )}
              </div>
              {/* Popup body */}
              <div className="px-5 py-4">
                <span
                  className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold text-white mb-2"
                  style={{ background: profile.badge === 'Conseiller' || profile.badge === 'Partenaire' ? 'linear-gradient(90deg, #0077b6, #00b4d8)' : 'linear-gradient(90deg, #0d9488, #14b8a6)' }}
                >
                  {profile.badge}
                </span>
                <h4 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: '#03045e', margin: '0 0 2px', lineHeight: 1.25 }}>
                  {profile.display_name || 'Votre nom'}
                </h4>
                <p style={{ fontSize: '0.78rem', color: '#5a7d95', fontStyle: 'italic', margin: '0 0 6px', lineHeight: 1.4 }}>
                  {profile.role_title || 'Votre titre'}
                </p>

                {/* Quote */}
                {profile.quote && (
                  <p style={{ fontSize: '0.78rem', color: '#5a7d95', fontStyle: 'italic', margin: '6px 0 8px', lineHeight: 1.5 }}>
                    &laquo; {profile.quote} &raquo;
                  </p>
                )}

                {/* Specialties */}
                {(profile.specialties || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {profile.specialties.map((s: string) => (
                      <span key={s} className="px-2 py-0.5 rounded-full text-[9px] font-bold" style={{ backgroundColor: '#58CC0215', color: '#45a300' }}>{s}</span>
                    ))}
                  </div>
                )}

                {/* Certifications */}
                {(profile.certifications || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {profile.certifications.map((c) => (
                      <span key={c} className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: '#03045e0d', color: '#03045e' }}>{c}</span>
                    ))}
                  </div>
                )}

                {/* Experience + Languages */}
                {(profile.years_experience || (profile.languages || []).length > 0) && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
                    {profile.years_experience && (
                      <span className="text-[11px] text-[#5a7d95] flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {profile.years_experience}
                      </span>
                    )}
                    {(profile.languages || []).length > 0 && (
                      <span className="text-[11px] text-[#5a7d95] flex items-center gap-1">
                        <Languages className="h-3 w-3" /> {profile.languages.join(', ')}
                      </span>
                    )}
                  </div>
                )}

                {profile.bio && (
                  <p style={{ fontSize: '0.8rem', color: '#4a6277', lineHeight: 1.75, margin: '8px 0 0' }}>
                    {profile.bio.slice(0, 180)}{profile.bio.length > 180 ? '...' : ''}
                  </p>
                )}

                {/* Social icons */}
                {(profile.linkedin_url || profile.instagram_url || profile.facebook_url || profile.twitter_url || profile.website_url) && (
                  <div className="flex gap-2 mt-3">
                    {[
                      { url: profile.linkedin_url, color: '#0077b5', icon: <Linkedin className="h-4 w-4" /> },
                      { url: profile.instagram_url, color: '#E4405F', icon: <Instagram className="h-4 w-4" /> },
                      { url: profile.facebook_url, color: '#1877F2', icon: <Facebook className="h-4 w-4" /> },
                      { url: profile.twitter_url, color: '#000', icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
                      { url: profile.website_url, color: DUO.blue, icon: <Globe className="h-4 w-4" /> },
                    ].filter(s => s.url).map((s, i) => (
                      <span key={i} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.04)', color: s.color }}>
                        {s.icon}
                      </span>
                    ))}
                  </div>
                )}
                {/* Education */}
                {(profile.education || []).length > 0 && (
                  <div className="mt-3 space-y-1">
                    {(profile.education || []).map((edu: { institution: string; program: string; logo_domain: string }, i: number) => (
                      <div key={i} className="flex items-center gap-2">
                        {edu.logo_domain && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`https://logo.clearbit.com/${edu.logo_domain}`} alt="" className="w-4 h-4 rounded object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        )}
                        <span className="text-[10px] text-[#5a7d95]">{edu.institution} — {edu.program}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Phone + Booking */}
                {(profile.phone || profile.booking_url) && (
                  <div className="flex gap-2 mt-3">
                    {profile.phone && (
                      <span className="text-[10px] text-[#5a7d95] flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {profile.phone}
                      </span>
                    )}
                    {profile.booking_url && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold" style={{ backgroundColor: '#58CC0215', color: '#45a300' }}>
                        Rendez-vous en ligne
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <p className="text-[10px] text-text-muted text-center mt-2 uppercase tracking-wider font-bold">Popup au clic</p>
          </div>
        </div>

        {/* Right column: Form fields */}
        <div className="lg:col-span-3 space-y-6">
          {/* Public info card */}
          <div
            className="rounded-2xl bg-white p-6 transition-all duration-200"
            style={{ border: `2px solid ${DUO.green}30`, borderBottom: `5px solid ${DUO.greenDark}30` }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: `${DUO.green}15`, boxShadow: `0 3px 0 0 ${DUO.greenDark}20` }}
              >
                <Sparkles className="h-5 w-5" style={{ color: DUO.green }} />
              </div>
              <h3 className="text-lg font-extrabold text-text-main">Informations publiques</h3>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-3">
                  <label className="block text-xs font-extrabold text-text-main mb-1.5">Nom affiche</label>
                  <Input
                    value={profile.display_name}
                    onChange={(e) => updateField('display_name', e.target.value)}
                    placeholder="Ex: Martin Brassard"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-text-main mb-1.5">Initiales</label>
                  <Input
                    value={profile.initials}
                    onChange={(e) => updateField('initials', e.target.value.toUpperCase().slice(0, 3))}
                    placeholder="MB"
                    className="text-center font-bold tracking-widest"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-text-main mb-1.5">Titre / Role</label>
                {customTitle ? (
                  <div className="flex gap-2">
                    <Input
                      value={profile.role_title}
                      onChange={(e) => updateField('role_title', e.target.value)}
                      placeholder="Entrez votre titre..."
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => { setCustomTitle(false); updateField('role_title', ROLE_TITLES[0]); }}
                      className="px-3 py-2 rounded-xl border-2 border-gray-200 bg-white text-xs font-extrabold text-text-muted hover:border-[#58CC02] hover:text-[#45a300] transition-all whitespace-nowrap"
                    >
                      Liste
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <select
                      value={ROLE_TITLES.includes(profile.role_title) ? profile.role_title : ''}
                      onChange={(e) => updateField('role_title', e.target.value)}
                      className="flex-1 rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-[#58CC02]/20 focus:border-[#58CC02] transition-all"
                    >
                      <option value="" disabled>Choisir un titre...</option>
                      {ROLE_TITLES.map((title) => (
                        <option key={title} value={title}>{title}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => { setCustomTitle(true); updateField('role_title', ''); }}
                      className="px-3 py-2 rounded-xl border-2 border-gray-200 bg-white text-xs font-extrabold text-text-muted hover:border-[#58CC02] hover:text-[#45a300] transition-all whitespace-nowrap"
                    >
                      Autre
                    </button>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-extrabold text-text-main">Biographie</label>
                  <span className={`text-xs font-bold ${profile.bio.length > 450 ? 'text-amber-500' : 'text-text-muted'}`}>
                    {profile.bio.length}/500
                  </span>
                </div>
                <textarea
                  value={profile.bio}
                  onChange={(e) => { if (e.target.value.length <= 500) updateField('bio', e.target.value); }}
                  placeholder="Decrivez votre experience, votre approche et vos specialites..."
                  rows={4}
                  className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-text-main placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-[#58CC02]/20 focus:border-[#58CC02] transition-all resize-none"
                />
              </div>

              {/* Citation */}
              <div>
                <label className="block text-xs font-extrabold text-text-main mb-1.5 flex items-center gap-1.5">
                  <Quote className="h-3.5 w-3.5" style={{ color: DUO.orange }} /> Citation / Devise
                </label>
                <input
                  type="text"
                  value={profile.quote || ''}
                  onChange={(e) => updateField('quote', e.target.value)}
                  placeholder="Ma philosophie : investir avec patience, prosperer avec confiance"
                  maxLength={200}
                  className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-text-main italic placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-[#FF9600]/20 focus:border-[#FF9600] transition-all"
                />
                <p className="text-[11px] text-text-muted mt-1">Apparait sous votre nom dans la fiche detaillee</p>
              </div>

              {/* Phone + Booking */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-text-main mb-1.5 flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" style={{ color: DUO.blue }} /> Telephone direct
                  </label>
                  <Input
                    type="tel"
                    value={profile.phone || ''}
                    onChange={(e) => updateField('phone', e.target.value)}
                    placeholder="418-555-1234"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-text-main mb-1.5 flex items-center gap-1.5">
                    <CalendarCheck className="h-3.5 w-3.5" style={{ color: DUO.green }} /> Lien rendez-vous
                  </label>
                  <Input
                    type="url"
                    value={profile.booking_url || ''}
                    onChange={(e) => updateField('booking_url', e.target.value)}
                    placeholder="https://calendly.com/..."
                  />
                </div>
              </div>

              {/* Specialties */}
              <div>
                <label className="block text-xs font-extrabold text-text-main mb-2 flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5" style={{ color: DUO.green }} /> Specialites
                </label>
                <div className="flex flex-wrap gap-2">
                  {SPECIALTIES.map((spec) => {
                    const selected = (profile.specialties || []).includes(spec);
                    return (
                      <button
                        key={spec}
                        type="button"
                        onClick={() => toggleArrayItem('specialties' as 'certifications', spec)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all duration-200 ${
                          selected
                            ? 'text-white'
                            : 'border-2 border-gray-200 bg-white text-text-muted hover:border-[#58CC02] hover:text-[#45a300]'
                        }`}
                        style={selected ? { backgroundColor: DUO.green, boxShadow: `0 2px 0 0 ${DUO.greenDark}` } : {}}
                      >
                        {spec}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Education */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-extrabold text-text-main flex items-center gap-1.5">
                    <GraduationCap className="h-3.5 w-3.5" style={{ color: DUO.blue }} /> Formation
                  </label>
                  <button
                    type="button"
                    onClick={() => updateField('education', [...(profile.education || []), { institution: '', program: '', logo_domain: '' }])}
                    className="text-xs font-bold hover:underline"
                    style={{ color: DUO.blue }}
                  >
                    + Ajouter
                  </button>
                </div>
                {(profile.education || []).map((edu: { institution: string; program: string; logo_domain: string }, i: number) => (
                  <div key={i} className="flex gap-3 items-start mb-3 p-3 rounded-xl bg-gray-50 border-2 border-gray-100">
                    {edu.logo_domain && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`https://logo.clearbit.com/${edu.logo_domain}`} alt="" className="w-8 h-8 rounded-lg object-contain flex-shrink-0 mt-1" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )}
                    <div className="flex-1 space-y-2">
                      <select
                        value={UNIVERSITIES.find(u => u.name === edu.institution) ? edu.institution : (edu.institution ? '__custom' : '')}
                        onChange={(e) => {
                          const arr = [...(profile.education || [])];
                          if (e.target.value === '__custom') {
                            arr[i] = { ...arr[i], institution: '', logo_domain: '' };
                          } else {
                            const uni = UNIVERSITIES.find(u => u.name === e.target.value);
                            arr[i] = { ...arr[i], institution: e.target.value, logo_domain: uni?.domain || '' };
                          }
                          updateField('education', arr);
                        }}
                        className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-[#1CB0F6]/20 focus:border-[#1CB0F6] transition-all"
                      >
                        <option value="" disabled>Choisir une universite...</option>
                        {UNIVERSITIES.map(u => <option key={u.domain} value={u.name}>{u.name}</option>)}
                        <option value="__custom">Autre...</option>
                      </select>
                      {edu.institution && !UNIVERSITIES.find(u => u.name === edu.institution) && (
                        <Input
                          value={edu.institution}
                          onChange={(e) => { const arr = [...(profile.education || [])]; arr[i] = { ...arr[i], institution: e.target.value }; updateField('education', arr); }}
                          placeholder="Nom de l'institution"
                        />
                      )}
                      <Input
                        value={edu.program}
                        onChange={(e) => { const arr = [...(profile.education || [])]; arr[i] = { ...arr[i], program: e.target.value }; updateField('education', arr); }}
                        placeholder="Programme (ex: B.A.A. Finance)"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => { const arr = [...(profile.education || [])]; arr.splice(i, 1); updateField('education', arr); }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors mt-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Logo badge */}
              {logos.length > 0 && (
                <div>
                  <label className="block text-xs font-extrabold text-text-main mb-2 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" style={{ color: DUO.orange }} /> Logo sur votre fiche
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => updateField('logo_id', '')}
                      className="px-3 py-2 rounded-xl text-xs font-bold transition-all border-2"
                      style={{
                        borderColor: !profile.logo_id ? DUO.orange : '#e5e7eb',
                        backgroundColor: !profile.logo_id ? `${DUO.orange}10` : 'white',
                        color: !profile.logo_id ? DUO.orangeDark : '#9ca3af',
                      }}
                    >Aucun</button>
                    {logos.map(l => (
                      <button key={l.id} type="button" onClick={() => updateField('logo_id', l.id)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border-2"
                        style={{
                          borderColor: profile.logo_id === l.id ? DUO.orange : '#e5e7eb',
                          backgroundColor: profile.logo_id === l.id ? `${DUO.orange}10` : 'white',
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={l.image_url} alt={l.name} className="h-5 w-auto object-contain" />
                        <span style={{ color: profile.logo_id === l.id ? DUO.orangeDark : '#6b7280' }}>{l.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Certifications */}
              <div>
                <label className="block text-xs font-extrabold text-text-main mb-2 flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5" style={{ color: DUO.purple }} /> Certifications / Titres professionnels
                </label>
                <div className="flex flex-wrap gap-2">
                  {CERTIFICATIONS.map((cert) => {
                    const selected = (profile.certifications || []).includes(cert);
                    return (
                      <button
                        key={cert}
                        type="button"
                        onClick={() => toggleArrayItem('certifications', cert)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all duration-200 ${
                          selected
                            ? 'text-white'
                            : 'border-2 border-gray-200 bg-white text-text-muted hover:border-[#CE82FF] hover:text-[#b06edb]'
                        }`}
                        style={selected ? { backgroundColor: DUO.purple, boxShadow: `0 2px 0 0 ${DUO.purpleDark}` } : {}}
                      >
                        {cert}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Languages */}
              <div>
                <label className="block text-xs font-extrabold text-text-main mb-2 flex items-center gap-1.5">
                  <Languages className="h-3.5 w-3.5" style={{ color: DUO.blue }} /> Langues parlees
                </label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((lang) => {
                    const selected = (profile.languages || []).includes(lang);
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => toggleArrayItem('languages', lang)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all duration-200 ${
                          selected
                            ? 'text-white'
                            : 'border-2 border-gray-200 bg-white text-text-muted hover:border-[#1CB0F6] hover:text-[#1899d6]'
                        }`}
                        style={selected ? { backgroundColor: DUO.blue, boxShadow: `0 2px 0 0 ${DUO.blueDark}` } : {}}
                      >
                        {lang}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Years of experience */}
              <div>
                <label className="block text-xs font-extrabold text-text-main mb-1.5 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" style={{ color: DUO.orange }} /> Annees d&apos;experience
                </label>
                <select
                  value={profile.years_experience || ''}
                  onChange={(e) => updateField('years_experience', e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-[#FF9600]/20 focus:border-[#FF9600] transition-all"
                >
                  <option value="">Ne pas afficher</option>
                  {YEARS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* Social links */}
              <div>
                <label className="block text-xs font-extrabold text-text-main mb-3">Reseaux sociaux</label>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#0077b515' }}>
                      <Linkedin className="h-4 w-4 text-[#0077b5]" />
                    </div>
                    <Input
                      value={profile.linkedin_url}
                      onChange={(e) => updateField('linkedin_url', e.target.value)}
                      placeholder="https://linkedin.com/in/votre-profil"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#E4405F15' }}>
                      <Instagram className="h-4 w-4 text-[#E4405F]" />
                    </div>
                    <Input
                      value={profile.instagram_url}
                      onChange={(e) => updateField('instagram_url', e.target.value)}
                      placeholder="https://instagram.com/votre-profil"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#1877F215' }}>
                      <Facebook className="h-4 w-4 text-[#1877F2]" />
                    </div>
                    <Input
                      value={profile.facebook_url}
                      onChange={(e) => updateField('facebook_url', e.target.value)}
                      placeholder="https://facebook.com/votre-profil"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#00000010' }}>
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    </div>
                    <Input
                      value={profile.twitter_url}
                      onChange={(e) => updateField('twitter_url', e.target.value)}
                      placeholder="https://x.com/votre-profil"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${DUO.blue}15` }}>
                      <Globe className="h-4 w-4" style={{ color: DUO.blue }} />
                    </div>
                    <Input
                      value={profile.website_url}
                      onChange={(e) => updateField('website_url', e.target.value)}
                      placeholder="https://votre-site-web.com"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Admin section */}
          {isAdmin && (
            <div
              className="rounded-2xl bg-white p-6 transition-all duration-200"
              style={{ border: `2px solid ${DUO.orange}30`, borderBottom: `5px solid ${DUO.orangeDark}30` }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: `${DUO.orange}15`, boxShadow: `0 3px 0 0 ${DUO.orangeDark}20` }}
                >
                  <Shield className="h-5 w-5" style={{ color: DUO.orange }} />
                </div>
                <h3 className="text-lg font-extrabold text-text-main">Administration</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-extrabold text-text-main mb-1.5">Badge</label>
                  <select
                    value={profile.badge}
                    onChange={(e) => updateField('badge', e.target.value)}
                    className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-[#FF9600]/20 focus:border-[#FF9600] transition-all"
                  >
                    <option value="Conseiller">Conseiller</option>
                    <option value="Assistant">Assistant</option>
                    <option value="Assistante">Assistante</option>
                    <option value="Partenaire">Partenaire</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-text-main mb-1.5">Onglet sur le site</label>
                  <select
                    value={profile.category}
                    onChange={(e) => updateField('category', e.target.value)}
                    className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-[#FF9600]/20 focus:border-[#FF9600] transition-all"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-text-main mb-1.5 flex items-center gap-1.5">
                    <GripVertical className="h-3.5 w-3.5" /> Ordre d&apos;affichage
                  </label>
                  <Input
                    type="number"
                    value={profile.sort_order}
                    onChange={(e) => updateField('sort_order', parseInt(e.target.value) || 0)}
                    min={0}
                    max={99}
                  />
                </div>
                <div>
                  <button
                    onClick={() => updateField('is_visible', !profile.is_visible)}
                    className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-xl border-2 transition-all duration-200 ${
                      profile.is_visible
                        ? 'border-[#58CC02]/30 bg-[#58CC02]/5 text-[#45a300]'
                        : 'border-gray-200 bg-gray-50 text-text-muted'
                    }`}
                  >
                    {profile.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    <span className="text-sm font-extrabold">
                      {profile.is_visible ? 'Visible sur le site' : 'Masque du site'}
                    </span>
                  </button>
                  <p className="text-xs text-text-muted mt-1.5">
                    {profile.is_visible
                      ? 'Ce profil apparait dans la section equipe du site public. Les visiteurs peuvent le voir.'
                      : 'Ce profil est cache du site public. Personne ne peut le voir tant que cette option est desactivee.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Save button area */}
          <div className="sticky bottom-6 z-10">
            <div
              className={`rounded-2xl bg-white p-4 flex items-center justify-between transition-all duration-300 ${
                saved ? 'border-2 border-[#58CC02]/40' : ''
              }`}
              style={saved ? { borderBottom: `5px solid ${DUO.greenDark}30` } : { border: `2px solid #e5e7eb30`, borderBottom: `5px solid #d1d5db30` }}
            >
              <div className="flex items-center gap-3">
                {saved && (
                  <div className="flex items-center gap-2 animate-[fadeIn_0.3s_ease]" style={{ color: DUO.green }}>
                    <CheckCircle className="h-5 w-5" />
                    <span className="text-sm font-extrabold">Sauvegarde! Visible sur le site sous 60s.</span>
                  </div>
                )}
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-extrabold transition-all active:translate-y-[2px] active:shadow-none hover:brightness-105 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: saved ? DUO.green : DUO.green,
                  boxShadow: `0 3px 0 0 ${DUO.greenDark}`,
                }}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : saved ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? 'Sauvegarde...' : saved ? 'Sauvegarde!' : 'Publier mon profil'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <PhotoStudio
        open={studioOpen}
        onClose={() => setStudioOpen(false)}
        onApply={uploadProcessedPhoto}
        displayName={profile.display_name}
        roleTitle={profile.role_title}
        initials={profile.initials}
      />
    </div>
  );
}
