// L'HYDRATATION — les cas de non-régression du défaut du 5 août 2026.
//
// Le moteur lisait `profil.comptes`, `profil.transactionsAnnee` et
// `profil.cotisationsAnnee`. Les trois étaient TOUJOURS VIDES : les fonctions
// de dérivation existaient, étaient testées, et n'étaient appelées par personne
// sur le chemin du moteur. Résultat mesuré sur trois clients réels : les cinq
// stratégies sortaient « indisponible », relevé importé ou non.
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
const ANNEE = 2026;
const DATE = '2026-08-06';

function tx(over: Record<string, unknown> = {}) {
  return {
    date: `${ANNEE}-03-15`, dateReglement: `${ANNEE}-03-15`, nom: 'FICTIF', note: '',
    type: 'Achat', symbole: 'AAA', quantite: 100, prix: 10, devise: 'CAD',
    total: -1000, gainsPertes: null, solde: 5000, noCompte: '37-FICT-A', description: '',
    ...over,
  };
}

const T = '\t';
const lig = (...c: string[]) => { const a = new Array(13).fill(''); c.forEach((v, i) => { a[i] = v; }); return a.join(T); };

beforeAll(async () => {
  racine = await fs.mkdtemp(path.join(os.tmpdir(), 'hydrater-'));
  process.env.BASE_LOCALE_RACINE = racine;

  const dossier = path.join(racine, 'transactions', DOSSIER);
  await fs.mkdir(dossier, { recursive: true });

  await fs.writeFile(path.join(dossier, 'transactions.json'), JSON.stringify([
    tx(),
    // Une VENTE avec gain réalisé — c'est elle que la cristallisation doit voir.
    tx({ type: 'Vente', symbole: 'BBB', total: 9000, gainsPertes: 4000, date: `${ANNEE}-05-02` }),
    // Une cotisation CELI en argent neuf.
    tx({ type: 'Cotisation', symbole: '1CAD', total: 7000, noCompte: '37-FICT-W', note: 'COTISATION' }),
    // Une ligne d'une AUTRE année : ne doit compter nulle part cette année-ci.
    tx({ type: 'Vente', symbole: 'CCC', total: 5000, gainsPertes: 9999, date: '2024-06-01' }),
  ]), 'utf8');

  // Un relevé de positions : un compte non enregistré avec une perte latente.
  await fs.writeFile(path.join(dossier, `${DATE}_releve.txt`), [
    lig('CAD', 'Action', '1000', 'TITRE EN PERTE', 'A', 'AAA', '26', '8', '26 000,00', '8 000,00'),
  ].join('\n'), 'utf8');
});

afterAll(async () => {
  if (RACINE_ORIGINALE === undefined) delete process.env.BASE_LOCALE_RACINE;
  else process.env.BASE_LOCALE_RACINE = RACINE_ORIGINALE;
  await fs.rm(racine, { recursive: true, force: true });
});

async function outils() {
  const { hydraterProfil } = await import('../hydrater');
  const { profilVierge } = await import('../types');
  const { analyser } = await import('../strategies');
  return { hydraterProfil, profilVierge, analyser };
}

