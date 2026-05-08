'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Save, Upload, Loader2, CheckCircle, Linkedin, UserCircle } from 'lucide-react';

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

export default function ProfilePage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
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
        setTimeout(() => setSaved(false), 3000);
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
      <div>
        <PageHeader title="Mon Profil" description="Gestion de votre profil public affiché sur le site web du groupe" />
        <Card className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        </Card>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div>
      <PageHeader title="Mon Profil" description="Gestion de votre profil public affiché sur le site web du groupe" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Photo + Preview */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-text-main mb-4">Photo de profil</h3>
          <div className="flex flex-col items-center gap-4">
            <div className="w-40 h-40 rounded-2xl bg-bg-light border-2 border-dashed border-border-default flex items-center justify-center overflow-hidden">
              {profile.photo_url ? (
                <img src={profile.photo_url} alt={profile.display_name} className="w-full h-full object-cover" />
              ) : (
                <div className="text-center">
                  <UserCircle className="h-16 w-16 text-text-light mx-auto mb-2" />
                  <span className="text-xs text-text-muted">Aucune photo</span>
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
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              {uploading ? 'Envoi...' : 'Changer la photo'}
            </Button>
            <p className="text-xs text-text-muted text-center">JPEG, PNG ou WebP. Max 5 Mo.</p>
          </div>

          {/* Preview card */}
          <div className="mt-6 pt-6 border-t border-border-default">
            <h3 className="text-sm font-semibold text-text-main mb-3">Apercu sur le site</h3>
            <div className="bg-bg-light rounded-xl p-4 text-center">
              <div className="w-20 h-20 rounded-xl bg-brand-dark/10 mx-auto mb-3 overflow-hidden flex items-center justify-center">
                {profile.photo_url ? (
                  <img src={profile.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-brand-dark">{profile.initials}</span>
                )}
              </div>
              <p className="font-bold text-sm text-text-main">{profile.display_name}</p>
              <p className="text-xs text-text-muted">{profile.role_title || 'Titre non defini'}</p>
            </div>
          </div>
        </Card>

        {/* Right: Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-text-main mb-4">Informations publiques</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Nom affiche</label>
                <Input
                  value={profile.display_name}
                  onChange={(e) => updateField('display_name', e.target.value)}
                  placeholder="Ex: Martin Brassard"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Titre / Role</label>
                <Input
                  value={profile.role_title}
                  onChange={(e) => updateField('role_title', e.target.value)}
                  placeholder="Ex: Conseiller en placement"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Initiales</label>
                <Input
                  value={profile.initials}
                  onChange={(e) => updateField('initials', e.target.value.toUpperCase().slice(0, 3))}
                  placeholder="Ex: MB"
                  className="w-24"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Biographie</label>
                <textarea
                  value={profile.bio}
                  onChange={(e) => updateField('bio', e.target.value)}
                  placeholder="Decrivez votre experience, votre approche et vos specialites..."
                  rows={4}
                  className="w-full rounded-lg border border-border-default bg-white px-3 py-2 text-sm text-text-main placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all resize-none"
                />
                <p className="text-xs text-text-muted mt-1">{profile.bio.length}/500 caracteres</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5 flex items-center gap-1.5">
                  <Linkedin className="h-3.5 w-3.5" /> Profil LinkedIn
                </label>
                <Input
                  value={profile.linkedin_url}
                  onChange={(e) => updateField('linkedin_url', e.target.value)}
                  placeholder="https://linkedin.com/in/votre-profil"
                />
              </div>
            </div>
          </Card>

          {session?.user.role === 'admin' && (
            <Card className="p-6">
              <h3 className="text-sm font-semibold text-text-main mb-4">Parametres (Admin)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">Badge</label>
                  <select
                    value={profile.badge}
                    onChange={(e) => updateField('badge', e.target.value)}
                    className="w-full rounded-lg border border-border-default bg-white px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all"
                  >
                    <option value="Conseiller">Conseiller</option>
                    <option value="Assistant">Assistant</option>
                    <option value="Assistante">Assistante</option>
                    <option value="Partenaire">Partenaire</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">Categorie (onglet site web)</label>
                  <select
                    value={profile.category}
                    onChange={(e) => updateField('category', e.target.value)}
                    className="w-full rounded-lg border border-border-default bg-white px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all"
                  >
                    <option value="conseiller">Conseillers</option>
                    <option value="adjoint">Assistants</option>
                    <option value="parent-brassard">Equipe Parent & Brassard</option>
                    <option value="buisson">Equipe Buisson</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">Ordre d'affichage</label>
                  <Input
                    type="number"
                    value={profile.sort_order}
                    onChange={(e) => updateField('sort_order', parseInt(e.target.value) || 0)}
                    min={0}
                    max={99}
                  />
                </div>
                <div className="flex items-center gap-3 pt-5">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profile.is_visible}
                      onChange={(e) => updateField('is_visible', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-primary"></div>
                  </label>
                  <span className="text-sm text-text-main">Visible sur le site public</span>
                </div>
              </div>
            </Card>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : saved ? (
                <CheckCircle className="h-4 w-4 mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {saving ? 'Sauvegarde...' : saved ? 'Sauvegarde!' : 'Sauvegarder le profil'}
            </Button>
            {saved && <span className="text-sm text-green-600">Changements visibles sur le site web sous 60 secondes.</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
