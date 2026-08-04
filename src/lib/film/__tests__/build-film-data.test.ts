import { describe, it, expect } from 'vitest';
import {
  buildFilmData, buildWrappedCards, resolvedPredictions,
  buildContributions, buildTransparency, buildProjectionSeries, buildRevenuEncaisse,
  type FilmInput, type TransparencySnapshot,
} from '../build-film-data';
import type { PriceTargetHolding, PriceTargetReportData } from '../../pdf/price-targets-template';
import type { PortfolioActivitySummary } from '../../portfolio/year-activity';
import type { DeploymentSummary } from '../../portfolio/deployment';

// ── Fixtures ────────────────────────────────────────────────────────────────
// Les résumés d'activité et de déploiement portent ~30-45 champs ; les tests
// n'en fournissent que ceux que buildFilmData LIT réellement, puis castent.
// Un champ oublié se voit immédiatement (undefined → scène absente).

const holding = (over: Partial<PriceTargetHolding> = {}): PriceTargetHolding => ({
  symbol: 'RY.TO', name: 'Banque Royale du Canada', quantity: 100,
  averageCost: 100, marketPrice: 150, marketValue: 15000, bookValue: 10000,
  assetType: 'EQUITY', accountType: 'REER', accountLabel: 'REER', annualIncome: 400,
  ...over,
});

const summary = (over: Partial<PriceTargetReportData['summary']> = {}): PriceTargetReportData['summary'] => ({
  totalMarketValue: 15000, totalBookValue: 10000, totalAnnualIncome: 400,
  totalCurrentValue: 15000, totalTargetValue: 18000, totalGain: 3000, totalGainPct: 20,
  equityCount: 1, fixedIncomeCount: 0, cashCount: 0, otherCount: 0,
  pricesFound: 1, targetsFound: 1,
  ...over,
});

const report = (over: Partial<PriceTargetReportData> = {}): PriceTargetReportData => ({
  holdings: [holding()],
  generatedAt: '2026-07-29T16:00:00.000Z',
  clientName: 'Jean Tremblay',
  summary: summary(),
  ...over,
});

const activity = (over: Partial<PortfolioActivitySummary> = {}) => ({
  currentYear: 2026,
  income: 4218,
  netContributions: 43500,
  currentYearMonthlyIncome: [],
  ...over,
}) as PortfolioActivitySummary;

const deployment = (over: Partial<DeploymentSummary> = {}) => ({
  buyCount: 6,
  contributionCount: 12,
  deposits: 25000,
  contributions: 18500,
  depositCadenceRegular: true,
  growthFloor: { startingValue: 0, currentValue: 0, totalChange: 0, netDeposits: 0, residual: 18400, quadrant: 1 },
  ...over,
}) as DeploymentSummary;

const monthly = (label: string, income: number) => ({
  key: `2026-${label}`, label, income, dividends: income, fixedIncome: 0, otherIncome: 0, transactionCount: 1,
});

const snap = (over: Partial<TransparencySnapshot> = {}): TransparencySnapshot => ({
  symbol: 'RY.TO', name: 'Banque Royale', entry_type: 'price_target', name_idx: 'abc123',
  current_price: 150, target_price: 180, expected_gain_pct: 20, horizon_months: 12,
  predicted_at: '2025-07-01', resolved_at: '2026-07-01',
  actual_price: 175, actual_gain_pct: 16.7, hit: true,
  peak_price: 185, peak_at: '2026-03-15', trough_price: 140,
  ...over,
});

// ── Héros ───────────────────────────────────────────────────────────────────

