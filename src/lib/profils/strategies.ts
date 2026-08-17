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
import type { SignauxLivre } from './signaux-livre';

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
  /**
   * VRAI quand « non-applicable » veut dire « rien a faire, c'est correct ».
   *
   * A ne pas confondre avec le cas ou il nous manque un INTRANT : « aucun
   * portefeuille cible n'a ete fourni » est aussi non-applicable, mais ce n'est
   * pas le client qui est en ordre, c'est nous qui n'avons pas la matiere.
   * Seul le premier cas va dans la section « Deja en ordre ».
   */
  dejaEnOrdre: boolean;
  /**
   * LE PLAN DE RÉCOLTE — quelles positions vendre, pour combien, et pourquoi.
   *
   * Demandé par Nicolas le 11 août 2026 : « est-ce que ça va détecter quoi
   * vendre ? ». Présent seulement quand le statut est `calcule` : un plan sur
   * un montant non confirmé serait une marche à suivre vers un chiffre faux.
   */
  plan?: LignePlan[];
  /**
   * LE CALENDRIER DU GESTE, dicté par le MOTEUR — jamais par un modèle.
   *
   * C'est la condition du « temporel » demandé par Nicolas : l'IA d'essai peut
   * parler d'échéances, mais seulement de celle-ci. Une IA libre d'inventer un
   * calendrier fiscal est un danger, pas un appui.
   */
  echeance?: string | null;
};

export type LignePlan = {
  symbole: string;
  /** Ce qu'il faut vendre de cette position, en dollars — « environ ». */
  vendre: number;
  /** Le gain que cette vente cristallise. */
  gain: number;
  /** Vrai quand la position est vendue en partie seulement. */
  partiel: boolean;
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
    // LES COMPTES CORPO SONT EXCLUS — corrigé le 12 août 2026, défaut trouvé
    // par la contre-expertise de l'exploration : une société de gestion est un
    // AUTRE CONTRIBUABLE. Ses gains ne peuvent pas absorber les pertes
    // personnelles du client, ses pertes ne protègent pas les gains du client,
    // et un plan de récolte qui mélange les deux propose une compensation qui
    // n'existe pas en droit. Les stratégies corporatives (CDC, pertes de la
    // société) viendront comme des stratégies À PART, sur les seuls comptes de
    // la société.
    if (c.type !== 'non-enregistre') continue;
    for (const p of c.positions) dedans.push({ ...p, compte: c });
  }
  return dedans;
}

/**
 * POURQUOI aucune position non enregistrée n'est ressortie — les causes
 * commandent des verdicts OPPOSÉS, et les confondre fait mentir le constat.
 *
 * Défaut trouvé le 12 août 2026 en éprouvant le moteur sur un client fictif
 * « CELI + CELIAPP seulement » : le constat affirmait « le régime de certains
 * comptes reste inconnu » alors que les deux régimes étaient PROUVÉS. Trois
 * cas, trois réponses :
 *
 *   `regimes-inconnus`  au moins un compte au régime non prouvé — la stratégie
 *                       est BLOQUÉE, et le dire est vrai ;
 *   `tout-a-l-abri`     tous les régimes prouvés, aucun non enregistré — la
 *                       stratégie est NON APPLICABLE : il n'y a rien à faire,
 *                       et « bloqué » enverrait le planificateur chercher une
 *                       donnée qui n'existe pas ;
 *   `imposable-vide`    un compte non enregistré existe mais ne porte aucune
 *                       position (encaisse seulement) — non applicable aussi,
 *                       avec ce motif-là.
 */
function raisonAucunNonEnregistre(
  profil: ProfilClient
): 'regimes-inconnus' | 'tout-a-l-abri' | 'imposable-vide' {
  if (profil.comptes.some((c) => c.type === null)) return 'regimes-inconnus';
  if (profil.comptes.some((c) => c.type === 'non-enregistre')) return 'imposable-vide';
  return 'tout-a-l-abri';
}

/** Le début d'explication du cas sans position imposable — précis sur ce qu'on a VU. */
function debutSansImposable(profil: ProfilClient): string {
  const corpo = profil.comptes.some((c) => c.type === 'corpo')
    ? ' Les comptes de société sont un autre contribuable : ils relèveront des stratégies corporatives, à part.'
    : '';
  if (raisonAucunNonEnregistre(profil) === 'imposable-vide') {
    return 'Le compte non enregistré du client ne porte aucune position (encaisse seulement).' + corpo;
  }
  return 'Tous les comptes personnels vus ici sont des régimes à l’abri de l’impôt (CELI, CELIAPP, REER, FERR…).' + corpo;
}

/**
 * Le constat NON APPLICABLE commun du cas sans position imposable.
 *
 * « Déjà en ordre » seulement quand la visibilité est complète : tant que
 * l'existence de comptes ailleurs n'est pas tranchée, on dit ce qu'on a vu et
 * on borne — un compte non enregistré détenu ailleurs porterait, lui, des
 * gains imposables.
 */
function constatSansImposable(
  profil: ProfilClient,
  base: Omit<Constat, 'statut' | 'portee' | 'montantEstime' | 'explication' | 'donneesManquantes'>,
  consequence: string
): Constat {
  const entamee = visibiliteEntamee(profil);
  return {
    ...base,
    statut: 'non-applicable',
    portee: porteeDe(profil),
    montantEstime: null,
    dejaEnOrdre: !entamee,
    limiteVisibilite: entamee
      ? 'ce constat ne vaut que pour les comptes vus ici — un compte non enregistré détenu ailleurs porterait, lui, des gains imposables.'
      : null,
    explication: `${debutSansImposable(profil)} ${consequence}`,
    donneesManquantes: [],
  };
}

/** Le gain (positif) ou la perte (négative) latente d'une position, ou `null`. */
function gainLatent(p: Position): number | null {
  if (p.valeurMarchande === null || p.valeurComptable === null) return null;
  return p.valeurMarchande - p.valeurComptable;
}

/**
 * LE PLAN DE RÉCOLTE : atteindre `cible` dollars de gain en vendant le moins
 * possible.
 *
 * L'ordre est la DENSITÉ DE GAIN (gain latent ÷ valeur marchande) : chaque
 * dollar vendu du titre le plus dense cristallise plus de gain, donc la cible
 * est atteinte avec le plus petit volume vendu-racheté — moins de
 * transactions, moins de frais.
 *
 * LA PROPORTION EST FISCALEMENT EXACTE, pas approchée : au Canada le PBR est
 * un coût moyen par action (biens identiques), donc vendre une fraction d'une
 * position cristallise exactement cette fraction de son gain latent. C'est ce
 * qui autorise la dernière ligne du plan à être partielle.
 */
