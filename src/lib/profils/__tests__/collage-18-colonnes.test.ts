// Bout en bout du collage a 18 colonnes, en base TEMPORAIRE. Aucune donnee reelle.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const ORIG = process.env.BASE_LOCALE_RACINE;
let racine: string;
const CLIENT = 'Temoin Fictif Dix-Huit';
const T = '\t';
const lig = (o: Record<number, string> = {}) => {
  const c = new Array(20).fill('');
  c[1] = 'DESC'; c[2] = 'FICTIF'; c[4] = '2026-03-16'; c[5] = '2026-03-15';
  c[7] = 'Cotisation'; c[8] = '1CAD'; c[9] = '1'; c[10] = '1'; c[11] = 'CAD';
  c[12] = '7000'; c[18] = '7000'; c[19] = '37-FICT-W';
  for (const [i, v] of Object.entries(o)) c[Number(i)] = v;
  return c.join(T);
};

beforeAll(async () => {
  racine = await fs.mkdtemp(path.join(os.tmpdir(), 'e2e18-'));
  process.env.BASE_LOCALE_RACINE = racine;
});
afterAll(async () => {
  if (ORIG === undefined) delete process.env.BASE_LOCALE_RACINE;
  else process.env.BASE_LOCALE_RACINE = ORIG;
  await fs.rm(racine, { recursive: true, force: true });
});

describe('un export a 18 colonnes traverse toute la chaine', () => {
  it('import -> livre -> droits CELI', async () => {
    const { importerCollage, lireHistorique } = await import('@/lib/profils/historique');
    const a18 = [
      lig().split(T).slice(2).join(T),
      lig({ 5: '2025-03-15', 12: '6500' }).split(T).slice(2).join(T),
    ].join('\n');

    const r = await importerCollage({ nomClient: CLIENT, texte: a18, horodatage: '2026-08-18' });
    expect(r.lues).toBe(2);
    expect(r.nouvelles).toBe(2);
    expect(r.comptes).toEqual(['37-FICT-W']);

    const livre = await lireHistorique(CLIENT);
    expect(livre).toHaveLength(2);
    expect(livre[0].type).toBe('Cotisation');
    expect(livre[0].total).toBe(6500);

    // Le regime est lu, donc les cotisations comptent dans l'historique CELI.
    const { deriverHistoriqueRegime } = await import('@/lib/profils/deriver');
    const h = deriverHistoriqueRegime(livre, 'celi', 2026, '2026-08-18');
    expect(h.cotisationsTotales).toBe(13500);
  });

  it('recoller le MEME export en 20 colonnes n ajoute rien', async () => {
    const { importerCollage } = await import('@/lib/profils/historique');
    const a20 = [lig(), lig({ 5: '2025-03-15', 12: '6500' })].join('\n');
    const r = await importerCollage({ nomClient: CLIENT, texte: a20, horodatage: '2026-08-19' });
    expect(r.lues).toBe(2);
    expect(r.nouvelles).toBe(0);     // le dedoublonnage reconnait les memes lignes
    expect(r.totalApres).toBe(2);
  });
});
