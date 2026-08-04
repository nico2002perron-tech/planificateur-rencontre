// Constantes globales de l'outil d'analyse de portefeuille.
// (URL, courriels, limites de saisie — aucun seuil de calcul ici : voir seuils.ts.)

/** Nombre maximum de positions saisissables dans le formulaire public. */
export const LIMITE_POSITIONS = 30;

/** Adresse publique de l'outil (branchée au site statique via CNAME). */
export const URL_PUBLIQUE = "https://analyse.groupefinancierstefoy.com";

/** Destinataire interne des notifications de nouvelle analyse transmise. */
export const COURRIEL_NOTIFICATION = "nicolas.perron@iagestionprivee.ca";