describe('buildFilmData — le héros (aujourd\'hui → 12 mois)', () => {
  it('projette au consensus et calcule l\'éventail des analystes', () => {
    const d = buildFilmData({
      report: report({
        holdings: [holding({ currentPrice: 150, targetPrice: 180, targetLow: 160, targetHigh: 200, gainPct: 20 })],
      }),
    });
    // capital : 100 × (180−150) = 3000 ; bas 100 × (160−150) = 1000 ; haut 100 × (200−150) = 5000
    expect(d.hero.scenarios).toEqual({ low: 1000, mid: 3000, high: 5000 });
    expect(d.hero.portfolioValue).toBe(15000);
    expect(d.hero.projectedValue).toBe(18000);
    expect(d.hero.projectedGain).toBe(3000);
    expect(d.hero.projectedGainPct).toBeCloseTo(20, 6);
    expect(d.hero.hasRange).toBe(true);
    expect(d.hero.targetsCount).toBe(1);
  });

  it('ajoute le revenu annuel aux TROIS bornes (comme le PDF)', () => {
    const d = buildFilmData({
      report: report({
        holdings: [holding({ currentPrice: 150, targetPrice: 180, targetLow: 160, targetHigh: 200 })],
        summary: summary({ equityDividends: 400, fixedIncomeAnnualIncome: 100 }),
      }),
    });
    expect(d.hero.scenarios).toEqual({ low: 1500, mid: 3500, high: 5500 });
  });

  it('aucune cible → pas de projection, jamais de zéro trompeur', () => {
    const d = buildFilmData({ report: report({ holdings: [holding({ targetPrice: 0 })] }) });
    expect(d.hero.scenarios).toBeNull();
    expect(d.hero.projectedValue).toBeNull();
    expect(d.hero.projectedGainPct).toBeNull();
    expect(d.hero.hasRange).toBe(false);
  });

  it('bornes identiques (aucun targetLow/High) → hasRange faux', () => {
    const d = buildFilmData({
      report: report({ holdings: [holding({ currentPrice: 150, targetPrice: 180 })] }),
    });
    expect(d.hero.scenarios).toEqual({ low: 3000, mid: 3000, high: 3000 });
    expect(d.hero.hasRange).toBe(false);
  });

  it('liquidités et revenu fixe sont exclus de l\'éventail', () => {
    const d = buildFilmData({
      report: report({
        holdings: [
          holding({ currentPrice: 150, targetPrice: 180 }),
          holding({ symbol: 'CASH', assetType: 'CASH', targetPrice: 999, quantity: 1000, marketPrice: 1 }),
          holding({ symbol: 'OBLIG', assetType: 'FIXED_INCOME', targetPrice: 999, quantity: 1000, marketPrice: 1 }),
        ],
      }),
    });
    expect(d.hero.scenarios?.mid).toBe(3000); // seul le titre « actions » compte
  });
});

// ── Métadonnées ─────────────────────────────────────────────────────────────

describe('buildFilmData — métadonnées', () => {
  it('nom du client, conseiller par défaut, date en français', () => {
    const d = buildFilmData({ report: report() });
    expect(d.meta.client).toBe('Jean Tremblay');
    expect(d.meta.advisor).toBe('Nicolas Perron');
    expect(d.meta.generatedLabel).toMatch(/29 juillet 2026$/);
    expect(d.meta.currency).toBe('CAD');
  });

  it('l\'année vient de yearActivity quand elle existe', () => {
    const d = buildFilmData({ report: report({ yearActivity: activity({ currentYear: 2025 }) }) });
    expect(d.meta.year).toBe(2025);
  });
});

// ── Rétro « Wrapped » ───────────────────────────────────────────────────────

