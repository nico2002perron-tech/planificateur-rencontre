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
  HeartPulse, Scale, AlertTriangle,
  BookOpen, Receipt, Wallet, RefreshCw, ChevronDown,
  MessageCircle,
} from 'lucide-react';

// ─── Topic data with suggested prompts ──────────────────────────
interface TopicItem {
  id: string;
  label: string;
  description: string;
  icon: typeof Target;
  color: string;
  selectedColor: string;
  category: 'profil' | 'portefeuille' | 'placement' | 'admin';
  prompts: string[]; // suggested questions/prompts for the advisor
  complianceKeys: string[];
}

const TOPICS: TopicItem[] = [
  {
    id: 'objectifs', label: 'Objectifs', description: 'Buts financiers du client',
    icon: Target, color: 'border-blue-200 bg-white', selectedColor: 'border-blue-400 bg-blue-50 ring-2 ring-blue-200',
    category: 'profil', complianceKeys: ['q_objectifs'],
    prompts: ['Quels sont vos objectifs financiers cette année?', 'Y a-t-il de nouveaux projets à planifier?', 'Vos priorités ont-elles changé?'],
  },
  {
    id: 'horizon', label: 'Horizon', description: 'Durée prévue des placements',
    icon: Clock, color: 'border-indigo-200 bg-white', selectedColor: 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200',
    category: 'profil', complianceKeys: ['q_horizon'],
    prompts: ['Prévoyez-vous avoir besoin de ces fonds bientôt?', 'Votre horizon a-t-il changé depuis notre dernière rencontre?'],
  },
  {
    id: 'tolerance', label: 'Tolérance au risque', description: 'Confort face aux fluctuations',
    icon: HeartPulse, color: 'border-rose-200 bg-white', selectedColor: 'border-rose-400 bg-rose-50 ring-2 ring-rose-200',
    category: 'profil', complianceKeys: ['q_tolerance'],
    prompts: ['Comment avez-vous vécu les baisses de marché récentes?', 'Êtes-vous toujours confortable avec le niveau de risque actuel?'],
  },
  {
    id: 'situation', label: 'Situation financière', description: 'Revenus, dépenses, dettes',
    icon: Wallet, color: 'border-amber-200 bg-white', selectedColor: 'border-amber-400 bg-amber-50 ring-2 ring-amber-200',
    category: 'profil', complianceKeys: ['q_situation'],
    prompts: ['Y a-t-il des changements dans vos revenus ou dépenses?', 'Avez-vous contracté de nouvelles dettes?', 'Avez-vous reçu un héritage ou un bonus?'],
  },
  {
    id: 'liquidite', label: 'Liquidité', description: 'Besoins en retraits à venir',
    icon: DollarSign, color: 'border-emerald-200 bg-white', selectedColor: 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200',
    category: 'profil', complianceKeys: ['q_liquidite'],
    prompts: ['Prévoyez-vous des retraits dans les 6 à 12 prochains mois?', 'Avez-vous des dépenses importantes à venir?'],
  },
  {
    id: 'changements', label: 'Changements de vie', description: 'Mariage, retraite, enfant...',
    icon: RefreshCw, color: 'border-teal-200 bg-white', selectedColor: 'border-teal-400 bg-teal-50 ring-2 ring-teal-200',
    category: 'profil', complianceKeys: ['q_changements'],
    prompts: ['Y a-t-il des événements importants à prévoir?', 'Changement d\'emploi, déménagement, retraite?'],
  },
  {
    id: 'repartition', label: 'Répartition d\'actifs', description: 'Allocation actions/obligations',
    icon: PieChart, color: 'border-violet-200 bg-white', selectedColor: 'border-violet-400 bg-violet-50 ring-2 ring-violet-200',
    category: 'portefeuille', complianceKeys: ['q_repartition'],
    prompts: ['Votre répartition actuelle est de X% actions / Y% obligations', 'Souhaitez-vous ajuster l\'allocation?'],
  },
  {
    id: 'rendements', label: 'Rendements', description: 'Performance du portefeuille',
    icon: TrendingUp, color: 'border-green-200 bg-white', selectedColor: 'border-green-400 bg-green-50 ring-2 ring-green-200',
    category: 'portefeuille', complianceKeys: ['q_rendements'],
    prompts: ['Votre rendement depuis le début de l\'année est de X%', 'Comparé à l\'indice de référence...', 'Les titres qui ont le plus performé sont...'],
  },
  {
    id: 'concentration', label: 'Concentration', description: 'Exposition à un seul titre/secteur',
    icon: AlertTriangle, color: 'border-orange-200 bg-white', selectedColor: 'border-orange-400 bg-orange-50 ring-2 ring-orange-200',
    category: 'portefeuille', complianceKeys: ['q_concentration'],
    prompts: ['Vérifier si un titre dépasse 10% du portefeuille', 'Un secteur est-il surreprésenté?'],
  },
  {
    id: 'non_conforme', label: 'Conformité des titres', description: 'Titres hors politique',
    icon: ShieldCheck, color: 'border-red-200 bg-white', selectedColor: 'border-red-400 bg-red-50 ring-2 ring-red-200',
    category: 'portefeuille', complianceKeys: ['q_non_conforme'],
    prompts: ['Y a-t-il des placements qui ne respectent plus la politique?', 'Certains titres sont-ils à vendre?'],
  },
  {
    id: 'frais', label: 'Frais', description: 'Frais de gestion et commissions',
    icon: Receipt, color: 'border-slate-200 bg-white', selectedColor: 'border-slate-400 bg-slate-50 ring-2 ring-slate-200',
    category: 'admin', complianceKeys: ['q_frais'],
    prompts: ['Vos frais de gestion totaux sont de X%', 'Voulez-vous qu\'on révise la structure de frais?'],
  },
  {
    id: 'recommandation', label: 'Recommandation', description: 'Titre suggéré au client',
    icon: BookOpen, color: 'border-cyan-200 bg-white', selectedColor: 'border-cyan-400 bg-cyan-50 ring-2 ring-cyan-200',
    category: 'placement', complianceKeys: ['q_recommande'],
    prompts: ['Je vous recommande le titre X parce que...', 'Ce placement correspond à votre profil car...'],
  },
  {
    id: 'risques_placement', label: 'Risques expliqués', description: 'Client informé des risques',
    icon: Scale, color: 'border-pink-200 bg-white', selectedColor: 'border-pink-400 bg-pink-50 ring-2 ring-pink-200',
    category: 'placement', complianceKeys: ['q_risques', 'q_comprend'],
    prompts: ['Les risques principaux sont...', 'Dans le pire scénario, la perte potentielle serait de...', 'Le client confirme comprendre les risques'],
  },
  {
    id: 'conformite_profil', label: 'Conforme au profil', description: 'Respecte le profil d\'investisseur',
    icon: ShieldCheck, color: 'border-lime-200 bg-white', selectedColor: 'border-lime-400 bg-lime-50 ring-2 ring-lime-200',
    category: 'placement', complianceKeys: ['q_conforme'],
    prompts: ['Ce placement est conforme à votre profil d\'investisseur', 'La cote de risque du titre est compatible'],
  },
  {
    id: 'conflit', label: 'Conflit d\'intérêts', description: 'Signaler si applicable',
    icon: AlertTriangle, color: 'border-yellow-200 bg-white', selectedColor: 'border-yellow-400 bg-yellow-50 ring-2 ring-yellow-200',
    category: 'placement', complianceKeys: ['q_conflit'],
    prompts: ['Aucun conflit d\'intérêts à signaler', 'Conflit potentiel: [détails]'],
  },
];

