// LE STOCKAGE DES PROFILS — disque local uniquement.
//
// Deux fichiers séparés, et c'est le cœur de la protection :
//   profils/<pseudonyme>.json   le profil fiscal, SANS aucun nom
//   correspondance.json         la table pseudonyme → nom du client
//
// La jonction ne se fait qu'EN MÉMOIRE, en local, au moment de produire un
// document. Un profil qui fuiterait seul ne dirait rien de qui il concerne.
import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { estLocal } from '@/lib/base-locale/mode';
import { racineBaseLocale } from '@/lib/base-locale/chemins';
import {
  profilVierge, pertesCapitalReporteesVierges,
  UNITES_PERTES_CAPITAL, SOURCES_PERTES_CAPITAL,
  type ProfilClient, type Compte,
  type PertesCapitalReportees, type UnitePertesCapital, type SourcePertesCapital,
} from './types';

export type Correspondance = Record<string, string>;   // pseudonyme → nom

function cheminCorrespondance(): string {
  return path.join(racineBaseLocale(), 'correspondance.json');
}

function cheminProfil(id: string): string {
  // Le pseudonyme est contraint à [A-Za-z0-9-] : aucun nom, aucune traversée.
  return path.join(racineBaseLocale(), 'profils', `${id}.json`);
}

/** Un pseudonyme valide : chiffres et lettres, jamais un nom de personne. */
export function estPseudonymeValide(id: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9-]{0,31}$/.test(id);
}

// ─────────────────────────────────────────────────────────────────────────────
// La table de correspondance
// ─────────────────────────────────────────────────────────────────────────────

export async function lireCorrespondance(): Promise<Correspondance> {
  if (!estLocal()) return {};
  try {
    const brut = await fs.readFile(cheminCorrespondance(), 'utf8');
    const objet = JSON.parse(brut) as unknown;
    if (!objet || typeof objet !== 'object' || Array.isArray(objet)) return {};
    return objet as Correspondance;
  } catch {
    return {};        // absente = vide, jamais une panne
  }
}

async function ecrireCorrespondance(table: Correspondance): Promise<void> {
  const chemin = cheminCorrespondance();
  await fs.mkdir(path.dirname(chemin), { recursive: true });
  await fs.writeFile(chemin, JSON.stringify(table, null, 2), 'utf8');
}

/**
 * Donne (ou retrouve) le pseudonyme d'un client.
 *
 * Le pseudonyme est un simple compteur : rien n'y est dérivé du nom, pour
 * qu'aucune information ne fuite par la forme de l'identifiant.
 */
export async function pseudonymePour(nomClient: string): Promise<string> {
  const nom = nomClient.trim();
  const table = await lireCorrespondance();
  const existant = Object.entries(table).find(([, n]) => n === nom);
  if (existant) return existant[0];

  const numeros = Object.keys(table)
    .map((k) => Number.parseInt(k, 10))
    .filter((n) => Number.isFinite(n));
  const suivant = String((numeros.length ? Math.max(...numeros) : 4470) + 1);
  table[suivant] = nom;
  await ecrireCorrespondance(table);
  return suivant;
}

