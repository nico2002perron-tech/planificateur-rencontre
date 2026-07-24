// DÉPLOIEMENT DES DÉPÔTS — le moteur pur de la page « Le parcours de votre argent ».
// Répond à : « Qu'avez-vous fait avec l'argent que je vous ai confié, et ça a donné quoi ? »
//
// Règles d'honnêteté (arbitrées en conception, défendables devant un régulateur) :
// - La valeur actuelle des parts achetées n'est affichée QUE si la position détenue
//   contient encore TOUTES les parts achetées (status 'held') — l'attribution de lots
//   est impossible sans données de lots, donc « — » plutôt qu'une estimation.
// - Les dividendes sont EXCLUS de l'écart (ils couvrent toute la position, anciennes
//   et nouvelles parts) — renvoi vers la page Activité.
// - Pour les titres revendus, seul le Gains/Pertes inscrit par Croesus (colonne 12,
//   un FAIT du relevé) est exposé — jamais un réalisé calculé maison.
// - Aucune I/O : les positions actuelles et le taux USD sont injectés.

import type { CroesusActivityTransaction, ActivityPeriod, MonthlyPortfolioActivity, ContributionSecurity } from './year-activity';
import { getActivityWindow, parseDate, buildMonthBuckets, analyzeContributions } from './year-activity';
// Import sans cycle (croesus-parser n'importe rien de lib/portfolio) ; si un
// cycle apparaît un jour, extraire la map vers lib/portfolio/account-labels.ts.
import { ACCOUNT_TYPE_MAP } from '@/lib/parsers/croesus-parser';

export type DeploymentLineStatus = 'held' | 'partial' | 'closed' | 'unmatched' | 'unpriceable';

/** Position actuelle injectée (du portefeuille collé dans Prêt à coller). */
export interface DeploymentPosition {
  symbol: string;
  name?: string;
  quantity: number;
  marketValue: number;
  currency?: string;
  currentPrice?: number; // déjà en CAD document quand fourni
  assetType?: string;    // ex. 'FIXED_INCOME' → cotation par tranche de 100 $ nominal
}

export interface DeploymentLine {
  symbol: string;
  name: string;
  buyCount: number;
  boughtQty: number;
  totalCostCad: number;   // Σ |montant net Croesus| en CAD — commissions incluses (le net les inclut déjà)
  avgUnitCost: number;    // coût moyen pondéré par les quantités (≈ PBR ARC)
  weightPct: number;      // part de cette ligne dans totalBuys (0-100)
  sellCount: number;
  soldQty: number;
  currentQty: number | null;        // position AGRÉGÉE multi-comptes ; null si introuvable
  currentUnitValue: number | null;
  currentValue: number | null;      // boughtQty × currentUnitValue — SEULEMENT 'held'
  deltaAbs: number | null;          // SEULEMENT 'held'
  deltaPct: number | null;          // SEULEMENT 'held'
  realizedFromCroesus: number | null; // Σ colonne Gains/Pertes des VENTES — fait du relevé
  status: DeploymentLineStatus;
  /** Obligation : la « quantité » est une valeur NOMINALE ($) et le prix se cote
   *  par tranche de 100 $ — l'affichage multiplie le prix unitaire par 100. */
  isBond: boolean;
}

export interface DeploymentReconciliation {
  windowTransactionCount: number;
  incomeCount: number;
  contributionCount: number;
  depositCount: number;
  withdrawalCount: number;
  buyCount: number;
  sellCount: number;
  otherCount: number; // catégorie 'other' HORS achats/ventes (frais, transferts…)
  /** Nombre de lignes appariées par le repli « base du symbole » (risque classes A/B). */
  baseSymbolFallbackCount: number;
}

/** Un titre acheté DANS un chapitre (agrégé par symbole, trié par coût décroissant). */
export interface ChapterBuy {
  symbol: string;
  name: string;
  amountCad: number;
  buyCount: number;
}

/** Un « chapitre » de la timeline : un jour de dépôt (tous les dépôts du même
 *  jour fusionnés — attribuer les achats entre deux dépôts du même jour serait
 *  arbitraire) et les achats qui l'ont SUIVI, jusqu'au dépôt suivant.
 *  Convention divulguée : « chaque achat est rattaché au dernier dépôt qui le
 *  précède ou qui a lieu le même jour — un ordre de dates, jamais une
 *  affectation de fonds ». */
