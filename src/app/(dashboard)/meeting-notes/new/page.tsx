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
  Sparkles, User, Calendar, Phone, Monitor, Users as UsersIcon,
  Loader2, Copy, Check, TrendingUp, BarChart3,
  Plus, X, ArrowDownRight, ArrowUpRight, ArrowLeftRight,
  Target, ShieldCheck, PieChart, DollarSign, Clock,
  HeartPulse, Scale, AlertTriangle,
  BookOpen, Receipt, Wallet, RefreshCw,
  MessageCircle, UserCircle, Briefcase, Lightbulb, FileCheck,
  Zap, Trophy,
} from 'lucide-react';

// ─── Topic data ─────────────────────────────────────────────────
interface TopicItem {
  id: string;
  label: string;
  description: string;
  icon: typeof Target;
  gradient: string;      // bg gradient for icon container when selected
  iconColor: string;     // icon color
  bgSelected: string;    // card background when selected
  borderSelected: string;
  category: 'profil' | 'portefeuille' | 'placement' | 'admin';
  prompts: string[];
  complianceKeys: string[];
}

const TOPICS: TopicItem[] = [
  {
    id: 'objectifs', label: 'Objectifs', description: 'Buts financiers du client',
    icon: Target, gradient: 'from-blue-500 to-blue-600', iconColor: 'text-blue-600', bgSelected: 'bg-blue-50', borderSelected: 'border-blue-300',
    category: 'profil', complianceKeys: ['q_objectifs'],
    prompts: ['Quels sont vos objectifs financiers cette année?', 'Y a-t-il de nouveaux projets à planifier?', 'Vos priorités ont-elles changé?'],
  },
  {
    id: 'horizon', label: 'Horizon', description: 'Durée prévue des placements',
    icon: Clock, gradient: 'from-indigo-500 to-indigo-600', iconColor: 'text-indigo-600', bgSelected: 'bg-indigo-50', borderSelected: 'border-indigo-300',
    category: 'profil', complianceKeys: ['q_horizon'],
    prompts: ['Prévoyez-vous avoir besoin de ces fonds bientôt?', 'Votre horizon a-t-il changé?'],
  },
  {
    id: 'tolerance', label: 'Tolérance au risque', description: 'Confort face aux fluctuations',
    icon: HeartPulse, gradient: 'from-rose-500 to-rose-600', iconColor: 'text-rose-600', bgSelected: 'bg-rose-50', borderSelected: 'border-rose-300',
    category: 'profil', complianceKeys: ['q_tolerance'],
    prompts: ['Comment avez-vous vécu les baisses récentes?', 'Êtes-vous encore confortable avec le niveau de risque?'],
  },
  {
    id: 'situation', label: 'Situation financière', description: 'Revenus, dépenses, dettes',
    icon: Wallet, gradient: 'from-amber-500 to-amber-600', iconColor: 'text-amber-600', bgSelected: 'bg-amber-50', borderSelected: 'border-amber-300',
    category: 'profil', complianceKeys: ['q_situation'],
    prompts: ['Changements dans vos revenus ou dépenses?', 'Nouvelles dettes?', 'Héritage ou bonus reçu?'],
  },
  {
    id: 'liquidite', label: 'Liquidité', description: 'Besoins en retraits à venir',
    icon: DollarSign, gradient: 'from-emerald-500 to-emerald-600', iconColor: 'text-emerald-600', bgSelected: 'bg-emerald-50', borderSelected: 'border-emerald-300',
    category: 'profil', complianceKeys: ['q_liquidite'],
    prompts: ['Retraits prévus dans les 6-12 prochains mois?', 'Dépenses importantes à venir?'],
  },
  {
    id: 'changements', label: 'Changements de vie', description: 'Mariage, retraite, enfant...',
    icon: RefreshCw, gradient: 'from-teal-500 to-teal-600', iconColor: 'text-teal-600', bgSelected: 'bg-teal-50', borderSelected: 'border-teal-300',
    category: 'profil', complianceKeys: ['q_changements'],
    prompts: ['Événements importants à prévoir?', 'Changement d\'emploi, déménagement?'],
  },
  {
    id: 'repartition', label: 'Répartition d\'actifs', description: 'Allocation actions/obligations',
    icon: PieChart, gradient: 'from-violet-500 to-violet-600', iconColor: 'text-violet-600', bgSelected: 'bg-violet-50', borderSelected: 'border-violet-300',
    category: 'portefeuille', complianceKeys: ['q_repartition'],
    prompts: ['Répartition actuelle: X% actions / Y% obligations', 'Souhaitez-vous ajuster l\'allocation?'],
  },
  {
    id: 'rendements', label: 'Rendements', description: 'Performance du portefeuille',
    icon: TrendingUp, gradient: 'from-green-500 to-green-600', iconColor: 'text-green-600', bgSelected: 'bg-green-50', borderSelected: 'border-green-300',
    category: 'portefeuille', complianceKeys: ['q_rendements'],
    prompts: ['Rendement YTD: X%', 'Comparé à l\'indice de référence...', 'Titres les plus performants...'],
  },
  {
    id: 'concentration', label: 'Concentration', description: 'Exposition à un titre/secteur',
    icon: AlertTriangle, gradient: 'from-orange-500 to-orange-600', iconColor: 'text-orange-600', bgSelected: 'bg-orange-50', borderSelected: 'border-orange-300',
    category: 'portefeuille', complianceKeys: ['q_concentration'],
    prompts: ['Un titre dépasse-t-il 10% du portefeuille?', 'Secteur surreprésenté?'],
  },
  {
    id: 'non_conforme', label: 'Conformité des titres', description: 'Titres hors politique',
    icon: ShieldCheck, gradient: 'from-red-500 to-red-600', iconColor: 'text-red-600', bgSelected: 'bg-red-50', borderSelected: 'border-red-300',
    category: 'portefeuille', complianceKeys: ['q_non_conforme'],
    prompts: ['Placements qui ne respectent plus la politique?', 'Titres à vendre?'],
  },
  {
    id: 'frais', label: 'Frais', description: 'Frais de gestion et commissions',
    icon: Receipt, gradient: 'from-slate-500 to-slate-600', iconColor: 'text-slate-600', bgSelected: 'bg-slate-50', borderSelected: 'border-slate-300',
    category: 'admin', complianceKeys: ['q_frais'],
    prompts: ['Frais de gestion totaux: X%', 'Réviser la structure de frais?'],
  },
  {
    id: 'recommandation', label: 'Recommandation', description: 'Titre suggéré au client',
    icon: Lightbulb, gradient: 'from-cyan-500 to-cyan-600', iconColor: 'text-cyan-600', bgSelected: 'bg-cyan-50', borderSelected: 'border-cyan-300',
    category: 'placement', complianceKeys: ['q_recommande'],
    prompts: ['Je recommande le titre X parce que...', 'Ce placement correspond à votre profil car...'],
  },
  {
    id: 'risques_placement', label: 'Risques expliqués', description: 'Client informé des risques',
    icon: Scale, gradient: 'from-pink-500 to-pink-600', iconColor: 'text-pink-600', bgSelected: 'bg-pink-50', borderSelected: 'border-pink-300',
    category: 'placement', complianceKeys: ['q_risques', 'q_comprend'],
    prompts: ['Risques principaux: ...', 'Pire scénario: perte potentielle de X%', 'Client confirme comprendre'],
  },
  {
    id: 'conformite_profil', label: 'Conforme au profil', description: 'Respecte le profil d\'investisseur',
    icon: FileCheck, gradient: 'from-lime-500 to-lime-600', iconColor: 'text-lime-600', bgSelected: 'bg-lime-50', borderSelected: 'border-lime-300',
    category: 'placement', complianceKeys: ['q_conforme'],
    prompts: ['Placement conforme au profil d\'investisseur', 'Cote de risque compatible'],
  },
  {
    id: 'conflit', label: 'Conflit d\'intérêts', description: 'Signaler si applicable',
    icon: AlertTriangle, gradient: 'from-yellow-500 to-yellow-600', iconColor: 'text-yellow-600', bgSelected: 'bg-yellow-50', borderSelected: 'border-yellow-300',
    category: 'placement', complianceKeys: ['q_conflit'],
    prompts: ['Aucun conflit d\'intérêts à signaler', 'Conflit potentiel: [détails]'],
  },
];

