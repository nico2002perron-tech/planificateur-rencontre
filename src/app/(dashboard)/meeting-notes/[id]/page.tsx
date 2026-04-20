'use client';

import { useState, useEffect, useRef, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { PageSpinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { AudioWaveform } from '@/components/meeting-notes/AudioWaveform';
import { useMeetingNote, type MeetingTransaction } from '@/lib/hooks/useMeetingNotes';
import {
  ArrowLeft, Save, CheckCircle2, Mic, Square,
  Sparkles, User, Calendar, Phone, Monitor, Users as UsersIcon,
  ClipboardList, FileText, MessageSquare, Loader2, Copy, Check,
  Plus, X, ShoppingCart, ArrowDownRight, ArrowUpRight, ArrowLeftRight,
  ReceiptText, List, Zap,
} from 'lucide-react';

// ─── Types & Constants ──────────────────────────────────────────
type ComplianceValue = 'oui' | 'non' | 'na' | '';

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

interface ComplianceQuestion { id: string; label: string; section: 'intro' | 'placement' | 'revision'; hint?: string }

const COMPLIANCE_QUESTIONS: ComplianceQuestion[] = [
  { id: 'q_objectifs', label: 'Objectifs de placement discutés?', section: 'intro' },
  { id: 'q_horizon', label: 'Horizon de placement discuté?', section: 'intro' },
  { id: 'q_tolerance', label: 'Tolérance au risque discutée?', section: 'intro' },
  { id: 'q_situation', label: 'Situation financière discutée?', section: 'intro' },
  { id: 'q_liquidite', label: 'Besoins en liquidité discutés?', section: 'intro' },
  { id: 'q_recommande', label: 'Titre recommandé par le conseiller?', section: 'placement' },
  { id: 'q_risques', label: 'Client informé des risques?', section: 'placement' },
  { id: 'q_comprend', label: 'Client comprend la nature du placement?', section: 'placement' },
  { id: 'q_conforme', label: "Conforme au profil d'investisseur?", section: 'placement' },
  { id: 'q_conflit', label: "Conflit d'intérêts potentiel?", section: 'placement' },
  { id: 'q_repartition', label: "Répartition d'actifs revue?", section: 'revision' },
  { id: 'q_non_conforme', label: 'Placements non conformes identifiés?', section: 'revision' },
  { id: 'q_concentration', label: 'Concentration vérifiée?', section: 'revision' },
  { id: 'q_rendements', label: 'Rendements discutés avec le client?', section: 'revision' },
  { id: 'q_frais', label: 'Frais discutés?', section: 'revision' },
  { id: 'q_changements', label: 'Changements de situation vérifiés?', section: 'revision' },
];

const SECTION_LABELS: Record<string, string> = { intro: 'Introduction', placement: 'Placements', revision: 'Révision du portefeuille' };

function getFilteredQuestions(subject: string) {
  return COMPLIANCE_QUESTIONS.filter((q) => {
    if (q.section === 'intro') return true;
    if (q.section === 'placement') return subject === 'placement' || subject === 'both';
    if (q.section === 'revision') return subject === 'revision' || subject === 'both';
    return false;
  });
}

const TX_ICONS: Record<string, { icon: typeof ArrowUpRight; color: string; label: string }> = {
  buy: { icon: ArrowUpRight, color: 'text-emerald-600 bg-emerald-50', label: 'Achat' },
  sell: { icon: ArrowDownRight, color: 'text-red-600 bg-red-50', label: 'Vente' },
  switch: { icon: ArrowLeftRight, color: 'text-blue-600 bg-blue-50', label: 'Échange' },
};

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
export default function MeetingNoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const { note, isLoading, mutate } = useMeetingNote(id);

  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'compliance' | 'notes' | 'ai' | 'recap'>('details');

  // Editable state
  const [clientName, setClientName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingType, setMeetingType] = useState('in_person');
  const [subject, setSubject] = useState('revision');
  const [compliance, setCompliance] = useState<Record<string, ComplianceValue>>({});
  const [transactions, setTransactions] = useState<MeetingTransaction[]>([]);
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
  const streamRef = useRef<MediaStream | null>(null);

  // Load note
  useEffect(() => {
    if (!note) return;
    setClientName(note.client_name || '');
    setAccountNumber(note.account_number || '');
    setMeetingDate(note.meeting_date || '');
    setMeetingTime(note.meeting_time || '');
    setMeetingType(note.meeting_type || 'in_person');
    setSubject(note.subject || 'revision');
    setCompliance((note.compliance as Record<string, ComplianceValue>) || {});
    setTransactions(note.transaction || []);
    setTopics(note.notes?.topics || '');
    setDecisions(note.notes?.decisions || '');
    setFollowups(note.notes?.followups || '');
    setNextMeeting(note.notes?.nextMeeting || '');
    setTranscription(note.transcription || '');
    setAiSummaryAdvisor(note.ai_summary_advisor || '');
    setAiSummaryClient(note.ai_summary_client || '');
    setStatus(note.status);
  }, [note]);

  const filteredQuestions = getFilteredQuestions(subject);
  const complianceAnswered = filteredQuestions.filter((q) => compliance[q.id] && compliance[q.id] !== '').length;

  // Transaction helpers
  const addTransaction = () => setTransactions((prev) => [...prev, { id: crypto.randomUUID(), type: 'buy', symbol: '', quantity: '', price: '', solicited: true, orderType: 'market' }]);
  const updateTransaction = (txId: string, patch: Partial<MeetingTransaction>) => setTransactions((prev) => prev.map((t) => t.id === txId ? { ...t, ...patch } : t));
  const removeTransaction = (txId: string) => setTransactions((prev) => prev.filter((t) => t.id !== txId));

  // Recording
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

  // AI Summary
  const generateSummary = async () => {
    const hasCompliance = Object.values(compliance).some((v) => v !== '');
    const manualNotes = [topics, decisions, followups].filter(Boolean).join('\n\n');
    if (!transcription && !manualNotes && !hasCompliance) { toast('warning', 'Ajoutez du contenu pour générer le résumé'); return; }
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/meeting-summary', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcription, manualNotes, complianceAnswers: compliance,
          meetingContext: { clientName, meetingType, subject, meetingDate, transactions: transactions.length > 0 ? transactions : undefined },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiSummaryAdvisor(data.advisor_summary || ''); setAiSummaryClient(data.client_summary || '');
        if (data.topics_discussed?.length && !topics) setTopics(data.topics_discussed.join('\n• '));
        if (data.decisions?.length && !decisions) setDecisions(data.decisions.join('\n• '));
        if (data.action_items?.length && !followups) setFollowups(data.action_items.join('\n• '));
        toast('success', 'Résumés générés');
      } else toast('error', 'Erreur lors de la génération');
    } catch { toast('error', 'Erreur de connexion'); } finally { setAiLoading(false); }
  };

  // Save
  const handleSave = async (newStatus?: 'draft' | 'completed') => {
    const finalStatus = newStatus || status;
    if (!clientName.trim()) { toast('warning', 'Entrez le nom du client'); return; }
    setSaving(true);
    try {
      const body = {
        client_name: clientName, account_number: accountNumber, meeting_date: meetingDate, meeting_time: meetingTime,
        meeting_type: meetingType, subject, compliance, transaction: transactions.length > 0 ? transactions : null,
        notes: { topics, decisions, followups, nextMeeting }, transcription: transcription || null,
        ai_summary_advisor: aiSummaryAdvisor || null, ai_summary_client: aiSummaryClient || null, status: finalStatus,
      };
      const res = await fetch(`/api/meeting-notes/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) { setStatus(finalStatus); toast('success', finalStatus === 'completed' ? 'Note complétée' : 'Sauvegardé'); mutate(); }
      else toast('error', 'Erreur lors de la sauvegarde');
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
      <Button variant="ghost" className="mt-4" onClick={() => router.push('/meeting-notes')}><ArrowLeft className="h-4 w-4 mr-2" />Retour</Button>
    </div>
  );

  const tabs = [
    { id: 'details' as const, label: 'Détails', icon: User },
    { id: 'compliance' as const, label: 'Conformité', icon: ClipboardList },
    { id: 'notes' as const, label: 'Notes', icon: FileText },
    { id: 'ai' as const, label: 'IA', icon: Sparkles },
    { id: 'recap' as const, label: 'Récap', icon: ReceiptText },
  ];

  const nonAnswers = filteredQuestions.filter((q) => compliance[q.id] === 'non');

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title={clientName || 'Note de réunion'} description={`${formatDate(meetingDate)}${meetingTime ? ` à ${meetingTime}` : ''}`}
        action={<div className="flex items-center gap-2">
          <Badge variant={status === 'completed' ? 'success' : 'warning'}>{status === 'completed' ? 'Complétée' : 'Brouillon'}</Badge>
          <Button variant="ghost" onClick={() => router.push('/meeting-notes')}><ArrowLeft className="h-4 w-4 mr-2" />Retour</Button>
        </div>} />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon; const active = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                active ? 'bg-white text-brand-primary shadow-sm' : 'text-text-muted hover:text-text-main'
              }`}>
              <Icon className="h-4 w-4" />
              <span className="hidden sm:block">{t.label}</span>
              {t.id === 'compliance' && complianceAnswered > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${complianceAnswered === filteredQuestions.length ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {complianceAnswered}/{filteredQuestions.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="mb-6">
        {/* Details tab */}
        {activeTab === 'details' && (
          <div className="space-y-4">
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><User className="h-5 w-5 text-blue-600" /></div>
                <h3 className="font-bold text-text-main font-[family-name:var(--font-heading)]">Client</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Nom du client *" value={clientName} onChange={(e) => setClientName(e.target.value)} />
                <Input label="No. de compte" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center"><Calendar className="h-5 w-5 text-purple-600" /></div>
                <h3 className="font-bold text-text-main font-[family-name:var(--font-heading)]">Rencontre</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <Input label="Date" type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
                <Input label="Heure" type="time" value={meetingTime} onChange={(e) => setMeetingTime(e.target.value)} />
              </div>
              <div className="space-y-3">
                <div><label className="block text-sm font-semibold text-text-main mb-1.5">Type</label>
                  <div className="flex gap-2">{MEETING_TYPES.map((mt) => { const Icon = mt.icon; return (
                    <button key={mt.value} type="button" onClick={() => setMeetingType(mt.value)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                        meetingType === mt.value ? 'border-brand-primary bg-brand-primary/5 text-brand-primary shadow-sm' : 'border-gray-200 text-text-muted hover:border-gray-300'}`}>
                      <Icon className="h-4 w-4" />{mt.label}</button>); })}</div>
                </div>
                <div><label className="block text-sm font-semibold text-text-main mb-1.5">Sujet</label>
                  <div className="flex gap-2 flex-wrap">{SUBJECTS.map((s) => (
                    <button key={s.value} type="button" onClick={() => setSubject(s.value)}
                      className={`px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                        subject === s.value ? 'border-brand-primary bg-brand-primary/5 text-brand-primary shadow-sm' : 'border-gray-200 text-text-muted hover:border-gray-300'}`}>
                      {s.label}</button>))}</div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Compliance tab */}
        {activeTab === 'compliance' && (
          <div className="space-y-4">
            <Card padding="sm">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-text-main">Conformité</span>
                <span className="text-sm font-bold text-brand-primary">{complianceAnswered}/{filteredQuestions.length}</span>
                {complianceAnswered === filteredQuestions.length && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                <div className="flex-1" />
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-2">
                <div className={`h-full rounded-full transition-all duration-500 ${complianceAnswered === filteredQuestions.length ? 'bg-emerald-500' : complianceAnswered > filteredQuestions.length / 2 ? 'bg-brand-primary' : 'bg-amber-400'}`}
                  style={{ width: `${filteredQuestions.length ? (complianceAnswered / filteredQuestions.length) * 100 : 0}%` }} />
              </div>
            </Card>
            {(['intro', 'placement', 'revision'] as const).filter((s) => filteredQuestions.some((q) => q.section === s)).map((section) => {
              const questions = filteredQuestions.filter((q) => q.section === section);
              return (
                <Card key={section}>
                  <h3 className="font-bold text-text-main font-[family-name:var(--font-heading)] text-sm mb-3">{SECTION_LABELS[section]}</h3>
                  <div className="space-y-2">
                    {questions.map((q, i) => (
                      <div key={q.id} className={`flex items-center justify-between gap-3 py-2 ${i < questions.length - 1 ? 'border-b border-gray-100' : ''}`}>
                        <span className="text-sm text-text-main">{q.label}</span>
                        <div className="flex gap-1 bg-gray-100 rounded-full p-0.5 flex-shrink-0">
                          {([['oui', 'Oui', 'bg-emerald-500 text-white'], ['non', 'Non', 'bg-red-500 text-white'], ['na', 'N/A', 'bg-gray-400 text-white']] as const).map(([val, label, active]) => (
                            <button key={val} type="button" onClick={() => setCompliance((prev) => ({ ...prev, [q.id]: prev[q.id] === val ? '' : val }))}
                              className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all ${compliance[q.id] === val ? `${active} shadow-sm` : 'text-text-muted hover:text-text-main'}`}>{label}</button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}

            {/* Transactions */}
            {(subject === 'placement' || subject === 'both') && (
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-amber-600" />
                    <h3 className="font-bold text-text-main font-[family-name:var(--font-heading)] text-sm">Transactions</h3></div>
                  <Button variant="ghost" size="sm" onClick={addTransaction}><Plus className="h-3.5 w-3.5 mr-1" />Ajouter</Button>
                </div>
                {transactions.length === 0 && <p className="text-sm text-text-muted text-center py-4">Aucune transaction</p>}
                <div className="space-y-2">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center gap-2 p-2 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="flex gap-0.5 bg-white rounded-lg p-0.5 border border-gray-200">
                        {(['buy', 'sell', 'switch'] as const).map((t) => {
                          const s = TX_ICONS[t]; const Icon = s.icon;
                          return (<button key={t} type="button" onClick={() => updateTransaction(tx.id, { type: t })}
                            className={`p-1.5 rounded-md transition-all ${tx.type === t ? s.color : 'text-gray-400 hover:text-gray-600'}`} title={s.label}><Icon className="h-4 w-4" /></button>);
                        })}
                      </div>
                      <input className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-gray-200 text-sm bg-white focus:border-brand-primary focus:outline-none"
                        placeholder="Symbole" value={tx.symbol} onChange={(e) => updateTransaction(tx.id, { symbol: e.target.value.toUpperCase() })} />
                      <input className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 text-sm bg-white focus:border-brand-primary focus:outline-none"
                        type="number" placeholder="Qté" value={tx.quantity} onChange={(e) => updateTransaction(tx.id, { quantity: e.target.value })} />
                      <input className="w-24 px-2 py-1.5 rounded-lg border border-gray-200 text-sm bg-white focus:border-brand-primary focus:outline-none"
                        type="number" step="0.01" placeholder="Prix $" value={tx.price} onChange={(e) => updateTransaction(tx.id, { price: e.target.value })} />
                      <button type="button" onClick={() => removeTransaction(tx.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-text-muted hover:text-red-500 transition-colors"><X className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Notes tab */}
        {activeTab === 'notes' && (
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center"><MessageSquare className="h-5 w-5 text-purple-600" /></div>
              <h3 className="font-bold text-text-main font-[family-name:var(--font-heading)]">Notes</h3>
            </div>
            <div className="space-y-3">
              <div className="space-y-1"><label className="block text-xs font-semibold text-text-main">Sujets discutés</label>
                <textarea className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-gray-200 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none resize-none"
                  rows={3} value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="• Sujets..." /></div>
              <div className="space-y-1"><label className="block text-xs font-semibold text-text-main">Décisions prises</label>
                <textarea className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-gray-200 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none resize-none"
                  rows={3} value={decisions} onChange={(e) => setDecisions(e.target.value)} placeholder="• Décisions..." /></div>
              <div className="space-y-1"><label className="block text-xs font-semibold text-text-main">Suivis requis</label>
                <textarea className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-gray-200 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none resize-none"
                  rows={3} value={followups} onChange={(e) => setFollowups(e.target.value)} placeholder="• Suivis..." /></div>
              <Input label="Prochaine rencontre" type="date" value={nextMeeting} onChange={(e) => setNextMeeting(e.target.value)} />
            </div>
          </Card>
        )}

        {/* AI tab */}
        {activeTab === 'ai' && (
          <div className="space-y-4">
            <Card>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center"><Mic className="h-5 w-5 text-red-500" /></div>
                <div><h3 className="font-bold text-text-main font-[family-name:var(--font-heading)] text-sm">Enregistrement</h3>
                  <p className="text-xs text-text-muted">Optionnel — le résumé fonctionne aussi sans audio</p></div>
              </div>
              <div className="flex flex-col items-center py-4">
                {!isRecording ? (
                  <button type="button" onClick={startRecording} disabled={transcribing}
                    className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white flex items-center justify-center shadow-lg shadow-red-200 hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50">
                    {transcribing ? <Loader2 className="h-6 w-6 animate-spin" /> : <Mic className="h-6 w-6" />}
                  </button>
                ) : (
                  <div className="flex flex-col items-center gap-3 w-full">
                    <div className="relative"><div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
                      <button type="button" onClick={stopRecording} className="relative w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white flex items-center justify-center shadow-lg"><Square className="h-6 w-6" /></button></div>
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /><span className="text-lg font-bold text-text-main font-mono">{formatTime(recordingTime)}</span></div>
                    <AudioWaveform stream={streamRef.current} isRecording={isRecording} />
                  </div>
                )}
              </div>
              {transcription && (
                <div className="mt-2 space-y-1.5"><label className="block text-sm font-semibold text-text-main">Transcription</label>
                  <textarea className="w-full px-4 py-3 rounded-[var(--radius-sm)] border border-gray-200 bg-gray-50 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none resize-none"
                    rows={4} value={transcription} onChange={(e) => setTranscription(e.target.value)} /></div>
              )}
            </Card>
            <Card>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-purple-600" />
                  <h3 className="font-bold text-text-main font-[family-name:var(--font-heading)] text-sm">Résumé IA</h3></div>
                <Button variant="primary" size="sm" onClick={generateSummary} loading={aiLoading}>
                  <Sparkles className="h-3.5 w-3.5 mr-1" />{aiSummaryAdvisor ? 'Regénérer' : 'Générer'}
                </Button>
              </div>
              {aiSummaryAdvisor && (
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-blue-800 flex items-center gap-1"><ClipboardList className="h-4 w-4" />Notes Croesus</span>
                    <CopyButton text={aiSummaryAdvisor} />
                  </div>
                  <textarea className="w-full bg-transparent text-sm text-blue-900 resize-none border-0 focus:ring-0 focus:outline-none" rows={5} value={aiSummaryAdvisor} onChange={(e) => setAiSummaryAdvisor(e.target.value)} />
                </div>
              )}
              {aiSummaryClient && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-emerald-800 flex items-center gap-1"><User className="h-4 w-4" />Récapitulatif client</span>
                    <CopyButton text={aiSummaryClient} />
                  </div>
                  <textarea className="w-full bg-transparent text-sm text-emerald-900 resize-none border-0 focus:ring-0 focus:outline-none" rows={5} value={aiSummaryClient} onChange={(e) => setAiSummaryClient(e.target.value)} />
                </div>
              )}
              {!aiSummaryAdvisor && !aiSummaryClient && !aiLoading && (
                <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 text-purple-300" />
                  <p className="text-sm text-text-muted">Cliquez «Générer» — fonctionne avec ou sans enregistrement</p>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Recap tab */}
        {activeTab === 'recap' && (
          <div className="space-y-4">
            <Card>
              <h3 className="font-bold text-text-main font-[family-name:var(--font-heading)] mb-4">Récapitulatif</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-xl bg-gray-50">
                  <p className="text-xs text-text-muted mb-1">Client</p>
                  <p className="font-semibold text-text-main">{clientName || '—'}</p>
                  {accountNumber && <p className="text-xs text-text-muted mt-0.5">{accountNumber}</p>}
                </div>
                <div className="p-3 rounded-xl bg-gray-50">
                  <p className="text-xs text-text-muted mb-1">Rencontre</p>
                  <p className="font-semibold text-text-main">{formatDate(meetingDate)}</p>
                  <p className="text-xs text-text-muted mt-0.5">{meetingTime || ''}</p>
                </div>
              </div>
              <div className="mt-4 p-3 rounded-xl bg-gray-50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-text-muted">Conformité</span>
                  <span className={`text-sm font-bold ${complianceAnswered === filteredQuestions.length ? 'text-emerald-600' : 'text-amber-600'}`}>{complianceAnswered}/{filteredQuestions.length}</span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${complianceAnswered === filteredQuestions.length ? 'bg-emerald-500' : 'bg-amber-400'}`}
                    style={{ width: `${filteredQuestions.length ? (complianceAnswered / filteredQuestions.length) * 100 : 0}%` }} />
                </div>
                {nonAnswers.length > 0 && (
                  <div className="mt-2"><p className="text-xs font-semibold text-red-600 mb-1">Réponses « Non »:</p>
                    {nonAnswers.map((q) => <p key={q.id} className="text-xs text-red-500">• {q.label}</p>)}</div>
                )}
              </div>
            </Card>
            {transactions.length > 0 && (
              <Card>
                <h3 className="font-bold text-text-main font-[family-name:var(--font-heading)] text-sm mb-3">Transactions</h3>
                <div className="space-y-2">
                  {transactions.map((tx) => {
                    const s = TX_ICONS[tx.type] || TX_ICONS.buy; const TxIcon = s.icon;
                    const value = tx.quantity && tx.price ? parseFloat(tx.quantity) * parseFloat(tx.price) : null;
                    return (
                      <div key={tx.id} className={`flex items-center gap-3 p-3 rounded-xl border-l-4 ${tx.type === 'buy' ? 'border-l-emerald-500 bg-emerald-50/50' : tx.type === 'sell' ? 'border-l-red-500 bg-red-50/50' : 'border-l-blue-500 bg-blue-50/50'}`}>
                        <TxIcon className={`h-5 w-5 ${s.color.split(' ')[0]}`} />
                        <div className="flex-1"><span className="font-bold text-sm">{tx.symbol || '—'}</span>
                          <span className="text-xs text-text-muted ml-2">{tx.quantity} actions à {tx.price}$</span></div>
                        {value && <span className="text-sm font-bold">{value.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</span>}
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
            {(aiSummaryAdvisor || aiSummaryClient) ? (
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-text-main font-[family-name:var(--font-heading)] text-sm">Résumés IA</h3>
                  <Button variant="primary" size="sm" onClick={generateSummary} loading={aiLoading}><Sparkles className="h-3.5 w-3.5 mr-1" />Regénérer</Button>
                </div>
                {aiSummaryAdvisor && (
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 mb-3">
                    <div className="flex items-center justify-between mb-1"><span className="text-xs font-bold text-blue-800">Notes Croesus</span><CopyButton text={aiSummaryAdvisor} /></div>
                    <p className="text-sm text-blue-900 whitespace-pre-wrap">{aiSummaryAdvisor}</p>
                  </div>
                )}
                {aiSummaryClient && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                    <div className="flex items-center justify-between mb-1"><span className="text-xs font-bold text-emerald-800">Récap client</span><CopyButton text={aiSummaryClient} /></div>
                    <p className="text-sm text-emerald-900 whitespace-pre-wrap">{aiSummaryClient}</p>
                  </div>
                )}
              </Card>
            ) : (
              <Card>
                <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 text-purple-300" />
                  <p className="text-sm text-text-muted mb-2">Résumés IA pas encore générés</p>
                  <Button variant="primary" size="sm" onClick={generateSummary} loading={aiLoading}><Sparkles className="h-3.5 w-3.5 mr-1" />Générer maintenant</Button>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Save bar */}
      <div className="flex items-center justify-between sticky bottom-4 bg-white/90 backdrop-blur rounded-xl shadow-lg border border-gray-200 px-4 py-3">
        <div className="text-sm text-text-muted">Modifié: {note.updated_at ? formatDate(note.updated_at) : '—'}</div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => handleSave('draft')} loading={saving}><Save className="h-4 w-4 mr-2" />Sauvegarder</Button>
          {status !== 'completed' && <Button variant="primary" onClick={() => handleSave('completed')} loading={saving}><CheckCircle2 className="h-4 w-4 mr-2" />Compléter</Button>}
        </div>
      </div>
    </div>
  );
}
