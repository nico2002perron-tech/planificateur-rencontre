'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { AudioWaveform } from '@/components/meeting-notes/AudioWaveform';
import type { MeetingTransaction } from '@/lib/hooks/useMeetingNotes';
import {
  ArrowLeft, Save, CheckCircle2, Mic, Square,
  Sparkles, User, Phone, Monitor, Users as UsersIcon,
  Loader2, Copy, Check, TrendingUp, BarChart3,
  Plus, X, ArrowDownRight, ArrowUpRight, ArrowLeftRight,
  Target, ShieldCheck, PieChart, DollarSign, Clock,
  HeartPulse, Scale, AlertTriangle,
  Lightbulb, Receipt, Wallet, RefreshCw,
  MessageCircle, UserCircle, Briefcase, FileCheck,
  Zap, PlayCircle, ClipboardCheck, Eye, PenLine,
  Calendar, Trophy,
} from 'lucide-react';

// ─── Phase type ─────────────────────────────────────────────────
type Phase = 'prepare' | 'meeting' | 'review';

// ─── Topic data ─────────────────────────────────────────────────
interface TopicItem {
  id: string;
  label: string;
  shortLabel: string; // for live mode
  icon: typeof Target;
  gradient: string;
  iconColor: string;
  category: 'profil' | 'portefeuille' | 'placement' | 'admin';
  complianceKeys: string[];
  reminder: string; // short reminder for prep phase
}

const TOPICS: TopicItem[] = [
  { id: 'objectifs', label: 'Objectifs de placement', shortLabel: 'Objectifs', icon: Target, gradient: 'from-blue-500 to-blue-600', iconColor: 'text-blue-600', category: 'profil', complianceKeys: ['q_objectifs'], reminder: 'Valider les buts financiers' },
  { id: 'horizon', label: 'Horizon de placement', shortLabel: 'Horizon', icon: Clock, gradient: 'from-indigo-500 to-indigo-600', iconColor: 'text-indigo-600', category: 'profil', complianceKeys: ['q_horizon'], reminder: 'Revalider le timeframe' },
  { id: 'tolerance', label: 'Tolérance au risque', shortLabel: 'Risque', icon: HeartPulse, gradient: 'from-rose-500 to-rose-600', iconColor: 'text-rose-600', category: 'profil', complianceKeys: ['q_tolerance'], reminder: 'Vérifier le confort' },
  { id: 'situation', label: 'Situation financière', shortLabel: 'Situation', icon: Wallet, gradient: 'from-amber-500 to-amber-600', iconColor: 'text-amber-600', category: 'profil', complianceKeys: ['q_situation'], reminder: 'Revenus, dettes, changements' },
  { id: 'liquidite', label: 'Besoins en liquidité', shortLabel: 'Liquidité', icon: DollarSign, gradient: 'from-emerald-500 to-emerald-600', iconColor: 'text-emerald-600', category: 'profil', complianceKeys: ['q_liquidite'], reminder: 'Retraits à venir?' },
  { id: 'changements', label: 'Changements de vie', shortLabel: 'Vie', icon: RefreshCw, gradient: 'from-teal-500 to-teal-600', iconColor: 'text-teal-600', category: 'profil', complianceKeys: ['q_changements'], reminder: 'Mariage, retraite, emploi?' },
  { id: 'repartition', label: 'Répartition d\'actifs', shortLabel: 'Répartition', icon: PieChart, gradient: 'from-violet-500 to-violet-600', iconColor: 'text-violet-600', category: 'portefeuille', complianceKeys: ['q_repartition'], reminder: 'Revoir allocation vs cible' },
  { id: 'rendements', label: 'Rendements', shortLabel: 'Rendements', icon: TrendingUp, gradient: 'from-green-500 to-green-600', iconColor: 'text-green-600', category: 'portefeuille', complianceKeys: ['q_rendements'], reminder: 'Présenter la performance' },
  { id: 'concentration', label: 'Concentration', shortLabel: 'Concentration', icon: AlertTriangle, gradient: 'from-orange-500 to-orange-600', iconColor: 'text-orange-600', category: 'portefeuille', complianceKeys: ['q_concentration'], reminder: 'Titre > 10%? Secteur?' },
  { id: 'non_conforme', label: 'Conformité des titres', shortLabel: 'Conformité', icon: ShieldCheck, gradient: 'from-red-500 to-red-600', iconColor: 'text-red-600', category: 'portefeuille', complianceKeys: ['q_non_conforme'], reminder: 'Titres hors politique?' },
  { id: 'frais', label: 'Frais', shortLabel: 'Frais', icon: Receipt, gradient: 'from-slate-500 to-slate-600', iconColor: 'text-slate-600', category: 'admin', complianceKeys: ['q_frais'], reminder: 'Mentionner si demandé' },
  { id: 'recommandation', label: 'Recommandation', shortLabel: 'Reco', icon: Lightbulb, gradient: 'from-cyan-500 to-cyan-600', iconColor: 'text-cyan-600', category: 'placement', complianceKeys: ['q_recommande'], reminder: 'Présenter le titre recommandé' },
  { id: 'risques_placement', label: 'Risques expliqués', shortLabel: 'Risques', icon: Scale, gradient: 'from-pink-500 to-pink-600', iconColor: 'text-pink-600', category: 'placement', complianceKeys: ['q_risques', 'q_comprend'], reminder: 'Informer des risques' },
  { id: 'conformite_profil', label: 'Conforme au profil', shortLabel: 'Profil OK', icon: FileCheck, gradient: 'from-lime-500 to-lime-600', iconColor: 'text-lime-600', category: 'placement', complianceKeys: ['q_conforme'], reminder: 'Confirmer compatibilité' },
  { id: 'conflit', label: 'Conflit d\'intérêts', shortLabel: 'Conflit', icon: AlertTriangle, gradient: 'from-yellow-500 to-yellow-600', iconColor: 'text-yellow-600', category: 'placement', complianceKeys: ['q_conflit'], reminder: 'Signaler si applicable' },
];

