// LE RAPPROCHEMENT DES CONVERSIONS CAD/USD — étape 3, périmètre mesuré.
//
// ─────────────────────────────────────────────────────────────────────────────
// D'OÙ VIENNENT CES RÈGLES (docs/mesure-livre-flux-2026-08-19.md).
//
// Elles ne sont pas plausibles : elles sont MESURÉES, sur la base locale réelle
// que ce module consommera (8 609 lignes, 7 clients, 2000-2026). Ce que la
// mesure a établi :
//
//   · les 8 conversions observables (taux en note + ratio concordant) sont
//     TOUTES : même racine de compte, lettres jumelles E/F, devises cohérentes,
//     1CAD/1USD, MÊME DATE, contrepartie unique — la combinaison structurelle
//     complète a une précision de 80 % (8 confirmées + 2 non contredites / 10) ;
//   · la convention du taux en note est DIRECTE (CAD par USD) : 8 concordances
//     en direct à ≤ 0,1 %, 0 en inverse, à toutes les tolérances ;
//   · la concordance est BINAIRE : ≤ 0,1 % ou > 5 %, rien entre les deux — le
//     seuil de 0,5 % retenu par Nicolas ne coupe donc aucun vrai cas ;
//   · AUCUNE conversion observable à ±1, ±2 ou ±3 jours (la seule paire à ±2 j
//     avait un ratio de 295) → pas de fenêtre, J0 est un invariant ici ;
//   · 8 paires entre racines DIFFÉRENTES du même client : 0 observable, ratios
//     3,3-15,4 → pas de rapprochement inter-racines ;
//   · 0 conversion en Achat/Vente d'encaisse dans cette base → pas de règle ;
//   · 0 type correctif dans les 110 paires de renversement → AUCUNE
//     neutralisation automatique ; une note d'annulation ne produit qu'un
//     signal `ambigu` (12 des 21 paires « à note » étaient des conversions).
//
// CES RÈGLES VALENT POUR CETTE BASE. Le grand livre (832 k lignes) pourra les
// élargir — Achat/Vente d'encaisse, contre-passations — mais chaque
// élargissement passera par une nouvelle mesure, jamais par analogie.
//
// L'ORDRE COMMANDE (consigne 9 de Nicolas) : le rapprochement se fait AVANT que
// la nature ligne-seule d'une ligne d'encaisse ne soit figée. `classerLigne()`
// reste une fonction ligne-seule ; c'est `classerLignes()` (pluriel) qui
// orchestre : rapprocher d'abord, classer le reste ensuite.
//
// LES INVARIANTS (consigne 10), tous testés :
//   · une ligne source appartient à AU PLUS une paire ;
//   · une paire contient EXACTEMENT deux jambes, qui gardent leur devise et
//     leur montant d'origine — jamais additionnés entre devises ;
//   · une conversion ne crée ni cotisation ni retrait, et son flux externe
//     consolidé client vaut zéro par construction ;
//   · chaque jambe garde sa transaction source et son motif ;
//   · une ligne `ambigu` ne participe jamais à un montant fiscal ferme (tenu
//     par la doctrine du moteur : seul `calcule` porte un montant, et rien ne
//     consomme encore ces natures).
// ─────────────────────────────────────────────────────────────────────────────

import type { LigneTransaction } from '@/lib/parseur-croesus/types';
import { decomposerCompte } from '@/lib/parseur-croesus/types';
import { estEncaisse } from '@/lib/parseur-croesus/regles';
import { classerLigne, type LigneClassee } from './flux';

/** Les deux faces CAD/USD d'un même sous-type iA — mesurées E/F ; A/B par symétrie de table. */
const JUMELLE_DE: Record<string, string> = { A: 'B', B: 'A', E: 'F', F: 'E' };
const DEVISE_DE_LA_LETTRE: Record<string, 'CAD' | 'USD'> = { A: 'CAD', B: 'USD', E: 'CAD', F: 'USD' };

/** Tolérance ratio/taux retenue par Nicolas (19 août). Mesuré binaire : ≤ 0,1 % ou > 5 %. */
const TOLERANCE_TAUX = 0.005;

