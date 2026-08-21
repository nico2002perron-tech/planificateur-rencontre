// LE GARDE-FOU DE LA CRISTALLISATION DE PERTES — une seule question, un seul endroit.
//
// ─────────────────────────────────────────────────────────────────────────────
// POURQUOI UN FICHIER SÉPARÉ DE CELUI DES GAINS.
//
// `completude-cristallisation.ts` sert la stratégie de gains, GELÉE le 21 août
// 2026. Ses primitives — `qualifierPosition`, `biensIdentiquesMultiComptes`,
// `pertesReporteesUtilisables` — sont réutilisées ici telles quelles, sans une
// ligne modifiée. Ce module ne fait que les composer autrement.
//
// CE QUI DIFFÈRE, ET CE N'EST PAS UN DÉTAIL : la cristallisation de gains
// propose de RÉALISER UN GAIN à impôt nul. Celle-ci propose de VENDRE À PERTE —
// c'est-à-dire exactement l'acte que vise la règle de la perte apparente. Les
// mêmes données manquantes n'ont donc pas le même poids : ici, un bien
// identique détenu dans un second compte n'est pas une imprécision de prix de
// base, c'est le cas d'école d'une perte que le fisc refusera.
//
// L'AUDIT DU 21 AOÛT a mesuré ce que l'absence de ce garde coûtait, sur des
// dossiers fictifs passés au moteur :
//   · une position en dollars AMÉRICAINS sortait « calculé, 10 000 $ » — un
//     montant américain présenté en dollars canadiens ;
//   · un portefeuille où le même titre était détenu dans DEUX comptes non
//     enregistrés sortait « calculé, 16 000 $ » : une perte apparente
//     recommandée fermement ;
//   · une position sans valeur marchande disparaissait SANS TRACE — ni dans le
//     motif, ni dans les données manquantes ;
//   · `calcule` sortait avec des données manquantes non vides.
// ─────────────────────────────────────────────────────────────────────────────
import {
  qualifierPosition, biensIdentiquesMultiComptes, positionsNonEnregistrees,
  pertesReporteesUtilisables,
  type QualitePosition, type PositionSituee,
} from './completude-cristallisation';
import type { ProfilClient } from './types';

export type RaisonBlocagePertes =
  | 'positions-sans-pbr'
  | 'positions-sans-valeur-marchande'
  | 'devise-etrangere-non-convertie'
  | 'bien-identique-perte-apparente-a-confirmer'
  | 'perte-courante-a-valider-perte-apparente'
  | 'regime-de-compte-non-prouve'
  | 'dispositions-regime-indetermine'
  | 'portee-externe-non-confirmee';

export type CompletudePertes = {
  qualites: QualitePosition[];
  /** Les positions EN PERTE dont le montant est chiffrable en dollars canadiens. */
  candidatesFiables: QualitePosition[];
  blocages: RaisonBlocagePertes[];
  explications: string[];
  donneesManquantes: string[];
  dateReleve: string | null;
  peutEtreFerme: boolean;
  /** Décomptes, pour que la prose puisse dire combien sans recompter. */
  sansPbr: number;
  sansValeurMarchande: number;
  deviseNonResolue: number;
};

/** La perte latente d'une position, en dollars canadiens — ou `null`. */
export function perteLatenteCad(q: QualitePosition): number | null {
  if (q.gainLatentCad === null || q.gainLatentCad >= 0) return null;
  return Math.abs(q.gainLatentCad);
}

/**
 * LA VÉRIFICATION UNIQUE — appelée avant tout chiffre ferme.
 *
 * `pertesReporteesMentionnees` : la stratégie s'apprête-t-elle à parler du
 * champ saisi ? Elle n'entre dans aucun calcul ici (la perte à cristalliser
 * dépend des gains de l'année, pas des reports), mais la PROSE affirmait
 * « à cela s'ajoutent X $ » sans regarder l'unité — une additivité affirmée
 * que la donnée ne garantit pas.
 */
