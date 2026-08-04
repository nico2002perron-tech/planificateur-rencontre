/**
 * Les sections du « Rapport vivant » qui vont AU-DELÀ de la couverture.
 *
 * Module PUR : aucune entrée-sortie, aucune date implicite, aucun rendu. Tout ce
 * qui se calcule ici se teste ici. Les modules de rendu ne font que mettre en
 * forme ce que ces fonctions retournent.
 *
 * Tout part de ce que Croesus donne DÉJÀ, sans une seule saisie :
 *   · le relevé de positions  — type de compte, quantité, PRU, valeur comptable,
 *     valeur de marché, taux de coupon, échéance, intérêts courus, durée modifiée,
 *     revenu annuel ;
 *   · rien d'autre.
 *
 * Conventions reprises de l'existant, à ne pas réinventer :
 *   · les coupons sont SEMESTRIELS, calés sur le mois d'échéance et ce mois moins
 *     six (même règle que `fetch-income-calendar.ts`, qui alimente déjà le
 *     calendrier de la couverture) ;
 *   · pour une obligation, la « quantité » de Croesus EST la valeur nominale,
 *     c'est-à-dire le capital remboursé à l'échéance ;
 *   · le « revenu annuel » de Croesus est pris tel quel plutôt que recalculé à
 *     partir du taux : c'est lui qui fait foi sur le relevé du client.
 */
import type { PriceTargetHolding } from '../pdf/price-targets-template';

// ═══════════════════════════════════════════════════════════════════════════
// 1 · VOS COMPTES — la lecture fiscale du même argent
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Comment l'impôt traite ce compte. C'est la seule chose qui distingue vraiment
 * un dollar de gain d'un autre, et aucun relevé ne le dit au client.
 */
export type Fiscalite = 'abri' | 'reporte' | 'imposable' | 'inconnu';

export interface CompteLigne {
  label: string;
  /** Codes Croesus regroupés sous ce libellé (A, E, W, S, T, Y, P, N, F). */
  codes: string[];
  valeur: number;
  cout: number;
  /** valeur de marché moins valeur comptable — le gain NON réalisé. */
  gain: number;
  gainPct: number | null;
  revenu: number;
  titres: number;
  part: number;
  fiscalite: Fiscalite;
  /** La lecture fiscale, en français simple, adaptée au signe du gain. */
  phrase: string;
}

export interface Comptes {
  lignes: CompteLigne[];
  valeur: number;
  cout: number;
  gain: number;
  revenu: number;
  /** Vrai si au moins un compte a une valeur comptable exploitable. */
  gainConnu: boolean;
}

const FISCALITE_PAR_CODE: Record<string, Fiscalite> = {
  W: 'abri',        // CELI
  S: 'reporte',     // REER
  T: 'reporte',     // FERR
  Y: 'reporte',     // FERR conjoint
  P: 'reporte',     // FRV
  N: 'reporte',     // RERI / CRI
  A: 'imposable',   // Comptant
  E: 'imposable',   // Marge
  F: 'inconnu',     // Devise
};

/**
 * La phrase qui accompagne le gain. Elle change avec le SIGNE : annoncer « la
 * moitié s'ajoute à votre revenu » sur une perte serait faux et inquiétant.
 * Formulations volontairement générales — c'est une règle usuelle, pas un avis
 * fiscal personnalisé, et la section le dit en toutes lettres.
 */
function phraseFiscale(f: Fiscalite, gain: number): string {
  const perte = gain < 0;
  if (f === 'abri') {
    return perte
      ? 'Dans un CELI, une perte ne se déduit pas — mais tout ce qui remonte vous revient sans impôt.'
      : 'Ce gain est à vous, net d’impôt : rien ne sera imposable à la sortie.';
  }
  if (f === 'reporte') {
    return perte
      ? 'L’impôt est reporté : ce sont les retraits qui sont imposés, pas les fluctuations.'
      : 'L’impôt est reporté : chaque dollar retiré s’ajoutera à votre revenu de l’année.';
  }
  if (f === 'imposable') {
    return perte
      ? 'Une perte réalisée ici peut réduire vos gains imposables d’autres années.'
      : 'À la vente, la moitié de ce gain s’ajoute à votre revenu imposable.';
  }
  return 'Traitement fiscal à confirmer selon le type de compte.';
}

