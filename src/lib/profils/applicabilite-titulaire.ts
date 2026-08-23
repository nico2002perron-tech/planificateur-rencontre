// À QUEL TYPE DE CONTRIBUABLE UNE STRATÉGIE S'APPLIQUE-T-ELLE ?
//
// ─────────────────────────────────────────────────────────────────────────────
// UNE SEULE FRONTIÈRE, PAS QUINZE `if (entreprise)`.
//
// La tentation, en ajoutant les dossiers d'entreprise, est de glisser un test
// au début de chaque stratégie. Au bout de trois stratégies on ne sait plus
// lesquelles ont été traitées ; au bout de huit, on en oublie une — et celle-là
// recommandera un CELI à une société de gestion.
//
// La frontière est donc une MATRICE, appliquée à un seul endroit : la sortie de
// `analyser()`. Chaque stratégie du catalogue y figure explicitement, et un
// test refuse qu'une clé manque. Ajouter une stratégie sans se poser la
// question devient impossible.
//
// ─────────────────────────────────────────────────────────────────────────────
// CE QUE CE MODULE NE FAIT PAS.
//
// ⚠ IL NE DEVINE RIEN. Le type d'entité est DÉCLARÉ au profil. Ni « INC. », ni
// « LTÉE », ni « Gestion », ni « Holding », ni le suffixe d'un compte n'entrent
// ici — se tromper d'entité fiscale n'est pas une imprécision, c'est
// recommander à un contribuable les stratégies d'un autre.
//
// ⚠ IL NE JUGE PAS DES STRATÉGIES CORPORATIVES. Ce lot pose la bifurcation ;
// il ne prétend pas savoir ce qu'une société devrait faire. Une stratégie
// applicable à une entreprise passe simplement inchangée — ce qui ne veut pas
// dire qu'elle a été VALIDÉE pour ce contribuable, seulement qu'elle ne repose
// pas sur un régime réservé aux particuliers.
// ─────────────────────────────────────────────────────────────────────────────
import type { TypeTitulaire } from './types';

/** Le motif, en vocabulaire de machine — la prose vient de la présentation. */
export const RAISON_TITULAIRE_ENTREPRISE = 'titulaire-entreprise';

/**
 * LA MATRICE.
 *
 * `true` = la stratégie garde son verdict ; `false` = elle sort
 * `non-applicable`, sans montant, sans quantité, sans recommandation ferme.
 *
 * ⚠ CHAQUE ENTRÉE PORTE SA RAISON D'ÊTRE. « Non applicable » à une société,
 * ici, veut dire : la stratégie repose sur un RÉGIME que seule une personne
 * physique peut détenir. Ce n'est pas un jugement sur l'opportunité fiscale.
 */
const APPLICABLE_A_UNE_ENTREPRISE: Record<string, boolean> = {
  // Un gain et une perte en capital existent aussi dans une société : les
  // apparier reste pertinent. Le moteur ne fait ici aucune hypothèse de taux.
  'cristallisation-pertes': true,
  'cristallisation-gains': true,
  // Le don de titres à gain latent existe pour une société comme pour une
  // personne. Le reçu et son traitement diffèrent — ce module ne les chiffre pas.
  'don-titres': true,
  // Ordonner les ventes pour reporter l'impôt ne dépend d'aucun régime enregistré.
  'ordre-vente': true,

  // ── CE QUI EXIGE UNE PERSONNE PHYSIQUE ───────────────────────────────────
  // CELI et REER sont des régimes de particuliers : une société ne peut ni en
  // détenir ni en cotiser.
  'droits-cotisation': false,
  // Le CELI du conjoint suppose un conjoint — une société n'en a pas.
  'celi-conjoint': false,
  // Le REEE et ses subventions supposent un souscripteur particulier et un
  // bénéficiaire enfant.
  'subvention-reee': false,
  // La localisation d'actifs arbitre entre comptes enregistrés et non
  // enregistrés. Sans régime enregistré, l'arbitrage n'existe pas.
  'localisation-actifs': false,
};

/** Les clés couvertes — un test exige qu'elles couvrent tout le catalogue. */
export const STRATEGIES_QUALIFIEES = Object.keys(APPLICABLE_A_UNE_ENTREPRISE);

/**
 * LA QUESTION, POSÉE UNE FOIS.
 *
 * ⚠ UNE STRATÉGIE INCONNUE EST APPLICABLE. Le défaut sûr n'est pas de bloquer :
 * une stratégie neuve qu'on aurait oublié d'inscrire disparaîtrait alors
 * silencieusement des dossiers d'entreprise — exactement le silence que ce
 * module existe pour empêcher. C'est le test de couverture qui attrape l'oubli,
 * au moment du développement, pas le rendu au moment de la rencontre.
 */
export function strategieApplicableA(strategie: string, titulaire: TypeTitulaire): boolean {
  if (titulaire === 'particulier') return true;
  return APPLICABLE_A_UNE_ENTREPRISE[strategie] ?? true;
}
