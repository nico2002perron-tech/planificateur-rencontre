// LES DROITS CELI — la règle des trois conditions du schéma, plus la
// résolution manuelle des transferts orphelins (ajout du 4 août 2026).
//
// TypeScript pur. Aucun taux codé en dur : le plafond vient d'un paramètre
// fourni par l'appelant (à terme, config/parametres-fiscaux.csv).

import type { ProfilClient, StatutConstat, Portee, TransfertResolu } from './types';
import { cleTransfert } from './types';
import { canoniserCompte } from '@/lib/parseur-croesus/identifiant-compte';

/** Un transfert entrant tel que le parseur l'a vu. */
export type TransfertObserve = {
  compte: string;
  date: string;
  montant: number;
  /** Le parseur a-t-il reconnu une note d'appariement ? (règle 3) */
  apparie: boolean;
  note: string;
};

export type TransfertDouteux = TransfertObserve & {
  cle: string;
  /** Résolution manuelle si le planificateur l'a tranché. */
  resolution: 'interne' | 'externe' | null;
  dateConfirmation: string | null;
};

/**
 * Croise les transferts observés avec les résolutions manuelles du profil.
 *
 * Un transfert reste DOUTEUX s'il n'est ni apparié automatiquement (règle 3)
 * ni résolu à la main. C'est cette liste que l'écran Profil présente, une
 * ligne datée à la fois.
 */
export function croiserTransferts(
  observes: TransfertObserve[],
  resolus: TransfertResolu[]
): TransfertDouteux[] {
  // DEUX ENTRÉES PAR RÉSOLUTION : la clé telle qu'elle a été écrite, et sa
  // réécriture canonique. Les résolutions enregistrées avant le 5 août 2026
  // portent le compte avec ses tirets ; sans ce repli, le travail de rencontre
  // déjà fait par le planificateur serait silencieusement perdu.
  const parCle = new Map<string, TransfertResolu>();
  for (const r of resolus) {
    parCle.set(r.cle, r);
    const [compte, ...reste] = r.cle.split('|');
    const canonique = [canoniserCompte(compte), ...reste].join('|');
    if (!parCle.has(canonique)) parCle.set(canonique, r);
  }

  return observes
    .filter((t) => !t.apparie)
    .map((t) => {
      const cle = cleTransfert(t.compte, t.date, t.montant);
      const r = parCle.get(cle);
      return {
        ...t,
        cle,
        resolution: r?.resolution ?? null,
        dateConfirmation: r?.dateConfirmation ?? null,
      };
    });
}

/**
 * Un transfert encore douteux subsiste-t-il ?
 *
 * C'est la LECTURE CORRIGÉE de la condition 3 du schéma : elle porte sur les
 * transferts ENCORE DOUTEUX, pas sur les transferts détectés. Un orphelin
 * marqué « interne » cesse de compter ; un orphelin non tranché continue de
 * bloquer (règle 4 : dans le doute, la borne).
 */
export function resteUnDouteTransfert(douteux: TransfertDouteux[]): boolean {
  return douteux.some((t) => t.resolution !== 'interne');
}

export type ResultatDroitsCeli = {
  statut: StatutConstat;
  portee: Portee;
  /** Rempli seulement si statut = 'calcule'. */
  montant: number | null;
  /** Toujours rempli quand le plafond est connu : la borne supérieure. */
  borne: number | null;
  /** Ce qui manque pour passer de la borne au montant. */
  conditionsManquantes: string[];
  /** Combien de transferts restent à trancher — le levier de l'écran Profil. */
  transfertsATrancher: number;
};

/**
 * Calcule les droits CELI, ou la borne quand une condition manque.
 *
 * Les trois conditions du schéma :
 *   1. l'historique CELI est importé et couvre depuis l'ouverture ;
 *   2. `historiqueExterne = "jamais"`, confirmé et daté ;
 *   3. aucun transfert entrant ne reste douteux.
 *
 * Réunies → montant calculé, portée complète.
 * Sinon → borne supérieure théorique, statut `montant-a-confirmer`, jamais un
 * montant présenté comme certain. Un droit surestimé coûte au client 1 % de
 * pénalité par mois ; une borne prudente coûte une question de plus.
 */
export function calculerDroitsCeli(
  profil: ProfilClient,
  transfertsDouteux: TransfertDouteux[],
  /** Plafond cumulatif théorique selon l'âge, fourni par les paramètres fiscaux. */
  plafondTheorique: number | null
): ResultatDroitsCeli {
  const h = profil.historiqueVie.celi;
  const conditionsManquantes: string[] = [];

  const aTrancher = transfertsDouteux.filter((t) => t.resolution === null).length;
  const externeConfirme = transfertsDouteux.some((t) => t.resolution === 'externe');

  // Condition 1 — l'historique est-il importé ?
  const historiqueImporte = h.dateImport !== null && h.cotisationsTotales !== null && h.dateOuverture !== null;
  if (!historiqueImporte) {
    conditionsManquantes.push("l'historique complet du CELI n'a pas été importé");
  }

  // Condition 2 — le client a-t-il confirmé n'avoir jamais eu de compte ailleurs ?
  if (profil.consolidation.historiqueExterne !== 'jamais') {
    conditionsManquantes.push(
      profil.consolidation.historiqueExterne === 'deja-eu'
        ? 'le client a déjà eu des comptes ailleurs'
        : "le client n'a pas confirmé n'avoir jamais eu de compte ailleurs"
    );
  }

  // Condition 3 — reste-t-il un transfert douteux ?
  if (resteUnDouteTransfert(transfertsDouteux)) {
    conditionsManquantes.push(
      externeConfirme
        ? 'un transfert entrant est confirmé externe'
        : `${aTrancher} transfert(s) entrant(s) restent à trancher avec le client`
    );
  }

  if (plafondTheorique === null) {
    return {
      statut: 'indisponible',
      portee: 'inconnue',
      montant: null,
      borne: null,
      conditionsManquantes: [...conditionsManquantes, 'plafond théorique inconnu pour cet âge'],
      transfertsATrancher: aTrancher,
    };
  }

  const cotisations = h.cotisationsTotales ?? 0;
  const retraits = h.retraitsAnneesPassees ?? 0;
  const borne = Math.max(0, plafondTheorique - cotisations + retraits);

  if (conditionsManquantes.length === 0) {
    return {
      statut: 'calcule',
      portee: 'complete',
      montant: borne,
      borne,
      conditionsManquantes: [],
      transfertsATrancher: 0,
    };
  }

  return {
    statut: 'montant-a-confirmer',
    portee: profil.consolidation.comptesExternes === 'non' ? 'declaree' : 'interne-seulement',
    montant: null,
    borne,
    conditionsManquantes,
    transfertsATrancher: aTrancher,
  };
}
