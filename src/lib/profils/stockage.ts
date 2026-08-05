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
import { profilVierge, type ProfilClient } from './types';

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

export async function lireProfil(id: string): Promise<ProfilClient | null> {
  if (!estLocal() || !estPseudonymeValide(id)) return null;
  try {
    return JSON.parse(await fs.readFile(cheminProfil(id), 'utf8')) as ProfilClient;
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

  const precedent = await lireProfil(profil.id);
  const aJour: ProfilClient = {
    ...profil,
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
