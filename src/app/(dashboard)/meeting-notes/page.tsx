'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { SearchInput } from '@/components/ui/SearchInput';
import { useToast } from '@/components/ui/Toast';
import { useMeetingNotes } from '@/lib/hooks/useMeetingNotes';
import {
  Plus, Trash2, Phone, Monitor, Users as UsersIcon,
  Calendar, Clock, FileText, CheckCircle2, Edit3,
  ClipboardList, Sparkles,
} from 'lucide-react';

const MEETING_TYPE_LABELS: Record<string, { label: string; icon: typeof Phone; color: string }> = {
  phone: { label: 'Téléphone', icon: Phone, color: 'text-blue-600 bg-blue-50' },
  in_person: { label: 'En personne', icon: UsersIcon, color: 'text-emerald-600 bg-emerald-50' },
  video: { label: 'Vidéoconférence', icon: Monitor, color: 'text-purple-600 bg-purple-50' },
};

const SUBJECT_LABELS: Record<string, string> = {
  revision: 'Révision du portefeuille',
  placement: 'Placement',
  both: 'Révision + Placement',
};

export default function MeetingNotesPage() {
  const { notes, isLoading, mutate } = useMeetingNotes();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const filtered = notes.filter(n =>
    !search || n.client_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette note de réunion?')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/meeting-notes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast('success', 'Note supprimée');
        mutate();
      }
    } catch {
      toast('error', 'Erreur lors de la suppression');
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (d: string) => {
    try {
      return new Intl.DateTimeFormat('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(d));
    } catch { return d; }
  };

  return (
    <div>
      <PageHeader
        title="Notes de réunion"
        description="Gérez vos rencontres clients avec des notes structurées et l'aide de l'IA"
        action={
          <Link href="/meeting-notes/new">
            <Button variant="primary">
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle rencontre
            </Button>
          </Link>
        }
      />

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-brand-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-main font-[family-name:var(--font-heading)]">{notes.length}</p>
              <p className="text-xs text-text-muted">Total des notes</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-main font-[family-name:var(--font-heading)]">
                {notes.filter(n => n.status === 'completed').length}
              </p>
              <p className="text-xs text-text-muted">Complétées</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Edit3 className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-main font-[family-name:var(--font-heading)]">
                {notes.filter(n => n.status === 'draft').length}
              </p>
              <p className="text-xs text-text-muted">Brouillons</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="mb-4">
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} onClear={() => setSearch('')} placeholder="Rechercher par nom de client..." />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && notes.length === 0 && (
        <Card>
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-primary/10 to-emerald-50 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="h-10 w-10 text-brand-primary" />
            </div>
            <h3 className="text-lg font-bold text-text-main font-[family-name:var(--font-heading)] mb-2">
              Aucune note de réunion
            </h3>
            <p className="text-text-muted mb-6 max-w-md mx-auto">
              Commencez à documenter vos rencontres clients de façon structurée.
              L&apos;IA peut transcrire et résumer vos réunions automatiquement.
            </p>
            <Link href="/meeting-notes/new">
              <Button variant="primary">
                <Plus className="h-4 w-4 mr-2" />
                Créer ma première note
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Notes list */}
      {!isLoading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map(note => {
            const mt = MEETING_TYPE_LABELS[note.meeting_type] || MEETING_TYPE_LABELS.in_person;
            const MtIcon = mt.icon;
            return (
              <Link key={note.id} href={`/meeting-notes/${note.id}`}>
                <Card className="hover:shadow-md hover:border-brand-primary/30 transition-all duration-200 cursor-pointer group">
                  <div className="flex items-center gap-4">
                    {/* Meeting type icon */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${mt.color}`}>
                      <MtIcon className="h-6 w-6" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-text-main font-[family-name:var(--font-heading)] truncate">
                          {note.client_name || 'Client non spécifié'}
                        </h3>
                        <Badge variant={note.status === 'completed' ? 'success' : 'warning'}>
                          {note.status === 'completed' ? 'Complétée' : 'Brouillon'}
                        </Badge>
                        {note.ai_summary_advisor && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-xs font-medium">
                            <Sparkles className="h-3 w-3" />
                            IA
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-text-muted">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(note.meeting_date)}
                        </span>
                        {note.meeting_time && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {note.meeting_time}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5" />
                          {SUBJECT_LABELS[note.subject] || note.subject}
                        </span>
                      </div>
                    </div>

                    {/* Delete */}
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(note.id); }}
                      disabled={deleting === note.id}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg hover:bg-red-50 text-text-muted hover:text-red-600"
                    >
                      {deleting === note.id ? <Spinner size="sm" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
