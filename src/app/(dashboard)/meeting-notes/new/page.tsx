'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { AudioWaveform } from '@/components/meeting-notes/AudioWaveform';
import type { MeetingTransaction } from '@/lib/hooks/useMeetingNotes';
import {
  ArrowLeft, Save, CheckCircle2, Mic, Square,
  Sparkles, User, Calendar, Phone, Monitor, Users as UsersIcon,
  Loader2, Copy, Check, TrendingUp, BarChart3,
  Plus, X, ArrowDownRight, ArrowUpRight, ArrowLeftRight,
  Target, ShieldCheck, PieChart, DollarSign, Clock,
  HeartPulse, Scale, TrendingDown, Repeat, AlertTriangle,
  BookOpen, Landmark, Receipt, Wallet, RefreshCw,
} from 'lucide-react';

// ─── Topic chips (what the advisor covered) ─────────────────────
interface TopicChip {
  id: string;
  label: string;
  icon: typeof Target;
  color: string;
  category: 'profil' | 'portefeuille' | 'placement' | 'admin';
  complianceKeys?: string[]; // maps to compliance questions answered "oui"
}

const TOPIC_CHIPS: TopicChip[] = [
  // Profil client
  { id: 'objectifs', label: 'Objectifs', icon: Target, color: 'bg-blue-50 text-blue-700 border-blue-200 ring-blue-300', category: 'profil', complianceKeys: ['q_objectifs'] },
  { id: 'horizon', label: 'Horizon', icon: Clock, color: 'bg-indigo-50 text-indigo-700 border-indigo-200 ring-indigo-300', category: 'profil', complianceKeys: ['q_horizon'] },
  { id: 'tolerance', label: 'Tolérance au risque', icon: HeartPulse, color: 'bg-rose-50 text-rose-700 border-rose-200 ring-rose-300', category: 'profil', complianceKeys: ['q_tolerance'] },
  { id: 'situation', label: 'Situation financière', icon: Wallet, color: 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-300', category: 'profil', complianceKeys: ['q_situation'] },
  { id: 'liquidite', label: 'Besoins en liquidité', icon: DollarSign, color: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-300', category: 'profil', complianceKeys: ['q_liquidite'] },
  // Portefeuille
  { id: 'repartition', label: 'Répartition d\'actifs', icon: PieChart, color: 'bg-violet-50 text-violet-700 border-violet-200 ring-violet-300', category: 'portefeuille', complianceKeys: ['q_repartition'] },
  { id: 'rendements', label: 'Rendements', icon: TrendingUp, color: 'bg-green-50 text-green-700 border-green-200 ring-green-300', category: 'portefeuille', complianceKeys: ['q_rendements'] },
  { id: 'concentration', label: 'Concentration', icon: AlertTriangle, color: 'bg-orange-50 text-orange-700 border-orange-200 ring-orange-300', category: 'portefeuille', complianceKeys: ['q_concentration'] },
  { id: 'non_conforme', label: 'Placements non conformes', icon: ShieldCheck, color: 'bg-red-50 text-red-700 border-red-200 ring-red-300', category: 'portefeuille', complianceKeys: ['q_non_conforme'] },
  { id: 'frais', label: 'Frais', icon: Receipt, color: 'bg-slate-50 text-slate-700 border-slate-200 ring-slate-300', category: 'admin', complianceKeys: ['q_frais'] },
  { id: 'changements', label: 'Changements de vie', icon: RefreshCw, color: 'bg-teal-50 text-teal-700 border-teal-200 ring-teal-300', category: 'profil', complianceKeys: ['q_changements'] },
  // Placement-specific
  { id: 'recommandation', label: 'Recommandation titre', icon: BookOpen, color: 'bg-cyan-50 text-cyan-700 border-cyan-200 ring-cyan-300', category: 'placement', complianceKeys: ['q_recommande'] },
  { id: 'risques_placement', label: 'Risques expliqués', icon: Scale, color: 'bg-pink-50 text-pink-700 border-pink-200 ring-pink-300', category: 'placement', complianceKeys: ['q_risques', 'q_comprend'] },
  { id: 'conformite_profil', label: 'Conforme au profil', icon: ShieldCheck, color: 'bg-lime-50 text-lime-700 border-lime-200 ring-lime-300', category: 'placement', complianceKeys: ['q_conforme'] },
  { id: 'conflit', label: 'Conflit d\'intérêts', icon: AlertTriangle, color: 'bg-yellow-50 text-yellow-700 border-yellow-200 ring-yellow-300', category: 'placement', complianceKeys: ['q_conflit'] },
];

const CATEGORY_LABELS: Record<string, string> = {
  profil: 'Profil du client',
  portefeuille: 'Portefeuille',
  placement: 'Placement',
  admin: 'Administratif',
};

const MEETING_TYPES = [
  { value: 'phone', label: 'Téléphone', icon: Phone },
  { value: 'in_person', label: 'En personne', icon: UsersIcon },
  { value: 'video', label: 'Vidéo', icon: Monitor },
] as const;

const SUBJECTS = [
  { value: 'revision', label: 'Révision' },
  { value: 'placement', label: 'Placement' },
  { value: 'both', label: 'Rév. + Placement' },
] as const;

const TEMPLATES = [
  { id: 'revision_annuelle', label: 'Révision annuelle', icon: Calendar, color: 'border-blue-200 bg-blue-50 text-blue-700',
    chips: ['objectifs', 'horizon', 'tolerance', 'situation', 'repartition', 'rendements', 'changements'], subject: 'revision' },
  { id: 'nouveau_placement', label: 'Nouveau placement', icon: TrendingUp, color: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    chips: ['recommandation', 'risques_placement', 'conformite_profil'], subject: 'placement' },
  { id: 'suivi_trimestriel', label: 'Suivi trimestriel', icon: BarChart3, color: 'border-purple-200 bg-purple-50 text-purple-700',
    chips: ['rendements', 'repartition', 'objectifs'], subject: 'revision' },
] as const;

const TX_ICONS: Record<string, { icon: typeof ArrowUpRight; color: string; label: string }> = {
  buy: { icon: ArrowUpRight, color: 'text-emerald-600 bg-emerald-50', label: 'Achat' },
  sell: { icon: ArrowDownRight, color: 'text-red-600 bg-red-50', label: 'Vente' },
  switch: { icon: ArrowLeftRight, color: 'text-blue-600 bg-blue-50', label: 'Échange' },
};

// ─── CopyButton ─────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button type="button" onClick={copy} className="p-1.5 rounded-lg hover:bg-white/50 transition-colors" title="Copier">
      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 opacity-60" />}
    </button>
  );
}

