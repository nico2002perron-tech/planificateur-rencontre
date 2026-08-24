// CE QUE L'IMPORT DIT AU PLANIFICATEUR.
//
// ─────────────────────────────────────────────────────────────────────────────
// POURQUOI CE MODULE EST SÉPARÉ DE L'ÉCRAN.
//
// Le parseur devient strict par doctrine : il refuse plutôt que de deviner.
// C'est juste, mais un refus MUET est un piège — le planificateur lisait
// « 0 transaction » sans savoir quoi corriger. La même famille de défaut a
// déjà été rencontrée le 17 août 2026 ; elle revient dès qu'un diagnostic
// existe côté moteur sans avoir de chemin vers l'écran.
//
// Les phrases vivent donc ici, dans un module PUR : elles se testent sans
// rendre un composant, et l'écran n'a plus qu'à choisir une couleur.
//
// ⚠ TROIS NIVEAUX, ET ILS NE SE CONFONDENT JAMAIS :
//   succes        le fichier est passé, tout est lu ;
//   avertissement le fichier est passé, mais des lignes ont été EXCLUES ;
//   erreur        le fichier est REFUSÉ — rien n'a été importé.
//
// ⚠ UN FICHIER REFUSÉ N'EST JAMAIS « un import réussi à 0 transaction », et un
// fichier partiellement lu n'est jamais un refus complet.
// ─────────────────────────────────────────────────────────────────────────────
import type { ChampHistorique } from './colonnes-historique';

export type NiveauImport = 'succes' | 'avertissement' | 'erreur';

export type MessageImport = {
  niveau: NiveauImport;
  titre: string;
  /** Les lignes du corps, dans l'ordre. Jamais de code interne en tête. */
  details: string[];
};

/** Ce que l'écran reçoit de la route — la forme minimale dont il a besoin. */
export type ResumeImportUI = {
  nouvelles: number;
  doublons: number;
  ignorees: number;
  incoherentes: number;
  rejet: { motif: string; colonnes: string[] } | null;
};

/**
 * LE NOM LISIBLE D'UNE COLONNE — celui du fichier, pas celui du code.
 *
 * ⚠ « gainsPertes » NE DOIT PAS ATTEINDRE L'ÉCRAN. Le planificateur cherche
 * « Gains/Pertes » dans son export Croesus ; lui montrer l'identifiant interne
 * l'obligerait à traduire, et c'est notre travail.
 */
export function nomLisibleColonne(champ: string): string {
  return NOM_AFFICHE[champ] ?? champ;
}

/**
 * LE TITRE EXACT, TEL QU'IL APPARAÎT DANS L'EXPORT.
 *
 * ⚠ DÉCLARÉ, PAS CALCULÉ. Une première version recapitalisait l'alias
 * normalisé — elle rendait « Gains/pertes » puis, une fois corrigée,
 * « No de Compte ». Or Croesus écrit « Gains/Pertes » et « No de compte » :
 * aucune règle de capitalisation ne produit les deux. Le planificateur doit
 * pouvoir chercher la chaîne à l'écran dans son fichier ; on la déclare.
 */
const NOM_AFFICHE: Record<string, string> = {
  indVM: 'Ind. VM',
  description: 'Description',
  nom: 'Nom',
  note: 'Note',
  dateReglement: 'Traitement',
  date: 'Transaction',
  codeCp: 'Code de CP',
  type: 'Type',
  symbole: 'Symbole',
  quantite: 'Quantité',
  prix: 'Prix',
  devise: 'Devise',
  total: 'Total',
  commission: 'Commission',
  gainsPertes: 'Gains/Pertes',
  intCourus: 'Int. courus',
  frais: 'Frais',
  pbrManuel: 'PBR manuel',
  solde: 'Solde',
  noCompte: 'No de compte',
};

const pluriel = (n: number) => (n > 1 ? 's' : '');

export function messageImport(r: ResumeImportUI): MessageImport {
  // ── ERREUR — le fichier est refusé ───────────────────────────────────────
  if (r.rejet) {
    const colonnes = r.rejet.colonnes.map(nomLisibleColonne).join(', ');
    return {
      niveau: 'erreur',
      titre: 'Import impossible',
      details: [
        `Certaines colonnes nécessaires sont absentes du fichier : ${colonnes}.`,
        'Vérifiez l’export Croesus puis réessayez.',
      ],
    };
  }

  const details: string[] = [];
  details.push(
    `${r.nouvelles} transaction${pluriel(r.nouvelles)} importée${pluriel(r.nouvelles)}.`
  );
  if (r.doublons > 0) {
    details.push(`${r.doublons} déjà présente${pluriel(r.doublons)} au grand livre.`);
  }

  // ── AVERTISSEMENT — des lignes ont été EXCLUES ───────────────────────────
  if (r.incoherentes > 0) {
    return {
      niveau: 'avertissement',
      titre: `${r.incoherentes} ligne${pluriel(r.incoherentes)} n’a pas pu être lue`,
      details: [
        ...details,
        // ⚠ NE JAMAIS LAISSER CROIRE QU'ELLES ONT ÉTÉ RÉPARÉES.
        `Ces lignes ne correspondaient pas aux colonnes du fichier et ont été `
        + `exclues plutôt que corrigées automatiquement.`,
      ],
    };
  }

  // ── SUCCÈS ───────────────────────────────────────────────────────────────
  // ⚠ LES LIGNES « IGNORÉES » NE SONT PAS DES ERREURS. Ce sont les lignes sans
  // date ni numéro de compte : totaux, sous-totaux, séparateurs — le décor
  // ordinaire d'un export. Les peindre en rouge ferait chercher une panne qui
  // n'existe pas. On les mentionne d'une phrase, en dernier, et seulement
  // quand il y en a.
  if (r.ignorees > 0) {
    details.push(
      `${r.ignorees} ligne${pluriel(r.ignorees)} non transactionnelle${pluriel(r.ignorees)} `
      + `(totaux, séparateurs) ignorée${pluriel(r.ignorees)}.`
    );
  }

  return {
    niveau: 'succes',
    titre: `${r.nouvelles} transaction${pluriel(r.nouvelles)} ajoutée${pluriel(r.nouvelles)} au grand livre`,
    details,
  };
}

/** Le type des colonnes, exporté pour que l'appelant reste typé. */
export type { ChampHistorique };
