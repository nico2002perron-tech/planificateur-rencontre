// LA CHAÎNE UNIQUE DU VERDICT CELI — non-régression du défaut du 13 août 2026.
//
// Deux chaînes calculaient le même verdict : l'écran (resumeCeli) sur
// l'historique FIGÉ à l'import, le moteur (signauxDuLivre) sur l'historique
// recalculé. Un import de décembre relu en février donnait deux montants
// « calculés » différents dans la MÊME réponse d'API.
//
// Ces tests écrivent dans un dossier TEMPORAIRE, jamais dans la vraie base.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { profilVierge, type ProfilClient } from '../types';
import type { LigneTransaction } from '@/lib/parseur-croesus/types';

const RACINE_ORIGINALE = process.env.BASE_LOCALE_RACINE;
let racine: string;

const CLIENT = 'Temoin Fictif';
const DOSSIER = 'Temoin-Fictif';
const COMPTE_CELI = '37-FICT-W';

function tx(over: Partial<LigneTransaction> = {}): LigneTransaction {
  return {
    date: '2020-03-15', dateReglement: '2020-03-15', nom: 'FICTIF', note: 'COTISATION',
    type: 'Cotisation', symbole: '1CAD', quantite: null, prix: null, devise: 'CAD',
    total: 6000, gainsPertes: null, solde: 6000, noCompte: COMPTE_CELI, description: '',
    ...over,
  } as LigneTransaction;
}

/**
 * LE SCÉNARIO EXACT DE L'INSPECTION : cotisations régulières, PUIS un retrait
 * en juillet 2025. Un historique collé en décembre 2025 gèle ce retrait hors
 * des « retraits des années passées » — à raison ce jour-là. Relu en 2026, il
 * doit compter. C'est là que les deux chaînes divergeaient de 10 000 $.
 */
const LIVRE: LigneTransaction[] = [
  tx({ date: '2020-03-15', total: 6000 }),
  tx({ date: '2021-03-15', total: 6000 }),
  tx({ date: '2022-03-15', total: 6000 }),
  tx({ date: '2025-07-10', total: -10000, type: 'Retrait', note: 'RETRAIT' }),
];

/** Un profil dont l'historique FIGÉ porte l'état vu au 15 décembre 2025. */
function profilFigeEnDecembre(): ProfilClient {
  const p = profilVierge('fictif-celi', '2025-12-15');
  p.demographie.dateNaissance = '1986-05-20';
  p.consolidation.historiqueExterne = 'jamais';
  p.consolidation.comptesExternes = 'non';
  p.consolidation.dateConfirmation = '2025-12-15';
  p.historiqueVie.celi = {
    dateOuverture: '2020-03-15',
    cotisationsTotales: 18000,
    // LE GEL : au 15 décembre 2025, le retrait de juillet 2025 est de l'année
    // COURANTE — il ne redonne des droits que l'an prochain. Zéro est exact
    // ce jour-là, et périmé dès le 1er janvier.
    retraitsAnneesPassees: 0,
    transfertEntrantDetecte: false,
    dateImport: '2025-12-15',
    portee: 'complete',
  };
  return p;
}

beforeAll(async () => {
  racine = await fs.mkdtemp(path.join(os.tmpdir(), 'verdict-celi-'));
  process.env.BASE_LOCALE_RACINE = racine;
  const dossier = path.join(racine, 'transactions', DOSSIER);
  await fs.mkdir(dossier, { recursive: true });
  await fs.writeFile(path.join(dossier, 'transactions.json'), JSON.stringify(LIVRE), 'utf8');
});

afterAll(async () => {
  if (RACINE_ORIGINALE === undefined) delete process.env.BASE_LOCALE_RACINE;
  else process.env.BASE_LOCALE_RACINE = RACINE_ORIGINALE;
  await fs.rm(racine, { recursive: true, force: true });
});

describe('l’écran et le moteur ne peuvent plus diverger', () => {
  it('LE MÊME MONTANT des deux côtés, en 2026, sur un historique figé en 2025', async () => {
    const { resumeCeli } = await import('../resume');
    const { signauxDuLivre } = await import('../hydrater');
    const profil = profilFigeEnDecembre();

    const ecran = await resumeCeli(profil, CLIENT, 2026);
    const moteur = await signauxDuLivre(profil, CLIENT, 2026);

    expect(moteur.droitsCeli).not.toBeNull();
    expect(ecran.statut).toBe(moteur.droitsCeli!.statut);
    expect(ecran.montant).toBe(moteur.droitsCeli!.montant);
    expect(ecran.borne).toBe(moteur.droitsCeli!.borne);
    expect(ecran.portee).toBe(moteur.droitsCeli!.portee);
  });

  it('le retrait de 2025 EST compté en 2026 — le figé ne fait plus foi', async () => {
    const { resumeCeli } = await import('../resume');
    const ecran = await resumeCeli(profilFigeEnDecembre(), CLIENT, 2026);
    // Le profil figé dit 0 ; le livre dit 10 000. C'est le livre qui gagne.
    expect(ecran.retraitsAnneesPassees).toBe(10000);
    expect(ecran.cotisationsTotales).toBe(18000);
  });

  it('en 2025 (l’année du retrait), les deux surfaces disent 0 — et le disent ensemble', async () => {
    const { resumeCeli } = await import('../resume');
    const { signauxDuLivre } = await import('../hydrater');
    const profil = profilFigeEnDecembre();

    const ecran = await resumeCeli(profil, CLIENT, 2025);
    const moteur = await signauxDuLivre(profil, CLIENT, 2025);
    expect(ecran.retraitsAnneesPassees).toBe(0);
    expect(ecran.montant).toBe(moteur.droitsCeli!.montant);
  });

  it('l’ÂGE vient de la date de naissance des deux côtés (c’est lui qui commande le plafond)', async () => {
    const { resumeCeli } = await import('../resume');
    const { signauxDuLivre } = await import('../hydrater');
    // Âge saisi FAUX (périmé de vingt ans) : la date de naissance doit primer,
    // sinon le plafond cumulatif — donc le montant — diffère entre les surfaces.
    const profil = profilFigeEnDecembre();
    profil.demographie.age = 20;

    const ecran = await resumeCeli(profil, CLIENT, 2026);
    const moteur = await signauxDuLivre(profil, CLIENT, 2026);
    expect(ecran.montant).toBe(moteur.droitsCeli!.montant);
    // Né en 1986 : 18 ans en 2004, donc plafond CELI complet depuis 2009.
    expect(ecran.plafondDepuis).toBe(2009);
  });
});
