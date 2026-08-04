/**
 * « Rapport vivant » — construction du SCÉNARIO du film à partir du payload du
 * rapport de cours cibles. Fonction PURE : aucun accès réseau, disque ou base.
 * Tous les types du payload sont importés en `import type` (effacés à la
 * compilation) pour que ce module reste testable sans charger les polices ni
 * les images du gabarit PDF.
 *
 * Rôle : décider CE QU'ON RACONTE et DANS QUEL ORDRE. Le rendu (HTML/CSS/JS)
 * ne fait ensuite que de la mise en page — il n'invente aucun chiffre.
 *
 * Règle de dégradation (PLAN-RAPPORT-VIVANT.md §2.3) : chaque scène déclare une
 * condition de présence. Donnée absente → la scène DISPARAÎT proprement, sans
 * trou visuel, sans « non disponible », sans valeur inventée.
 */
import type { PriceTargetReportData, PriceTargetHolding } from '../pdf/price-targets-template';
import { computeScenarios, type ScenarioRange } from '../pdf/scenarios';

// ─── Entrée ──────────────────────────────────────────────────────────────────

/**
 * Une prédiction passée du Journal des cibles, telle que renvoyée par
 * `GET /api/price-target-snapshots?nameIdx=…`. Sous-ensemble des colonnes qui
 * nous intéressent pour la scène Transparence.
 *
 * ⚠️ `hit` = la cible a été TOUCHÉE au moins une fois pendant l'horizon (sommet
 * intrajournalier), PAS « le prix a fini au-dessus ». Une prédiction peut donc
 * être `hit: true` avec un `actual_gain_pct` négatif — c'est ce cas qu'il faut
 * étiqueter honnêtement, jamais maquiller.
 */
export interface TransparencySnapshot {
  symbol: string;
  name: string;
  entry_type?: 'price_target' | 'model_portfolio' | null;
  name_idx?: string | null;
  current_price: number | null;   // prix au moment de la prédiction
  target_price: number | null;
  expected_gain_pct: number | null;
  horizon_months: number;
  predicted_at: string;           // 'YYYY-MM-DD' (heure de Toronto)
  resolved_at: string | null;     // non nul = horizon écoulé et figé par le cron
  actual_price: number | null;    // dernière clôture à l'échéance
  actual_gain_pct: number | null; // gain réel depuis current_price
  hit: boolean | null;
  peak_price: number | null;
  peak_at: string | null;
  trough_price: number | null;
}

export interface FilmInput {
  /** Le payload du rapport, enrichi côté serveur (logos, secteurs, revenus). */
  report: PriceTargetReportData;
  /** Prédictions passées du client — déjà chargées côté navigateur (coffre). */
  priorSnapshots?: TransparencySnapshot[];
  advisor?: string;
}

// ─── Sortie ──────────────────────────────────────────────────────────────────

export type SceneId =
  | 'ouverture' | 'wrapped' | 'histoire' | 'parcours' | 'repartition'
  | 'podium' | 'revenu' | 'titres' | 'transparence' | 'horizon'
  | 'simulateur' | 'signature';

export interface FilmScene {
  id: SceneId;
  /** Titre de chapitre (barre de progression, mode Rencontre). */
  title: string;
  /** Durée en lecture automatique, en ms. 0 = scène interactive, hors chrono. */
  autoMs: number;
}

export interface WrappedCard {
  id: string;
  /** Petite étiquette au-dessus du chiffre. */
  kicker: string;
  /** LE chiffre ou mot qui occupe l'écran. */
  value: string;
  /** La phrase qui donne le sens. */
  line: string;
}

export interface FilmMeta {
  client: string;
  advisor: string;
  generatedAt: string;
  /** « mardi 29 juillet 2026 » */
  generatedLabel: string;
  year: number;
  currency: 'CAD';
}

export interface FilmHero {
  portfolioValue: number;
  /** Valeur projetée 12 mois (consensus). null si aucune cible. */
  projectedValue: number | null;
  projectedGain: number | null;
  projectedGainPct: number | null;
  /** Éventail prudent / consensus / optimiste (gains). null si aucune cible. */
  scenarios: ScenarioRange | null;
  /** Vrai si les bornes basse et haute sont réellement distinctes. */
  hasRange: boolean;
  holdingsCount: number;
  targetsCount: number;
}