describe('buildWrappedCards — une carte n\'existe que si son chiffre existe', () => {
  const full: FilmInput = {
    report: report({
      holdings: [
        holding({ currentPrice: 150, targetPrice: 180, gainPct: 20, sector: 'FINANCIALS' }),
        holding({ symbol: 'NVDA', name: 'NVIDIA', currentPrice: 100, targetPrice: 134, gainPct: 34, sector: 'TECHNOLOGY' }),
        holding({ symbol: 'ENB.TO', name: 'Enbridge', currentPrice: 50, targetPrice: 55, gainPct: 10, sector: 'ENERGY' }),
      ],
      yearActivity: activity({
        currentYearMonthlyIncome: [monthly('JAN', 200), monthly('MAR', 900), monthly('JUL', 400)],
      }),
      deployment: deployment(),
    }),
  };

  it('produit au plus 6 cartes, dans un ordre stable', () => {
    const cards = buildWrappedCards(full);
    expect(cards.length).toBeLessThanOrEqual(6);
    // Même entrée → même sortie (le client doit revoir le même film)
    expect(buildWrappedCards(full).map(c => c.id)).toEqual(cards.map(c => c.id));
  });

  it('la constance cite le nombre réel de dépôts', () => {
    const c = buildWrappedCards(full).find(x => x.id === 'constance')!;
    expect(c.value).toBe('12');
    expect(c.line).toContain('12 dépôts');
  });

  it('le champion est le meilleur potentiel, pas le premier titre', () => {
    const c = buildWrappedCards(full).find(x => x.id === 'champion')!;
    expect(c.value).toBe('NVDA');
    expect(c.line).toContain('+34,0');
  });

  it('le meilleur mois est le sommet réel, nommé en français', () => {
    const c = buildWrappedCards(full).find(x => x.id === 'meilleur-mois')!;
    expect(c.value).toBe('Mars');
    expect(c.line).toContain('900');
  });

  it('sans dépôt, sans revenu, sans croissance → aucune de ces cartes', () => {
    const cards = buildWrappedCards({ report: report({ holdings: [holding({ targetPrice: 0 })] }) });
    const ids = cards.map(c => c.id);
    expect(ids).not.toContain('constance');
    expect(ids).not.toContain('revenu');
    expect(ids).not.toContain('croissance');
    expect(ids).not.toContain('champion'); // aucune cible → aucun champion
  });

  it('un champion à potentiel négatif n\'est pas célébré', () => {
    const cards = buildWrappedCards({
      report: report({ holdings: [holding({ currentPrice: 150, targetPrice: 120, gainPct: -20 })] }),
    });
    expect(cards.map(c => c.id)).not.toContain('champion');
  });

  it('moins de 3 mois de revenu → pas de carte « meilleur mois » (échantillon trop mince)', () => {
    const cards = buildWrappedCards({
      report: report({ yearActivity: activity({ currentYearMonthlyIncome: [monthly('JAN', 200), monthly('MAR', 900)] }) }),
    });
    expect(cards.map(c => c.id)).not.toContain('meilleur-mois');
  });
});

// ── Transparence ────────────────────────────────────────────────────────────

describe('resolvedPredictions — ce qui est réellement notable', () => {
  it('garde les prédictions échues et notées', () => {
    expect(resolvedPredictions([snap()])).toHaveLength(1);
  });

  it('écarte les propositions commerciales (model_portfolio)', () => {
    expect(resolvedPredictions([snap({ entry_type: 'model_portfolio' })])).toHaveLength(0);
  });

  it('écarte les lignes héritées sans index de coffre', () => {
    expect(resolvedPredictions([snap({ name_idx: null })])).toHaveLength(0);
  });

  it('écarte les prédictions encore en cours', () => {
    expect(resolvedPredictions([snap({ resolved_at: null })])).toHaveLength(0);
    expect(resolvedPredictions([snap({ hit: null })])).toHaveLength(0);
  });

  it('écarte les lignes sans cible', () => {
    expect(resolvedPredictions([snap({ target_price: 0 })])).toHaveLength(0);
  });

  it('garde le cas « touchée puis retombée » (hit avec gain négatif)', () => {
    const kept = resolvedPredictions([snap({ hit: true, actual_gain_pct: -8 })]);
    expect(kept).toHaveLength(1);
    expect(kept[0].hit).toBe(true);
    expect(kept[0].actual_gain_pct).toBe(-8);
  });
});

// ── Contributions par titre (curseur « et si » + cascade) ───────────────────

