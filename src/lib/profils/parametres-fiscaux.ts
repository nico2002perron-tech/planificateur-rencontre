// LES PARAMÈTRES FISCAUX — lus depuis config/parametres-fiscaux.csv.
//
// Principe 4 du schéma : aucun taux, seuil ou plafond codé en dur. Le fichier
// est révisable sans toucher au code, et chaque valeur porte sa source.
import 'server-only';
import fs from 'node:fs';
import path from 'node:path';

export type Parametre = {
  parametre: string;
  annee: number;
  juridiction: string;
  valeur: number;
  source: string;
};

let cache: Parametre[] | null = null;

/** Lit le CSV. Les lignes commençant par « # » sont des commentaires. */
export function lireParametres(): Parametre[] {
  if (cache) return cache;
  const chemin = path.join(process.cwd(), 'config', 'parametres-fiscaux.csv');
  let brut: string;
  try {
    brut = fs.readFileSync(chemin, 'utf8');
  } catch {
    cache = [];
    return cache;
  }
  const lignes = brut.split(/\r?\n/).filter((l) => l.trim() && !l.trimStart().startsWith('#'));
  const out: Parametre[] = [];
  for (const l of lignes.slice(1)) {          // slice(1) : l'en-tête
    const [parametre, annee, juridiction, valeur, source] = l.split(',');
    const a = Number.parseInt(annee, 10);
    const v = Number.parseFloat(valeur);
    if (!parametre || !Number.isFinite(a) || !Number.isFinite(v)) continue;
    out.push({ parametre: parametre.trim(), annee: a, juridiction: (juridiction || 'CA').trim(),
      valeur: v, source: (source || '').trim() });
  }
  cache = out;
  return out;
}

/** Pour les tests : oublie le cache. */
export function oublierCache(): void {
  cache = null;
}

export type PlafondCeli = {
  montant: number | null;
  /** L'année à partir de laquelle on a cumulé. */
  depuis: number | null;
  /** Vrai si l'âge du client est inconnu — on a alors pris le maximum. */
  parDefautMaximal: boolean;
  /** Une valeur « a-confirmer » entre-t-elle dans le total ? */
  contientAConfirmer: boolean;
};

/**
 * Le plafond CUMULATIF théorique d'un client.
 *
 * Il court depuis l'année de ses 18 ans, au plus tôt 2009 (création du régime).
 * SANS L'ÂGE, on cumule depuis 2009 — c'est-à-dire le MAXIMUM possible, donc
 * une borne haute. Cohérent avec l'esprit du schéma : quand on ne sait pas, on
 * borne par le haut et on le dit, jamais un chiffre présenté comme certain.
 */
export function plafondCeliCumulatif(ageAujourdhui: number | null, anneeCourante: number): PlafondCeli {
  const params = lireParametres().filter(
    (p) => p.parametre === 'plafond-celi' && p.annee <= anneeCourante
  );
  if (!params.length) {
    return { montant: null, depuis: null, parDefautMaximal: false, contientAConfirmer: false };
  }

  // Année des 18 ans, si l'âge est connu.
  let depuis = 2009;
  let parDefautMaximal = true;
  if (ageAujourdhui !== null && Number.isFinite(ageAujourdhui)) {
    const anneeNaissance = anneeCourante - ageAujourdhui;
    depuis = Math.max(2009, anneeNaissance + 18);
    parDefautMaximal = false;
  }

  const retenus = params.filter((p) => p.annee >= depuis);
  if (!retenus.length) {
    return { montant: 0, depuis, parDefautMaximal, contientAConfirmer: false };
  }
  return {
    montant: retenus.reduce((s, p) => s + p.valeur, 0),
    depuis,
    parDefautMaximal,
    contientAConfirmer: retenus.some((p) => p.source === 'a-confirmer'),
  };
}
