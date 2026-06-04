/** Extended Groq AI Prompts for V2 Report Generation */

export const SYSTEM_PROMPT_V2 = `Tu es un analyste financier senior québécois qui rédige des rapports professionnels pour des conseillers financiers du Groupe Financier Ste-Foy.

RÈGLES STRICTES:
- Rédige en français canadien (fr-CA) professionnel
- NE DONNE JAMAIS de conseils d'investissement directs (pas de "vous devriez acheter/vendre")
- Utilise des formulations neutres: "le portefeuille présente", "les données suggèrent", "on observe"
- Sois STRICTEMENT FACTUEL — base-toi uniquement sur les données fournies
- N'invente AUCUNE donnée, AUCUN chiffre, AUCUNE prédiction
- Ne mentionne jamais que tu es une IA ou un modèle de langage
- Utilise le vocabulaire financier québécois (rendement, placement, titre, avoir)
- Sois concis et professionnel — pas de phrases inutiles
- Pour les descriptions de titres: décris UNIQUEMENT ce que l'entreprise fait et son rôle dans le portefeuille. Aucune opinion.

FORMAT DE SORTIE: JSON strict selon le schéma fourni.`;

export const RESPONSE_SCHEMA_V2 = `{
  "executiveSummary": "string (120-180 mots) — Survol factuel du portefeuille, positionnement, forces, alignement avec le profil client",
  "allocationComment": "string (60-100 mots) — Observations sur la répartition sectorielle, géographique et par classe d'actif",
  "dnaComment": "string (60-90 mots) — Observation sur le style d'investissement dominant et la composition",
  "projectionComment": "string (60-90 mots) — Contexte factuel sur les projections Monte Carlo et probabilités observées",
  "fundamentalsComment": "string (60-100 mots) — Observations sur les métriques fondamentales agrégées du portefeuille",
  "valuationComment": "string (60-90 mots) — Observation factuelle sur les valorisations intrinsèques estimées",
  "incomeComment": "string (60-90 mots) — Observation sur le rendement en revenus et la couverture des dividendes",
  "bondsComment": "string (60-90 mots) ou null — Observation sur la duration, qualité de crédit et sensibilité aux taux (null si pas d'obligations)",
  "riskComment": "string (60-100 mots) — Contexte factuel sur les métriques de risque et la volatilité historique",
  "stressRadarComment": "string (60-90 mots) — Observation sur les sensibilités macroéconomiques identifiées",
  "correlationComment": "string (60-90 mots) — Observation sur le niveau de diversification et les corrélations entre actifs",
  "behavioralComment": "string (60-90 mots) — Contexte factuel sur le comportement historique estimé durant les crises",
  "marketComment": "string (80-120 mots) — Observations sur le contexte macroéconomique actuel (taux, inflation, conditions)",
  "benchmarkComment": "string (60-90 mots) — Observation factuelle sur la performance relative vs le benchmark",
  "recommendationsComment": "string (80-120 mots) — Observations factuelles sur les forces, faiblesses et pistes d'optimisation quantitatives",
  "holdingDescriptions": "Record<symbol, string> — Description factuelle de chaque position (30-50 mots/titre): ce que l'entreprise fait, son secteur, son rôle dans le portefeuille. AUCUNE opinion."
}`;

export interface V2PromptData {
  clientName: string;
  riskProfile: string;
  objectives: string;
  horizon: string;
  accountType: string;
  currency: string;
  totalValue: number;

  holdings: Array<{
    symbol: string;
    name: string;
    weight: number;
    sector: string;
    region: string;
    assetClass: string;
  }>;

  allocation: {
    byAssetClass: Array<{ label: string; pct: number }>;
    byRegion: Array<{ label: string; pct: number }>;
    bySector: Array<{ label: string; pct: number }>;
  };

  dna: {
    dominantStyle: string;
    secondaryStyle?: string;
    summary: string;
  };

  risk: {
    volatility: number;
    sharpe: number;
    sortino: number;
    maxDrawdown: number;
    beta: number;
    var95: number;
  };

  monteCarlo: {
    medianReturn: number;
    probLoss: number;
    p25Final: number;
    p50Final: number;
    p75Final: number;
  };

  fundamentals: {
    avgPE: number;
    avgROE: number;
    avgMargin: number;
    avgBeta: number;
    avgDebtEquity: number;
  };

  portfolioYield: number;
  totalAnnualIncome: number;
  bondAllocation: number;
  bondDuration?: number;
  avgCreditQuality?: string;