describe('buildContributions — qui contribue combien', () => {
  const three = [
    holding({ symbol: 'A', currentPrice: 100, targetPrice: 130, targetLow: 110, targetHigh: 150, quantity: 10 }),
    holding({ symbol: 'B', currentPrice: 50, targetPrice: 55, targetLow: 45, targetHigh: 70, quantity: 100 }),
    holding({ symbol: 'C', currentPrice: 20, targetPrice: 24, targetLow: 22, targetHigh: 30, quantity: 50 }),
  ];

  it('trie par apport consensus décroissant, pas par ordre de saisie', () => {
    // B : 100 × (55−50) = 500 · A : 10 × (130−100) = 300 · C : 50 × (24−20) = 200
    const c = buildContributions(three);
    expect(c.map(x => x.symbol)).toEqual(['B', 'A', 'C']);
    expect(c.map(x => Math.round(x.gainMid))).toEqual([500, 300, 200]);
  });

  it('l\'apport consensus est quantité × (cible − prix)', () => {
    const c = buildContributions(three);
    const a = c.find(x => x.symbol === 'A')!;
    expect(a.gainMid).toBeCloseTo(10 * (130 - 100), 6);
    expect(a.gainLow).toBeCloseTo(10 * (110 - 100), 6);
    expect(a.gainHigh).toBeCloseTo(10 * (150 - 100), 6);
  });

  it('INVARIANT : Σ apports consensus + revenu = la projection du héros', () => {
    const d = buildFilmData({
      report: report({ holdings: three, summary: summary({ equityDividends: 700, fixedIncomeAnnualIncome: 300 }) }),
    });
    const somme = d.contributions.reduce((s, c) => s + c.gainMid, 0) + d.incomeForScenarios;
    expect(somme).toBeCloseTo(d.hero.scenarios!.mid, 6);
    expect(d.incomeForScenarios).toBe(1000);
  });

  it('même invariant sur les bornes basse et haute', () => {
    const d = buildFilmData({ report: report({ holdings: three, summary: summary({ equityDividends: 500 }) }) });
    const low = d.contributions.reduce((s, c) => s + c.gainLow, 0) + d.incomeForScenarios;
    const high = d.contributions.reduce((s, c) => s + c.gainHigh, 0) + d.incomeForScenarios;
    expect(low).toBeCloseTo(d.hero.scenarios!.low, 6);
    expect(high).toBeCloseTo(d.hero.scenarios!.high, 6);
  });

  it('exclut liquidités, revenu fixe et titres sans cible (comme la projection)', () => {
    const c = buildContributions([
      holding({ symbol: 'OK', currentPrice: 10, targetPrice: 12 }),
      holding({ symbol: 'CASH', assetType: 'CASH', currentPrice: 1, targetPrice: 9 }),
      holding({ symbol: 'OBL', assetType: 'FIXED_INCOME', currentPrice: 1, targetPrice: 9 }),
      holding({ symbol: 'SANS', currentPrice: 10, targetPrice: 0 }),
    ]);
    expect(c.map(x => x.symbol)).toEqual(['OK']);
  });

  it('cible basse/haute absentes → les trois bornes valent le consensus', () => {
    const c = buildContributions([holding({ currentPrice: 100, targetPrice: 120, quantity: 5 })]);
    expect(c[0].gainLow).toBeCloseTo(100, 6);
    expect(c[0].gainMid).toBeCloseTo(100, 6);
    expect(c[0].gainHigh).toBeCloseTo(100, 6);
  });

  it('totalise les avis d\'analystes', () => {
    const d = buildFilmData({
      report: report({
        holdings: [
          holding({ symbol: 'A', currentPrice: 10, targetPrice: 12, analystCount: 14 }),
          holding({ symbol: 'B', currentPrice: 10, targetPrice: 12, analystCount: 8 }),
        ],
      }),
    });
    expect(d.analystTotal).toBe(22);
  });
});

// ── Transparence (bilan des prédictions échues) ─────────────────────────────

