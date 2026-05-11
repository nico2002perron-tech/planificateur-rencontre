'use client';

import { useState } from 'react';
import { PortfolioBuilder } from '@/components/strategies/PortfolioBuilder';
import { PortfolioAnalysis } from '@/components/strategies/PortfolioAnalysis';
import {
  ArrowLeft, Compass, Sparkles, Search, PieChart,
  BarChart3, TrendingUp, Shield, FileText, Pencil,
} from 'lucide-react';

const DUO = {
  green: '#58CC02', greenDark: '#45a300',
  blue: '#1CB0F6', blueDark: '#1899d6',
  purple: '#CE82FF', purpleDark: '#b06edb',
  orange: '#FF9600', orangeDark: '#e08600',
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnalysisData = any;

export default function StrategiesPage() {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [editHoldings, setEditHoldings] = useState<Array<{ symbol: string; name: string; weight: number }> | undefined>();
  const [editName, setEditName] = useState<string | undefined>();
  const [editBenchmark, setEditBenchmark] = useState<string | undefined>();
  const [editPortfolioValue, setEditPortfolioValue] = useState<number | undefined>();

  // Start editing from analysis results
  const handleEdit = () => {
    if (!analysisData) return;
    setEditHoldings(
      analysisData.holdings.map((h: { symbol: string; name: string; weight: number }) => ({
        symbol: h.symbol,
        name: h.name,
        weight: h.weight,
      }))
    );
    setEditName(analysisData.name);
    setEditBenchmark(analysisData.benchmark);
    setEditPortfolioValue(analysisData.portfolioValue);
    setAnalysisData(null);
    setIsBuilding(true);
  };

  // Start fresh
  const handleNew = () => {
    setEditHoldings(undefined);
    setEditName(undefined);
    setEditBenchmark(undefined);
    setEditPortfolioValue(undefined);
    setAnalysisData(null);
    setIsBuilding(true);
  };

  // Landing page when no analysis is loaded
  if (!isBuilding && !analysisData) {
    return (
      <div>
        <div className="text-center mb-10">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: `${DUO.blue}15`, boxShadow: `0 4px 0 0 ${DUO.blueDark}20` }}
          >
            <Compass className="h-8 w-8" style={{ color: DUO.blue }} />
          </div>
          <h1 className="text-3xl font-extrabold text-text-main mb-2">Stratégies</h1>
          <p className="text-base text-text-muted max-w-xl mx-auto">
            Construisez des portefeuilles modèles professionnels et générez des rapports
            d&apos;analyse complets dignes de Morningstar.
          </p>
        </div>

        {/* Main CTA */}
        <div className="max-w-2xl mx-auto mb-8">
          <button
            onClick={handleNew}
            className="w-full text-left rounded-2xl bg-white p-8 transition-all duration-200 hover:scale-[1.01] active:translate-y-[2px] active:shadow-none group"
            style={{ border: `2px solid ${DUO.blue}30`, borderBottom: `5px solid ${DUO.blueDark}30` }}
          >
            <div className="flex items-center gap-6">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
                style={{ backgroundColor: `${DUO.blue}15`, boxShadow: `0 3px 0 0 ${DUO.blueDark}20` }}
              >
                <Search className="h-8 w-8" style={{ color: DUO.blue }} />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-extrabold text-text-main mb-1">
                  Créer un portefeuille modèle
                </h2>
                <p className="text-sm text-text-muted">
                  Recherchez des titres, importez un relevé (Excel, CSV, photo) et générez une analyse complète avec rapport PDF.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              {[
                { icon: Search, text: 'Recherche intelligente', color: DUO.blue },
                { icon: PieChart, text: 'Allocation & Style', color: DUO.purple },
                { icon: TrendingUp, text: 'Rendements 10 ans', color: DUO.green },
                { icon: Shield, text: 'Statistiques de risque', color: DUO.orange },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${f.color}15` }}>
                    <f.icon className="h-3.5 w-3.5" style={{ color: f.color }} />
                  </div>
                  <span className="text-xs font-medium text-text-main">{f.text}</span>
                </div>
              ))}
            </div>

            <div
              className="flex items-center justify-center gap-2 py-3 rounded-xl font-extrabold text-sm text-white transition-all mt-6"
              style={{ backgroundColor: DUO.blue, boxShadow: `0 3px 0 0 ${DUO.blueDark}` }}
            >
              <Sparkles className="h-4 w-4" />
              Commencer
            </div>
          </button>
        </div>

        {/* Features grid */}
        <div className="max-w-2xl mx-auto">
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: BarChart3, title: 'Analyse fondamentale', desc: 'P/E, P/B, ROE pondérés', color: DUO.purple },
              { icon: TrendingUp, title: 'Rendements historiques', desc: 'Croissance de 10 000$', color: DUO.green },
              { icon: FileText, title: 'Rapport PDF pro', desc: '15+ pages Morningstar-style', color: DUO.orange },
            ].map((f, i) => (
              <div
                key={i}
                className="rounded-xl bg-white p-4 text-center"
                style={{ border: `1px solid ${f.color}20` }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2"
                  style={{ backgroundColor: `${f.color}12` }}
                >
                  <f.icon className="h-5 w-5" style={{ color: f.color }} />
                </div>
                <h3 className="text-sm font-bold text-text-main">{f.title}</h3>
                <p className="text-xs text-text-muted mt-0.5">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gray-50">
            <Sparkles className="h-4 w-4" style={{ color: DUO.blue }} />
            <span className="text-xs text-text-muted">
              Données : <strong className="text-text-main">EODHD</strong> (fondamentaux) + <strong className="text-text-main">Yahoo Finance</strong> (historique & cours cibles)
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Analysis results view
  if (analysisData) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={handleNew}
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-white transition-all hover:bg-gray-50 active:translate-y-[1px]"
            style={{ border: '2px solid #e5e7eb', borderBottom: '3px solid #d1d5db' }}
          >
            <ArrowLeft className="h-4 w-4 text-text-muted" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-extrabold text-text-main">{analysisData.name}</h1>
            <p className="text-xs text-text-muted">
              {analysisData.holdingsCount} positions · {analysisData.dataMonths} mois d&apos;historique · Benchmark: {analysisData.benchmark}
              {analysisData.portfolioValue ? ` · $${Number(analysisData.portfolioValue).toLocaleString('fr-CA')}` : ''}
            </p>
          </div>
          <button
            onClick={handleEdit}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all text-white"
            style={{ backgroundColor: DUO.orange, boxShadow: `0 3px 0 0 ${DUO.orangeDark}` }}
          >
            <Pencil className="h-3.5 w-3.5" />
            Modifier
          </button>
          <button
            onClick={handleNew}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all text-white"
            style={{ backgroundColor: DUO.blue, boxShadow: `0 3px 0 0 ${DUO.blueDark}` }}
          >
            <Search className="h-3.5 w-3.5" />
            Nouveau
          </button>
        </div>
        <PortfolioAnalysis data={analysisData} />
      </div>
    );
  }

  // Builder view
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => { setIsBuilding(false); setEditHoldings(undefined); }}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-white transition-all hover:bg-gray-50 active:translate-y-[1px]"
          style={{ border: '2px solid #e5e7eb', borderBottom: '3px solid #d1d5db' }}
        >
          <ArrowLeft className="h-4 w-4 text-text-muted" />
        </button>
        <div>
          <h1 className="text-xl font-extrabold text-text-main">Constructeur de stratégie</h1>
          <p className="text-xs text-text-muted">
            Ajoutez des titres, importez un relevé ou lancez l&apos;analyse complète.
          </p>
        </div>
      </div>
      <PortfolioBuilder
        onAnalysisComplete={(data) => setAnalysisData(data)}
        initialHoldings={editHoldings}
        initialName={editName}
        initialBenchmark={editBenchmark}
        initialPortfolioValue={editPortfolioValue}
      />
    </div>
  );
}
