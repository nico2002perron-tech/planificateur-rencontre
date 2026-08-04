import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { nomDossierClient, nomFichierDocument, racineBaseLocale } from '../chemins';
import { archiverDocument } from '../archiver';
import { inventorierDocuments } from '../inventaire';
import { estLocal, modeFiscalActif } from '../mode';

// Racine jetable, pour ne jamais écrire dans la vraie base pendant les tests.
let racineTest: string;
const envInitial = { ...process.env };

beforeEach(async () => {
  racineTest = await fs.mkdtemp(path.join(os.tmpdir(), 'base-locale-test-'));
  process.env.BASE_LOCALE_RACINE = racineTest;
  delete process.env.VERCEL;
  delete process.env.VERCEL_ENV;
  delete process.env.VERCEL_URL;
});

afterEach(async () => {
  await fs.rm(racineTest, { recursive: true, force: true });
  process.env = { ...envInitial };
});

describe('nomDossierClient — lisible ET sûr', () => {
  it('remplace les espaces par des tirets', () => {
    expect(nomDossierClient('Tremblay Marc')).toBe('Tremblay-Marc');
  });

  it('retire les accents sans casser la lisibilité', () => {
    expect(nomDossierClient('Éric St-Pierre')).toBe('Eric-St-Pierre');
    expect(nomDossierClient('Bélanger-D’Amour, Jean')).toBe('Belanger-DAmour-Jean');
  });

  it('garde les sociétés reconnaissables', () => {
    expect(nomDossierClient('9175-2592 QUEBEC INC.')).toBe('9175-2592-QUEBEC-INC');
  });

  it('neutralise toute tentative de traversée de chemin', () => {
    for (const attaque of ['../../etc/passwd', '..\\..\\Windows', 'C:\\evil\\..\\path', '/etc/shadow']) {
      const r = nomDossierClient(attaque);
      expect(r).not.toContain('..');
      expect(r).not.toContain('/');
      expect(r).not.toContain('\\');
    }
  });

  it('évite les noms réservés de Windows', () => {
    expect(nomDossierClient('CON')).toBe('CON-client');
    expect(nomDossierClient('lpt1')).toBe('lpt1-client');
  });

  it('ne rend jamais une chaîne vide', () => {
    expect(nomDossierClient('   ')).toBe('Client-sans-nom');
    expect(nomDossierClient('...')).toBe('Client-sans-nom');
  });
});

describe('nomFichierDocument', () => {
  it('suit la convention AAAA-MM-JJ_type.pdf', () => {
    expect(nomFichierDocument('cours-cibles', '2026-08-04')).toBe('2026-08-04_cours-cibles.pdf');
  });

  it('suffixe les doublons du même jour', () => {
    expect(nomFichierDocument('cours-cibles', '2026-08-04', 1)).toBe('2026-08-04_cours-cibles_2.pdf');
    expect(nomFichierDocument('rencontre-complete', '2026-08-04', 2)).toBe('2026-08-04_rencontre-complete_3.pdf');
  });
});

describe('estLocal — le drapeau ne peut pas être forcé depuis une requête', () => {
  it('est vrai hors Vercel', () => {
    expect(estLocal()).toBe(true);
    expect(modeFiscalActif()).toBe(true);
  });

  it('est faux dès qu’un marqueur Vercel est présent', () => {
    process.env.VERCEL = '1';
    expect(estLocal()).toBe(false);
    delete process.env.VERCEL;
    process.env.VERCEL_ENV = 'production';
    expect(estLocal()).toBe(false);
  });
});

describe('archiverDocument', () => {
  const octets = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // « %PDF »

  it('range le document sous documents/<Client>/ avec le bon nom', async () => {
    const r = await archiverDocument({
      octets, nomClient: 'Tremblay Marc', type: 'cours-cibles', date: '2026-08-04',
    });
    expect(r.archive).toBe(true);
    if (!r.archive) return;
    expect(r.chemin).toBe(path.join(racineTest, 'documents', 'Tremblay-Marc', '2026-08-04_cours-cibles.pdf'));
    expect(await fs.readFile(r.chemin)).toEqual(Buffer.from(octets));
  });

  it('n’écrase jamais : un second document le même jour est suffixé', async () => {
    const a = await archiverDocument({ octets, nomClient: 'Tremblay Marc', type: 'cours-cibles', date: '2026-08-04' });
    const b = await archiverDocument({ octets, nomClient: 'Tremblay Marc', type: 'cours-cibles', date: '2026-08-04' });
    expect(a.archive && b.archive).toBe(true);
    if (!a.archive || !b.archive) return;
    expect(b.chemin).not.toBe(a.chemin);
    expect(b.chemin.endsWith('_2.pdf')).toBe(true);
  });

  it('crée l’arborescence complète au premier appel', async () => {
    await archiverDocument({ octets, nomClient: 'Nouveau Client', type: 'cours-cibles' });
    for (const sous of ['documents', 'profils', 'historiques']) {
      await expect(fs.access(path.join(racineTest, sous))).resolves.toBeUndefined();
    }
  });

  it('n’écrit RIEN sur Vercel', async () => {
    process.env.VERCEL = '1';
    const r = await archiverDocument({ octets, nomClient: 'Tremblay Marc', type: 'cours-cibles' });
    expect(r).toEqual({ archive: false, raison: 'hors-local' });
    await expect(fs.access(path.join(racineTest, 'documents'))).rejects.toThrow();
  });

  it('refuse poliment quand le nom du client manque', async () => {
    const r = await archiverDocument({ octets, nomClient: '  ', type: 'cours-cibles' });
    expect(r).toEqual({ archive: false, raison: 'sans-nom-client' });
  });

  it('écrit sous la racine même avec un nom hostile', async () => {
    const r = await archiverDocument({
      octets, nomClient: '../../../Windows/System32', type: 'cours-cibles', date: '2026-08-04',
    });
    expect(r.archive).toBe(true);
    if (!r.archive) return;
    expect(path.resolve(r.chemin).startsWith(path.resolve(racineTest))).toBe(true);
  });

  it('respecte la surcharge BASE_LOCALE_RACINE', () => {
    expect(racineBaseLocale()).toBe(path.resolve(racineTest));
  });
});

describe('inventorierDocuments — la seconde couche de garde', () => {
  it('ne divulgue rien sur Vercel, même si des fichiers existent', async () => {
    const octets = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    await archiverDocument({ octets, nomClient: 'Tremblay Marc', type: 'cours-cibles' });
    expect((await inventorierDocuments()).length).toBe(1);

    process.env.VERCEL = '1';
    expect(await inventorierDocuments()).toEqual([]);
  });

  it('retourne une liste vide quand la base n’existe pas encore', async () => {
    process.env.BASE_LOCALE_RACINE = path.join(racineTest, 'jamais-cree');
    expect(await inventorierDocuments()).toEqual([]);
  });
});