describe('buildTransparency — le bilan honnête', () => {
  it('null sous 3 prédictions : un taux sur 2 cas ne veut rien dire', () => {
    expect(buildTransparency([snap(), snap({ symbol: 'B' })])).toBeNull();
  });

  it('compte les cibles TOUCHÉES et le gain réel moyen', () => {
    const t = buildTransparency([
      snap({ symbol: 'A', hit: true, actual_gain_pct: 12 }),
      snap({ symbol: 'B', hit: false, actual_gain_pct: -4 }),
      snap({ symbol: 'C', hit: true, actual_gain_pct: 8 }),
      snap({ symbol: 'D', hit: false, actual_gain_pct: 2 }),
    ])!;
    expect(t.total).toBe(4);
    expect(t.hits).toBe(2);
    expect(t.hitRatePct).toBeCloseTo(50, 6);
    expect(t.avgRealizedPct).toBeCloseTo((12 - 4 + 8 + 2) / 4, 6);
  });

  it('montre les ratés — ils ne sont jamais filtrés', () => {
    const t = buildTransparency([
      snap({ symbol: 'A', hit: true }), snap({ symbol: 'B', hit: false }), snap({ symbol: 'C', hit: false }),
    ])!;
    expect(t.rows.filter(r => !r.hit)).toHaveLength(2);
    expect(t.rows).toHaveLength(3);
  });

  it('garde le cas « touchée puis retombée » avec son gain négatif', () => {
    const t = buildTransparency([
      snap({ symbol: 'A', hit: true, actual_gain_pct: -9 }),
      snap({ symbol: 'B', hit: true }), snap({ symbol: 'C', hit: true }),
    ])!;
    const a = t.rows.find(r => r.symbol === 'A')!;
    expect(a.hit).toBe(true);
    expect(a.actualGainPct).toBe(-9);
  });

  it('trie du plus récent au plus ancien', () => {
    const t = buildTransparency([
      snap({ symbol: 'VIEUX', predicted_at: '2024-01-10' }),
      snap({ symbol: 'RECENT', predicted_at: '2025-11-02' }),
      snap({ symbol: 'MOYEN', predicted_at: '2025-03-15' }),
    ])!;
    expect(t.rows.map(r => r.symbol)).toEqual(['RECENT', 'MOYEN', 'VIEUX']);
  });

  it('le scénario transparence suit exactement la présence du bilan', () => {
    const sans = buildFilmData({ report: report(), priorSnapshots: [snap(), snap({ symbol: 'B' })] });
    const avec = buildFilmData({ report: report(), priorSnapshots: [snap(), snap({ symbol: 'B' }), snap({ symbol: 'C' })] });
    expect(sans.transparency).toBeNull();
    expect(sans.scenes.map(s => s.id)).not.toContain('transparence');
    expect(avec.transparency).not.toBeNull();
    expect(avec.scenes.map(s => s.id)).toContain('transparence');
  });
});

// ── La trajectoire 12 mois ──────────────────────────────────────────────────