function planifierRecolte(
  enGain: Array<{ p: PositionSituee; g: number }>,
  cible: number
): LignePlan[] {
  const ordonnees = [...enGain]
    .filter((x) => (x.p.valeurMarchande ?? 0) > 0)
    .sort((a, b) => b.g / (b.p.valeurMarchande as number) - a.g / (a.p.valeurMarchande as number));

  const plan: LignePlan[] = [];
  let reste = cible;
  for (const { p, g } of ordonnees) {
    if (reste <= 0.005) break;
    const vm = p.valeurMarchande as number;
    if (g <= reste + 0.005) {
      plan.push({ symbole: p.symbole, vendre: Math.round(vm), gain: Math.round(g * 100) / 100, partiel: false });
      reste -= g;
    } else {
      const fraction = reste / g;
      plan.push({
        symbole: p.symbole,
        vendre: Math.round(vm * fraction),
        gain: Math.round(reste * 100) / 100,
        partiel: true,
      });
      reste = 0;
    }
  }
  return plan;
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

/**
 * « DÉJÀ EN ORDRE » EXIGE LA VISIBILITÉ COMPLÈTE — corrigé le 13 août 2026.
 *
 * Un « rien à faire, c'est correct » prononcé sur les seuls comptes vus ici est
 * une affirmation sur un ensemble qu'on n'a pas vu. Trois constats l'accordaient
 * sans regarder `comptesExternes` : un client avec 20 000 $ de pertes reportées
 * et un compte gagnant à l'autre institution lisait « rien à récolter » alors
 * qu'il y avait jusqu'à 20 000 $ de gain à cristalliser à impôt nul.
 *
 * Et comme `limiteVisibilite` restait `null`, ces constats échappaient aussi à
 * l'angle mort du document, qui ne retient que les constats qui la portent :
 * la réserve n'était écrite nulle part. Ce couple répare les deux d'un coup.
 */
function sousReserveDeVisibilite(
  profil: ProfilClient,
  enOrdreSiVisible: boolean,
  limite: string
): { dejaEnOrdre: boolean; limiteVisibilite: string | null } {
  const entamee = visibiliteEntamee(profil);
  return {
    dejaEnOrdre: enOrdreSiVisible && !entamee,
    limiteVisibilite: entamee ? limite : null,
  };
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
    echeance: 'Ordres réglés avant le 31 décembre pour compter dans l’année — et pas de rachat du même titre pendant 30 jours.',
    libelleMontant: 'de perte à cristalliser',
    recurrence: 'annuel' as const,
    sources: sourcesDe(profil),
    limiteVisibilite: null,
    dejaEnOrdre: false,
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

  // SANS POSITION IMPOSABLE ET SANS RÉGIME DOUTEUX, le verdict n'est pas
  // « bloqué », c'est « rien à faire » — voir raisonAucunNonEnregistre.
  if (nonEnr.length === 0 && raisonAucunNonEnregistre(profil) !== 'regimes-inconnus') {
    return constatSansImposable(
      profil, base,
      'Vendre à perte dans un régime enregistré ne produit aucune déduction : il n’y a rien à cristalliser.'
    );
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
  // LE GAIN NET, PAS LE GAIN BRUT — défaut trouvé le 6 août 2026 sur un client
  // réel de la campagne : 6 728 $ de gains réalisés, mais aussi 4 000 $ de
  // pertes déjà réalisées. Ne regarder que les gains aurait fait recommander
  // 6 728 $ de ventes là où 2 728 $ suffisent — soit 4 000 $ de ventes
  // inutiles, avec leurs frais et leur sortie de marché, pour un gain fiscal
  // nul. Les pertes déjà prises absorbent déjà leur part.
  const gainsRealises = Math.max(
    0,
    profil.transactionsAnnee.gainsRealises - profil.transactionsAnnee.pertesRealisees
  );
  const pertesDejaPrises = profil.transactionsAnnee.pertesRealisees;
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
    // LE MÊME MOTIF QUE LE CHEMIN NOMINAL — corrigé le 13 août 2026.
    //
    // Cette branche disait « mais aucun gain net n'a été réalisé cette année »
    // dès qu'`absorbable` valait zéro. Or `absorbable` est un MINIMUM : il vaut
    // aussi zéro quand le client a de vrais gains réalisés mais aucune position
    // en perte latente. Un client à 10 000 $ de gains lisait alors « 0 position
    // porte une perte latente de 0 $, mais aucun gain net n'a été réalisé » —
    // trois affirmations fausses d'un coup. Le chemin nominal (plus bas) avait
    // reçu ce correctif le 11 août ; celui-ci l'avait manqué.
    const phrasePertes = pertesLatentes <= 0
      ? `Aucune position non enregistrée vue ici n’est en perte latente${gainsRealises > 0 ? `, alors que ${argent(gainsRealises)} de gain net a déjà été réalisé cette année` : ''}.`
      : `${enPerte.length} position${pl(enPerte.length)} non enregistrée${pl(enPerte.length)} ${enPerte.length > 1 ? 'portent' : 'porte'} une perte latente de ${argent(pertesLatentes)}, ` +
        // « DONT 0 $ ABSORBERAIT » NE SE DIT PAS. Vu à l'écran le 6 août sur un
        // client de la campagne : la phrase était exacte et illisible, et elle
        // laissait croire qu'il y avait quelque chose à faire. Quand il n'y a
        // aucun gain à absorber, on le dit — la perte reste utile, mais plus tard.
        (absorbable > 0
          ? `dont ${argent(absorbable)} absorberait le gain net déjà réalisé cette année (${argent(gainsRealises)}).`
          : 'mais aucun gain net n’a été réalisé cette année : rien à absorber pour l’instant, et ces pertes restent disponibles pour une année future.');

    return {
      ...base, statut: 'montant-a-confirmer', portee: 'interne-seulement', montantEstime: null,
      limiteVisibilite:
        'coordonnée sur nos comptes seulement — les positions détenues ailleurs ne peuvent pas entrer dans l’ordre de vente.',
      explication:
        `${phrasePertes}${detailReportees} Ce constat ne couvre que les comptes détenus ici : un ordre de vente coordonné ` +
        `exige de connaître aussi les positions détenues ailleurs.`,
      donneesManquantes: manquantes,
    };
  }

  return {
    ...base,
    statut: absorbable > 0 ? 'calcule' : 'non-applicable',
    dejaEnOrdre: absorbable <= 0,
    portee: 'declaree',
    montantEstime: absorbable > 0 ? absorbable : null,
    explication: absorbable > 0
      ? `${enPerte.length} position${pl(enPerte.length)} non enregistrée${pl(enPerte.length)} ${enPerte.length > 1 ? 'portent' : 'porte'} une perte latente de ${argent(pertesLatentes)}. ` +
        `En cristalliser ${argent(absorbable)} annulerait le gain net déjà réalisé cette année (${argent(gainsRealises)}` +
        `${pertesDejaPrises > 0 ? `, après les ${argent(pertesDejaPrises)} de pertes déjà prises` : ''}).` +
        `${detailReportees}`
      : gainsRealises <= 0
        // « Les 0 $ de pertes latentes restent disponibles » — vu au rendu du
        // 11 août : la phrase ne se dit que s'il y a des pertes latentes.
        ? `Aucun gain net n’a été réalisé cette année${pertesDejaPrises > 0 ? ` (les ${argent(pertesDejaPrises)} de pertes déjà prises couvrent les gains)` : ''} : il n’y a rien à absorber.${pertesLatentes > 0 ? ` Les ${argent(pertesLatentes)} de pertes latentes restent disponibles pour une année future.` : ''}`
        : 'Aucune position non enregistrée n’est en perte latente.',
    donneesManquantes: manquantes,
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// STRATÉGIE 7 · CRISTALLISATION DE GAINS — le miroir de la stratégie 1
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Récolter des gains SANS impôt, à hauteur des pertes qui dorment.
 *
 * Les deux cristallisations sont les faces du même signe : gains nets positifs
 * → la stratégie 1 récolte des pertes pour les effacer ; pertes inutilisées
 * (année courante nette OU reportées d'années passées) → celle-ci récolte des
 * gains qu'elles absorbent à taux nul. Le portefeuille ne change pas — on vend
 * et on rachète — mais le prix de base remonte, ce qui réduit l'impôt d'une
 * vente future.
 *
 * LE CALENDRIER, parce que Nicolas posait la question (11 août 2026) : ce
 * geste n'a RIEN à voir avec la période de cotisation REER — les 60 premiers
 * jours de l'année ne gouvernent que la déduction REER. L'axe fiscal d'une
 * vente est sa DATE DE RÈGLEMENT dans l'année civile. Et la variante couverte
 * ici — absorber des pertes inutilisées — n'a AUCUNE échéance : une perte
 * reportée ne périme pas, le geste s'exécute en tout temps. Son avantage
 * structurel sur la stratégie 1 : la règle de la perte apparente (30 jours) ne
 * vise que les PERTES — un gain cristallisé permet de racheter le même titre
 * le jour même.
 *
 * La variante « année à faible revenu » (réaliser au bas palier) exigera les
 * barèmes d'imposition fédéral + Québec dans parametres-fiscaux.csv — sous le
 * même verrou fiscaliste. Elle n'est PAS couverte ici.
 */
function strategieCristallisationGains(profil: ProfilClient): Constat {
  const base = {
    strategie: 'cristallisation-gains',
    titre: 'Cristallisation de gains',
    titreClient: 'Récolter des gains sans payer d’impôt',
    echeance: 'Aucune échéance : une perte reportée ne périme pas, et le rachat du même titre est permis le jour même.',
    libelleMontant: 'de gain cristallisable sans impôt',
    recurrence: 'unique' as const,
    sources: sourcesDe(profil),
    limiteVisibilite: null,
    dejaEnOrdre: false,
  };
  const nonEnr = positionsNonEnregistrees(profil);

  if (profil.comptes.length === 0) {
    return {
      ...base, statut: 'indisponible', portee: 'inconnue', montantEstime: null,
      explication:
        'Aucun relevé de positions n’a été importé : les gains latents ne peuvent pas être établis.',
      donneesManquantes: ['le relevé de positions du client'],
    };
  }

  // Même distinction que la cristallisation de pertes : sans position
  // imposable et sans régime douteux, « rien à faire » plutôt que « bloqué ».
  if (nonEnr.length === 0 && raisonAucunNonEnregistre(profil) !== 'regimes-inconnus') {
    return constatSansImposable(
      profil, base,
      'Les gains y croissent déjà libres d’impôt : la cristallisation n’a pas d’objet.'
    );
  }

  const aveugles = sansPbr(nonEnr);
  if (nonEnr.length === 0 || aveugles === nonEnr.length) {
    return {
      ...base, statut: 'indisponible', portee: 'inconnue', montantEstime: null,
      explication:
        nonEnr.length === 0
          ? 'Aucune position non enregistrée n’a pu être identifiée — un compte au régime non prouvé est écarté plutôt que présumé.'
          : 'Le prix de base rajusté manque sur les positions non enregistrées : le gain latent n’est pas calculable.',
      donneesManquantes: [
        nonEnr.length === 0
          ? 'un compte non enregistré identifié'
          : 'le prix de base rajusté des positions non enregistrées',
      ],
    };
  }

  const enGain = nonEnr
    .map((p) => ({ p, g: gainLatent(p) }))
    .filter((x): x is { p: PositionSituee; g: number } => x.g !== null && x.g > 0);
  const gainsLatents = enGain.reduce((somme, x) => somme + x.g, 0);

  // Les pertes disponibles : le net de l'année (jamais négatif) + les
  // reportées de l'avis de cotisation, quand elles sont connues.
  const perteNetteAnnee = Math.max(
    0,
    profil.transactionsAnnee.pertesRealisees - profil.transactionsAnnee.gainsRealises
  );
  const reportees = profil.droits.pertesCapitalReportees.montant;
  const pertesDisponibles = perteNetteAnnee + (reportees ?? 0);

  if (enGain.length === 0) {
    return {
      ...base, statut: 'non-applicable', portee: porteeDe(profil), montantEstime: null,
      ...sousReserveDeVisibilite(
        profil, aveugles === 0,
        'constaté sur nos comptes seulement — un titre à gain latent détenu ailleurs pourrait, lui, être récolté.'
      ),
      explication:
        'Aucune position non enregistrée vue ici ne porte de gain latent à récolter.' +
        (visibiliteEntamee(profil)
          ? ' Un titre détenu ailleurs pourrait en porter : le constat reste à confirmer.'
          : ''),
      donneesManquantes: visibiliteEntamee(profil) ? ['la liste des positions détenues ailleurs qu’ici'] : [],
    };
  }

  if (pertesDisponibles <= 0) {
    // Aucune perte connue. Si les reportées n'ont jamais été demandées, c'est
    // une question — pas un « rien à faire » : elles pourraient exister.
    if (reportees === null) {
      return {
        ...base, statut: 'indisponible', portee: 'inconnue', montantEstime: null,
        explication:
          `${argent(gainsLatents)} de gains latents pourraient être récoltés sans impôt si des pertes ` +
          'd’années passées dormaient au dossier fiscal. Ce montant ne figure que sur l’avis de cotisation.',
        donneesManquantes: ['le montant des pertes en capital reportées (avis de cotisation)'],
      };
    }
    return {
      ...base, statut: 'non-applicable', portee: porteeDe(profil), montantEstime: null,
      // Les pertes de l'année sont dérivées du seul livre interne : une perte
      // réalisée ailleurs cette année n'y figure pas. Le « rien à récolter »
      // ne vaut donc que si le client a confirmé n'avoir aucun compte ailleurs.
      ...sousReserveDeVisibilite(
        profil, true,
        'les pertes de l’année sont comptées sur nos comptes seulement — une perte réalisée ailleurs ouvrirait de la place.'
      ),
      explication:
        (visibiliteEntamee(profil)
          ? 'Aucune perte inutilisée vue ici — ni cette année, ni reportée. Une perte réalisée dans un compte détenu ailleurs ouvrirait pourtant de la place : le constat reste à confirmer.'
          : 'Aucune perte inutilisée — ni cette année, ni reportée. Il n’y a rien à récolter à impôt nul, et c’est une bonne chose.'),
      donneesManquantes: visibiliteEntamee(profil) ? ['la liste des positions détenues ailleurs qu’ici'] : [],
    };
  }

  const montant = Math.round(Math.min(gainsLatents, pertesDisponibles) * 100) / 100;
  const originePertes =
    perteNetteAnnee > 0 && (reportees ?? 0) > 0
      ? `${argent(perteNetteAnnee)} de pertes nettes de l’année et ${argent(reportees as number)} reportées d’années passées`
      : perteNetteAnnee > 0
        ? `${argent(perteNetteAnnee)} de pertes nettes réalisées cette année`
        : `${argent(reportees as number)} de pertes reportées d’années passées`;

  if (visibiliteEntamee(profil)) {
    return {
      ...base, statut: 'montant-a-confirmer', portee: 'interne-seulement', montantEstime: null,
      limiteVisibilite:
        'chiffrée sur nos comptes seulement — des gains ou pertes réalisés ailleurs changeraient le montant absorbable.',
      explication:
        `${originePertes} restent inutilisées, et ${argent(gainsLatents)} de gains latents sont détenus ici. ` +
        `Jusqu’à ${argent(montant)} de gain pourraient être cristallisés sans impôt — à confirmer une fois ` +
        'les comptes détenus ailleurs connus.',
      donneesManquantes: ['la liste des positions détenues ailleurs qu’ici'],
    };
  }

  return {
    ...base,
    statut: 'calcule',
    portee: 'declaree',
    montantEstime: montant,
    plan: planifierRecolte(enGain, montant),
    explication:
      `${originePertes} restent inutilisées. Vendre puis racheter les positions gagnantes — permis le jour même, ` +
      `la règle des 30 jours ne vise que les pertes — cristallise ${argent(montant)} de gain sans un dollar ` +
      'd’impôt et remonte d’autant leur prix de base. Ce geste n’a aucune échéance : une perte reportée ne périme pas.',
    donneesManquantes: [],
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
    dejaEnOrdre: false,
  };

  // LE CAS « TOUT À L'ABRI » D'ABORD : sans aucun compte personnel imposable,
  // il n'y a rien à localiser — le registre d'instruments n'y changerait rien.
  // Le cas « compte imposable vide » garde, lui, le verrou du registre : dès
  // que ce compte se remplira, la question se posera.
  if (profil.comptes.length > 0 && raisonAucunNonEnregistre(profil) === 'tout-a-l-abri') {
    return constatSansImposable(
      profil, base,
      'Chaque revenu est déjà à l’abri : il n’y a aucun compte imposable d’où relocaliser quoi que ce soit.'
    );
  }

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
    dejaEnOrdre: false,
  };
  const conjoint = profil.demographie.conjoint;
  const droitsConjoint = profil.droits.celiConjointInutilises.montant;

  const sansConjoint =
    profil.demographie.etatCivil !== null &&
    ['celibataire', 'veuf', 'divorce'].includes(profil.demographie.etatCivil);
  if (sansConjoint) {
    return {
      ...base, statut: 'non-applicable', portee: 'declaree', montantEstime: null,
      dejaEnOrdre: true,
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

  // LE CELI DU CONJOINT EST PLEIN — corrigé le 13 août 2026.
  //
  // La branche finale ne traitait pas le zéro : elle rendait une carte
  // « calculée » à 0 $ dont l'explication recommandait quand même d'y loger des
  // placements. Suivre ce conseil, c'est la cotisation excédentaire à 1 % de
  // pénalité par mois que ce fichier rappelle deux fois. Le moteur a déjà sa
  // convention pour ce cas (stratégie 8 : « le CELI est plein », non applicable
  // et déjà en ordre) — on l'applique ici aussi. Le zéro est une VRAIE réponse,
  // pas un montant : il se dit, il ne se chiffre pas.
  if (droitsConjoint !== null && droitsConjoint <= 0) {
    return {
      ...base, statut: 'non-applicable', portee: porteeDe(profil), montantEstime: null,
      ...sousReserveDeVisibilite(
        profil, true,
        'droits lus sur l’avis de cotisation du conjoint — à confirmer avec ses comptes détenus ailleurs.'
      ),
      explication:
        'Le CELI du conjoint est déjà plein : aucun droit de cotisation inutilisé. Il n’y a rien à y loger, ' +
        'et cotiser au-delà coûterait 1 % de pénalité par mois.',
      donneesManquantes: [],
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
    dejaEnOrdre: false,
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
      dejaEnOrdre: true,
      explication: 'Le client ne fait pas de dons de bienfaisance. Rien à optimiser ici.',
      donneesManquantes: [],
    };
  }

  const nonEnr = positionsNonEnregistrees(profil);

  // LE MOTIF DU ZÉRO DOIT ÊTRE LE VRAI MOTIF (12 août 2026). Un donateur sans
  // relevé importé n'est pas « déjà en ordre » ; des régimes non prouvés non
  // plus. Seul le cas « rien d'imposable, régimes prouvés » l'est.
  if (profil.comptes.length === 0) {
    return {
      ...base, statut: 'indisponible', portee: 'inconnue', montantEstime: null,
      explication:
        'Le client fait des dons, mais aucun relevé de positions n’a été importé : impossible de dire quel titre porterait le don.',
      donneesManquantes: ['le relevé de positions du client'],
    };
  }
  if (nonEnr.length === 0 && raisonAucunNonEnregistre(profil) === 'regimes-inconnus') {
    return {
      ...base, statut: 'indisponible', portee: 'inconnue', montantEstime: null,
      explication:
        'Aucune position non enregistrée n’a pu être identifiée : le régime de certains comptes reste inconnu, et un compte non prouvé est écarté plutôt que présumé.',
      donneesManquantes: ['un compte non enregistré identifié (le régime de certains comptes reste inconnu)'],
    };
  }

  const enGain = nonEnr
    .map((p) => ({ p, g: gainLatent(p) }))
    .filter((x): x is { p: PositionSituee; g: number } => x.g !== null && x.g > 0)
    .sort((a, b) => b.g - a.g);

  if (enGain.length === 0) {
    const aveugles = sansPbr(nonEnr);
    const entamee = visibiliteEntamee(profil);
    return {
      ...base,
      statut: aveugles > 0 ? 'indisponible' : 'non-applicable',
      // Le donateur dont TOUS les titres à gain sont ailleurs n'est pas « en
      // ordre » : c'est justement chez lui que le don en titres rapporte.
      ...sousReserveDeVisibilite(
        profil, aveugles === 0,
        'cherché dans nos comptes seulement — un titre à gain latent détenu ailleurs ferait un bien meilleur don.'
      ),
      portee: aveugles > 0 ? 'inconnue' : porteeDe(profil),
      montantEstime: null,
      explication: aveugles > 0
        ? `Le prix de base rajusté manque sur ${aveugles} position${pl(aveugles)} non enregistrée${pl(aveugles)} : impossible de dire laquelle porte le plus gros gain latent.`
        : 'Aucune position non enregistrée vue ici ne porte de gain latent à donner.' +
          (entamee ? ' Un titre détenu ailleurs pourrait en porter : le constat reste à confirmer.' : ''),
      donneesManquantes: aveugles > 0
        ? ['le prix de base rajusté des positions non enregistrées']
        : entamee ? ['la liste des positions détenues ailleurs qu’ici'] : [],
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
    dejaEnOrdre: false,
  };

  if (cible === null) {
    return {
      ...base, statut: 'non-applicable', portee: 'inconnue', montantEstime: null,
      // PAS « deja en ordre » : c'est NOUS qui n'avons pas la matiere, pas le
      // client dont la situation serait correcte.
      dejaEnOrdre: false,
      explication:
        'Aucun portefeuille cible n’a été fourni. Cette stratégie ordonne les ventes pour atteindre une cible ' +
        'en reportant le plus d’impôt possible ; sans cible, il n’y a rien à ordonner.',
      donneesManquantes: ['le portefeuille cible du planificateur'],
    };
  }

  const nonEnr = positionsNonEnregistrees(profil);

  // LE MOTIF DU ZÉRO DOIT ÊTRE LE VRAI MOTIF (12 août 2026) : l'ancien message
  // réclamait le PBR même quand la vraie cause était l'absence de relevé, un
  // régime non prouvé — ou rien d'imposable du tout, où l'ordre est sans objet.
  if (profil.comptes.length === 0) {
    return {
      ...base, statut: 'indisponible', portee: 'inconnue', montantEstime: null,
      explication: 'Aucun relevé de positions n’a été importé : il n’y a rien à ordonner.',
      donneesManquantes: ['le relevé de positions du client'],
    };
  }
  if (nonEnr.length === 0) {
    if (raisonAucunNonEnregistre(profil) === 'regimes-inconnus') {
      return {
        ...base, statut: 'indisponible', portee: 'inconnue', montantEstime: null,
        explication:
          'Aucune position non enregistrée n’a pu être identifiée : le régime de certains comptes reste inconnu. ' +
          'Ordonner des ventes suppose de savoir lesquelles sont imposables.',
        donneesManquantes: ['un compte non enregistré identifié (le régime de certains comptes reste inconnu)'],
      };
    }
    return constatSansImposable(
      profil, base,
      'Vendre pour atteindre la cible ne déclenche aucun impôt dans un régime enregistré : il n’y a pas d’ordre fiscal à optimiser.'
    );
  }

  const aveugles = sansPbr(nonEnr);
  if (aveugles > 0) {
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
  // Meme correction que la cristallisation : le gain DEJA realise est net des
  // pertes deja prises, sinon le gain imposable annonce est surestime.
  const dejaRealise =
    profil.transactionsAnnee.gainsRealises - profil.transactionsAnnee.pertesRealisees;
  const gainNet = parImpact.reduce((s, x) => s + x.g, 0) + dejaRealise;

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
      `le gain imposable de l’année s’établit à ${argent(gainNet)} en incluant les ${argent(dejaRealise)} ` +
      'déjà réalisés, nets des pertes déjà prises.' +
      (visibiliteEntamee(profil)
        ? ' L’ordre ne couvre que les comptes détenus ici.'
        : ''),
    donneesManquantes: visibiliteEntamee(profil) ? ['la liste des positions détenues ailleurs qu’ici'] : [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STRATÉGIE 6 · SUBVENTION REEE NON RÉCLAMÉE (SCEE + IQEE)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * L'argent que le gouvernement DONNE et que personne ne réclame.
 *
 * 20 % du fédéral (SCEE) + 10 % du Québec (IQEE) = **30 % combiné** sur la
 * première tranche de cotisation annuelle par enfant. C'est le rendement
 * garanti le plus élevé du catalogue, et il expire chaque année.
 *
 * CE QUE LE MOTEUR SAIT, ET COMMENT.
 * Mesuré sur le livre : 110 comptes REEE, 23 326 lignes. Les cotisations
 * nomment leur bénéficiaire dans la note — « CONTRIBUTION 01LAURIE ». C'est ce
 * qui permet de compter par enfant plutôt qu'en bloc.
 *
 * ⚠ LE MONTANT RENDU EST UN PLANCHER, et le constat le dit. On ne tient compte
 * ni des droits reportés des années passées (un parent qui a peu cotisé peut
 * recevoir davantage), ni des majorations selon le revenu familial, ni des
 * plafonds à vie déjà atteints. Ces trois éléments ne peuvent QUE l'augmenter
 * ou le rendre nul — jamais le rendre trompeur à la hausse.
 */
function strategieReee(
  profil: ProfilClient,
  parametres: ParametresReee | null
): Constat {
  const base = {
    strategie: 'subvention-reee',
    titre: 'Subvention REEE non réclamée',
    titreClient: 'Aller chercher la subvention REEE de vos enfants',
    echeance: 'Cotiser avant le 31 décembre pour la subvention de l’année.',
    libelleMontant: 'de subvention laissée sur la table',
    recurrence: 'annuel' as const,
    sources: sourcesDe(profil, ['parametres-fiscaux SCEE/IQEE']),
    limiteVisibilite: null,
    dejaEnOrdre: false,
  };

  if (parametres === null) {
    return {
      ...base, statut: 'indisponible', portee: 'inconnue', montantEstime: null,
      explication: 'Les taux de subvention REEE ne sont pas au dossier des paramètres fiscaux.',
      donneesManquantes: ['les taux SCEE et IQEE de l’année'],
    };
  }

  const enfants = profil.demographie.enfants;
  if (enfants.length === 0) {
    return {
      ...base, statut: 'indisponible', portee: 'inconnue', montantEstime: null,
      explication:
        'Chaque dollar cotisé dans un REEE attire 30 % de subvention — 20 % du fédéral et 10 % du Québec — ' +
        'jusqu’à un plafond annuel par enfant. Encore faut-il savoir combien d’enfants sont bénéficiaires.',
      donneesManquantes: ['les enfants bénéficiaires d’un REEE'],
    };
  }

  // Ce qui a été cotisé cette année, par enfant nommé dans la note.
  const parEnfant = profil.cotisationsAnnee.reeeParEnfant ?? {};
  const plafond = parametres.cotisationSubventionnee;
  const taux = parametres.tauxScee + parametres.tauxIqee;

  const manquants = enfants
    .map((e) => {
      const cotise = parEnfant[normaliserPrenom(e.prenom)] ?? 0;
      return { prenom: e.prenom, cotise, reste: Math.max(0, plafond - cotise) };
    })
    .filter((x) => x.reste > 0);

  if (manquants.length === 0) {
    return {
      ...base, statut: 'non-applicable', portee: porteeDe(profil), montantEstime: null,
      dejaEnOrdre: true,
      explication:
        `Le plafond subventionné de ${argent(plafond)} est atteint cette année pour ` +
        `${enfants.length > 1 ? 'chaque enfant' : 'l’enfant'} : la subvention est entièrement captée.`,
      donneesManquantes: [],
    };
  }

  const aCotiser = manquants.reduce((s, x) => s + x.reste, 0);
  // ARRONDI AU CENT : 2 500 x 0,30 rend 750,0000000000001 en virgule flottante.
  // Un montant d'argent qui traine des decimales fantomes finit par sortir tel
  // quel quelque part -- dans un test, dans un export, ou sous les yeux du
  // client.
  const subvention = Math.round(aCotiser * taux * 100) / 100;
  const detail = manquants
    .map((x) => `${x.prenom} : ${argent(x.reste)} de plus`)
    .join(', ');

  // LA RÈGLE TRANSVERSALE S'APPLIQUE ICI AUSSI — corrigé le 13 août 2026.
  //
  // Cette stratégie était la seule à chiffrer sans jamais regarder
  // `comptesExternes`, en s'abritant derrière « le montant est un plancher ».
  // Le plancher ne tient pas : le plafond subventionné est PAR BÉNÉFICIAIRE,
  // tous REEE confondus. Une cotisation faite pour le même enfant dans une
  // autre institution consomme le même plafond et n'apparaît nulle part dans
  // notre livre. Un parent qui a déjà versé les 2 500 $ ailleurs lisait
  // « 750 $ laissés sur la table » — un chiffre faux qui pousse à sur-cotiser,
  // et sans `limiteVisibilite` le document n'en disait pas un mot.
  if (visibiliteEntamee(profil)) {
    return {
      ...base, statut: 'montant-a-confirmer', portee: 'interne-seulement', montantEstime: null,
      limiteVisibilite:
        'compté sur nos comptes seulement — le plafond subventionné est par enfant, tous REEE confondus : une cotisation faite ailleurs l’a peut-être déjà consommé.',
      explication:
        `D’après les cotisations vues ici, il resterait ${argent(aCotiser)} à verser avant la fin de l’année ` +
        `pour capter jusqu’à ${argent(subvention)} de subvention (${detail}). Le montant reste à confirmer : ` +
        'le plafond subventionné se compte par enfant, tous REEE confondus, et une cotisation versée dans un ' +
        'REEE détenu ailleurs l’aurait déjà entamé.',
      donneesManquantes: ['les cotisations REEE versées ailleurs cette année'],
    };
  }

  return {
    ...base,
    statut: 'calcule',
    portee: porteeDe(profil),
    montantEstime: subvention,
    explication:
      `${argent(aCotiser)} de cotisation supplémentaire avant la fin de l’année attireraient ` +
      `${argent(subvention)} de subvention — ${Math.round(taux * 100)} % versés par les gouvernements ` +
      `(${detail}). Cette subvention ne se reporte pas indéfiniment : ce qui n’est pas demandé se perd. ` +
      `Le montant est un plancher : des droits inutilisés d’années passées l’augmenteraient.`,
    donneesManquantes: [],
  };
}

/** Le prénom, réduit à ce qui se compare : sans accent, sans casse, sans chiffre. */
export function normaliserPrenom(prenom: string): string {
  return (prenom ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase();
}

export type ParametresReee = {
  tauxScee: number;
  tauxIqee: number;
  cotisationSubventionnee: number;
};


// ─────────────────────────────────────────────────────────────────────────────
// STRATÉGIE 8 · DROITS DE COTISATION INUTILISÉS — « voici l'espace »
// ─────────────────────────────────────────────────────────────────────────────

/**
 * L'espace de cotisation encore ouvert, régime par régime — la demande du
 * 12 août : « en date d'aujourd'hui, voici l'espace (à vérifier sur le site de
 * l'ARC), et voici ce qui serait intéressant de faire ».
 *
 * CELI : le verdict vient de la MÊME chaîne que l'écran (calculerDroitsCeli via
 * les signaux du livre) — trois conditions, borne sinon. Le signal de
 * MAXIMISATION éclaire la question n° 1 sans jamais y répondre : « au plafond
 * chaque année » est une probabilité à confirmer d'un mot ; « dépasse ce que le
 * plafond permet » est une preuve d'historique externe.
 *
 * REER : INCALCULABLE D'ICI PAR CONSTRUCTION — il faut le revenu gagné et le
 * facteur d'équivalence, que seul l'avis de cotisation porte. Si le montant de
 * l'avis est saisi dans la fiche, il s'affiche daté ; sinon c'est la question.
 *
 * Le « petit disclaimer » demandé est dans chaque branche : l'ARC fait foi,
 * jamais ce document — une cotisation excédentaire coûte 1 % par mois.
 */
function strategieDroitsCotisation(
  profil: ProfilClient,
  signaux: SignauxLivre | null
): Constat {
  const base = {
    strategie: 'droits-cotisation',
    titre: 'Droits de cotisation inutilisés',
    titreClient: 'L’espace d’abri fiscal qui vous attend',
    libelleMontant: 'de droits CELI encore ouverts',
    recurrence: 'unique' as const,
    sources: sourcesDe(profil, ['plafonds CELI parametres-fiscaux.csv']),
    limiteVisibilite: null,
    dejaEnOrdre: false,
    echeance: 'Aucune échéance : les droits inutilisés se reportent indéfiniment — mais chaque année qui passe reporte aussi le rendement à l’abri.',
  };

  const droits = signaux?.droitsCeli ?? null;
  if (droits === null) {
    return {
      ...base, statut: 'indisponible', portee: 'inconnue', montantEstime: null,
      explication:
        'L’espace CELI se mesure sur l’historique complet des cotisations. Sans l’historique importé, rien n’est calculable.',
      donneesManquantes: ['l’historique complet des transactions (import)'],
    };
  }

  // La phrase du REER — toujours honnête sur son incalculabilité.
  const reer = profil.droits.reerInutilises;
  const phraseReer = reer.montant !== null
    ? ` Côté REER : ${argent(reer.montant)} selon l’avis de cotisation${reer.dateDonnee ? ` (saisi le ${reer.dateDonnee})` : ''} — ce chiffre ne peut venir que de là.`
    : ' Côté REER : l’espace ne peut pas se calculer d’ici (revenu gagné et facteur d’équivalence requis) — c’est le chiffre de l’avis de cotisation à rapporter.';

  // Le signal de maximisation — il ÉCLAIRE, il ne répond pas.
  const m = signaux?.maximisation ?? null;
  let phraseMotif = '';
  if (m && m.etat === 'maximise' && m.depuis !== null) {
    phraseMotif = ` Le motif des cotisations — au plafond chaque année depuis ${m.depuis} — suggère que le client cotise seulement ici ; un mot en rencontre le confirme.`;
  } else if (m && m.etat === 'sous-plafond') {
    phraseMotif = ` Des années sous le plafond (${m.anneesSousPlafond.slice(0, 4).join(', ')}${m.anneesSousPlafond.length > 4 ? '…' : ''}) : de la place laissée libre, ou des cotisations faites ailleurs — c’est exactement la question à poser.`;
  } else if (m && m.etat === 'depasse-cumul') {
    // PAS DE « ⚠ » ICI : ce texte est rendu par @react-pdf, et U+26A0 est absent
    // des quatre polices embarquées — il s'imprimait en carré vide sur le
    // document. Un signe d'attention se dit avec des mots dans un document remis.
    phraseMotif = ` À noter : les cotisations vues ici (${argent(m.totalCotise)}) dépassent ce que le plafond de la période permet (${argent(m.plafondPeriode)}, retraits compris) : c’est la preuve d’un historique externe — des droits ont été créés ailleurs.`;
  }

  const disclaimer = ' Avant toute cotisation, le chiffre à croire est celui de Mon dossier ARC — une cotisation excédentaire coûte 1 % par mois.';

  if (droits.statut === 'calcule' && droits.montant !== null) {
    if (droits.montant <= 0) {
      return {
        ...base, statut: 'non-applicable', portee: porteeDe(profil), montantEstime: null,
        ...sousReserveDeVisibilite(
          profil, true,
          'plein d’après les cotisations vues ici — un CELI détenu ailleurs ne ferait que confirmer l’absence de place.'
        ),
        explication: `Le CELI est plein : aucun droit inutilisé au dossier.${phraseReer}${disclaimer}`,
        donneesManquantes: [],
      };
    }

    // LES DEUX QUESTIONS NE SONT PAS LA MÊME — corrigé le 13 août 2026.
    //
    // `calculerDroitsCeli` ne vérifie que `historiqueExterne` (« as-tu déjà eu
    // un CELI ailleurs ? »). `comptesExternes` (« as-tu des comptes ailleurs ? »)
    // se saisit séparément, et rien ne les croise. Un client qui répond « oui,
    // j'ai un compte de placement ailleurs » et « non, jamais eu de CELI
    // ailleurs » sortait donc en montant CALCULÉ, portée COMPLÈTE, avec la
    // phrase « aucun compte ailleurs confirmé » — factuellement fausse, sur le
    // seul constat du document qui pousse à poser un geste chiffré.
    //
    // On applique la règle transversale, comme l'en-tête de ce fichier le
    // prescrit : la borne se dit, le montant ferme attend la consolidation.
    // (Fiscalement, le chiffre serait probablement exact — les droits CELI ne
    // dépendent que des cotisations CELI. C'est un choix de PRUDENCE assumé :
    // une cotisation excédentaire coûte 1 % par mois, et le client qui confirme
    // « aucun compte ailleurs » récupère le montant ferme aussitôt.)
    if (visibiliteEntamee(profil)) {
      return {
        ...base, statut: 'montant-a-confirmer', portee: 'interne-seulement', montantEstime: null,
        limiteVisibilite:
          'le client a confirmé n’avoir jamais eu de CELI ailleurs, mais il détient des comptes ailleurs : le chiffre ferme attend cette confirmation.',
        explication:
          `Vu d’ici, ${argent(droits.montant)} d’espace CELI restent ouverts — l’historique est complet et les ` +
          'transferts sont tranchés, mais le client détient des comptes ailleurs : tant que ce point n’est pas ' +
          `confirmé, ce chiffre reste une borne.${phraseMotif}${phraseReer}${disclaimer}`,
        donneesManquantes: ['la confirmation qu’aucun compte n’est détenu ailleurs'],
      };
    }

    return {
      ...base, statut: 'calcule', portee: 'complete', montantEstime: droits.montant,
      explication:
        `En date du dossier, ${argent(droits.montant)} d’espace CELI restent ouverts — les trois conditions sont réunies ` +
        `(historique complet, aucun compte ailleurs confirmé, transferts tranchés).${phraseMotif}${phraseReer}${disclaimer}`,
      donneesManquantes: [],
    };
  }

  const borne = droits.borne;
  return {
    ...base,
    statut: 'montant-a-confirmer',
    portee: droits.portee,
    montantEstime: null,
    limiteVisibilite:
      'l’espace CELI vu d’ici est une borne — les cotisations faites ailleurs le réduiraient.',
    explication:
      (borne !== null
        ? `Vu d’ici, jusqu’à ${argent(borne)} d’espace CELI pourraient être ouverts — c’est une borne, pas le droit réel : ${droits.conditionsManquantes.join(' ; ')}.`
        : `L’espace CELI n’est pas calculable : ${droits.conditionsManquantes.join(' ; ')}.`) +
      phraseMotif + phraseReer + disclaimer,
    donneesManquantes: droits.conditionsManquantes,
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
  date: string,
  parametresReee: ParametresReee | null = null,
  signaux: SignauxLivre | null = null
): ResultatAnalyse {
  const constats: Constat[] = [
    strategieCristallisation(profil),
    strategieCristallisationGains(profil),
    strategieDroitsCotisation(profil, signaux),
    strategieLocalisation(profil),
    strategieCeliConjoint(profil),
    strategieDonTitres(profil),
    strategieReee(profil, parametresReee),
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

// ─────────────────────────────────────────────────────────────────────────────
// LE DÉTECTEUR ACTIONNABLE — « la donnée qui en débloquerait le plus »
// ─────────────────────────────────────────────────────────────────────────────

export type ManqueClasse = {
  /** La donnée manquante, telle que le constat la nomme. */
  donnee: string;
  /** Combien de pistes elle bloque. */
  bloque: number;
  /**
   * Combien de pistes deviennent chiffrables DÈS QU'ON RÉPOND — celles dont
   * c'est la SEULE donnée manquante.
   *
   * C'est le vrai critère d'utilité, et le compte brut ne le donne pas :
   * une donnée qui bloque trois pistes ayant chacune deux autres trous ne
   * débloque rien tout de suite ; une donnée qui bloque une seule piste,
   * mais qui en est le dernier verrou, la rend chiffrée à l'instant.
   */
  debloqueImmediatement: number;
  /** Lesquelles — pour que l'écran puisse le montrer. */
  strategies: string[];
};

/**
 * Les données manquantes, CLASSÉES PAR CE QU'ELLES DÉBLOQUENT.
 *
 * Principe central de l'écran, arrêté le 5 août : une liste de « donnée
 * manquante » ne fait rien faire à personne. Dire « la donnée qui débloquerait
 * le plus : l'âge — elle ouvre 3 pistes » transforme un constat d'échec en
 * prochaine action. C'est ça, un détecteur d'opportunités : il ne dit pas
 * seulement ce qu'il a trouvé, il dit comment trouver le reste.
 *
 * On compte les constats BLOQUÉS — `indisponible` et `montant-a-confirmer` —
 * et jamais les `non-applicable` : une piste sans objet ne se débloque pas, et
 * la faire figurer gonflerait artificiellement l'intérêt d'une question.
 */
export function classerManques(resultat: ResultatAnalyse): ManqueClasse[] {
  const par = new Map<string, ManqueClasse>();
  for (const c of resultat.constats) {
    if (c.statut !== 'indisponible' && c.statut !== 'montant-a-confirmer') continue;
    const dernierVerrou = c.donneesManquantes.length === 1;
    for (const d of c.donneesManquantes) {
      const e = par.get(d) ?? { donnee: d, bloque: 0, debloqueImmediatement: 0, strategies: [] };
      e.bloque += 1;
      if (dernierVerrou) e.debloqueImmediatement += 1;
      e.strategies.push(c.titre);
      par.set(d, e);
    }
  }
  // Ce qui débloque TOUT DE SUITE d'abord ; à égalité, ce qui bloque le plus.
  return [...par.values()].sort(
    (a, b) =>
      b.debloqueImmediatement - a.debloqueImmediatement ||
      b.bloque - a.bloque ||
      a.donnee.localeCompare(b.donnee)
  );
}

export type EtatDetection = {
  chiffrees: number;
  aConfirmer: number;
  bloquees: number;
  dejaEnOrdre: number;
  total: number;
  /** La donnée qui débloquerait le plus de pistes, ou `null` s'il n'en manque aucune. */
  prochainePriorite: ManqueClasse | null;
};

/** Le tableau de bord du détecteur : où en est-on, et quoi faire ensuite. */
export function etatDetection(resultat: ResultatAnalyse): EtatDetection {
  const manques = classerManques(resultat);
  return {
    chiffrees: resultat.constats.filter((c) => c.statut === 'calcule').length,
    aConfirmer: resultat.constats.filter((c) => c.statut === 'montant-a-confirmer').length,
    bloquees: resultat.constats.filter((c) => c.statut === 'indisponible').length,
    dejaEnOrdre: resultat.constats.filter((c) => c.dejaEnOrdre).length,
    total: resultat.constats.length,
    prochainePriorite: manques[0] ?? null,
  };
}