const MEETING_TYPES = [
  { value: 'phone', label: 'Téléphone', icon: Phone },
  { value: 'in_person', label: 'En personne', icon: UsersIcon },
  { value: 'video', label: 'Vidéo', icon: Monitor },
] as const;

const SUBJECTS = [
  { value: 'revision', label: 'Révision' },
  { value: 'placement', label: 'Placement' },
  { value: 'both', label: 'Les deux' },
] as const;

const TX_ICONS: Record<string, { icon: typeof ArrowUpRight; color: string; bgColor: string; label: string }> = {
  buy: { icon: ArrowUpRight, color: 'text-emerald-600', bgColor: 'bg-emerald-100', label: 'Achat' },
  sell: { icon: ArrowDownRight, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Vente' },
  switch: { icon: ArrowLeftRight, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Échange' },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button type="button" onClick={copy} className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-semibold transition-all flex items-center gap-1.5">
      {copied ? <><Check className="h-3.5 w-3.5 text-emerald-400" /><span className="text-emerald-300">Copié!</span></> : <><Copy className="h-3.5 w-3.5 text-white/70" /><span className="text-white/70">Copier</span></>}
    </button>
  );
}

// ─── Main ───────────────────────────────────────────────────────
export default function NewMeetingNotePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Phase
  const [phase, setPhase] = useState<Phase>('prepare');

  // Info
  const [clientName, setClientName] = useState('');
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingType, setMeetingType] = useState<string>('in_person');
  const [subject, setSubject] = useState<string>('revision');

  // Topics (marked during or after)
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
  const [aiProcessed, setAiProcessed] = useState(false);

  // Recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ─── Helpers ──────────────────────────────────────────────────
  const getVisibleTopics = () => TOPICS.filter((t) => {
    if (t.category === 'placement') return subject === 'placement' || subject === 'both';
    if (t.category === 'portefeuille') return subject === 'revision' || subject === 'both';
    return true;
  });

  const visibleTopics = getVisibleTopics();

  const toggleChip = (id: string) => {
    setSelectedChips((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const deriveCompliance = (): Record<string, string> => {
    const c: Record<string, string> = {};
    for (const t of TOPICS) { for (const k of t.complianceKeys) { c[k] = selectedChips.has(t.id) ? 'oui' : ''; } }
    return c;
  };

  // Transactions
  const addTransaction = () => setTransactions((prev) => [...prev, { id: crypto.randomUUID(), type: 'buy', symbol: '', quantity: '', price: '', solicited: true, orderType: 'market' }]);
  const updateTransaction = (id: string, patch: Partial<MeetingTransaction>) => setTransactions((prev) => prev.map((t) => t.id === id ? { ...t, ...patch } : t));
  const removeTransaction = (id: string) => setTransactions((prev) => prev.filter((t) => t.id !== id));

  // Recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop()); streamRef.current = null;
        if (timerRef.current) clearInterval(timerRef.current);
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (blob.size < 1000) { toast('warning', 'Enregistrement trop court'); return; }
        setTranscribing(true);
        try {
          const fd = new FormData(); fd.append('file', blob, 'recording.webm');
          const res = await fetch('/api/ai/transcribe', { method: 'POST', body: fd });
          if (res.ok) {
            const d = await res.json();
            setTranscription((p) => (p ? p + '\n\n' : '') + d.text);
            toast('success', 'Transcription terminée — génération du résumé...');
            // Auto-generate after transcription
            autoGenerate(d.text);
          } else toast('error', 'Erreur de transcription');
        } catch { toast('error', 'Erreur de transcription'); } finally { setTranscribing(false); }
      };
      mr.start(1000); mediaRecorderRef.current = mr;
      setIsRecording(true); setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch { toast('error', "Impossible d'accéder au microphone"); }
  }, [toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    setIsRecording(false); if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // AI — auto generate after recording stops
  const autoGenerate = async (newTranscription?: string) => {
    const fullTranscription = newTranscription ? (transcription ? transcription + '\n\n' + newTranscription : newTranscription) : transcription;
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/meeting-summary', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcription: fullTranscription, manualNotes: freeNotes, complianceAnswers: deriveCompliance(),
          meetingContext: { clientName, meetingType, subject, meetingDate, transactions: transactions.length > 0 ? transactions : undefined,
            topicsCovered: Array.from(selectedChips).map((id) => TOPICS.find((t) => t.id === id)?.label).filter(Boolean) },
        }),
      });
      if (res.ok) {
        const d = await res.json();
        setAiSummaryAdvisor(d.advisor_summary || '');
        setAiSummaryClient(d.client_summary || '');
        // Auto-detect topics from AI response
        if (d.topics_discussed?.length) {
          const newChips = new Set(selectedChips);
          for (const discussed of d.topics_discussed) {
            const lower = discussed.toLowerCase();
            for (const topic of TOPICS) {
              if (lower.includes(topic.label.toLowerCase()) || lower.includes(topic.shortLabel.toLowerCase())) {
                newChips.add(topic.id);
              }
            }
          }
          setSelectedChips(newChips);
        }
        setAiProcessed(true);
        setPhase('review');
        toast('success', 'Résumé généré — vérifiez et complétez');
      } else toast('error', 'Erreur IA');
    } catch { toast('error', 'Erreur de connexion'); } finally { setAiLoading(false); }
  };

  // Manual generate
  const generateSummary = async () => {
    if (selectedChips.size === 0 && !transcription && !freeNotes) { toast('warning', 'Ajoutez du contenu d\'abord'); return; }
    await autoGenerate();
  };

  // Save
  const handleSave = async (status: 'draft' | 'completed') => {
    if (!clientName.trim()) { toast('warning', 'Entrez le nom du client'); setPhase('prepare'); return; }
    setSaving(true);
    try {
      const body = {
        client_name: clientName, account_number: '', meeting_date: meetingDate, meeting_time: meetingTime,
        meeting_type: meetingType, subject, compliance: deriveCompliance(),
        transaction: transactions.length > 0 ? transactions : null,
        notes: { topics: Array.from(selectedChips).map((id) => TOPICS.find((t) => t.id === id)?.label).filter(Boolean).join(', '), decisions: '', followups: freeNotes, nextMeeting },
        transcription: transcription || null, ai_summary_advisor: aiSummaryAdvisor || null, ai_summary_client: aiSummaryClient || null, status,
      };
      const res = await fetch('/api/meeting-notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) { toast('success', status === 'completed' ? 'Note complétée!' : 'Brouillon sauvegardé'); router.push('/meeting-notes'); }
      else toast('error', 'Erreur');
    } catch { toast('error', 'Erreur de connexion'); } finally { setSaving(false); }
  };

  // ═══════════════════════════════════════════════════════════════
  // PHASE 1: PRÉPARER
  // ═══════════════════════════════════════════════════════════════
  const renderPrepare = () => (
    <div>
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-primary via-[#0096c7] to-[#03045e] p-6 mb-6 shadow-xl">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-12 translate-x-12" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-8 -translate-x-8" />
        <div className="relative">
          <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-1">Étape 1</p>
          <h1 className="text-2xl font-bold text-white font-[family-name:var(--font-heading)] mb-1">Préparez votre rencontre</h1>
          <p className="text-white/70 text-sm">30 secondes de setup, puis vous êtes prêt</p>
        </div>
      </div>

      {/* Client info */}
      <div className="rounded-2xl bg-white border-2 border-gray-200 p-5 mb-5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr,130px,110px] gap-3 mb-4">
          <Input placeholder="Nom du client *" value={clientName} onChange={(e) => setClientName(e.target.value)} />
          <Input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
          <Input type="time" value={meetingTime} onChange={(e) => setMeetingTime(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {MEETING_TYPES.map((mt) => {
            const Icon = mt.icon; const active = meetingType === mt.value;
            return (<button key={mt.value} type="button" onClick={() => setMeetingType(mt.value)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-all ${active ? 'bg-gradient-to-r from-brand-primary to-brand-primary/90 text-white shadow-md scale-105' : 'bg-gray-100 text-text-muted hover:bg-gray-200'}`}>
              <Icon className="h-3.5 w-3.5" />{mt.label}</button>);
          })}
          <div className="w-px h-7 bg-gray-200 self-center mx-1" />
          {SUBJECTS.map((s) => {
            const active = subject === s.value;
            return (<button key={s.value} type="button" onClick={() => setSubject(s.value)}
              className={`px-3.5 py-2 rounded-full text-xs font-bold transition-all ${active ? 'bg-gradient-to-r from-brand-primary to-brand-primary/90 text-white shadow-md scale-105' : 'bg-gray-100 text-text-muted hover:bg-gray-200'}`}>
              {s.label}</button>);
          })}
        </div>
      </div>

      {/* Aide-mémoire */}
      <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 p-5 mb-5">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <ClipboardCheck className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-900">Aide-mémoire</p>
            <p className="text-[11px] text-amber-700/70">Points à couvrir pendant la rencontre</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {visibleTopics.map((topic) => {
            const Icon = topic.icon;
            return (
              <div key={topic.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/60 border border-amber-200/50">
                <Icon className={`h-4 w-4 ${topic.iconColor} flex-shrink-0`} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-amber-900 truncate">{topic.shortLabel}</p>
                  <p className="text-[10px] text-amber-700/70 truncate">{topic.reminder}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Start button */}
      <button type="button" onClick={() => setPhase('meeting')} disabled={!clientName.trim()}
        className="w-full py-5 rounded-2xl bg-gradient-to-r from-brand-primary to-[#0096c7] text-white font-bold text-lg shadow-xl shadow-brand-primary/20 hover:shadow-2xl hover:scale-[1.01] transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-3">
        <PlayCircle className="h-6 w-6" />
        Commencer la rencontre
      </button>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // PHASE 2: RENCONTRE EN COURS
  // ═══════════════════════════════════════════════════════════════
  const renderMeeting = () => (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-text-muted font-semibold uppercase tracking-wider">En rencontre avec</p>
          <h2 className="text-lg font-bold text-text-main font-[family-name:var(--font-heading)]">{clientName}</h2>
        </div>
        <button type="button" onClick={() => setPhase('review')}
          className="px-3 py-1.5 rounded-xl bg-gray-100 text-xs font-semibold text-text-muted hover:bg-gray-200 transition-all">
          Terminer →
        </button>
      </div>

      {/* BIG Recording section */}
      <div className={`rounded-3xl p-6 mb-5 shadow-xl transition-all duration-500 ${
        isRecording ? 'bg-gradient-to-br from-red-500 via-red-600 to-red-700' : 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900'
      }`}>
        <div className="flex flex-col items-center">
          {!isRecording && !transcribing && (
            <>
              <button type="button" onClick={startRecording}
                className="w-24 h-24 rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white flex items-center justify-center shadow-2xl shadow-red-500/30 hover:scale-110 transition-all duration-300 mb-4">
                <Mic className="h-10 w-10" />
              </button>
              <p className="text-white font-bold text-lg mb-1">Enregistrer la rencontre</p>
              <p className="text-white/50 text-sm text-center">Appuyez pour commencer — l&apos;IA fera le reste</p>
            </>
          )}

          {isRecording && (
            <>
              <div className="relative mb-4">
                <div className="absolute inset-0 rounded-full bg-white/20 animate-ping scale-110" />
                <button type="button" onClick={stopRecording}
                  className="relative w-24 h-24 rounded-full bg-white/20 backdrop-blur border-4 border-white/40 text-white flex items-center justify-center hover:bg-white/30 transition-all">
                  <Square className="h-8 w-8" />
                </button>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
                <span className="text-3xl font-bold text-white font-mono">{formatTime(recordingTime)}</span>
              </div>
              <div className="w-full max-w-xs">
                <AudioWaveform stream={streamRef.current} isRecording={isRecording} />
              </div>
              <p className="text-white/60 text-xs mt-3">Appuyez sur le bouton pour arrêter</p>
            </>
          )}

          {transcribing && (
            <>
              <Loader2 className="h-12 w-12 text-white animate-spin mb-4" />
              <p className="text-white font-bold text-lg mb-1">Transcription en cours...</p>
              <p className="text-white/50 text-sm">Quelques secondes</p>
            </>
          )}
        </div>
      </div>

      {/* Live topic tapping — for quick marking without stopping the conversation */}
      <div className="rounded-2xl bg-white border-2 border-gray-200 p-4 mb-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-brand-primary" />
          <p className="text-xs font-bold text-text-main">Tap rapide — marquez pendant la conversation</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {visibleTopics.map((topic) => {
            const Icon = topic.icon;
            const selected = selectedChips.has(topic.id);
            return (
              <button key={topic.id} type="button" onClick={() => toggleChip(topic.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                  selected
                    ? `bg-gradient-to-r ${topic.gradient} text-white shadow-md scale-105`
                    : 'bg-gray-100 text-text-muted hover:bg-gray-200 hover:scale-[1.02]'
                }`}>
                <Icon className="h-3.5 w-3.5" />
                {topic.shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick note during meeting */}
      <textarea className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 bg-white text-sm placeholder:text-text-light focus:border-brand-primary focus:outline-none resize-none shadow-sm"
        rows={2} placeholder="Note rapide pendant la rencontre..." value={freeNotes} onChange={(e) => setFreeNotes(e.target.value)} />

      {/* Skip recording button */}
      {!isRecording && !transcribing && !transcription && (
        <button type="button" onClick={() => setPhase('review')}
          className="w-full mt-4 py-3 rounded-xl border-2 border-dashed border-gray-300 text-sm font-semibold text-text-muted hover:border-brand-primary hover:text-brand-primary transition-all">
          Pas d&apos;enregistrement → Passer à la documentation
        </button>
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // PHASE 3: REVIEW — AI has pre-filled, advisor validates
  // ═══════════════════════════════════════════════════════════════
  const renderReview = () => {
    const selectedCount = [...selectedChips].filter((id) => visibleTopics.some((t) => t.id === id)).length;

    return (
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs text-text-muted font-semibold uppercase tracking-wider">Étape 3</p>
            <h2 className="text-xl font-bold text-text-main font-[family-name:var(--font-heading)]">
              {aiProcessed ? 'Vérifiez et complétez' : 'Documentez la rencontre'}
            </h2>
            <p className="text-sm text-text-muted">{aiProcessed ? 'L\'IA a pré-rempli — ajustez si nécessaire' : 'Marquez ce qui a été couvert'}</p>
          </div>
          {selectedCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-sm">
              <Trophy className="h-3.5 w-3.5 text-white" />
              <span className="text-sm font-bold text-white">{selectedCount}</span>
            </div>
          )}
        </div>

        {/* Topics — what was covered */}
        <div className="rounded-2xl bg-white border-2 border-gray-200 p-5 mb-5 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-text-main">Sujets abordés</p>
              <p className="text-[11px] text-text-muted">{aiProcessed ? 'Détectés par l\'IA — ajustez si besoin' : 'Tapez ce que vous avez couvert'}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {visibleTopics.map((topic) => {
              const Icon = topic.icon;
              const selected = selectedChips.has(topic.id);
              return (
                <button key={topic.id} type="button" onClick={() => toggleChip(topic.id)}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border-2 text-sm font-semibold transition-all duration-200 ${
                    selected
                      ? `bg-gradient-to-r ${topic.gradient} text-white border-transparent shadow-md scale-[1.02]`
                      : 'bg-white border-gray-200 text-text-muted hover:border-gray-300 hover:shadow-sm'
                  }`}>
                  <Icon className="h-4 w-4" />
                  {topic.shortLabel}
                  {selected && <Check className="h-3.5 w-3.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Transactions */}
        {(subject === 'placement' || subject === 'both') && (
          <div className="rounded-2xl bg-white border-2 border-gray-200 p-5 mb-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                  <ArrowLeftRight className="h-4 w-4 text-white" />
                </div>
                <p className="text-sm font-bold text-text-main">Transactions</p>
              </div>
              <Button variant="ghost" size="sm" onClick={addTransaction} className="rounded-xl"><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
            </div>
            {transactions.length === 0 ? (
              <button type="button" onClick={addTransaction}
                className="w-full py-5 rounded-xl border-2 border-dashed border-gray-300 text-text-muted hover:border-brand-primary hover:text-brand-primary transition-all text-sm font-medium">
                <Plus className="h-5 w-5 mx-auto mb-1" />Ajouter une transaction
              </button>
            ) : (
              <div className="space-y-2.5">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-200">
                    <div className="flex gap-0.5 bg-white rounded-lg p-0.5 border border-gray-200">
                      {(['buy', 'sell', 'switch'] as const).map((t) => {
                        const s = TX_ICONS[t]; const Icon = s.icon;
                        return (<button key={t} type="button" onClick={() => updateTransaction(tx.id, { type: t })}
                          className={`p-1.5 rounded-md transition-all ${tx.type === t ? `${s.bgColor} ${s.color}` : 'text-gray-400 hover:text-gray-600'}`}>
                          <Icon className="h-4 w-4" /></button>);
                      })}
                    </div>
                    <input className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm font-bold bg-white focus:border-brand-primary focus:outline-none uppercase"
                      placeholder="SYMBOLE" value={tx.symbol} onChange={(e) => updateTransaction(tx.id, { symbol: e.target.value.toUpperCase() })} />
                    <input className="w-16 px-2 py-1.5 rounded-lg border border-gray-200 text-sm bg-white focus:border-brand-primary focus:outline-none"
                      type="number" placeholder="Qté" value={tx.quantity} onChange={(e) => updateTransaction(tx.id, { quantity: e.target.value })} />
                    <input className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 text-sm bg-white focus:border-brand-primary focus:outline-none"
                      type="number" step="0.01" placeholder="Prix" value={tx.price} onChange={(e) => updateTransaction(tx.id, { price: e.target.value })} />
                    <button type="button" onClick={() => removeTransaction(tx.id)} className="p-1.5 hover:bg-red-100 rounded-lg text-gray-400 hover:text-red-500 transition-all"><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        <div className="rounded-2xl bg-white border-2 border-gray-200 p-5 mb-5 shadow-sm">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
              <PenLine className="h-4 w-4 text-white" />
            </div>
            <p className="text-sm font-bold text-text-main">Notes additionnelles</p>
          </div>
          <textarea className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-gray-50 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none resize-none"
            rows={3} placeholder="Points importants, suivis à faire, observations..." value={freeNotes} onChange={(e) => setFreeNotes(e.target.value)} />
          <div className="mt-3">
            <Input label="Prochaine rencontre" type="date" value={nextMeeting} onChange={(e) => setNextMeeting(e.target.value)} />
          </div>
        </div>

        {/* AI summaries */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a1a2e] to-[#16213e] p-6 mb-5 shadow-xl">
          <div className="absolute top-4 right-4 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl" />
          <div className="absolute bottom-4 left-4 w-16 h-16 bg-amber-500/10 rounded-full blur-xl" />

          <div className="relative">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-amber-400 flex items-center justify-center shadow-lg">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Résumés IA</p>
                  <p className="text-[11px] text-white/50">{aiProcessed ? 'Générés — modifiez si nécessaire' : 'Cliquez pour générer'}</p>
                </div>
              </div>
              <button type="button" onClick={generateSummary} disabled={aiLoading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-amber-500 text-white text-sm font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50">
                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {aiSummaryAdvisor ? 'Regénérer' : 'Générer'}
              </button>
            </div>

            {!aiSummaryAdvisor && !aiSummaryClient && !aiLoading && (
              <div className="text-center py-6 rounded-2xl border border-white/10 bg-white/5">
                <Sparkles className="h-8 w-8 mx-auto mb-2 text-white/20" />
                <p className="text-sm text-white/50">Cliquez Générer — fonctionne avec ou sans audio</p>
              </div>
            )}

            {aiSummaryAdvisor && (
              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-400/20 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">Notes Croesus</span>
                  <CopyButton text={aiSummaryAdvisor} />
                </div>
                <textarea className="w-full bg-transparent text-sm text-blue-100 resize-none border-0 focus:ring-0 focus:outline-none leading-relaxed"
                  rows={6} value={aiSummaryAdvisor} onChange={(e) => setAiSummaryAdvisor(e.target.value)} />
              </div>
            )}

            {aiSummaryClient && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-400/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Récapitulatif client</span>
                  <CopyButton text={aiSummaryClient} />
                </div>
                <textarea className="w-full bg-transparent text-sm text-emerald-100 resize-none border-0 focus:ring-0 focus:outline-none leading-relaxed"
                  rows={6} value={aiSummaryClient} onChange={(e) => setAiSummaryClient(e.target.value)} />
              </div>
            )}
          </div>
        </div>

        {/* Save buttons */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => handleSave('draft')} loading={saving} className="flex-1 rounded-xl py-3">
            <Save className="h-4 w-4 mr-2" />Brouillon
          </Button>
          <Button variant="primary" onClick={() => handleSave('completed')} loading={saving} className="flex-1 rounded-xl py-3 shadow-lg shadow-brand-primary/20">
            <CheckCircle2 className="h-4 w-4 mr-2" />Compléter
          </Button>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="max-w-2xl mx-auto pb-8">
      {/* Back + phase nav */}
      <div className="flex items-center justify-between mb-5">
        <button type="button" onClick={() => router.push('/meeting-notes')}
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-brand-primary transition-colors">
          <ArrowLeft className="h-4 w-4" />Retour
        </button>

        {/* Phase indicator */}
        <div className="flex items-center gap-1">
          {[
            { id: 'prepare' as Phase, icon: ClipboardCheck, label: 'Préparer' },
            { id: 'meeting' as Phase, icon: Mic, label: 'Rencontre' },
            { id: 'review' as Phase, icon: Eye, label: 'Vérifier' },
          ].map((p, i) => {
            const Icon = p.icon;
            const active = phase === p.id;
            const done = (p.id === 'prepare' && phase !== 'prepare') || (p.id === 'meeting' && phase === 'review');
            return (
              <div key={p.id} className="flex items-center">
                <button type="button" onClick={() => setPhase(p.id)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    active ? 'bg-brand-primary text-white shadow-sm' : done ? 'bg-emerald-100 text-emerald-700' : 'text-text-muted hover:bg-gray-100'
                  }`}>
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{p.label}</span>
                </button>
                {i < 2 && <div className={`w-4 h-0.5 mx-0.5 ${done ? 'bg-emerald-400' : 'bg-gray-200'}`} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Phase content */}
      {phase === 'prepare' && renderPrepare()}
      {phase === 'meeting' && renderMeeting()}
      {phase === 'review' && renderReview()}
    </div>
  );
}