describe('buildProjectionSeries — le cône de projection', () => {
  const scen = { low: 1500, mid: 3500, high: 5500 };   // revenu annuel INCLUS
  const INCOME = 1200;
  const START = 100000;
  const cal12 = [100, 50, 300, 50, 100, 300, 50, 50, 300, 50, 100, 300]; // total 1750

  it('13 points, de aujourd\'hui à 12 mois', () => {
    const p = buildProjectionSeries(START, scen, INCOME, undefined, 0);
    expect(p.points).toHaveLength(13);
    expect(p.points[0].month).toBe(0);
    expect(p.points[12].month).toBe(12);
    expect(p.points[0].label).toBe('Aujourd’hui');
  });

  it('INVARIANT le cône part d\'UN SEUL point : les 4 courbes valent la valeur d\'aujourd\'hui', () => {
    const p = buildProjectionSeries(START, scen, INCOME, cal12, 6);
    const p0 = p.points[0];
    expect(p0.floor).toBe(START);
    expect(p0.low).toBe(START);
    expect(p0.mid).toBe(START);
    expect(p0.high).toBe(START);
    expect(p0.incomeCum).toBe(0);
  });

  it('INVARIANT à 12 mois, chaque courbe retombe sur la borne affichée', () => {
    const p = buildProjectionSeries(START, scen, INCOME, cal12, 6);
    const p12 = p.points[12];
    expect(p12.low).toBeCloseTo(START + scen.low, 6);
    expect(p12.mid).toBeCloseTo(START + scen.mid, 6);
    expect(p12.high).toBeCloseTo(START + scen.high, 6);
    expect(p12.floor).toBeCloseTo(START + INCOME, 6);
  });

  it('PIÈGE les revenus ne sont JAMAIS comptés deux fois', () => {
    // capital pur = borne − revenu annuel
    const p = buildProjectionSeries(START, scen, INCOME, cal12, 6);
    expect(p.capital.mid).toBe(scen.mid - INCOME);
    // À 12 mois : départ + revenus + capital = départ + borne (et pas + revenus en double)
    expect(p.points[12].mid).toBeCloseTo(START + INCOME + p.capital.mid, 6);
    expect(p.points[12].mid).not.toBeCloseTo(START + 2 * INCOME + p.capital.mid, 0);
  });

  it('les revenus cumulés suivent la CADENCE réelle et totalisent le revenu annuel', () => {
    const p = buildProjectionSeries(START, scen, INCOME, cal12, 0); // départ janvier
    expect(p.realCadence).toBe(true);
    // Le calendrier totalise 1750 mais le revenu autoritaire est 1200 → mise à l'échelle
    expect(p.points[12].incomeCum).toBeCloseTo(INCOME, 6);
    // Croissance monotone, jamais décroissante
    for (let t = 1; t <= 12; t++) {
      expect(p.points[t].incomeCum).toBeGreaterThanOrEqual(p.points[t - 1].incomeCum);
    }
    // La forme est bien celle du calendrier : un mois riche fait un plus grand pas
    // qu'un mois creux. Départ = janvier, donc t=1 est FÉVRIER (50), t=2 mars (300),
    // t=3 avril (50) — le point t est le mois qui SUIT le départ, t fois.
    const dFev = p.points[1].incomeCum - p.points[0].incomeCum;
    const dMars = p.points[2].incomeCum - p.points[1].incomeCum;
    const dAvr = p.points[3].incomeCum - p.points[2].incomeCum;
    expect(dMars).toBeGreaterThan(dFev * 3);
    expect(dMars).toBeGreaterThan(dAvr * 3);
  });

  it('sans calendrier : répartition égale, et le total reste exact', () => {
    const p = buildProjectionSeries(START, scen, INCOME, undefined, 3);
    expect(p.realCadence).toBe(false);
    expect(p.points[6].incomeCum).toBeCloseTo(INCOME / 2, 6);
    expect(p.points[12].incomeCum).toBeCloseTo(INCOME, 6);
  });

  it('calendrier vide ou incomplet → repli sur la répartition égale', () => {
    expect(buildProjectionSeries(START, scen, INCOME, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 0).realCadence).toBe(false);
    expect(buildProjectionSeries(START, scen, INCOME, [100, 200], 0).realCadence).toBe(false);
  });

  it('le mois de départ décale bien les libellés', () => {
    const p = buildProjectionSeries(START, scen, INCOME, cal12, 6); // juillet
    expect(p.points[1].label).toBe('août');
    expect(p.points[6].label).toBe('janv.');
    expect(p.points[12].label).toBe('juil.');
  });

  it('scénario prudent NÉGATIF : la courbe basse passe SOUS le plancher (honnête)', () => {
    const baissier = { low: -4000, mid: 500, high: 5000 };
    const p = buildProjectionSeries(START, baissier, INCOME, cal12, 6);
    expect(p.capital.low).toBe(-4000 - INCOME);
    expect(p.points[12].low).toBeLessThan(p.points[12].floor);
    expect(p.points[12].low).toBeCloseTo(START + baissier.low, 6);
  });

  it('branché dans le scénario : la trajectoire épouse le héros', () => {
    const d = buildFilmData({
      report: report({
        holdings: [holding({ currentPrice: 150, targetPrice: 180, targetLow: 160, targetHigh: 200, quantity: 100 })],
        summary: summary({ totalMarketValue: 15000, equityDividends: 400, fixedIncomeAnnualIncome: 100 }),
        incomeCalendar: cal12.map((v, i) => ({ label: String(i), dividends: v, coupons: 0 })),
      }),
    });
    expect(d.projection).not.toBeNull();
    const p = d.projection!;
    expect(p.points[0].mid).toBeCloseTo(d.hero.portfolioValue, 6);
    expect(p.points[12].mid).toBeCloseTo(d.hero.projectedValue as number, 6);
    expect(p.incomeTotal).toBe(d.incomeForScenarios);
  });

  it('aucune cible → aucune trajectoire (pas de cône inventé)', () => {
    const d = buildFilmData({ report: report({ holdings: [holding({ targetPrice: 0 })] }) });
    expect(d.projection).toBeNull();
  });
});

// ── Le scénario (conditions de présence) ────────────────────────────────────

