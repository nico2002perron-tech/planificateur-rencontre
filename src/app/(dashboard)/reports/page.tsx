'use client';

import { useState } from 'react';
import { PretAColler } from '@/components/reports/PretAColler';
import { ProspectReport } from '@/components/reports/ProspectReport';
import { VaultGate } from '@/components/security/VaultGate';
import {
  ClipboardPaste, ArrowLeft, Target, Sparkles, BookOpen,
  Zap, CheckCircle2, UserPlus, FileSpreadsheet, Search,
} from 'lucide-react';

// Duolingo palette
const DUO = {
  green: '#58CC02', greenDark: '#45a300',
  blue: '#1CB0F6', blueDark: '#1899d6',
  purple: '#CE82FF', purpleDark: '#b06edb',
  orange: '#FF9600', orangeDark: '#e08600',
} as const;

type Tab = 'paste' | 'prospect';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<Tab | null>(null);

  // Hub view (no tab selected yet)
  if (!activeTab) {
    return (
      <div>
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-text-main mb-2">Rapports</h1>
          <p className="text-base text-text-muted max-w-lg mx-auto">
            Choisissez votre outil pour analyser et présenter le portefeuille de votre client.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Card: Rapport Prospect */}
          <button
            onClick={() => setActiveTab('prospect')}
            className="text-left rounded-2xl bg-white p-6 transition-all duration-200 hover:scale-[1.02] active:translate-y-[2px] active:shadow-none group"
            style={{ border: `2px solid ${DUO.purple}30`, borderBottom: `5px solid ${DUO.purpleDark}30` }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110"
              style={{ backgroundColor: `${DUO.purple}15`, boxShadow: `0 3px 0 0 ${DUO.purpleDark}20` }}
            >
              <UserPlus className="h-7 w-7" style={{ color: DUO.purple }} />
            </div>

            <h2 className="text-xl font-extrabold text-text-main mb-1">Rapport Prospect</h2>
            <p className="text-sm text-text-muted mb-5">
              Pour les clients potentiels — importez leur portefeuille depuis n&apos;importe quelle source et générez les cours cibles.
            </p>

            <div className="space-y-2.5 mb-6">
              {[
                { icon: FileSpreadsheet, text: 'Import flexible (Excel, CSV, liste de symboles)', color: DUO.purple },
                { icon: Sparkles, text: 'Détection IA des colonnes et des titres', color: DUO.orange },
                { icon: Search, text: 'Ajout manuel avec recherche de symboles', color: DUO.blue },
                { icon: Target, text: 'Cours cibles Yahoo Finance + PDF', color: DUO.green },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${f.color}15` }}>
                    <f.icon className="h-3.5 w-3.5" style={{ color: f.color }} />
                  </div>
                  <span className="text-xs font-medium text-text-main">{f.text}</span>
                </div>
              ))}
            </div>

            <div
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-extrabold text-sm text-white transition-all"
              style={{ backgroundColor: DUO.purple, boxShadow: `0 3px 0 0 ${DUO.purpleDark}` }}
            >
              Analyser un prospect
            </div>
          </button>

          {/* Card: Prêt à coller */}
          <button
            onClick={() => setActiveTab('paste')}
            className="text-left rounded-2xl bg-white p-6 transition-all duration-200 hover:scale-[1.02] active:translate-y-[2px] active:shadow-none group"
            style={{ border: `2px solid ${DUO.blue}30`, borderBottom: `5px solid ${DUO.blueDark}30` }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110"
              style={{ backgroundColor: `${DUO.blue}15`, boxShadow: `0 3px 0 0 ${DUO.blueDark}20` }}
            >
              <ClipboardPaste className="h-7 w-7" style={{ color: DUO.blue }} />
            </div>

            <h2 className="text-xl font-extrabold text-text-main mb-1">Prêt à coller</h2>
            <p className="text-sm text-text-muted mb-5">
              Collez les positions Croesus d&apos;un client et obtenez instantanément les cours cibles et l&apos;analyse complète.
            </p>

            <div className="space-y-2.5 mb-6">
              {[
                { icon: Zap, text: 'Détection automatique des types d\'actifs', color: DUO.orange },
                { icon: Target, text: 'Cours cibles consensus + estimation 12 mois', color: DUO.blue },
                { icon: Sparkles, text: 'Vérification IA des classifications', color: DUO.purple },
                { icon: BookOpen, text: 'Rapports de fonds intégrés au PDF', color: DUO.green },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${f.color}15` }}>
                    <f.icon className="h-3.5 w-3.5" style={{ color: f.color }} />
                  </div>
                  <span className="text-xs font-medium text-text-main">{f.text}</span>
                </div>
              ))}
            </div>

            <div
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-extrabold text-sm text-white transition-all"
              style={{ backgroundColor: DUO.blue, boxShadow: `0 3px 0 0 ${DUO.blueDark}` }}
            >
              Analyser un portefeuille
            </div>
          </button>
        </div>

        {/* Quick comparison */}
        <div className="mt-8 max-w-4xl mx-auto">
          <div className="grid grid-cols-2 gap-6 text-center">
            <div className="flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-gray-50">
              <CheckCircle2 className="h-4 w-4" style={{ color: DUO.purple }} />
              <span className="text-xs text-text-muted">
                <strong className="text-text-main">Rapport Prospect</strong> — Import flexible pour les non-clients
              </span>
            </div>
            <div className="flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-gray-50">
              <CheckCircle2 className="h-4 w-4" style={{ color: DUO.blue }} />
              <span className="text-xs text-text-muted">
                <strong className="text-text-main">Prêt à coller</strong> — Directement depuis Croesus, aucun setup
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Back button + section title */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setActiveTab(null)}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-white transition-all hover:bg-gray-50 active:translate-y-[1px]"
          style={{ border: '2px solid #e5e7eb', borderBottom: '3px solid #d1d5db' }}
        >
          <ArrowLeft className="h-4 w-4 text-text-muted" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold text-text-main">
            {activeTab === 'prospect' ? 'Rapport Prospect' : 'Prêt à coller'}
          </h1>
          <p className="text-xs text-text-muted">
            {activeTab === 'prospect'
              ? 'Import flexible pour les clients potentiels — cours cibles Yahoo Finance'
              : 'Analyse rapide des cours cibles depuis Croesus'}
          </p>
        </div>

        {/* Tab switcher (compact) */}
        <div className="flex items-center gap-1 bg-gray-100/80 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('prospect')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'prospect' ? 'bg-white text-text-main shadow-sm' : 'text-text-muted hover:text-text-main'
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Prospect
          </button>
          <button
            onClick={() => setActiveTab('paste')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'paste' ? 'bg-white text-text-main shadow-sm' : 'text-text-muted hover:text-text-main'
            }`}
          >
            <ClipboardPaste className="h-3.5 w-3.5" />
            Prêt à coller
          </button>
        </div>
      </div>

      {/* Le prospect enregistre des données client et demeure protégé par le coffre. */}
      {activeTab === 'prospect' && (
        <VaultGate>
          <ProspectReport />
        </VaultGate>
      )}

      {/* La génération locale du PDF reste accessible sans mot de passe. */}
      {activeTab === 'paste' && <PretAColler />}
    </div>
  );
}
