'use client';

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import {
  Wrench, Loader2, Mail, UserX, Clock, CheckCircle2, Circle,
  Trash2, ExternalLink, Inbox,
} from 'lucide-react';

interface Feedback {
  id: string;
  tool: string;
  message: string;
  email: string;
  page_url: string;
  user_agent: string;
  status: 'new' | 'in_progress' | 'resolved';
  created_at: string;
}

const TOOL_LABELS: Record<string, string> = {
  compas: 'Projections',
  budget: 'Mon Budget',
  hypotheque: 'Calculateur immobilier',
  dashboard: 'Tableau de bord',
  outils: 'Nos outils',
  '': 'Général',
};

const STATUS_META = {
  new: { label: 'Nouveau', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  in_progress: { label: 'En cours', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  resolved: { label: 'Résolu', cls: 'bg-green-50 text-green-700 border-green-200' },
} as const;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Il y a ${days} j`;
  return new Date(dateStr).toLocaleDateString('fr-CA');
}

type Filter = 'all' | 'new' | 'in_progress' | 'resolved';

export default function AdminToolsFeedbackPage() {
  const [items, setItems] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/tool-feedback');
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function setStatus(id: string, status: Feedback['status']) {
    setBusyId(id);
    setItems(prev => prev.map(it => (it.id === id ? { ...it, status } : it)));
    try {
      await fetch('/api/admin/tool-feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm('Supprimer définitivement ce signalement ?')) return;
    setBusyId(id);
    try {
      await fetch(`/api/admin/tool-feedback?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      setItems(prev => prev.filter(it => it.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  const counts = {
    all: items.length,
    new: items.filter(i => i.status === 'new').length,
    in_progress: items.filter(i => i.status === 'in_progress').length,
    resolved: items.filter(i => i.status === 'resolved').length,
  };
  const visible = filter === 'all' ? items : items.filter(i => i.status === filter);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Tous' },
    { key: 'new', label: 'Nouveaux' },
    { key: 'in_progress', label: 'En cours' },
    { key: 'resolved', label: 'Résolus' },
  ];

  return (
    <div>
      <PageHeader
        title="Nos outils"
        description="Bugs et problèmes signalés par les utilisateurs des outils financiers du site."
      />

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 mb-6">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
              filter === f.key
                ? 'bg-brand-primary text-white border-brand-primary'
                : 'bg-white text-text-muted border-gray-200 hover:border-brand-primary/40'
            }`}
          >
            {f.label}
            <span className={`ml-1.5 ${filter === f.key ? 'text-white/80' : 'text-text-light'}`}>
              {counts[f.key]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <Card className="text-center py-16">
          <Loader2 className="h-8 w-8 text-brand-primary mx-auto animate-spin" />
          <p className="text-sm text-text-muted mt-3">Chargement des signalements…</p>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="text-center py-16">
          <Inbox className="h-12 w-12 text-text-light mx-auto mb-3" />
          <h3 className="font-semibold text-text-main">Aucun signalement</h3>
          <p className="text-sm text-text-muted mt-1">
            {filter === 'all'
              ? 'Rien pour le moment — les bugs signalés par les utilisateurs apparaîtront ici.'
              : 'Aucun signalement dans cette catégorie.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map(item => {
            const meta = STATUS_META[item.status];
            return (
              <Card key={item.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center flex-shrink-0">
                    <Wrench className="h-5 w-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Méta : outil + statut + date */}
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="text-xs font-bold uppercase tracking-wide text-text-muted">
                        {TOOL_LABELS[item.tool] ?? item.tool ?? 'Général'}
                      </span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${meta.cls}`}>
                        {meta.label}
                      </span>
                      <span className="text-xs text-text-light flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {timeAgo(item.created_at)}
                      </span>
                    </div>

                    {/* Message */}
                    <p className="text-sm text-text-main whitespace-pre-wrap break-words">{item.message}</p>

                    {/* Contact + page */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs">
                      {item.email ? (
                        <a href={`mailto:${item.email}`} className="flex items-center gap-1 text-brand-primary hover:underline">
                          <Mail className="h-3.5 w-3.5" /> {item.email}
                        </a>
                      ) : (
                        <span className="flex items-center gap-1 text-text-light">
                          <UserX className="h-3.5 w-3.5" /> Anonyme
                        </span>
                      )}
                      {item.page_url && (
                        <a href={item.page_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-text-light hover:text-brand-primary">
                          <ExternalLink className="h-3.5 w-3.5" /> Page
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    {item.status !== 'in_progress' && (
                      <button
                        onClick={() => setStatus(item.id, 'in_progress')}
                        disabled={busyId === item.id}
                        title="Marquer en cours"
                        className="h-8 w-8 rounded-lg border border-gray-200 text-amber-600 hover:bg-amber-50 flex items-center justify-center disabled:opacity-50"
                      >
                        <Circle className="h-4 w-4" />
                      </button>
                    )}
                    {item.status !== 'resolved' ? (
                      <button
                        onClick={() => setStatus(item.id, 'resolved')}
                        disabled={busyId === item.id}
                        title="Marquer résolu"
                        className="h-8 w-8 rounded-lg border border-gray-200 text-green-600 hover:bg-green-50 flex items-center justify-center disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => setStatus(item.id, 'new')}
                        disabled={busyId === item.id}
                        title="Rouvrir"
                        className="h-8 w-8 rounded-lg border border-gray-200 text-blue-600 hover:bg-blue-50 flex items-center justify-center disabled:opacity-50"
                      >
                        <Circle className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => remove(item.id)}
                      disabled={busyId === item.id}
                      title="Supprimer"
                      className="h-8 w-8 rounded-lg border border-gray-200 text-red-500 hover:bg-red-50 flex items-center justify-center disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
