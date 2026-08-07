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
import type { ProfilClient } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// LE MASQUAGE DES IDENTIFIANTS — corrigé le 7 août 2026.
//
// DÉFAUT : la `reference` était propre — sept champs, que des chiffres et des
// libellés de catalogue. Mais la charge transporte aussi `texteSource`, qui est
// l'explication du constat, et celle-là n'avait JAMAIS été auditée. Elle
// contient des symboles de positions (« Donner plutôt le titre BBB ») et, pire,
// LES PRÉNOMS DES ENFANTS dans la stratégie REEE (« Laurie : 500 $ de plus »).
//
// Le prénom d'un enfant mineur serait sorti du poste. Le module se documentait
// pourtant comme « pseudonymisé par construction » : c'était vrai de la
// référence, faux du texte. Une garantie à moitié vraie est pire qu'aucune.
//
// LA CORRECTION NE RETIRE PAS LES NOMS DU DOCUMENT — le planificateur veut voir
// « Laurie » et « BBB » sur la page. On substitue des JETONS STABLES avant
// l'envoi, on exige qu'ils survivent dans la sortie, et on remet les vraies
// valeurs en local après. Rien d'identifiant ne franchit la frontière, et le
// document garde ses vrais noms.
// ─────────────────────────────────────────────────────────────────────────────

export type IdentifiantsAMasquer = { symboles: string[]; prenoms: string[] };

/**
 * Les identifiants qu'un profil peut faire apparaître dans un texte de constat.
 *
 * On ratisse LARGE à dessein : mieux vaut masquer un symbole qui n'apparaît
 * nulle part que d'en manquer un. Le coût d'un masquage inutile est nul ; celui
 * d'un oubli est un identifiant chez un tiers.
 */
export function identifiantsDuProfil(profil: ProfilClient): IdentifiantsAMasquer {
  const symboles = new Set<string>();
  for (const c of profil.comptes) {
    for (const p of c.positions) if (p.symbole) symboles.add(p.symbole);
  }
  const prenoms = profil.demographie.enfants
    .map((e) => e.prenom?.trim())
    .filter((x): x is string => Boolean(x));
  return { symboles: [...symboles], prenoms };
}

/** Échappe une chaîne pour l'insérer telle quelle dans une expression régulière. */
function echapper(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export type Masquage = { texte: string; jetons: Record<string, string> };

/**
 * Remplace chaque identifiant par un jeton stable, et rend la table de retour.
 *
 * Les prénoms passent AVANT les symboles : un prénom court pourrait être
 * contenu dans un nom de titre, et l'ordre inverse le laisserait passer.
 */
export function masquerIdentifiants(texte: string, ids: IdentifiantsAMasquer): Masquage {
  const jetons: Record<string, string> = {};
  let out = texte ?? '';

  ids.prenoms.forEach((prenom, i) => {
    const jeton = `<<ENFANT_${i + 1}>>`;
    const avant = out;
    out = out.replace(new RegExp(`\\b${echapper(prenom)}\\b`, 'gi'), jeton);
    if (out !== avant) jetons[jeton] = prenom;
  });
  ids.symboles.forEach((symbole, i) => {
    const jeton = `<<TITRE_${i + 1}>>`;
    const avant = out;
    out = out.replace(new RegExp(`\\b${echapper(symbole)}\\b`, 'g'), jeton);
    if (out !== avant) jetons[jeton] = symbole;
  });
  return { texte: out, jetons };
}

/** Remet les vraies valeurs — EN LOCAL, après que la sortie a été acceptée. */
export function demasquer(texte: string, jetons: Record<string, string>): string {
  let out = texte;
  for (const [jeton, valeur] of Object.entries(jetons)) {
    out = out.split(jeton).join(valeur);
  }
  return out;
}

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
  charge: ChargeReformulation,
  /** Les jetons posés avant l'envoi — ils doivent tous ressortir intacts. */
  jetons: Record<string, string> = {},
  /** Les identifiants réels — aucun ne doit apparaître dans la sortie. */
  identifiants: IdentifiantsAMasquer = { symboles: [], prenoms: [] }
): VerdictReformulation {
  const texte = (sortie ?? '').trim();
  if (!texte) return { accepte: false, motif: 'sortie vide' };

  // 0. AUCUN IDENTIFIANT RÉEL DANS LA SORTIE.
  //
  // Le masquage se fait à l'aller ; ce contrôle est le garde-fou du retour.
  // Un modèle qui « restaurerait » un prénom deviné, ou qui recopierait un
  // symbole vu ailleurs, se ferait refuser. La double barrière est voulue :
  // le prénom d'un enfant ne doit pas dépendre d'une seule ligne de code.
  for (const prenom of identifiants.prenoms) {
    if (new RegExp(`\\b${echapper(prenom)}\\b`, 'i').test(texte)) {
      return { accepte: false, motif: 'un prénom apparaît dans la sortie' };
    }
  }
  for (const symbole of identifiants.symboles) {
    if (new RegExp(`\\b${echapper(symbole)}\\b`).test(texte)) {
      return { accepte: false, motif: 'un symbole de position apparaît dans la sortie' };
    }
  }

  // 0 bis. LES JETONS SURVIVENT. Sans eux, le démasquage rendrait un texte
  // amputé de ce qu'il devait nommer.
  for (const jeton of Object.keys(jetons)) {
    if (!texte.includes(jeton)) {
      return { accepte: false, motif: `le repère ${jeton} a disparu de la sortie` };
    }
  }

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
  options: {
    appelLLM?: AppelLLM;
    style?: StyleReformulation;
    /** À fournir DÈS QU'UN PROFIL EST EN JEU — sinon rien n'est masqué. */
    identifiants?: IdentifiantsAMasquer;
  } = {}
): Promise<ResultatReformulation> {
  const gabarit: ResultatReformulation = {
    texte: texteSource, origine: 'gabarit', motifRepli: null,
  };

  // DÉBRANCHÉ : sans `appelLLM`, on s'arrête ici. Aucun réseau, aucune erreur.
  if (!options.appelLLM) {
    return { ...gabarit, motifRepli: 'couche de reformulation débranchée' };
  }

  const identifiants = options.identifiants ?? { symboles: [], prenoms: [] };
  const { texte: masque, jetons } = masquerIdentifiants(texteSource, identifiants);

  const charge: ChargeReformulation = {
    // C'EST LE TEXTE MASQUÉ QUI PART, jamais l'original.
    texteSource: masque,
    reference: referencePour(constat),
    style: options.style ?? STYLE_PAR_DEFAUT,
  };

  let sortie: string;
  try {
    sortie = await options.appelLLM(charge);
  } catch (e) {
    return { ...gabarit, motifRepli: `appel en échec : ${e instanceof Error ? e.message : 'inconnu'}` };
  }

  const verdict = verifierReformulation(sortie, charge, jetons, identifiants);
  if (!verdict.accepte) return { ...gabarit, motifRepli: verdict.motif };

  // Le démasquage se fait ICI, en local : le document retrouve ses vrais noms.
  return { texte: demasquer(sortie.trim(), jetons), origine: 'reformule', motifRepli: null };
}