export async function nomPour(id: string): Promise<string | null> {
  const table = await lireCorrespondance();
  return table[id] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Les profils
// ─────────────────────────────────────────────────────────────────────────────

/**
 * COMPLÈTE UN PROFIL LU AVEC LES CHAMPS QUE SON ÉCRITURE NE CONNAISSAIT PAS.
 *
 * Défaut vécu le 6 août 2026 : l'ajout de `demographie.enfants` au schéma a
 * fait tomber toute la route des profils en 500, parce que les trois profils
 * déjà sur disque avaient été écrits avant l'existence du champ. Le moteur
 * lisait `undefined.length`.
 *
 * Ce n'est pas un cas isolé, c'est une FAMILLE : chaque champ ajouté au schéma
 * casserait les profils existants de la même façon. On normalise donc à la
 * lecture, une fois, plutôt que d'ajouter un `?? []` défensif à chaque site
 * d'usage — il y en aurait des dizaines, et il en manquerait toujours un.
 *
 * La fusion est faite objet par objet, pas par un simple étalement de surface :
 * `{...vierge, ...stocke}` remplacerait `demographie` EN ENTIER par la version
 * stockée, ramenant exactement le problème qu'on corrige.
 */
/**
 * LES PERTES REPORTÉES D'UN PROFIL ANCIEN — le montant survit, son sens ne
 * s'invente pas.
 *
 * Avant le 20 août 2026, ce champ était un simple `{ montant, dateDonnee }`, et
 * le champ de saisie ne demandait pas dans quelle unité le montant était
 * exprimé. Un profil sur disque porte donc un nombre dont personne ne sait s'il
 * s'agit d'une perte en capital BRUTE ou de la perte NETTE de l'avis de
 * cotisation — deux échelles qui ne se comparent pas au même gain.
 *
 * LA RÈGLE : on garde le nombre, on refuse de le lire. `unite: 'inconnue'` et
 * `source: 'inconnue'` sont la traduction exacte de ce qu'on sait — c'est-à-dire
 * rien —, et cela suffit à empêcher toute stratégie de le consommer comme une
 * perte disponible ferme. Rétrograder un ancien dossier à « à confirmer » est
 * infiniment moins grave que réinterpréter son nombre en silence.
 *
 * ⚠ EN MÉMOIRE SEULEMENT. Cette fonction est appelée à la LECTURE. Elle
 * n'écrit rien : le fichier sur disque garde sa forme ancienne jusqu'à ce
 * qu'une écriture délibérée le remplace. Une migration persistée, si elle est
 * un jour souhaitée, sera un geste séparé et explicite.
 *
 * La date, elle, est préservée quand elle existe : elle dit quand la saisie a
 * été faite, et cette information-là n'est pas ambiguë.
 */
function normaliserPertesReportees(lu: unknown): PertesCapitalReportees {
  const vierge = pertesCapitalReporteesVierges();
  if (lu === null || lu === undefined) return vierge;

  // FORME LA PLUS ANCIENNE : un nombre nu, sans même la date.
  if (typeof lu === 'number') {
    return Number.isFinite(lu)
      ? { montant: lu, unite: 'inconnue', source: 'inconnue', dateDonnee: null }
      : vierge;
  }
  if (typeof lu !== 'object' || Array.isArray(lu)) return vierge;

  const o = lu as Record<string, unknown>;
  const montant = typeof o.montant === 'number' && Number.isFinite(o.montant) ? o.montant : null;
  const dateDonnee = typeof o.dateDonnee === 'string' && o.dateDonnee !== '' ? o.dateDonnee : null;

  // UNE VALEUR HORS ÉNUMÉRATION VAUT « INCONNUE ». Un fichier édité à la main,
  // ou écrit par une version future, ne doit pas pouvoir faire entrer dans le
  // moteur une unité qu'il ne connaît pas — le doute est le défaut sûr.
  const unite = UNITES_PERTES_CAPITAL.includes(o.unite as UnitePertesCapital)
    ? (o.unite as UnitePertesCapital) : 'inconnue';
  const source = SOURCES_PERTES_CAPITAL.includes(o.source as SourcePertesCapital)
    ? (o.source as SourcePertesCapital) : 'inconnue';

  return { montant, unite, source, dateDonnee };
}

function completerProfil(stocke: Partial<ProfilClient>, id: string, date: string): ProfilClient {
  const v = profilVierge(id, date);
  const fusion = <T extends object>(defaut: T, lu: unknown): T =>
    (lu && typeof lu === 'object' ? { ...defaut, ...(lu as T) } : defaut);

  return {
    ...v,
    ...stocke,
    demographie: {
      ...fusion(v.demographie, stocke.demographie),
      conjoint: fusion(v.demographie.conjoint, stocke.demographie?.conjoint),
      enfants: Array.isArray(stocke.demographie?.enfants) ? stocke.demographie.enfants : [],
    },
    revenus: fusion(v.revenus, stocke.revenus),
    consolidation: {
      ...fusion(v.consolidation, stocke.consolidation),
      transfertsResolus: Array.isArray(stocke.consolidation?.transfertsResolus)
        ? stocke.consolidation.transfertsResolus : [],
    },
    droits: {
      ...fusion(v.droits, stocke.droits),
      // ⚠ LE SEUL CHAMP QUI NE PEUT PAS SE FUSIONNER À PLAT — voir plus bas.
      pertesCapitalReportees: normaliserPertesReportees(
        (stocke.droits as Record<string, unknown> | undefined)?.pertesCapitalReportees
      ),
    },
    cotisationsAnnee: {
      ...fusion(v.cotisationsAnnee, stocke.cotisationsAnnee),
      reeeParEnfant: fusion(v.cotisationsAnnee.reeeParEnfant, stocke.cotisationsAnnee?.reeeParEnfant),
    },
    // `presence` est né le 17 août 2026 : un profil écrit avant ne l'a pas.
    // Avant cette date, un compte ne pouvait venir que du relevé — « au-releve »
    // est donc la seule valeur qu'il ait jamais eue. (En pratique `comptes` se
    // redérive à la lecture ; cette normalisation couvre les profils anciens
    // qui l'auraient encore figé.)
    comptes: Array.isArray(stocke.comptes)
      ? (stocke.comptes as Compte[]).map((c) => ({
          ...c,
          presence: c.presence ?? 'au-releve',
          derniereActivite: c.derniereActivite ?? null,
          dernierSolde: c.dernierSolde ?? null,
        }))
      : [],
    transactionsAnnee: fusion(v.transactionsAnnee, stocke.transactionsAnnee),
    historiqueVie: {
      celi: fusion(v.historiqueVie.celi, stocke.historiqueVie?.celi),
      reer: fusion(v.historiqueVie.reer, stocke.historiqueVie?.reer),
    },
    intentions: fusion(v.intentions, stocke.intentions),
    selectionStrategies: {
      ...fusion(v.selectionStrategies, stocke.selectionStrategies),
      strategies: Array.isArray(stocke.selectionStrategies?.strategies)
        ? stocke.selectionStrategies.strategies : [],
    },
  };
}

export async function lireProfil(id: string): Promise<ProfilClient | null> {
  if (!estLocal() || !estPseudonymeValide(id)) return null;
  try {
    const brut = JSON.parse(await fs.readFile(cheminProfil(id), 'utf8')) as Partial<ProfilClient>;
    return completerProfil(brut, id, brut.dateMiseAJour ?? new Date().toISOString().slice(0, 10));
  } catch {
    return null;
  }
}

/**
 * Écrit un profil : version incrémentée, date mise à jour.
 *
 * L'incrément est fait ICI et nulle part ailleurs, pour qu'un profil ne puisse
 * pas être réécrit sans laisser de trace de sa révision.
 */
export async function ecrireProfil(profil: ProfilClient, date: string): Promise<ProfilClient> {
  if (!estLocal()) throw new Error('Écriture de profil refusée hors exécution locale');
  if (!estPseudonymeValide(profil.id)) throw new Error(`Pseudonyme invalide : ${profil.id}`);

  // LA LIGNE DU TEMPS NE SE PERSISTE PAS — retirée ICI, pas seulement par la
  // discipline des appelants (19 août 2026). Elle se dérive à la lecture
  // (hydraterProfil) : un profil hydraté qui repasserait par cette fonction
  // écrirait sur disque un dérivé daté, qui vieillirait en silence — le défaut
  // exact que la doctrine « dériver à la lecture » existe pour empêcher.
  const { ligneDuTemps: _jamaisPersistee, ...persistable } = profil;

  const precedent = await lireProfil(profil.id);
  const aJour: ProfilClient = {
    ...persistable,
    version: (precedent?.version ?? 0) + 1,
    dateMiseAJour: date,
  };
  const chemin = cheminProfil(profil.id);
  await fs.mkdir(path.dirname(chemin), { recursive: true });
  await fs.writeFile(chemin, JSON.stringify(aJour, null, 2), 'utf8');
  return aJour;
}

/** Charge le profil d'un client, ou en crée un vierge s'il n'existe pas. */
export async function profilPourClient(nomClient: string, date: string): Promise<ProfilClient> {
  const id = await pseudonymePour(nomClient);
  return (await lireProfil(id)) ?? profilVierge(id, date);
}

/** La liste des profils existants, avec le nom si la table le connaît. */
export async function listerProfils(): Promise<Array<{ id: string; nom: string | null; version: number; dateMiseAJour: string }>> {
  if (!estLocal()) return [];
  const table = await lireCorrespondance();
  let fichiers: string[];
  try {
    fichiers = (await fs.readdir(path.join(racineBaseLocale(), 'profils')))
      .filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  const out = [];
  for (const f of fichiers) {
    const id = f.replace(/\.json$/, '');
    const p = await lireProfil(id);
    if (!p) continue;
    out.push({ id, nom: table[id] ?? null, version: p.version, dateMiseAJour: p.dateMiseAJour });
  }
  return out.sort((a, b) => b.dateMiseAJour.localeCompare(a.dateMiseAJour));
}