export interface DepositChapter {
  date: string; // ISO
  amountCad: number;
  accounts: { label: string | null; amountCad: number }[];
  buys: ChapterBuy[];
  totalFollowedCad: number;
  buyCount: number;
  daysToFirstBuy: number | null; // 0 si même jour ; null si aucun achat n'a suivi
}

export interface AccountContribution {
  label: string; // « Autre compte » pour les codes non mappés
  amountCad: number;
  count: number;
}

/** Plancher de croissance : les dépôts nets comme explication MÉCANIQUE minimale
 *  de la variation totale du portefeuille. Calculé au moteur, jamais à la page. */
export interface GrowthFloor {
  startingValue: number;
  currentValue: number;
  totalChange: number; // current − starting
  netDeposits: number; // contributions (post-override) − retraits (post-override)
  residual: number;    // totalChange − netDeposits
  /** Q1 : 0 < dépôts ≤ variation ; Q2 : variation > 0 mais < dépôts ;
   *  Q3 : variation ≤ 0 malgré dépôts > 0 ; Q4 : dépôts nets ≤ 0. */
  quadrant: 1 | 2 | 3 | 4;
}

/** Libellé de compte via ACCOUNT_TYPE_MAP ; codes composés (« S1 ») normalisés
 *  sur la première lettre (décision assumée, commentée ici) ; null si non mappé —
 *  JAMAIS le code brut (une lettre « Z » sur un PDF client serait cryptique). */
export function accountLabel(code: string): string | null {
  const c = code.trim().toUpperCase();
  if (!c) return null;
  return ACCOUNT_TYPE_MAP[c] ?? ACCOUNT_TYPE_MAP[c[0]] ?? null;
}

