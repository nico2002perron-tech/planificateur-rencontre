'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useInvestmentProfiles } from '@/lib/hooks/useInvestmentProfiles';
import { ArrowLeft, Mail, Copy, Check, RefreshCw } from 'lucide-react';

// ── Types ──

interface ScoredStock {
  symbol: string;
  name: string;
  sector: string;
  weight: number;
  price: number;
  pe: number;
  dividendYield: number;
  marketCap: number;
  scores: { overall: number; health: number; growth: number; valuation: number; sector: number };
}

interface ScoringResult {
  profileName: string;
  profileNumber: number;
  nbStocks: number;
  portfolioScores: { overall: number; health: number; growth: number; valuation: number; sector: number };
  distribution: { excellent: number; good: number; average: number; weak: number };
  stocks: ScoredStock[];
}

interface EmailResult {
  subject: string;
  body: string;
  profileName: string;
  profileNumber: number;
}

type Tone = 'formel' | 'semi-formel' | 'decontracte';

const toneLabels: Record<Tone, string> = {
  formel: 'Formel',
  'semi-formel': 'Semi-formel',
  decontracte: 'Decontracte',
};

// ════════════════════════════════════════
// PAGE
// ════════════════════════════════════════

export default function EmailPage() {
  const { profiles, isLoading: profilesLoading } = useInvestmentProfiles();
  const { toast } = useToast();

  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [clientName, setClientName] = useState('');
  const [tone, setTone] = useState<Tone>('semi-formel');

  const [step, setStep] = useState<'idle' | 'scoring' | 'generating' | 'done'>('idle');
  const [scoringData, setScoringData] = useState<ScoringResult | null>(null);
  const [emailData, setEmailData] = useState<EmailResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!selectedProfileId) {
      toast('warning', 'Selectionnez un profil');
      return;
    }

    // Step 1: Run scoring
    setStep('scoring');
    setScoringData(null);
    setEmailData(null);

    try {
      const scoreRes = await fetch('/api/models/scoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: selectedProfileId }),
      });
      if (!scoreRes.ok) {
        const err = await scoreRes.json();
        throw new Error(err.error || 'Erreur scoring');
      }
      const scoring: ScoringResult = await scoreRes.json();
      setScoringData(scoring);

      // Step 2: Generate email
      setStep('generating');

      const emailRes = await fetch('/api/models/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...scoring,
          clientName: clientName.trim() || 'Client',
          tone,
        }),
      });
      if (!emailRes.ok) {
        const err = await emailRes.json();
        throw new Error(err.error || 'Erreur generation email');
      }
      const email: EmailResult = await emailRes.json();
      setEmailData(email);
      setStep('done');
      toast('success', 'Email genere');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Erreur');
      setStep('idle');
    }
  }, [selectedProfileId, clientName, tone, toast]);

  const handleRegenerate = useCallback(async () => {
    if (!scoringData) return;
    setStep('generating');
    setEmailData(null);

    try {
      const emailRes = await fetch('/api/models/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...scoringData,
          clientName: clientName.trim() || 'Client',
          tone,
        }),
      });
      if (!emailRes.ok) {
        const err = await emailRes.json();
        throw new Error(err.error || 'Erreur generation email');
      }
      const email: EmailResult = await emailRes.json();
      setEmailData(email);
      setStep('done');
      toast('success', 'Email regenere');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Erreur');
      setStep('done');
    }
  }, [scoringData, clientName, tone, toast]);

  const handleCopy = useCallback(() => {
    if (!emailData) return;
    const text = `Objet: ${emailData.subject}\n\n${emailData.body}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast('success', 'Email copie dans le presse-papiers');
    setTimeout(() => setCopied(false), 2000);
  }, [emailData, toast]);

  if (profilesLoading) {
    return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  }

  return (
    <div>
      <PageHeader
        title="Composition email IA"
        description="Generez un email de suivi professionnel base sur le scoring du portefeuille"
        action={
          <Link href="/models">
            <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />}>Retour</Button>
          </Link>
        }
      />

      {/* Configuration */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Profil d&apos;investissement</label>
            <select
              value={selectedProfileId}
              onChange={(e) => { setSelectedProfileId(e.target.value); setStep('idle'); setEmailData(null); }}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
            >
              <option value="">-- Selectionnez --</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>
                  {p.profile_number}. {p.name} ({p.equity_pct}/{p.bond_pct})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Nom du client (optionnel)</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Ex: M. Tremblay"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Ton de l&apos;email</label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as Tone)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
            >
              {(Object.entries(toneLabels) as [Tone, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <Button
            size="lg"
            loading={step === 'scoring' || step === 'generating'}
            onClick={handleGenerate}
            icon={<Mail className="h-4 w-4" />}
          >
            Generer l&apos;email
          </Button>
        </div>
      </Card>

      {/* Loading states */}
      {step === 'scoring' && (
        <div className="flex flex-col items-center justify-center py-20">
          <Spinner size="lg" />
          <p className="text-sm text-text-muted mt-4">Analyse du portefeuille en cours...</p>
          <p className="text-xs text-text-light mt-1">Scoring des fondamentaux via Yahoo Finance</p>
        </div>
      )}

      {step === 'generating' && (
        <div className="flex flex-col items-center justify-center py-20">
          <Spinner size="lg" />
          <p className="text-sm text-text-muted mt-4">Redaction de l&apos;email en cours...</p>
          <p className="text-xs text-text-light mt-1">Generation IA via Groq (llama-3.3-70b)</p>
        </div>
      )}

      {/* Result */}
      {step === 'done' && emailData && (
        <div className="space-y-4">
          {/* Scoring summary mini */}
          {scoringData && (
            <Card className="bg-gray-50/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-xs text-text-muted">Profil</p>
                    <p className="text-sm font-semibold text-text-main">{scoringData.profileNumber}. {scoringData.profileName}</p>
                  </div>
                  <div className="h-8 w-px bg-gray-200" />
                  <div>
                    <p className="text-xs text-text-muted">Score global</p>
                    <p className={`text-lg font-bold ${scoringData.portfolioScores.overall >= 7.5 ? 'text-emerald-600' : scoringData.portfolioScores.overall >= 5.5 ? 'text-amber-500' : 'text-red-500'}`}>
                      {scoringData.portfolioScores.overall}/10
                    </p>
                  </div>
                  <div className="h-8 w-px bg-gray-200" />
                  <div>
                    <p className="text-xs text-text-muted">Titres</p>
                    <p className="text-sm font-medium text-text-main">{scoringData.nbStocks}</p>
                  </div>
                  <div className="h-8 w-px bg-gray-200" />
                  <div className="flex gap-3 text-xs">
                    <span className="text-emerald-600">{scoringData.distribution.excellent} exc.</span>
                    <span className="text-sky-600">{scoringData.distribution.good} bons</span>
                    <span className="text-amber-500">{scoringData.distribution.average} moy.</span>
                    <span className="text-red-500">{scoringData.distribution.weak} faib.</span>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Email preview */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text-main">Apercu de l&apos;email</h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerate}
                  icon={<RefreshCw className="h-3.5 w-3.5" />}
                >
                  Regenerer
                </Button>
                <Button
                  size="sm"
                  onClick={handleCopy}
                  icon={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                >
                  {copied ? 'Copie' : 'Copier'}
                </Button>
              </div>
            </div>

            {/* Subject */}
            <div className="mb-4 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Objet:</span>
                <span className="text-sm font-semibold text-text-main">{emailData.subject}</span>
              </div>
            </div>

            {/* Body */}
            <div className="bg-white border border-gray-100 rounded-lg p-6">
              <div className="prose prose-sm max-w-none text-text-main whitespace-pre-line leading-relaxed">
                {emailData.body}
              </div>
            </div>
          </Card>

          {/* Tone selector for regeneration */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-light">
              Email genere par IA (Groq llama-3.3-70b). Relisez et ajustez avant envoi.
            </p>
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span>Ton:</span>
              {(Object.entries(toneLabels) as [Tone, string][]).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => setTone(k)}
                  className={`px-2 py-1 rounded-md transition-colors ${
                    tone === k
                      ? 'bg-brand-primary/10 text-brand-primary font-medium'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
