'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import {
  ArrowLeft, ArrowRight, Save, CheckCircle2, Mic, MicOff, Square,
  Sparkles, User, Calendar, Phone, Monitor, Users as UsersIcon,
  ClipboardList, FileText, MessageSquare, AlertCircle, ChevronDown,
  ChevronUp, Loader2,
} from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────────────
const STEPS = [
  { id: 'info', label: 'Informations', icon: User, color: 'bg-blue-500' },
  { id: 'compliance', label: 'Conformité', icon: ClipboardList, color: 'bg-emerald-500' },
  { id: 'notes', label: 'Notes', icon: FileText, color: 'bg-purple-500' },
  { id: 'ai', label: 'IA & Résumé', icon: Sparkles, color: 'bg-amber-500' },
] as const;

const MEETING_TYPES = [
  { value: 'phone', label: 'Téléphone', icon: Phone },
  { value: 'in_person', label: 'En personne', icon: UsersIcon },
  { value: 'video', label: 'Vidéoconférence', icon: Monitor },
] as const;

const SUBJECTS = [
  { value: 'revision', label: 'Révision du portefeuille' },
  { value: 'placement', label: 'Placement' },
  { value: 'both', label: 'Révision + Placement' },
] as const;

type ComplianceValue = 'oui' | 'non' | 'na' | '';

interface ComplianceQuestion {
  id: string;
  label: string;
  section: 'intro' | 'placement' | 'revision';
}

const COMPLIANCE_QUESTIONS: ComplianceQuestion[] = [
  // Introduction
  { id: 'q_objectifs', label: 'Les objectifs de placement ont-ils été discutés?', section: 'intro' },
  { id: 'q_horizon', label: "L'horizon de placement a-t-il été discuté?", section: 'intro' },
  { id: 'q_tolerance', label: 'La tolérance au risque a-t-elle été discutée?', section: 'intro' },
  { id: 'q_situation', label: 'La situation financière a-t-elle été discutée?', section: 'intro' },
  { id: 'q_liquidite', label: 'Les besoins en liquidité ont-ils été discutés?', section: 'intro' },
  // Placements
  { id: 'q_recommande', label: 'Le titre a-t-il été recommandé par le conseiller?', section: 'placement' },
  { id: 'q_risques', label: 'Le client a-t-il été informé des risques?', section: 'placement' },
  { id: 'q_comprend', label: 'Le client comprend-il la nature du placement?', section: 'placement' },
  { id: 'q_conforme', label: "Le placement est-il conforme au profil d'investisseur?", section: 'placement' },
  { id: 'q_conflit', label: "Y a-t-il un conflit d'intérêts potentiel?", section: 'placement' },
  // Révision
  { id: 'q_repartition', label: "La répartition d'actifs a-t-elle été revue?", section: 'revision' },
  { id: 'q_non_conforme', label: 'Les placements non conformes ont-ils été identifiés?', section: 'revision' },
  { id: 'q_concentration', label: 'La concentration a-t-elle été vérifiée?', section: 'revision' },
  { id: 'q_rendements', label: 'Les rendements ont-ils été discutés avec le client?', section: 'revision' },
  { id: 'q_frais', label: 'Les frais ont-ils été discutés?', section: 'revision' },
  { id: 'q_changements', label: 'Les changements de situation personnelle ont-ils été vérifiés?', section: 'revision' },
];

const SECTION_LABELS: Record<string, string> = {
  intro: 'Introduction',
  placement: 'Placements',
  revision: 'Révision du portefeuille',
};