const CATEGORY_INFO: Record<string, { label: string; description: string; icon: typeof User; color: string }> = {
  profil: { label: 'Profil du client', description: 'Sujets sur sa situation personnelle', icon: UserCircle, color: 'text-blue-600 bg-blue-100' },
  portefeuille: { label: 'Portefeuille', description: 'Analyse et revue des placements', icon: Briefcase, color: 'text-violet-600 bg-violet-100' },
  placement: { label: 'Nouveau placement', description: 'Si un titre est recommandé', icon: Lightbulb, color: 'text-emerald-600 bg-emerald-100' },
  admin: { label: 'Administratif', description: 'Frais, documents, paperasse', icon: FileCheck, color: 'text-slate-600 bg-slate-100' },
};

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

const TEMPLATES = [
  { id: 'revision_annuelle', label: 'Révision annuelle', icon: Calendar, gradient: 'from-blue-500 to-indigo-500',
    chips: ['objectifs', 'horizon', 'tolerance', 'situation', 'repartition', 'rendements', 'changements'], subject: 'revision' },
  { id: 'nouveau_placement', label: 'Nouveau placement', icon: TrendingUp, gradient: 'from-emerald-500 to-teal-500',
    chips: ['recommandation', 'risques_placement', 'conformite_profil'], subject: 'placement' },
  { id: 'suivi_trimestriel', label: 'Suivi rapide', icon: Zap, gradient: 'from-purple-500 to-pink-500',
    chips: ['rendements', 'repartition', 'objectifs'], subject: 'revision' },
] as const;

