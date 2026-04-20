'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { AudioWaveform } from '@/components/meeting-notes/AudioWaveform';
import type { MeetingTransaction } from '@/lib/hooks/useMeetingNotes';
import {
  ArrowLeft, ArrowRight, Save, CheckCircle2, Mic, Square,
  Sparkles, User, Calendar, Phone, Monitor, Users as UsersIcon,
  ClipboardList, FileText, MessageSquare, Loader2, Copy, Check,
  TrendingUp, BarChart3, Plus, X, ShoppingCart, ArrowDownRight,
  ArrowUpRight, ArrowLeftRight, ReceiptText, List, Zap,
} from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────────
const STEPS = [
  { id: 'info', label: 'Infos', icon: User },
  { id: 'compliance', label: 'Conformité', icon: ClipboardList },
  { id: 'notes', label: 'Notes & IA', icon: Sparkles },
  { id: 'recap', label: 'Récapitulatif', icon: ReceiptText },
] as const;

const MEETING_TYPES = [
  { value: 'phone', label: 'Téléphone', icon: Phone },
  { value: 'in_person', label: 'En personne', icon: UsersIcon },
  { value: 'video', label: 'Vidéo', icon: Monitor },
] as const;

const SUBJECTS = [
  { value: 'revision', label: 'Révision du portefeuille' },
  { value: 'placement', label: 'Placement' },
  { value: 'both', label: 'Révision + Placement' },
] as const;

const TEMPLATES = [
  {
    id: 'revision_annuelle',
    label: 'Révision annuelle',
    icon: Calendar,
    color: 'border-blue-200 bg-blue-50 text-blue-700',
    values: { subject: 'revision', topics: '• Performance du portefeuille sur l\'année\n• Répartition d\'actifs actuelle vs cible\n• Changements de situation personnelle\n• Objectifs à court et long terme' },
  },
  {
    id: 'nouveau_placement',
    label: 'Nouveau placement',
    icon: TrendingUp,
    color: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    values: { subject: 'placement', topics: '• Analyse du titre recommandé\n• Profil de risque du placement\n• Impact sur la répartition du portefeuille' },
  },
  {
    id: 'suivi_trimestriel',
    label: 'Suivi trimestriel',
    icon: BarChart3,
    color: 'border-purple-200 bg-purple-50 text-purple-700',
    values: { subject: 'revision', topics: '• Rendement du trimestre\n• Conditions de marché\n• Ajustements nécessaires' },
  },
] as const;

type ComplianceValue = 'oui' | 'non' | 'na' | '';

interface ComplianceQuestion {
  id: string;
  label: string;
  section: 'intro' | 'placement' | 'revision';
  hint?: string;
}

const COMPLIANCE_QUESTIONS: ComplianceQuestion[] = [
  { id: 'q_objectifs', label: 'Objectifs de placement discutés?', section: 'intro', hint: 'Avez-vous passé en revue les objectifs financiers du client?' },
  { id: 'q_horizon', label: 'Horizon de placement discuté?', section: 'intro', hint: 'Le timeframe d\'investissement a-t-il été revalidé?' },
  { id: 'q_tolerance', label: 'Tolérance au risque discutée?', section: 'intro', hint: 'Le niveau de confort du client face aux fluctuations a-t-il été vérifié?' },
  { id: 'q_situation', label: 'Situation financière discutée?', section: 'intro', hint: 'Revenus, dépenses, dettes, actifs — changements récents?' },
  { id: 'q_liquidite', label: 'Besoins en liquidité discutés?', section: 'intro', hint: 'Le client a-t-il des besoins de retraits prochains?' },
  { id: 'q_recommande', label: 'Titre recommandé par le conseiller?', section: 'placement' },
  { id: 'q_risques', label: 'Client informé des risques?', section: 'placement' },
  { id: 'q_comprend', label: 'Client comprend la nature du placement?', section: 'placement' },
  { id: 'q_conforme', label: 'Conforme au profil d\'investisseur?', section: 'placement' },
  { id: 'q_conflit', label: 'Conflit d\'intérêts potentiel?', section: 'placement' },
  { id: 'q_repartition', label: 'Répartition d\'actifs revue?', section: 'revision' },
  { id: 'q_non_conforme', label: 'Placements non conformes identifiés?', section: 'revision' },
  { id: 'q_concentration', label: 'Concentration vérifiée?', section: 'revision' },
  { id: 'q_rendements', label: 'Rendements discutés avec le client?', section: 'revision' },
  { id: 'q_frais', label: 'Frais discutés?', section: 'revision' },
  { id: 'q_changements', label: 'Changements de situation vérifiés?', section: 'revision' },
];

