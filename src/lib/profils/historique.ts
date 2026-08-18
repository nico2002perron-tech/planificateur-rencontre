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

/**
 * POURQUOI UN COLLAGE N'A RIEN DONNÉ — mesuré le 17 août 2026.
 *
 * Le parseur est strict, et il a raison de l'être : il refuse plutôt que de
 * deviner. Mais un refus muet est un piège. Trois situations d'Excel très
 * ordinaires produisaient « 0 transaction ajoutée » sans un mot d'explication,
 * et rien ne disait au planificateur ce qu'il devait changer :
 *
 *   · les colonnes tronquées (moins de 18) — une sélection partielle ;
 *   · le point-virgule comme séparateur — un export d'Excel en français ;
 *   · les dates en JJ/MM/AAAA — un format régional.
 *
 * Cette fonction ne parse rien : elle REGARDE ce qui a échoué et le dit en
 * français. Elle ne rend jamais de faux diagnostic — sans motif reconnu, elle
 * rend `null` et l'appelant s'en tient au comptage.
 */
export function diagnostiquerCollage(texte: string): string | null {
  const lignes = texte.split(/\r?\n/).filter((l) => l.trim());
  if (lignes.length === 0) return 'Le collage est vide.';

  // On ignore une éventuelle ligne d'en-tête pour juger sur les données.
  const echantillon = lignes.slice(0, 40).filter((l) => l.includes('\t') || l.includes(';') || l.includes(','));
  if (echantillon.length === 0) {
    return 'Les colonnes ne sont pas séparées : collez depuis Excel (ou Croesus) plutôt que depuis un document texte, pour que les colonnes soient conservées.';
  }

  const avecTabulations = echantillon.filter((l) => l.includes('\t'));
  if (avecTabulations.length === 0) {
    const pv = echantillon.filter((l) => l.split(';').length >= 10).length;
    if (pv > 0) {
      return 'Vos colonnes sont séparées par des points-virgules. Le collage doit venir directement d’Excel (colonnes sélectionnées, puis Ctrl+C), pas d’un fichier CSV enregistré.';
    }
    return 'Les colonnes ne sont pas séparées par des tabulations. Sélectionnez les cellules dans Excel et copiez-les directement.';
  }

  // Assez de tabulations, mais pas assez de colonnes ?
  const colonnes = avecTabulations.map((l) => l.split('\t').length);
  const maxColonnes = Math.max(...colonnes);
  // 18 ET 20 colonnes sont acceptees depuis le 18 aout (voir parserCollage) :
  // le seuil suit, sinon le diagnostic reclamerait de corriger ce qui marche.
  if (maxColonnes < 18) {
    return `Il manque des colonnes : ${maxColonnes} trouvée${maxColonnes > 1 ? 's' : ''} alors que l’historique en demande 18 ou 20. Sélectionnez TOUTES les colonnes du rapport de transactions, de la première à la dernière (le numéro de compte est dans la dernière).`;
  }

  // Les colonnes y sont : c'est donc la date ou le numéro de compte.
  const decalageDe = (l: string) => (l.split('\t').length >= 20 ? 0 : 2);
  const assezLarges = avecTabulations.filter((l) => l.split('\t').length >= 18);
  const dates = assezLarges.map((l) => (l.split('\t')[5 - decalageDe(l)] || '').trim()).filter(Boolean);
  const bonnesDates = dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (dates.length > 0 && bonnesDates.length === 0) {
    const exemple = /^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/.test(dates[0]) ? ' (elles ressemblent à JJ/MM/AAAA)' : '';
    return `Les dates ne sont pas au format AAAA-MM-JJ${exemple}. Dans Excel, mettez la colonne de date au format « 2026-03-15 » avant de copier.`;
  }

  const comptes = assezLarges.map((l) => (l.split('\t')[19 - decalageDe(l)] || '').trim()).filter(Boolean);
  if (assezLarges.length > 0 && comptes.length === 0) {
    return 'La dernière colonne (le numéro de compte) est vide. Vérifiez que la sélection va bien jusqu’à la colonne du compte.';
  }
  return null;
}

