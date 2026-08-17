// LA MÉMOIRE DES LOGOS — le cache qui garde le volet fiscal muet.
//
// Le document fiscal doit pouvoir montrer le logo des titres du plan de récolte
// SANS faire d'appel réseau : il lit ce que les cours cibles ont déjà rapporté.
// Ces tests écrivent dans un dossier TEMPORAIRE, jamais dans la vraie base.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const RACINE_ORIGINALE = process.env.BASE_LOCALE_RACINE;
let racine: string;

// Un PNG minuscule mais valide, encodé — jamais un vrai logo de fournisseur.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

beforeAll(async () => {
  racine = await fs.mkdtemp(path.join(os.tmpdir(), 'logos-'));
  process.env.BASE_LOCALE_RACINE = racine;
});

afterAll(async () => {
  if (RACINE_ORIGINALE === undefined) delete process.env.BASE_LOCALE_RACINE;
  else process.env.BASE_LOCALE_RACINE = RACINE_ORIGINALE;
  await fs.rm(racine, { recursive: true, force: true });
});

const outils = async () => await import('../logos');

describe('memoriserLogos / logosMemorises', () => {
  it('garde ce qui passe, et le rend ensuite sans aucun appel', async () => {
    const { memoriserLogos, logosMemorises } = await outils();
    expect(await memoriserLogos({ 'AAA.TO': PNG, 'BBB': PNG })).toBe(2);

    const lus = await logosMemorises(['AAA.TO', 'BBB', 'JAMAIS-VU']);
    expect(Object.keys(lus).sort()).toEqual(['AAA.TO', 'BBB']);
    expect(lus['AAA.TO']).toBe(PNG);
  });

  it('ne réécrit pas ce qu’il connaît déjà', async () => {
    const { memoriserLogos } = await outils();
    expect(await memoriserLogos({ 'AAA.TO': PNG })).toBe(0);
  });

  it('un titre sans logo n’est PAS une erreur — il manque, simplement', async () => {
    const { logosMemorises } = await outils();
    expect(await logosMemorises(['INCONNU.TO'])).toEqual({});
  });

  it('refuse ce qui n’est pas une image', async () => {
    const { memoriserLogos, logosMemorises } = await outils();
    expect(await memoriserLogos({ 'CCC': 'data:text/html,<script>' })).toBe(0);
    expect(await logosMemorises(['CCC'])).toEqual({});
  });

  it('UN SYMBOLE NE DEVIENT JAMAIS UN CHEMIN — la garde de traversée', async () => {
    // Un symbole vient d'un fichier tiers. Sans nettoyage, « ../../ » écrirait
    // hors du dossier des logos.
    const { memoriserLogos } = await outils();
    await memoriserLogos({ '../../evade': PNG, '': PNG, '  ': PNG });
    const dedans = await fs.readdir(path.join(racine, 'logos'));
    expect(dedans.every((f) => !f.includes('..') && !f.includes('/') && !f.includes('\\'))).toBe(true);
    // Rien n'a été écrit à côté du dossier prévu.
    const racineListe = await fs.readdir(racine);
    expect(racineListe).toEqual(['logos']);
  });

  it('ne fait RIEN hors exécution locale', async () => {
    const { memoriserLogos, logosMemorises } = await outils();
    process.env.VERCEL = '1';
    try {
      expect(await memoriserLogos({ 'DDD': PNG })).toBe(0);
      expect(await logosMemorises(['AAA.TO'])).toEqual({});
    } finally {
      delete process.env.VERCEL;
    }
  });
});
