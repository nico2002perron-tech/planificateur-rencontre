// LES BADGES DU PROFIL — d'où vient chaque champ, et depuis quand.
//
// Trois couleurs, une seule règle par couleur (section 4 du plan) :
//   vert  = rempli automatiquement depuis Croesus
//   jaune = saisi à la main ; à reconfirmer passé 12 mois
//   gris  = manquant
//
// TypeScript pur. Aucune décision d'affichage ici : on rend un état, l'écran
// choisit ses couleurs.

import type { ProfilClient } from './types';

export type CouleurBadge = 'auto' | 'manuel' | 'manquant';

export type Badge = {
  champ: string;
  libelle: string;
  couleur: CouleurBadge;
  /** Valeur lisible, ou null si le champ est vide. */
  valeur: string | null;
  /** Date de la donnée, quand elle en porte une. */
  date: string | null;
  /** Vrai si la donnée manuelle a plus de 12 mois. */
  aReconfirmer: boolean;
  /** Ce qu'il faut demander au client — alimente les questions de rencontre. */
  question: string | null;
};

const MOIS_AVANT_RECONFIRMATION = 12;

function moisEcoules(date: string | null, aujourdhui: string): number | null {
  if (!date) return null;
  const d = new Date(date);
  const a = new Date(aujourdhui);
  if (Number.isNaN(d.getTime()) || Number.isNaN(a.getTime())) return null;
  return (a.getFullYear() - d.getFullYear()) * 12 + (a.getMonth() - d.getMonth());
}

const argent = (n: number) => `${Math.round(n).toLocaleString('fr-CA')} $`;

/**
 * Construit un badge manuel : jaune s'il est rempli, gris sinon, avec le
 * drapeau de reconfirmation quand la donnée vieillit.
 */
function badgeManuel(
  champ: string,
  libelle: string,
  valeur: string | null,
  date: string | null,
  aujourdhui: string,
  question: string
): Badge {
  const mois = moisEcoules(date, aujourdhui);
  return {
    champ,
    libelle,
    couleur: valeur === null ? 'manquant' : 'manuel',
    valeur,
    date,
    aReconfirmer: valeur !== null && mois !== null && mois >= MOIS_AVANT_RECONFIRMATION,
    question: valeur === null ? question : null,
  };
}

/** Un badge automatique : vert s'il est rempli, gris sinon. */
function badgeAuto(champ: string, libelle: string, valeur: string | null, date: string | null): Badge {
  return {
    champ,
    libelle,
    couleur: valeur === null ? 'manquant' : 'auto',
    valeur,
    date,
    aReconfirmer: false,
    question: null,
  };
}

/**
 * L'état de tous les champs du profil, dans l'ordre où ils comptent en
 * rencontre : la consolidation d'abord (question n° 1), puis les droits, le
 * conjoint, les intentions.
 */