/**
 * Regroupe les positions par compte et calcule le gain NON RÉALISÉ de chacun.
 *
 * Les liquidités sont incluses dans la valeur (c'est de l'argent du compte) mais
 * leur « gain » est nul par construction : valeur comptable = valeur de marché.
 * Une position sans valeur comptable exploitable ne contamine pas le gain du
 * compte — elle compte dans la valeur, pas dans le coût.
 */
export function buildComptes(holdings: PriceTargetHolding[]): Comptes | null {
  if (!holdings || holdings.length === 0) return null;

  const parLabel = new Map<string, {
    codes: Set<string>; valeur: number; cout: number; revenu: number; titres: number; coutConnu: boolean;
  }>();

  for (const h of holdings) {
    const label = (h.accountLabel || h.accountType || 'Compte').trim() || 'Compte';
    const e = parLabel.get(label) ?? { codes: new Set<string>(), valeur: 0, cout: 0, revenu: 0, titres: 0, coutConnu: false };
    if (h.accountType) e.codes.add(h.accountType);
    e.valeur += h.marketValue || 0;
    e.revenu += h.annualIncome || 0;
    e.titres += 1;
    // Une valeur comptable de zéro sur une position qui vaut quelque chose n'est
    // pas un coût de zéro : c'est une donnée absente. On ne l'additionne pas.
    if (Number.isFinite(h.bookValue) && h.bookValue !== 0) {
      e.cout += h.bookValue;
      e.coutConnu = true;
    } else if (h.assetType === 'CASH') {
      e.cout += h.marketValue || 0;   // les liquidités ne créent aucun gain
    }
    parLabel.set(label, e);
  }

  const valeurTotale = [...parLabel.values()].reduce((s, e) => s + e.valeur, 0);
  const lignes: CompteLigne[] = [...parLabel.entries()].map(([label, e]) => {
    const codes = [...e.codes].sort();
    const gain = e.coutConnu ? e.valeur - e.cout : 0;
    const fiscalite = codes.length ? (FISCALITE_PAR_CODE[codes[0]] ?? 'inconnu') : 'inconnu';
    return {
      label,
      codes,
      valeur: e.valeur,
      cout: e.cout,
      gain,
      gainPct: e.coutConnu && e.cout > 0 ? (gain / e.cout) * 100 : null,
      revenu: e.revenu,
      titres: e.titres,
      part: valeurTotale > 0 ? (e.valeur / valeurTotale) * 100 : 0,
      fiscalite,
      phrase: e.coutConnu ? phraseFiscale(fiscalite, gain) : 'Coût d’acquisition non fourni pour ce compte.',
    };
  }).sort((a, b) => b.valeur - a.valeur);

  return {
    lignes,
    valeur: valeurTotale,
    cout: lignes.reduce((s, l) => s + l.cout, 0),
    gain: lignes.reduce((s, l) => s + l.gain, 0),
    revenu: lignes.reduce((s, l) => s + l.revenu, 0),
    gainConnu: lignes.some((l) => l.gain !== 0),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · VOS OBLIGATIONS — l'échéancier, personnalisé aux montants du client
// ═══════════════════════════════════════════════════════════════════════════

export interface FluxObligation {
  /** 'AAAA-MM' — un versement se situe dans un mois, pas un jour. */
  cle: string;
  annee: number;
  mois: number;
  montant: number;
  type: 'coupon' | 'capital';
  /** Vrai si la date est déjà passée à la date du rapport. */
  passe: boolean;
}

export interface LigneObligation {
  symbole: string;
  nom: string;
  /** Le capital remboursé à l'échéance (la « quantité » de Croesus). */
  nominal: number;
  tauxCoupon: number | null;
  echeance: string | null;
  couponAnnuel: number;
  couponParVersement: number;
  valeur: number;
  interetsCourus: number;
  dureeModifiee: number | null;
  /** Rendement à l'échéance, en % annuel, calculé sur les flux réels. */
  rendementEcheance: number | null;
  anneesRestantes: number | null;
  flux: FluxObligation[];
  /** Somme des coupons à venir plus le capital. */
  totalAVenir: number;
  compte: string;
}

export interface Obligations {
  lignes: LigneObligation[];
  valeur: number;
  couponAnnuel: number;
  /** Durée modifiée moyenne, pondérée par la valeur. */
  dureeMoyenne: number | null;
  /** Rendement à l'échéance moyen, pondéré par la valeur. */
  rendementMoyen: number | null;
  /** Capital qui revient dans les 24 prochains mois. */
  capital24Mois: number;
}

/** Analyse « AAAA-MM-JJ » ou « JJ/MM/AAAA » sans jamais dépendre du fuseau. */
function parseEcheance(s: string | undefined): { annee: number; mois: number } | null {
  if (!s) return null;
  let m = /^(\d{4})-(\d{2})/.exec(s.trim());
  if (m) return { annee: Number(m[1]), mois: Number(m[2]) - 1 };
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(s.trim());
  if (m) return { annee: Number(m[3]), mois: Number(m[2]) - 1 };
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : { annee: d.getFullYear(), mois: d.getMonth() };
}

/**
 * Le rendement à l'échéance, par bissection sur les flux RÉELS.
 *
 * On ne se fie pas à un champ fourni : Croesus ne l'envoie pas jusqu'ici, et le
 * calculer sur les flux qu'on affiche garantit que le chiffre et la frise
 * racontent la même histoire. Prix de référence = valeur de marché plus intérêts
 * courus (le prix « sale »), soit ce que le client débourserait aujourd'hui.
 *
 * Retourne null si les flux ne permettent aucune solution crédible — mieux vaut
 * ne rien afficher qu'un rendement inventé.
 */
export function rendementEcheance(
  prixSale: number,
  flux: { montant: number; annees: number }[],
): number | null {
  const futurs = flux.filter((f) => f.annees > 0 && f.montant > 0);
  if (!(prixSale > 0) || futurs.length === 0) return null;

  const valeur = (y: number) =>
    futurs.reduce((s, f) => s + f.montant / Math.pow(1 + y / 2, 2 * f.annees), 0) - prixSale;

  let bas = -0.9, haut = 2;
  if (valeur(bas) * valeur(haut) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (bas + haut) / 2;
    if (valeur(mid) > 0) bas = mid; else haut = mid;
  }
  const y = ((bas + haut) / 2) * 100;
  return Number.isFinite(y) ? Math.round(y * 100) / 100 : null;
}

/**
 * L'échéancier d'une obligation, du 1er janvier de l'année courante jusqu'à
 * l'échéance. C'est exactement le dessin que Nicolas a demandé : des coupons
 * réguliers, puis un dernier versement où le capital s'ajoute au coupon.
 *
 * Les coupons déjà versés cette année sont conservés et marqués `passe` : le
 * client doit voir ce qu'il a DÉJÀ reçu, pas seulement ce qui reste.
 */
function echeancier(
  ech: { annee: number; mois: number },
  couponParVersement: number,
  nominal: number,
  aujourdhui: Date,
): FluxObligation[] {
  const flux: FluxObligation[] = [];
  const anneeDebut = aujourdhui.getFullYear();
  const moisA = ech.mois;
  const moisB = (ech.mois + 6) % 12;

  for (let annee = anneeDebut; annee <= ech.annee; annee++) {
    for (const mois of [moisB, moisA].sort((x, y) => x - y)) {
      // Après l'échéance, plus rien.
      if (annee === ech.annee && mois > ech.mois) continue;
      const dernier = annee === ech.annee && mois === ech.mois;
      const passe = annee < aujourdhui.getFullYear()
        || (annee === aujourdhui.getFullYear() && mois < aujourdhui.getMonth());
      const cle = String(annee) + '-' + String(mois + 1).padStart(2, '0');
      if (couponParVersement > 0) {
        flux.push({ cle, annee, mois, montant: couponParVersement, type: 'coupon', passe });
      }
      if (dernier && nominal > 0) {
        flux.push({ cle, annee, mois, montant: nominal, type: 'capital', passe });
      }
    }
  }
  return flux;
}

export function buildObligations(holdings: PriceTargetHolding[], aujourdhui: Date): Obligations | null {
  const bonds = (holdings ?? []).filter((h) => h.assetType === 'FIXED_INCOME' && (h.marketValue || 0) > 0);
  if (bonds.length === 0) return null;

  const lignes: LigneObligation[] = bonds.map((h) => {
    const ech = parseEcheance(h.maturityDate);
    const nominal = Math.abs(h.quantity || 0);
    const couponAnnuel = Math.max(0, h.annualIncome || 0);
    const couponParVersement = couponAnnuel / 2;
    const flux = ech ? echeancier(ech, couponParVersement, nominal, aujourdhui) : [];

    // Années restantes au milieu du mois d'échéance : la précision au jour près
    // n'existe pas dans la donnée, l'afficher serait une fausse rigueur.
    const anneesRestantes = ech
      ? Math.max(0, (ech.annee - aujourdhui.getFullYear()) + (ech.mois - aujourdhui.getMonth()) / 12)
      : null;

    const prixSale = (h.marketValue || 0) + (h.accruedInterest || 0);
    const pourRendement = flux
      .filter((f) => !f.passe)
      .map((f) => ({
        montant: f.montant,
        annees: (f.annee - aujourdhui.getFullYear()) + (f.mois - aujourdhui.getMonth()) / 12,
      }));

    return {
      symbole: h.symbol,
      nom: h.name,
      nominal,
      tauxCoupon: Number.isFinite(h.couponRate as number) ? (h.couponRate as number) : null,
      echeance: h.maturityDate ?? null,
      couponAnnuel,
      couponParVersement,
      valeur: h.marketValue || 0,
      interetsCourus: h.accruedInterest || 0,
      dureeModifiee: Number.isFinite(h.modifiedDuration as number) ? (h.modifiedDuration as number) : null,
      rendementEcheance: rendementEcheance(prixSale, pourRendement),
      anneesRestantes,
      flux,
      totalAVenir: flux.filter((f) => !f.passe).reduce((s, f) => s + f.montant, 0),
      compte: h.accountLabel || h.accountType || '',
    };
  }).sort((a, b) => {
    if (a.echeance && b.echeance) return a.echeance < b.echeance ? -1 : 1;
    return b.valeur - a.valeur;
  });

  const valeur = lignes.reduce((s, l) => s + l.valeur, 0);
  const pondere = (get: (l: LigneObligation) => number | null) => {
    const avec = lignes.filter((l) => get(l) != null && l.valeur > 0);
    const base = avec.reduce((s, l) => s + l.valeur, 0);
    if (base <= 0) return null;
    return Math.round((avec.reduce((s, l) => s + (get(l) as number) * l.valeur, 0) / base) * 100) / 100;
  };

  const limite = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() + 24, 1);
  const capital24Mois = lignes.reduce((s, l) => s + l.flux
    .filter((f) => f.type === 'capital' && !f.passe && new Date(f.annee, f.mois, 1) < limite)
    .reduce((t, f) => t + f.montant, 0), 0);

  return {
    lignes,
    valeur,
    couponAnnuel: lignes.reduce((s, l) => s + l.couponAnnuel, 0),
    dureeMoyenne: pondere((l) => l.dureeModifiee),
    rendementMoyen: pondere((l) => l.rendementEcheance),
    capital24Mois,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · UN MOIS DU CALENDRIER — ce qui arrive, et comment
// ═══════════════════════════════════════════════════════════════════════════

export interface EtapeRevenu {
  titre: string;
  texte: string;
}

export interface MoisRevenu {
  index: number;
  label: string;
  dividendes: number;
  coupons: number;
  total: number;
  passe: boolean;
  /** Les étapes, écrites avec LES MONTANTS DE CE MOIS. */
  etapes: EtapeRevenu[];
}

const MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const arg = (n: number) => Math.round(n).toLocaleString('fr-CA') + ' $';

/**
 * Ce qu'un mois du calendrier veut dire, expliqué pas à pas avec les montants du
 * client. Deux mécaniques différentes, expliquées séparément parce qu'un client
 * qui ne fait pas la différence entre un dividende et un coupon ne comprend pas
 * pourquoi l'un peut être coupé et pas l'autre.
 */
export function buildMoisRevenu(
  calendrier: { label: string; dividends: number; coupons: number }[],
  index: number,
  moisCourant: number,
): MoisRevenu | null {
  if (!calendrier || index < 0 || index >= calendrier.length) return null;
  const m = calendrier[index];
  const dividendes = Math.max(0, m.dividends || 0);
  const coupons = Math.max(0, m.coupons || 0);
  const total = dividendes + coupons;
  const nom = MOIS_LONGS[index] ?? m.label;
  const passe = index < moisCourant;
  const etapes: EtapeRevenu[] = [];

  if (dividendes > 0) {
    etapes.push({
      titre: 'Un dividende — votre part des profits',
      texte: 'Une entreprise que vous détenez décide de partager une partie de ses profits '
        + 'avec ses actionnaires. Vous n’avez rien à faire : vous êtes propriétaire, donc vous '
        + 'y avez droit.',
    });
    etapes.push({
      titre: 'Le conseil d’administration l’annonce',
      texte: 'Il fixe le montant par action et la date. Un dividende n’est jamais garanti : '
        + 'une entreprise peut le hausser, le maintenir, ou le couper si ses affaires vont mal.',
    });
    etapes.push({
      titre: 'Vous devez détenir l’action avant la date de clôture',
      texte: 'C’est le registre à cette date qui décide qui est payé. Vos titres sont déjà en '
        + 'portefeuille : cette condition est remplie.',
    });
    etapes.push({
      titre: 'En ' + nom + ', ' + arg(dividendes) + ' entre',
      texte: passe
        ? 'Ce montant est déjà entré dans votre compte.'
        : 'L’argent est déposé dans votre compte. Il reste disponible, ou il est réinvesti — '
          + 'c’est une décision qu’on prend ensemble.',
    });
  }

  if (coupons > 0) {
    etapes.push({
      titre: 'Un coupon — les intérêts d’un prêt',
      texte: 'En achetant une obligation, vous avez prêté de l’argent à un gouvernement ou à une '
        + 'entreprise. Le coupon, c’est l’intérêt qu’on vous verse pour ce prêt.',
    });
    etapes.push({
      titre: 'Le montant est fixé d’avance, à la signature',
      texte: 'Contrairement au dividende, il ne dépend pas des résultats de l’émetteur : il est '
        + 'écrit au contrat. Tant que l’émetteur paie ses dettes, le montant ne bouge pas.',
    });
    etapes.push({
      titre: 'Il tombe deux fois par année',
      texte: 'Chaque versement vaut la moitié du coupon annuel. Les dates sont calées sur la date '
        + 'd’échéance de l’obligation.',
    });
    etapes.push({
      titre: 'En ' + nom + ', ' + arg(coupons) + ' entre',
      texte: passe
        ? 'Ce montant est déjà entré dans votre compte.'
        : 'À l’échéance de l’obligation, c’est le capital prêté qui revient en entier, avec le '
          + 'dernier coupon.',
    });
  }

  if (etapes.length === 0) {
    etapes.push({
      titre: 'Aucun versement prévu en ' + nom,
      texte: 'Les revenus d’un portefeuille ne tombent pas tous les mois : ils suivent le calendrier '
        + 'de chaque entreprise et de chaque obligation. Un mois sans versement n’est pas un mois '
        + 'sans rendement.',
    });
  }

  return { index, label: m.label, dividendes, coupons, total, passe, etapes };
}
