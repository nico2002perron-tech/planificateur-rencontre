'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useReports, type Report } from '@/lib/hooks/useReports';
import { PretAColler } from '@/components/reports/PretAColler';
import { FileText, Plus, Download, Trash2, Calendar, ClipboardPaste } from 'lucide-react';

const statusMap: Record<string, { label: string; variant: 'info' | 'success' | 'warning' | 'danger' }> = {
  ready: { label: 'Prêt', variant: 'success' },
  generating: { label: 'En cours', variant: 'warning' },
  draft: { label: 'Brouillon', variant: 'info' },
  error: { label: 'Erreur', variant: 'danger' },
};

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('fr-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

type Tab = 'reports' | 'paste';

export default function ReportsPage() {
  const { reports, isLoading, mutate } = useReports();
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<Report | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('reports');

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/reports/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast('success', 'Rapport supprimé');
      mutate();
    } catch {
      toast('error', 'Erreur lors de la suppression');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  async function handleDownload(report: Report) {
    try {
      const res = await fetch(`/api/reports/${report.id}/download`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${report.title}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      toast('error', 'Erreur lors du téléchargement');
    }
  }

  return (
    <div>
      <PageHeader
        title="Rapports"
        description="Rapports PDF et analyse rapide des cours cibles"
        action={
          <Link href="/reports/new">
            <Button icon={<Plus className="h-4 w-4" />}>Nouveau rapport</Button>
          </Link>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-gray-100/80 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('reports')}
          className={`
            flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200
            ${activeTab === 'reports'
              ? 'bg-white text-text-main shadow-sm'
              : 'text-text-muted hover:text-text-main'}
          `}
        >
          <FileText className="h-4 w-4" />
          Mes rapports
        </button>
        <button
          onClick={() => setActiveTab('paste')}
          className={`
            flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200
            ${activeTab === 'paste'
              ? 'bg-white text-text-main shadow-sm'
              : 'text-text-muted hover:text-text-main'}
          `}
        >
          <ClipboardPaste className="h-4 w-4" />
          Prêt à coller
        </button>
      </div>

      {/* Tab: Mes rapports */}
      {activeTab === 'reports' && (
        <>
          {isLoading ? (
            <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          ) : !reports || reports.length === 0 ? (
            <Card className="text-center py-16">
              <FileText className="h-16 w-16 text-text-light mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-text-main mb-2">Aucun rapport</h3>
              <p className="text-sm text-text-muted max-w-md mx-auto mb-6">
                Générez des rapports PDF détaillés de 8 pages avec composition, allocations,
                métriques de risque, scénarios et stress tests.
              </p>
              <Link href="/reports/new">
                <Button icon={<Plus className="h-4 w-4" />}>Créer un rapport</Button>
              </Link>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-text-muted">
                      <th className="text-left py-3 px-4 font-semibold">Titre</th>
                      <th className="text-left py-3 px-4 font-semibold">Client</th>
                      <th className="text-left py-3 px-4 font-semibold">Portefeuille</th>
                      <th className="text-left py-3 px-4 font-semibold">Date</th>
                      <th className="text-center py-3 px-4 font-semibold">Statut</th>
                      <th className="text-right py-3 px-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((report) => {
                      const status = statusMap[report.status] || statusMap.draft;
                      return (
                        <tr key={report.id} className="border-b border-gray-50 hover:bg-bg-light/50">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-text-muted flex-shrink-0" />
                              <span className="font-semibold text-text-main">{report.title}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-text-muted">{report.client_name}</td>
                          <td className="py-3 px-4 text-text-muted">{report.portfolio_name}</td>
                          <td className="py-3 px-4 text-text-muted">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {formatDate(report.generated_at || report.created_at)}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownload(report)}
                                icon={<Download className="h-3.5 w-3.5" />}
                              >
                                Télécharger
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteTarget(report)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                icon={<Trash2 className="h-3.5 w-3.5" />}
                              >
                                Supprimer
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Tab: Prêt à coller */}
      {activeTab === 'paste' && <PretAColler />}

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Supprimer le rapport" size="sm">
        <p className="text-sm text-text-muted mb-6">
          Êtes-vous sûr de vouloir supprimer le rapport <strong>{deleteTarget?.title}</strong> ?
          Cette action est irréversible.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Annuler</Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>Supprimer</Button>
        </div>
      </Modal>
    </div>
  );
}
