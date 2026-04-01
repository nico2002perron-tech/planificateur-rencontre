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
import {
  FileText, Plus, Download, Trash2, Calendar, ClipboardPaste,
  ArrowLeft, TrendingUp, BarChart3, Target, Sparkles, Shield, BookOpen,
  PieChart, Zap, CheckCircle2,
} from 'lucide-react';

// Duolingo palette
const DUO = {
  green: '#58CC02', greenDark: '#45a300',
  blue: '#1CB0F6', blueDark: '#1899d6',
  purple: '#CE82FF', purpleDark: '#b06edb',
  orange: '#FF9600', orangeDark: '#e08600',
} as const;

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
  const [activeTab, setActiveTab] = useState<Tab | null>(null);

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

  // Hub view (no tab selected yet)
  if (!activeTab) {
    return (
      <div>
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-text-main mb-2">Rapports</h1>
          <p className="text-base text-text-muted max-w-lg mx-auto">
            Choisissez votre outil pour analyser et présenter le portefeuille de votre client.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Card: Rapport PDF complet */}
          <button
            onClick={() => setActiveTab('reports')}
            className="text-left rounded-2xl bg-white p-6 transition-all duration-200 hover:scale-[1.02] active:translate-y-[2px] active:shadow-none group"
            style={{ border: `2px solid ${DUO.purple}30`, borderBottom: `5px solid ${DUO.purpleDark}30` }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110"
              style={{ backgroundColor: `${DUO.purple}15`, boxShadow: `0 3px 0 0 ${DUO.purpleDark}20` }}
            >
              <FileText className="h-7 w-7" style={{ color: DUO.purple }} />
            </div>

            <h2 className="text-xl font-extrabold text-text-main mb-1">Rapport PDF complet</h2>
            <p className="text-sm text-text-muted mb-5">
              Générez un document professionnel de 8-9 pages avec narratif IA, prêt à remettre en rencontre client.
            </p>

            <div className="space-y-2.5 mb-6">
              {[
                { icon: PieChart, text: 'Allocations et répartition sectorielle', color: DUO.purple },
                { icon: BarChart3, text: 'Métriques de risque et rendement', color: DUO.blue },
                { icon: Sparkles, text: 'Narratif IA personnalisé (Groq)', color: DUO.orange },
                { icon: Shield, text: 'Scénarios de stress test', color: DUO.green },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${f.color}15` }}>
                    <f.icon className="h-3.5 w-3.5" style={{ color: f.color }} />
                  </div>
                  <span className="text-xs font-medium text-text-main">{f.text}</span>
                </div>
              ))}
            </div>

            <div
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-extrabold text-sm text-white transition-all"
              style={{ backgroundColor: DUO.purple, boxShadow: `0 3px 0 0 ${DUO.purpleDark}` }}
            >
              Mes rapports
              <span className="text-xs font-bold opacity-70">
                ({reports?.length || 0})
              </span>
            </div>
          </button>

          {/* Card: Prêt à coller */}
          <button
            onClick={() => setActiveTab('paste')}
            className="text-left rounded-2xl bg-white p-6 transition-all duration-200 hover:scale-[1.02] active:translate-y-[2px] active:shadow-none group"
            style={{ border: `2px solid ${DUO.blue}30`, borderBottom: `5px solid ${DUO.blueDark}30` }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110"
              style={{ backgroundColor: `${DUO.blue}15`, boxShadow: `0 3px 0 0 ${DUO.blueDark}20` }}
            >
              <ClipboardPaste className="h-7 w-7" style={{ color: DUO.blue }} />
            </div>

            <h2 className="text-xl font-extrabold text-text-main mb-1">Prêt à coller</h2>
            <p className="text-sm text-text-muted mb-5">
              Collez les positions Croesus d&apos;un client et obtenez instantanément les cours cibles et l&apos;analyse complète.
            </p>

            <div className="space-y-2.5 mb-6">
              {[
                { icon: Zap, text: 'Détection automatique des types d\'actifs', color: DUO.orange },
                { icon: Target, text: 'Cours cibles consensus + estimation 12 mois', color: DUO.blue },
                { icon: Sparkles, text: 'Vérification IA des classifications', color: DUO.purple },
                { icon: BookOpen, text: 'Rapports de fonds intégrés au PDF', color: DUO.green },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${f.color}15` }}>
                    <f.icon className="h-3.5 w-3.5" style={{ color: f.color }} />
                  </div>
                  <span className="text-xs font-medium text-text-main">{f.text}</span>
                </div>
              ))}
            </div>

            <div
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-extrabold text-sm text-white transition-all"
              style={{ backgroundColor: DUO.blue, boxShadow: `0 3px 0 0 ${DUO.blueDark}` }}
            >
              Analyser un portefeuille
            </div>
          </button>
        </div>

        {/* Quick comparison */}
        <div className="mt-8 max-w-4xl mx-auto">
          <div className="grid grid-cols-2 gap-6 text-center">
            <div className="flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-gray-50">
              <CheckCircle2 className="h-4 w-4" style={{ color: DUO.purple }} />
              <span className="text-xs text-text-muted">
                <strong className="text-text-main">Rapport PDF</strong> — À partir d&apos;un portefeuille enregistré
              </span>
            </div>
            <div className="flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-gray-50">
              <CheckCircle2 className="h-4 w-4" style={{ color: DUO.blue }} />
              <span className="text-xs text-text-muted">
                <strong className="text-text-main">Prêt à coller</strong> — Directement depuis Croesus, aucun setup
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Back button + section title */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setActiveTab(null)}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-white transition-all hover:bg-gray-50 active:translate-y-[1px]"
          style={{ border: '2px solid #e5e7eb', borderBottom: '3px solid #d1d5db' }}
        >
          <ArrowLeft className="h-4 w-4 text-text-muted" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold text-text-main">
            {activeTab === 'reports' ? 'Mes rapports' : 'Prêt à coller'}
          </h1>
          <p className="text-xs text-text-muted">
            {activeTab === 'reports'
              ? 'Rapports PDF détaillés avec narratif IA'
              : 'Analyse rapide des cours cibles depuis Croesus'}
          </p>
        </div>

        {/* Tab switcher (compact) */}
        <div className="flex items-center gap-1 bg-gray-100/80 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'reports' ? 'bg-white text-text-main shadow-sm' : 'text-text-muted hover:text-text-main'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            Rapports
          </button>
          <button
            onClick={() => setActiveTab('paste')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'paste' ? 'bg-white text-text-main shadow-sm' : 'text-text-muted hover:text-text-main'
            }`}
          >
            <ClipboardPaste className="h-3.5 w-3.5" />
            Prêt à coller
          </button>
        </div>

        {activeTab === 'reports' && (
          <Link href="/reports/new">
            <button
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-extrabold transition-all active:translate-y-[2px] active:shadow-none hover:brightness-105"
              style={{ backgroundColor: DUO.purple, boxShadow: `0 3px 0 0 ${DUO.purpleDark}` }}
            >
              <Plus className="h-4 w-4" />
              Nouveau
            </button>
          </Link>
        )}
      </div>

      {/* Tab: Mes rapports */}
      {activeTab === 'reports' && (
        <>
          {isLoading ? (
            <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          ) : !reports || reports.length === 0 ? (
            <div className="text-center py-16">
              <div
                className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-5"
                style={{ backgroundColor: `${DUO.purple}12`, boxShadow: `0 4px 0 0 ${DUO.purpleDark}15` }}
              >
                <FileText className="h-10 w-10" style={{ color: DUO.purple }} />
              </div>
              <h3 className="text-lg font-extrabold text-text-main mb-2">Aucun rapport pour l&apos;instant</h3>
              <p className="text-sm text-text-muted max-w-md mx-auto mb-6">
                Créez votre premier rapport PDF de 8 pages : composition, allocations, risque, narratif IA et stress tests.
              </p>
              <Link href="/reports/new">
                <button
                  className="inline-flex items-center gap-2 px-7 py-3 rounded-2xl text-white font-extrabold text-sm transition-all active:translate-y-[2px] active:shadow-none hover:brightness-105"
                  style={{ backgroundColor: DUO.purple, boxShadow: `0 4px 0 0 ${DUO.purpleDark}` }}
                >
                  <Plus className="h-4 w-4" />
                  Créer un rapport
                </button>
              </Link>
            </div>
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
