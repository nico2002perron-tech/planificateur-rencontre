// LES QUATRE RÈGLES DU PARSEUR — voir docs/regles-parseur.md pour les mesures
// qui les ont établies. TypeScript pur, fonctions sans effet de bord.

import type { LigneTransaction, FluxCompte } from './types';

/** Lit un nombre au format québécois : « 1 234,56 » → 1234.56. */
export function nombre(brut: string | null | undefined): number | null {
  const t = String(brut ?? '')
    .replace(/[\s $]/g, '')
    .replace(/\((.*)\)/, '-$1')       // « (1 234,56) » = négatif
    .replace(/,/g, '.');
  if (t === '' || t === '-') return null;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// RÈGLE 1 · L'ÉCHELLE PAR 100 DES OBLIGATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dérive une valeur unitaire d'un total et d'une quantité.
 *
 * C'EST LA SEULE FAÇON CORRECTE. La colonne unitaire d'une obligation est
 * exprimée pour 100 $ de nominal : `Q273A4` porte 100,000 pour une position de
 * 39 000 $ (39 000 × 100 donnerait 3,9 M$). La division porte l'échelle en
 * elle et vaut pour tous les instruments sans avoir à les distinguer.
 */
export function unitaireDerive(total: number | null, quantite: number | null): number | null {
  if (total === null || quantite === null) return null;
  if (Math.abs(quantite) < 1e-9) return null;
  return Math.abs(total / quantite);
}

// ─────────────────────────────────────────────────────────────────────────────
// RÈGLE 2 · LA PARTIE DOUBLE DES COTISATIONS
// ─────────────────────────────────────────────────────────────────────────────

const SYMBOLES_ENCAISSE = new Set(['1CAD', '1USD']);

export function estEncaisse(symbole: string): boolean {
  return SYMBOLES_ENCAISSE.has(symbole.trim().toUpperCase());
}

/**
 * Sépare les cotisations en ARGENT NEUF des apports EN NATURE.
 *
 * Une cotisation en nature s'écrit deux fois — une jambe argent et une jambe
 * titre de montant opposé, même compte, même date. Les additionner double le
 * montant ; et surtout, la jambe argent appariée n'est PAS de l'argent neuf :
 * c'est un apport de titres, souvent un transfert de régime qui ne consomme
 * aucun droit de cotisation.
 *
 * Mesuré sur le livre : 46 % des « cotisations » CELI sont appariées
 * (12,7 M$ sur 27,3 M$). Un compte affichait 300 221 $ de cotisations pour un
 * CELI ouvert le mois précédent — impossible, et expliqué par l'appariement.
 */
export function separerCotisations(lignes: LigneTransaction[]): {
  argentNeuf: number;
  apportsEnNature: number;
} {
  const cotisations = lignes.filter((l) => l.type === 'Cotisation');
  const jambesTitre = cotisations.filter(
    (l) => !estEncaisse(l.symbole) && l.symbole !== '' && l.total !== null && l.total !== 0
  );
  const jambesArgent = cotisations.filter(
    (l) => estEncaisse(l.symbole) && (l.total ?? 0) > 0
  );

  const restants = [...jambesTitre];
  let apportsEnNature = 0;
  let argentNeuf = 0;

  for (const argent of jambesArgent) {
    const montant = argent.total as number;
    const i = restants.findIndex(
      (t) =>
        t.date === argent.date &&
        t.noCompte === argent.noCompte &&
        Math.abs(Math.abs(t.total as number) - montant) < 0.02
    );
    if (i >= 0) {
      apportsEnNature += montant;
      restants.splice(i, 1);
    } else {
      argentNeuf += montant;
    }
  }
  return { argentNeuf, apportsEnNature };
}

// ─────────────────────────────────────────────────────────────────────────────
// RÈGLES 3 ET 4 · VIREMENT INTERNE, TRANSFERT EXTERNE, ET LE DOUTE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Motifs de note qui désignent un AUTRE COMPTE DU MÊME CLIENT.
 * Relevés sur le livre réel : 5 069 transferts entrants les portent.
 */
const NOTE_VIREMENT_INTERNE =
  /TRANSFERE?\s+A\b|VIRE\s+DE\b|\bTRSF\b|ARTICLE\s+146\s*\(\s*16\s*\)/i;

/**
 * UN NUMÉRO DE COMPTE DANS LA NOTE — ajouté le 4 août 2026.
 *
 * Nicolas : « ça commence toujours par 37 normalement, et ceux qui font genre
 * 4A et 6A c'est les vieux numéros de compte [VMBL] ». Une note qui NOMME un
 * compte désigne une contrepartie identifiée : c'est un virement interne.
 * Motifs réels : « A 37-AEF9-R - 146(16) », « 4A-Y3VI-6 », « 6A-CDTR-9 ».
 *
 * MESURE : +1 556 lignes reconnues (28 % → 37 % des transferts entrants).
 * Effet sur les comptes débloqués : 253 → 247 sur 267, soit 2 points. Modeste,
 * et c'est instructif — il suffit d'UN orphelin pour bloquer un compte, donc
 * affiner l'appariement ne remplacera jamais la résolution manuelle. Le gain
 * réel est ailleurs : 1 556 lignes de bruit en moins à trancher à la main.
 */
const NOTE_NUMERO_COMPTE =
  /\b\d{2}-[A-Z0-9]{4}-[A-Z0-9]\b|\b[0-9][A-Z]-[A-Z0-9]{4}-[0-9]\b/i;

/**
 * VOLONTAIREMENT NON RECONNUS, malgré leur fréquence — règle 4 :
 *   « TFR-146(16) » (256 lignes), « TFR-146.3(2)(E) » (78) : l'article 146(16)
 *   autorise le transfert direct entre REER, Y COMPRIS ENTRE INSTITUTIONS. Le
 *   citer ne prouve donc RIEN sur l'internalité — sauf quand un numéro de
 *   compte l'accompagne, et là c'est le motif ci-dessus qui tranche.
 *   « TRANSFERT DE FONDS » (226), « PAIEMENT RETRAITE » (907) : trop vagues.
 * Dans le doute, la borne.
 */

/** Règle 3 : la note prouve-t-elle un virement interne ? */
export function estVirementInterne(note: string): boolean {
  const n = note ?? '';
  return NOTE_VIREMENT_INTERNE.test(n) || NOTE_NUMERO_COMPTE.test(n);
}

const TYPES_ENTREE = new Set(['Transfert', 'Réception']);

/**
 * Analyse les flux d'un compte enregistré : cotisations, retraits, et le
 * drapeau qui décide si les droits sont calculables ou seulement bornés.
 *
 * RÈGLE 4 — L'ASYMÉTRIE VOULUE : un transfert entrant SANS note d'appariement
 * est présumé EXTERNE. L'absence de preuve d'appariement n'est pas une preuve
 * d'absence de compte externe. Décision du planificateur (4 août 2026) :
 * « dans le doute on rétrograde vers la borne, jamais l'inverse, parce qu'un
 * chiffre de droits CELI faux est pire qu'une borne prudente ». Un droit
 * surestimé coûte au client une pénalité de 1 % par mois ; une borne prudente
 * ne coûte qu'une question de plus en rencontre.
 */
export function analyserFluxCompte(lignes: LigneTransaction[]): FluxCompte {
  const { argentNeuf, apportsEnNature } = separerCotisations(lignes);

  const retraits = lignes
    .filter((l) => l.type === 'Retrait' && (l.total ?? 0) < 0)
    .reduce((s, l) => s + Math.abs(l.total as number), 0);

  const transferts = lignes
    .filter((l) => TYPES_ENTREE.has(l.type) && (l.total ?? 0) > 0)
    .map((l) => ({
      date: l.date,
      montant: l.total as number,
      apparie: estVirementInterne(l.note),
      note: l.note,
    }));

  // Un apport EN NATURE non expliqué compte aussi comme entrée douteuse : des
  // titres arrivés d'ailleurs sans note d'appariement, c'est exactement le
  // motif d'un transfert de régime externe.
  const apportsDouteux = lignes.filter(
    (l) => l.type === 'Cotisation' && !estEncaisse(l.symbole) && l.symbole !== ''
      && (l.quantite ?? 0) > 0 && !estVirementInterne(l.note)
  ).length;

  const transfertEntrantDetecte =
    transferts.some((t) => !t.apparie) || apportsDouteux > 0;

  return {
    cotisations: argentNeuf,
    retraits,
    apportsEnNature,
    transfertEntrantDetecte,
    transferts,
  };
}