const CATEGORY_INFO: Record<string, { label: string; description: string; emoji: string }> = {
  profil: { label: 'Profil du client', description: 'Ce que vous avez discuté sur sa situation', emoji: '👤' },
  portefeuille: { label: 'Portefeuille', description: 'Ce que vous avez revu ensemble', emoji: '📊' },
  placement: { label: 'Nouveau placement', description: 'Si un titre est recommandé', emoji: '💡' },
  admin: { label: 'Administratif', description: 'Frais, documents, etc.', emoji: '📋' },
};

const MEETING_TYPES = [
  { value: 'phone', label: 'Tél.', icon: Phone },
  { value: 'in_person', label: 'Personne', icon: UsersIcon },
  { value: 'video', label: 'Vidéo', icon: Monitor },
] as const;

const SUBJECTS = [
  { value: 'revision', label: 'Révision' },
  { value: 'placement', label: 'Placement' },
  { value: 'both', label: 'Les deux' },
] as const;

const TEMPLATES = [
  { id: 'revision_annuelle', label: 'Révision annuelle', icon: Calendar, color: 'border-blue-300 bg-blue-50 text-blue-700',
    chips: ['objectifs', 'horizon', 'tolerance', 'situation', 'repartition', 'rendements', 'changements'], subject: 'revision' },
  { id: 'nouveau_placement', label: 'Nouveau placement', icon: TrendingUp, color: 'border-emerald-300 bg-emerald-50 text-emerald-700',
    chips: ['recommandation', 'risques_placement', 'conformite_profil'], subject: 'placement' },
  { id: 'suivi_trimestriel', label: 'Suivi rapide', icon: BarChart3, color: 'border-purple-300 bg-purple-50 text-purple-700',
    chips: ['rendements', 'repartition', 'objectifs'], subject: 'revision' },
] as const;