describe('buildFilmData — sélection des scènes', () => {
  it('portefeuille minimal : seules les scènes toujours possibles', () => {
    const d = buildFilmData({ report: report({ holdings: [holding({ targetPrice: 0 })] }) });
    expect(d.scenes.map(s => s.id)).toEqual(['ouverture', 'repartition', 'titres', 'simulateur', 'signature']);
  });

  it('une cible suffit pour la scène « où on s\'en va »', () => {
    const d = buildFilmData({ report: report({ holdings: [holding({ currentPrice: 150, targetPrice: 180 })] }) });
    expect(d.scenes.map(s => s.id)).toContain('horizon');
  });

  it('le parcours n\'apparaît que s\'il y a eu des achats', () => {
    const withBuys = buildFilmData({ report: report({ deployment: deployment({ buyCount: 3 }) }) });
    const noBuys = buildFilmData({ report: report({ deployment: deployment({ buyCount: 0 }) }) });
    expect(withBuys.scenes.map(s => s.id)).toContain('parcours');
    expect(noBuys.scenes.map(s => s.id)).not.toContain('parcours');
  });

  it('le podium exige au moins 3 titres avec un potentiel', () => {
    const two = buildFilmData({
      report: report({
        holdings: [
          holding({ symbol: 'A', currentPrice: 10, targetPrice: 12, gainPct: 20 }),
          holding({ symbol: 'B', currentPrice: 10, targetPrice: 12, gainPct: 20 }),
        ],
      }),
    });
    expect(two.scenes.map(s => s.id)).not.toContain('podium');
  });

  it('la transparence exige au moins 3 prédictions résolues', () => {
    const two = buildFilmData({ report: report(), priorSnapshots: [snap(), snap({ symbol: 'B' })] });
    const three = buildFilmData({
      report: report(),
      priorSnapshots: [snap(), snap({ symbol: 'B' }), snap({ symbol: 'C' })],
    });
    expect(two.scenes.map(s => s.id)).not.toContain('transparence');
    expect(three.scenes.map(s => s.id)).toContain('transparence');
  });

  it('la rétro exige au moins 3 cartes calculables', () => {
    const rich = buildFilmData({
      report: report({
        holdings: [
          holding({ currentPrice: 150, targetPrice: 180, gainPct: 20 }),
          holding({ symbol: 'B', currentPrice: 10, targetPrice: 12, gainPct: 20 }),
          holding({ symbol: 'C', currentPrice: 10, targetPrice: 12, gainPct: 20 }),
        ],
        yearActivity: activity(),
        deployment: deployment(),
      }),
    });
    expect(rich.wrapped.length).toBeGreaterThanOrEqual(3);
    expect(rich.scenes.map(s => s.id)).toContain('wrapped');
  });

  it('la durée automatique reste sous 2 minutes sur un dossier complet', () => {
    const d = buildFilmData({
      report: report({
        holdings: [
          holding({ currentPrice: 150, targetPrice: 180, targetLow: 160, targetHigh: 200, gainPct: 20, sector: 'FINANCIALS' }),
          holding({ symbol: 'B', currentPrice: 10, targetPrice: 12, gainPct: 20, sector: 'TECHNOLOGY' }),
          holding({ symbol: 'C', currentPrice: 10, targetPrice: 12, gainPct: 20, sector: 'ENERGY' }),
        ],
        yearActivity: activity({ currentYearMonthlyIncome: [monthly('JAN', 200), monthly('MAR', 900), monthly('JUL', 400)] }),
        deployment: deployment(),
        summary: summary({ equityDividends: 400 }),
      }),
      priorSnapshots: [snap(), snap({ symbol: 'B' }), snap({ symbol: 'C' })],
    });
    // Toutes les scènes présentes
    expect(d.scenes).toHaveLength(12);
    expect(d.autoDurationSec).toBeGreaterThan(60);
    expect(d.autoDurationSec).toBeLessThanOrEqual(120);
  });

  it('les scènes interactives ne comptent pas dans le chrono', () => {
    const d = buildFilmData({ report: report() });
    const interactives = d.scenes.filter(s => ['titres', 'simulateur'].includes(s.id));
    expect(interactives.length).toBeGreaterThan(0);
    expect(interactives.every(s => s.autoMs === 0)).toBe(true);
  });
});

