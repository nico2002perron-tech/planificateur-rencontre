// LES 5 STRATÉGIES FISCALES — le contrat de la section 5 du schéma.
//
// TypeScript pur : aucun import Next.js, React, Supabase ni accès disque. On
// reçoit un profil, on rend des constats. Testable en isolation, et surtout
// AUDITABLE : un fiscaliste doit pouvoir lire ce fichier et vérifier chaque
// règle sans exécuter quoi que ce soit.
//
// ─────────────────────────────────────────────────────────────────────────────
// LE MODÈLE EST `calculerDroitsCeli` — un montant N'APPARAÎT QUE si toutes ses
// conditions tiennent ; sinon on rend une borne, ou `indisponible` avec la
// liste de ce qui manque. Un droit surestimé coûte au client 1 % de pénalité
// par mois ; une donnée manquante déclarée coûte une question de plus.
//
// RÈGLE TRANSVERSALE DE SÉCURITÉ (section 3 du schéma) : aucune stratégie ne
// recommande un montant de cotisation précis quand les droits sont inconnus ou
// que `comptesExternes ≠ non`. Le constat sort en `montant-a-confirmer`.
//
// ─────────────────────────────────────────────────────────────────────────────
// CE MODULE ALIMENTE LE PDF, JAMAIS LE RAPPORT VIVANT HTML.
//
// Décision de Nicolas, 5 août 2026. Le « Rapport vivant » (src/lib/film/)
// partage le pipeline de données du PDF de cours cibles, et le code dit
// pourquoi : « sinon les deux formats raconteraient deux histoires
// différentes au même client ». On accepte ici une divergence ASSUMÉE : le
// rapport vivant circule, cette section ne doit pas circuler avant l'avis du
// fiscaliste. Ne pas « réparer » cette divergence sans le lui demander.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ProfilClient, StatutConstat, Portee, Compte, Position,
} from './types';

/** Un constat, tel que le contrat du schéma le définit. */
export type Constat = {
  /** Identifiant stable du catalogue — sert de clé, jamais affiché tel quel. */
  strategie: string;
  /** Le titre INTERNE — celui de l'ecran de selection et du catalogue. */
  titre: string;
  /**
   * LE MEME CONSTAT, DIT AU CLIENT.
   *
   * « Cristallisation de pertes » est du vocabulaire de metier ; personne ne se
   * reconnait dedans. Le PDF porte celui-ci, l'ecran garde l'autre : le
   * planificateur cherche une strategie qu'il connait par son nom technique, le
   * client lit ce que ca change pour lui.
   */
  titreClient: string;
  statut: StatutConstat;
  portee: Portee;
  /** `null` sauf si `statut === 'calcule'`. Jamais un chiffre « à peu près ». */
  montantEstime: number | null;
  /**
   * CE QUE LE MONTANT EST — et la raison pour laquelle ces montants NE
   * S'ADDITIONNENT PAS.
   *
   * Défaut trouvé au premier rendu de la page, le 5 août 2026 : un bandeau
   * affichait la somme des cinq montants, soit 69 871 $. Or il additionnait
   * une perte à cristalliser (18 000 $), des DROITS de cotisation du conjoint
   * (48 000 $) et un gain mis à l'abri (3 871 $). Trois natures, trois unités,
   * et surtout : des droits de cotisation ne sont pas une économie. Le total
   * était un chiffre impressionnant qui ne voulait rien dire.
   *
   * Ce champ force chaque montant à dire ce qu'il est, et interdit de les
   * sommer sans y penser.
   */
  libelleMontant: string;
  recurrence: 'annuel' | 'unique';
  /**
   * Rédigée à partir des chiffres du moteur — JAMAIS l'inverse.
   * Le schéma prévoit qu'un LLM puisse la reformuler plus tard ; il partira
   * toujours des nombres calculés ici, il n'en inventera aucun.
   */
  explication: string;
  donneesManquantes: string[];
  sources: string[];
  /**
   * CE QUE LE MANQUE DE VISIBILITE COUTE A CE CONSTAT — une phrase, pas un
   * paragraphe.
   *
   * `null` quand la visibilite est complete. C'est la matiere de l'angle mort :
   * la premiere version y recopiait l'explication entiere de chaque constat,
   * ce qui donnait un bloc de six lignes qui repetait la page. Le schema
   * demande le contraire — une limitation nommee, courte, et la liste EST
   * l'argument.
   */
  limiteVisibilite: string | null;
};