const SECTION_LABELS: Record<string, string> = {
  intro: 'Introduction',
  placement: 'Placements',
  revision: 'Révision du portefeuille',
};

// ─── Helpers ────────────────────────────────────────────────────
function getFilteredQuestions(subject: string) {
  return COMPLIANCE_QUESTIONS.filter((q) => {
    if (q.section === 'intro') return true;
    if (q.section === 'placement') return subject === 'placement' || subject === 'both';
    if (q.section === 'revision') return subject === 'revision' || subject === 'both';
    return false;
  });
}

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

// ─── Transaction row icons ──────────────────────────────────────
const TX_ICONS: Record<string, { icon: typeof ArrowUpRight; color: string; label: string }> = {
  buy: { icon: ArrowUpRight, color: 'text-emerald-600 bg-emerald-50', label: 'Achat' },
  sell: { icon: ArrowDownRight, color: 'text-red-600 bg-red-50', label: 'Vente' },
  switch: { icon: ArrowLeftRight, color: 'text-blue-600 bg-blue-50', label: 'Échange' },
};

// ─── Main Page ──────────────────────────────────────────────────
export default function NewMeetingNotePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [templateUsed, setTemplateUsed] = useState<string | null>(null);

  // Step 1: Info
  const [clientName, setClientName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingType, setMeetingType] = useState<string>('in_person');
  const [subject, setSubject] = useState<string>('revision');

  // Step 2: Compliance
  const [compliance, setCompliance] = useState<Record<string, ComplianceValue>>({});
  const [complianceMode, setComplianceMode] = useState<'duolingo' | 'list'>('duolingo');
  const [duolingoIndex, setDuolingoIndex] = useState(0);
  const [showCheck, setShowCheck] = useState(false);

  // Transactions
  const [transactions, setTransactions] = useState<MeetingTransaction[]>([]);

  // Step 3: Notes + AI
  const [topics, setTopics] = useState('');
  const [decisions, setDecisions] = useState('');
  const [followups, setFollowups] = useState('');
  const [nextMeeting, setNextMeeting] = useState('');
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

  // Filtered questions based on subject
  const filteredQuestions = getFilteredQuestions(subject);

  const complianceProgress = () => {
    const answered = filteredQuestions.filter((q) => compliance[q.id] && compliance[q.id] !== '').length;
    return { answered, total: filteredQuestions.length, pct: filteredQuestions.length ? Math.round((answered / filteredQuestions.length) * 100) : 0 };
  };

  // Template handler
  const applyTemplate = (tpl: typeof TEMPLATES[number]) => {
    setSubject(tpl.values.subject);
    setTopics(tpl.values.topics);
    setTemplateUsed(tpl.id);
    toast('success', `Template "${tpl.label}" appliqué`);
  };

  // Duolingo compliance handler
  const handleDuolingoAnswer = (val: ComplianceValue) => {
    const q = filteredQuestions[duolingoIndex];
    if (!q) return;
    setCompliance((prev) => ({ ...prev, [q.id]: val }));
    setShowCheck(true);
    setTimeout(() => {
      setShowCheck(false);
      if (duolingoIndex < filteredQuestions.length - 1) {
        setDuolingoIndex(duolingoIndex + 1);
      }
    }, 400);
  };

  // Reset duolingo index when subject changes
  useEffect(() => { setDuolingoIndex(0); }, [subject]);

  // Transaction helpers
  const addTransaction = () => {
    setTransactions((prev) => [...prev, {
      id: crypto.randomUUID(),
      type: 'buy',
      symbol: '',
      quantity: '',
      price: '',
      solicited: true,
      orderType: 'market',
    }]);
  };
  const updateTransaction = (id: string, patch: Partial<MeetingTransaction>) => {
    setTransactions((prev) => prev.map((t) => t.id === id ? { ...t, ...patch } : t));
  };
  const removeTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  // Recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (timerRef.current) clearInterval(timerRef.current);
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (blob.size < 1000) { toast('warning', 'Enregistrement trop court'); return; }
        setTranscribing(true);
        try {
          const formData = new FormData();
          formData.append('file', blob, 'recording.webm');
          const res = await fetch('/api/ai/transcribe', { method: 'POST', body: formData });
          if (res.ok) {
            const data = await res.json();
            setTranscription((prev) => (prev ? prev + '\n\n' : '') + data.text);
            toast('success', 'Transcription terminée');
          } else toast('error', 'Erreur de transcription');
        } catch { toast('error', 'Erreur de transcription'); } finally { setTranscribing(false); }
      };
      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch { toast('error', "Impossible d'accéder au microphone"); }
  }, [toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // AI Summary — works with or without transcription
  const generateSummary = async () => {
    const hasCompliance = Object.values(compliance).some((v) => v !== '');
    const manualNotes = [topics, decisions, followups].filter(Boolean).join('\n\n');
    if (!transcription && !manualNotes && !hasCompliance) {
      toast('warning', 'Répondez aux questions ou ajoutez des notes pour générer le résumé');
      return;
    }
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/meeting-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcription,
          manualNotes,
          complianceAnswers: compliance,
          meetingContext: {
            clientName, meetingType, subject, meetingDate,
            transactions: transactions.length > 0 ? transactions : undefined,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiSummaryAdvisor(data.advisor_summary || '');
        setAiSummaryClient(data.client_summary || '');
        if (data.topics_discussed?.length && !topics) setTopics(data.topics_discussed.join('\n• '));
        if (data.decisions?.length && !decisions) setDecisions(data.decisions.join('\n• '));
        if (data.action_items?.length && !followups) setFollowups(data.action_items.join('\n• '));
        toast('success', 'Résumés générés');
      } else toast('error', 'Erreur lors de la génération');
    } catch { toast('error', 'Erreur de connexion'); } finally { setAiLoading(false); }
  };

  // Save
  const handleSave = async (status: 'draft' | 'completed') => {
    if (!clientName.trim()) { toast('warning', 'Entrez le nom du client'); setStep(0); return; }
    setSaving(true);
    try {
      const body = {
        client_name: clientName, account_number: accountNumber,
        meeting_date: meetingDate, meeting_time: meetingTime,
        meeting_type: meetingType, subject, compliance,
        transaction: transactions.length > 0 ? transactions : null,
        notes: { topics, decisions, followups, nextMeeting },
        transcription: transcription || null,
        ai_summary_advisor: aiSummaryAdvisor || null,
        ai_summary_client: aiSummaryClient || null,
        status,
      };
      const res = await fetch('/api/meeting-notes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (res.ok) {
        toast('success', status === 'completed' ? 'Note complétée' : 'Brouillon sauvegardé');
        router.push('/meeting-notes');
      } else toast('error', 'Erreur lors de la sauvegarde');
    } catch { toast('error', 'Erreur de connexion'); } finally { setSaving(false); }
  };

  // ─── Render: Step 1 — Info ────────────────────────────────────
  const renderInfo = () => (
    <div className="space-y-4">
      {/* Quick templates */}
      <div>
        <p className="text-sm font-semibold text-text-main mb-2">Démarrage rapide</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TEMPLATES.map((tpl) => {
            const Icon = tpl.icon;
            const active = templateUsed === tpl.id;
            return (
              <button key={tpl.id} type="button" onClick={() => applyTemplate(tpl)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                  active ? 'border-brand-primary bg-brand-primary/5 text-brand-primary ring-2 ring-brand-primary/20' : tpl.color
                }`}>
                <Icon className="h-4 w-4" />
                {tpl.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Client */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><User className="h-5 w-5 text-blue-600" /></div>
          <div><h3 className="font-bold text-text-main font-[family-name:var(--font-heading)]">Client</h3>
            <p className="text-xs text-text-muted">Nom saisi manuellement pour la confidentialité</p></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Nom du client *" placeholder="Ex: Jean Tremblay" value={clientName} onChange={(e) => setClientName(e.target.value)} />
          <Input label="No. de compte" placeholder="Optionnel" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
        </div>
      </Card>

      {/* Meeting details */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center"><Calendar className="h-5 w-5 text-purple-600" /></div>
          <h3 className="font-bold text-text-main font-[family-name:var(--font-heading)]">Détails</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <Input label="Date" type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
          <Input label="Heure" type="time" value={meetingTime} onChange={(e) => setMeetingTime(e.target.value)} />
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-semibold text-text-main mb-1.5">Type</label>
            <div className="flex gap-2">
              {MEETING_TYPES.map((mt) => { const Icon = mt.icon; return (
                <button key={mt.value} type="button" onClick={() => setMeetingType(mt.value)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                    meetingType === mt.value ? 'border-brand-primary bg-brand-primary/5 text-brand-primary shadow-sm' : 'border-gray-200 text-text-muted hover:border-gray-300'
                  }`}><Icon className="h-4 w-4" />{mt.label}</button>
              ); })}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-text-main mb-1.5">Sujet</label>
            <div className="flex gap-2 flex-wrap">
              {SUBJECTS.map((s) => (
                <button key={s.value} type="button" onClick={() => setSubject(s.value)}
                  className={`px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                    subject === s.value ? 'border-brand-primary bg-brand-primary/5 text-brand-primary shadow-sm' : 'border-gray-200 text-text-muted hover:border-gray-300'
                  }`}>{s.label}</button>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );

  // ─── Render: Step 2 — Compliance ──────────────────────────────
  const renderCompliance = () => {
    const prog = complianceProgress();
    const allDone = prog.answered === prog.total;

    return (
      <div className="space-y-4">
        {/* Progress + mode toggle */}
        <Card padding="sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3 flex-1">
              <span className="text-sm font-semibold text-text-main">Conformité</span>
              <span className="text-sm font-bold text-brand-primary">{prog.answered}/{prog.total}</span>
              {allDone && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
            </div>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              <button type="button" onClick={() => setComplianceMode('duolingo')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${complianceMode === 'duolingo' ? 'bg-white text-brand-primary shadow-sm' : 'text-text-muted'}`}>
                <Zap className="h-3 w-3 inline mr-1" />Rapide
              </button>
              <button type="button" onClick={() => setComplianceMode('list')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${complianceMode === 'list' ? 'bg-white text-brand-primary shadow-sm' : 'text-text-muted'}`}>
                <List className="h-3 w-3 inline mr-1" />Liste
              </button>
            </div>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-emerald-500' : prog.pct > 50 ? 'bg-brand-primary' : 'bg-amber-400'}`}
              style={{ width: `${prog.pct}%` }} />
          </div>
        </Card>

        {/* Duolingo mode */}
        {complianceMode === 'duolingo' && (
          <Card>
            {duolingoIndex < filteredQuestions.length ? (
              <div className="py-6 text-center">
                {/* Question counter */}
                <p className="text-xs text-text-muted mb-1">
                  Question {duolingoIndex + 1} sur {filteredQuestions.length}
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-gray-100 text-text-muted text-xs">
                    {SECTION_LABELS[filteredQuestions[duolingoIndex].section]}
                  </span>
                </p>

                {/* Question */}
                <h2 className="text-xl font-bold text-text-main font-[family-name:var(--font-heading)] my-6 px-4">
                  {filteredQuestions[duolingoIndex].label}
                </h2>

                {/* Hint */}
                {filteredQuestions[duolingoIndex].hint && (
                  <p className="text-xs text-text-muted mb-6 px-8">{filteredQuestions[duolingoIndex].hint}</p>
                )}

                {/* Answer buttons */}
                {showCheck ? (
                  <div className="py-4">
                    <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto animate-bounce" />
                  </div>
                ) : (
                  <div className="flex justify-center gap-3">
                    <button type="button" onClick={() => handleDuolingoAnswer('oui')}
                      className="w-28 py-4 rounded-2xl bg-emerald-500 text-white font-bold text-lg shadow-lg shadow-emerald-200 hover:bg-emerald-600 hover:scale-105 transition-all active:scale-95">
                      Oui
                    </button>
                    <button type="button" onClick={() => handleDuolingoAnswer('non')}
                      className="w-28 py-4 rounded-2xl bg-red-500 text-white font-bold text-lg shadow-lg shadow-red-200 hover:bg-red-600 hover:scale-105 transition-all active:scale-95">
                      Non
                    </button>
                    <button type="button" onClick={() => handleDuolingoAnswer('na')}
                      className="w-28 py-4 rounded-2xl bg-gray-400 text-white font-bold text-lg shadow-lg shadow-gray-200 hover:bg-gray-500 hover:scale-105 transition-all active:scale-95">
                      N/A
                    </button>
                  </div>
                )}

                {/* Skip / go back */}
                <div className="flex justify-center gap-4 mt-6">
                  {duolingoIndex > 0 && (
                    <button type="button" onClick={() => setDuolingoIndex(duolingoIndex - 1)}
                      className="text-xs text-text-muted hover:text-text-main transition-colors">
                      <ArrowLeft className="h-3 w-3 inline mr-1" />Précédente
                    </button>
                  )}
                  <button type="button" onClick={() => {
                    if (duolingoIndex < filteredQuestions.length - 1) setDuolingoIndex(duolingoIndex + 1);
                  }} className="text-xs text-text-muted hover:text-text-main transition-colors">
                    Passer<ArrowRight className="h-3 w-3 inline ml-1" />
                  </button>
                </div>
              </div>
            ) : (
              /* All done celebration */
              <div className="py-8 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <h3 className="text-lg font-bold text-text-main font-[family-name:var(--font-heading)] mb-1">Conformité complétée!</h3>
                <p className="text-sm text-text-muted">{prog.answered} questions répondues</p>
                <button type="button" onClick={() => setDuolingoIndex(0)}
                  className="mt-3 text-xs text-brand-primary hover:underline">Revoir les réponses</button>
              </div>
            )}
          </Card>
        )}

        {/* List mode */}
        {complianceMode === 'list' && (
          <>
            {(['intro', 'placement', 'revision'] as const)
              .filter((section) => filteredQuestions.some((q) => q.section === section))
              .map((section) => {
                const questions = filteredQuestions.filter((q) => q.section === section);
                return (
                  <Card key={section}>
                    <h3 className="font-bold text-text-main font-[family-name:var(--font-heading)] text-sm mb-3">
                      {SECTION_LABELS[section]}
                    </h3>
                    <div className="space-y-2">
                      {questions.map((q, i) => (
                        <div key={q.id} className={`flex items-center justify-between gap-3 py-2 ${i < questions.length - 1 ? 'border-b border-gray-100' : ''}`}>
                          <span className="text-sm text-text-main">{q.label}</span>
                          <div className="flex gap-1 bg-gray-100 rounded-full p-0.5 flex-shrink-0">
                            {([['oui', 'Oui', 'bg-emerald-500 text-white'], ['non', 'Non', 'bg-red-500 text-white'], ['na', 'N/A', 'bg-gray-400 text-white']] as const).map(([val, label, active]) => (
                              <button key={val} type="button"
                                onClick={() => setCompliance((prev) => ({ ...prev, [q.id]: prev[q.id] === val ? '' : val }))}
                                className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all ${
                                  compliance[q.id] === val ? `${active} shadow-sm` : 'text-text-muted hover:text-text-main'
                                }`}>{label}</button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
          </>
        )}

        {/* Transactions */}
        {(subject === 'placement' || subject === 'both') && (
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-amber-600" />
                <h3 className="font-bold text-text-main font-[family-name:var(--font-heading)] text-sm">Transactions</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={addTransaction}>
                <Plus className="h-3.5 w-3.5 mr-1" />Ajouter
              </Button>
            </div>

            {transactions.length === 0 && (
              <p className="text-sm text-text-muted text-center py-4">Aucune transaction — cliquez Ajouter si applicable</p>
            )}

            <div className="space-y-2">
              {transactions.map((tx) => {
                const txStyle = TX_ICONS[tx.type] || TX_ICONS.buy;
                const TxIcon = txStyle.icon;
                return (
                  <div key={tx.id} className="flex items-center gap-2 p-2 rounded-xl bg-gray-50 border border-gray-100">
                    {/* Type selector */}
                    <div className="flex gap-0.5 bg-white rounded-lg p-0.5 border border-gray-200">
                      {(['buy', 'sell', 'switch'] as const).map((t) => {
                        const s = TX_ICONS[t];
                        const Icon = s.icon;
                        return (
                          <button key={t} type="button" onClick={() => updateTransaction(tx.id, { type: t })}
                            className={`p-1.5 rounded-md transition-all ${tx.type === t ? s.color : 'text-gray-400 hover:text-gray-600'}`}
                            title={s.label}>
                            <Icon className="h-4 w-4" />
                          </button>
                        );
                      })}
                    </div>
                    <input className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-gray-200 text-sm bg-white focus:border-brand-primary focus:outline-none"
                      placeholder="Symbole" value={tx.symbol} onChange={(e) => updateTransaction(tx.id, { symbol: e.target.value.toUpperCase() })} />
                    <input className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 text-sm bg-white focus:border-brand-primary focus:outline-none"
                      type="number" placeholder="Qté" value={tx.quantity} onChange={(e) => updateTransaction(tx.id, { quantity: e.target.value })} />
                    <input className="w-24 px-2 py-1.5 rounded-lg border border-gray-200 text-sm bg-white focus:border-brand-primary focus:outline-none"
                      type="number" step="0.01" placeholder="Prix $" value={tx.price} onChange={(e) => updateTransaction(tx.id, { price: e.target.value })} />
                    <button type="button" onClick={() => removeTransaction(tx.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-text-muted hover:text-red-500 transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    );
  };

  // ─── Render: Step 3 — Notes + AI ──────────────────────────────
  const renderNotesAI = () => (
    <div className="space-y-4">
      {/* Recording */}
      <Card>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center"><Mic className="h-5 w-5 text-red-500" /></div>
          <div>
            <h3 className="font-bold text-text-main font-[family-name:var(--font-heading)] text-sm">Enregistrement audio</h3>
            <p className="text-xs text-text-muted">Optionnel — le résumé IA fonctionne aussi sans enregistrement</p>
          </div>
        </div>

        <div className="flex flex-col items-center py-4">
          {!isRecording ? (
            <button type="button" onClick={startRecording} disabled={transcribing}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white flex items-center justify-center shadow-lg shadow-red-200 hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50">
              {transcribing ? <Loader2 className="h-6 w-6 animate-spin" /> : <Mic className="h-6 w-6" />}
            </button>
          ) : (
            <div className="flex flex-col items-center gap-3 w-full">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
                <button type="button" onClick={stopRecording}
                  className="relative w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white flex items-center justify-center shadow-lg">
                  <Square className="h-6 w-6" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-lg font-bold text-text-main font-mono">{formatTime(recordingTime)}</span>
              </div>
              <AudioWaveform stream={streamRef.current} isRecording={isRecording} />
            </div>
          )}
          <p className="text-xs text-text-muted mt-2">
            {transcribing ? 'Transcription en cours...' : isRecording ? 'Cliquez pour arrêter' : 'Cliquez pour enregistrer'}
          </p>
        </div>

        {transcription && (
          <div className="mt-2 space-y-1.5">
            <label className="block text-sm font-semibold text-text-main">Transcription</label>
            <textarea className="w-full px-4 py-3 rounded-[var(--radius-sm)] border border-gray-200 bg-gray-50 text-sm text-text-main focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none resize-none"
              rows={4} value={transcription} onChange={(e) => setTranscription(e.target.value)} />
          </div>
        )}
      </Card>

      {/* Manual notes */}
      <Card>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center"><MessageSquare className="h-5 w-5 text-purple-600" /></div>
          <h3 className="font-bold text-text-main font-[family-name:var(--font-heading)] text-sm">Notes manuelles</h3>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-text-main">Sujets discutés</label>
            <textarea className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-gray-200 bg-white text-sm text-text-main placeholder:text-text-light focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none resize-none"
              rows={2} value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="• Sujets abordés..." />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-text-main">Décisions prises</label>
            <textarea className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-gray-200 bg-white text-sm text-text-main placeholder:text-text-light focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none resize-none"
              rows={2} value={decisions} onChange={(e) => setDecisions(e.target.value)} placeholder="• Décisions..." />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-text-main">Suivis requis</label>
            <textarea className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-gray-200 bg-white text-sm text-text-main placeholder:text-text-light focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none resize-none"
              rows={2} value={followups} onChange={(e) => setFollowups(e.target.value)} placeholder="• Suivis..." />
          </div>
          <Input label="Prochaine rencontre" type="date" value={nextMeeting} onChange={(e) => setNextMeeting(e.target.value)} />
        </div>
      </Card>
    </div>
  );

  // ─── Render: Step 4 — Recap ───────────────────────────────────
  const renderRecap = () => {
    const prog = complianceProgress();
    const nonAnswers = filteredQuestions.filter((q) => compliance[q.id] === 'non');
    const SUBJECT_LABELS_MAP: Record<string, string> = { revision: 'Révision', placement: 'Placement', both: 'Rév. + Placement' };
    const MT_LABELS: Record<string, string> = { phone: 'Téléphone', in_person: 'En personne', video: 'Vidéo' };

    return (
      <div className="space-y-4">
        {/* Summary header */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-text-main font-[family-name:var(--font-heading)]">Récapitulatif</h3>
            <span className="text-xs text-text-muted">Vérifiez avant de sauvegarder</span>
          </div>

          {/* Client & meeting info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded-xl bg-gray-50">
              <p className="text-xs text-text-muted mb-1">Client</p>
              <p className="font-semibold text-text-main">{clientName || '—'}</p>
              {accountNumber && <p className="text-xs text-text-muted mt-0.5">{accountNumber}</p>}
            </div>
            <div className="p-3 rounded-xl bg-gray-50">
              <p className="text-xs text-text-muted mb-1">Rencontre</p>
              <p className="font-semibold text-text-main">{meetingDate}</p>
              <p className="text-xs text-text-muted mt-0.5">{MT_LABELS[meetingType]} — {SUBJECT_LABELS_MAP[subject]}</p>
            </div>
          </div>

          {/* Compliance status */}
          <div className="mt-4 p-3 rounded-xl bg-gray-50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-text-muted">Conformité</span>
              <span className={`text-sm font-bold ${prog.pct === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {prog.answered}/{prog.total}
              </span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${prog.pct === 100 ? 'bg-emerald-500' : 'bg-amber-400'}`}
                style={{ width: `${prog.pct}%` }} />
            </div>
            {nonAnswers.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-semibold text-red-600 mb-1">Points répondus « Non »:</p>
                {nonAnswers.map((q) => (
                  <p key={q.id} className="text-xs text-red-500">• {q.label}</p>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Transactions recap */}
        {transactions.length > 0 && (
          <Card>
            <h3 className="font-bold text-text-main font-[family-name:var(--font-heading)] text-sm mb-3">Transactions prévues</h3>
            <div className="space-y-2">
              {transactions.map((tx) => {
                const s = TX_ICONS[tx.type] || TX_ICONS.buy;
                const TxIcon = s.icon;
                const value = tx.quantity && tx.price ? (parseFloat(tx.quantity) * parseFloat(tx.price)) : null;
                return (
                  <div key={tx.id} className={`flex items-center gap-3 p-3 rounded-xl border-l-4 ${
                    tx.type === 'buy' ? 'border-l-emerald-500 bg-emerald-50/50' : tx.type === 'sell' ? 'border-l-red-500 bg-red-50/50' : 'border-l-blue-500 bg-blue-50/50'
                  }`}>
                    <TxIcon className={`h-5 w-5 ${s.color.split(' ')[0]}`} />
                    <div className="flex-1">
                      <span className="font-bold text-sm text-text-main">{tx.symbol || '—'}</span>
                      <span className="text-xs text-text-muted ml-2">{tx.quantity} actions à {tx.price}$</span>
                    </div>
                    {value && <span className="text-sm font-bold text-text-main">{value.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</span>}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* AI Summary generation */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <h3 className="font-bold text-text-main font-[family-name:var(--font-heading)] text-sm">Résumés IA</h3>
            </div>
            <Button variant="primary" size="sm" onClick={generateSummary} loading={aiLoading}>
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              {aiSummaryAdvisor ? 'Regénérer' : 'Générer les résumés'}
            </Button>
          </div>

          {!aiSummaryAdvisor && !aiSummaryClient && !aiLoading && (
            <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl">
              <Sparkles className="h-8 w-8 mx-auto mb-2 text-purple-300" />
              <p className="text-sm text-text-muted mb-1">Cliquez pour générer automatiquement</p>
              <p className="text-xs text-text-muted">Fonctionne avec ou sans enregistrement audio</p>
            </div>
          )}

          {aiSummaryAdvisor && (
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-blue-800 flex items-center gap-1">
                  <ClipboardList className="h-4 w-4" /> Notes Croesus (conseiller)
                </span>
                <CopyButton text={aiSummaryAdvisor} />
              </div>
              <textarea className="w-full bg-transparent text-sm text-blue-900 resize-none border-0 focus:ring-0 focus:outline-none"
                rows={5} value={aiSummaryAdvisor} onChange={(e) => setAiSummaryAdvisor(e.target.value)} />
            </div>
          )}

          {aiSummaryClient && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-emerald-800 flex items-center gap-1">
                  <User className="h-4 w-4" /> Récapitulatif client
                </span>
                <CopyButton text={aiSummaryClient} />
              </div>
              <textarea className="w-full bg-transparent text-sm text-emerald-900 resize-none border-0 focus:ring-0 focus:outline-none"
                rows={5} value={aiSummaryClient} onChange={(e) => setAiSummaryClient(e.target.value)} />
            </div>
          )}
        </Card>
      </div>
    );
  };

  // ─── Main render ──────────────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      case 0: return renderInfo();
      case 1: return renderCompliance();
      case 2: return renderNotesAI();
      case 3: return renderRecap();
      default: return null;
    }
  };

  // Progress bar
  const pct = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="Nouvelle rencontre" description="Documentez votre rencontre rapidement"
        action={<Button variant="ghost" onClick={() => router.push('/meeting-notes')}><ArrowLeft className="h-4 w-4 mr-2" />Retour</Button>} />

      {/* Step progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < step; const current = i === step;
            return (
              <button key={s.id} type="button" onClick={() => { if (i <= step || (step === 0 && clientName.trim())) setStep(i); }}
                className="flex items-center gap-1.5 group">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  done ? 'bg-emerald-500 text-white' : current ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/30 scale-110' : 'bg-gray-200 text-text-muted group-hover:bg-gray-300'
                }`}>
                  {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span className={`text-xs font-semibold hidden sm:block ${current ? 'text-brand-primary' : done ? 'text-emerald-600' : 'text-text-muted'}`}>
                  {s.label}
                </span>
                {i < STEPS.length - 1 && <div className={`w-6 lg:w-12 h-0.5 mx-1 ${i < step ? 'bg-emerald-400' : 'bg-gray-200'}`} />}
              </button>
            );
          })}
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-brand-primary to-emerald-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Content */}
      <div className="mb-6">{renderStep()}</div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div>{step > 0 && <Button variant="ghost" onClick={() => setStep(step - 1)}><ArrowLeft className="h-4 w-4 mr-2" />Précédent</Button>}</div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => handleSave('draft')} loading={saving}>
            <Save className="h-4 w-4 mr-2" />Brouillon
          </Button>
          {step < STEPS.length - 1 ? (
            <Button variant="primary" onClick={() => setStep(step + 1)} disabled={step === 0 && !clientName.trim()}>
              Suivant<ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button variant="primary" onClick={() => handleSave('completed')} loading={saving}>
              <CheckCircle2 className="h-4 w-4 mr-2" />Compléter
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