// ─── Revenu déjà versé ───────────────────────────────────────────────────────
// Le HTML écrivait « Encaissé 0 $ » EN DUR : à partir de février il contredisait
// le PDF sur un montant d'argent reçu. Ces tests verrouillent la parité avec le
// calcul du PDF (IncomeDashboard), qui est la référence.
describe('buildRevenuEncaisse', () => {
  const cal = (d: number, c: number) => ({ dividends: d, coupons: c });
  const douze = (d: number, c: number) => Array.from({ length: 12 }, () => cal(d, c));
  const mois = (i: number, dividends: number, fixedIncome: number) => ({
    key: '2026-' + String(i + 1).padStart(2, '0'), dividends, fixedIncome,
  });

  it('retourne null sans transactions — on n’affirme rien qu’on ne sait pas', () => {
    expect(buildRevenuEncaisse(douze(100, 50), null, new Date(2026, 6, 15))).toBeNull();
    expect(buildRevenuEncaisse(douze(100, 50), { currentYear: 2026, currentYearMonthlyIncome: [] },
      new Date(2026, 6, 15))).toBeNull();
  });

  it('un mois PASSÉ ne compte plus rien à venir, même si le projeté était plus gros', () => {
    const r = buildRevenuEncaisse(
      douze(100, 0),
      { currentYear: 2026, currentYearMonthlyIncome: [mois(0, 60, 0)] },
      new Date(2026, 2, 15),
    )!;
    // Janvier : 60 reçus (et non 100). Février : passé et sans transaction → 0 des deux côtés.
    // Mars (courant) : 100 prévus, rien reçu → 100 à venir. Avril à décembre : 900.
    expect(r.dividendesVerses).toBe(60);
    expect(r.dividendesAVenir).toBe(1000);
  });

  it('le mois COURANT ne compte que son solde', () => {
    const r = buildRevenuEncaisse(
      douze(100, 0),
      { currentYear: 2026, currentYearMonthlyIncome: [mois(6, 30, 0)] },
      new Date(2026, 6, 15),
    )!;
    expect(r.dividendesVerses).toBe(30);
    // Juillet : 100 − 30 = 70 ; août à décembre : 500.
    expect(r.dividendesAVenir).toBe(570);
  });

  it('sépare dividendes et coupons sans jamais les mélanger', () => {
    const r = buildRevenuEncaisse(
      douze(100, 40),
      { currentYear: 2026, currentYearMonthlyIncome: [mois(0, 90, 35), mois(1, 110, 20)] },
      new Date(2026, 2, 1),
    )!;
    expect(r.dividendesVerses).toBe(200);
    expect(r.couponsVerses).toBe(55);
    expect(r.dividendesAVenir).toBe(1000);
    expect(r.couponsAVenir).toBe(400);
  });

  it('une année révolue ne garde que le solde de décembre — parité avec le PDF', () => {
    const r = buildRevenuEncaisse(
      douze(100, 0),
      { currentYear: 2025, currentYearMonthlyIncome: [{ key: '2025-01', dividends: 80, fixedIncome: 0 }] },
      new Date(2026, 6, 15),
    )!;
    expect(r.dividendesVerses).toBe(80);
    // ⚠️ Le PDF fixe le « mois courant » à DÉCEMBRE pour une année révolue, jamais
    // au-delà : décembre garde donc son solde à venir, même sept mois après la fin
    // de l'année. C'est discutable — mais les deux documents sont remis au même
    // client et doivent dire la même chose. On copie le PDF, on ne le corrige pas
    // d'un seul côté. Si on le corrige un jour, ce sera des deux côtés à la fois.
    expect(r.dividendesAVenir).toBe(100);
  });

  it('l’avancement reste borné, et un versé qui bat le projeté le pousse vers 100', () => {
    const r = buildRevenuEncaisse(
      douze(10, 0),
      { currentYear: 2026, currentYearMonthlyIncome: [mois(0, 5000, 0)] },
      new Date(2026, 11, 31),
    )!;
    // 5 000 reçus, 10 encore attendus en décembre : 5 000 / 5 010.
    expect(r.avancement).toBeCloseTo(99.8, 1);
    expect(r.avancement).toBeLessThanOrEqual(100);
    expect(r.avancement).toBeGreaterThanOrEqual(0);
  });

  it('ignore les montants négatifs (une reprise de dividende ne crée pas de versé négatif)', () => {
    const r = buildRevenuEncaisse(
      douze(100, 0),
      { currentYear: 2026, currentYearMonthlyIncome: [mois(0, -50, 0)] },
      new Date(2026, 1, 1),
    )!;
    expect(r.dividendesVerses).toBe(0);
  });
});