/**
 * La contribution d'UN titre à la projection 12 mois. Alimente deux features :
 *  - le curseur « et si » (interpolation par titre entre cible basse et haute) ;
 *  - la cascade « Pourquoi ce chiffre ? » (qui contribue combien).
 * Invariant : Σ gainMid + incomeForScenarios === hero.scenarios.mid.
 */
export interface HoldingContribution {
  symbol: string;
  name: string;
  sector?: string;
  qty: number;
  price: number;   // prix actuel, CAD
  low: number;     // cible basse, CAD
  mid: number;     // cible consensus, CAD
  high: number;    // cible haute, CAD
  gainLow: number;  // qty × (low − price)
  gainMid: number;
  gainHigh: number;
  analystCount?: number;
}

/** Une prédiction passée, mise en forme pour l'affichage honnête (réussite ET raté). */
export interface TransparencyRow {
  symbol: string;
  name: string;
  predictedAt: string;
  fromPrice: number;   // prix au moment de la prédiction
  target: number;      // cible visée
  peak: number | null; // sommet atteint pendant l'horizon
  actual: number | null; // prix à l'échéance
  actualGainPct: number | null;
  /** ⚠️ « touchée pendant l'horizon », PAS « a fini au-dessus ». */
  hit: boolean;
}

export interface Transparency {
  total: number;
  hits: number;
  hitRatePct: number;
  /** Gain réel moyen à l'échéance (peut être négatif — on le montre quand même). */
  avgRealizedPct: number | null;
  rows: TransparencyRow[];
}

/** Un mois de la trajectoire projetée (M0 = aujourd'hui, M12 = dans un an). */
export interface ProjectionPoint {
  month: number;
  /** « Aujourd'hui », puis « Août », « Sept. »… */
  label: string;
  /** Revenus encaissés cumulés depuis aujourd'hui. */
  incomeCum: number;
  /** Plancher : la valeur si les PRIX ne bougeaient pas du tout. */
  floor: number;
  low: number;
  mid: number;
  high: number;
}

/**
 * La trajectoire 12 mois : un cône qui part d'un point (aujourd'hui) et s'évase.
 *
 * ⚠️ PIÈGE MAJEUR : `hero.scenarios.low/mid/high` INCLUENT DÉJÀ le revenu annuel
 * (`computeScenarios` l'ajoute aux trois bornes). Empiler naïvement « revenus +
 * scénario » compterait donc les revenus DEUX FOIS, et le graphique contredirait
 * le montant affiché juste au-dessus. Le capital pur s'obtient par soustraction.
 */
export interface ProjectionSeries {
  points: ProjectionPoint[];
  startValue: number;
  /** Revenu annuel total (dividendes + coupons) réparti sur les 12 mois. */
  incomeTotal: number;
  /** Gain en CAPITAL seul (hors revenus) à chaque borne. */
  capital: { low: number; mid: number; high: number };
  /** Vrai si la cadence mensuelle réelle a été utilisée (sinon répartition égale). */
  realCadence: boolean;
}

export interface FilmData {
  meta: FilmMeta;
  hero: FilmHero;
  /** Scènes retenues, DANS L'ORDRE, conditions de présence déjà appliquées. */
  scenes: FilmScene[];
  /** Cartes de la rétro « Wrapped » (≤ 6). Vide = scène absente. */
  wrapped: WrappedCard[];
  /** Durée totale de la lecture automatique, en secondes (scènes auto seulement). */
  autoDurationSec: number;
  /** Contributions par titre, triées par apport consensus décroissant. */
  contributions: HoldingContribution[];
  /** Revenu annuel ajouté identiquement aux trois bornes de l'éventail. */
  incomeForScenarios: number;
  /** Bilan des prédictions échues du client ; null si moins de 3 (échantillon trop mince). */
  transparency: Transparency | null;
  /** Nombre total d'avis d'analystes derrière les cibles (0 si inconnu). */
  analystTotal: number;
  /** La trajectoire 12 mois ; null si aucune cible (donc aucun cône à tracer). */
  projection: ProjectionSeries | null;
  /** Revenu déjà VERSÉ cette année, par catégorie. Null = aucune donnée de
   *  transactions, on ne peut donc rien affirmer. */
  encaisse: RevenuEncaisse | null;
}