  intelligence: {
    overall: number;
    grade: string;
    subScores: Array<{ name: string; score: number }>;
  };

  diversification: {
    score: number;
    avgCorrelation: number;
    hhi: number;
    top5Concentration: number;
  };

  stressRadar: {
    resilience: number;
    vulnerabilities: string[];
    strengths: string[];
  };

  behavioral: {
    worstDrawdown: number;
    avgDrawdown: number;
  };

  benchmark: {
    name: string;
    portfolioReturn?: number;
    benchmarkReturn?: number;
    alpha?: number;
  };

  portfolioUpside: number;
}

export function buildReportPromptV2(data: V2PromptData): string {
  // Le nom réel du client n'est JAMAIS envoyé à Groq : le modèle n'en a pas
  // besoin (le nom est imprimé localement sur la page couverture du PDF via le
  // gabarit). On envoie un libellé neutre. data.clientName reste sur le type pour
  // le rendu du PDF, mais n'apparaît plus dans le prompt.
  return `Génère le contenu narratif pour un rapport de portefeuille complet (18 pages).

CLIENT: Le client
PROFIL DE RISQUE: ${data.riskProfile}
OBJECTIFS: ${data.objectives || 'Non spécifiés'}
HORIZON: ${data.horizon || 'Non spécifié'}
COMPTE: ${data.accountType} (${data.currency})
VALEUR TOTALE: ${Math.round(data.totalValue)} ${data.currency}

POSITIONS (${data.holdings.length} titres):
${JSON.stringify(data.holdings)}

ALLOCATION: ${JSON.stringify(data.allocation)}

ADN: Style dominant: ${data.dna.dominantStyle}${data.dna.secondaryStyle ? `, secondaire: ${data.dna.secondaryStyle}` : ''}
${data.dna.summary}

MÉTRIQUES DE RISQUE: ${JSON.stringify(data.risk)}

MONTE CARLO: Rendement médian ${(data.monteCarlo.medianReturn * 100).toFixed(1)}%, prob. perte ${(data.monteCarlo.probLoss * 100).toFixed(0)}%
Valeurs finales: P25=${Math.round(data.monteCarlo.p25Final)}, P50=${Math.round(data.monteCarlo.p50Final)}, P75=${Math.round(data.monteCarlo.p75Final)}

FONDAMENTAUX: ${JSON.stringify(data.fundamentals)}

REVENUS: Rendement ${(data.portfolioYield * 100).toFixed(2)}%, revenu annuel ${Math.round(data.totalAnnualIncome)} ${data.currency}
${data.bondAllocation > 0 ? `OBLIGATIONS: ${(data.bondAllocation * 100).toFixed(0)}% du portefeuille, duration ${data.bondDuration?.toFixed(1) || 'N/A'} ans, qualité ${data.avgCreditQuality || 'N/A'}` : 'PAS D\'OBLIGATIONS'}

SCORE INTELLIGENCE: ${data.intelligence.overall}/100 (${data.intelligence.grade})
Sous-scores: ${data.intelligence.subScores.map(s => `${s.name}=${s.score}`).join(', ')}

DIVERSIFICATION: Score ${data.diversification.score}/100, corr. moy. ${data.diversification.avgCorrelation.toFixed(2)}, HHI ${data.diversification.hhi.toFixed(0)}, top 5 ${(data.diversification.top5Concentration * 100).toFixed(0)}%

STRESS RADAR: Résilience ${data.stressRadar.resilience}/100
Vulnérabilités: ${data.stressRadar.vulnerabilities.join('; ') || 'Aucune identifiée'}
Forces: ${data.stressRadar.strengths.join('; ') || 'Aucune identifiée'}

COMPORTEMENTAL: Pire drawdown estimé ${(data.behavioral.worstDrawdown * 100).toFixed(0)}%, moyen ${(data.behavioral.avgDrawdown * 100).toFixed(0)}%

BENCHMARK: ${data.benchmark.name}
${data.benchmark.portfolioReturn !== undefined ? `Portfolio: ${(data.benchmark.portfolioReturn * 100).toFixed(1)}%, Benchmark: ${((data.benchmark.benchmarkReturn || 0) * 100).toFixed(1)}%, Alpha: ${((data.benchmark.alpha || 0) * 100).toFixed(2)}%` : 'Données insuffisantes'}

VALORISATION: Potentiel moyen ${(data.portfolioUpside * 100).toFixed(1)}% vs juste valeur

Réponds en JSON valide selon ce schéma:
${RESPONSE_SCHEMA_V2}`;
}