/**
 * TOUS les taux ANNONCÉS d'une note — forme MOT-CLÉ seulement (« TAUX … »,
 * « RATE … », « @ … », « CONV EN CAD … »), dans l'ordre du texte, doublons
 * compris.
 *
 * Extrait de `tauxDansNote` le 20 août 2026 pour la couche fiscale CELI, SANS
 * dupliquer la regex : sur une jambe FX, le RATIO valide le taux (même repêché
 * « nu ») ; sur un événement CELI isolé, rien ne le valide — seul un taux
 * explicitement ANNONCÉ par un mot-clé peut être considéré, et une note qui en
 * annonce deux différents est une CONTRADICTION, pas un choix.
 */
export type TauxAnnonce = { taux: number; motCle: string };

export function tauxExplicitesDansNote(note: string | null | undefined): TauxAnnonce[] {
  const n = (note ?? '').toUpperCase();
  const taux: TauxAnnonce[] = [];
  // FRONTIÈRE GAUCHE OBLIGATOIRE sur les mots-clés alphabétiques (contre-
  // expertise du 20 août) : sans elle, CAPITAUX, TOTAUX, PRORATE, CORPORATE…
  // fabriquaient un « taux annoncé » depuis un mot français ordinaire —
  // « CAPITAUX 5,000.00 » devenait un taux de 5. `\b` ne suffit pas : É est
  // hors-mot pour lui, et « ÉTAUX » passait — d'où le lookbehind Latin-1.
  for (const m of n.matchAll(/((?<![A-Z0-9À-Þ])(?:TAUX|RATE|CONV\.?(?:\s*EN\s*(?:CAD|USD))?)|@)\s*:?\s*([0-9][.,][0-9]{1,6})\b/g)) {
    taux.push({ taux: Number.parseFloat(m[2].replace(',', '.')), motCle: m[1] });
  }
  return taux;
}

/**
 * Le taux lu dans une note — pour le RAPPROCHEMENT FX, où le ratio le valide.
 * La convention est DIRECTE — CAD par USD — prouvée par la mesure (8/8 en
 * direct, 0 en inverse). Derrière un mot-clé : 1 à 6 décimales ; isolé (le
 * repli « nu », réservé au FX) : 4 à 6, pour ne pas prendre un prix pour un
 * taux. Comportement inchangé par l'extraction ci-dessus : premier mot-clé,
 * sinon repli.
 */
export function tauxDansNote(note: string | null | undefined): number | null {
  const explicites = tauxExplicitesDansNote(note);
  if (explicites.length > 0) return explicites[0].taux;
  const n = (note ?? '').toUpperCase();
  const m = /\b([01][.,][0-9]{4,6})\b/.exec(n);
  return m ? Number.parseFloat(m[1].replace(',', '.')) : null;
}

/** Une conversion rapprochée : deux jambes, chacune dans SA devise. */
export type PaireConversion = {
  /** La jambe du côté CAD (lettre A ou E) et celle du côté USD (B ou F) — montants et devises d'ORIGINE. */
  jambeCad: LigneTransaction;
  jambeUsd: LigneTransaction;
  /** |total CAD| ÷ |total USD| — le taux effectif CAD par USD. */
  ratio: number;
  /** Le taux écrit dans la note, quand il y en a un. */
  tauxNote: number | null;
  confiance: 'confirme' | 'eleve';
  /** UNE phrase : quelle règle, quelles preuves. */
  motif: string;
};

export type ResultatRapprochement = {
  paires: PaireConversion[];
  /**
   * Toutes les lignes, classées : les jambes des paires portent
   * `conversion-devise` ; le reste sort de `classerLigne()` — sauf les lignes
   * d'encaisse qui ONT FAILLI être une conversion, rétrogradées `ambigu` avec
   * le motif de la preuve manquante.
   */
  classees: LigneClassee[];
};

type Candidate = {
  l: LigneTransaction;
  lettre: string;
  devise: 'CAD' | 'USD';
  racine: string;   // préfixe + milieu — « 37-XXXX »
};

/**
 * Les types Croesus qui peuvent porter une jambe de conversion. MESURÉ : les
 * 17 jambes jumelles de la base passent TOUTES par « Transfert » (matrice H de
 * la mesure) ; « Réception » est admis comme son synonyme d'entrée (TYPES_ENTREE
 * de regles.ts). « Achat »/« Vente » d'encaisse : 0 occurrence mesurée — la
 * consigne du 19 août INTERDIT cette règle tant que le grand livre ne l'a pas
 * validée. Un type hors de cette liste n'est jamais candidat.
 */