export function verifierCompletudeCristallisationPertes(
  profil: ProfilClient
): CompletudePertes {
  const positions = positionsNonEnregistrees(profil);
  const qualites = positions.map(qualifierPosition);

  const blocages: RaisonBlocagePertes[] = [];
  const explications: string[] = [];
  const donneesManquantes: string[] = [];
  const ajouter = (b: RaisonBlocagePertes, phrase: string, manque?: string) => {
    blocages.push(b);
    explications.push(phrase);
    if (manque) donneesManquantes.push(manque);
  };

  // ── LES POSITIONS, DIMENSION PAR DIMENSION ────────────────────────────────
  // ⚠ TROIS COMPTEURS SÉPARÉS, et c'est le correctif du 21 août. L'ancien code
  // ne comptait que les PBR manquants : une position sans VALEUR MARCHANDE
  // était écartée du calcul et n'apparaissait NULLE PART — ni motif, ni donnée
  // manquante. Elle disparaissait, et le dossier sortait « calculé ».
  const sansPbr = qualites.filter((q) => !q.pbrFiable).length;
  const sansValeurMarchande = qualites.filter((q) => q.pbrFiable && !q.vmFiable).length;
  const deviseNonResolue = qualites.filter(
    (q) => q.pbrFiable && q.vmFiable && !q.valeursExprimeesEnCad
  ).length;

  if (sansPbr > 0) {
    ajouter('positions-sans-pbr',
      `Le prix de base rajusté manque sur ${sansPbr} position${sansPbr > 1 ? 's' : ''} non enregistrée${sansPbr > 1 ? 's' : ''} : leur perte latente est inconnue, pas nulle.`,
      'le prix de base rajusté des positions non enregistrées qui en manquent');
  }
  if (sansValeurMarchande > 0) {
    ajouter('positions-sans-valeur-marchande',
      `La valeur marchande manque sur ${sansValeurMarchande} position${sansValeurMarchande > 1 ? 's' : ''} : sans elle, la perte latente ne se calcule pas.`,
      'la valeur marchande des positions qui en manquent');
  }
  if (deviseNonResolue > 0) {
    // C'EST LE DÉFAUT LE PLUS COÛTEUX DE L'AUDIT : 10 000 USD de perte
    // sortaient en « 10 000 $ » canadiens. L'impôt se déclare en dollars
    // canadiens, et le relevé ne fournit pas la conversion.
    ajouter('devise-etrangere-non-convertie',
      `${deviseNonResolue} position${deviseNonResolue > 1 ? 's sont détenues' : ' est détenue'} en devise étrangère. Le relevé ne fournit pas leur valeur en dollars canadiens, et l’impôt se déclare en dollars canadiens : leur perte n’est pas chiffrable ici.`,
      'la valeur en dollars canadiens des positions en devise étrangère');
  }

  // ── LA PERTE APPARENTE — le garde central de CETTE stratégie ──────────────
  //
  // La règle ne se résume pas à « ne pas racheter dans les 30 jours ». Une
  // perte est refusée si le même bien — ou un bien identique — est acquis par
  // le contribuable OU UNE PERSONNE AFFILIÉE dans la fenêtre qui commence
  // 30 jours avant et finit 30 jours après la disposition, et qu'il est encore
  // détenu à la fin de cette fenêtre.
  //
  // CE QUE LE MOTEUR VOIT : le même titre détenu dans un autre de NOS comptes
  // non enregistrés, et le rachat déjà visible au livre.
  // CE QU'IL NE VOIT PAS : le conjoint, une société contrôlée, une fiducie, un
  // compte détenu ailleurs. C'est une question de PORTÉE, traitée plus bas —
  // et l'absence de rachat visible n'est jamais une preuve d'absence.
  const biens = biensIdentiquesMultiComptes(positions);
  if (biens.length > 0) {
    ajouter('bien-identique-perte-apparente-a-confirmer',
      `${biens.length} titre${biens.length > 1 ? 's sont détenus' : ' est détenu'} dans plusieurs comptes non enregistrés. Vendre à perte dans l’un pendant qu’il reste détenu dans l’autre place l’opération dans le champ de la perte apparente : la perte serait refusée et ajoutée au prix de base du bien conservé.`,
      'la marche à suivre pour les titres détenus dans plusieurs comptes (règle de la perte apparente)');
  }
  if (profil.transactionsAnnee.pertesCourantesAValiderPerteApparente) {
    ajouter('perte-courante-a-valider-perte-apparente',
      'Une perte déjà réalisée cette année pourrait être refusée par la règle de la perte apparente : le même bien a été racheté dans la fenêtre de trente jours. Tant que ce point n’est pas tranché, le gain net qui reste à absorber n’est pas établi.',
      'la confirmation qu’aucune perte déjà réalisée cette année n’est une perte apparente');
  }

  // ── LE RÉGIME ─────────────────────────────────────────────────────────────
  const regimesNonProuves = profil.comptes.filter((c) => c.type === null).length;
  if (regimesNonProuves > 0) {
    ajouter('regime-de-compte-non-prouve',
      `${regimesNonProuves} compte${regimesNonProuves > 1 ? 's ont' : ' a'} un régime non prouvé. Un compte dont le régime est inconnu est écarté plutôt que présumé imposable — vendre à perte dans un CELI détruirait un droit de cotisation sans produire aucune déduction.`,
      'le régime des comptes non identifiés');
  }
  const indetermine = profil.transactionsAnnee.dispositionsRegimeIndetermine;
  if (indetermine.nombre > 0) {
    ajouter('dispositions-regime-indetermine',
      `${indetermine.nombre} disposition${indetermine.nombre > 1 ? 's' : ''} de l’année ${indetermine.nombre > 1 ? 'proviennent' : 'provient'} d’un compte au régime non prouvé : ${indetermine.nombre > 1 ? 'elles pourraient' : 'elle pourrait'} changer le gain net à absorber.`,
      'le régime des comptes dont proviennent les dispositions non identifiées');
  }

  // ── LA PORTÉE EXTERNE ─────────────────────────────────────────────────────
  // Elle bloque parce qu'elle peut changer le chiffre ET la légalité du geste :
  // un même titre racheté dans un compte détenu ailleurs, ou par le conjoint,
  // déclenche la même règle sans que nous puissions le voir.
  if (profil.consolidation.comptesExternes !== 'non') {
    ajouter('portee-externe-non-confirmee',
      'Le client n’a pas confirmé n’avoir aucun compte ailleurs. Un même titre racheté dans un compte détenu ailleurs — ou par une personne affiliée — déclencherait la règle de la perte apparente sans que nous puissions le voir.',
      'la liste des positions détenues ailleurs qu’ici');
  }

  const candidatesFiables = qualites.filter((q) => perteLatenteCad(q) !== null);
  const dateReleve = positions[0]?.compte.dateReleve ?? profil.comptes[0]?.dateReleve ?? null;

  return {
    qualites, candidatesFiables, blocages, explications, donneesManquantes,
    dateReleve, peutEtreFerme: blocages.length === 0,
    sansPbr, sansValeurMarchande, deviseNonResolue,
  };
}

/**
 * LE MONTANT REPORTÉ DONT ON PEUT PARLER COMME D'UNE CAPACITÉ.
 *
 * ⚠ CE N'EST PAS UN CALCUL. La perte à cristalliser dépend des gains de
 * l'année, pas des reports. Mais la prose affirmait « À cela s’ajoutent X $ de
 * pertes en capital déjà reportées » sans regarder l'unité du champ saisi —
 * une ADDITIVITÉ AFFIRMÉE que la donnée ne garantit pas, et qui sortait sous
 * statut `calcule`, donc hors de portée du filtre du document.
 *
 * `null` = on peut mentionner que le dossier porte un montant, jamais dire
 * qu'il s'ajoute.
 */
export function reporteesMentionnablesCommeCapacite(profil: ProfilClient): number | null {
  const utilisable = pertesReporteesUtilisables(profil.droits.pertesCapitalReportees);
  return utilisable > 0 ? utilisable : null;
}

export type { PositionSituee };