/** Lit un collage brut : lignes tabulées, 18 ou 20 colonnes, en-tête ignoré. */
export function parserCollage(texte: string): { lignes: LigneTransaction[]; ignorees: number } {
  const lignes: LigneTransaction[] = [];
  let ignorees = 0;
  for (const brut of texte.split(/\r?\n/)) {
    if (!brut.trim()) continue;
    const c = brut.split('\t');

    // LES DEUX EXPORTS DE CROESUS, LUS PAR LA MEME ZONE — 18 aout 2026.
    //
    // Le piege que la cartographie a trouve : DEUX parseurs lisaient le meme
    // collage avec deux colonnes d'ecart. Celui de l'ecran (activite de
    // l'annee) attend 18 colonnes ; celui-ci en exigeait 20. Le seul collage
    // qui satisfaisait les deux etait un export a 20 colonnes AVEC en-tetes,
    // et aucun texte ne le disait — d'ou des imports « 0 transaction » sans
    // raison visible.
    //
    // La mesure tranche : la carte a 18 colonnes est EXACTEMENT celle-ci
    // moins ses deux premieres (`indVM`, `description`). Decalage constant de
    // 2, pas deux formats differents. On l'absorbe ici plutot que de toucher
    // au parseur d'activite, qui tourne deja en production sur les cours
    // cibles : ce fichier devient tolerant, l'autre ne bouge pas.
    const decalage = c.length >= 20 ? 0 : c.length >= 18 ? 2 : -1;
    if (decalage < 0) { ignorees++; continue; }
    const col = (i: number) => (c[i - decalage] || '').trim();

    const date = col(5);
    const noCompte = col(19);
    if (!noCompte || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { ignorees++; continue; }
    lignes.push({
      date,
      dateReglement: col(4),
      nom: col(2),
      note: col(3),
      type: col(7),
      symbole: col(8),
      quantite: nombre(col(9)),
      prix: nombre(col(10)),
      devise: col(11),
      total: nombre(col(12)),
      gainsPertes: nombre(col(14)),
      solde: nombre(col(18)),
      noCompte,
      // La description n'existe QUE dans l'export a 20 colonnes : sur 18, la
      // colonne 1 est la note, pas la description. On rend vide plutot que
      // de recopier un champ voisin.
      description: decalage === 0 ? col(1) : '',
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

// ─────────────────────────────────────────────────────────────────────────────
// LE RELEVÉ DE POSITIONS — même traitement que les transactions.
//
// Le relevé est un INSTANTANÉ, pas un cumul : on ne fusionne rien. Chaque
// collage est archivé horodaté, et le plus récent fait foi. Fusionner des
// instantanés ferait ressusciter les titres vendus et gonflerait la valeur
// marchande — la même famille d'erreur que le portefeuille à 21,9 M$, mais
// silencieuse, parce que chaque ligne prise isolément reste exacte.
// ─────────────────────────────────────────────────────────────────────────────

/** Archive un relevé de positions collé. Rend le chemin et la date retenue. */
export async function archiverReleve(params: {
  nomClient: string;
  texte: string;
  horodatage: string;
}): Promise<{ chemin: string; dateReleve: string }> {
  if (!estLocal()) throw new Error('Import refusé hors exécution locale');
  if (!params.nomClient?.trim()) throw new Error('Nom du client requis');

  const dossier = dossierTransactions(params.nomClient);
  await fs.mkdir(dossier, { recursive: true });

  let chemin = path.join(dossier, `${params.horodatage}_releve.txt`);
  let n = 1;
  while (await fs.access(chemin).then(() => true).catch(() => false)) {
    n += 1;
    chemin = path.join(dossier, `${params.horodatage}_releve_${n}.txt`);
  }
  await fs.writeFile(chemin, params.texte, 'utf8');
  return { chemin, dateReleve: params.horodatage };
}

/**
 * Le relevé de positions le plus récent d'un client, ou `null`.
 *
 * C'est cette lecture qui permet de DÉRIVER `comptes` à l'affichage plutôt que
 * de le figer dans le profil : le jour où la jointure s'améliore, tous les
 * profils se réparent d'un coup.
 */
export async function lireDernierReleve(
  nomClient: string
): Promise<{ texte: string; dateReleve: string } | null> {
  if (!estLocal() || !nomClient?.trim()) return null;
  const dossier = dossierTransactions(nomClient);
  try {
    const fichiers = (await fs.readdir(dossier))
      .filter((f) => /_releve(_\d+)?\.txt$/.test(f))
      .sort();
    const dernier = fichiers[fichiers.length - 1];
    if (!dernier) return null;
    return {
      texte: await fs.readFile(path.join(dossier, dernier), 'utf8'),
      dateReleve: dernier.slice(0, 10),
    };
  } catch {
    return null;
  }
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