const TYPES_JAMBE_FX = new Set(['transfert', 'reception']);
const normaliserType = (t: string) =>
  (t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** Une ligne peut-elle être une jambe de conversion ? (structure seule, sans regarder les autres) */
function candidate(l: LigneTransaction): Candidate | null {
  if (!TYPES_JAMBE_FX.has(normaliserType(l.type))) return null;   // Achat/Vente : périmètre interdit
  const d = decomposerCompte(l.noCompte);
  if (!d || d.vmbl) return null;                        // aucune conversion VMBL mesurée
  const devise = DEVISE_DE_LA_LETTRE[d.suffixe];
  if (!devise) return null;                             // lettre sans face CAD/USD
  if (!estEncaisse(l.symbole)) return null;             // 1CAD/1USD seulement — mesuré : les 8/8
  if (l.total === null || l.total === 0) return null;
  // La devise de la LIGNE doit être cohérente avec la lettre du compte, et le
  // symbole avec la devise. 75 paires de l'univers mesuré échouaient ici.
  if (l.devise.toUpperCase() !== devise) return null;
  if (l.symbole.trim().toUpperCase() !== `1${devise}`) return null;
  return { l, lettre: d.suffixe, devise, racine: `${d.prefixe}-${d.milieu}` };
}

/**
 * Rapproche les conversions CAD/USD d'un lot de lignes, puis classe tout.
 *
 * FX-1 (confiance `confirme`) : même racine · lettres jumelles · devises
 * cohérentes · 1CAD/1USD · même date · signes opposés · contrepartie unique
 * DES DEUX CÔTÉS · taux extrait d'une des notes · |ratio − taux| ÷ taux ≤ 0,5 %.
 *
 * FX-2 (confiance `eleve`) : les mêmes preuves structurelles, sans taux
 * exploitable. Jamais `confirme` : la mesure a vu 1 paire structurelle avec un
 * taux DISCORDANT — le taux, quand il existe, doit être respecté.
 *
 * Taux discordant (> 0,5 %) : la paire n'est PAS rapprochée — les deux jambes
 * sortent `ambigu` avec le motif de la contradiction.
 */
export function rapprocherConversions(lignes: LigneTransaction[]): ResultatRapprochement {
  // ── 1 · les candidates, indexées par (racine, date) ─────────────────────────
  const parRacineDate = new Map<string, Candidate[]>();
  const candidates = new Map<LigneTransaction, Candidate>();
  for (const l of lignes) {
    const c = candidate(l);
    if (!c) continue;
    candidates.set(l, c);
    const cle = `${c.racine}|${l.date}`;
    if (!parRacineDate.has(cle)) parRacineDate.set(cle, []);
    parRacineDate.get(cle)!.push(c);
  }

  // ── 2 · le rapprochement — J0 strict, unicité des DEUX côtés ────────────────
  const paires: PaireConversion[] = [];
  const dansUnePaire = new Set<LigneTransaction>();      // invariant : au plus une paire par ligne
  const retrogradees = new Map<LigneTransaction, string>();   // ligne → motif d'ambiguïté

  for (const [, cands] of parRacineDate) {
    const cad = cands.filter((c) => c.devise === 'CAD');
    const usd = cands.filter((c) => c.devise === 'USD');
    for (const x of cad) {
      if (dansUnePaire.has(x.l) || retrogradees.has(x.l)) continue;
      // Les contreparties STRUCTURELLES de x : lettre jumelle, signe opposé.
      const contreparties = usd.filter((y) =>
        !dansUnePaire.has(y.l) &&
        y.lettre === JUMELLE_DE[x.lettre] &&
        Math.sign(y.l.total as number) === -Math.sign(x.l.total as number));
      if (contreparties.length === 0) continue;   // pas une quasi-conversion : classement ligne-seule
      if (contreparties.length > 1) {
        // CONTREPARTIES MULTIPLES : personne n'est rapproché, tout le monde se
        // déclare. Mesuré : 0 cas dans la base — mais le jour où il arrive, un
        // choix silencieux serait un montant faux.
        retrogradees.set(x.l, `conversion possible mais ${contreparties.length} contreparties ${JUMELLE_DE[x.lettre]} le même jour — indécidable sans preuve supplémentaire`);
        for (const y of contreparties) retrogradees.set(y.l, `conversion possible mais plusieurs jambes ${x.lettre} / ${JUMELLE_DE[x.lettre]} en concurrence le même jour`);
        continue;
      }
      const y = contreparties[0];
      // L'unicité doit tenir DANS LES DEUX SENS : si un autre x' CAD (même
      // racine, même date, lettre jumelle, signe opposé à y) peut réclamer le
      // même y, la paire n'est pas unique.
      const rivaux = cad.filter((x2) => x2 !== x && !dansUnePaire.has(x2.l) && !retrogradees.has(x2.l)
        && y.lettre === JUMELLE_DE[x2.lettre]
        && Math.sign(x2.l.total as number) === -Math.sign(y.l.total as number));
      if (rivaux.length > 0) {
        retrogradees.set(y.l, `conversion possible mais ${1 + rivaux.length} jambes ${x.lettre} en concurrence le même jour — indécidable`);
        retrogradees.set(x.l, 'conversion possible mais une autre jambe du même côté vise la même contrepartie — indécidable');
        for (const r of rivaux) retrogradees.set(r.l, 'conversion possible mais une autre jambe du même côté vise la même contrepartie — indécidable');
        continue;
      }

      const ratio = Math.abs(x.l.total as number) / Math.abs(y.l.total as number);
      const taux = tauxDansNote(x.l.note) ?? tauxDansNote(y.l.note);

      if (taux !== null && taux <= 0) {
        // UN TAUX ÉCRIT MAIS ILLISIBLE (0 ou négatif) est une preuve négative,
        // comme un taux contredit — et son motif doit être le VRAI motif :
        // l'ancienne division par zéro imprimait « écart Infinity % ».
        const m = `structure de conversion complète mais le taux annoncé (${taux}) est inexploitable — pas rapproché`;
        retrogradees.set(x.l, m); retrogradees.set(y.l, m);
      } else if (taux !== null) {
        const ecart = Math.abs(ratio - taux) / taux;
        if (ecart <= TOLERANCE_TAUX) {
          paires.push({ jambeCad: x.l, jambeUsd: y.l, ratio, tauxNote: taux, confiance: 'confirme',
            motif: `FX-1 : même racine, lettres ${x.lettre}/${y.lettre}, même date, 1CAD/1USD, contrepartie unique, taux ${taux} en note respecté par le ratio ${ratio.toFixed(4)} (écart ${(ecart * 100).toFixed(2)} %)` });
          dansUnePaire.add(x.l); dansUnePaire.add(y.l);
        } else {
          // Un taux écrit et CONTREDIT est une preuve NÉGATIVE, pas une absence
          // de preuve : la paire ne se rapproche pas, et FX-2 ne la repêche pas.
          const m = `structure de conversion complète mais le taux ${taux} de la note CONTREDIT le ratio ${ratio.toFixed(4)} (écart ${(ecart * 100).toFixed(1)} %) — pas rapproché`;
          retrogradees.set(x.l, m); retrogradees.set(y.l, m);
        }
      } else {
        paires.push({ jambeCad: x.l, jambeUsd: y.l, ratio, tauxNote: null, confiance: 'eleve',
          motif: `FX-2 : même racine, lettres ${x.lettre}/${y.lettre}, même date, 1CAD/1USD, contrepartie unique — aucun taux en note, jamais « confirmé » sans lui` });
        dansUnePaire.add(x.l); dansUnePaire.add(y.l);
      }
    }
  }

  // ── 3 · classer tout, dans l'ordre : paires d'abord (consigne 9) ────────────
  const classees: LigneClassee[] = lignes.map((l) => {
    const base = classerLigne(l);
    if (dansUnePaire.has(l)) {
      const p = paires.find((q) => q.jambeCad === l || q.jambeUsd === l)!;
      // La jambe garde SA devise et SON montant (dans `source`) ; la nature
      // devient conversion-devise : ni cotisation, ni retrait, ni apport —
      // le flux externe consolidé de la paire est zéro par construction.
      return { ...base, nature: 'conversion-devise', confiance: p.confiance, motif: p.motif };
    }
    const motifAmbigu = retrogradees.get(l);
    if (motifAmbigu) return { ...base, nature: 'ambigu', confiance: 'ambigu', motif: motifAmbigu };
    return base;
  });

  return { paires, classees };
}
