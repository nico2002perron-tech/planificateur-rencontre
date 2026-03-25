'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import {
  Upload,
  Download,
  Trash2,
  Search,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
} from 'lucide-react';

interface FundDocument {
  id: string;
  fund_code: string;
  fund_name: string;
  file_name: string;
  file_size: number;
  created_at: string;
  updated_at: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('fr-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(dateStr));
}

function getFreshness(updatedAt: string): { label: string; variant: 'success' | 'warning' | 'danger'; icon: typeof CheckCircle2 } {
  const now = Date.now();
  const updated = new Date(updatedAt).getTime();
  const monthsDiff = (now - updated) / (1000 * 60 * 60 * 24 * 30);

  if (monthsDiff < 6) return { label: 'À jour', variant: 'success', icon: CheckCircle2 };
  if (monthsDiff < 12) return { label: 'Mise à jour suggérée', variant: 'warning', icon: Clock };
  return { label: 'Périmé', variant: 'danger', icon: AlertCircle };
}

export default function FundReportsPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<FundDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Manual code modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [manualName, setManualName] = useState('');

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<FundDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch('/api/fund-reports');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDocuments(data);
    } catch {
      toast('error', 'Erreur lors du chargement des documents');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  async function uploadFile(file: File, fundCode?: string, fundName?: string) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (fundCode) formData.append('fund_code', fundCode);
      if (fundName) formData.append('fund_name', fundName);

      const res = await fetch('/api/fund-reports', { method: 'POST', body: formData });
      const data = await res.json();

      if (res.status === 422 && data.needsManualCode) {
        // AI couldn't detect the code — ask user
        setPendingFile(file);
        setShowManualModal(true);
        return;
      }

      if (!res.ok) throw new Error(data.error || 'Erreur');

      toast('success', data.message || `Fonds ${data.fund_code} ajouté`);
      if (data.detected) {
        toast('info', `Code détecté automatiquement : ${data.fund_code}`);
      }
      fetchDocuments();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Erreur lors de l\'upload');
    } finally {
      setUploading(false);
    }
  }

  function handleFileSelect(files: FileList | null) {
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type === 'application/pdf') {
        uploadFile(file);
      } else {
        toast('warning', `${file.name} n'est pas un fichier PDF`);
      }
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  }

  async function handleManualSubmit() {
    if (!pendingFile || !manualCode.trim()) return;
    setShowManualModal(false);
    await uploadFile(pendingFile, manualCode.trim(), manualName.trim());
    setPendingFile(null);
    setManualCode('');
    setManualName('');
  }

  async function handleDownload(doc: FundDocument) {
    try {
      const res = await fetch(`/api/fund-reports/${doc.id}/download`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${doc.fund_code}_${doc.file_name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      toast('error', 'Erreur lors du téléchargement');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/fund-reports/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast('success', `Fonds ${deleteTarget.fund_code} supprimé`);
      fetchDocuments();
    } catch {
      toast('error', 'Erreur lors de la suppression');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  async function handleUpdate(doc: FundDocument) {
    fileInputRef.current?.click();
    // Store reference to know which fund we're updating
    const handler = (e: Event) => {
      const input = e.target as HTMLInputElement;
      if (input.files?.[0]) {
        uploadFile(input.files[0], doc.fund_code, doc.fund_name);
      }
      fileInputRef.current?.removeEventListener('change', handler);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    fileInputRef.current?.addEventListener('change', handler);
  }

  const filtered = documents.filter((doc) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      doc.fund_code.toLowerCase().includes(q) ||
      doc.fund_name.toLowerCase().includes(q) ||
      doc.file_name.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <PageHeader
        title="Rapports de fonds"
        description="Bibliothèque des fiches de fonds (Fund Facts) — uploadez une fois, réutilisez pour tous les clients"
        action={
          <Button
            icon={<Upload className="h-4 w-4" />}
            onClick={() => fileInputRef.current?.click()}
            loading={uploading}
          >
            Uploader un fonds
          </Button>
        }
      />

      {/* Hidden file input for uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFileSelect(e.target.files);
          e.target.value = '';
        }}
      />

      {/* Upload drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`
          mb-6 border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200
          ${dragOver
            ? 'border-brand-primary bg-brand-primary/5 scale-[1.01]'
            : 'border-gray-200 hover:border-brand-primary/50 hover:bg-gray-50'}
          ${uploading ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Spinner size="lg" />
            <p className="text-sm text-text-muted">Upload et détection IA en cours...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-brand-primary/10 flex items-center justify-center">
              <Upload className="h-7 w-7 text-brand-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-main">
                Glissez-déposez vos PDFs de fonds ici
              </p>
              <p className="text-xs text-text-muted mt-1">
                L&apos;IA détecte automatiquement le code du fonds (RBF658, TDB900, etc.)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Search bar */}
      {documents.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder="Rechercher par code, nom ou fichier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
          />
        </div>
      )}

      {/* Fund documents list */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : documents.length === 0 ? (
        <Card className="text-center py-16">
          <FileText className="h-16 w-16 text-text-light mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-text-main mb-2">Aucun rapport de fonds</h3>
          <p className="text-sm text-text-muted max-w-md mx-auto mb-6">
            Uploadez les fiches de fonds (Fund Facts) de vos manufacturiers.
            Elles seront annexées automatiquement aux rapports clients.
          </p>
          <Button
            icon={<Upload className="h-4 w-4" />}
            onClick={() => fileInputRef.current?.click()}
          >
            Uploader votre premier fonds
          </Button>
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-text-muted">
                  <th className="text-left py-3 px-4 font-semibold">Code</th>
                  <th className="text-left py-3 px-4 font-semibold">Nom du fonds</th>
                  <th className="text-left py-3 px-4 font-semibold">Fichier</th>
                  <th className="text-left py-3 px-4 font-semibold">Taille</th>
                  <th className="text-left py-3 px-4 font-semibold">Dernière mise à jour</th>
                  <th className="text-center py-3 px-4 font-semibold">Fraîcheur</th>
                  <th className="text-right py-3 px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc) => {
                  const freshness = getFreshness(doc.updated_at);
                  const FreshnessIcon = freshness.icon;
                  return (
                    <tr key={doc.id} className="border-b border-gray-50 hover:bg-bg-light/50 group">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-brand-primary">{doc.fund_code}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-text-main">{doc.fund_name}</span>
                      </td>
                      <td className="py-3 px-4 text-text-muted">
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate max-w-[200px]">{doc.file_name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-text-muted">{formatFileSize(doc.file_size)}</td>
                      <td className="py-3 px-4 text-text-muted">{formatDate(doc.updated_at)}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={freshness.variant}>
                          <FreshnessIcon className="h-3 w-3 mr-1" />
                          {freshness.label}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(doc)}
                            title="Télécharger"
                            icon={<Download className="h-3.5 w-3.5" />}
                          >
                            PDF
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdate(doc)}
                            title="Mettre à jour"
                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            icon={<RefreshCw className="h-3.5 w-3.5" />}
                          >
                            M.à.j
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(doc)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            icon={<Trash2 className="h-3.5 w-3.5" />}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-text-muted">
                      Aucun fonds ne correspond à « {searchQuery} »
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Summary footer */}
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between text-xs text-text-muted">
            <span>{documents.length} fonds dans la bibliothèque</span>
            <span>
              {documents.filter((d) => getFreshness(d.updated_at).variant === 'danger').length > 0 && (
                <span className="text-red-500 font-medium">
                  {documents.filter((d) => getFreshness(d.updated_at).variant === 'danger').length} fonds périmés
                </span>
              )}
            </span>
          </div>
        </Card>
      )}

      {/* Manual code input modal */}
      <Modal open={showManualModal} onClose={() => { setShowManualModal(false); setPendingFile(null); }} title="Code du fonds non détecté" size="sm">
        <p className="text-sm text-text-muted mb-4">
          L&apos;IA n&apos;a pas pu détecter le code du fonds depuis le nom du fichier
          {pendingFile && <strong> « {pendingFile.name} »</strong>}.
          Veuillez le saisir manuellement.
        </p>
        <div className="space-y-3 mb-6">
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Code FundSERV *</label>
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              placeholder="Ex: RBF658, TDB900"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary font-mono"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Nom du fonds</label>
            <input
              type="text"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="Ex: RBC Fonds canadien de dividendes"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => { setShowManualModal(false); setPendingFile(null); }}>
            Annuler
          </Button>
          <Button onClick={handleManualSubmit} disabled={!manualCode.trim()}>
            Confirmer
          </Button>
        </div>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Supprimer le rapport de fonds" size="sm">
        <p className="text-sm text-text-muted mb-6">
          Êtes-vous sûr de vouloir supprimer le rapport du fonds{' '}
          <strong className="font-mono text-brand-primary">{deleteTarget?.fund_code}</strong> ?
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