export interface DeploymentSummary {
  period: ActivityPeriod;
  periodLabel: string;
  startDate: string;
  endDate: string;
  buyCount: number;
  sellCount: number;
  distinctSymbols: number;
  totalBuys: number;  // CAD
  totalSells: number; // CAD
  firstBuyDate: string | null; // ISO
  lastBuyDate: string | null;  // ISO
  contributions: number;      // total des cotisations (argent + titres)
  contributionCount: number;
  contributionsOverridden: boolean;
  /** Cotisations EN ARGENT (comptant) — jambes encaisse retenues. */
  contributionsCash: number;
  /** Cotisations EN TITRES (en nature) — apports portant un titre. */
  contributionsSecurities: number;
  /** Les apports en titres (= acquisitions), pour le détail. */
  contributedSecurities: ContributionSecurity[];
  /** Argent frais réellement DÉPOSÉ (type « Dépôt »), distinct des cotisations. */
  deposits: number;
  /** Encaisse ACTUELLE au compte (somme des lignes « Solde du compte » du
   *  portefeuille), injectée via opts.cashBalance ; null si non fournie. */
  cashOnHand: number | null;
  /** Nombre et total des acquisitions faites en nature (cotisation en titres). */
  inKindCount: number;
  inKindTotal: number;
  /** Transferts EN NATURE détectés et comptés une seule fois (jambes miroir écartées).
   *  > 0 → à signaler visiblement (garde-fou anti-double-compte). */
  mirrorsDropped: number;
  /** Date ISO du premier dépôt de la fenêtre (fait de dates, idée bonus). */
  firstContributionDate: string | null;
  /** Ancienneté moyenne des dépôts, pondérée par les montants, en mois (30,44 j). */
  avgDepositAgeMonths: number | null;
  lines: DeploymentLine[]; // triées par totalCostCad décroissant
  heldCount: number;
  partialCount: number;
  closedCount: number;
  unmatchedCount: number;
  unpriceableCount: number;
  costEvaluated: number;  // Σ totalCostCad des lignes 'held'
  valueEvaluated: number; // Σ currentValue des 'held'
  deltaAbs: number;
  deltaPct: number;       // 0 si costEvaluated = 0
  coveragePct: number;    // costEvaluated / totalBuys × 100
  usdCadRate?: number;
  monthlyBuys: { key: string; label: string; amount: number }[];
  reconciliation: DeploymentReconciliation;
  // ── Timeline « dépôt → ce qui a suivi » ──
  /** null si contributionsOverridden OU aucun dépôt détecté (un montant saisi
   *  n'a ni date ni compte — pas de faits de dates à montrer). */
  depositChapters: DepositChapter[] | null;
  /** Achats antérieurs au premier dépôt ; null EXACTEMENT quand depositChapters l'est. */
  preDepositBuys: { totalCad: number; buyCount: number; topSymbols: string[] } | null;
  /** Dépôts regroupés par LIBELLÉ de compte ; null si contributionsOverridden. */
  contributionsByAccount: AccountContribution[] | null;
  /** Retraits DÉTECTÉS dans la fenêtre (CAD). */
  withdrawals: number;
  medianDaysDepositToNextBuy: number | null;
  depositsWithoutFollowingBuy: number;
  /** true si ≥ 3 chapitres et intervalles réguliers (écart-type ≤ 5 jours) ; null si < 3. */
  depositCadenceRegular: boolean | null;
  /** null sans opts.portfolioValues. */
  growthFloor: GrowthFloor | null;
  /** Achats agrégés par JOUR (pour les marques de l'axe du temps — des dates
   *  réelles, jamais des approximations mensuelles). Trié par date. */
  buyDates: { date: string; totalCad: number }[];
  /** Ventes agrégées par JOUR (mêmes marques d'axe). Trié par date. */
  sellDates: { date: string; totalCad: number }[];
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Clé de rapprochement activité ↔ portefeuille : l'activité garde des symboles
 * bruts (« ENB », « AP.UN ») quand le portefeuille est normalisé (« ENB.TO »,
 * « AP-UN.TO »). Majuscules, sans suffixe de bourse, séparateurs unifiés.
 */
export function canonKey(symbol: string): string {
  let s = symbol.trim().toUpperCase();
  s = s.replace(/\.(TO|NE|V|CN|U)$/, '');
  s = s.replace(/\.UN$/, '-UN').replace(/\.PR\.([A-Z])$/, '-P$1').replace(/\.([AB])$/, '-$1');
  return s;
}

interface AggregatedPosition {
  quantity: number;
  marketValue: number;
  currentPrice: number | null;
  name?: string;
  assetType?: string;
}

/** Agrège les positions multi-comptes (CELI + REER du même titre) AVANT le join. */
function aggregatePositions(positions: DeploymentPosition[]): {
  byExact: Map<string, AggregatedPosition>;
  byCanon: Map<string, AggregatedPosition>;
  byBase: Map<string, AggregatedPosition>;
} {
  const byExact = new Map<string, AggregatedPosition>();
  const byCanon = new Map<string, AggregatedPosition>();
  const byBase = new Map<string, AggregatedPosition>();
  const fold = (map: Map<string, AggregatedPosition>, key: string, p: DeploymentPosition) => {
    if (!key) return;
    const cur = map.get(key) ?? { quantity: 0, marketValue: 0, currentPrice: null, name: p.name, assetType: p.assetType };
    cur.quantity += p.quantity;
    cur.marketValue += Math.abs(p.marketValue);
    if (cur.currentPrice == null && typeof p.currentPrice === 'number' && p.currentPrice > 0) {
      cur.currentPrice = p.currentPrice;
    }
    if (!cur.assetType && p.assetType) cur.assetType = p.assetType;
    map.set(key, cur);
  };
  for (const p of positions) {
    const exact = p.symbol.trim().toUpperCase();
    fold(byExact, exact, p);
    fold(byCanon, canonKey(p.symbol), p);
    fold(byBase, exact.split('.')[0], p);
  }
  return { byExact, byCanon, byBase };
}

export function buildDeploymentSummary(
  transactions: CroesusActivityTransaction[],
  period: ActivityPeriod,
  positions: DeploymentPosition[],
  opts: {
    usdCadRate?: number;
    endDate?: Date;
    contributionsOverride?: number;
    /** Miroir de overrides.withdrawals de buildPortfolioActivitySummary. */
    withdrawalsOverride?: number;
    /** ⚠ starting DOIT être la valeur au startDate de la MÊME période (le champ
     *  « Valeur au début de la période » de l'onglet Activité) — un starting
     *  d'une autre date fausserait le plancher en silence. */
    portfolioValues?: { starting: number; current: number };
    /** Encaisse actuelle = somme des lignes « Solde du compte » du portefeuille. */
    cashBalance?: number;
  } = {}
): DeploymentSummary | null {
  const { start, end } = getActivityWindow(period, opts.endDate ?? new Date());
  const usdCadRate = opts.usdCadRate;
  const toCad = (t: CroesusActivityTransaction, value: number): number =>
    usdCadRate && usdCadRate > 0 && t.currency.trim().toUpperCase() === 'USD'
      ? value * usdCadRate
      : value;

  const inWindow = transactions.filter(t => {
    const d = parseDate(t.transactionDate);
    return d != null && d >= start && d <= end;
  });

  // ── Réconciliation : chaque transaction de la fenêtre est comptée UNE fois ──
  const rec: DeploymentReconciliation = {
    windowTransactionCount: inWindow.length,
    incomeCount: 0,
    contributionCount: 0,
    depositCount: 0,
    withdrawalCount: 0,
    buyCount: 0,
    sellCount: 0,
    otherCount: 0,
    baseSymbolFallbackCount: 0,
  };

  interface Accum {
    symbol: string;
    name: string;
    buyCount: number;
    boughtQty: number;
    boughtQtyKnown: boolean; // false dès qu'un achat n'a pas de quantité
    totalCostCad: number;
    sellCount: number;
    soldQty: number;
    sellQtyUnknown: boolean; // une vente sans quantité rend le suivi invérifiable
    realizedSum: number;
    realizedSeen: boolean;
    firstBuy: string | null;
    lastBuy: string | null;
  }
  const bySymbol = new Map<string, Accum>();
  let withdrawalsDetected = 0;
  let deposits = 0; // type « Dépôt » (argent frais), distinct des cotisations
  const buyEvents: { date: string; symbol: string; name: string; amountCad: number }[] = [];
  const sellEvents: { date: string; amountCad: number }[] = [];
  let totalBuys = 0;
  let totalSells = 0;
  let firstBuyDate: string | null = null;
  let lastBuyDate: string | null = null;
  const monthly = new Map<string, number>();

  // Cotisations : partie double Croesus → analyseur partagé (jambes négatives,
  // split argent/titres, dédup des miroirs). Les jambes de cotisation sont donc
  // SORTIES de la boucle ci-dessous (sinon elles gonflaient cotisations ET retraits).
  const contrib = analyzeContributions(inWindow, toCad);
  const isCotis = (t: CroesusActivityTransaction) => t.type.toLowerCase().includes('cotisation');
  const isDepot = (t: CroesusActivityTransaction) =>
    t.type.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes('depot');

  for (const t of inWindow) {
    if (isCotis(t)) { rec.contributionCount += 1; continue; } // totaux via `contrib`
    if (isDepot(t)) { deposits += Math.abs(toCad(t, t.amount)); rec.depositCount += 1; continue; }
    if (t.category === 'income') { rec.incomeCount += 1; continue; }
    if (t.category === 'withdrawal') {
      rec.withdrawalCount += 1;
      withdrawalsDetected += Math.abs(toCad(t, t.amount));
      continue;
    }

    // achats / ventes / vraiment autres
    if (t.tradeKind === 'buy' || t.tradeKind === 'sell') {
      const key = t.symbol.trim().toUpperCase() || t.name.trim().toUpperCase() || 'INCONNU';
      const acc = bySymbol.get(key) ?? {
        symbol: t.symbol.trim().toUpperCase() || 'INCONNU',
        name: t.name || t.symbol || 'Inconnu',
        buyCount: 0, boughtQty: 0, boughtQtyKnown: true, totalCostCad: 0,
        sellCount: 0, soldQty: 0, sellQtyUnknown: false, realizedSum: 0, realizedSeen: false,
        firstBuy: null, lastBuy: null,
      };
      const amountCad = Math.abs(toCad(t, t.amount));
      if (t.tradeKind === 'buy') {
        rec.buyCount += 1;
        acc.buyCount += 1;
        acc.totalCostCad += amountCad;
        totalBuys += amountCad;
        if (t.quantity != null && Math.abs(t.quantity) > 0) acc.boughtQty += Math.abs(t.quantity);
        else acc.boughtQtyKnown = false;
        if (!acc.firstBuy || t.transactionDate < acc.firstBuy) acc.firstBuy = t.transactionDate;
        if (!acc.lastBuy || t.transactionDate > acc.lastBuy) acc.lastBuy = t.transactionDate;
        if (!firstBuyDate || t.transactionDate < firstBuyDate) firstBuyDate = t.transactionDate;
        if (!lastBuyDate || t.transactionDate > lastBuyDate) lastBuyDate = t.transactionDate;
        const d = parseDate(t.transactionDate);
        if (d) monthly.set(monthKey(d), (monthly.get(monthKey(d)) ?? 0) + amountCad);
        buyEvents.push({ date: t.transactionDate, symbol: acc.symbol, name: acc.name, amountCad });
      } else {
        rec.sellCount += 1;
        acc.sellCount += 1;
        totalSells += amountCad;
        sellEvents.push({ date: t.transactionDate, amountCad });
        if (t.quantity != null) acc.soldQty += Math.abs(t.quantity);
        else acc.sellQtyUnknown = true;
        if (t.realizedGainLoss != null) {
          acc.realizedSum += toCad(t, t.realizedGainLoss);
          acc.realizedSeen = true;
        }
      }
      bySymbol.set(key, acc);
    } else {
      rec.otherCount += 1;
    }
  }

  // Apports en TITRES (cotisation en nature) = acquisitions : le client a bien
  // acquis ces titres → ils rejoignent les achats, la timeline et le tableau.
  let inKindTotal = 0;
  let inKindCount = 0;
  for (const s of contrib.securityList) {
    const key = s.symbol || s.name.trim().toUpperCase() || 'INCONNU';
    const acc = bySymbol.get(key) ?? {
      symbol: s.symbol || 'INCONNU', name: s.name || s.symbol || 'Inconnu',
      buyCount: 0, boughtQty: 0, boughtQtyKnown: true, totalCostCad: 0,
      sellCount: 0, soldQty: 0, sellQtyUnknown: false, realizedSum: 0, realizedSeen: false,
      firstBuy: null, lastBuy: null,
    };
    rec.buyCount += 1;
    inKindCount += 1;
    inKindTotal += s.amountCad;
    acc.buyCount += 1;
    acc.totalCostCad += s.amountCad;
    if (s.quantity != null && s.quantity > 0) acc.boughtQty += s.quantity;
    else acc.boughtQtyKnown = false;
    if (!acc.firstBuy || s.date < acc.firstBuy) acc.firstBuy = s.date;
    if (!acc.lastBuy || s.date > acc.lastBuy) acc.lastBuy = s.date;
    if (!firstBuyDate || s.date < firstBuyDate) firstBuyDate = s.date;
    if (!lastBuyDate || s.date > lastBuyDate) lastBuyDate = s.date;
    totalBuys += s.amountCad;
    const d = parseDate(s.date);
    if (d) monthly.set(monthKey(d), (monthly.get(monthKey(d)) ?? 0) + s.amountCad);
    buyEvents.push({ date: s.date, symbol: acc.symbol, name: acc.name, amountCad: s.amountCad });
    bySymbol.set(key, acc);
  }

  if (rec.buyCount === 0) return null; // aucune acquisition : la page ne se rend pas

  // Événements datés de cotisation (pour la timeline).
  const depositEvents = contrib.events.map(e => ({
    date: e.date, amountCad: e.amountCad, accountLabel: e.accountLabel,
  }));

  // ── Jointure avec le portefeuille actuel (agrégé multi-comptes d'abord) ──
  const { byExact, byCanon, byBase } = aggregatePositions(positions);
  const lookup = (symbol: string): AggregatedPosition | null => {
    const exact = symbol.trim().toUpperCase();
    if (byExact.has(exact)) return byExact.get(exact)!;
    const canon = canonKey(symbol);
    if (byCanon.has(canon)) return byCanon.get(canon)!;
    const base = exact.split('.')[0];
    if (base && byBase.has(base)) {
      rec.baseSymbolFallbackCount += 1;
      return byBase.get(base)!;
    }
    return null;
  };

  const lines: DeploymentLine[] = [...bySymbol.values()]
    .filter(a => a.buyCount > 0) // les ventes sans achat n'ont pas de ligne
    .map(a => {
      const pos = lookup(a.symbol);
      const currentQty = pos ? pos.quantity : null;
      // Règle de prix : currentPrice (déjà en CAD document), sinon marketValue/qté,
      // sinon rien. On n'invente JAMAIS de taux historique aux dates d'achat.
      const currentUnitValue = pos
        ? (pos.currentPrice != null && pos.currentPrice > 0
            ? pos.currentPrice
            : pos.quantity > 0 ? pos.marketValue / pos.quantity : null)
        : null;

      let status: DeploymentLineStatus;
      if (!a.boughtQtyKnown || a.boughtQty <= 0) status = 'unpriceable';
      else if (currentQty == null) status = a.sellCount > 0 ? 'closed' : 'unmatched';
      // Position à zéro SANS vente dans la fenêtre : on ne peut pas affirmer
      // « revendu » (transfert sorti ? fenêtre trop courte ?) → non retrouvée.
      else if (currentQty === 0) status = a.sellCount > 0 ? 'closed' : 'unmatched';
      else if (currentQty < a.boughtQty) status = 'partial';
      else if (currentUnitValue == null) status = 'unpriceable';
      // Une vente à quantité inconnue rend « toutes les parts encore détenues »
      // invérifiable : on dégrade en 'partial' (— plutôt qu'un écart douteux).
      else if (a.sellQtyUnknown) status = 'partial';
      else status = 'held';

      const currentValue = status === 'held' ? a.boughtQty * (currentUnitValue as number) : null;
      const deltaAbs = currentValue != null ? currentValue - a.totalCostCad : null;
      const deltaPct = deltaAbs != null && a.totalCostCad > 0 ? (deltaAbs / a.totalCostCad) * 100 : null;

      // Obligation : via le type d'actif de la position, ou à défaut le nom qui
      // porte un coupon (« 5.5% ») et/ou une échéance. Sa « quantité » = nominal.
      const nomLigne = pos?.name || a.name;
      const isBond = pos?.assetType === 'FIXED_INCOME'
        || /\d[.,]?\d*\s*%/.test(nomLigne)
        || a.symbol.includes('.DB.');

      return {
        symbol: a.symbol,
        name: nomLigne,
        buyCount: a.buyCount,
        boughtQty: a.boughtQty,
        totalCostCad: a.totalCostCad,
        avgUnitCost: a.boughtQty > 0 ? a.totalCostCad / a.boughtQty : 0,
        weightPct: totalBuys > 0 ? (a.totalCostCad / totalBuys) * 100 : 0,
        sellCount: a.sellCount,
        soldQty: a.soldQty,
        currentQty,
        currentUnitValue,
        currentValue,
        deltaAbs,
        deltaPct,
        realizedFromCroesus: a.realizedSeen ? a.realizedSum : null,
        status,
        isBond,
      };
    })
    .sort((x, y) => y.totalCostCad - x.totalCostCad);

  const held = lines.filter(l => l.status === 'held');
  const costEvaluated = held.reduce((s, l) => s + l.totalCostCad, 0);
  const valueEvaluated = held.reduce((s, l) => s + (l.currentValue ?? 0), 0);
  const deltaAbs = valueEvaluated - costEvaluated;

  // Frise mensuelle des achats sur toute la fenêtre (mois vides inclus).
  const monthlyBuys = buildMonthBuckets(start, end).map((m: MonthlyPortfolioActivity) => ({
    key: m.key,
    label: m.label,
    amount: monthly.get(m.key) ?? 0,
  }));

  const periodLabel = period === 'year_to_date'
    ? `Depuis le 1er janvier ${end.getFullYear()}`
    : period === 'six_months' ? '6 derniers mois' : '12 derniers mois';

  const overridden = opts.contributionsOverride != null;

  // ── Timeline « dépôt → ce qui a suivi » : partition chronologique stricte ──
  // Faits de dates SEULEMENT : sous override (montant saisi, sans date ni compte)
  // ou sans dépôt détecté, les trois champs sont null.
  const joursEntre = (a: string, b: string): number => {
    const da = parseDate(a); const db = parseDate(b);
    return da && db ? Math.round((db.getTime() - da.getTime()) / 86_400_000) : 0;
  };
  let depositChapters: DepositChapter[] | null = null;
  let preDepositBuys: DeploymentSummary['preDepositBuys'] = null;
  let contributionsByAccount: AccountContribution[] | null = null;
  let medianDaysDepositToNextBuy: number | null = null;
  let depositsWithoutFollowingBuy = 0;
  let depositCadenceRegular: boolean | null = null;

  if (!overridden && contrib.count > 0) {
    // Fusion de TOUTES les cotisations d'un même jour en UN chapitre (attribuer les
    // achats entre deux du même jour serait arbitraire).
    const parJour = new Map<string, { amountCad: number; accounts: Map<string | null, number> }>();
    for (const dep of depositEvents) {
      const jour = parJour.get(dep.date) ?? { amountCad: 0, accounts: new Map() };
      jour.amountCad += dep.amountCad;
      jour.accounts.set(dep.accountLabel, (jour.accounts.get(dep.accountLabel) ?? 0) + dep.amountCad);
      parJour.set(dep.date, jour);
    }
    const jours = [...parJour.keys()].sort();

    // Chapitre k = achats de date ∈ [d_k, d_{k+1}) — même jour INCLUS (Croesus
    // n'a pas d'heure) ; comparaison ISO lexicographique.
    depositChapters = jours.map((jour, k) => {
      const suivant = jours[k + 1];
      const achats = buyEvents.filter(b => b.date >= jour && (suivant == null || b.date < suivant));
      const parTitre = new Map<string, ChapterBuy>();
      for (const b of achats) {
        const cur = parTitre.get(b.symbol) ?? { symbol: b.symbol, name: b.name, amountCad: 0, buyCount: 0 };
        cur.amountCad += b.amountCad;
        cur.buyCount += 1;
        parTitre.set(b.symbol, cur);
      }
      const buys = [...parTitre.values()].sort((x, y) => y.amountCad - x.amountCad);
      const premierAchat = achats.reduce<string | null>(
        (min, b) => (min == null || b.date < min ? b.date : min), null,
      );
      const info = parJour.get(jour)!;
      return {
        date: jour,
        amountCad: info.amountCad,
        accounts: [...info.accounts.entries()]
          .map(([label, amountCad]) => ({ label, amountCad }))
          .sort((x, y) => y.amountCad - x.amountCad),
        buys,
        totalFollowedCad: buys.reduce((s, b) => s + b.amountCad, 0),
        buyCount: achats.length,
        daysToFirstBuy: premierAchat != null ? joursEntre(jour, premierAchat) : null,
      };
    });

    const avantPremier = buyEvents.filter(b => b.date < jours[0]);
    const preTitres = new Map<string, number>();
    for (const b of avantPremier) preTitres.set(b.symbol, (preTitres.get(b.symbol) ?? 0) + b.amountCad);
    preDepositBuys = {
      totalCad: avantPremier.reduce((s, b) => s + b.amountCad, 0),
      buyCount: avantPremier.length,
      topSymbols: [...preTitres.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([s]) => s),
    };

    // Cotisations par LIBELLÉ de compte ; non mappés → « Autre compte ».
    const parCompte = new Map<string, AccountContribution>();
    for (const dep of depositEvents) {
      const label = dep.accountLabel ?? 'Autre compte';
      const cur = parCompte.get(label) ?? { label, amountCad: 0, count: 0 };
      cur.amountCad += dep.amountCad;
      cur.count += 1;
      parCompte.set(label, cur);
    }
    contributionsByAccount = [...parCompte.values()].sort((x, y) => y.amountCad - x.amountCad);

    const delais = depositChapters.map(c => c.daysToFirstBuy).filter((v): v is number => v != null).sort((a, b) => a - b);
    if (delais.length > 0) {
      const mid = Math.floor(delais.length / 2);
      medianDaysDepositToNextBuy = delais.length % 2 === 1 ? delais[mid] : (delais[mid - 1] + delais[mid]) / 2;
    }
    depositsWithoutFollowingBuy = depositChapters.filter(c => c.buys.length === 0).length;

    if (depositChapters.length >= 3) {
      const intervalles = depositChapters.slice(1).map((c, i) => joursEntre(depositChapters![i].date, c.date));
      const moy = intervalles.reduce((s, v) => s + v, 0) / intervalles.length;
      const variance = intervalles.reduce((s, v) => s + (v - moy) ** 2, 0) / intervalles.length;
      depositCadenceRegular = Math.sqrt(variance) <= 5;
    }
  }

  // Ancienneté moyenne des cotisations (fait de dates, jamais sous override).
  const firstContributionDate = contrib.events.length > 0
    ? contrib.events.reduce((min, e) => (e.date < min ? e.date : min), contrib.events[0].date)
    : null;
  const depositAgeWeighted = contrib.events.reduce((s, e) => {
    const d = parseDate(e.date);
    return d ? s + e.amountCad * Math.max(0, (end.getTime() - d.getTime()) / 86_400_000) : s;
  }, 0);

  // ── Plancher de croissance (toujours renvoyé quand portfolioValues est fourni,
  // Q4 inclus — c'est la PAGE qui décide de l'omission, frontière moteur/rendu) ──
  const contributionsRetenues = overridden ? (opts.contributionsOverride as number) : contrib.total;
  const retraitsRetenus = opts.withdrawalsOverride ?? withdrawalsDetected;
  let growthFloor: GrowthFloor | null = null;
  if (opts.portfolioValues) {
    const { starting, current } = opts.portfolioValues;
    const totalChange = current - starting;
    const netDeposits = contributionsRetenues - retraitsRetenus;
    const quadrant: GrowthFloor['quadrant'] =
      netDeposits <= 0 ? 4 : totalChange <= 0 ? 3 : netDeposits > totalChange ? 2 : 1;
    growthFloor = {
      startingValue: starting,
      currentValue: current,
      totalChange,
      netDeposits,
      residual: totalChange - netDeposits,
      quadrant,
    };
  }

  return {
    period,
    periodLabel,
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
    buyCount: rec.buyCount,
    sellCount: rec.sellCount,
    distinctSymbols: lines.length,
    totalBuys,
    totalSells,
    firstBuyDate,
    lastBuyDate,
    contributions: contributionsRetenues,
    contributionCount: contrib.count,
    contributionsOverridden: overridden,
    // Cotisations scindées argent vs titres (partie double Croesus) + apports en nature.
    contributionsCash: overridden ? 0 : contrib.cash,
    contributionsSecurities: overridden ? 0 : contrib.securities,
    contributedSecurities: contrib.securityList,
    // Argent frais (type « Dépôt ») et encaisse actuelle (portefeuille), distincts.
    deposits,
    cashOnHand: opts.cashBalance ?? null,
    inKindCount,
    inKindTotal,
    mirrorsDropped: overridden ? 0 : contrib.mirrorsDropped,
    firstContributionDate,
    // L'ancienneté moyenne n'est un fait que sur les dépôts DÉTECTÉS (pas l'override).
    avgDepositAgeMonths: contrib.count > 0 && contrib.total > 0 && !overridden
      ? depositAgeWeighted / contrib.total / 30.44
      : null,
    lines,
    heldCount: held.length,
    partialCount: lines.filter(l => l.status === 'partial').length,
    closedCount: lines.filter(l => l.status === 'closed').length,
    unmatchedCount: lines.filter(l => l.status === 'unmatched').length,
    unpriceableCount: lines.filter(l => l.status === 'unpriceable').length,
    costEvaluated,
    valueEvaluated,
    deltaAbs,
    deltaPct: costEvaluated > 0 ? (deltaAbs / costEvaluated) * 100 : 0,
    coveragePct: totalBuys > 0 ? (costEvaluated / totalBuys) * 100 : 0,
    usdCadRate,
    monthlyBuys,
    reconciliation: rec,
    depositChapters,
    preDepositBuys,
    contributionsByAccount,
    buyDates: [...buyEvents.reduce((m, b) => m.set(b.date, (m.get(b.date) ?? 0) + b.amountCad), new Map<string, number>()).entries()]
      .map(([date, totalCad]) => ({ date, totalCad }))
      .sort((x, y) => x.date.localeCompare(y.date)),
    sellDates: [...sellEvents.reduce((m, s) => m.set(s.date, (m.get(s.date) ?? 0) + s.amountCad), new Map<string, number>()).entries()]
      .map(([date, totalCad]) => ({ date, totalCad }))
      .sort((x, y) => x.date.localeCompare(y.date)),
    withdrawals: withdrawalsDetected,
    medianDaysDepositToNextBuy,
    depositsWithoutFollowingBuy,
    depositCadenceRegular,
    growthFloor,
  };
}
