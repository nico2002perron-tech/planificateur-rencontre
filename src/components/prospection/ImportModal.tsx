'use client';

import { useState, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Upload, FileSpreadsheet, AlertTriangle } from 'lucide-react';

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportModal({ open, onClose, onSuccess }: ImportModalProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ inserted: number; duplicates: number; skipped: number } | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setLoading(true);
    setError('');
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/prospection/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erreur d\'import');
      } else {
        setResult(data);
        onSuccess();
      }
    } catch {
      setError('Erreur de connexion');
    }
    setLoading(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="Importer des leads" size="md">
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
          <p className="font-medium mb-1">Format accepté : CSV ou Excel (.xlsx)</p>
          <p>Le fichier doit contenir au minimum les colonnes :</p>
          <ul className="list-disc ml-4 mt-1 space-y-0.5">
            <li><strong>Nom</strong> (ou Name, Contact)</li>
            <li><strong>Téléphone</strong> (ou Phone, Tel, Cell)</li>
          </ul>
          <p className="mt-1">Colonnes optionnelles : Entreprise, Profession, Ville, Email, Adresse</p>
        </div>

        <div
          className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:border-brand-primary/50 transition-colors cursor-pointer"
          onClick={() => fileRef.current?.click()}
        >
          <FileSpreadsheet className="h-10 w-10 text-text-light mx-auto mb-3" />
          <p className="text-sm text-text-muted">Cliquez pour sélectionner un fichier</p>
          <p className="text-xs text-text-light mt-1">CSV, XLS, XLSX</p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xls,.xlsx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <div className="h-4 w-4 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
            Import en cours...
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}

        {result && (
          <div className="p-3 bg-green-50 rounded-lg text-sm text-green-800">
            <p className="font-medium">Import terminé</p>
            <ul className="mt-1 space-y-0.5">
              <li>{result.inserted} leads ajoutés</li>
              {result.duplicates > 0 && <li>{result.duplicates} doublons ignorés</li>}
              {result.skipped > 0 && <li>{result.skipped} lignes ignorées (données manquantes)</li>}
            </ul>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-gray-100">
          <Button variant="ghost" onClick={onClose}>Fermer</Button>
        </div>
      </div>
    </Modal>
  );
}
