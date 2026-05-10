'use client';

import { useState, useEffect } from 'react';
import {
  Users, Plus, Shield, UserCircle, Key, Loader2,
  CheckCircle, XCircle, Copy, Eye, EyeOff, AlertTriangle,
  Pencil, Clock, Link2,
} from 'lucide-react';

const DUO = {
  green: '#58CC02', greenDark: '#45a300',
  blue: '#1CB0F6', blueDark: '#1899d6',
  purple: '#CE82FF', purpleDark: '#b06edb',
  orange: '#FF9600', orangeDark: '#e08600',
} as const;

interface TeamProfile {
  id: string;
  display_name: string;
  role_title?: string;
  photo_url?: string;
  initials?: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'advisor';
  status: 'active' | 'inactive' | 'pending';
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  team_profile: { user_id: string; display_name: string; photo_url: string | null } | null;
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

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Create form
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'advisor' | 'admin'>('advisor');
  const [newPassword, setNewPassword] = useState('');
  const [newProfileId, setNewProfileId] = useState('');
  const [availableProfiles, setAvailableProfiles] = useState<TeamProfile[]>([]);

  // Reset password modal
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [resetting, setResetting] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [copied, setCopied] = useState(false);

  // Created user success (shows credentials)
  const [createdUser, setCreatedUser] = useState<{ name: string; email: string; password: string } | null>(null);