// ─── Three-state toggle component ────────────────────────────────
function ComplianceToggle({
  value,
  onChange,
}: {
  value: ComplianceValue;
  onChange: (v: ComplianceValue) => void;
}) {
  const options: { val: ComplianceValue; label: string; active: string }[] = [
    { val: 'oui', label: 'Oui', active: 'bg-emerald-500 text-white shadow-emerald-200' },
    { val: 'non', label: 'Non', active: 'bg-red-500 text-white shadow-red-200' },
    { val: 'na', label: 'N/A', active: 'bg-gray-400 text-white shadow-gray-200' },
  ];

  return (
    <div className="flex gap-1 bg-gray-100 rounded-full p-0.5">
      {options.map((o) => (
        <button
          key={o.val}
          type="button"
          onClick={() => onChange(value === o.val ? '' : o.val)}
          className={`px-3 py-1 text-xs font-bold rounded-full transition-all duration-200 ${
            value === o.val
              ? `${o.active} shadow-sm scale-105`
              : 'text-text-muted hover:text-text-main'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Progress bar ────────────────────────────────────────────────
function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = ((step + 1) / total) * 100;
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = i < step;
          const current = i === step;
          return (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  done
                    ? 'bg-emerald-500 text-white'
                    : current
                    ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/30 scale-110'
                    : 'bg-gray-200 text-text-muted'
                }`}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span
                className={`text-xs font-semibold hidden sm:block ${
                  current ? 'text-brand-primary' : done ? 'text-emerald-600' : 'text-text-muted'
                }`}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`w-8 lg:w-16 h-0.5 mx-1 ${i < step ? 'bg-emerald-400' : 'bg-gray-200'}`} />
              )}
            </div>
          );
        })}
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-brand-primary to-emerald-400 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────
export default function NewMeetingNotePage() {
  const router = useRouter();
  const { toast } = useToast();

  // Form state
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 1: Info
  const [clientName, setClientName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingType, setMeetingType] = useState<string>('in_person');
  const [subject, setSubject] = useState<string>('revision');

  // Step 2: Compliance
  const [compliance, setCompliance] = useState<Record<string, ComplianceValue>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    intro: true,
    placement: true,
    revision: true,
  });

  // Step 2b: Transaction (shown if subject includes 'placement')
  const [hasTransaction, setHasTransaction] = useState(false);
  const [transaction, setTransaction] = useState({
    solicited: true,
    type: '',
    orderType: '',
    price: '',
    quantity: '',
    symbol: '',
  });

  // Step 3: Notes
  const [topics, setTopics] = useState('');
  const [decisions, setDecisions] = useState('');
  const [followups, setFollowups] = useState('');
  const [nextMeeting, setNextMeeting] = useState('');

  // Step 4: AI
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcription, setTranscription] = useState('');
  const [aiSummaryAdvisor, setAiSummaryAdvisor] = useState('');
  const [aiSummaryClient, setAiSummaryClient] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Compliance helpers
  const setComplianceValue = (qId: string, val: ComplianceValue) => {
    setCompliance((prev) => ({ ...prev, [qId]: val }));
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const complianceProgress = () => {
    const answered = Object.values(compliance).filter((v) => v !== '').length;
    const total = COMPLIANCE_QUESTIONS.length;
    return { answered, total, pct: total ? Math.round((answered / total) * 100) : 0 };
  };

  // Recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);

        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (blob.size < 1000) {
          toast('warning', 'Enregistrement trop court');
          return;
        }

        setTranscribing(true);
        try {
          const formData = new FormData();
          formData.append('file', blob, 'recording.webm');
          formData.append('model', 'whisper-large-v3');
          formData.append('language', 'fr');
          formData.append('response_format', 'text');

          const res = await fetch('/api/ai/transcribe', {
            method: 'POST',
            body: formData,
          });

          if (res.ok) {
            const data = await res.json();
            setTranscription((prev) => (prev ? prev + '\n\n' : '') + data.text);
            toast('success', 'Transcription terminée');
          } else {
            toast('error', 'Erreur de transcription');
          }
        } catch {
          toast('error', 'Erreur de transcription');
        } finally {
          setTranscribing(false);
        }
      };

      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      toast('error', "Impossible d'accéder au microphone");
    }
  }, [toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // AI Summary
  const generateSummary = async () => {
    const manualNotes = [topics, decisions, followups].filter(Boolean).join('\n\n');
    if (!transcription && !manualNotes) {
      toast('warning', 'Ajoutez une transcription ou des notes avant de générer le résumé');
      return;
    }

    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/meeting-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcription, manualNotes }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiSummaryAdvisor(data.advisor_summary || '');
        setAiSummaryClient(data.client_summary || '');

        if (data.topics_discussed?.length && !topics) {
          setTopics(data.topics_discussed.join('\n• '));
        }
        if (data.decisions?.length && !decisions) {
          setDecisions(data.decisions.join('\n• '));
        }
        if (data.action_items?.length && !followups) {
          setFollowups(data.action_items.join('\n• '));
        }

        toast('success', 'Résumés générés avec succès');
      } else {
        toast('error', "Erreur lors de la génération du résumé");
      }
    } catch {
      toast('error', 'Erreur de connexion');
    } finally {
      setAiLoading(false);
    }
  };

  // Save
  const handleSave = async (status: 'draft' | 'completed') => {
    if (!clientName.trim()) {
      toast('warning', 'Veuillez entrer le nom du client');
      setStep(0);
      return;
    }

    setSaving(true);
    try {
      const body = {
        client_name: clientName,
        account_number: accountNumber,
        meeting_date: meetingDate,
        meeting_time: meetingTime,
        meeting_type: meetingType,
        subject,
        compliance,
        transaction: hasTransaction
          ? {
              ...transaction,
              price: transaction.price ? parseFloat(transaction.price) : undefined,
              quantity: transaction.quantity ? parseFloat(transaction.quantity) : undefined,
            }
          : null,
        notes: { topics, decisions, followups, nextMeeting },
        transcription: transcription || null,
        ai_summary_advisor: aiSummaryAdvisor || null,
        ai_summary_client: aiSummaryClient || null,
        status,
      };

      const res = await fetch('/api/meeting-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast('success', status === 'completed' ? 'Note complétée et sauvegardée' : 'Brouillon sauvegardé');
        router.push('/meeting-notes');
      } else {
        toast('error', 'Erreur lors de la sauvegarde');
      }
    } catch {
      toast('error', 'Erreur de connexion');
    } finally {
      setSaving(false);
    }
  };

  const canGoNext = () => {
    if (step === 0) return clientName.trim().length > 0;
    return true;
  };

  // ─── Render sections ──────────────────────────────────────────
  const renderInfo = () => (
    <div className="space-y-6">
      {/* Client info card */}
      <Card>
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <User className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-text-main font-[family-name:var(--font-heading)]">
                Client
              </h3>
              <p className="text-xs text-text-muted">Entrez le nom manuellement pour la confidentialité</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nom du client *"
              placeholder="Ex: Jean Tremblay"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              error={step === 0 && !clientName.trim() ? undefined : undefined}
            />
            <Input
              label="No. de compte"
              placeholder="Optionnel"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Meeting details card */}
      <Card>
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-bold text-text-main font-[family-name:var(--font-heading)]">
                Détails de la rencontre
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Date"
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
            />
            <Input
              label="Heure"
              type="time"
              value={meetingTime}
              onChange={(e) => setMeetingTime(e.target.value)}
            />
          </div>

          {/* Meeting type pills */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-text-main">Type de rencontre</label>
            <div className="flex gap-2">
              {MEETING_TYPES.map((mt) => {
                const Icon = mt.icon;
                const active = meetingType === mt.value;
                return (
                  <button
                    key={mt.value}
                    type="button"
                    onClick={() => setMeetingType(mt.value)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all duration-200 ${
                      active
                        ? 'border-brand-primary bg-brand-primary/5 text-brand-primary shadow-sm'
                        : 'border-gray-200 text-text-muted hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {mt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subject pills */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-text-main">Sujet</label>
            <div className="flex gap-2 flex-wrap">
              {SUBJECTS.map((s) => {
                const active = subject === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSubject(s.value)}
                    className={`px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all duration-200 ${
                      active
                        ? 'border-brand-primary bg-brand-primary/5 text-brand-primary shadow-sm'
                        : 'border-gray-200 text-text-muted hover:border-gray-300'
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );

  const renderCompliance = () => {
    const prog = complianceProgress();
    const sections = ['intro', 'placement', 'revision'] as const;

    return (
      <div className="space-y-4">
        {/* Progress mini-bar */}
        <Card padding="sm">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-text-main">
                  Checklist de conformité
                </span>
                <span className="text-sm font-bold text-brand-primary">
                  {prog.answered}/{prog.total}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    prog.pct === 100
                      ? 'bg-emerald-500'
                      : prog.pct > 50
                      ? 'bg-brand-primary'
                      : 'bg-amber-400'
                  }`}
                  style={{ width: `${prog.pct}%` }}
                />
              </div>
            </div>
            {prog.pct === 100 && (
              <div className="flex items-center gap-1 text-emerald-600 text-sm font-bold">
                <CheckCircle2 className="h-5 w-5" />
                Complet
              </div>
            )}
          </div>
        </Card>

        {sections.map((section) => {
          const questions = COMPLIANCE_QUESTIONS.filter((q) => q.section === section);
          const expanded = expandedSections[section];
          const sectionAnswered = questions.filter((q) => compliance[q.id] && compliance[q.id] !== '').length;

          return (
            <Card key={section}>
              <button
                type="button"
                onClick={() => toggleSection(section)}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                      sectionAnswered === questions.length
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-text-muted'
                    }`}
                  >
                    {sectionAnswered === questions.length ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      `${sectionAnswered}/${questions.length}`
                    )}
                  </div>
                  <h3 className="font-bold text-text-main font-[family-name:var(--font-heading)]">
                    {SECTION_LABELS[section]}
                  </h3>
                </div>
                {expanded ? (
                  <ChevronUp className="h-5 w-5 text-text-muted" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-text-muted" />
                )}
              </button>

              {expanded && (
                <div className="mt-4 space-y-3">
                  {questions.map((q, i) => (
                    <div
                      key={q.id}
                      className={`flex items-center justify-between gap-4 py-2.5 ${
                        i < questions.length - 1 ? 'border-b border-gray-100' : ''
                      }`}
                    >
                      <span className="text-sm text-text-main flex-1">{q.label}</span>
                      <ComplianceToggle
                        value={(compliance[q.id] as ComplianceValue) || ''}
                        onChange={(v) => setComplianceValue(q.id, v)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}

        {/* Transaction section */}
        {(subject === 'placement' || subject === 'both') && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <AlertCircle className="h-4 w-4 text-amber-700" />
                </div>
                <h3 className="font-bold text-text-main font-[family-name:var(--font-heading)]">
                  Transaction
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setHasTransaction(!hasTransaction)}
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
                  hasTransaction ? 'bg-brand-primary' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                    hasTransaction ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {hasTransaction && (
              <div className="space-y-4 pt-2">
                {/* Solicited toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-text-main">Sollicité par le conseiller?</span>
                  <div className="flex gap-1 bg-gray-100 rounded-full p-0.5">
                    <button
                      type="button"
                      onClick={() => setTransaction((t) => ({ ...t, solicited: true }))}
                      className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
                        transaction.solicited
                          ? 'bg-brand-primary text-white shadow-sm'
                          : 'text-text-muted'
                      }`}
                    >
                      Oui
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransaction((t) => ({ ...t, solicited: false }))}
                      className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
                        !transaction.solicited
                          ? 'bg-brand-primary text-white shadow-sm'
                          : 'text-text-muted'
                      }`}
                    >
                      Non
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Type"
                    options={[
                      { value: 'buy', label: 'Achat' },
                      { value: 'sell', label: 'Vente' },
                      { value: 'switch', label: 'Échange' },
                    ]}
                    placeholder="Sélectionner..."
                    value={transaction.type}
                    onChange={(e) => setTransaction((t) => ({ ...t, type: e.target.value }))}
                  />
                  <Select
                    label="Type d'ordre"
                    options={[
                      { value: 'market', label: 'Au marché' },
                      { value: 'limit', label: 'Limité' },
                      { value: 'stop', label: 'Stop' },
                    ]}
                    placeholder="Sélectionner..."
                    value={transaction.orderType}
                    onChange={(e) => setTransaction((t) => ({ ...t, orderType: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Input
                    label="Symbole"
                    placeholder="Ex: RY.TO"
                    value={transaction.symbol}
                    onChange={(e) => setTransaction((t) => ({ ...t, symbol: e.target.value }))}
                  />
                  <Input
                    label="Quantité"
                    type="number"
                    placeholder="0"
                    value={transaction.quantity}
                    onChange={(e) => setTransaction((t) => ({ ...t, quantity: e.target.value }))}
                  />
                  <Input
                    label="Prix"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={transaction.price}
                    onChange={(e) => setTransaction((t) => ({ ...t, price: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    );
  };

  const renderNotes = () => (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-bold text-text-main font-[family-name:var(--font-heading)]">
              Notes de la rencontre
            </h3>
            <p className="text-xs text-text-muted">Documentez les points clés de votre discussion</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-text-main">Sujets discutés</label>
            <textarea
              className="w-full px-4 py-3 rounded-[var(--radius-sm)] border border-gray-200 bg-white text-sm text-text-main placeholder:text-text-light focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none transition-all resize-none"
              rows={3}
              placeholder="• Revenus de retraite&#10;• Performance du portefeuille&#10;• Objectifs à court terme..."
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-text-main">Décisions prises</label>
            <textarea
              className="w-full px-4 py-3 rounded-[var(--radius-sm)] border border-gray-200 bg-white text-sm text-text-main placeholder:text-text-light focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none transition-all resize-none"
              rows={3}
              placeholder="• Augmenter la portion obligataire de 5%&#10;• Ajouter une position dans XYZ..."
              value={decisions}
              onChange={(e) => setDecisions(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-text-main">Suivis requis</label>
            <textarea
              className="w-full px-4 py-3 rounded-[var(--radius-sm)] border border-gray-200 bg-white text-sm text-text-main placeholder:text-text-light focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none transition-all resize-none"
              rows={3}
              placeholder="• Envoyer la documentation au client&#10;• Préparer la proposition de rééquilibrage..."
              value={followups}
              onChange={(e) => setFollowups(e.target.value)}
            />
          </div>

          <Input
            label="Prochaine rencontre"
            type="date"
            value={nextMeeting}
            onChange={(e) => setNextMeeting(e.target.value)}
          />
        </div>
      </Card>
    </div>
  );

  const renderAI = () => (
    <div className="space-y-4">
      {/* Recording card */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
            <Mic className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <h3 className="font-bold text-text-main font-[family-name:var(--font-heading)]">
              Enregistrement audio
            </h3>
            <p className="text-xs text-text-muted">Enregistrez la rencontre pour une transcription automatique</p>
          </div>
        </div>

        <div className="flex flex-col items-center py-6">
          {!isRecording ? (
            <button
              type="button"
              onClick={startRecording}
              disabled={transcribing}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white flex items-center justify-center shadow-lg shadow-red-200 hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50"
            >
              {transcribing ? <Loader2 className="h-8 w-8 animate-spin" /> : <Mic className="h-8 w-8" />}
            </button>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
                <button
                  type="button"
                  onClick={stopRecording}
                  className="relative w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white flex items-center justify-center shadow-lg"
                >
                  <Square className="h-8 w-8" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-lg font-bold text-text-main font-mono">{formatTime(recordingTime)}</span>
              </div>
            </div>
          )}
          <p className="text-xs text-text-muted mt-3">
            {transcribing
              ? 'Transcription en cours...'
              : isRecording
              ? "Cliquez pour arrêter l'enregistrement"
              : 'Cliquez pour commencer'}
          </p>
        </div>

        {/* Transcription area */}
        {(transcription || transcribing) && (
          <div className="mt-4 space-y-1.5">
            <label className="block text-sm font-semibold text-text-main">Transcription</label>
            <textarea
              className="w-full px-4 py-3 rounded-[var(--radius-sm)] border border-gray-200 bg-gray-50 text-sm text-text-main focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none transition-all resize-none"
              rows={6}
              value={transcription}
              onChange={(e) => setTranscription(e.target.value)}
              placeholder="La transcription apparaîtra ici..."
            />
          </div>
        )}
      </Card>

      {/* AI Summary card */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-50 to-amber-50 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-bold text-text-main font-[family-name:var(--font-heading)]">
                Résumé IA
              </h3>
              <p className="text-xs text-text-muted">Générez automatiquement vos notes et le récapitulatif client</p>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={generateSummary}
            loading={aiLoading}
          >
            <Sparkles className="h-4 w-4 mr-1" />
            Générer
          </Button>
        </div>

        {(aiSummaryAdvisor || aiSummaryClient) && (
          <div className="space-y-4">
            {aiSummaryAdvisor && (
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                <div className="flex items-center gap-2 mb-2">
                  <ClipboardList className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-bold text-blue-800">Notes Croesus (conseiller)</span>
                </div>
                <textarea
                  className="w-full bg-transparent text-sm text-blue-900 resize-none border-0 focus:ring-0 focus:outline-none"
                  rows={6}
                  value={aiSummaryAdvisor}
                  onChange={(e) => setAiSummaryAdvisor(e.target.value)}
                />
              </div>
            )}

            {aiSummaryClient && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-bold text-emerald-800">Récapitulatif client</span>
                </div>
                <textarea
                  className="w-full bg-transparent text-sm text-emerald-900 resize-none border-0 focus:ring-0 focus:outline-none"
                  rows={6}
                  value={aiSummaryClient}
                  onChange={(e) => setAiSummaryClient(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {!aiSummaryAdvisor && !aiSummaryClient && !aiLoading && (
          <div className="text-center py-8 text-text-muted">
            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">
              Ajoutez des notes ou enregistrez la rencontre, puis cliquez sur &laquo;Générer&raquo;
            </p>
          </div>
        )}
      </Card>
    </div>
  );

  const renderStep = () => {
    switch (step) {
      case 0: return renderInfo();
      case 1: return renderCompliance();
      case 2: return renderNotes();
      case 3: return renderAI();
      default: return null;
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Nouvelle rencontre"
        description="Documentez votre rencontre client étape par étape"
        action={
          <Button variant="ghost" onClick={() => router.push('/meeting-notes')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        }
      />

      <ProgressBar step={step} total={STEPS.length} />

      {/* Step content */}
      <div className="mb-6">{renderStep()}</div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div>
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Précédent
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => handleSave('draft')}
            loading={saving}
          >
            <Save className="h-4 w-4 mr-2" />
            Brouillon
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              variant="primary"
              onClick={() => setStep(step + 1)}
              disabled={!canGoNext()}
            >
              Suivant
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => handleSave('completed')}
              loading={saving}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Compléter
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
