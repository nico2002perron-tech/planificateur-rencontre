'use client';

import { useState, useEffect, useRef, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Spinner, PageSpinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useMeetingNote } from '@/lib/hooks/useMeetingNotes';
import {
  ArrowLeft, Save, CheckCircle2, Mic, MicOff, Square,
  Sparkles, User, Calendar, Phone, Monitor, Users as UsersIcon,
  ClipboardList, FileText, MessageSquare, AlertCircle,
  ChevronDown, ChevronUp, Loader2, Copy, Check,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────
type ComplianceValue = 'oui' | 'non' | 'na' | '';

// ─── Constants ──────────────────────────────────────────────────
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

const COMPLIANCE_QUESTIONS = [
  { id: 'q_objectifs', label: 'Les objectifs de placement ont-ils été discutés?', section: 'intro' },
  { id: 'q_horizon', label: "L'horizon de placement a-t-il été discuté?", section: 'intro' },
  { id: 'q_tolerance', label: 'La tolérance au risque a-t-elle été discutée?', section: 'intro' },
  { id: 'q_situation', label: 'La situation financière a-t-elle été discutée?', section: 'intro' },
  { id: 'q_liquidite', label: 'Les besoins en liquidité ont-ils été discutés?', section: 'intro' },
  { id: 'q_recommande', label: 'Le titre a-t-il été recommandé par le conseiller?', section: 'placement' },
  { id: 'q_risques', label: 'Le client a-t-il été informé des risques?', section: 'placement' },
  { id: 'q_comprend', label: 'Le client comprend-il la nature du placement?', section: 'placement' },
  { id: 'q_conforme', label: "Le placement est-il conforme au profil d'investisseur?", section: 'placement' },
  { id: 'q_conflit', label: "Y a-t-il un conflit d'intérêts potentiel?", section: 'placement' },
  { id: 'q_repartition', label: "La répartition d'actifs a-t-elle été revue?", section: 'revision' },
  { id: 'q_non_conforme', label: 'Les placements non conformes ont-ils été identifiés?', section: 'revision' },
  { id: 'q_concentration', label: 'La concentration a-t-elle été vérifiée?', section: 'revision' },
  { id: 'q_rendements', label: 'Les rendements ont-ils été discutés avec le client?', section: 'revision' },
  { id: 'q_frais', label: 'Les frais ont-ils été discutés?', section: 'revision' },
  { id: 'q_changements', label: 'Les changements de situation personnelle ont-ils été vérifiés?', section: 'revision' },
] as const;

const SECTION_LABELS: Record<string, string> = {
  intro: 'Introduction',
  placement: 'Placements',
  revision: 'Révision du portefeuille',
};

// ─── Three-state toggle ─────────────────────────────────────────
function ComplianceToggle({ value, onChange }: { value: ComplianceValue; onChange: (v: ComplianceValue) => void }) {
  const opts: { val: ComplianceValue; label: string; active: string }[] = [
    { val: 'oui', label: 'Oui', active: 'bg-emerald-500 text-white shadow-emerald-200' },
    { val: 'non', label: 'Non', active: 'bg-red-500 text-white shadow-red-200' },
    { val: 'na', label: 'N/A', active: 'bg-gray-400 text-white shadow-gray-200' },
  ];
  return (
    <div className="flex gap-1 bg-gray-100 rounded-full p-0.5">
      {opts.map((o) => (
        <button
          key={o.val}
          type="button"
          onClick={() => onChange(value === o.val ? '' : o.val)}
          className={`px-3 py-1 text-xs font-bold rounded-full transition-all duration-200 ${
            value === o.val ? `${o.active} shadow-sm scale-105` : 'text-text-muted hover:text-text-main'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Copy button ─────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="p-1.5 rounded-lg hover:bg-white/50 transition-colors"
      title="Copier"
    >
      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-current opacity-60" />}
    </button>
  );
}

// ─── Main page ───────────────────────────────────────────────────
export default function MeetingNoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const { note, isLoading, mutate } = useMeetingNote(id);

  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'compliance' | 'notes' | 'ai'>('details');

  // Editable state
  const [clientName, setClientName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingType, setMeetingType] = useState('in_person');
  const [subject, setSubject] = useState('revision');
  const [compliance, setCompliance] = useState<Record<string, ComplianceValue>>({});
  const [hasTransaction, setHasTransaction] = useState(false);
  const [transaction, setTransaction] = useState({ solicited: true, type: '', orderType: '', price: '', quantity: '', symbol: '' });
  const [topics, setTopics] = useState('');
  const [decisions, setDecisions] = useState('');
  const [followups, setFollowups] = useState('');
  const [nextMeeting, setNextMeeting] = useState('');
  const [transcription, setTranscription] = useState('');
  const [aiSummaryAdvisor, setAiSummaryAdvisor] = useState('');
  const [aiSummaryClient, setAiSummaryClient] = useState('');
  const [status, setStatus] = useState<'draft' | 'completed'>('draft');
  const [aiLoading, setAiLoading] = useState(false);

  // Recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Expanded sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ intro: true, placement: true, revision: true });

  // Load note data
  useEffect(() => {
    if (!note) return;
    setClientName(note.client_name || '');
    setAccountNumber(note.account_number || '');
    setMeetingDate(note.meeting_date || '');
    setMeetingTime(note.meeting_time || '');
    setMeetingType(note.meeting_type || 'in_person');
    setSubject(note.subject || 'revision');
    setCompliance((note.compliance as Record<string, ComplianceValue>) || {});
    setHasTransaction(!!note.transaction);
    if (note.transaction) {
      setTransaction({
        solicited: note.transaction.solicited ?? true,
        type: note.transaction.type || '',
        orderType: note.transaction.orderType || '',
        price: note.transaction.price?.toString() || '',
        quantity: note.transaction.quantity?.toString() || '',
        symbol: note.transaction.symbol || '',
      });
    }
    setTopics(note.notes?.topics || '');
    setDecisions(note.notes?.decisions || '');
    setFollowups(note.notes?.followups || '');
    setNextMeeting(note.notes?.nextMeeting || '');
    setTranscription(note.transcription || '');
    setAiSummaryAdvisor(note.ai_summary_advisor || '');
    setAiSummaryClient(note.ai_summary_client || '');
    setStatus(note.status);
  }, [note]);

  const toggleSection = (s: string) => setExpandedSections((prev) => ({ ...prev, [s]: !prev[s] }));

  // Recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (blob.size < 1000) { toast('warning', 'Enregistrement trop court'); return; }
        setTranscribing(true);
        try {
          const formData = new FormData();
          formData.append('file', blob, 'recording.webm');
          formData.append('model', 'whisper-large-v3');
          formData.append('language', 'fr');
          formData.append('response_format', 'text');
          const res = await fetch('/api/ai/transcribe', { method: 'POST', body: formData });
          if (res.ok) {
            const data = await res.json();
            setTranscription((prev) => (prev ? prev + '\n\n' : '') + data.text);
            toast('success', 'Transcription terminée');
          } else { toast('error', 'Erreur de transcription'); }
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
        if (data.topics_discussed?.length && !topics) setTopics(data.topics_discussed.join('\n• '));
        if (data.decisions?.length && !decisions) setDecisions(data.decisions.join('\n• '));
        if (data.action_items?.length && !followups) setFollowups(data.action_items.join('\n• '));
        toast('success', 'Résumés générés avec succès');
      } else { toast('error', "Erreur lors de la génération"); }
    } catch { toast('error', 'Erreur de connexion'); } finally { setAiLoading(false); }
  };

  // Save
  const handleSave = async (newStatus?: 'draft' | 'completed') => {
    const finalStatus = newStatus || status;
    if (!clientName.trim()) { toast('warning', 'Veuillez entrer le nom du client'); return; }
    setSaving(true);
    try {
      const body = {
        client_name: clientName, account_number: accountNumber,
        meeting_date: meetingDate, meeting_time: meetingTime,
        meeting_type: meetingType, subject, compliance,
        transaction: hasTransaction ? { ...transaction, price: transaction.price ? parseFloat(transaction.price) : undefined, quantity: transaction.quantity ? parseFloat(transaction.quantity) : undefined } : null,
        notes: { topics, decisions, followups, nextMeeting },
        transcription: transcription || null,
        ai_summary_advisor: aiSummaryAdvisor || null,
        ai_summary_client: aiSummaryClient || null,
        status: finalStatus,
      };
      const res = await fetch(`/api/meeting-notes/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) {
        setStatus(finalStatus);
        toast('success', finalStatus === 'completed' ? 'Note complétée' : 'Modifications sauvegardées');
        mutate();
      } else { toast('error', 'Erreur lors de la sauvegarde'); }
    } catch { toast('error', 'Erreur de connexion'); } finally { setSaving(false); }
  };

  const formatDate = (d: string) => {
    try { return new Intl.DateTimeFormat('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(d)); }
    catch { return d; }
  };

  if (isLoading) return <PageSpinner />;
  if (!note) return (
    <div className="text-center py-20">
      <p className="text-text-muted">Note introuvable</p>
      <Button variant="ghost" className="mt-4" onClick={() => router.push('/meeting-notes')}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Retour
      </Button>
    </div>
  );

  const tabs = [
    { id: 'details' as const, label: 'Détails', icon: User },
    { id: 'compliance' as const, label: 'Conformité', icon: ClipboardList },
    { id: 'notes' as const, label: 'Notes', icon: FileText },
    { id: 'ai' as const, label: 'IA', icon: Sparkles },
  ];

  const complianceAnswered = Object.values(compliance).filter(v => v !== '').length;

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title={clientName || 'Note de réunion'}
        description={`${formatDate(meetingDate)}${meetingTime ? ` à ${meetingTime}` : ''}`}
        action={
          <div className="flex items-center gap-2">
            <Badge variant={status === 'completed' ? 'success' : 'warning'}>
              {status === 'completed' ? 'Complétée' : 'Brouillon'}
            </Badge>
            <Button variant="ghost" onClick={() => router.push('/meeting-notes')}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Retour
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                active ? 'bg-white text-brand-primary shadow-sm' : 'text-text-muted hover:text-text-main'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:block">{t.label}</span>
              {t.id === 'compliance' && complianceAnswered > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  complianceAnswered === COMPLIANCE_QUESTIONS.length ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {complianceAnswered}/{COMPLIANCE_QUESTIONS.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="mb-6">
        {activeTab === 'details' && (
          <div className="space-y-4">
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="font-bold text-text-main font-[family-name:var(--font-heading)]">Client</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Nom du client *" value={clientName} onChange={(e) => setClientName(e.target.value)} />
                <Input label="No. de compte" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-purple-600" />
                </div>
                <h3 className="font-bold text-text-main font-[family-name:var(--font-heading)]">Rencontre</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <Input label="Date" type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
                <Input label="Heure" type="time" value={meetingTime} onChange={(e) => setMeetingTime(e.target.value)} />
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-text-main">Type</label>
                  <div className="flex gap-2">
                    {MEETING_TYPES.map((mt) => {
                      const Icon = mt.icon;
                      return (
                        <button key={mt.value} type="button" onClick={() => setMeetingType(mt.value)}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all duration-200 ${
                            meetingType === mt.value ? 'border-brand-primary bg-brand-primary/5 text-brand-primary shadow-sm' : 'border-gray-200 text-text-muted hover:border-gray-300'
                          }`}>
                          <Icon className="h-4 w-4" />{mt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-text-main">Sujet</label>
                  <div className="flex gap-2 flex-wrap">
                    {SUBJECTS.map((s) => (
                      <button key={s.value} type="button" onClick={() => setSubject(s.value)}
                        className={`px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all duration-200 ${
                          subject === s.value ? 'border-brand-primary bg-brand-primary/5 text-brand-primary shadow-sm' : 'border-gray-200 text-text-muted hover:border-gray-300'
                        }`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'compliance' && (
          <div className="space-y-4">
            {/* Progress */}
            <Card padding="sm">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-text-main">Checklist de conformité</span>
                    <span className="text-sm font-bold text-brand-primary">{complianceAnswered}/{COMPLIANCE_QUESTIONS.length}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${
                      complianceAnswered === COMPLIANCE_QUESTIONS.length ? 'bg-emerald-500' : complianceAnswered > 8 ? 'bg-brand-primary' : 'bg-amber-400'
                    }`} style={{ width: `${(complianceAnswered / COMPLIANCE_QUESTIONS.length) * 100}%` }} />
                  </div>
                </div>
                {complianceAnswered === COMPLIANCE_QUESTIONS.length && (
                  <div className="flex items-center gap-1 text-emerald-600 text-sm font-bold">
                    <CheckCircle2 className="h-5 w-5" /> Complet
                  </div>
                )}
              </div>
            </Card>

            {(['intro', 'placement', 'revision'] as const).map((section) => {
              const questions = COMPLIANCE_QUESTIONS.filter((q) => q.section === section);
              const expanded = expandedSections[section];
              const sectionAnswered = questions.filter((q) => compliance[q.id] && compliance[q.id] !== '').length;
              return (
                <Card key={section}>
                  <button type="button" onClick={() => toggleSection(section)} className="w-full flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                        sectionAnswered === questions.length ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-text-muted'
                      }`}>
                        {sectionAnswered === questions.length ? <CheckCircle2 className="h-4 w-4" /> : `${sectionAnswered}/${questions.length}`}
                      </div>
                      <h3 className="font-bold text-text-main font-[family-name:var(--font-heading)]">{SECTION_LABELS[section]}</h3>
                    </div>
                    {expanded ? <ChevronUp className="h-5 w-5 text-text-muted" /> : <ChevronDown className="h-5 w-5 text-text-muted" />}
                  </button>
                  {expanded && (
                    <div className="mt-4 space-y-3">
                      {questions.map((q, i) => (
                        <div key={q.id} className={`flex items-center justify-between gap-4 py-2.5 ${i < questions.length - 1 ? 'border-b border-gray-100' : ''}`}>
                          <span className="text-sm text-text-main flex-1">{q.label}</span>
                          <ComplianceToggle
                            value={(compliance[q.id] as ComplianceValue) || ''}
                            onChange={(v) => setCompliance((prev) => ({ ...prev, [q.id]: v }))}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}

            {/* Transaction */}
            {(subject === 'placement' || subject === 'both') && (
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                      <AlertCircle className="h-4 w-4 text-amber-700" />
                    </div>
                    <h3 className="font-bold text-text-main font-[family-name:var(--font-heading)]">Transaction</h3>
                  </div>
                  <button type="button" onClick={() => setHasTransaction(!hasTransaction)}
                    className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${hasTransaction ? 'bg-brand-primary' : 'bg-gray-300'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${hasTransaction ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
                {hasTransaction && (
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-text-main">Sollicité par le conseiller?</span>
                      <div className="flex gap-1 bg-gray-100 rounded-full p-0.5">
                        {[true, false].map((val) => (
                          <button key={String(val)} type="button" onClick={() => setTransaction(t => ({ ...t, solicited: val }))}
                            className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
                              transaction.solicited === val ? 'bg-brand-primary text-white shadow-sm' : 'text-text-muted'
                            }`}>
                            {val ? 'Oui' : 'Non'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Select label="Type" options={[{ value: 'buy', label: 'Achat' }, { value: 'sell', label: 'Vente' }, { value: 'switch', label: 'Échange' }]}
                        placeholder="Sélectionner..." value={transaction.type} onChange={(e) => setTransaction(t => ({ ...t, type: e.target.value }))} />
                      <Select label="Type d'ordre" options={[{ value: 'market', label: 'Au marché' }, { value: 'limit', label: 'Limité' }, { value: 'stop', label: 'Stop' }]}
                        placeholder="Sélectionner..." value={transaction.orderType} onChange={(e) => setTransaction(t => ({ ...t, orderType: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <Input label="Symbole" value={transaction.symbol} onChange={(e) => setTransaction(t => ({ ...t, symbol: e.target.value }))} />
                      <Input label="Quantité" type="number" value={transaction.quantity} onChange={(e) => setTransaction(t => ({ ...t, quantity: e.target.value }))} />
                      <Input label="Prix" type="number" step="0.01" value={transaction.price} onChange={(e) => setTransaction(t => ({ ...t, price: e.target.value }))} />
                    </div>
                  </div>
                )}
              </Card>
            )}
          </div>
        )}

        {activeTab === 'notes' && (
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-purple-600" />
              </div>
              <h3 className="font-bold text-text-main font-[family-name:var(--font-heading)]">Notes de la rencontre</h3>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-text-main">Sujets discutés</label>
                <textarea className="w-full px-4 py-3 rounded-[var(--radius-sm)] border border-gray-200 bg-white text-sm text-text-main placeholder:text-text-light focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none transition-all resize-none"
                  rows={3} value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="• Sujets discutés..." />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-text-main">Décisions prises</label>
                <textarea className="w-full px-4 py-3 rounded-[var(--radius-sm)] border border-gray-200 bg-white text-sm text-text-main placeholder:text-text-light focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none transition-all resize-none"
                  rows={3} value={decisions} onChange={(e) => setDecisions(e.target.value)} placeholder="• Décisions prises..." />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-text-main">Suivis requis</label>
                <textarea className="w-full px-4 py-3 rounded-[var(--radius-sm)] border border-gray-200 bg-white text-sm text-text-main placeholder:text-text-light focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none transition-all resize-none"
                  rows={3} value={followups} onChange={(e) => setFollowups(e.target.value)} placeholder="• Suivis requis..." />
              </div>
              <Input label="Prochaine rencontre" type="date" value={nextMeeting} onChange={(e) => setNextMeeting(e.target.value)} />
            </div>
          </Card>
        )}

        {activeTab === 'ai' && (
          <div className="space-y-4">
            {/* Recording */}
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                  <Mic className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <h3 className="font-bold text-text-main font-[family-name:var(--font-heading)]">Enregistrement</h3>
                  <p className="text-xs text-text-muted">Ajoutez un enregistrement supplémentaire</p>
                </div>
              </div>
              <div className="flex flex-col items-center py-4">
                {!isRecording ? (
                  <button type="button" onClick={startRecording} disabled={transcribing}
                    className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white flex items-center justify-center shadow-lg shadow-red-200 hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50">
                    {transcribing ? <Loader2 className="h-6 w-6 animate-spin" /> : <Mic className="h-6 w-6" />}
                  </button>
                ) : (
                  <div className="flex flex-col items-center gap-3">
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
                  </div>
                )}
              </div>
              {(transcription || transcribing) && (
                <div className="mt-2 space-y-1.5">
                  <label className="block text-sm font-semibold text-text-main">Transcription</label>
                  <textarea className="w-full px-4 py-3 rounded-[var(--radius-sm)] border border-gray-200 bg-gray-50 text-sm text-text-main focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none transition-all resize-none"
                    rows={5} value={transcription} onChange={(e) => setTranscription(e.target.value)} />
                </div>
              )}
            </Card>

            {/* AI Summary */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-50 to-amber-50 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                  </div>
                  <h3 className="font-bold text-text-main font-[family-name:var(--font-heading)]">Résumé IA</h3>
                </div>
                <Button variant="primary" size="sm" onClick={generateSummary} loading={aiLoading}>
                  <Sparkles className="h-4 w-4 mr-1" /> {aiSummaryAdvisor ? 'Regénérer' : 'Générer'}
                </Button>
              </div>

              {(aiSummaryAdvisor || aiSummaryClient) ? (
                <div className="space-y-4">
                  {aiSummaryAdvisor && (
                    <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <ClipboardList className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-bold text-blue-800">Notes Croesus</span>
                        </div>
                        <CopyButton text={aiSummaryAdvisor} />
                      </div>
                      <textarea className="w-full bg-transparent text-sm text-blue-900 resize-none border-0 focus:ring-0 focus:outline-none"
                        rows={6} value={aiSummaryAdvisor} onChange={(e) => setAiSummaryAdvisor(e.target.value)} />
                    </div>
                  )}
                  {aiSummaryClient && (
                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-emerald-600" />
                          <span className="text-sm font-bold text-emerald-800">Récapitulatif client</span>
                        </div>
                        <CopyButton text={aiSummaryClient} />
                      </div>
                      <textarea className="w-full bg-transparent text-sm text-emerald-900 resize-none border-0 focus:ring-0 focus:outline-none"
                        rows={6} value={aiSummaryClient} onChange={(e) => setAiSummaryClient(e.target.value)} />
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 text-text-muted">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Cliquez sur &laquo;Générer&raquo; pour créer les résumés</p>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* Save bar */}
      <div className="flex items-center justify-between sticky bottom-4 bg-white/90 backdrop-blur rounded-xl shadow-lg border border-gray-200 px-4 py-3">
        <div className="text-sm text-text-muted">
          Dernière modification: {note.updated_at ? formatDate(note.updated_at) : '—'}
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => handleSave('draft')} loading={saving}>
            <Save className="h-4 w-4 mr-2" /> Sauvegarder
          </Button>
          {status !== 'completed' && (
            <Button variant="primary" onClick={() => handleSave('completed')} loading={saving}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> Compléter
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