// ─── Main Page ──────────────────────────────────────────────────
export default function NewMeetingNotePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Meeting info
  const [clientName, setClientName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingType, setMeetingType] = useState<string>('in_person');
  const [subject, setSubject] = useState<string>('revision');

  // Topics covered (chip selection)
  const [selectedChips, setSelectedChips] = useState<Set<string>>(new Set());

  // Transactions
  const [transactions, setTransactions] = useState<MeetingTransaction[]>([]);

  // Notes
  const [freeNotes, setFreeNotes] = useState('');
  const [nextMeeting, setNextMeeting] = useState('');

  // AI
  const [transcription, setTranscription] = useState('');
  const [aiSummaryAdvisor, setAiSummaryAdvisor] = useState('');
  const [aiSummaryClient, setAiSummaryClient] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ─── Chip logic ───────────────────────────────────────────────
  const toggleChip = (chipId: string) => {
    setSelectedChips((prev) => {
      const next = new Set(prev);
      if (next.has(chipId)) next.delete(chipId); else next.add(chipId);
      return next;
    });
  };

  const applyTemplate = (tpl: typeof TEMPLATES[number]) => {
    setSubject(tpl.subject);
    setSelectedChips(new Set(tpl.chips));
    toast('success', `"${tpl.label}" appliqué`);
  };

  // Derive compliance from selected chips
  const deriveCompliance = (): Record<string, string> => {
    const compliance: Record<string, string> = {};
    for (const chip of TOPIC_CHIPS) {
      if (chip.complianceKeys) {
        for (const key of chip.complianceKeys) {
          compliance[key] = selectedChips.has(chip.id) ? 'oui' : '';
        }
      }
    }
    return compliance;
  };

  // Filter chips by subject relevance
  const getVisibleChips = () => {
    return TOPIC_CHIPS.filter((chip) => {
      if (chip.category === 'placement') return subject === 'placement' || subject === 'both';
      if (chip.category === 'portefeuille') return subject === 'revision' || subject === 'both';
      return true; // profil + admin always visible
    });
  };

  // Coverage indicator
  const visibleChips = getVisibleChips();
  const coveragePct = visibleChips.length ? Math.round((selectedChips.size / visibleChips.length) * 100) : 0;
  const uncoveredImportant = visibleChips
    .filter((c) => !selectedChips.has(c.id) && ['objectifs', 'tolerance', 'repartition', 'recommandation'].includes(c.id))
    .map((c) => c.label);

  // ─── Transactions ─────────────────────────────────────────────
  const addTransaction = () => setTransactions((prev) => [...prev, {
    id: crypto.randomUUID(), type: 'buy', symbol: '', quantity: '', price: '', solicited: true, orderType: 'market',
  }]);
  const updateTransaction = (id: string, patch: Partial<MeetingTransaction>) => setTransactions((prev) => prev.map((t) => t.id === id ? { ...t, ...patch } : t));
  const removeTransaction = (id: string) => setTransactions((prev) => prev.filter((t) => t.id !== id));

  // ─── Recording ────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop()); streamRef.current = null;
        if (timerRef.current) clearInterval(timerRef.current);
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (blob.size < 1000) { toast('warning', 'Enregistrement trop court'); return; }
        setTranscribing(true);
        try {
          const formData = new FormData(); formData.append('file', blob, 'recording.webm');
          const res = await fetch('/api/ai/transcribe', { method: 'POST', body: formData });
          if (res.ok) { const data = await res.json(); setTranscription((prev) => (prev ? prev + '\n\n' : '') + data.text); toast('success', 'Transcription terminée'); }
          else toast('error', 'Erreur de transcription');
        } catch { toast('error', 'Erreur de transcription'); } finally { setTranscribing(false); }
      };
      mediaRecorder.start(1000); mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true); setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch { toast('error', "Impossible d'accéder au microphone"); }
  }, [toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    setIsRecording(false); if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // ─── AI Summary ───────────────────────────────────────────────
  const generateSummary = async () => {
    if (selectedChips.size === 0 && !transcription && !freeNotes) {
      toast('warning', 'Sélectionnez des sujets ou ajoutez des notes');
      return;
    }
    setAiLoading(true);
    try {
      const compliance = deriveCompliance();
      const res = await fetch('/api/ai/meeting-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcription,
          manualNotes: freeNotes,
          complianceAnswers: compliance,
          meetingContext: {
            clientName, meetingType, subject, meetingDate,
            transactions: transactions.length > 0 ? transactions : undefined,
            topicsCovered: Array.from(selectedChips).map((id) => TOPIC_CHIPS.find((c) => c.id === id)?.label).filter(Boolean),
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiSummaryAdvisor(data.advisor_summary || '');
        setAiSummaryClient(data.client_summary || '');
        toast('success', 'Résumés générés');
      } else toast('error', 'Erreur lors de la génération');
    } catch { toast('error', 'Erreur de connexion'); } finally { setAiLoading(false); }
  };

  // ─── Save ─────────────────────────────────────────────────────
  const handleSave = async (status: 'draft' | 'completed') => {
    if (!clientName.trim()) { toast('warning', 'Entrez le nom du client'); return; }
    setSaving(true);
    try {
      const compliance = deriveCompliance();
      const body = {
        client_name: clientName, account_number: accountNumber,
        meeting_date: meetingDate, meeting_time: meetingTime,
        meeting_type: meetingType, subject, compliance,
        transaction: transactions.length > 0 ? transactions : null,
        notes: { topics: Array.from(selectedChips).map((id) => TOPIC_CHIPS.find((c) => c.id === id)?.label).filter(Boolean).join(', '), decisions: '', followups: freeNotes, nextMeeting },
        transcription: transcription || null,
        ai_summary_advisor: aiSummaryAdvisor || null,
        ai_summary_client: aiSummaryClient || null,
        status,
      };
      const res = await fetch('/api/meeting-notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) { toast('success', status === 'completed' ? 'Note complétée' : 'Brouillon sauvegardé'); router.push('/meeting-notes'); }
      else toast('error', 'Erreur lors de la sauvegarde');
    } catch { toast('error', 'Erreur de connexion'); } finally { setSaving(false); }
  };

  // ─── Render ───────────────────────────────────────────────────
  const categories = subject === 'placement' || subject === 'both'
    ? ['profil', 'portefeuille', 'placement', 'admin'] as const
    : ['profil', 'portefeuille', 'admin'] as const;

  return (
    <div className="max-w-3xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-main font-[family-name:var(--font-heading)]">Nouvelle rencontre</h1>
          <p className="text-sm text-text-muted">Documentez votre rencontre en quelques taps</p>
        </div>
        <Button variant="ghost" onClick={() => router.push('/meeting-notes')}>
          <ArrowLeft className="h-4 w-4 mr-2" />Retour
        </Button>
      </div>

      {/* ─── Section 1: Quick setup ──────────────────────────────── */}
      <Card className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <Input label="Client" placeholder="Nom du client" value={clientName} onChange={(e) => setClientName(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date" type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
            <Input label="Heure" type="time" value={meetingTime} onChange={(e) => setMeetingTime(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {MEETING_TYPES.map((mt) => {
            const Icon = mt.icon;
            return (
              <button key={mt.value} type="button" onClick={() => setMeetingType(mt.value)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                  meetingType === mt.value ? 'border-brand-primary bg-brand-primary/5 text-brand-primary' : 'border-gray-200 text-text-muted hover:border-gray-300'
                }`}>
                <Icon className="h-3.5 w-3.5" />{mt.label}
              </button>
            );
          })}
          <div className="w-px bg-gray-200 mx-1" />
          {SUBJECTS.map((s) => (
            <button key={s.value} type="button" onClick={() => setSubject(s.value)}
              className={`px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                subject === s.value ? 'border-brand-primary bg-brand-primary/5 text-brand-primary' : 'border-gray-200 text-text-muted hover:border-gray-300'
              }`}>
              {s.label}
            </button>
          ))}
        </div>
      </Card>

      {/* ─── Templates ───────────────────────────────────────────── */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        <span className="text-xs text-text-muted self-center mr-1 whitespace-nowrap">Rapide:</span>
        {TEMPLATES.map((tpl) => {
          const Icon = tpl.icon;
          return (
            <button key={tpl.id} type="button" onClick={() => applyTemplate(tpl)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap transition-all hover:scale-105 ${tpl.color}`}>
              <Icon className="h-3.5 w-3.5" />{tpl.label}
            </button>
          );
        })}
      </div>

      {/* ─── Section 2: Topics covered (chips) ───────────────────── */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-text-main font-[family-name:var(--font-heading)]">
            Qu&apos;avez-vous couvert?
          </h2>
          {/* Coverage ring */}
          <div className="flex items-center gap-2">
            <div className="relative w-9 h-9">
              <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                <circle cx="18" cy="18" r="15" fill="none"
                  stroke={coveragePct >= 70 ? '#10b981' : coveragePct >= 40 ? '#00b4d8' : '#f59e0b'}
                  strokeWidth="3" strokeDasharray={`${coveragePct * 0.94} 100`}
                  strokeLinecap="round" className="transition-all duration-500" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-text-main">
                {selectedChips.size}
              </span>
            </div>
          </div>
        </div>

        {categories.filter((cat) => visibleChips.some((c) => c.category === cat)).map((cat) => (
          <div key={cat} className="mb-3">
            <p className="text-xs text-text-muted font-medium mb-1.5 uppercase tracking-wide">{CATEGORY_LABELS[cat]}</p>
            <div className="flex flex-wrap gap-2">
              {visibleChips.filter((c) => c.category === cat).map((chip) => {
                const Icon = chip.icon;
                const selected = selectedChips.has(chip.id);
                return (
                  <button key={chip.id} type="button" onClick={() => toggleChip(chip.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all duration-200 ${
                      selected
                        ? `${chip.color} border-current ring-2 ring-current/20 shadow-sm scale-[1.02]`
                        : 'border-gray-200 text-text-muted bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}>
                    <Icon className="h-4 w-4" />
                    {chip.label}
                    {selected && <CheckCircle2 className="h-3.5 w-3.5 ml-0.5 opacity-70" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Subtle coverage hint */}
        {uncoveredImportant.length > 0 && selectedChips.size > 0 && (
          <p className="text-xs text-text-muted mt-2 italic">
            Pas encore mentionné: {uncoveredImportant.join(', ')}
          </p>
        )}
      </div>

      {/* ─── Section 3: Transactions (if placement) ──────────────── */}
      {(subject === 'placement' || subject === 'both') && (
        <Card className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-text-main font-[family-name:var(--font-heading)]">
              Changements au portefeuille
            </h2>
            <Button variant="ghost" size="sm" onClick={addTransaction}><Plus className="h-3.5 w-3.5 mr-1" />Ajouter</Button>
          </div>

          {transactions.length === 0 ? (
            <button type="button" onClick={addTransaction}
              className="w-full py-6 border-2 border-dashed border-gray-200 rounded-xl text-sm text-text-muted hover:border-brand-primary hover:text-brand-primary transition-all">
              <Plus className="h-5 w-5 mx-auto mb-1" />
              Ajouter une transaction
            </button>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => {
                const txStyle = TX_ICONS[tx.type] || TX_ICONS.buy;
                return (
                  <div key={tx.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="flex gap-0.5 bg-white rounded-lg p-0.5 border border-gray-200">
                      {(['buy', 'sell', 'switch'] as const).map((t) => {
                        const s = TX_ICONS[t]; const Icon = s.icon;
                        return (<button key={t} type="button" onClick={() => updateTransaction(tx.id, { type: t })}
                          className={`p-1.5 rounded-md transition-all ${tx.type === t ? s.color : 'text-gray-400 hover:text-gray-600'}`} title={s.label}>
                          <Icon className="h-4 w-4" /></button>);
                      })}
                    </div>
                    <input className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm font-medium bg-white focus:border-brand-primary focus:outline-none uppercase"
                      placeholder="Symbole" value={tx.symbol} onChange={(e) => updateTransaction(tx.id, { symbol: e.target.value.toUpperCase() })} />
                    <input className="w-20 px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm bg-white focus:border-brand-primary focus:outline-none"
                      type="number" placeholder="Qté" value={tx.quantity} onChange={(e) => updateTransaction(tx.id, { quantity: e.target.value })} />
                    <input className="w-24 px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm bg-white focus:border-brand-primary focus:outline-none"
                      type="number" step="0.01" placeholder="Prix $" value={tx.price} onChange={(e) => updateTransaction(tx.id, { price: e.target.value })} />
                    <button type="button" onClick={() => removeTransaction(tx.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-text-muted hover:text-red-500 transition-colors">
                      <X className="h-4 w-4" /></button>
                  </div>
                );
              })}
              {/* Visual recap */}
              {transactions.some((t) => t.symbol) && (
                <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-gray-50 to-white border border-gray-100">
                  <p className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wide">Résumé</p>
                  <div className="space-y-1.5">
                    {transactions.filter((t) => t.symbol).map((tx) => {
                      const s = TX_ICONS[tx.type]; const TxIcon = s.icon;
                      const val = tx.quantity && tx.price ? parseFloat(tx.quantity) * parseFloat(tx.price) : null;
                      return (
                        <div key={tx.id} className="flex items-center gap-2 text-sm">
                          <TxIcon className={`h-4 w-4 ${s.color.split(' ')[0]}`} />
                          <span className={`font-bold ${tx.type === 'sell' ? 'text-red-700' : tx.type === 'buy' ? 'text-emerald-700' : 'text-blue-700'}`}>
                            {tx.type === 'buy' ? 'Achat' : tx.type === 'sell' ? 'Vente' : 'Échange'}
                          </span>
                          <span className="font-semibold text-text-main">{tx.symbol}</span>
                          {tx.quantity && <span className="text-text-muted">× {tx.quantity}</span>}
                          {val && <span className="ml-auto font-semibold text-text-main">{val.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* ─── Section 4: Audio + Notes ────────────────────────────── */}
      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-text-main font-[family-name:var(--font-heading)]">
            Notes & Enregistrement
          </h2>
          <span className="text-xs text-text-muted">Optionnel</span>
        </div>

        {/* Recording */}
        <div className="flex items-center gap-4 mb-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
          {!isRecording ? (
            <button type="button" onClick={startRecording} disabled={transcribing}
              className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white flex items-center justify-center shadow-md shadow-red-200 hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 flex-shrink-0">
              {transcribing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="h-5 w-5" />}
            </button>
          ) : (
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
              <button type="button" onClick={stopRecording}
                className="relative w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white flex items-center justify-center shadow-md">
                <Square className="h-5 w-5" />
              </button>
            </div>
          )}
          <div className="flex-1 min-w-0">
            {isRecording ? (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-sm font-bold text-text-main font-mono">{formatTime(recordingTime)}</span>
                  <span className="text-xs text-red-500">Enregistrement...</span>
                </div>
                <AudioWaveform stream={streamRef.current} isRecording={isRecording} />
              </div>
            ) : transcribing ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-brand-primary" />
                <span className="text-sm text-text-muted">Transcription en cours...</span>
              </div>
            ) : (
              <div>
                <p className="text-sm text-text-main font-medium">Enregistrer la rencontre</p>
                <p className="text-xs text-text-muted">Le résumé IA fonctionne aussi sans audio</p>
              </div>
            )}
          </div>
        </div>

        {/* Transcription */}
        {transcription && (
          <div className="mb-4">
            <label className="block text-xs font-semibold text-text-main mb-1">Transcription</label>
            <textarea className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-text-main focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none resize-none"
              rows={3} value={transcription} onChange={(e) => setTranscription(e.target.value)} />
          </div>
        )}

        {/* Free notes */}
        <textarea
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-text-main placeholder:text-text-light focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none resize-none"
          rows={3}
          placeholder="Notes libres, points importants, suivis à faire..."
          value={freeNotes}
          onChange={(e) => setFreeNotes(e.target.value)}
        />

        <div className="mt-3">
          <Input label="Prochaine rencontre" type="date" value={nextMeeting} onChange={(e) => setNextMeeting(e.target.value)} />
        </div>
      </Card>

      {/* ─── Section 5: AI Summaries ─────────────────────────────── */}
      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-100 to-amber-100 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-main font-[family-name:var(--font-heading)]">Résumés IA</h2>
              <p className="text-[11px] text-text-muted">Croesus + récapitulatif client</p>
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={generateSummary} loading={aiLoading}>
            <Sparkles className="h-3.5 w-3.5 mr-1" />{aiSummaryAdvisor ? 'Regénérer' : 'Générer'}
          </Button>
        </div>

        {!aiSummaryAdvisor && !aiSummaryClient && !aiLoading && (
          <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
            <Sparkles className="h-10 w-10 mx-auto mb-2 text-purple-200" />
            <p className="text-sm text-text-muted font-medium">Sélectionnez vos sujets puis cliquez Générer</p>
            <p className="text-xs text-text-muted mt-1">L'IA crée vos notes Croesus et le récap client automatiquement</p>
          </div>
        )}

        {aiSummaryAdvisor && (
          <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-100 mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-blue-800 uppercase tracking-wide">Notes Croesus</span>
              <CopyButton text={aiSummaryAdvisor} />
            </div>
            <textarea className="w-full bg-transparent text-sm text-blue-900 resize-none border-0 focus:ring-0 focus:outline-none leading-relaxed"
              rows={6} value={aiSummaryAdvisor} onChange={(e) => setAiSummaryAdvisor(e.target.value)} />
          </div>
        )}

        {aiSummaryClient && (
          <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Récapitulatif client</span>
              <CopyButton text={aiSummaryClient} />
            </div>
            <textarea className="w-full bg-transparent text-sm text-emerald-900 resize-none border-0 focus:ring-0 focus:outline-none leading-relaxed"
              rows={6} value={aiSummaryClient} onChange={(e) => setAiSummaryClient(e.target.value)} />
          </div>
        )}
      </Card>

      {/* ─── Sticky save bar ─────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 sm:sticky sm:bottom-4 bg-white/95 backdrop-blur-sm border-t sm:border sm:rounded-xl shadow-lg px-4 py-3 flex items-center justify-between z-30">
        <div className="hidden sm:flex items-center gap-2">
          {selectedChips.size > 0 && (
            <span className="text-xs text-text-muted">{selectedChips.size} sujets couverts</span>
          )}
          {transactions.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{transactions.length} transaction{transactions.length > 1 ? 's' : ''}</span>
          )}
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <Button variant="outline" onClick={() => handleSave('draft')} loading={saving}>
            <Save className="h-4 w-4 mr-2" />Brouillon
          </Button>
          <Button variant="primary" onClick={() => handleSave('completed')} loading={saving} disabled={!clientName.trim()}>
            <CheckCircle2 className="h-4 w-4 mr-2" />Compléter
          </Button>
        </div>
      </div>
    </div>
  );
}