describe('hydraterProfil', () => {
  it('DÉRIVE les comptes du relevé — ils étaient toujours vides', async () => {
    const { hydraterProfil, profilVierge } = await outils();
    const nu = profilVierge('f', DATE);
    expect(nu.comptes).toEqual([]);

    const h = await hydraterProfil(nu, CLIENT, ANNEE);
    expect(h.comptes.length).toBe(1);
    expect(h.comptes[0].numero).toBe('37-FICT-A');
    expect(h.comptes[0].type).toBe('non-enregistre');
    expect(h.comptes[0].positions[0]).toMatchObject({ symbole: 'AAA', valeurComptable: 26000 });
  });

  it('DÉRIVE les gains réalisés de l’année — ils valaient toujours 0', async () => {
    const { hydraterProfil, profilVierge } = await outils();
    const h = await hydraterProfil(profilVierge('f', DATE), CLIENT, ANNEE);
    expect(h.transactionsAnnee.gainsRealises).toBe(4000);
  });

  it('N’EMPORTE PAS les années passées avec lui', async () => {
    // La vente de 2024 porte 9 999 $ de gain. La compter en 2026 gonflerait la
    // cristallisation d'un montant qui n'a rien à absorber.
    const { hydraterProfil, profilVierge } = await outils();
    const h = await hydraterProfil(profilVierge('f', DATE), CLIENT, ANNEE);
    expect(h.transactionsAnnee.gainsRealises).not.toBe(13999);
  });

  it('DÉRIVE les cotisations de l’année — le badge vert « 0 $ » était un faux positif', async () => {
    const { hydraterProfil, profilVierge } = await outils();
    const h = await hydraterProfil(profilVierge('f', DATE), CLIENT, ANNEE);
    expect(h.cotisationsAnnee.celi).toBe(7000);
  });

  it('NE TOUCHE À AUCUN CHAMP DE SAISIE', async () => {
    // L'hydratation remplace ce qui se dérive, et rien d'autre. Un âge saisi
    // hier ne doit pas disparaître parce qu'on a relu le livre.
    const { hydraterProfil, profilVierge } = await outils();
    const nu = profilVierge('f', DATE);
    nu.demographie.age = 61;
    nu.revenus.trancheRevenu = '150-200k';
    nu.droits.celiInutilises = { montant: 12000, dateDonnee: DATE };
    nu.consolidation.comptesExternes = 'non';
    nu.selectionStrategies = { strategies: ['don-titres'], dateSelection: DATE };

    const h = await hydraterProfil(nu, CLIENT, ANNEE);
    expect(h.demographie.age).toBe(61);
    expect(h.revenus.trancheRevenu).toBe('150-200k');
    expect(h.droits.celiInutilises.montant).toBe(12000);
    expect(h.consolidation.comptesExternes).toBe('non');
    expect(h.selectionStrategies.strategies).toEqual(['don-titres']);
  });

  it('rend le profil INCHANGÉ quand il n’y a aucune donnée importée', async () => {
    const { hydraterProfil, profilVierge } = await outils();
    const nu = profilVierge('f', DATE);
    expect(await hydraterProfil(nu, 'Personne Sans Dossier', ANNEE)).toBe(nu);
    expect(await hydraterProfil(nu, null, ANNEE)).toBe(nu);
    expect(await hydraterProfil(nu, '   ', ANNEE)).toBe(nu);
  });
});

describe('LE DÉFAUT DE BOUT EN BOUT : le moteur voyait un dossier vide', () => {
  it('AVANT hydratation : tout est indisponible, même avec les données au dossier', async () => {
    const { profilVierge, analyser } = await outils();
    const p = profilVierge('f', DATE);
    p.consolidation.comptesExternes = 'non';
    p.consolidation.dateConfirmation = DATE;
    const c = analyser(p, null, DATE).constats.find((x) => x.strategie === 'cristallisation-pertes')!;
    expect(c.statut).toBe('indisponible');
    expect(c.montantEstime).toBeNull();
  });

  it('APRÈS hydratation : la cristallisation est CHIFFRÉE', async () => {
    const { hydraterProfil, profilVierge, analyser } = await outils();
    const p = profilVierge('f', DATE);
    p.consolidation.comptesExternes = 'non';
    p.consolidation.dateConfirmation = DATE;

    const h = await hydraterProfil(p, CLIENT, ANNEE);
    const c = analyser(h, null, DATE).constats.find((x) => x.strategie === 'cristallisation-pertes')!;

    expect(c.statut).toBe('calcule');
    // 18 000 $ de perte latente (26 000 de PBR pour 8 000 de valeur), plafonnés
    // aux 4 000 $ de gain réellement réalisés cette année.
    expect(c.montantEstime).toBe(4000);
  });
});
