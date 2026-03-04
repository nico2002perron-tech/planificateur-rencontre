/** Groq AI Prompts for Report Generation */

import type { FullReportData } from '@/lib/pdf/report-data';
import type { ValuationDataItem } from './types';

export const SYSTEM_PROMPT = `Tu es un analyste financier senior québécois qui rédige des rapports professionnels pour des conseillers financiers du Groupe Financier Ste-Foy.

RÈGLES STRICTES:
- Rédige en français canadien (fr-CA) professionnel
- NE DONNE JAMAIS de conseils d'investissement directs (pas de "vous devriez acheter/vendre")
- Utilise des formulations neutres: "le portefeuille présente", "les données suggèrent", "on observe"
- Sois factuel et basé sur les données fournies uniquement
- Ne mentionne jamais que tu es une IA ou un modèle de langage
- Utilise le vocabulaire financier québécois (rendement, placement, titre, avoir)
- Sois concis et professionnel — pas de phrases inutiles

FORMAT DE SORTIE: JSON strict selon le schéma fourni.`;

export const RESPONSE_SCHEMA = `{
  "executiveSummary": "string (120-180 mots) — Survol du portefeuille, positionnement, forces, alignement avec le profil client",
  "allocationComment": "string (80-120 mots) — Analyse de la répartition sectorielle, géographique et par classe d'actif",
  "targetAnalysis": "string (100-150 mots) — Analyse des cours cibles et valorisation, tendances observées",
  "riskInterpretation": "string (80-120 mots) — Explication des métriques de risque en contexte du profil client",
  "holdingDescriptions": "Record<symbol, string> — Description factuelle en français de chaque entreprise (40-60 mots/titre)",
  "valuationComment": "string (80-120 mots) — Commentaire sur les valorisations intrinsèques si données disponibles"
}`;

export function buildReportPrompt(
  data: FullReportData,
  valuationData?: ValuationDataItem[] | null
): string {
  const holdings = data.portfolio.holdings.map((h) => ({
    symbol: h.symbol,
    name: h.name,
    weight: +h.weight.toFixed(1),
    sector: h.sector,
    region: h.region,
    gainPct: +h.gainLossPercent.toFixed(1),
    assetClass: h.assetClass,
  }));

  const profiles = data.holdingProfiles.map((hp) => ({
    symbol: hp.symbol,
    name: hp.companyName,
    description: hp.description.substring(0, 200),
    sector: hp.sector,
    industry: hp.industry,
    country: hp.country,
    targetPrice: hp.targetPrice,
    currentPrice: hp.currentPrice,
    gainPct: hp.estimatedGainPercent,
    analysts: hp.numberOfAnalysts,
  }));

  const allocAsset = data.allocations.byAssetClass.map((a) => ({
    class: a.label,
    pct: +a.percentage.toFixed(1),
  }));

  const allocRegion = data.allocations.byRegion.map((a) => ({
    region: a.label,
    pct: +a.percentage.toFixed(1),
  }));

  const sectors = data.sectorBreakdown.slice(0, 6).map((s) => ({
    sector: s.sectorLabel,
    pct: +s.weight.toFixed(1),
  }));

  const risk = {
    volatility: +data.riskMetrics.volatility.toFixed(1),
    sharpe: +data.riskMetrics.sharpe.toFixed(2),
    maxDrawdown: +data.riskMetrics.maxDrawdown.toFixed(1),
    beta: +data.riskMetrics.beta.toFixed(2),
  };

  const target = {
    totalCurrent: Math.round(data.priceTargetSummary.totalCurrentValue),
    totalTarget: Math.round(data.priceTargetSummary.totalTargetValue),
    gainPct: +data.priceTargetSummary.totalEstimatedGainPercent.toFixed(1),
  };

  const valuation = valuationData?.map((v) => ({
    symbol: v.symbol,
    price: +v.currentPrice.toFixed(2),
    dcf: +v.priceDcf.toFixed(2),
    ps: +v.priceSales.toFixed(2),
    pe: +v.priceEarnings.toFixed(2),
    avg: +v.avgIntrinsic.toFixed(2),
    upside: +v.upsidePercent.toFixed(1),
    score: +v.scores.overall.toFixed(1),
  }));

  const prompt = `Génère le contenu narratif pour un rapport de portefeuille.

CLIENT: ${data.client.name}
TYPE: ${data.client.type === 'client' ? 'Client' : 'Prospect'}
PROFIL DE RISQUE: ${data.client.riskProfile}
OBJECTIFS: ${data.client.objectives || 'Non spécifiés'}
HORIZON: ${data.client.horizon || 'Non spécifié'}
COMPTE: ${data.portfolio.accountType} (${data.portfolio.currency})
VALEUR TOTALE: ${Math.round(data.portfolio.totalValue)} ${data.portfolio.currency}

POSITIONS (${holdings.length} titres):
${JSON.stringify(holdings)}

PROFILS DES TITRES:
${JSON.stringify(profiles)}

ALLOCATION PAR CLASSE D'ACTIF: ${JSON.stringify(allocAsset)}
ALLOCATION GÉOGRAPHIQUE: ${JSON.stringify(allocRegion)}
PRINCIPAUX SECTEURS: ${JSON.stringify(sectors)}

MÉTRIQUES DE RISQUE: ${JSON.stringify(risk)}
COURS CIBLES CONSENSUS: ${JSON.stringify(target)}
${valuation ? `\nVALORISATION INTRINSÈQUE:\n${JSON.stringify(valuation)}` : ''}

Réponds en JSON valide selon ce schéma:
${RESPONSE_SCHEMA}`;

  return prompt;
}