  // Toggle status (confirmation)
  const [confirmDeactivate, setConfirmDeactivate] = useState<User | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Edit user modal
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<'advisor' | 'admin'>('advisor');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    const res = await fetch('/api/admin/users');
    if (res.ok) {
      const data = await res.json();
      setUsers(data);
    }
    setLoading(false);
  }

  async function fetchAvailableProfiles() {
    const res = await fetch('/api/admin/users/available-profiles');
    if (res.ok) {
      const data = await res.json();
      setAvailableProfiles(data);
    }
  }

  function generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const special = '!@#$%&*';
    let pw = '';
    for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    pw += special[Math.floor(Math.random() * special.length)];
    pw += Math.floor(Math.random() * 10);
    setNewPassword(pw);
    setShowPassword(true);
  }

  function openCreate() {
    setShowCreate(true);
    generatePassword();
    fetchAvailableProfiles();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail,
          name: newName,
          role: newRole,
          password: newPassword,
          team_profile_id: newProfileId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error); return; }
      setShowCreate(false);
      setCreatedUser({ name: newName, email: newEmail, password: newPassword });
      setNewName(''); setNewEmail(''); setNewPassword(''); setNewRole('advisor'); setNewProfileId('');
      await fetchUsers();
    } finally {
      setCreating(false);
    }
  }

  async function handleResetPassword() {
    if (!resetTarget) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/admin/users/${resetTarget.id}/reset-password`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setTempPassword(data.tempPassword);
        setUsers(prev => prev.map(u => u.id === resetTarget.id ? { ...u, must_change_password: true } : u));
      }
    } finally {
      setResetting(false);
    }
  }

  async function toggleStatus(user: User) {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    setTogglingId(user.id);
    setConfirmDeactivate(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, ...data } : u));
      }
    } finally {
      setTogglingId(null);
    }
  }

  function handleStatusClick(user: User) {
    if (user.status === 'active') {
      setConfirmDeactivate(user);
    } else {
      toggleStatus(user);
    }
  }

  function openEdit(user: User) {
    setEditTarget(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditError('');
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setEditError('');
    setSaving(true);
    try {
      const updates: Record<string, string> = {};
      if (editName.trim() !== editTarget.name) updates.name = editName.trim();
      if (editEmail.trim().toLowerCase() !== editTarget.email) updates.email = editEmail.trim().toLowerCase();
      if (editRole !== editTarget.role) updates.role = editRole;

      if (Object.keys(updates).length === 0) {
        setEditTarget(null);
        return;
      }

      const res = await fetch(`/api/admin/users/${editTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.error); return; }
      setUsers(prev => prev.map(u => u.id === editTarget.id ? { ...u, ...data } : u));
      setEditTarget(null);
    } finally {
      setSaving(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: DUO.blue }} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-text-main">Gestion des acces</h1>
          <p className="text-base text-text-muted mt-1">Creez et gerez les comptes des conseillers</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-extrabold transition-all active:translate-y-[2px] active:shadow-none hover:brightness-105"
          style={{ backgroundColor: DUO.green, boxShadow: `0 3px 0 0 ${DUO.greenDark}` }}
        >
          <Plus className="h-4 w-4" />
          Nouveau compte
        </button>
      </div>

      {/* Users list */}
      <div className="space-y-3">
        {users.map((user) => (
          <div
            key={user.id}
            className="rounded-2xl bg-white p-5 flex items-center gap-4 transition-all duration-200"
            style={{ border: '2px solid #e5e7eb20', borderBottom: '4px solid #d1d5db20' }}
          >
            {/* Avatar */}
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: user.role === 'admin' ? `${DUO.orange}15` : `${DUO.blue}15`,
                boxShadow: `0 2px 0 0 ${user.role === 'admin' ? DUO.orangeDark : DUO.blueDark}20`,
              }}
            >
              {user.role === 'admin' ? (
                <Shield className="h-5 w-5" style={{ color: DUO.orange }} />
              ) : (
                <UserCircle className="h-5 w-5" style={{ color: DUO.blue }} />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-extrabold text-text-main truncate">{user.name}</p>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: user.role === 'admin' ? DUO.orange : DUO.blue }}
                >
                  {user.role === 'admin' ? 'Admin' : 'Conseiller'}
                </span>
                {user.must_change_password && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                    MDP temporaire
                  </span>
                )}
                {user.team_profile && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1" style={{ backgroundColor: `${DUO.purple}15`, color: DUO.purpleDark }}>
                    <Link2 className="h-2.5 w-2.5" />
                    {user.team_profile.display_name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <p className="text-sm text-text-muted truncate">{user.email}</p>
                <span className="text-[11px] text-text-light flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {timeAgo(user.last_login_at)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => openEdit(user)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all"
                style={{ backgroundColor: `${DUO.blue}12`, color: DUO.blueDark }}
                title="Modifier"
              >
                <Pencil className="h-3 w-3" />
                Modifier
              </button>

              <button
                onClick={() => handleStatusClick(user)}
                disabled={togglingId === user.id}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                  user.status === 'active'
                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : 'bg-red-50 text-red-600 hover:bg-red-100'
                }`}
              >
                {togglingId === user.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : user.status === 'active' ? (
                  <CheckCircle className="h-3 w-3" />
                ) : (
                  <XCircle className="h-3 w-3" />
                )}
                {user.status === 'active' ? 'Actif' : 'Desactive'}
              </button>

              <button
                onClick={() => setResetTarget(user)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold bg-gray-50 text-text-muted hover:bg-gray-100 transition-all"
              >
                <Key className="h-3 w-3" />
                Reset MDP
              </button>
            </div>
          </div>
        ))}

        {users.length === 0 && (
          <div className="text-center py-16">
            <Users className="h-12 w-12 text-text-light mx-auto mb-3" />
            <p className="font-extrabold text-text-main">Aucun utilisateur</p>
            <p className="text-sm text-text-muted mt-1">Creez le premier compte conseiller</p>
          </div>
        )}
      </div>

      {/* Create user modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4" style={{ background: `linear-gradient(135deg, ${DUO.green}, ${DUO.greenDark})` }}>
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                <Plus className="h-5 w-5" /> Nouveau compte
              </h2>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-text-main mb-1.5">Nom complet</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Martin Brassard"
                  required
                  className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-[#58CC02]/20 focus:border-[#58CC02] transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-text-main mb-1.5">Courriel</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="martin@groupefinancier.com"
                  required
                  className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-[#58CC02]/20 focus:border-[#58CC02] transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-text-main mb-1.5">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'advisor' | 'admin')}
                  className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-[#58CC02]/20 focus:border-[#58CC02] transition-all"
                >
                  <option value="advisor">Conseiller</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>

              {/* Link team profile */}
              <div>
                <label className="block text-xs font-extrabold text-text-main mb-1.5 flex items-center gap-1.5">
                  <Link2 className="h-3 w-3" style={{ color: DUO.purple }} />
                  Lier a un profil equipe
                </label>
                <select
                  value={newProfileId}
                  onChange={(e) => setNewProfileId(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-[#CE82FF]/20 focus:border-[#CE82FF] transition-all"
                >
                  <option value="">Aucun profil (lier plus tard)</option>
                  {availableProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name}{p.role_title ? ` — ${p.role_title}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-text-muted mt-1">
                  Seuls les profils non lies sont affiches.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-extrabold text-text-main">Mot de passe temporaire</label>
                  <button type="button" onClick={generatePassword} className="text-[11px] font-bold hover:underline" style={{ color: DUO.green }}>
                    Regenerer
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-text-main font-mono focus:outline-none focus:ring-2 focus:ring-[#58CC02]/20 focus:border-[#58CC02] transition-all pr-20"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="p-1.5 rounded-lg hover:bg-gray-100 text-text-muted">
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    <button type="button" onClick={() => copyToClipboard(newPassword)} className="p-1.5 rounded-lg hover:bg-gray-100 text-text-muted">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-text-muted mt-1.5">
                  L&apos;utilisateur devra changer ce mot de passe a sa premiere connexion.
                </p>
              </div>

              {createError && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-2.5 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {createError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-extrabold text-text-muted hover:bg-gray-50 transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-extrabold transition-all active:translate-y-[2px] active:shadow-none hover:brightness-105 disabled:opacity-60"
                  style={{ backgroundColor: DUO.green, boxShadow: `0 3px 0 0 ${DUO.greenDark}` }}
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Creer le compte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit user modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4" style={{ background: `linear-gradient(135deg, ${DUO.blue}, ${DUO.blueDark})` }}>
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                <Pencil className="h-5 w-5" /> Modifier l&apos;utilisateur
              </h2>
            </div>
            <form onSubmit={handleEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-text-main mb-1.5">Nom complet</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-[#1CB0F6]/20 focus:border-[#1CB0F6] transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-text-main mb-1.5">Courriel</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-[#1CB0F6]/20 focus:border-[#1CB0F6] transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-text-main mb-1.5">Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as 'advisor' | 'admin')}
                  className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-[#1CB0F6]/20 focus:border-[#1CB0F6] transition-all"
                >
                  <option value="advisor">Conseiller</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>

              {editError && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-2.5 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {editError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-extrabold text-text-muted hover:bg-gray-50 transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-extrabold transition-all active:translate-y-[2px] active:shadow-none hover:brightness-105 disabled:opacity-60"
                  style={{ backgroundColor: DUO.blue, boxShadow: `0 3px 0 0 ${DUO.blueDark}` }}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Sauvegarder
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
                <AlertTriangle className="h-5 w-5" /> Confirmer la desactivation
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-text-main">
                Vous etes sur le point de desactiver le compte de <strong>{confirmDeactivate.name}</strong> ({confirmDeactivate.email}).
              </p>
              <p className="text-xs text-text-muted">
                L&apos;utilisateur ne pourra plus se connecter. Vous pourrez reactiver le compte a tout moment.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmDeactivate(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-extrabold text-text-muted hover:bg-gray-50 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={() => toggleStatus(confirmDeactivate)}
                  disabled={togglingId === confirmDeactivate.id}
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

      {/* Created user credentials modal */}
      {createdUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4" style={{ background: `linear-gradient(135deg, ${DUO.green}, ${DUO.greenDark})` }}>
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                <CheckCircle className="h-5 w-5" /> Compte cree avec succes !
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-text-main">
                Le compte de <strong>{createdUser.name}</strong> a ete cree. Transmettez ces identifiants de facon securisee :
              </p>

              <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-[11px] font-bold text-text-muted mb-1">Courriel</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-white rounded-lg px-3 py-2 text-sm font-mono font-bold text-text-main border border-gray-200">
                      {createdUser.email}
                    </code>
                    <button
                      onClick={() => copyToClipboard(createdUser.email)}
                      className="p-2 rounded-lg hover:bg-gray-100 text-text-muted"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-text-muted mb-1">Mot de passe temporaire</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-white rounded-lg px-3 py-2 text-sm font-mono font-bold text-text-main border border-amber-200" style={{ backgroundColor: '#fffbeb' }}>
                      {createdUser.password}
                    </code>
                    <button
                      onClick={() => copyToClipboard(createdUser.password)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-extrabold transition-all"
                      style={{ backgroundColor: copied ? DUO.green : `${DUO.orange}15`, color: copied ? 'white' : DUO.orange }}
                    >
                      {copied ? <CheckCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copie!' : 'Copier'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-xs font-bold text-red-700 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Ce mot de passe ne sera plus jamais affiche. Notez-le maintenant.
                </p>
              </div>

              <p className="text-xs text-text-muted">
                L&apos;utilisateur devra changer ce mot de passe a sa premiere connexion.
              </p>

              <button
                onClick={() => { setCreatedUser(null); setCopied(false); }}
                className="w-full px-4 py-2.5 rounded-xl text-white text-sm font-extrabold transition-all active:translate-y-[2px] active:shadow-none"
                style={{ backgroundColor: DUO.green, boxShadow: `0 3px 0 0 ${DUO.greenDark}` }}
              >
                J&apos;ai note les identifiants
              </button>
            </div>
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
                    <p className="text-xs font-bold text-amber-800 mb-2">Mot de passe temporaire pour {resetTarget.name} :</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-white rounded-lg px-3 py-2 text-sm font-mono font-bold text-text-main border border-amber-200">
                        {tempPassword}
                      </code>
                      <button
                        onClick={() => copyToClipboard(tempPassword)}
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
                      Ce mot de passe ne sera plus jamais affiche. Transmettez-le de facon securisee.
                    </p>
                  </div>
                  <p className="text-xs text-text-muted">
                    L&apos;utilisateur sera force de changer son mot de passe a la prochaine connexion.
                  </p>
                  <button
                    onClick={closeResetModal}
                    className="w-full px-4 py-2.5 rounded-xl text-white text-sm font-extrabold transition-all active:translate-y-[2px] active:shadow-none"
                    style={{ backgroundColor: DUO.orange, boxShadow: `0 3px 0 0 ${DUO.orangeDark}` }}
                  >
                    Fermer
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-text-main">
                    Vous allez generer un nouveau mot de passe temporaire pour <strong>{resetTarget.name}</strong> ({resetTarget.email}).
                  </p>
                  <p className="text-xs text-text-muted">
                    L&apos;ancien mot de passe sera invalide immediatement. L&apos;utilisateur devra changer le mot de passe temporaire a sa prochaine connexion.
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={closeResetModal}
                      className="flex-1 px-4 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-extrabold text-text-muted hover:bg-gray-50 transition-all"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleResetPassword}
                      disabled={resetting}
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
    </div>
  );
}
