// LES GESTES ET LEURS DÉMARCHES — ce qu'il faut faire, étape par étape.
//
// Un constat dit CE QUI EST. Un geste dit CE QU'ON FAIT. Les démarches disent
// COMMENT. Sans elles, une section fiscale se lit comme un diagnostic sans
// ordonnance : le client repart en sachant qu'il y a quelque chose à faire,
// sans savoir quoi.
//
// ─────────────────────────────────────────────────────────────────────────────
// GABARITS DÉTERMINISTES, jamais un modèle de langage.
//
// Chaque démarche est une chaîne construite ici, à partir des seuls nombres du
// constat. Rien n'est généré, rien n'est approximé. C'est ce qui permet à un
// fiscaliste de lire ce fichier et de valider CHAQUE phrase que le client
// recevra — il y en a un nombre fini et elles sont toutes ici.
//
// La couche de reformulation (reformuler.ts, DÉBRANCHÉE) pourra un jour polir
// ces phrases ; elle ne pourra jamais en inventer une.
//
// ⚠ CES GABARITS PORTENT DES RÈGLES FISCALES (délai de règlement, perte
// apparente de 30 jours, pénalité de 1 % par mois). Ils tombent sous le même
// verrou que le reste : `revisionFiscalisteRequise` reste vrai tant qu'un
// fiscaliste ne les a pas relus, un par un.
// ─────────────────────────────────────────────────────────────────────────────

import type { Constat } from './strategies';

export type Geste = {
  /** Ce qu'on fait — une phrase, à l'infinitif. */
  libelle: string;
  /** Comment on le fait — les étapes, dans l'ordre. */
  demarches: string[];
  /** Qui pose le geste. Le client ne doit pas croire qu'il doit tout faire. */
  porteur: 'client' | 'conseiller' | 'les-deux';
};

const argent = (n: number) => `${Math.round(n).toLocaleString('fr-CA')} $`;

/**
 * Les gestes d'un constat.
 *
 * AUCUN GESTE quand le constat n'a rien d'actionnable — `indisponible`,
 * `non-applicable`. Proposer une marche à suivre pour une piste qu'on ne peut
 * pas chiffrer serait mettre la charrue devant les bœufs : ce qu'il faut
 * d'abord, c'est la donnée manquante, et elle est déjà nommée ailleurs.
 */
export function gestesDe(constat: Constat): Geste[] {
  if (constat.statut !== 'calcule' && constat.statut !== 'montant-a-confirmer') return [];
  const gabarit = GABARITS[constat.strategie];
  return gabarit ? gabarit(constat) : [];
}

const GABARITS: Record<string, (c: Constat) => Geste[]> = {
  // ── 1 · Cristallisation de pertes ──────────────────────────────────────────
  'cristallisation-pertes': (c) => {
    const montant = c.montantEstime;
    return [
      {
        libelle: 'Vendre les positions en perte avant la fin de l’année',
        porteur: 'les-deux',
        demarches: [
          'Revoir ensemble la liste des positions en perte et choisir celles que vous acceptez de vendre.',
          montant !== null
            ? `Passer les ordres de vente pour environ ${argent(montant)} de perte.`
            : 'Établir le montant exact une fois les positions détenues ailleurs connues.',
          'Passer les ordres assez tôt en décembre : c’est la date de règlement, pas la date de l’ordre, qui détermine l’année fiscale.',
          'Ne pas racheter le même titre dans les 30 jours suivant la vente, ni avant : la perte serait refusée.',
        ],
      },
      {
        libelle: 'Rester investi pendant le délai',
        porteur: 'conseiller',
        demarches: [
          'Choisir un titre de remplacement au profil semblable, sans être identique, pour la période de 30 jours.',
          'Remettre le portefeuille dans sa cible une fois le délai écoulé.',
        ],
      },
    ];
  },


  // ── 7 · Cristallisation de gains ───────────────────────────────────────────
  'cristallisation-gains': (c) => [
    {
      libelle: 'Vendre puis racheter les positions gagnantes, à hauteur des pertes disponibles',
      porteur: 'les-deux',
      demarches: [
        'Confirmer le montant exact des pertes reportées sur l’avis de cotisation — c’est la seule source qui fait foi.',
        c.montantEstime !== null
          ? `Vendre pour environ ${argent(c.montantEstime)} de gain, puis racheter les mêmes titres — permis le jour même : la règle des 30 jours ne vise que les pertes.`
          : 'Établir le montant exact une fois les comptes détenus ailleurs connus.',
        'Le portefeuille ne change pas ; seul le prix de base remonte, ce qui réduit l’impôt d’une vente future. Aucune échéance : une perte reportée ne périme pas.',
      ],
    },
  ],

  // ── 3 · CELI du conjoint ───────────────────────────────────────────────────
  'celi-conjoint': (c) => {
    const montant = c.montantEstime;
    return [
      {
        libelle: 'Ouvrir ou alimenter le CELI du conjoint',
        porteur: 'les-deux',
        demarches: [
          'Confirmer le montant de droits sur l’avis de cotisation du conjoint — c’est la seule source qui fait foi.',
          montant !== null
            ? `Transférer jusqu’à ${argent(montant)} depuis les placements non enregistrés.`
            : 'Confirmer d’abord qu’aucun compte n’est détenu ailleurs : une cotisation excédentaire coûte 1 % par mois.',
          'Vérifier l’effet du transfert : une position en gain déclenche l’impôt sur ce gain au moment du transfert.',
        ],
      },
    ];
  },

  // ── 4 · Don de titres à gain latent ────────────────────────────────────────
  'don-titres': (c) => [
    {
      libelle: 'Donner le titre plutôt que l’argent',
      porteur: 'les-deux',
      demarches: [
        'Confirmer avec l’organisme qu’il accepte les dons en titres et obtenir ses coordonnées de compte.',
        'Nous transmettre le formulaire de transfert : le titre doit passer directement de votre compte au sien.',
        'Ne pas vendre le titre avant : c’est le transfert direct qui annule l’impôt sur le gain.',
        c.montantEstime !== null
          ? `Le reçu portera la pleine valeur du titre au jour du transfert, et ${argent(c.montantEstime)} de gain ne seront pas imposés.`
          : 'Le reçu portera la pleine valeur du titre au jour du transfert.',
      ],
    },
  ],

  // ── 5 · Ordre de vente vers le portefeuille cible ──────────────────────────
  'ordre-vente': () => [
    {
      libelle: 'Étaler les ventes sur deux années civiles',
      porteur: 'conseiller',
      demarches: [
        'Vendre d’abord les positions en perte, puis les plus petits gains.',
        'Reporter à janvier ce qui ferait passer le gain de l’année au-delà de votre seuil habituel.',
        'Vous soumettre l’ordre proposé avant de passer la première transaction.',
      ],
    },
  ],
};

/**
 * Les constats qui n'appellent AUCUN geste parce que la situation est déjà
 * correcte — la matière de la section « Déjà en ordre ».
 *
 * À ne pas confondre avec `indisponible` : là il manque une donnée, et c'est
 * une question à poser. Ici il n'y a rien à faire, et le dire rassure. Un
 * document qui ne parle que de ce qui cloche laisse croire que tout cloche.
 */
export function estDejaEnOrdre(constat: Constat): boolean {
  return constat.statut === 'non-applicable' && constat.dejaEnOrdre;
}
