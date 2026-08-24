// LES TITRES CLIENTS DES STRATÉGIES QUI ONT UNE PAGE DÉDIÉE.
//
// ─────────────────────────────────────────────────────────────────────────────
// POURQUOI CE FICHIER EXISTE : PARCE QUE LE DOCUMENT PORTAIT DEUX NOMS.
//
// La carte de synthèse affiche `constat.titreClient`. La page en cinq étapes
// affiche `entete.titre`, déclaré dans son propre module. Tant que les deux
// vivaient chacun de leur côté, rien n'obligeait à les faire coïncider — et ils
// ne coïncidaient pas : la carte annonçait « Récolter des gains sans payer
// d'impôt », puis renvoyait à une page intitulée « Cristallisation de gains ».
// Le lecteur devait deviner que les deux noms désignaient la même chose, et le
// second était du vocabulaire de métier dans un document remis au client.
//
// ⚠ CE N'EST PAS UNE FACTORISATION DE CONFORT. Deux littéraux égaux se
// désynchronisent à la première retouche, sans qu'aucun test ne rougisse. Un
// seul identifiant, lu des deux côtés, rend la coïncidence structurelle : elle
// ne peut plus être vraie « pour l'instant ».
//
// ─────────────────────────────────────────────────────────────────────────────
// MÉTIER ET CLIENT SONT DEUX CHOSES, ET LES DEUX RESTENT.
//
// `Constat.titre`       — le nom du catalogue, celui de l'écran de sélection et
//                         des discussions internes. « Cristallisation de gains ».
// `Constat.titreClient` — ce que la stratégie change pour la personne. C'est le
//                         seul des deux qui atteint un document remis.
//
// Seuls les titres CLIENTS vivent ici : ce sont eux que deux surfaces doivent
// afficher à l'identique. Les noms de métier restent auprès de leur stratégie.
//
// ─────────────────────────────────────────────────────────────────────────────
// LE CAS DES GAINS — décision de Nicolas, 24 août 2026.
//
// « Récolter des gains sans payer d'impôt » est écarté : la formulation est
// TROP ABSOLUE. Le moteur ne démontre pas l'absence d'impôt, il démontre qu'un
// gain peut être absorbé par des pertes déjà disponibles — et sur le cas de
// référence il reste même de la capacité inutilisée. La page refusait déjà de
// reprendre cette promesse (batterie PG2) ; la carte, elle, la portait. Le
// désaccord est réglé À LA SOURCE plutôt que rattrapé au rendu.
// ─────────────────────────────────────────────────────────────────────────────

/** Ce que la cristallisation de pertes change pour la personne. */
export const TITRE_CLIENT_CRISTALLISATION_PERTES =
  'Réduire l’impôt sur vos gains de l’année';

/**
 * Ce que la cristallisation de gains change pour la personne.
 *
 * ⚠ ELLE NE PROMET RIEN QUE LE MOTEUR NE DÉMONTRE. Elle nomme le geste — vendre
 * en s'appuyant sur des pertes déjà au dossier — et non son résultat fiscal.
 */
export const TITRE_CLIENT_CRISTALLISATION_GAINS =
  'Réaliser des gains en utilisant vos pertes fiscales disponibles';
