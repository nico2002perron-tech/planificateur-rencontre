// LA ROUTE DES POSITIONS N'OMBRAGE PLUS LE BON RELEVÉ — défaut du 17 août 2026.
//
// Elle archivait le collage comme relevé AVANT de le lire, donc même quand elle
// le refusait ensuite. Comme « le relevé le plus récent fait foi », un texte
// illisible ou un export multi-clients devenait la référence et vidait le
// profil fiscal en silence.
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

const T = '\t';
const ligne = (...cols: string[]) => {
  const a = new Array(13).fill('');
  cols.forEach((v, i) => { a[i] = v; });
  return a.join(T);
};
const RELEVE_VALIDE = ligne('CAD', 'Action', '1000', 'TITRE FICTIF', 'A', 'AAA', '26', '8', '26 000,00', '8 000,00');

async function poster(texte: string) {
  const { POST } = await import('../positions/route');
  const req = new Request('http://localhost/api/base-locale/positions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nomClient: CLIENT, texte }),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await POST(req as any);
  return res.json();
}

const relevesArchives = async () =>
  (await fs.readdir(path.join(racine, 'transactions', DOSSIER)).catch(() => [] as string[]))
    .filter((f) => /_releve(_\d+)?\.txt$/.test(f));

beforeAll(async () => {
  racine = await fs.mkdtemp(path.join(os.tmpdir(), 'positions-route-'));
  process.env.BASE_LOCALE_RACINE = racine;
});

afterAll(async () => {
  if (RACINE_ORIGINALE === undefined) delete process.env.BASE_LOCALE_RACINE;
  else process.env.BASE_LOCALE_RACINE = RACINE_ORIGINALE;
  await fs.rm(racine, { recursive: true, force: true });
});

describe('POST /api/base-locale/positions', () => {
  it('un relevé lisible est archivé et rend ses comptes', async () => {
    const d = await poster(RELEVE_VALIDE);
    expect(d.refus).toBeUndefined();
    expect(d.comptes).toHaveLength(1);
    expect(await relevesArchives()).toHaveLength(1);
  });

  it('un texte ILLISIBLE est refusé SANS rien archiver — le bon relevé survit', async () => {
    const avant = await relevesArchives();
    const d = await poster(['ADBE', '100', '350,00', '35 000,00'].join('\n'));
    expect(d.refus).toContain('Aucune position');
    expect(d.chemin).toBeUndefined();
    expect(await relevesArchives()).toEqual(avant);
  });

  it('un collage MULTI-CLIENTS est refusé SANS rien archiver', async () => {
    const avant = await relevesArchives();
    const d = await poster(['### CLIENT UN', RELEVE_VALIDE, '### CLIENT DEUX', RELEVE_VALIDE].join('\n'));
    expect(d.refus).toContain('plusieurs clients');
    expect(d.chemin).toBeUndefined();
    expect(await relevesArchives()).toEqual(avant);
  });

  it('après les deux refus, le relevé de référence est TOUJOURS le bon', async () => {
    const { lireDernierReleve } = await import('@/lib/profils/historique');
    const dernier = await lireDernierReleve(CLIENT);
    expect(dernier?.texte).toBe(RELEVE_VALIDE);
  });
});
