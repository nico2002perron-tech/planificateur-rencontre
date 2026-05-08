'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Input } from '@/components/ui/Input';
import {
  Save, Upload, Loader2, CheckCircle, Linkedin, UserCircle,
  Camera, Sparkles, Eye, EyeOff, GripVertical, Shield,
  ExternalLink, Instagram, Facebook, Globe,
} from 'lucide-react';

// Duolingo palette (same as Reports page)
const DUO = {
  green: '#58CC02', greenDark: '#45a300',
  blue: '#1CB0F6', blueDark: '#1899d6',
  purple: '#CE82FF', purpleDark: '#b06edb',
  orange: '#FF9600', orangeDark: '#e08600',
} as const;

interface TeamProfile {
  user_id: string;
  display_name: string;
  role_title: string;
  bio: string;
  photo_url: string;
  linkedin_url: string;
  instagram_url: string;
  facebook_url: string;
  twitter_url: string;
  website_url: string;
  badge: string;
  category: string;
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
  const [customTitle, setCustomTitle] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const res = await fetch('/api/team-profile/photo', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const { url } = await res.json();
        setProfile(prev => prev ? { ...prev, photo_url: url } : prev);
      }
    } finally {
      setUploading(false);
    }
  }

  function updateField(field: keyof TeamProfile, value: string | boolean | number) {
    setProfile(prev => prev ? { ...prev, [field]: value } : prev);
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
                onClick={() => fileInputRef.current?.click()}
                onMouseEnter={() => setPhotoHover(true)}
                onMouseLeave={() => setPhotoHover(false)}
              >
                {profile.photo_url ? (
                  <>
                    <img src={profile.photo_url} alt={profile.display_name} className="w-full h-full object-cover" />
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
                        <p className="text-xs text-text-muted mt-1">JPG, PNG ou WebP - Max 5 Mo</p>
                      </>
                    )}
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>
          </div>

          {/* Live preview card */}
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

            <div className="bg-gray-50 rounded-2xl p-6 text-center">
              <div className="w-24 h-24 rounded-2xl bg-white mx-auto mb-4 overflow-hidden flex items-center justify-center shadow-sm border border-gray-100">
                {profile.photo_url ? (
                  <img src={profile.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-extrabold text-text-muted">{profile.initials || '??'}</span>
                )}
              </div>
              <p className="font-extrabold text-base text-text-main">{profile.display_name || 'Votre nom'}</p>
              <p className="text-sm text-text-muted mt-0.5">{profile.role_title || 'Votre titre'}</p>
              {profile.bio && (
                <p className="text-xs text-text-muted mt-3 leading-relaxed max-w-[250px] mx-auto">
                  {profile.bio.slice(0, 120)}{profile.bio.length > 120 ? '...' : ''}
                </p>
              )}
              {(profile.linkedin_url || profile.instagram_url || profile.facebook_url || profile.twitter_url || profile.website_url) && (
                <div className="flex items-center justify-center gap-2 mt-3">
                  {profile.linkedin_url && <Linkedin className="h-4 w-4 text-[#0077b5]" />}
                  {profile.instagram_url && <Instagram className="h-4 w-4 text-[#E4405F]" />}
                  {profile.facebook_url && <Facebook className="h-4 w-4 text-[#1877F2]" />}
                  {profile.twitter_url && (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  )}
                  {profile.website_url && <Globe className="h-4 w-4" style={{ color: DUO.blue }} />}
                </div>
              )}
            </div>
            <p className="text-xs text-text-muted text-center mt-3">
              Tel que vu par les visiteurs sur le site
            </p>
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
    </div>
  );
}