export type AngleMort = {
  constatsLimites: number;
  total: number;
  details: string[];
} | null;

export type ResultatAnalyse = {
  date: string;
  constats: Constat[];
  angleMort: AngleMort;
  questionsRencontre: string[];
  /**
   * ⚠ VERROU DU FISCALISTE — section 6 du schéma.
   *
   * Tant que ce drapeau est vrai, la section PDF porte une mention visible et
   * ne doit pas être remise au client. Le lever se fait EN UNE LIGNE ici, le
   * jour où le fiscaliste a revu les barèmes et les règles.
   */
  revisionFiscalisteRequise: boolean;
};

/** Le portefeuille cible du planificateur — pas encore construit (stratégie 5). */
export type PortefeuilleCible = {
  positions: Array<{ symbole: string; poidsCible: number }>;
};

const argent = (n: number) => `${Math.round(n).toLocaleString('fr-CA')} $`;
/** Le « s » du pluriel — un document remis au client n'ecrit pas « 1 position(s) ». */
const pl = (n: number) => (n > 1 ? 's' : '');

// ─────────────────────────────────────────────────────────────────────────────
// CE QU'ON SAIT DU PORTEFEUILLE, avant de juger quoi que ce soit
// ─────────────────────────────────────────────────────────────────────────────

type PositionSituee = Position & { compte: Compte };

/**
 * Les positions NON ENREGISTRÉES, seules concernées par les gains et pertes.
 *
 * Un compte dont le régime est `null` est EXCLU, pas présumé non enregistré :
 * conseiller de vendre à perte dans un CELI serait détruire un droit de
 * cotisation pour une déduction qui n'existe pas.
 */
function positionsNonEnregistrees(profil: ProfilClient): PositionSituee[] {
  const dedans: PositionSituee[] = [];
  for (const c of profil.comptes) {
    if (c.type !== 'non-enregistre' && c.type !== 'corpo') continue;
    for (const p of c.positions) dedans.push({ ...p, compte: c });
  }
  return dedans;
}

/** Le gain (positif) ou la perte (négative) latente d'une position, ou `null`. */
function gainLatent(p: Position): number | null {
  if (p.valeurMarchande === null || p.valeurComptable === null) return null;
  return p.valeurMarchande - p.valeurComptable;
}

/** Combien de positions non enregistrées n'ont pas de PBR — le motif d'`indisponible`. */
function sansPbr(positions: PositionSituee[]): number {
  return positions.filter((p) => p.valeurComptable === null).length;
}

/** La visibilité est-elle entamée par des comptes détenus ailleurs ? */
function visibiliteEntamee(profil: ProfilClient): boolean {
  return profil.consolidation.comptesExternes !== 'non';
}

function porteeDe(profil: ProfilClient): Portee {
  if (profil.consolidation.comptesExternes === 'non') return 'declaree';
  return 'interne-seulement';
}

/** Les sources d'un constat — ce que le fiscaliste doit pouvoir remonter. */
function sourcesDe(profil: ProfilClient, extra: string[] = []): string[] {
  return [`profil v${profil.version}`, 'regles-parseur v1.0', ...extra];
}

// ─────────────────────────────────────────────────────────────────────────────
// STRATÉGIE 1 · CRISTALLISATION DE PERTES, DATÉE
// ─────────────────────────────────────────────────────────────────────────────

