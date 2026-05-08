'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Save, Upload, Loader2, CheckCircle, Linkedin, UserCircle,
  Camera, Sparkles, Eye, EyeOff, GripVertical, Shield,
  ExternalLink, Trophy, Zap,
} from 'lucide-react';

interface TeamProfile {
  user_id: string;
  display_name: string;
  role_title: string;
  bio: string;
  photo_url: string;
  linkedin_url: string;
  badge: string;
  category: string;
  initials: string;
  sort_order: number;
  is_visible: boolean;
}

function getCompletionScore(p: TeamProfile) {
  let score = 0;
  if (p.display_name) score += 20;
  if (p.role_title) score += 20;
  if (p.bio && p.bio.length > 20) score += 25;
  if (p.photo_url) score += 25;
  if (p.linkedin_url) score += 10;
  return score;
}

function getCompletionMessage(score: number) {
  if (score === 100) return { text: 'Profil complet! Vous brillez!', color: 'text-emerald-600' };
  if (score >= 75) return { text: 'Presque parfait! Plus qu\'un effort!', color: 'text-brand-primary' };
  if (score >= 50) return { text: 'Bon debut! Continuez comme ca!', color: 'text-amber-500' };
  return { text: 'Completez votre profil pour apparaitre au mieux sur le site.', color: 'text-text-muted' };
}

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/team-profile')
      .then(res => res.json())
      .then(data => { setProfile(data); setLoading(false); })
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
            <Loader2 className="h-10 w-10 animate-spin text-brand-primary mx-auto mb-4" />
            <p className="text-sm text-text-muted animate-pulse">Chargement de votre profil...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const score = getCompletionScore(profile);
  const message = getCompletionMessage(score);
  const isAdmin = session?.user.role === 'admin';

  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-accent flex items-center justify-center">
            <UserCircle className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)] text-text-main">
              Mon Profil
            </h1>
            <p className="text-sm text-text-muted">
              Votre vitrine sur le site web du Groupe Financier
            </p>
          </div>
        </div>
      </div>

      {/* Completion bar */}
      <Card className="p-5 mb-6" padding="none">
        <div className="flex items-center gap-4">
          <div className={`flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center ${
            score === 100
              ? 'bg-emerald-50 text-emerald-600'
              : score >= 50
                ? 'bg-brand-primary/10 text-brand-primary'
                : 'bg-amber-50 text-amber-500'
          }`}>
            {score === 100 ? <Trophy className="h-7 w-7" /> : <Zap className="h-7 w-7" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-sm font-semibold ${message.color}`}>{message.text}</span>
              <span className="text-sm font-bold text-text-main">{score}%</span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${
                  score === 100
                    ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                    : score >= 50
                      ? 'bg-gradient-to-r from-brand-primary to-brand-accent'
                      : 'bg-gradient-to-r from-amber-400 to-amber-500'
                }`}
                style={{ width: `${score}%` }}
              />
            </div>
            <div className="flex gap-3 mt-2">
              {[
                { done: !!profile.display_name, label: 'Nom' },
                { done: !!profile.role_title, label: 'Titre' },
                { done: profile.bio?.length > 20, label: 'Bio' },
                { done: !!profile.photo_url, label: 'Photo' },
                { done: !!profile.linkedin_url, label: 'LinkedIn' },
              ].map((item) => (
                <span key={item.label} className={`text-xs font-medium flex items-center gap-1 ${item.done ? 'text-emerald-600' : 'text-text-light'}`}>
                  {item.done ? <CheckCircle className="h-3 w-3" /> : <span className="w-3 h-3 rounded-full border-2 border-current inline-block" />}
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left column: Photo + Live Preview */}
        <div className="lg:col-span-2 space-y-6">
          {/* Photo upload */}
          <Card padding="none" className="overflow-hidden">
            <div className="bg-gradient-to-br from-brand-dark to-brand-dark/80 px-5 py-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Camera className="h-4 w-4 text-brand-primary" />
                Photo de profil
              </h3>
            </div>
            <div className="p-6 flex flex-col items-center">
              <div
                className="relative w-44 h-44 rounded-3xl bg-gradient-to-br from-gray-50 to-gray-100 border-3 border-dashed border-gray-200 flex items-center justify-center overflow-hidden cursor-pointer group transition-all duration-300 hover:border-brand-primary hover:shadow-lg hover:shadow-brand-primary/10"
                onClick={() => fileInputRef.current?.click()}
                onMouseEnter={() => setPhotoHover(true)}
                onMouseLeave={() => setPhotoHover(false)}
              >
                {profile.photo_url ? (
                  <>
                    <img src={profile.photo_url} alt={profile.display_name} className="w-full h-full object-cover" />
                    <div className={`absolute inset-0 bg-brand-dark/60 flex items-center justify-center transition-opacity duration-200 ${photoHover ? 'opacity-100' : 'opacity-0'}`}>
                      <div className="text-center text-white">
                        <Camera className="h-6 w-6 mx-auto mb-1" />
                        <span className="text-xs font-semibold">Changer</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center">
                    {uploading ? (
                      <Loader2 className="h-10 w-10 animate-spin text-brand-primary mx-auto" />
                    ) : (
                      <>
                        <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-brand-primary/20 transition-colors">
                          <Upload className="h-7 w-7 text-brand-primary" />
                        </div>
                        <p className="text-sm font-semibold text-text-main">Cliquez pour ajouter</p>
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
          </Card>

          {/* Live preview */}
          <Card padding="none" className="overflow-hidden">
            <div className="bg-gradient-to-br from-brand-dark to-brand-dark/80 px-5 py-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Eye className="h-4 w-4 text-brand-primary" />
                Apercu en direct
              </h3>
            </div>
            <div className="p-6">
              <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-2xl p-6 text-center border border-gray-100">
                <div className="w-24 h-24 rounded-2xl bg-brand-dark/10 mx-auto mb-4 overflow-hidden flex items-center justify-center shadow-sm">
                  {profile.photo_url ? (
                    <img src={profile.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl font-bold text-brand-dark">{profile.initials || '??'}</span>
                  )}
                </div>
                <p className="font-bold text-base text-text-main">{profile.display_name || 'Votre nom'}</p>
                <p className="text-sm text-text-muted mt-0.5">{profile.role_title || 'Votre titre'}</p>
                {profile.bio && (
                  <p className="text-xs text-text-muted mt-3 leading-relaxed max-w-[250px] mx-auto">{profile.bio.slice(0, 120)}{profile.bio.length > 120 ? '...' : ''}</p>
                )}
                {profile.linkedin_url && (
                  <div className="mt-3">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0077b5]">
                      <Linkedin className="h-3 w-3" /> LinkedIn
                      <ExternalLink className="h-2.5 w-2.5" />
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs text-text-light text-center mt-3">
                Tel que vu par les visiteurs sur le site
              </p>
            </div>
          </Card>
        </div>

        {/* Right column: Form fields */}
        <div className="lg:col-span-3 space-y-6">
          {/* Identity */}
          <Card padding="none" className="overflow-hidden">
            <div className="bg-gradient-to-br from-brand-dark to-brand-dark/80 px-5 py-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand-primary" />
                Informations publiques
              </h3>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-text-main mb-1.5">Nom affiche</label>
                  <Input
                    value={profile.display_name}
                    onChange={(e) => updateField('display_name', e.target.value)}
                    placeholder="Ex: Martin Brassard"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1.5">Initiales</label>
                  <Input
                    value={profile.initials}
                    onChange={(e) => updateField('initials', e.target.value.toUpperCase().slice(0, 3))}
                    placeholder="MB"
                    className="text-center font-bold tracking-widest"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-main mb-1.5">Titre / Role</label>
                <Input
                  value={profile.role_title}
                  onChange={(e) => updateField('role_title', e.target.value)}
                  placeholder="Ex: Conseiller en placement"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-text-main">Biographie</label>
                  <span className={`text-xs font-medium ${profile.bio.length > 450 ? 'text-amber-500' : 'text-text-light'}`}>
                    {profile.bio.length}/500
                  </span>
                </div>
                <textarea
                  value={profile.bio}
                  onChange={(e) => { if (e.target.value.length <= 500) updateField('bio', e.target.value); }}
                  placeholder="Decrivez votre experience, votre approche et vos specialites pour que les visiteurs puissent mieux vous connaitre..."
                  rows={4}
                  className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-text-main placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all resize-none"
                />
                {!profile.bio && (
                  <p className="text-xs text-brand-primary/70 mt-1.5 flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    Ajoutez une bio pour vous demarquer!
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-main mb-1.5 flex items-center gap-1.5">
                  <Linkedin className="h-3.5 w-3.5 text-[#0077b5]" /> Profil LinkedIn
                </label>
                <Input
                  value={profile.linkedin_url}
                  onChange={(e) => updateField('linkedin_url', e.target.value)}
                  placeholder="https://linkedin.com/in/votre-profil"
                />
              </div>
            </div>
          </Card>

          {/* Admin section */}
          {isAdmin && (
            <Card padding="none" className="overflow-hidden border-2 border-amber-200/50">
              <div className="bg-gradient-to-r from-amber-500 to-amber-400 px-5 py-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Administration
                </h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-text-main mb-1.5">Badge</label>
                    <select
                      value={profile.badge}
                      onChange={(e) => updateField('badge', e.target.value)}
                      className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all"
                    >
                      <option value="Conseiller">Conseiller</option>
                      <option value="Assistant">Assistant</option>
                      <option value="Assistante">Assistante</option>
                      <option value="Partenaire">Partenaire</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-main mb-1.5">Onglet sur le site</label>
                    <select
                      value={profile.category}
                      onChange={(e) => updateField('category', e.target.value)}
                      className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all"
                    >
                      {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-main mb-1.5 flex items-center gap-1.5">
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
                  <div className="flex items-end pb-1">
                    <button
                      onClick={() => updateField('is_visible', !profile.is_visible)}
                      className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-xl border-2 transition-all duration-200 ${
                        profile.is_visible
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-gray-200 bg-gray-50 text-text-muted'
                      }`}
                    >
                      {profile.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      <span className="text-sm font-semibold">
                        {profile.is_visible ? 'Visible sur le site' : 'Masque du site'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Save button */}
          <div className={`sticky bottom-6 z-10 transition-all duration-300 ${saved ? '' : ''}`}>
            <Card padding="none" className={`p-4 flex items-center justify-between border-2 transition-all duration-500 ${
              saved ? 'border-emerald-300 bg-emerald-50/80 shadow-lg shadow-emerald-100' : 'border-transparent'
            }`}>
              <div className="flex items-center gap-3">
                {saved && (
                  <div className="flex items-center gap-2 text-emerald-600 animate-[fadeIn_0.3s_ease]">
                    <CheckCircle className="h-5 w-5" />
                    <span className="text-sm font-semibold">Sauvegarde! Visible sur le site sous 60s.</span>
                  </div>
                )}
              </div>
              <Button
                onClick={handleSave}
                disabled={saving}
                size="lg"
                className={saved ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : saved ? (
                  <CheckCircle className="h-4 w-4 mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {saving ? 'Sauvegarde...' : saved ? 'Sauvegarde!' : 'Publier mon profil'}
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