const TX_ICONS: Record<string, { icon: typeof ArrowUpRight; color: string; bgColor: string; label: string }> = {
  buy: { icon: ArrowUpRight, color: 'text-emerald-600', bgColor: 'bg-emerald-100', label: 'Achat' },
  sell: { icon: ArrowDownRight, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Vente' },
  switch: { icon: ArrowLeftRight, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Échange' },
};

// ─── CopyButton ─────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button type="button" onClick={copy} className="px-3 py-1.5 rounded-xl bg-white/70 hover:bg-white border border-current/10 text-xs font-semibold transition-all flex items-center gap-1.5 hover:shadow-sm">
      {copied ? <><Check className="h-3.5 w-3.5 text-emerald-600" /><span className="text-emerald-700">Copié!</span></> : <><Copy className="h-3.5 w-3.5" />Copier</>}
    </button>
  );
}

// ─── Main Page ──────────────────────────────────────────────────
export default function NewMeetingNotePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [clientName, setClientName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingType, setMeetingType] = useState<string>('in_person');
  const [subject, setSubject] = useState<string>('revision');

  const [selectedChips, setSelectedChips] = useState<Set<string>>(new Set());
  const [expandedChip, setExpandedChip] = useState<string | null>(null);

  const [transactions, setTransactions] = useState<MeetingTransaction[]>([]);
  const [freeNotes, setFreeNotes] = useState('');
  const [nextMeeting, setNextMeeting] = useState('');

  const [transcription, setTranscription] = useState('');
  const [aiSummaryAdvisor, setAiSummaryAdvisor] = useState('');
  const [aiSummaryClient, setAiSummaryClient] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Logic
  const toggleChip = (chipId: string) => {
    setSelectedChips((prev) => {
      const next = new Set(prev);
      if (next.has(chipId)) { next.delete(chipId); if (expandedChip === chipId) setExpandedChip(null); }
      else { next.add(chipId); setExpandedChip(chipId); }
      return next;
    });
  };

  const applyTemplate = (tpl: typeof TEMPLATES[number]) => {
    setSubject(tpl.subject); setSelectedChips(new Set(tpl.chips)); setExpandedChip(null);
    toast('success', `"${tpl.label}" appliqué`);
  };

  const deriveCompliance = (): Record<string, string> => {
    const c: Record<string, string> = {};
    for (const t of TOPICS) { for (const k of t.complianceKeys) { c[k] = selectedChips.has(t.id) ? 'oui' : ''; } }
    return c;
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
          if (res.ok) { const d = await res.json(); setTranscription((p) => (p ? p + '\n\n' : '') + d.text); toast('success', 'Transcription terminée'); }
          else toast('error', 'Erreur de transcription');
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
      if (res.ok) { const d = await res.json(); setAiSummaryAdvisor(d.advisor_summary || ''); setAiSummaryClient(d.client_summary || ''); toast('success', 'Résumés générés'); }
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
      else toast('error', 'Erreur');
    } catch { toast('error', 'Erreur de connexion'); } finally { setSaving(false); }
  };

  // Categories to show
  const categories = (subject === 'placement' || subject === 'both')
    ? ['profil', 'portefeuille', 'placement', 'admin'] as const
    : ['profil', 'portefeuille', 'admin'] as const;

  return (
    <div className="max-w-2xl mx-auto pb-28">
      {/* Back */}
      <button type="button" onClick={() => router.push('/meeting-notes')}
        className="flex items-center gap-1.5 text-sm text-text-muted hover:text-brand-primary transition-colors mb-5">
        <ArrowLeft className="h-4 w-4" />Retour
      </button>

      {/* ─── Hero ────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-primary via-brand-primary to-[#03045e] p-6 mb-6 shadow-lg">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
        <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-6 -translate-x-6" />
        <div className="relative">
          <h1 className="text-2xl font-bold text-white font-[family-name:var(--font-heading)] mb-1">
            Nouvelle rencontre
          </h1>
          <p className="text-white/70 text-sm">
            Tapez les sujets abordés — l&apos;IA génère vos notes automatiquement
          </p>
        </div>
      </div>

      {/* ─── Client + Meeting info ───────────────────────────────── */}
      <div className="rounded-2xl bg-white border border-gray-200 p-5 mb-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
            <User className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-text-main">Informations</p>
            <p className="text-[11px] text-text-muted">Client et détails de la rencontre</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr,140px,120px] gap-3">
            <Input placeholder="Nom du client *" value={clientName} onChange={(e) => setClientName(e.target.value)} />
            <Input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
            <Input type="time" value={meetingTime} onChange={(e) => setMeetingTime(e.target.value)} />
          </div>

          <div className="flex flex-wrap gap-2">
            {MEETING_TYPES.map((mt) => {
              const Icon = mt.icon; const active = meetingType === mt.value;
              return (<button key={mt.value} type="button" onClick={() => setMeetingType(mt.value)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-all duration-200 ${
                  active ? 'bg-gradient-to-r from-brand-primary to-brand-primary/90 text-white shadow-md shadow-brand-primary/20 scale-105' : 'bg-gray-100 text-text-muted hover:bg-gray-200 hover:scale-[1.02]'
                }`}><Icon className="h-3.5 w-3.5" />{mt.label}</button>);
            })}
            <div className="w-px h-7 bg-gray-200 self-center mx-1" />
            {SUBJECTS.map((s) => {
              const active = subject === s.value;
              return (<button key={s.value} type="button" onClick={() => { setSubject(s.value); setExpandedChip(null); }}
                className={`px-3.5 py-2 rounded-full text-xs font-bold transition-all duration-200 ${
                  active ? 'bg-gradient-to-r from-brand-primary to-brand-primary/90 text-white shadow-md shadow-brand-primary/20 scale-105' : 'bg-gray-100 text-text-muted hover:bg-gray-200 hover:scale-[1.02]'
                }`}>{s.label}</button>);
            })}
          </div>
        </div>
      </div>

      {/* ─── Templates ───────────────────────────────────────────── */}
      <div className="mb-6">
        <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2.5 ml-1">Démarrage rapide</p>
        <div className="grid grid-cols-3 gap-3">
          {TEMPLATES.map((tpl) => {
            const Icon = tpl.icon;
            return (
              <button key={tpl.id} type="button" onClick={() => applyTemplate(tpl)}
                className="group relative overflow-hidden rounded-2xl p-4 bg-white border-2 border-gray-200 hover:border-transparent hover:shadow-lg transition-all duration-300">
                <div className={`absolute inset-0 bg-gradient-to-br ${tpl.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                <div className="relative flex flex-col items-center gap-2 text-center">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tpl.gradient} flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:scale-110 transition-all`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-xs font-bold text-text-main group-hover:text-white transition-colors">{tpl.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Topics covered ──────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm">
              <CheckCircle2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-main font-[family-name:var(--font-heading)]">
                Sujets abordés
              </h2>
              <p className="text-[11px] text-text-muted">Tapez tout ce que vous avez couvert</p>
            </div>
          </div>
          {selectedCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-sm">
              <Trophy className="h-3.5 w-3.5 text-white" />
              <span className="text-sm font-bold text-white">{selectedCount}</span>
            </div>
          )}
        </div>

        {categories.filter((cat) => visibleTopics.some((t) => t.category === cat)).map((cat) => {
          const info = CATEGORY_INFO[cat];
          const CatIcon = info.icon;
          const catTopics = visibleTopics.filter((t) => t.category === cat);

          return (
            <div key={cat} className="mb-5">
              {/* Category header */}
              <div className="flex items-center gap-2.5 mb-3 ml-1">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${info.color}`}>
                  <CatIcon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-text-main leading-tight">{info.label}</p>
                  <p className="text-[10px] text-text-muted">{info.description}</p>
                </div>
              </div>

              {/* Topic cards */}
              <div className="space-y-2.5">
                {catTopics.map((topic) => {
                  const Icon = topic.icon;
                  const selected = selectedChips.has(topic.id);
                  const expanded = expandedChip === topic.id && selected;

                  return (
                    <div key={topic.id}>
                      <button type="button" onClick={() => toggleChip(topic.id)}
                        className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border-2 text-left transition-all duration-300 ${
                          selected
                            ? `${topic.bgSelected} ${topic.borderSelected} shadow-md scale-[1.01]`
                            : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm hover:scale-[1.005]'
                        }`}>
                        {/* Icon */}
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 shadow-sm ${
                          selected ? `bg-gradient-to-br ${topic.gradient} shadow-md` : 'bg-gray-100'
                        }`}>
                          <Icon className={`h-5 w-5 transition-colors ${selected ? 'text-white' : 'text-gray-400'}`} />
                        </div>

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold transition-colors ${selected ? topic.iconColor : 'text-text-main'}`}>
                            {topic.label}
                          </p>
                          <p className="text-[11px] text-text-muted leading-tight mt-0.5">{topic.description}</p>
                        </div>

                        {/* Checkbox */}
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                          selected ? `bg-gradient-to-br ${topic.gradient} shadow-sm` : 'border-2 border-gray-300'
                        }`}>
                          {selected && <Check className="h-3.5 w-3.5 text-white" />}
                        </div>
                      </button>

                      {/* Prompts panel */}
                      {expanded && (
                        <div className="ml-[60px] mr-4 mt-2 mb-1 p-3.5 rounded-xl bg-gradient-to-r from-gray-50 to-white border border-gray-200 shadow-sm">
                          <div className="flex items-center gap-1.5 mb-2.5">
                            <MessageCircle className="h-3.5 w-3.5 text-brand-primary" />
                            <p className="text-[11px] font-bold text-brand-primary uppercase tracking-wider">Questions suggérées</p>
                          </div>
                          <div className="space-y-2">
                            {topic.prompts.map((prompt, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-brand-primary/40 mt-1.5 flex-shrink-0" />
                                <p className="text-xs text-text-muted leading-relaxed italic">&ldquo;{prompt}&rdquo;</p>
                              </div>
                            ))}
                          </div>
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
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-sm">
                <ArrowLeftRight className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-text-main font-[family-name:var(--font-heading)]">Transactions</h2>
                <p className="text-[11px] text-text-muted">Changements au portefeuille</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={addTransaction} className="rounded-xl"><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
          </div>

          {transactions.length === 0 ? (
            <button type="button" onClick={addTransaction}
              className="w-full py-8 rounded-2xl border-2 border-dashed border-gray-300 text-text-muted hover:border-brand-primary hover:text-brand-primary transition-all duration-300 group">
              <div className="w-12 h-12 rounded-full bg-gray-100 group-hover:bg-brand-primary/10 flex items-center justify-center mx-auto mb-2 transition-colors">
                <Plus className="h-6 w-6 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-sm font-semibold">Ajouter une transaction</p>
              <p className="text-xs mt-0.5 text-text-muted">Achat, vente ou échange</p>
            </button>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-white border-2 border-gray-200 shadow-sm">
                  <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                    {(['buy', 'sell', 'switch'] as const).map((t) => {
                      const s = TX_ICONS[t]; const Icon = s.icon;
                      return (<button key={t} type="button" onClick={() => updateTransaction(tx.id, { type: t })}
                        className={`p-2 rounded-lg transition-all duration-200 ${tx.type === t ? `${s.bgColor} ${s.color} shadow-sm scale-105` : 'text-gray-400 hover:text-gray-600'}`} title={s.label}>
                        <Icon className="h-4 w-4" /></button>);
                    })}
                  </div>
                  <input className="flex-1 min-w-0 px-3 py-2 rounded-xl border-2 border-gray-200 text-sm font-bold bg-gray-50 focus:bg-white focus:border-brand-primary focus:outline-none uppercase tracking-wide"
                    placeholder="SYMBOLE" value={tx.symbol} onChange={(e) => updateTransaction(tx.id, { symbol: e.target.value.toUpperCase() })} />
                  <input className="w-20 px-3 py-2 rounded-xl border-2 border-gray-200 text-sm bg-gray-50 focus:bg-white focus:border-brand-primary focus:outline-none"
                    type="number" placeholder="Qté" value={tx.quantity} onChange={(e) => updateTransaction(tx.id, { quantity: e.target.value })} />
                  <input className="w-24 px-3 py-2 rounded-xl border-2 border-gray-200 text-sm bg-gray-50 focus:bg-white focus:border-brand-primary focus:outline-none"
                    type="number" step="0.01" placeholder="Prix $" value={tx.price} onChange={(e) => updateTransaction(tx.id, { price: e.target.value })} />
                  <button type="button" onClick={() => removeTransaction(tx.id)}
                    className="p-2 rounded-xl hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all"><X className="h-4 w-4" /></button>
                </div>
              ))}
              {transactions.some((t) => t.symbol) && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-gray-50 via-white to-gray-50 border border-gray-200">
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2.5">Résumé</p>
                  {transactions.filter((t) => t.symbol).map((tx) => {
                    const s = TX_ICONS[tx.type]; const TxIcon = s.icon;
                    const val = tx.quantity && tx.price ? parseFloat(tx.quantity) * parseFloat(tx.price) : null;
                    return (
                      <div key={tx.id} className="flex items-center gap-2.5 py-1.5 text-sm">
                        <div className={`w-7 h-7 rounded-lg ${s.bgColor} flex items-center justify-center`}><TxIcon className={`h-4 w-4 ${s.color}`} /></div>
                        <span className="font-bold">{s.label}</span>
                        <span className="font-semibold text-text-main">{tx.symbol}</span>
                        {tx.quantity && <span className="text-text-muted">× {tx.quantity}</span>}
                        {val && <span className="ml-auto font-bold text-text-main">{val.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</span>}
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
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-sm">
            <MessageCircle className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-text-main font-[family-name:var(--font-heading)]">Notes & Audio</h2>
            <p className="text-[11px] text-text-muted">Optionnel — ajoutez des précisions</p>
          </div>
        </div>

        {/* Recording */}
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-white border-2 border-gray-200 shadow-sm mb-3">
          {!isRecording ? (
            <button type="button" onClick={startRecording} disabled={transcribing}
              className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 text-white flex items-center justify-center shadow-lg shadow-red-200/50 hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 flex-shrink-0">
              {transcribing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="h-6 w-6" />}
            </button>
          ) : (
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 rounded-2xl bg-red-500/20 animate-ping" />
              <button type="button" onClick={stopRecording}
                className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 text-white flex items-center justify-center shadow-lg">
                <Square className="h-5 w-5" /></button>
            </div>
          )}
          <div className="flex-1 min-w-0">
            {isRecording ? (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-base font-bold font-mono text-text-main">{formatTime(recordingTime)}</span>
                  <span className="text-xs text-red-500 font-semibold">REC</span>
                </div>
                <AudioWaveform stream={streamRef.current} isRecording={isRecording} />
              </div>
            ) : transcribing ? (
              <div className="flex items-center gap-2.5"><Loader2 className="h-5 w-5 animate-spin text-brand-primary" /><span className="text-sm font-medium text-text-muted">Transcription en cours...</span></div>
            ) : (
              <div><p className="text-sm font-bold text-text-main">Enregistrer la rencontre</p><p className="text-[11px] text-text-muted mt-0.5">Le résumé IA fonctionne aussi sans audio</p></div>
            )}
          </div>
        </div>

        {transcription && (
          <div className="mb-3">
            <label className="block text-xs font-bold text-text-main mb-1.5 ml-1">Transcription</label>
            <textarea className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 bg-gray-50 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none resize-none"
              rows={3} value={transcription} onChange={(e) => setTranscription(e.target.value)} />
          </div>
        )}

        <textarea className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-200 bg-white text-sm placeholder:text-text-light focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none resize-none shadow-sm"
          rows={3} placeholder="Notes libres — points importants, suivis à faire, observations..." value={freeNotes} onChange={(e) => setFreeNotes(e.target.value)} />

        <div className="mt-3">
          <Input label="Prochaine rencontre" type="date" value={nextMeeting} onChange={(e) => setNextMeeting(e.target.value)} />
        </div>
      </div>

      {/* ─── AI Generation ───────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a1a2e] to-[#16213e] p-6 mb-6 shadow-xl">
        {/* Decorative dots */}
        <div className="absolute top-4 right-4 w-20 h-20 bg-purple-500/10 rounded-full blur-xl" />
        <div className="absolute bottom-4 left-4 w-16 h-16 bg-amber-500/10 rounded-full blur-xl" />

        <div className="relative">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-400 to-amber-400 flex items-center justify-center shadow-lg">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white font-[family-name:var(--font-heading)]">Résumés IA</h2>
                <p className="text-[11px] text-white/50">Notes Croesus + récapitulatif client</p>
              </div>
            </div>
            <button type="button" onClick={generateSummary} disabled={aiLoading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-amber-500 text-white text-sm font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100">
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {aiSummaryAdvisor ? 'Regénérer' : 'Générer'}
            </button>
          </div>

          {!aiSummaryAdvisor && !aiSummaryClient && !aiLoading && (
            <div className="text-center py-6 rounded-2xl border border-white/10 bg-white/5">
              <Sparkles className="h-10 w-10 mx-auto mb-3 text-white/20" />
              <p className="text-sm text-white/60 font-medium">
                {selectedCount > 0
                  ? `${selectedCount} sujet${selectedCount > 1 ? 's' : ''} sélectionné${selectedCount > 1 ? 's' : ''} — prêt à générer!`
                  : 'Sélectionnez des sujets puis cliquez Générer'}
              </p>
              <p className="text-[11px] text-white/30 mt-1">Fonctionne avec ou sans enregistrement audio</p>
            </div>
          )}

          {aiSummaryAdvisor && (
            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-400/20 backdrop-blur-sm mb-3">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">Notes Croesus</span>
                <CopyButton text={aiSummaryAdvisor} />
              </div>
              <textarea className="w-full bg-transparent text-sm text-blue-100 resize-none border-0 focus:ring-0 focus:outline-none leading-relaxed placeholder:text-blue-300/30"
                rows={6} value={aiSummaryAdvisor} onChange={(e) => setAiSummaryAdvisor(e.target.value)} />
            </div>
          )}

          {aiSummaryClient && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-400/20 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Récapitulatif client</span>
                <CopyButton text={aiSummaryClient} />
              </div>
              <textarea className="w-full bg-transparent text-sm text-emerald-100 resize-none border-0 focus:ring-0 focus:outline-none leading-relaxed placeholder:text-emerald-300/30"
                rows={6} value={aiSummaryClient} onChange={(e) => setAiSummaryClient(e.target.value)} />
            </div>
          )}
        </div>
      </div>

      {/* ─── Sticky save bar ─────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 sm:sticky sm:bottom-4 bg-white/95 backdrop-blur-sm border-t sm:border-2 sm:border-gray-200 sm:rounded-2xl shadow-2xl px-5 py-4 flex items-center justify-between z-30">
        <div className="hidden sm:flex items-center gap-2">
          {selectedCount > 0 && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
              <CheckCircle2 className="h-3 w-3" />{selectedCount} sujets
            </span>
          )}
          {transactions.length > 0 && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
              <ArrowLeftRight className="h-3 w-3" />{transactions.length} tx
            </span>
          )}
          {transcription && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">
              <Mic className="h-3 w-3" />Audio
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <Button variant="outline" onClick={() => handleSave('draft')} loading={saving} className="rounded-xl">
            <Save className="h-4 w-4 mr-2" />Brouillon
          </Button>
          <Button variant="primary" onClick={() => handleSave('completed')} loading={saving} disabled={!clientName.trim()} className="rounded-xl shadow-lg shadow-brand-primary/20">
            <CheckCircle2 className="h-4 w-4 mr-2" />Compléter
          </Button>
        </div>
      </div>
    </div>
  );
}