export function badgesProfil(profil: ProfilClient, aujourdhui: string): Badge[] {
  const c = profil.consolidation;
  const d = profil.droits;
  const badges: Badge[] = [];

  // ── Consolidation — LA question de rencontre n° 1 ──
  badges.push(badgeManuel(
    'consolidation.comptesExternes',
    'Comptes ailleurs aujourd’hui',
    c.comptesExternes === 'inconnu' ? null : c.comptesExternes,
    c.dateConfirmation,
    aujourdhui,
    'Détenez-vous des comptes de placement ailleurs qu’ici ?'
  ));
  badges.push(badgeManuel(
    'consolidation.historiqueExterne',
    'A déjà eu des comptes ailleurs',
    c.historiqueExterne === 'inconnu' ? null : c.historiqueExterne,
    c.dateConfirmation,
    aujourdhui,
    'Avez-vous déjà eu un CELI ailleurs, même fermé depuis ?'
  ));

  // ── Les transferts à trancher : un badge à part, parce que c'est le levier ──
  const aTrancher = c.transfertsResolus.length;
  badges.push({
    champ: 'consolidation.transfertsResolus',
    libelle: 'Transferts entrants tranchés',
    couleur: aTrancher > 0 ? 'manuel' : 'manquant',
    valeur: aTrancher > 0 ? `${aTrancher} confirmé${aTrancher > 1 ? 's' : ''}` : null,
    date: c.transfertsResolus.at(-1)?.dateConfirmation ?? null,
    aReconfirmer: false,
    question: aTrancher === 0 ? 'D’où venaient les transferts entrants de ce compte ?' : null,
  });

  // ── Droits — source autoritaire : l'avis de cotisation ──
  const droits: Array<[string, string, { montant: number | null; dateDonnee: string | null }, string]> = [
    ['droits.reerInutilises', 'Droits REER inutilisés', d.reerInutilises,
      'Quel est votre montant de droits REER inutilisés (avis de cotisation) ?'],
    ['droits.celiInutilises', 'Droits CELI inutilisés', d.celiInutilises,
      'Quel est votre montant de droits CELI (Mon dossier ARC) ?'],
    ['droits.celiConjointInutilises', 'Droits CELI du conjoint', d.celiConjointInutilises,
      'Votre conjoint a-t-il des droits CELI inutilisés ?'],
    ['droits.pertesCapitalReportees', 'Pertes en capital reportées', d.pertesCapitalReportees,
      'Avez-vous des pertes en capital reportées d’années passées ?'],
  ];
  for (const [champ, libelle, m, question] of droits) {
    badges.push(badgeManuel(
      champ, libelle,
      m.montant === null ? null : argent(m.montant),
      m.dateDonnee, aujourdhui, question
    ));
  }

  // ── Revenus, conjoint, intentions ──
  badges.push(badgeManuel(
    'revenus.trancheRevenu', 'Tranche de revenu',
    profil.revenus.trancheRevenu, profil.revenus.dateDonnee, aujourdhui,
    'Dans quelle tranche se situe votre revenu imposable ?'
  ));
  badges.push(badgeManuel(
    'demographie.conjoint.trancheRevenu', 'Revenu du conjoint',
    profil.demographie.conjoint.trancheRevenu, null, aujourdhui,
    'Dans quelle tranche se situe le revenu de votre conjoint ?'
  ));
  badges.push(badgeManuel(
    'intentions.donsAnnuelsMoyens', 'Dons annuels',
    profil.intentions.donsAnnuelsMoyens === null ? null : argent(profil.intentions.donsAnnuelsMoyens),
    null, aujourdhui,
    'Faites-vous des dons de bienfaisance chaque année ?'
  ));
  badges.push(badgeManuel(
    'intentions.ageRetraiteVise', 'Âge de retraite visé',
    profil.intentions.ageRetraiteVise === null ? null : `${profil.intentions.ageRetraiteVise} ans`,
    null, aujourdhui,
    'À quel âge visez-vous la retraite ?'
  ));

  // ── Automatiques, dérivés de Croesus ──
  const h = profil.historiqueVie.celi;
  badges.push(badgeAuto(
    'historiqueVie.celi', 'Historique CELI importé',
    h.dateImport === null ? null
      : `depuis ${h.dateOuverture ?? '?'} · ${argent(h.cotisationsTotales ?? 0)} cotisés`,
    h.dateImport
  ));
  badges.push(badgeAuto(
    'cotisationsAnnee', 'Cotisations de l’année',
    `REER ${argent(profil.cotisationsAnnee.reer)} · CELI ${argent(profil.cotisationsAnnee.celi)}`,
    profil.dateMiseAJour
  ));
  badges.push(badgeAuto(
    'comptes', 'Comptes et positions',
    profil.comptes.length === 0 ? null
      : `${profil.comptes.length} compte${profil.comptes.length > 1 ? 's' : ''}`,
    profil.dateMiseAJour
  ));

  return badges;
}

/**
 * Les questions de rencontre, dans l'ordre d'impact du schéma :
 * comptesExternes d'abord, puis droits, puis conjoint, puis intentions.
 */
export function questionsRencontre(badges: Badge[]): string[] {
  const ordre = (champ: string): number => {
    if (champ.startsWith('consolidation')) return 0;
    if (champ.startsWith('droits')) return 1;
    if (champ.includes('conjoint')) return 2;
    if (champ.startsWith('revenus')) return 3;
    return 4;
  };
  return badges
    .filter((b) => b.question !== null)
    .sort((a, b) => ordre(a.champ) - ordre(b.champ))
    .map((b) => b.question as string);
}

/** Le compte des champs par couleur — pour l'en-tête de l'écran. */
export function resumeBadges(badges: Badge[]): Record<CouleurBadge, number> & { aReconfirmer: number } {
  const r = { auto: 0, manuel: 0, manquant: 0, aReconfirmer: 0 };
  for (const b of badges) {
    r[b.couleur] += 1;
    if (b.aReconfirmer) r.aReconfirmer += 1;
  }
  return r;
}
