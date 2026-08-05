// LA COUCHE DE REFORMULATION — DÉBRANCHÉE.
//
// Spécification : docs/prompt-reformulation-v1.md. Le moteur reste l'AUTEUR ;
// le LLM n'est qu'un réviseur de style, et il n'est pas branché.
//
// ─────────────────────────────────────────────────────────────────────────────
// ÉTAT : AUCUN APPEL RÉSEAU N'EST POSSIBLE DEPUIS CE FICHIER.
//
// `reformuler()` ne connaît aucun fournisseur, aucune clé, aucune URL. Elle
// reçoit un `appelLLM` en paramètre ; sans lui, elle rend le texte source tel
// quel. Tant qu'aucun appelant ne fournit cette fonction — et aucun ne le fait
// aujourd'hui — rien ne peut sortir de la machine, même par accident de
// configuration. Le branchement attend le feu de la conformité iA.
//
// CE QUI EXISTE DÉJÀ, ET QUI EST TESTÉ : la vérification aval. C'est la partie
// qui protège le client, donc c'est la partie qui existe en premier. Elle se
// relit et se teste sans aucun modèle.
// ─────────────────────────────────────────────────────────────────────────────

import type { Constat } from './strategies';

export type StyleReformulation = {
  /** En mots. La sortie est repliée au-delà de +20 %. */
  longueurMax: number;
  niveau: 'grand public' | 'initie';
  contexte: string;
};

export const STYLE_PAR_DEFAUT: StyleReformulation = {
  longueurMax: 80,
  niveau: 'grand public',
  contexte: 'document de rencontre remis en main propre',
};

/**
 * La fonction d'appel, fournie par l'appelant — jamais construite ici.
 *
 * Sa signature ne mentionne ni fournisseur ni modèle : ce fichier ne doit pas
 * pouvoir en désigner un. Elle reçoit la charge utile déjà pseudonymisée.
 */
export type AppelLLM = (charge: ChargeReformulation) => Promise<string>;

export type ChargeReformulation = {
  texteSource: string;
  reference: ReferenceConstat;
  style: StyleReformulation;
};

/**
 * La référence transmise — PSEUDONYMISÉE PAR CONSTRUCTION.
 *
 * Aucun nom, aucun numéro de compte, aucun identifiant client. On ne « retire »
 * pas ces champs d'un objet plus gros : on construit un objet qui ne les a
 * jamais portés. Un oubli de filtrage est un risque ; un champ inexistant n'en
 * est pas un.
 */
export type ReferenceConstat = {
  strategie: string;
  statut: Constat['statut'];
  montantEstime: number | null;
  libelleMontant: string;
  recurrence: Constat['recurrence'];
  donneesManquantes: string[];
  limiteVisibilite: string | null;
};

