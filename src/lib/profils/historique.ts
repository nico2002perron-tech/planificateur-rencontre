// L'IMPORT DE L'HISTORIQUE COMPLET — point 3b du plan.
//
// Trois gestes à chaque collage :
//   (a) le texte brut est archivé TEL QUEL, horodaté, jamais modifié — il
//       restera re-parsable le jour où le parseur s'améliorera ;
//   (b) les transactions parsées sont fusionnées dans un grand livre cumulatif,
//       avec la clé de dédoublonnage déjà rodée sur 1 003 041 lignes ;
//   (c) l'appelant en dérive historiqueVie.
//
// POURQUOI GARDER LE BRUT : c'est la leçon du grand livre. Chaque fois qu'une
// règle a été corrigée, il a fallu TOUT rejouer depuis la source. Un parseur
// qui jette sa matière première condamne ses propres erreurs à être définitives.
import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { estLocal } from '@/lib/base-locale/mode';
import { dossierTransactions } from '@/lib/base-locale/chemins';
import { nombre } from '@/lib/parseur-croesus/regles';
import type { LigneTransaction } from '@/lib/parseur-croesus/types';

// Le dossier est nommé PAR LE NOM DU CLIENT, comme ses documents : un seul nom
// saisi au moment du rapport commande tout le rangement. Voir dossierTransactions.

/**
 * LA CLÉ DE DÉDOUBLONNAGE, reprise du moteur du grand livre.
 *
 * Elle inclut le SOLDE : deux achats identiques le même jour sont légitimes et
 * doivent tous deux compter, mais ils ne portent pas le même solde. Sans lui,
 * on perdrait de vraies transactions ; avec lui, on ne garde que les vrais
 * doublons de chevauchement entre deux collages.
 */
function cleLigne(l: LigneTransaction): string {
  return [l.noCompte, l.date, l.type, l.symbole, l.total, l.quantite, l.solde].join('|');
}

/** Lit un collage brut : lignes tabulées, 20 colonnes, en-tête ignoré. */
export function parserCollage(texte: string): { lignes: LigneTransaction[]; ignorees: number } {
  const lignes: LigneTransaction[] = [];
  let ignorees = 0;
  for (const brut of texte.split(/\r?\n/)) {
    if (!brut.trim()) continue;
    const c = brut.split('\t');
    if (c.length < 20) { ignorees++; continue; }
    const date = (c[5] || '').trim();
    const noCompte = (c[19] || '').trim();
    if (!noCompte || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { ignorees++; continue; }
    lignes.push({
      date,
      dateReglement: (c[4] || '').trim(),
      nom: (c[2] || '').trim(),
      note: (c[3] || '').trim(),
      type: (c[7] || '').trim(),
      symbole: (c[8] || '').trim(),
      quantite: nombre(c[9]),
      prix: nombre(c[10]),
      devise: (c[11] || '').trim(),
      total: nombre(c[12]),
      gainsPertes: nombre(c[14]),
      solde: nombre(c[18]),
      noCompte,
      description: (c[1] || '').trim(),
    });
  }
  return { lignes, ignorees };
}

export type ResultatImport = {
  lues: number;
  nouvelles: number;
  doublons: number;
  ignorees: number;
  totalApres: number;
  cheminBrut: string;
  comptes: string[];
  premiereDate: string | null;
  derniereDate: string | null;
};

/**
 * Importe un collage : archive le brut, fusionne dans le grand livre cumulatif.
 *
 * Les collages se CHEVAUCHENT par nature — le planificateur recolle des
 * périodes qui se recouvrent. Seul l'inédit est ajouté.
 */
export async function importerCollage(params: {
  nomClient: string;
  texte: string;
  horodatage: string;          // AAAA-MM-JJ, pour nommer l'archive brute
}): Promise<ResultatImport> {
  if (!estLocal()) throw new Error('Import refusé hors exécution locale');
  if (!params.nomClient?.trim()) throw new Error('Nom du client requis');

  const dossier = dossierTransactions(params.nomClient);
  await fs.mkdir(dossier, { recursive: true });

  // (a) LE BRUT, TEL QUEL — jamais modifié, re-parsable plus tard.
  let cheminBrut = path.join(dossier, `${params.horodatage}_brut.txt`);
  let n = 1;
  while (await fs.access(cheminBrut).then(() => true).catch(() => false)) {
    n += 1;
    cheminBrut = path.join(dossier, `${params.horodatage}_brut_${n}.txt`);
  }
  await fs.writeFile(cheminBrut, params.texte, 'utf8');

  // (b) LA FUSION DÉDOUBLONNÉE.
  const { lignes, ignorees } = parserCollage(params.texte);
  const cheminLivre = path.join(dossier, 'transactions.json');
  let existantes: LigneTransaction[] = [];
  try {
    existantes = JSON.parse(await fs.readFile(cheminLivre, 'utf8')) as LigneTransaction[];
  } catch {
    existantes = [];
  }

  const vues = new Set(existantes.map(cleLigne));
  let nouvelles = 0;
  let doublons = 0;
  for (const l of lignes) {
    const cle = cleLigne(l);
    if (vues.has(cle)) { doublons++; continue; }
    vues.add(cle);
    existantes.push(l);
    nouvelles++;
  }
  existantes.sort((a, b) => a.date.localeCompare(b.date) || a.noCompte.localeCompare(b.noCompte));
  await fs.writeFile(cheminLivre, JSON.stringify(existantes), 'utf8');

  const comptes = [...new Set(existantes.map((l) => l.noCompte))].sort();
  return {
    lues: lignes.length,
    nouvelles,
    doublons,
    ignorees,
    totalApres: existantes.length,
    cheminBrut,
    comptes,
    premiereDate: existantes[0]?.date ?? null,
    derniereDate: existantes[existantes.length - 1]?.date ?? null,
  };
}

/** Relit le grand livre cumulatif d'un client. */
export async function lireHistorique(nomClient: string): Promise<LigneTransaction[]> {
  if (!estLocal() || !nomClient?.trim()) return [];
  try {
    const brut = await fs.readFile(
      path.join(dossierTransactions(nomClient), 'transactions.json'), 'utf8');
    return JSON.parse(brut) as LigneTransaction[];
  } catch {
    return [];
  }
}