const TX_ICONS: Record<string, { icon: typeof ArrowUpRight; color: string; bgColor: string; label: string }> = {
  buy: { icon: ArrowUpRight, color: 'text-emerald-600', bgColor: 'bg-emerald-50', label: 'Achat' },
  sell: { icon: ArrowDownRight, color: 'text-red-600', bgColor: 'bg-red-50', label: 'Vente' },
  switch: { icon: ArrowLeftRight, color: 'text-blue-600', bgColor: 'bg-blue-50', label: 'Échange' },
};

// ─── CopyButton ─────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button type="button" onClick={copy} className="px-2.5 py-1 rounded-lg bg-white/60 hover:bg-white text-xs font-medium transition-all flex items-center gap-1" title="Copier">
      {copied ? <><Check className="h-3.5 w-3.5 text-emerald-600" />Copié!</> : <><Copy className="h-3.5 w-3.5" />Copier</>}
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

  // Topics
  const [selectedChips, setSelectedChips] = useState<Set<string>>(new Set());
  const [expandedChip, setExpandedChip] = useState<string | null>(null);

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

  // ─── Logic ────────────────────────────────────────────────────
  const toggleChip = (chipId: string) => {
    setSelectedChips((prev) => {
      const next = new Set(prev);
      if (next.has(chipId)) { next.delete(chipId); setExpandedChip(null); }
      else { next.add(chipId); setExpandedChip(chipId); }
      return next;
    });
  };

  const applyTemplate = (tpl: typeof TEMPLATES[number]) => {
    setSubject(tpl.subject);
    setSelectedChips(new Set(tpl.chips));
    setExpandedChip(null);
    toast('success', `"${tpl.label}" appliqué`);
  };

  const deriveCompliance = (): Record<string, string> => {
    const compliance: Record<string, string> = {};
    for (const topic of TOPICS) {
      for (const key of topic.complianceKeys) {
        compliance[key] = selectedChips.has(topic.id) ? 'oui' : '';
      }
    }
    return compliance;
  };

  const getVisibleTopics = () => TOPICS.filter((t) => {
    if (t.category === 'placement') return subject === 'placement' || subject === 'both';
    if (t.category === 'portefeuille') return subject === 'revision' || subject === 'both';
    return true;
  });

  const visibleTopics = getVisibleTopics();
  const selectedCount = [...selectedChips].filter((id) => visibleTopics.some((t) => t.id === id)).length;

  // Transactions
  const addTransaction = () => setTransactions((prev) => [...prev, { id: crypto.randomUUID(), type: 'buy', symbol: '', quantity: '', price: '', solicited: true, orderType: 'market' }]);
  const updateTransaction = (id: string, patch: Partial<MeetingTransaction>) => setTransactions((prev) => prev.map((t) => t.id === id ? { ...t, ...patch } : t));
  const removeTransaction = (id: string) => setTransactions((prev) => prev.filter((t) => t.id !== id));

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

  // AI
  const generateSummary = async () => {
    if (selectedChips.size === 0 && !transcription && !freeNotes) { toast('warning', 'Sélectionnez des sujets ou ajoutez des notes'); return; }
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/meeting-summary', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcription, manualNotes: freeNotes, complianceAnswers: deriveCompliance(),
          meetingContext: { clientName, meetingType, subject, meetingDate, transactions: transactions.length > 0 ? transactions : undefined,
            topicsCovered: Array.from(selectedChips).map((id) => TOPICS.find((t) => t.id === id)?.label).filter(Boolean) },
        }),
      });
      if (res.ok) { const data = await res.json(); setAiSummaryAdvisor(data.advisor_summary || ''); setAiSummaryClient(data.client_summary || ''); toast('success', 'Résumés générés'); }
      else toast('error', 'Erreur lors de la génération');
    } catch { toast('error', 'Erreur de connexion'); } finally { setAiLoading(false); }
  };

  // Save
  const handleSave = async (status: 'draft' | 'completed') => {
    if (!clientName.trim()) { toast('warning', 'Entrez le nom du client'); return; }
    setSaving(true);
    try {
      const body = {
        client_name: clientName, account_number: accountNumber, meeting_date: meetingDate, meeting_time: meetingTime,
        meeting_type: meetingType, subject, compliance: deriveCompliance(),
        transaction: transactions.length > 0 ? transactions : null,
        notes: { topics: Array.from(selectedChips).map((id) => TOPICS.find((t) => t.id === id)?.label).filter(Boolean).join(', '), decisions: '', followups: freeNotes, nextMeeting },
        transcription: transcription || null, ai_summary_advisor: aiSummaryAdvisor || null, ai_summary_client: aiSummaryClient || null, status,
      };
      const res = await fetch('/api/meeting-notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) { toast('success', status === 'completed' ? 'Note complétée!' : 'Brouillon sauvegardé'); router.push('/meeting-notes'); }
      else toast('error', 'Erreur lors de la sauvegarde');
    } catch { toast('error', 'Erreur de connexion'); } finally { setSaving(false); }
  };

  // ─── Render ───────────────────────────────────────────────────
  const categories = (subject === 'placement' || subject === 'both')
    ? ['profil', 'portefeuille', 'placement', 'admin'] as const
    : ['profil', 'portefeuille', 'admin'] as const;

  return (
    <div className="max-w-2xl mx-auto pb-28">
      {/* Back */}
      <button type="button" onClick={() => router.push('/meeting-notes')}
        className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-main transition-colors mb-4">
        <ArrowLeft className="h-4 w-4" />Retour aux notes
      </button>

      {/* ─── Hero header ─────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-text-main font-[family-name:var(--font-heading)] mb-1">
          Nouvelle rencontre
        </h1>
        <p className="text-text-muted">
          Sélectionnez les sujets abordés, l&apos;IA s&apos;occupe du reste.
        </p>
      </div>

      {/* ─── Quick info row ──────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 mb-5 shadow-sm">
        <div className="grid grid-cols-[1fr,auto,auto] gap-3 items-end mb-3">
          <Input placeholder="Nom du client" value={clientName} onChange={(e) => setClientName(e.target.value)} />
          <Input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} className="w-36" />
          <Input type="time" value={meetingTime} onChange={(e) => setMeetingTime(e.target.value)} className="w-28" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {MEETING_TYPES.map((mt) => {
            const Icon = mt.icon; const active = meetingType === mt.value;
            return (<button key={mt.value} type="button" onClick={() => setMeetingType(mt.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${active ? 'bg-brand-primary text-white shadow-sm' : 'bg-gray-100 text-text-muted hover:bg-gray-200'}`}>
              <Icon className="h-3.5 w-3.5" />{mt.label}</button>);
          })}
          <div className="w-px h-5 bg-gray-200" />
          {SUBJECTS.map((s) => {
            const active = subject === s.value;
            return (<button key={s.value} type="button" onClick={() => { setSubject(s.value); setExpandedChip(null); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${active ? 'bg-brand-primary text-white shadow-sm' : 'bg-gray-100 text-text-muted hover:bg-gray-200'}`}>
              {s.label}</button>);
          })}
        </div>
      </div>

      {/* ─── Templates ───────────────────────────────────────────── */}
      <div className="mb-5">
        <p className="text-xs font-medium text-text-muted mb-2">Commencer avec un template:</p>
        <div className="flex gap-2 overflow-x-auto">
          {TEMPLATES.map((tpl) => {
            const Icon = tpl.icon;
            return (
              <button key={tpl.id} type="button" onClick={() => applyTemplate(tpl)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border-2 text-sm font-semibold whitespace-nowrap transition-all hover:scale-[1.03] hover:shadow-md ${tpl.color}`}>
                <Icon className="h-4 w-4" />{tpl.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Topics covered ──────────────────────────────────────── */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-text-main font-[family-name:var(--font-heading)]">
              Qu&apos;avez-vous couvert?
            </h2>
            <p className="text-xs text-text-muted mt-0.5">Tapez les sujets abordés pendant la rencontre</p>
          </div>
          {selectedCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-bold text-emerald-700">{selectedCount}</span>
            </div>
          )}
        </div>

        {categories.filter((cat) => visibleTopics.some((t) => t.category === cat)).map((cat) => {
          const info = CATEGORY_INFO[cat];
          const catTopics = visibleTopics.filter((t) => t.category === cat);

          return (
            <div key={cat} className="mb-5">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-lg">{info.emoji}</span>
                <div>
                  <p className="text-sm font-bold text-text-main">{info.label}</p>
                  <p className="text-[11px] text-text-muted">{info.description}</p>
                </div>
              </div>

              <div className="space-y-2">
                {catTopics.map((topic) => {
                  const Icon = topic.icon;
                  const selected = selectedChips.has(topic.id);
                  const expanded = expandedChip === topic.id && selected;

                  return (
                    <div key={topic.id}>
                      <button type="button"
                        onClick={() => toggleChip(topic.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 text-left transition-all duration-200 ${
                          selected ? topic.selectedColor : `${topic.color} hover:shadow-sm hover:scale-[1.01]`
                        }`}>
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                          selected ? 'bg-white shadow-sm' : 'bg-gray-50'
                        }`}>
                          <Icon className={`h-5 w-5 ${selected ? 'text-current' : 'text-gray-400'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${selected ? 'text-current' : 'text-text-main'}`}>{topic.label}</p>
                          <p className="text-[11px] text-text-muted truncate">{topic.description}</p>
                        </div>
                        {selected ? (
                          <CheckCircle2 className="h-5 w-5 text-current flex-shrink-0" />
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                        )}
                      </button>

                      {/* Expanded prompts */}
                      {expanded && (
                        <div className="ml-6 mt-1.5 mb-1 p-3 rounded-xl bg-white border border-gray-100 shadow-sm animate-in slide-in-from-top-1">
                          <div className="flex items-center gap-1.5 mb-2">
                            <MessageCircle className="h-3.5 w-3.5 text-brand-primary" />
                            <p className="text-[11px] font-semibold text-brand-primary uppercase tracking-wide">Questions suggérées</p>
                          </div>
                          <div className="space-y-1.5">
                            {topic.prompts.map((prompt, i) => (
                              <p key={i} className="text-xs text-text-muted pl-2 border-l-2 border-gray-200 leading-relaxed">
                                &ldquo;{prompt}&rdquo;
                              </p>
                            ))}
                          </div>
                          <button type="button" onClick={() => setExpandedChip(null)}
                            className="mt-2 text-[11px] text-text-muted hover:text-text-main">
                            <ChevronDown className="h-3 w-3 inline mr-0.5 rotate-180" />Fermer
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Transactions ────────────────────────────────────────── */}
      {(subject === 'placement' || subject === 'both') && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-text-main font-[family-name:var(--font-heading)]">
              Changements au portefeuille
            </h2>
            <Button variant="ghost" size="sm" onClick={addTransaction}><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
          </div>

          {transactions.length === 0 ? (
            <button type="button" onClick={addTransaction}
              className="w-full py-8 border-2 border-dashed border-gray-200 rounded-2xl text-text-muted hover:border-brand-primary hover:text-brand-primary transition-all group">
              <Plus className="h-6 w-6 mx-auto mb-1 group-hover:scale-110 transition-transform" />
              <p className="text-sm font-medium">Ajouter une transaction</p>
              <p className="text-xs mt-0.5">Achat, vente ou échange de titres</p>
            </button>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center gap-2 p-3 rounded-2xl bg-white border border-gray-200 shadow-sm">
                  <div className="flex gap-0.5 bg-gray-100 rounded-xl p-1">
                    {(['buy', 'sell', 'switch'] as const).map((t) => {
                      const s = TX_ICONS[t]; const Icon = s.icon;
                      return (<button key={t} type="button" onClick={() => updateTransaction(tx.id, { type: t })}
                        className={`p-2 rounded-lg transition-all ${tx.type === t ? `${s.bgColor} ${s.color} shadow-sm` : 'text-gray-400 hover:text-gray-600'}`} title={s.label}>
                        <Icon className="h-4 w-4" /></button>);
                    })}
                  </div>
                  <input className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold bg-gray-50 focus:bg-white focus:border-brand-primary focus:outline-none uppercase"
                    placeholder="SYMBOLE" value={tx.symbol} onChange={(e) => updateTransaction(tx.id, { symbol: e.target.value.toUpperCase() })} />
                  <input className="w-20 px-3 py-2 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:bg-white focus:border-brand-primary focus:outline-none"
                    type="number" placeholder="Qté" value={tx.quantity} onChange={(e) => updateTransaction(tx.id, { quantity: e.target.value })} />
                  <input className="w-24 px-3 py-2 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:bg-white focus:border-brand-primary focus:outline-none"
                    type="number" step="0.01" placeholder="Prix $" value={tx.price} onChange={(e) => updateTransaction(tx.id, { price: e.target.value })} />
                  <button type="button" onClick={() => removeTransaction(tx.id)}
                    className="p-2 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all"><X className="h-4 w-4" /></button>
                </div>
              ))}

              {/* Recap */}
              {transactions.some((t) => t.symbol) && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-gray-50 to-white border border-gray-100 mt-3">
                  <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Résumé des transactions</p>
                  {transactions.filter((t) => t.symbol).map((tx) => {
                    const s = TX_ICONS[tx.type]; const TxIcon = s.icon;
                    const val = tx.quantity && tx.price ? parseFloat(tx.quantity) * parseFloat(tx.price) : null;
                    return (
                      <div key={tx.id} className="flex items-center gap-2 py-1.5 text-sm">
                        <div className={`w-6 h-6 rounded-lg ${s.bgColor} flex items-center justify-center`}><TxIcon className={`h-3.5 w-3.5 ${s.color}`} /></div>
                        <span className="font-bold text-text-main">{s.label}</span>
                        <span className="font-semibold">{tx.symbol}</span>
                        {tx.quantity && <span className="text-text-muted">× {tx.quantity}</span>}
                        {val && <span className="ml-auto font-bold">{val.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Audio + Notes ───────────────────────────────────────── */}
      <div className="mb-5">
        <h2 className="text-lg font-bold text-text-main font-[family-name:var(--font-heading)] mb-3">
          Notes & Audio <span className="text-xs font-normal text-text-muted ml-1">optionnel</span>
        </h2>

        {/* Mic row */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-gray-200 shadow-sm mb-3">
          {!isRecording ? (
            <button type="button" onClick={startRecording} disabled={transcribing}
              className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white flex items-center justify-center shadow-md hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 flex-shrink-0">
              {transcribing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="h-5 w-5" />}
            </button>
          ) : (
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
              <button type="button" onClick={stopRecording}
                className="relative w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white flex items-center justify-center shadow-md">
                <Square className="h-5 w-5" /></button>
            </div>
          )}
          <div className="flex-1 min-w-0">
            {isRecording ? (
              <div>
                <div className="flex items-center gap-2 mb-1"><div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-sm font-bold font-mono">{formatTime(recordingTime)}</span></div>
                <AudioWaveform stream={streamRef.current} isRecording={isRecording} />
              </div>
            ) : transcribing ? (
              <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-brand-primary" /><span className="text-sm text-text-muted">Transcription...</span></div>
            ) : (
              <div><p className="text-sm font-medium text-text-main">Enregistrer</p><p className="text-[11px] text-text-muted">Le résumé fonctionne aussi sans audio</p></div>
            )}
          </div>
        </div>

        {transcription && (
          <div className="mb-3"><label className="block text-xs font-semibold text-text-main mb-1">Transcription</label>
            <textarea className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none resize-none"
              rows={3} value={transcription} onChange={(e) => setTranscription(e.target.value)} /></div>
        )}

        <textarea className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm placeholder:text-text-light focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none resize-none shadow-sm"
          rows={3} placeholder="Notes libres — points importants, suivis, observations..." value={freeNotes} onChange={(e) => setFreeNotes(e.target.value)} />

        <div className="mt-3">
          <Input label="Prochaine rencontre" type="date" value={nextMeeting} onChange={(e) => setNextMeeting(e.target.value)} />
        </div>
      </div>

      {/* ─── AI Generation ───────────────────────────────────────── */}
      <div className="rounded-2xl border-2 border-dashed border-purple-200 bg-gradient-to-br from-purple-50/50 to-amber-50/30 p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-amber-500 flex items-center justify-center shadow-md">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-main font-[family-name:var(--font-heading)]">Résumés IA</h2>
              <p className="text-[11px] text-text-muted">Notes Croesus + récapitulatif client en 1 clic</p>
            </div>
          </div>
          <Button variant="primary" onClick={generateSummary} loading={aiLoading}
            className="rounded-xl shadow-md">
            <Sparkles className="h-4 w-4 mr-1.5" />{aiSummaryAdvisor ? 'Regénérer' : 'Générer'}
          </Button>
        </div>

        {!aiSummaryAdvisor && !aiSummaryClient && !aiLoading && (
          <div className="text-center py-4">
            <p className="text-sm text-text-muted">
              {selectedChips.size > 0
                ? `${selectedCount} sujet${selectedCount > 1 ? 's' : ''} sélectionné${selectedCount > 1 ? 's' : ''} — prêt à générer`
                : 'Sélectionnez des sujets ci-dessus pour activer la génération'}
            </p>
          </div>
        )}

        {aiSummaryAdvisor && (
          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">Notes Croesus</span>
              <CopyButton text={aiSummaryAdvisor} />
            </div>
            <textarea className="w-full bg-transparent text-sm text-blue-900 resize-none border-0 focus:ring-0 focus:outline-none leading-relaxed"
              rows={6} value={aiSummaryAdvisor} onChange={(e) => setAiSummaryAdvisor(e.target.value)} />
          </div>
        )}

        {aiSummaryClient && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Récapitulatif client</span>
              <CopyButton text={aiSummaryClient} />
            </div>
            <textarea className="w-full bg-transparent text-sm text-emerald-900 resize-none border-0 focus:ring-0 focus:outline-none leading-relaxed"
              rows={6} value={aiSummaryClient} onChange={(e) => setAiSummaryClient(e.target.value)} />
          </div>
        )}
      </div>

      {/* ─── Sticky save bar ─────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 sm:sticky sm:bottom-4 bg-white/95 backdrop-blur-sm border-t sm:border-2 sm:border-gray-200 sm:rounded-2xl shadow-xl px-5 py-4 flex items-center justify-between z-30">
        <div className="hidden sm:flex items-center gap-2 text-sm text-text-muted">
          {selectedCount > 0 && <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">{selectedCount} sujets</span>}
          {transactions.length > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">{transactions.length} tx</span>}
          {transcription && <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold">Audio</span>}
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <Button variant="outline" onClick={() => handleSave('draft')} loading={saving} className="rounded-xl">
            <Save className="h-4 w-4 mr-2" />Brouillon
          </Button>
          <Button variant="primary" onClick={() => handleSave('completed')} loading={saving} disabled={!clientName.trim()} className="rounded-xl shadow-md">
            <CheckCircle2 className="h-4 w-4 mr-2" />Compléter
          </Button>
        </div>
      </div>
    </div>
  );
}
