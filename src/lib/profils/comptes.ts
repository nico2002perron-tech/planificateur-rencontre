// LES COMPTES DU PROFIL — la jointure relevé ↔ grand livre.
//
// Un relevé de positions ne porte que le SUFFIXE du compte (colonne 4). Le
// numéro complet n'existe que dans le grand livre. La jointure entre les deux
// est AMBIGUË PAR NATURE : 65 clients du livre ont deux comptes finissant par
// la même lettre.
//
// CE MODULE NE DEVINE JAMAIS. Il rend un verdict par compte, et quand le
// verdict est « ambigu » il transporte les candidats jusqu'à l'écran pour que
// le planificateur tranche — comme il tranche déjà les transferts orphelins.
//
// COMME `resumeCeli`, LE RÉSULTAT EST DÉRIVÉ À LA LECTURE, jamais figé dans le
// profil. C'est la leçon déjà payée deux fois ici : `historique.ts` archive le
// brut « parce qu'un parseur qui jette sa matière première condamne ses
// propres erreurs à être définitives ». Une jointure figée aujourd'hui ne
// bénéficierait d'aucune correction future, et rien ne signalerait qu'elle est
// périmée. Ce qui est persisté, c'est le relevé brut et les tranchages datés.

import { canoniserCompte, decomposerCompte } from '@/lib/parseur-croesus/identifiant-compte';
import { typeDeCompte } from '@/lib/parseur-croesus/types';
import { parserPositions, grouperParCompte, type VerdictJointure } from '@/lib/parseur-croesus/positions';
import type { LigneTransaction } from '@/lib/parseur-croesus/types';
import type { Compte, Position, ProvenanceNumero, TypeCompte, Titulaire } from './types';

/** Un compte tranché à la main — le pendant de `TransfertResolu`. */
export type CompteResolu = {
  /** Le suffixe canonisé, tel qu'il apparaît au relevé. */
  suffixe: string;
  /** Le numéro complet, choisi par le planificateur parmi les candidats. */
  numero: string | null;
  titulaire: Titulaire | null;
  dateConfirmation: string;
};

/**
 * Un candidat de jointure, avec de quoi le reconnaître.
 *
 * La date de dernière activité et le dernier solde suffisent presque toujours
 * au planificateur pour trancher d'un coup d'œil. On les MONTRE ; on ne s'en
 * sert pas pour choisir à sa place — ce serait une heuristique, et la règle 4
 * dit quoi faire dans le doute.
 */
export type Candidat = {
  numero: string;
  derniereActivite: string | null;
  dernierSolde: number | null;
  nbLignes: number;
};

/**
 * L'index des comptes du livre, par suffixe canonique.
 *
 * PORTÉE DE CET INDEX, à ne pas surestimer : il ne connaît que les comptes
 * ayant eu une transaction dans les collages déjà importés. Un compte ouvert
 * après le dernier collage, ou sans mouvement sur la période, en est absent —
 * et un « candidat unique » peut donc être faux. Symétriquement, un compte
 * fermé depuis dix ans y figure encore et fabrique de fausses ambiguïtés.
 */
export function indexerComptesDuLivre(livre: LigneTransaction[]): Map<string, Candidat[]> {
  const parNumero = new Map<string, Candidat>();
  for (const l of livre) {
    const numero = l.noCompte;
    if (!numero) continue;
    const cle = canoniserCompte(numero);
    let c = parNumero.get(cle);
    if (!c) {
      c = { numero, derniereActivite: null, dernierSolde: null, nbLignes: 0 };
      parNumero.set(cle, c);
    }
    c.nbLignes += 1;
    if (c.derniereActivite === null || l.date > c.derniereActivite) {
      c.derniereActivite = l.date;
      c.dernierSolde = l.solde;
    }
  }

  const parSuffixe = new Map<string, Candidat[]>();
  for (const c of parNumero.values()) {
    const d = decomposerCompte(c.numero);
    if (!d) continue;
    if (!parSuffixe.has(d.suffixe)) parSuffixe.set(d.suffixe, []);
    parSuffixe.get(d.suffixe)!.push(c);
  }
  for (const liste of parSuffixe.values()) {
    liste.sort((a, b) => (b.derniereActivite ?? '').localeCompare(a.derniereActivite ?? ''));
  }
  return parSuffixe;
}

