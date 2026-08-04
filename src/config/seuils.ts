// TOUS les seuils du moteur, au même endroit : la source unique de vérité.
// Aucune valeur « magique » ne doit vivre en dur dans un axe — tout passe par ici.
// Les commentaires expliquent le « pourquoi » de chaque borne (on relira ça plus tard).

export const SEUILS = {
  // ── Frais ──────────────────────────────────────────────────────────
  /** RFG pondéré au-delà duquel on considère les frais « élevés ». */
  rfgEleve: 0.018,
  /** Borne basse de l'échelle de score (0,5 % ≈ FNB indiciel très bon marché). */
  rfgExcellent: 0.005,
  /** Borne haute de l'échelle de score (2,5 % ≈ fonds commun cher). */
  rfgMauvais: 0.025,

  // ── Projection des frais ───────────────────────────────────────────
  /** Horizons de la projection composée (années). */
  horizonsProjection: [10, 15, 25] as const,
  /**
   * Rendement brut annuel HYPOTHÉTIQUE utilisé pour illustrer le coût composé
   * des frais. C'est une hypothèse, divulguée telle quelle dans le rapport ;
   * elle ne présume d'aucun rendement réel.
   */
  tauxRendementHypothetique: 0.06,

  // ── Concentration ──────────────────────────────────────────────────
  // Au Sprint 1 on mesure la concentration au niveau des PRODUITS (fonds).
  // L'analyse des titres sous-jacents (look-through) arrive au Sprint 2.
  /** Part au-delà de laquelle un seul produit est signalé comme prépondérant. */
  produitImportant: 0.40,
  /** Part d'un secteur au-delà de laquelle il est signalé (si la donnée existe). */
  concentrationSecteur: 0.30,
  // Paliers Herfindahl (alignés sur portfolio/statistics.ts, exposés en donnée d'appoint).
  hhiFaible: 1000,
  hhiModere: 1800,
  hhiEleve: 2500,

  // ── Géographie ─────────────────────────────────────────────────────
  /** Poids approximatif du Canada dans l'indice mondial MSCI ACWI (~3 %). */
  poidsCanadaACWI: 0.03,
  /** Écart au-dessus du poids ACWI à partir duquel le biais domestique est « marqué ». */
  biaisDomestiqueNotable: 0.15,

  // ── Chevauchement (look-through des titres, Sprint 2) ──────────────
  // Poids look-through = part du portefeuille TOTAL, calculée sur les principaux
  // titres connus de chaque fonds (top_holdings). C'est une BORNE INFÉRIEURE :
  // les titres hors top-10 et les fonds non détaillés ne peuvent que l'augmenter.
  // On ne sur-signale donc jamais — les constats disent « au moins ».
  /** Recoupement cumulé (titres détenus via ≥2 fonds) au-delà duquel c'est « notable ». */
  chevauchementNotable: 0.15,
  /** Recoupement cumulé au-delà duquel c'est « élevé ». */
  chevauchementEleve: 0.30,
  /** Plafond de l'échelle de score : à ce recoupement, le score tombe à 0. */
  chevauchementPlafond: 0.40,
} as const;
