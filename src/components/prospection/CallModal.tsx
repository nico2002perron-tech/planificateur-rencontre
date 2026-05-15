'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { Lead } from '@/lib/prospection/types';
import { Phone, Sparkles, Save } from 'lucide-react';

interface CallModalProps {
  open: boolean;
  onClose: () => void;
  lead: Lead | null;
  onSave: (data: {
    type: string;
    outcome: string;
    notes: string;
    ai_summary?: string;
    next_action?: string;
    next_action_date?: string;
    new_status?: string;
  }) => void;
}

export function CallModal({ open, onClose, lead, onSave }: CallModalProps) {
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [script, setScript] = useState('');
  const [loadingScript, setLoadingScript] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [aiSummary, setAiSummary] = useState('');

  if (!lead) return null;

  async function generateScript() {
    setLoadingScript(true);
    try {
      const res = await fetch('/api/prospection/ai/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead }),
      });
      const data = await res.json();
      setScript(data.script || 'Erreur de génération');
    } catch {
      setScript('Erreur de connexion');
    }
    setLoadingScript(false);
  }

  async function summarizeNotes() {
    if (!notes.trim()) return;
    setLoadingSummary(true);
    try {
      const res = await fetch('/api/prospection/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, lead_name: lead?.name, profession: lead?.profession }),
      });
      const data = await res.json();
      setAiSummary(data.summary || '');
    } catch {
      setAiSummary('Erreur');
    }
    setLoadingSummary(false);
  }

  function handleSave() {
    onSave({
      type: 'call',
      outcome,
      notes,
      ai_summary: aiSummary || undefined,
      next_action: nextAction || undefined,
      next_action_date: nextDate || undefined,
      new_status: newStatus || undefined,
    });
    // Reset
    setNotes('');
    setOutcome('');
    setNextAction('');
    setNextDate('');
    setNewStatus('');
    setScript('');
    setAiSummary('');
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={`Appel — ${lead.name}`} size="lg">
      <div className="space-y-4">
        {/* Phone display */}
        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
          <Phone className="h-5 w-5 text-blue-600" />
          <span className="font-mono text-lg font-semibold text-blue-800">
            {formatPhone(lead.phone)}
          </span>
          <span className="text-sm text-blue-600">{lead.profession} — {lead.city}</span>
        </div>

        {/* Script generation */}
        <div>
          <Button size="sm" variant="outline" icon={<Sparkles className="h-4 w-4" />} loading={loadingScript} onClick={generateScript}>
            Générer un script d&apos;appel
          </Button>
          {script && (
            <div className="mt-2 p-3 bg-amber-50 rounded-lg text-sm whitespace-pre-wrap border border-amber-200">
              {script}
            </div>
          )}
        </div>

        {/* Outcome */}
        <div>
          <label className="block text-sm font-medium text-text-main mb-1">Résultat de l&apos;appel</label>
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
          >
            <option value="">Sélectionner...</option>
            <option value="interested">Intéressé</option>
            <option value="callback">Rappeler plus tard</option>
            <option value="not_interested">Pas intéressé</option>
            <option value="no_answer">Pas de réponse</option>
            <option value="voicemail">Boîte vocale</option>
            <option value="meeting_booked">Rendez-vous pris</option>
            <option value="wrong_number">Mauvais numéro</option>
          </select>
        </div>

        {/* Status change */}
        <div>
          <label className="block text-sm font-medium text-text-main mb-1">Changer le statut</label>
          <select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
          >
            <option value="">Ne pas changer</option>
            <option value="contacted">Contacté</option>
            <option value="qualified">Qualifié</option>
            <option value="meeting">Rendez-vous</option>
            <option value="client">Client</option>
            <option value="lost">Perdu</option>
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-text-main mb-1">Notes d&apos;appel</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes prises pendant l'appel..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary resize-none"
          />
          {notes.trim() && (
            <Button size="sm" variant="ghost" className="mt-1" icon={<Sparkles className="h-3.5 w-3.5" />} loading={loadingSummary} onClick={summarizeNotes}>
              Résumer avec IA
            </Button>
          )}
          {aiSummary && (
            <div className="mt-2 p-3 bg-purple-50 rounded-lg text-sm whitespace-pre-wrap border border-purple-200">
              {aiSummary}
            </div>
          )}
        </div>

        {/* Next action */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Prochaine action</label>
            <input
              type="text"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="ex: Rappeler, Envoyer doc..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Date de rappel</label>
            <input
              type="date"
              value={nextDate}
              onChange={(e) => setNextDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" icon={<Save className="h-4 w-4" />} onClick={handleSave}>
            Enregistrer
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === '1') return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return phone;
}