/**
 * Le verdict de jointure d'un suffixe.
 *
 * LE CAS `non-jointable` MÉRITE SON NOM. Chez VMBL, le dernier caractère du
 * numéro est un CHIFFRE (« 4A-Y3VI-6 ») alors que la colonne 4 d'un relevé
 * porte une lettre. Les deux ne se comparent tout simplement pas. Ça touche
 * 424 comptes VMBL plus les 9 comptes « ~E », soit 433 sur 3 325 — 13 % du
 * livre. Les confondre avec un compte réellement inconnu ferait disparaître
 * l'écart au lieu de le montrer.
 *
 * ⚠ MESURE OFFICIELLEMENT REPORTÉE — décision de Nicolas, 5 août 2026.
 *
 * La question tenait en une observation : ouvrir un relevé de positions pour un
 * client porteur d'un compte 4A/6A et regarder ce que contient la colonne 4 —
 * le chiffre final du numéro, ou la lettre de régime du bloc du milieu ?
 *
 * Elle reste sans réponse, et c'est assumé : `non-jointable` est le
 * comportement honnête, et aucune stratégie ne la réclame aujourd'hui.
 * L'item revient au chantier du catalogue LE JOUR où une stratégie en dépend.
 * Ne pas la relancer d'ici là — ce n'est pas un oubli, c'est un choix.
 */
export function jointureDuSuffixe(
  suffixe: string,
  index: Map<string, Candidat[]>,
  resolus: CompteResolu[] = []
): VerdictJointure & { candidatsDetailles: Candidat[] } {
  const s = canoniserCompte(suffixe);

  const tranche = resolus.find((r) => canoniserCompte(r.suffixe) === s);
  if (tranche?.numero) {
    return {
      numero: tranche.numero, provenance: 'livre', candidats: [tranche.numero],
      candidatsDetailles: [],
    };
  }

  const candidats = index.get(s) ?? [];
  if (candidats.length === 1) {
    return {
      numero: candidats[0].numero, provenance: 'livre',
      candidats: [candidats[0].numero], candidatsDetailles: candidats,
    };
  }
  if (candidats.length > 1) {
    return {
      numero: null, provenance: 'ambigu',
      candidats: candidats.map((c) => c.numero), candidatsDetailles: candidats,
    };
  }

  // Aucun candidat. Est-ce parce que le livre est vide, ou parce que ce
  // suffixe est structurellement incomparable ?
  const queDesVmbl = index.size > 0 && [...index.keys()].every((k) => /^[0-9]$/.test(k));
  return {
    numero: null,
    provenance: queDesVmbl ? 'non-jointable' : 'absent',
    candidats: [],
    candidatsDetailles: [],
  };
}

/** Le régime d'un compte — `null` dès que le numéro n'est pas prouvé. */
function regimeDuCompte(numero: string | null): Compte['type'] {
  if (numero === null) return null;      // voir le commentaire du champ `type`
  return (typeDeCompte(numero) as TypeCompte | 'reer-conjoint' | null) ?? null;
}

export type ResultatComptes = {
  comptes: Compte[];
  /** Les suffixes dont la jointure reste à trancher — matière de l'écran. */
  aTrancher: Array<{ suffixe: string; candidats: Candidat[] }>;
  ignorees: number;
  /** Vrai si le collage porte plusieurs clients : la jointure est refusée. */
  multiClients: boolean;
};