function strategieCristallisation(profil: ProfilClient): Constat {
  const base = {
    strategie: 'cristallisation-pertes',
    titre: 'Cristallisation de pertes',
    titreClient: 'Réduire l’impôt sur vos gains de l’année',
    libelleMontant: 'de perte à cristalliser',
    recurrence: 'annuel' as const,
    sources: sourcesDe(profil),
    limiteVisibilite: null,
  };
  const manquantes: string[] = [];
  const nonEnr = positionsNonEnregistrees(profil);

  if (profil.comptes.length === 0) {
    return {
      ...base, statut: 'indisponible', portee: 'inconnue', montantEstime: null,
      explication:
        'Aucun relevé de positions n’a été importé : les gains et pertes latents ne peuvent pas être établis.',
      donneesManquantes: ['le relevé de positions du client'],
    };
  }

  const aveugles = sansPbr(nonEnr);
  if (nonEnr.length === 0 || aveugles === nonEnr.length) {
    manquantes.push(
      nonEnr.length === 0
        ? 'un compte non enregistré identifié (le régime de certains comptes reste inconnu)'
        : 'le prix de base rajusté des positions non enregistrées'
    );
    return {
      ...base, statut: 'indisponible', portee: 'inconnue', montantEstime: null,
      explication:
        nonEnr.length === 0
          ? 'Aucune position non enregistrée n’a pu être identifiée. Un compte dont le régime n’est pas prouvé est écarté plutôt que présumé : vendre à perte dans un CELI détruirait un droit de cotisation sans produire aucune déduction.'
          : `Le prix de base rajusté manque sur ${aveugles} position${pl(aveugles)} non enregistrée${pl(aveugles)} : le gain ou la perte latente n’est pas calculable.`,
      donneesManquantes: manquantes,
    };
  }

  const enPerte = nonEnr.filter((p) => {
    const g = gainLatent(p);
    return g !== null && g < 0;
  });
  const pertesLatentes = enPerte.reduce((s, p) => s + Math.abs(gainLatent(p) as number), 0);
  const gainsRealises = profil.transactionsAnnee.gainsRealises;
  const reportees = profil.droits.pertesCapitalReportees.montant;

  // Ce qu'il est UTILE de cristalliser : ce qui absorbe un gain déjà réalisé.
  // Au-delà, la perte se reporte — utile aussi, mais ce n'est plus le même
  // conseil, et le présenter comme une économie de l'année serait faux.
  const absorbable = Math.min(pertesLatentes, Math.max(0, gainsRealises));

  if (aveugles > 0) {
    manquantes.push(`le prix de base rajusté de ${aveugles} position${pl(aveugles)}`);
  }
  if (visibiliteEntamee(profil)) {
    manquantes.push('la liste des positions détenues ailleurs qu’ici');
  }

  const detailReportees = reportees !== null && reportees > 0
    ? ` À cela s’ajoutent ${argent(reportees)} de pertes en capital déjà reportées d’années passées.`
    : '';

  // RÈGLE TRANSVERSALE : la visibilité entamée dégrade le constat, elle ne
  // l'annule pas. On dit le chiffre vu ET qu'il est partiel.
  if (visibiliteEntamee(profil)) {
    return {
      ...base, statut: 'montant-a-confirmer', portee: 'interne-seulement', montantEstime: null,
      limiteVisibilite:
        'coordonnée sur nos comptes seulement — les positions détenues ailleurs ne peuvent pas entrer dans l’ordre de vente.',
      explication:
        `${enPerte.length} position${pl(enPerte.length)} non enregistrée${pl(enPerte.length)} ${enPerte.length > 1 ? 'portent' : 'porte'} une perte latente de ${argent(pertesLatentes)}, ` +
        `dont ${argent(absorbable)} absorberait des gains déjà réalisés cette année (${argent(gainsRealises)}).` +
        `${detailReportees} Ce montant ne couvre que les comptes détenus ici : un ordre de vente coordonné ` +
        `exige de connaître aussi les positions détenues ailleurs.`,
      donneesManquantes: manquantes,
    };
  }

  return {
    ...base,
    statut: absorbable > 0 ? 'calcule' : 'non-applicable',
    portee: 'declaree',
    montantEstime: absorbable > 0 ? absorbable : null,
    explication: absorbable > 0
      ? `${enPerte.length} position${pl(enPerte.length)} non enregistrée${pl(enPerte.length)} ${enPerte.length > 1 ? 'portent' : 'porte'} une perte latente de ${argent(pertesLatentes)}. ` +
        `En cristalliser ${argent(absorbable)} annulerait les gains déjà réalisés cette année (${argent(gainsRealises)}).` +
        `${detailReportees}`
      : gainsRealises <= 0
        ? `Aucun gain n’a été réalisé cette année : il n’y a rien à absorber. Les ${argent(pertesLatentes)} de pertes latentes restent disponibles pour une année future.`
        : 'Aucune position non enregistrée n’est en perte latente.',
    donneesManquantes: manquantes,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STRATÉGIE 2 · LOCALISATION D'ACTIFS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠ BLOQUÉE PAR `Position.categorie`, ET CE N'EST PAS UN OUBLI.
 *
 * Aucune colonne d'un relevé ne porte la catégorie d'un titre. La fabriquer
 * depuis la famille d'instrument et la devise serait une invention : un FNB
 * coté en CAD peut détenir des actions américaines, donc « Action » + « CAD »
 * ne fait pas « actions-ca ». Un conseil de DÉPLACEMENT D'ACTIFS entre régimes
 * fondé sur une catégorie inventée est exactement le genre d'erreur que ce
 * projet refuse.
 *
 * L'INTRANT NATUREL EXISTE ET VIENDRA : la liste positive d'instruments du
 * moteur corporatif (`profils-instrument.csv`), qui classe chaque titre par
 * nature de revenu. Le schéma la nomme déjà — « repris des profils-instrument
 * du moteur corpo ». À brancher dans un chantier futur, pas ici.
 *
 * Vocabulaire à RÉUTILISER, surtout pas à recréer, le jour du branchement :
 * `Fiscalite` et `FISCALITE_PAR_CODE` dans `src/lib/film/build-sections.ts`
 * ('abri' | 'reporte' | 'imposable' | 'inconnu').
 */
function strategieLocalisation(profil: ProfilClient): Constat {
  const base = {
    strategie: 'localisation-actifs',
    titre: 'Localisation d’actifs',
    titreClient: 'Placer chaque revenu dans le bon compte',
    libelleMontant: 'de revenu à relocaliser',
    recurrence: 'annuel' as const,
    sources: sourcesDe(profil),
    limiteVisibilite: null,
  };

  const regimesInconnus = profil.comptes.filter((c) => c.type === null).length;
  const manquantes = ['la nature de revenu de chaque titre (registre d’instruments)'];
  if (regimesInconnus > 0) {
    manquantes.push(`le régime de ${regimesInconnus} compte${pl(regimesInconnus)}`);
  }
  if (profil.revenus.trancheRevenu === null) {
    manquantes.push('la tranche de revenu imposable du client');
  }

  return {
    ...base,
    statut: 'indisponible',
    portee: 'inconnue',
    montantEstime: null,
    explication:
      'Placer les revenus d’intérêt et les dividendes étrangers à l’abri, et garder les gains en capital ' +
      'au non-enregistré, suppose de connaître la nature du revenu de chaque titre. Aucune colonne du relevé ' +
      'ne la porte, et la déduire de la devise serait fausse : un fonds coté ici peut détenir des titres étrangers. ' +
      'Ce constat restera indisponible tant que le registre d’instruments ne sera pas branché.',
    donneesManquantes: manquantes,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STRATÉGIE 3 · CELI DU CONJOINT
// ─────────────────────────────────────────────────────────────────────────────

function strategieCeliConjoint(profil: ProfilClient): Constat {
  const base = {
    strategie: 'celi-conjoint',
    titre: 'CELI du conjoint',
    titreClient: 'Utiliser le CELI de votre conjoint',
    libelleMontant: 'de droits accumulés disponibles',
    // UNIQUE, pas annuel : ce montant est le CUMUL des droits inutilisés depuis
    // l'ouverture. L'afficher « par année » laisserait croire à 48 000 $ de
    // place neuve chaque année, alors que le plafond annuel est de l'ordre de
    // 7 000 $. Le geste de rattrapage, lui, se pose une fois.
    recurrence: 'unique' as const,
    sources: sourcesDe(profil),
    limiteVisibilite: null,
  };
  const conjoint = profil.demographie.conjoint;
  const droitsConjoint = profil.droits.celiConjointInutilises.montant;

  const sansConjoint =
    profil.demographie.etatCivil !== null &&
    ['celibataire', 'veuf', 'divorce'].includes(profil.demographie.etatCivil);
  if (sansConjoint) {
    return {
      ...base, statut: 'non-applicable', portee: 'declaree', montantEstime: null,
      explication: 'Le client n’a pas de conjoint au dossier.',
      donneesManquantes: [],
    };
  }

  const manquantes: string[] = [];
  if (conjoint.trancheRevenu === null) manquantes.push('la tranche de revenu du conjoint');
  if (droitsConjoint === null) manquantes.push('les droits CELI inutilisés du conjoint (avis de cotisation)');
  if (profil.demographie.etatCivil === null) manquantes.push('l’état civil du client');

  if (manquantes.length > 0) {
    return {
      ...base, statut: 'indisponible', portee: 'inconnue', montantEstime: null,
      explication:
        'Un revenu de placement imposé au nom du client peut souvent l’être plus légèrement dans le CELI du ' +
        'conjoint. Le vérifier exige de connaître ses droits CELI et sa tranche de revenu — deux données qui ' +
        'ne se trouvent que sur son propre avis de cotisation.',
      donneesManquantes: manquantes,
    };
  }

  // Les droits du conjoint sont connus et datés. Mais un montant à cotiser ne
  // se recommande que si la visibilité est complète — règle transversale.
  if (visibiliteEntamee(profil)) {
    return {
      ...base, statut: 'montant-a-confirmer', portee: 'interne-seulement', montantEstime: null,
      limiteVisibilite:
        'droits connus, montant à cotiser inconnu — un compte ailleurs peut en avoir déjà consommé une partie.',
      explication:
        `Le conjoint dispose de ${argent(droitsConjoint as number)} de droits CELI inutilisés. Le montant à y ` +
        'placer reste à confirmer : des comptes détenus ailleurs pourraient déjà en avoir consommé une partie, ' +
        'et une cotisation excédentaire coûte 1 % de pénalité par mois.',
      donneesManquantes: ['la confirmation qu’aucun compte n’est détenu ailleurs'],
    };
  }

  return {
    ...base, statut: 'calcule', portee: 'declaree', montantEstime: droitsConjoint,
    explication:
      `Le conjoint dispose de ${argent(droitsConjoint as number)} de droits CELI inutilisés. Y loger des ` +
      'placements aujourd’hui détenus au non-enregistré met leur rendement à l’abri de l’impôt.',
    donneesManquantes: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STRATÉGIE 4 · DON DE TITRES À GAIN LATENT
// ─────────────────────────────────────────────────────────────────────────────

function strategieDonTitres(profil: ProfilClient): Constat {
  const base = {
    strategie: 'don-titres',
    titre: 'Don de titres à gain latent',
    titreClient: 'Donner un titre plutôt que de l’argent',
    libelleMontant: 'de gain mis à l’abri',
    recurrence: 'annuel' as const,
    sources: sourcesDe(profil),
    limiteVisibilite: null,
  };
  const dons = profil.intentions.donsAnnuelsMoyens;

  // JAMAIS SUGGÉRÉ DE DONNER POUR DONNER — c'est écrit dans le schéma, et
  // c'est une question de tenue autant que de fiscalité.
  if (dons === null) {
    return {
      ...base, statut: 'indisponible', portee: 'inconnue', montantEstime: null,
      explication:
        'Donner un titre à gain latent plutôt que de l’argent annule l’impôt sur le gain ET donne droit au ' +
        'reçu pour la pleine valeur. Encore faut-il que le client donne déjà.',
      donneesManquantes: ['si le client fait des dons de bienfaisance, et de quel ordre'],
    };
  }
  if (dons <= 0) {
    return {
      ...base, statut: 'non-applicable', portee: 'declaree', montantEstime: null,
      explication: 'Le client ne fait pas de dons de bienfaisance. Rien à optimiser ici.',
      donneesManquantes: [],
    };
  }

  const nonEnr = positionsNonEnregistrees(profil);
  const enGain = nonEnr
    .map((p) => ({ p, g: gainLatent(p) }))
    .filter((x): x is { p: PositionSituee; g: number } => x.g !== null && x.g > 0)
    .sort((a, b) => b.g - a.g);

  if (enGain.length === 0) {
    const aveugles = sansPbr(nonEnr);
    return {
      ...base,
      statut: aveugles > 0 ? 'indisponible' : 'non-applicable',
      portee: aveugles > 0 ? 'inconnue' : 'declaree',
      montantEstime: null,
      explication: aveugles > 0
        ? `Le prix de base rajusté manque sur ${aveugles} position${pl(aveugles)} non enregistrée${pl(aveugles)} : impossible de dire laquelle porte le plus gros gain latent.`
        : 'Aucune position non enregistrée ne porte de gain latent à donner.',
      donneesManquantes: aveugles > 0 ? ['le prix de base rajusté des positions non enregistrées'] : [],
    };
  }

  // Le gain qu'on cesse d'imposer = celui de la portion effectivement donnée.
  const meilleure = enGain[0];
  const valeur = meilleure.p.valeurMarchande as number;
  const portion = Math.min(dons, valeur);
  const gainEvite = meilleure.g * (portion / valeur);

  return {
    ...base,
    statut: visibiliteEntamee(profil) ? 'montant-a-confirmer' : 'calcule',
    portee: porteeDe(profil),
    montantEstime: visibiliteEntamee(profil) ? null : gainEvite,
    limiteVisibilite: visibiliteEntamee(profil)
      ? 'le titre choisi est le meilleur de nos comptes — un titre détenu ailleurs peut porter un gain plus élevé.'
      : null,
    explication:
      `Le client donne environ ${argent(dons)} par année. Donner plutôt le titre ${meilleure.p.symbole}, ` +
      `qui porte ${argent(meilleure.g)} de gain latent, met ${argent(gainEvite)} de gain à l’abri de l’impôt ` +
      'tout en donnant droit au reçu pour la pleine valeur du don.' +
      (visibiliteEntamee(profil)
        ? ' Un titre détenu ailleurs pourrait porter un gain plus important : le choix reste à confirmer.'
        : ''),
    donneesManquantes: visibiliteEntamee(profil)
      ? ['la liste des positions détenues ailleurs qu’ici']
      : [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STRATÉGIE 5 · ORDRE DE VENTE OPTIMAL VERS LE PORTEFEUILLE CIBLE
// ─────────────────────────────────────────────────────────────────────────────

function strategieOrdreVente(profil: ProfilClient, cible: PortefeuilleCible | null): Constat {
  const base = {
    strategie: 'ordre-vente',
    titre: 'Ordre de vente vers le portefeuille cible',
    titreClient: 'Vendre dans l’ordre qui coûte le moins d’impôt',
    libelleMontant: 'de gain imposable pour l’année',
    recurrence: 'unique' as const,
    sources: sourcesDe(profil),
    limiteVisibilite: null,
  };

  if (cible === null) {
    return {
      ...base, statut: 'non-applicable', portee: 'inconnue', montantEstime: null,
      explication:
        'Aucun portefeuille cible n’a été fourni. Cette stratégie ordonne les ventes pour atteindre une cible ' +
        'en reportant le plus d’impôt possible ; sans cible, il n’y a rien à ordonner.',
      donneesManquantes: ['le portefeuille cible du planificateur'],
    };
  }

  const nonEnr = positionsNonEnregistrees(profil);
  const aveugles = sansPbr(nonEnr);
  if (nonEnr.length === 0 || aveugles > 0) {
    return {
      ...base, statut: 'indisponible', portee: 'inconnue', montantEstime: null,
      explication:
        'Ordonner les ventes exige le prix de base rajusté de chaque position : c’est lui qui dit laquelle ' +
        'déclenche le moins d’impôt.',
      donneesManquantes: ['le prix de base rajusté des positions non enregistrées'],
    };
  }

  // Vendre d'abord ce qui est en perte, puis les plus petits gains : l'impôt
  // de l'année est reporté au maximum. On rend le gain net que l'ordre produit.
  const parImpact = [...nonEnr]
    .map((p) => ({ p, g: gainLatent(p) as number }))
    .sort((a, b) => a.g - b.g);
  const gainNet = parImpact.reduce((s, x) => s + x.g, 0) + profil.transactionsAnnee.gainsRealises;

  return {
    ...base,
    statut: visibiliteEntamee(profil) ? 'montant-a-confirmer' : 'calcule',
    portee: porteeDe(profil),
    montantEstime: visibiliteEntamee(profil) ? null : gainNet,
    limiteVisibilite: visibiliteEntamee(profil)
      ? 'l’ordre ne porte que sur nos comptes — une vente ailleurs changerait le gain imposable de l’année.'
      : null,
    explication:
      `En vendant d’abord ${parImpact[0].p.symbole} puis en remontant vers les gains les plus élevés, ` +
      `le gain imposable de l’année s’établit à ${argent(gainNet)} en incluant les ${argent(profil.transactionsAnnee.gainsRealises)} ` +
      'déjà réalisés.' +
      (visibiliteEntamee(profil)
        ? ' L’ordre ne couvre que les comptes détenus ici.'
        : ''),
    donneesManquantes: visibiliteEntamee(profil) ? ['la liste des positions détenues ailleurs qu’ici'] : [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// L'ANGLE MORT — section 4 du schéma
// ─────────────────────────────────────────────────────────────────────────────

/**
 * L'argumentaire de consolidation, généré quand la visibilité est entamée.
 *
 * TON : factuel, jamais vendeur. LA LISTE EST L'ARGUMENT. On ne dit pas au
 * client ce qu'il devrait faire ; on lui montre ce qu'on ne peut pas voir.
 */
function construireAngleMort(profil: ProfilClient, constats: Constat[]): AngleMort {
  if (!visibiliteEntamee(profil)) return null;

  const limites = constats.filter((c) => c.limiteVisibilite !== null);
  // `titreClient`, pas `titre` : ce bloc est rendu sur le document remis au
  // client, a cote de cartes qui portent deja le titre client. Deux
  // vocabulaires sur la meme page se lisent comme deux sujets differents.
  const details = limites.map((c) => `${c.titreClient} : ${c.limiteVisibilite}`);

  // Le suivi des cotisations CELI est limité par la même cause, même s'il
  // n'est pas l'une des 5 stratégies. Il appartient à l'angle mort.
  const h = profil.historiqueVie.celi;
  if (h.cotisationsTotales !== null) {
    details.push(
      `Suivi de cotisation CELI : ${argent(h.cotisationsTotales)} vus ici` +
        (h.dateOuverture ? ` depuis ${h.dateOuverture}` : '') +
        ' — montant total inconnu, plafond non vérifiable.'
    );
  }

  return { constatsLimites: limites.length, total: constats.length, details };
}

// ─────────────────────────────────────────────────────────────────────────────
// LE CONTRAT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Le rang d'une question de rencontre — l'ordre d'IMPACT, pas l'ordre du code.
 *
 * La consolidation d'abord : c'est la seule qui débloque plusieurs constats à
 * la fois. Puis les avis de cotisation, qui sont la seule source autoritaire
 * des droits. Le reste ensuite.
 */
function rangQuestion(q: string): number {
  if (q.includes('ailleurs')) return 0;
  if (q.includes('avis de cotisation') || q.includes('droits')) return 1;
  if (q.includes('prix de base')) return 2;
  if (q.includes('relevé')) return 3;
  return 4;
}

/**
 * Analyse un profil et rend les constats de la section « Optimisations
 * fiscales ». Zéro mise en page ici, zéro logique fiscale dans le gabarit.
 *
 * `date` est IMPRIMÉE sur le document : elle entre par l'appelant, jamais par
 * un `new Date()` caché — sinon deux rendus du même dossier porteraient deux
 * dates et rien ne dirait laquelle fait foi.
 */
export function analyser(
  profil: ProfilClient,
  portefeuilleCible: PortefeuilleCible | null,
  date: string
): ResultatAnalyse {
  const constats: Constat[] = [
    strategieCristallisation(profil),
    strategieLocalisation(profil),
    strategieCeliConjoint(profil),
    strategieDonTitres(profil),
    strategieOrdreVente(profil, portefeuilleCible),
  ];

  const questions = [...new Set(constats.flatMap((c) => c.donneesManquantes))]
    .sort((a, b) => rangQuestion(a) - rangQuestion(b) || a.localeCompare(b));

  return {
    date,
    constats,
    angleMort: construireAngleMort(profil, constats),
    questionsRencontre: questions,
    // ⚠ LE VERROU. Passer à `false` le jour où le fiscaliste a revu ce fichier
    // ET config/parametres-fiscaux.csv. C'est la seule ligne à changer.
    revisionFiscalisteRequise: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LA SÉLECTION DU PLANIFICATEUR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Restreint une analyse aux stratégies que le planificateur a cochées.
 *
 * `analyser()` DÉTECTE ; cette fonction RETIENT. La distinction n'est pas
 * cosmétique : l'écran a besoin de voir les cinq constats pour que le
 * planificateur choisisse, le PDF ne doit porter que ceux qu'il a choisis.
 *
 * Une liste vide rend une analyse vide — et c'est le comportement voulu, pas un
 * cas dégénéré. Rien n'est coché par défaut ; tant que rien ne l'est, la
 * section PDF n'a rien à dire et ne doit pas paraître.
 *
 * L'ANGLE MORT ET LES QUESTIONS SONT RECALCULÉS sur les constats retenus. Un
 * angle mort qui nommerait une stratégie absente de la page, ou une question
 * portant sur une piste écartée, ferait parler le document d'autre chose que ce
 * qu'il montre.
 */
export function restreindre(
  resultat: ResultatAnalyse,
  strategiesRetenues: string[]
): ResultatAnalyse {
  const retenues = new Set(strategiesRetenues);
  const constats = resultat.constats.filter((c) => retenues.has(c.strategie));

  const limites = constats.filter((c) => c.limiteVisibilite !== null);
  // `titreClient`, pas `titre` : ce bloc est rendu sur le document remis au
  // client, a cote de cartes qui portent deja le titre client. Deux
  // vocabulaires sur la meme page se lisent comme deux sujets differents.
  const details = limites.map((c) => `${c.titreClient} : ${c.limiteVisibilite}`);

  // La ligne du suivi CELI n'appartient à aucune stratégie : elle décrit le
  // dossier. On la garde telle qu'elle a été rédigée, si elle existait.
  const ligneCeli = resultat.angleMort?.details.find((d) => d.startsWith('Suivi de cotisation CELI'));
  if (ligneCeli) details.push(ligneCeli);

  return {
    ...resultat,
    constats,
    // Aucun constat retenu : pas d'angle mort non plus. La ligne du suivi CELI
    // seule, sur une page vide, décrirait un dossier dont on ne montre rien.
    angleMort:
      resultat.angleMort === null || constats.length === 0 || details.length === 0
        ? null
        : { constatsLimites: limites.length, total: constats.length, details },
    questionsRencontre: [...new Set(constats.flatMap((c) => c.donneesManquantes))]
      .sort((a, b) => rangQuestion(a) - rangQuestion(b) || a.localeCompare(b)),
  };
}