/**
 * Ce que le portefeuille a RÉELLEMENT versé depuis le 1er janvier, et ce qu'il
 * reste à venir. Rien de projeté ici : les montants « versé » viennent des
 * transactions réelles du compte.
 */
export interface RevenuEncaisse {
  dividendesVerses: number;
  dividendesAVenir: number;
  couponsVerses: number;
  couponsAVenir: number;
  /** Part de l'année déjà encaissée, 0 à 100. */
  avancement: number;
}

// ─── Formatage (fr-CA, aligné sur le PDF) ────────────────────────────────────

const NBSP = ' ';
export const fmtMoney = (n: number): string =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);
export const fmtPct = (n: number): string =>
  `${n >= 0 ? '+' : ''}${n.toLocaleString('fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${NBSP}%`;

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
/** Libellés courts des mois utilisés par year-activity (`MonthlyPortfolioActivity.label`). */
const MONTH_BY_SHORT: Record<string, string> = {
  JAN: 'Janvier', FÉV: 'Février', MAR: 'Mars', AVR: 'Avril', MAI: 'Mai', JUN: 'Juin',
  JUL: 'Juillet', AOÛ: 'Août', SEP: 'Septembre', OCT: 'Octobre', NOV: 'Novembre', DÉC: 'Décembre',
};

function frLongDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Les titres « actions » (ceux qui portent une cible d'analyste). */
const isEquityLike = (h: PriceTargetHolding): boolean =>
  !['CASH', 'FIXED_INCOME', 'OTHER'].includes(h.assetType);

// ─── Rétro « Wrapped » ───────────────────────────────────────────────────────

/**
 * Les cartes punch du début. Chacune n'apparaît que si son chiffre EXISTE
 * vraiment ; on garde les 6 premières calculables, dans un ordre fixe (le même
 * client doit revoir le même film).
 */
export function buildWrappedCards(input: FilmInput): WrappedCard[] {
  const { report } = input;
  const ya = report.yearActivity;
  const dep = report.deployment;
  const cards: WrappedCard[] = [];

  // 1. La constance des dépôts
  const depositCount = dep?.contributionCount ?? 0;
  if (depositCount >= 2) {
    const regular = dep?.depositCadenceRegular === true;
    cards.push({
      id: 'constance',
      kicker: 'Votre discipline',
      value: String(depositCount),
      line: regular
        ? `${depositCount} dépôts, comme une horloge. Pas un de manqué.`
        : `${depositCount} fois cette année, vous avez mis de l’argent au travail.`,
    });
  }

  // 2. L'argent mis au travail
  const invested = (dep?.deposits ?? 0) + (dep?.contributions ?? 0);
  const netContrib = ya?.netContributions ?? 0;
  const putToWork = invested > 0 ? invested : netContrib;
  if (putToWork > 0) {
    cards.push({
      id: 'investi',
      kicker: 'Mis au travail',
      value: fmtMoney(putToWork),
      line: 'C’est ce que vous avez confié aux marchés cette année.',
    });
  }

  // 3. Le champion
  const withGain = report.holdings.filter(h => isEquityLike(h) && h.targetPrice && typeof h.gainPct === 'number');
  if (withGain.length > 0) {
    const champ = withGain.reduce((best, h) => ((h.gainPct ?? 0) > (best.gainPct ?? 0) ? h : best), withGain[0]);
    if ((champ.gainPct ?? 0) > 0) {
      cards.push({
        id: 'champion',
        kicker: 'Votre champion',
        value: champ.symbol,
        line: `${champ.name} — potentiel de ${fmtPct(champ.gainPct ?? 0)} selon les analystes.`,
      });
    }
  }

  // 4. Le meilleur mois de revenu
  const months = (ya?.currentYearMonthlyIncome ?? []).filter(m => m.income > 0);
  if (months.length >= 3) {
    const best = months.reduce((b, m) => (m.income > b.income ? m : b), months[0]);
    cards.push({
      id: 'meilleur-mois',
      kicker: 'Votre meilleur mois',
      value: MONTH_BY_SHORT[best.label] ?? best.label,
      line: `${fmtMoney(best.income)} encaissés — votre sommet de l’année.`,
    });
  }

  // 5. Le revenu encaissé = un 13e chèque de paie
  const income = ya?.income ?? 0;
  if (income > 0) {
    cards.push({
      id: 'revenu',
      kicker: 'Vos titres vous ont payé',
      value: fmtMoney(income),
      line: 'Sans rien vendre. Un treizième chèque de paie.',
    });
  }

  // 6. La croissance qui ne vient pas des dépôts
  const residual = dep?.growthFloor?.residual ?? 0;
  if (residual > 0) {
    cards.push({
      id: 'croissance',
      kicker: 'Votre argent a travaillé',
      value: fmtMoney(residual),
      line: 'Cette part ne vient pas de vos dépôts — c’est de la croissance.',
    });
  }

  // 7. La diversité (repli si les autres manquent)
  const equityCount = report.holdings.filter(isEquityLike).length;
  const sectors = new Set(report.holdings.map(h => h.sector).filter(Boolean));
  if (equityCount >= 3) {
    cards.push({
      id: 'diversite',
      kicker: 'Votre diversification',
      value: String(equityCount),
      line: sectors.size >= 2
        ? `${equityCount} titres répartis dans ${sectors.size} secteurs.`
        : `${equityCount} titres différents dans votre portefeuille.`,
    });
  }

  return cards.slice(0, 6);
}

// ─── Transparence ────────────────────────────────────────────────────────────

/**
 * Prédictions du client réellement NOTABLES : échues (résolues par le cron),
 * hors propositions commerciales, hors lignes héritées sans index de coffre.
 */
export function resolvedPredictions(snapshots: TransparencySnapshot[] | undefined): TransparencySnapshot[] {
  return (snapshots ?? []).filter(s =>
    s.entry_type !== 'model_portfolio'
    && !!s.name_idx
    && !!s.resolved_at
    && s.hit != null
    && (s.target_price ?? 0) > 0
  );
}

// ─── Contributions par titre ──────────────────────────────────────────────────

/**
 * Décompose la projection : ce que CHAQUE titre apporte, aux trois bornes.
 * Mêmes règles d'exclusion que `computeScenarios` (liquidités / revenu fixe /
 * autres n'ont pas de cible d'analyste) pour que les totaux se referment.
 */
export function buildContributions(holdings: PriceTargetHolding[]): HoldingContribution[] {
  const rows: HoldingContribution[] = [];
  for (const h of holdings) {
    if (!isEquityLike(h)) continue;
    if (!h.targetPrice) continue;
    const price = h.currentPrice || h.marketPrice;
    if (!(price > 0)) continue;
    const mid = h.targetPrice;
    const lo = h.targetLow && h.targetLow > 0 ? h.targetLow : mid;
    const hi = h.targetHigh && h.targetHigh > 0 ? h.targetHigh : mid;
    const low = Math.min(lo, mid, hi);
    const high = Math.max(lo, mid, hi);
    rows.push({
      symbol: h.symbol,
      name: h.name,
      sector: h.sector,
      qty: h.quantity,
      price,
      low, mid, high,
      gainLow: h.quantity * (low - price),
      gainMid: h.quantity * (mid - price),
      gainHigh: h.quantity * (high - price),
      analystCount: h.analystCount,
    });
  }
  return rows.sort((a, b) => b.gainMid - a.gainMid);
}

// ─── La trajectoire 12 mois ───────────────────────────────────────────────────

/** Mois courts pour l'axe du graphique. */
const MOIS_COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/**
 * Construit les 13 points (aujourd'hui → 12 mois) des quatre trajectoires.
 *
 * @param startValue      valeur du portefeuille aujourd'hui
 * @param scenarios       bornes du consensus, REVENU ANNUEL INCLUS (voir §14.1 du plan)
 * @param incomeTotal     ce même revenu annuel, à retrancher pour isoler le capital
 * @param monthlyIncome   revenu par mois civil (janv→déc) ; sert à la CADENCE réelle
 * @param nowMonth        mois civil d'aujourd'hui (0 = janvier)
 */
export function buildProjectionSeries(
  startValue: number,
  scenarios: ScenarioRange,
  incomeTotal: number,
  monthlyIncome: number[] | undefined,
  nowMonth: number,
): ProjectionSeries {
  // Capital PUR : on retire le revenu déjà compris dans chaque borne.
  const capital = {
    low: scenarios.low - incomeTotal,
    mid: scenarios.mid - incomeTotal,
    high: scenarios.high - incomeTotal,
  };

  // Cadence réelle des versements, mise à l'échelle sur le revenu annuel
  // AUTORITAIRE : la forme des mois vient du calendrier, le total vient du
  // sommaire. Sans cette mise à l'échelle, le point à 12 mois ne retomberait pas
  // exactement sur le montant projeté affiché au-dessus.
  const cal = Array.isArray(monthlyIncome) && monthlyIncome.length === 12
    ? monthlyIncome.map(v => (Number.isFinite(v) && v > 0 ? v : 0))
    : null;
  const calTotal = cal ? cal.reduce((s, v) => s + v, 0) : 0;
  const realCadence = !!cal && calTotal > 0 && incomeTotal > 0;
  const scale = realCadence ? incomeTotal / calTotal : 0;

  const points: ProjectionPoint[] = [];
  let incomeCum = 0;
  for (let t = 0; t <= 12; t++) {
    if (t > 0) {
      incomeCum += realCadence
        ? (cal as number[])[(nowMonth + t) % 12] * scale
        : incomeTotal / 12;
    }
    // Le 12e point retombe au cent près sur le total (corrige les arrondis).
    if (t === 12) incomeCum = incomeTotal;

    const frac = t / 12;
    const floor = startValue + incomeCum;
    points.push({
      month: t,
      label: t === 0 ? 'Aujourd’hui' : MOIS_COURT[(nowMonth + t) % 12],
      incomeCum,
      floor,
      low: floor + capital.low * frac,
      mid: floor + capital.mid * frac,
      high: floor + capital.high * frac,
    });
  }

  return { points, startValue, incomeTotal, capital, realCadence };
}

// ─── Transparence ─────────────────────────────────────────────────────────────

/**
 * Bilan des prédictions ÉCHUES du client. null sous 3 prédictions : un taux de
 * réussite sur 1 ou 2 cas ne veut rien dire et l'afficher serait malhonnête.
 */
export function buildTransparency(snapshots: TransparencySnapshot[] | undefined): Transparency | null {
  const resolved = resolvedPredictions(snapshots);
  if (resolved.length < 3) return null;

  const rows: TransparencyRow[] = resolved
    .slice()
    .sort((a, b) => (b.predicted_at || '').localeCompare(a.predicted_at || ''))
    .map(s => ({
      symbol: s.symbol,
      name: s.name,
      predictedAt: s.predicted_at,
      fromPrice: s.current_price ?? 0,
      target: s.target_price ?? 0,
      peak: s.peak_price,
      actual: s.actual_price,
      actualGainPct: s.actual_gain_pct,
      hit: s.hit === true,
    }));

  const hits = rows.filter(r => r.hit).length;
  const withGain = rows.filter(r => typeof r.actualGainPct === 'number');
  const avgRealizedPct = withGain.length > 0
    ? withGain.reduce((sum, r) => sum + (r.actualGainPct as number), 0) / withGain.length
    : null;

  return {
    total: rows.length,
    hits,
    hitRatePct: (hits / rows.length) * 100,
    avgRealizedPct,
    rows,
  };
}

// ─── Le scénario ─────────────────────────────────────────────────────────────

/** Durées de lecture automatique (ms). 0 = scène interactive, hors chrono. */
const SCENE_SPECS: { id: SceneId; title: string; autoMs: number }[] = [
  { id: 'ouverture',   title: 'Ouverture',            autoMs: 8000 },
  { id: 'wrapped',     title: 'Votre année en bref',  autoMs: 0 /* calculé : 4 s/carte */ },
  { id: 'histoire',    title: 'Votre histoire',       autoMs: 14000 },
  { id: 'parcours',    title: 'Le parcours',          autoMs: 10000 },
  { id: 'repartition', title: 'Votre répartition',    autoMs: 10000 },
  { id: 'podium',      title: 'Le podium',            autoMs: 8000 },
  { id: 'revenu',      title: 'Votre revenu',         autoMs: 8000 },
  { id: 'titres',      title: 'Vos titres',           autoMs: 0 },
  { id: 'transparence', title: 'La transparence',     autoMs: 12000 },
  { id: 'horizon',     title: 'Où on s’en va',        autoMs: 10000 },
  { id: 'simulateur',  title: 'Le simulateur',        autoMs: 0 },
  { id: 'signature',   title: 'Signature',            autoMs: 6000 },
];

/**
 * Le revenu DÉJÀ VERSÉ depuis le 1er janvier, et ce qu'il reste à venir.
 *
 * ⚠️ Cette fonction reproduit EXACTEMENT le calcul du PDF (IncomeDashboard,
 * price-targets-template.tsx) : mêmes bornes à zéro, même règle des trois cas
 * autour du mois courant, même appariement par clé « AAAA-MM ». Les deux
 * documents sont remis au même client : ils ne peuvent pas afficher deux
 * chiffres différents pour la même question.
 *
 * Avant, le HTML écrivait « Encaissé 0 $ » EN DUR, avec sa barre à 100 %. À
 * partir de février, il contredisait le PDF sur un montant d'argent reçu.
 *
 * Les montants « versé » viennent des TRANSACTIONS RÉELLES du compte
 * (currentYearMonthlyIncome), jamais d'une projection et jamais d'une saisie :
 * si les transactions manquent, on retourne null et l'affichage se tait.
 */
export function buildRevenuEncaisse(
  calendrier: { dividends: number; coupons: number }[],
  activite: {
    currentYear?: number;
    currentYearMonthlyIncome?: { key: string; dividends: number; fixedIncome: number }[];
  } | null | undefined,
  aujourdhui: Date,
): RevenuEncaisse | null {
  const reels = activite?.currentYearMonthlyIncome;
  if (!activite || !reels || reels.length === 0 || calendrier.length !== 12) return null;

  const annee = activite.currentYear ?? aujourdhui.getFullYear();
  // Une année révolue est entièrement encaissée : le mois courant est décembre.
  const moisCourant = aujourdhui.getFullYear() === annee ? aujourdhui.getMonth() : 11;
  const parMois = new Map(
    reels.filter((m) => m.key.startsWith(String(annee) + '-')).map((m) => [m.key, m]),
  );

  let dividendesVerses = 0, dividendesAVenir = 0, couponsVerses = 0, couponsAVenir = 0;
  calendrier.forEach((mois, i) => {
    const cle = String(annee) + '-' + String(i + 1).padStart(2, '0');
    const reel = parMois.get(cle);
    const versD = Math.max(0, reel?.dividends ?? 0);
    const versC = Math.max(0, reel?.fixedIncome ?? 0);
    const prevuD = Math.max(0, mois.dividends);
    const prevuC = Math.max(0, mois.coupons);
    dividendesVerses += versD;
    couponsVerses += versC;
    // Un mois passé n'a plus rien « à venir » ; le mois courant n'a que le solde.
    dividendesAVenir += i < moisCourant ? 0 : i === moisCourant ? Math.max(prevuD - versD, 0) : prevuD;
    couponsAVenir += i < moisCourant ? 0 : i === moisCourant ? Math.max(prevuC - versC, 0) : prevuC;
  });

  const verse = dividendesVerses + couponsVerses;
  const attendu = verse + dividendesAVenir + couponsAVenir;
  return {
    dividendesVerses,
    dividendesAVenir,
    couponsVerses,
    couponsAVenir,
    avancement: attendu > 0 ? Math.min((verse / attendu) * 100, 100) : 0,
  };
}

export function buildFilmData(input: FilmInput): FilmData {
  const { report } = input;
  const s = report.summary;
  const ya = report.yearActivity;
  const dep = report.deployment;

  // ── Héros : valeur d'aujourd'hui → projection 12 mois ──
  const portfolioValue = s.totalMarketValue;
  const incomeForScenarios = (s.equityDividends ?? 0) + (s.fixedIncomeAnnualIncome ?? 0);
  const targetsCount = report.holdings.filter(h => isEquityLike(h) && (h.targetPrice ?? 0) > 0).length;
  const scenarios = targetsCount > 0 ? computeScenarios(report.holdings, incomeForScenarios) : null;
  const projectedValue = scenarios ? portfolioValue + scenarios.mid : null;
  const projectedGain = scenarios ? scenarios.mid : null;
  const projectedGainPct = scenarios && portfolioValue > 0 ? (scenarios.mid / portfolioValue) * 100 : null;
  const hasRange = !!scenarios
    && Math.abs(scenarios.high - scenarios.low) > Math.max(1, portfolioValue * 0.002);

  const hero: FilmHero = {
    portfolioValue,
    projectedValue,
    projectedGain,
    projectedGainPct,
    scenarios,
    hasRange,
    holdingsCount: report.holdings.length,
    targetsCount,
  };

  // Trajectoire 12 mois : la cadence vient du calendrier des revenus (déjà
  // enrichi côté serveur), le mois de départ de la date du document.
  const monthlyIncome = report.incomeCalendar && report.incomeCalendar.length === 12
    ? report.incomeCalendar.map(m => (m.dividends || 0) + (m.coupons || 0))
    : undefined;
  const nowMonthIdx = (() => {
    const d = new Date(report.generatedAt);
    return isNaN(d.getTime()) ? 0 : d.getMonth();
  })();
  const projection = scenarios
    ? buildProjectionSeries(portfolioValue, scenarios, incomeForScenarios, monthlyIncome, nowMonthIdx)
    : null;

  const wrapped = buildWrappedCards(input);
  const transparency = buildTransparency(input.priorSnapshots);
  const contributions = buildContributions(report.holdings);
  const analystTotal = contributions.reduce((sum, c) => sum + (c.analystCount ?? 0), 0);
  const withGain = report.holdings.filter(h => isEquityLike(h) && (h.targetPrice ?? 0) > 0 && typeof h.gainPct === 'number');
  const incomeTotal = (ya?.income ?? 0) + (s.equityDividends ?? 0) + (s.fixedIncomeAnnualIncome ?? 0);

  // ── Conditions de présence (§2.3) ──
  const present: Record<SceneId, boolean> = {
    ouverture: true,
    wrapped: wrapped.length >= 3,
    histoire: !!ya,
    parcours: !!dep && dep.buyCount > 0,
    repartition: report.holdings.length >= 1,
    podium: withGain.length >= 3,
    revenu: incomeTotal > 0,
    titres: report.holdings.length >= 1,
    // Un taux de réussite sur 2 cas ne veut rien dire : on ne l'affiche pas.
    transparence: transparency != null,
    horizon: targetsCount >= 1,
    simulateur: true,
    signature: true,
  };

  const scenes: FilmScene[] = SCENE_SPECS
    .filter(spec => present[spec.id])
    .map(spec => spec.id === 'wrapped'
      ? { ...spec, autoMs: wrapped.length * 4000 }
      : spec);

  const autoDurationSec = Math.round(scenes.reduce((sum, sc) => sum + sc.autoMs, 0) / 1000);

  const generatedAt = report.generatedAt || new Date(0).toISOString();
  const parsedYear = new Date(generatedAt).getFullYear();

  return {
    meta: {
      client: (report.clientName || '').trim(),
      advisor: input.advisor || 'Nicolas Perron',
      generatedAt,
      generatedLabel: frLongDate(generatedAt),
      year: ya?.currentYear ?? (Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear()),
      currency: 'CAD',
    },
    hero,
    scenes,
    wrapped,
    autoDurationSec,
    contributions,
    incomeForScenarios,
    transparency,
    analystTotal,
    projection,
    encaisse: buildRevenuEncaisse(
      report.incomeCalendar ?? [],
      ya,
      new Date(generatedAt),
    ),
  };
}

/** Exposé pour les tests et le rendu : le nombre de titres « actions ». */
export function countEquityLike(holdings: PriceTargetHolding[]): number {
  return holdings.filter(isEquityLike).length;
}