/**
 * Dérive `profil.comptes` d'un relevé collé et du grand livre.
 *
 * Rend une liste VIDE, et le déclare, quand le collage couvre plusieurs
 * clients : le suffixe « A » de deux clients y fusionnerait en un compte
 * fantôme dont chaque ligne a l'air juste et dont le total est faux.
 */
export function deriverComptes(
  texteReleve: string,
  livre: LigneTransaction[],
  options: { dateReleve: string | null; resolus?: CompteResolu[] } = { dateReleve: null }
): ResultatComptes {
  const lu = parserPositions(texteReleve);
  if (lu.blocs > 0) {
    return { comptes: [], aTrancher: [], ignorees: lu.ignorees, multiClients: true };
  }

  const index = indexerComptesDuLivre(livre);
  const resolus = options.resolus ?? [];
  const detailles = new Map<string, Candidat[]>();

  const groupes = grouperParCompte(lu.positions, (suffixe) => {
    const v = jointureDuSuffixe(suffixe, index, resolus);
    detailles.set(suffixe, v.candidatsDetailles);
    return { numero: v.numero, provenance: v.provenance, candidats: v.candidats };
  });

  const encaisseParSuffixe = new Map<string, Array<{ devise: string; montant: number }>>();
  for (const e of lu.encaisses) {
    const cle = canoniserCompte(e.suffixeCompte);
    if (!cle) continue;
    if (!encaisseParSuffixe.has(cle)) encaisseParSuffixe.set(cle, []);
    encaisseParSuffixe.get(cle)!.push({ devise: e.devise, montant: e.montant });
  }

  const comptes: Compte[] = groupes.map((g) => {
    const tranche = resolus.find((r) => canoniserCompte(r.suffixe) === g.suffixe);
    return {
      numero: g.numero,
      suffixe: g.suffixe,
      provenanceNumero: (tranche?.numero ? 'confirme' : g.provenance) as ProvenanceNumero,
      candidats: g.candidats,
      type: regimeDuCompte(g.numero),
      titulaire: tranche?.titulaire ?? null,
      dateReleve: options.dateReleve,
      positions: g.positions.map(
        (p): Position => ({
          symbole: p.symbole,
          devise: p.devise,
          // AUCUNE COLONNE DU RELEVÉ NE PORTE LA CATÉGORIE. Ne jamais la
          // fabriquer depuis typeInstrument + devise : un FNB coté en CAD peut
          // détenir des actions américaines, et « Action » + « CAD » ne fait
          // pas « actions-ca ». Ce serait un conseil de localisation d'actifs
          // fondé sur une invention.
          categorie: null,
          valeurMarchande: p.valeurMarchande,
          valeurComptable: p.coutTotal,
          revenuAnnuel: p.revenuAnnuel,
        })
      ),
      encaisse: encaisseParSuffixe.get(g.suffixe) ?? [],
    };
  });

  // Les comptes d'encaisse SEULE existent : une marge débitrice, un compte
  // vidé. Sans cette passe, la dette disparaîtrait du profil.
  for (const [suffixe, encaisse] of encaisseParSuffixe) {
    if (comptes.some((c) => c.suffixe === suffixe)) continue;
    const v = jointureDuSuffixe(suffixe, index, resolus);
    comptes.push({
      numero: v.numero, suffixe, provenanceNumero: v.provenance as ProvenanceNumero,
      candidats: v.candidats, type: regimeDuCompte(v.numero), titulaire: null,
      dateReleve: options.dateReleve, positions: [], encaisse,
    });
    detailles.set(suffixe, v.candidatsDetailles);
  }

  comptes.sort((a, b) => a.suffixe.localeCompare(b.suffixe));

  return {
    comptes,
    aTrancher: comptes
      .filter((c) => c.provenanceNumero === 'ambigu')
      .map((c) => ({ suffixe: c.suffixe, candidats: detailles.get(c.suffixe) ?? [] })),
    ignorees: lu.ignorees,
    multiClients: false,
  };
}
