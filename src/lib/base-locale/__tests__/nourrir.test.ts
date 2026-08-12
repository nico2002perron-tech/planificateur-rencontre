// LE NOURRISSAGE PAR LES COURS CIBLES — non-régression du principe du 12 août.
//
// « Ma base de données se fera nourrir au fur et à mesure que je fais des
// cours cibles. » Ces tests éprouvent les quatre promesses du chaînon :
// il nourrit, il dédoublonne, il n'ombrage jamais un bon relevé avec un texte
// illisible, et il ne fait RIEN hors exécution locale ou sans client nommé.
//
// Ces tests écrivent dans un dossier TEMPORAIRE, jamais dans la vraie base.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const RACINE_ORIGINALE = process.env.BASE_LOCALE_RACINE;
let racine: string;

const CLIENT = 'Temoin Fictif';
const DOSSIER = 'Temoin-Fictif';
const JOUR = '2026-08-12';

const T = '\t';

/** Une ligne de collage de transactions : 20 colonnes, date en 5, compte en 19. */
function ligneTransaction(over: Partial<Record<number, string>> = {}): string {
  const c = new Array(20).fill('');
  c[1] = 'FICTIF'; c[5] = '2026-03-15'; c[7] = 'Achat'; c[8] = 'AAA';
  c[9] = '100'; c[10] = '10'; c[11] = 'CAD'; c[12] = '-1000'; c[19] = '37-FICT-A';
  for (const [i, v] of Object.entries(over)) c[Number(i)] = v as string;
  return c.join(T);
}

/** Une ligne de relevé de positions : le gabarit 13 colonnes des autres tests. */
function ligneReleve(...cols: string[]): string {
  const a = new Array(13).fill('');
  cols.forEach((v, i) => { a[i] = v; });
  return a.join(T);
}

const RELEVE_VALIDE = ligneReleve('CAD', 'Action', '1000', 'TITRE FICTIF', 'A', 'AAA', '26', '8', '26 000,00', '8 000,00');

beforeAll(async () => {
  racine = await fs.mkdtemp(path.join(os.tmpdir(), 'nourrir-'));
  process.env.BASE_LOCALE_RACINE = racine;
});

afterAll(async () => {
  if (RACINE_ORIGINALE === undefined) delete process.env.BASE_LOCALE_RACINE;
  else process.env.BASE_LOCALE_RACINE = RACINE_ORIGINALE;
  await fs.rm(racine, { recursive: true, force: true });
});

async function outils() {
  const { nourrirBaseLocale } = await import('../nourrir');
  const { lireHistorique, lireDernierReleve } = await import('@/lib/profils/historique');
  return { nourrirBaseLocale, lireHistorique, lireDernierReleve };
}

describe('nourrirBaseLocale', () => {
  it('nourrit le livre et archive le relevé, puis dédoublonne à la regénération', async () => {
    const { nourrirBaseLocale, lireHistorique, lireDernierReleve } = await outils();

    const bilan = await nourrirBaseLocale({
      nomClient: CLIENT,
      transactions: ligneTransaction(),
      positions: RELEVE_VALIDE,
      horodatage: JOUR,
    });
    expect(bilan.transactionsNouvelles).toBe(1);
    expect(bilan.releveArchive).toBe(true);

    const livre = await lireHistorique(CLIENT);
    expect(livre).toHaveLength(1);
    expect(livre[0].noCompte).toBe('37-FICT-A');
    const releve = await lireDernierReleve(CLIENT);
    expect(releve?.dateReleve).toBe(JOUR);

    // Regénérer le MÊME PDF (mêmes collages) : rien de neuf au livre, et le
    // relevé identique n'est pas empilé une deuxième fois.
    const rebis = await nourrirBaseLocale({
      nomClient: CLIENT,
      transactions: ligneTransaction(),
      positions: RELEVE_VALIDE,
      horodatage: JOUR,
    });
    expect(rebis.transactionsNouvelles).toBe(0);
    expect(rebis.releveArchive).toBe(true);

    const fichiers = await fs.readdir(path.join(racine, 'transactions', DOSSIER));
    expect(fichiers.filter((f) => /_releve(_\d+)?\.txt$/.test(f))).toHaveLength(1);
  });

  it("n'ombrage jamais un bon relevé avec un texte que le parseur ne lit pas", async () => {
    const { nourrirBaseLocale, lireDernierReleve } = await outils();

    // Un collage au format VERTICAL (lisible par les cours cibles, pas par le
    // parseur de relevés). L'archiver ferait foi à la place du bon relevé.
    const bilan = await nourrirBaseLocale({
      nomClient: CLIENT,
      positions: ['ADBE', '100', '350,00', '35 000,00'].join('\n'),
      horodatage: '2026-08-13',
    });
    expect(bilan.releveArchive).toBe(false);

    const releve = await lireDernierReleve(CLIENT);
    expect(releve?.dateReleve).toBe(JOUR);
    expect(releve?.texte).toBe(RELEVE_VALIDE);
  });

  it('ne fait rien sans client nommé', async () => {
    const { nourrirBaseLocale } = await outils();
    const bilan = await nourrirBaseLocale({
      nomClient: '   ',
      transactions: ligneTransaction(),
      positions: RELEVE_VALIDE,
      horodatage: JOUR,
    });
    expect(bilan).toEqual({ transactionsNouvelles: null, releveArchive: false });
  });

  it('ne fait rien hors exécution locale', async () => {
    const { nourrirBaseLocale } = await outils();
    process.env.VERCEL = '1';
    try {
      const bilan = await nourrirBaseLocale({
        nomClient: 'Autre Temoin',
        transactions: ligneTransaction(),
        positions: RELEVE_VALIDE,
        horodatage: JOUR,
      });
      expect(bilan).toEqual({ transactionsNouvelles: null, releveArchive: false });
      const dossiers = await fs.readdir(path.join(racine, 'transactions'));
      expect(dossiers).not.toContain('Autre-Temoin');
    } finally {
      delete process.env.VERCEL;
    }
  });
});