export function referencePour(constat: Constat): ReferenceConstat {
  return {
    strategie: constat.strategie,
    statut: constat.statut,
    montantEstime: constat.montantEstime,
    libelleMontant: constat.libelleMontant,
    recurrence: constat.recurrence,
    donneesManquantes: [...constat.donneesManquantes],
    limiteVisibilite: constat.limiteVisibilite,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LA VÉRIFICATION AVAL — trois contrôles, un seul repli
// ─────────────────────────────────────────────────────────────────────────────

export type VerdictReformulation = {
  accepte: boolean;
  /** Rempli quand `accepte` est faux — ce qui a déclenché le repli. */
  motif: string | null;
};

/**
 * Tous les nombres d'un texte, normalisés.
 *
 * Les montants sortent formatés à la québécoise (« 18 000 $ », espace fine
 * insécable) ; on retire les séparateurs pour comparer des valeurs, pas des
 * mises en forme. La virgule décimale devient un point.
 */
export function nombresDe(texte: string): string[] {
  const sansSeparateurs = (texte ?? '').replace(/(\d)[\s  ](?=\d)/g, '$1');
  const trouves = sansSeparateurs.match(/-?\d+(?:[.,]\d+)?/g) ?? [];
  return trouves.map((n) => String(Number(n.replace(',', '.'))));
}

/** Les nombres que la référence autorise — ceux du constat, et eux seuls. */
function nombresAutorises(reference: ReferenceConstat): Set<string> {
  const permis = new Set<string>();
  if (reference.montantEstime !== null) {
    permis.add(String(reference.montantEstime));
    permis.add(String(Math.round(reference.montantEstime)));
  }
  // Les motifs et la limite peuvent porter leurs propres chiffres (« 1 % par
  // mois », « 30 jours ») : ils sont dans la référence, donc ils sont permis.
  for (const t of [...reference.donneesManquantes, reference.limiteVisibilite ?? '']) {
    for (const n of nombresDe(t)) permis.add(n);
  }
  return permis;
}

/**
 * La sortie du réviseur est-elle acceptable ?
 *
 * Par défaut, NON. Chaque contrôle doit passer ; le moindre doute renvoie au
 * gabarit déterministe. Une couche de style n'a aucune raison d'introduire un
 * chiffre, donc un chiffre inconnu — même « inoffensif » — suffit à rejeter.
 */
export function verifierReformulation(
  sortie: string,
  charge: ChargeReformulation
): VerdictReformulation {
  const texte = (sortie ?? '').trim();
  if (!texte) return { accepte: false, motif: 'sortie vide' };

  // 1. AUCUN CHIFFRE INVENTÉ.
  const permis = nombresAutorises(charge.reference);
  for (const n of nombresDe(charge.texteSource)) permis.add(n);
  const intrus = nombresDe(texte).filter((n) => !permis.has(n));
  if (intrus.length > 0) {
    return { accepte: false, motif: `chiffre absent de la référence : ${intrus.join(', ')}` };
  }

  // 2. LES RÉSERVES SURVIVENT.
  if (charge.reference.statut === 'montant-a-confirmer' && !/confirmer/i.test(texte)) {
    return { accepte: false, motif: 'la réserve « à confirmer » a disparu' };
  }
  if (charge.reference.statut === 'calcule' && charge.reference.libelleMontant) {
    // La nature du montant est intouchable : un montant sans sa nature se lit
    // comme une économie, et trois montants de natures différentes s'additionnent
    // dans la tête du lecteur. C'est le défaut du 5 août, en pire.
    const noyau = charge.reference.libelleMontant.replace(/^de\s+/i, '').split(/[,(]/)[0].trim();
    if (noyau && !texte.toLowerCase().includes(noyau.toLowerCase())) {
      return { accepte: false, motif: `la nature du montant (« ${noyau} ») a disparu` };
    }
  }

  // 3. LA LONGUEUR TIENT.
  const mots = texte.split(/\s+/).filter(Boolean).length;
  const plafond = Math.ceil(charge.style.longueurMax * 1.2);
  if (mots > plafond) {
    return { accepte: false, motif: `${mots} mots pour un plafond de ${plafond}` };
  }

  return { accepte: true, motif: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// LE POINT D'ENTRÉE
// ─────────────────────────────────────────────────────────────────────────────

export type ResultatReformulation = {
  texte: string;
  /** `gabarit` = le texte du moteur ; `reformule` = la sortie acceptée. */
  origine: 'gabarit' | 'reformule';
  /** Pourquoi on est retombé sur le gabarit, s'il y a lieu. */
  motifRepli: string | null;
};

/**
 * Reformule un texte, ou rend le gabarit.
 *
 * LE REPLI EST TOUJOURS LE GABARIT DÉTERMINISTE — pas d'appel, appel en échec,
 * sortie refusée : dans les trois cas la fiche existe quand même. Elle ne
 * dépend jamais du LLM pour exister ; c'est ce qui rend le branchement futur
 * sans risque pour la production du document.
 */
export async function reformuler(
  texteSource: string,
  constat: Constat,
  options: { appelLLM?: AppelLLM; style?: StyleReformulation } = {}
): Promise<ResultatReformulation> {
  const gabarit: ResultatReformulation = {
    texte: texteSource, origine: 'gabarit', motifRepli: null,
  };

  // DÉBRANCHÉ : sans `appelLLM`, on s'arrête ici. Aucun réseau, aucune erreur.
  if (!options.appelLLM) {
    return { ...gabarit, motifRepli: 'couche de reformulation débranchée' };
  }

  const charge: ChargeReformulation = {
    texteSource,
    reference: referencePour(constat),
    style: options.style ?? STYLE_PAR_DEFAUT,
  };

  let sortie: string;
  try {
    sortie = await options.appelLLM(charge);
  } catch (e) {
    return { ...gabarit, motifRepli: `appel en échec : ${e instanceof Error ? e.message : 'inconnu'}` };
  }

  const verdict = verifierReformulation(sortie, charge);
  if (!verdict.accepte) return { ...gabarit, motifRepli: verdict.motif };

  return { texte: sortie.trim(), origine: 'reformule', motifRepli: null };
}
