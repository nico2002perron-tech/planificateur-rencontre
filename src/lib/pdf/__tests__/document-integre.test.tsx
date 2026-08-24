// LE DOCUMENT RÉEL, PRODUIT PAR LE VRAI CHEMIN — pour être REGARDÉ.
//
// ─────────────────────────────────────────────────────────────────────────────
// CE FICHIER A CHANGÉ DE NATURE, ET SON ANCIEN EN-TÊTE ÉTAIT DEVENU UN MENSONGE.
//
// Il portait, en toutes lettres : « ⚠ CE N'EST PAS UN BRANCHEMENT.
// `OptimisationsFiscalesDocument` n'est pas modifié, la route de production non
// plus. On assemble ici, dans un aperçu, ce que le branchement PRODUIRAIT ».
// C'était vrai tant que le branchement n'existait pas — et c'est précisément ce
// que le lot 4 a fait.
//
// Il assemblait donc À LA MAIN une page de synthèse et deux pages de stratégie
// nourries par des PRÉSENTATIONS FABRIQUÉES. Le PDF qu'il écrivait n'avait ni
// couverture, ni bandeau d'usage interne, ni la pagination du vrai document, et
// ses chiffres ne venaient pas du moteur. On pouvait le regarder longtemps sans
// jamais voir ce que Nicolas reçoit.
//
// ─────────────────────────────────────────────────────────────────────────────
// CE QU'IL FAIT MAINTENANT : le chemin de la route, moins le disque.
//
//   profil fictif → analyser() → strategiesDuPreset() → restreindre()
//                 → OptimisationsFiscalesDocument → renderToBuffer
//
// C'est fonction pour fonction celui de `app/api/base-locale/rapport-fiscal`.
// Les deux seules choses qu'on ne traverse pas sont `profilPourClient` et
// `hydraterProfil`, qui LISENT LE DISQUE de la base locale — et dont la seule
// contribution au résultat est de remplir `comptes`, qu'on pose ici à la main.
//
// ⚠ `profilPourClient` NE DOIT JAMAIS ÊTRE APPELÉ DEPUIS UN TEST : il écrit un
// pseudonyme dans le `correspondance.json` de la vraie base dès qu'un nom lui
// est inconnu. Un test « en lecture » y fabriquerait une entrée nominative.
//
// Les PDF sont écrits dans C:/tmp/integre pour être rastérisés
// (`node scripts/_raster.mjs`) et REGARDÉS. Trois des quatre contraintes de
// rendu du dépôt n'étaient visibles que là.
//
// Dossiers entièrement fictifs — voir `__fixtures__/dossiers-document.ts`.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeAll } from 'vitest';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { Font, renderToBuffer } from '@react-pdf/renderer';
import { OptimisationsFiscalesDocument } from '../optimisations-fiscales-document';
import { analyser, restreindre, type ResultatAnalyse } from '@/lib/profils/strategies';
import { strategiesDuPreset, type ClePreset } from '@/lib/profils/presets-rapport';
import {
  DOSSIER_PERTES_MONO, DOSSIER_COMPLET, DOSSIER_A_CONFIRMER, DOSSIER_ENTREPRISE,
  DATE_DOSSIER, REEE_TEST,
} from '../__fixtures__/dossiers-document';
import type { ProfilClient } from '@/lib/profils/types';

beforeAll(() => {
  // ⚠ `optimisations-fiscales-document` enregistre DÉJÀ les polices au
  // chargement du module. On les réenregistre quand même : react-pdf tolère la
  // répétition, et un test qui dépend d'un effet de bord d'import est un test
  // qui cassera le jour où l'import bouge.
  const F = path.join(process.cwd(), 'public', 'fonts');
  Font.register({ family: 'Montserrat', fonts: [
    { src: path.join(F, 'Montserrat-Bold.ttf'), fontWeight: 700 },
    { src: path.join(F, 'Montserrat-ExtraBold.ttf'), fontWeight: 800 }] });
  Font.register({ family: 'Open Sans', fonts: [
    { src: path.join(F, 'OpenSans-Regular.ttf'), fontWeight: 400 },
    { src: path.join(F, 'OpenSans-SemiBold.ttf'), fontWeight: 600 }] });
  Font.registerHyphenationCallback((m) => [m]);
});

/**
 * LA MÊME SÉLECTION QUE LA ROUTE — et c'est tout l'objet de `presets-rapport`.
 *
 * Sans `restreindre`, le document porterait les huit constats du catalogue au
 * lieu de ceux du préréglage : un harnais qui ne reproduit pas la sélection ne
 * prouve pas le chemin.
 */
function commeLaRoute(profil: ProfilClient, preset: ClePreset = 'complet'): ResultatAnalyse {
  const complet = analyser(profil, null, DATE_DOSSIER, REEE_TEST);
  const voulues = strategiesDuPreset(preset, complet.constats.map((c) => c.strategie));
  return restreindre(complet, voulues);
}

const DOSSIER_SORTIE = 'C:/tmp/integre';

/**
 * LES QUATRE DOCUMENTS DEMANDÉS.
 *
 * La consigne veut au moins : un particulier, une entreprise, un cas mono, un
 * cas multi, un cas à confirmer. Plusieurs caractéristiques se combinent ici —
 * `complet` porte à lui seul le multi ET la stratégie de gains, `entreprise`
 * porte les deux cristallisations ET quatre stratégies neutralisées.
 */
const CAS: Array<{ fichier: string; quoi: string; profil: () => ProfilClient }> = [
  { fichier: 'particulier-mono', quoi: 'particulier · pertes MONO',
    profil: DOSSIER_PERTES_MONO },
  { fichier: 'particulier-multi', quoi: 'particulier · pertes MULTI + gains',
    profil: DOSSIER_COMPLET },
  { fichier: 'particulier-a-confirmer', quoi: 'particulier · les deux à confirmer',
    profil: DOSSIER_A_CONFIRMER },
  { fichier: 'entreprise', quoi: 'entreprise · quatre stratégies non applicables',
    profil: DOSSIER_ENTREPRISE },
];

describe('document intégré · le vrai chemin', () => {
  for (const cas of CAS) {
    it(`${cas.quoi} · le document se rend et s’écrit`, async () => {
      const resultat = commeLaRoute(cas.profil());
      const buf = await renderToBuffer(
        <OptimisationsFiscalesDocument
          donnees={{ resultat, nomClient: 'Dossier Fictif', preset: 'complet' }}
        />
      );
      fs.mkdirSync(DOSSIER_SORTIE, { recursive: true });
      fs.writeFileSync(`${DOSSIER_SORTIE}/${cas.fichier}.pdf`, buf);

      expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
      expect(buf.length).toBeGreaterThan(1000);
    }, 120_000);
  }

  it('la sélection du document est celle du préréglage, pas le catalogue entier', () => {
    // ⚠ SANS CETTE GARDE, LE HARNAIS PRODUIRAIT UN AUTRE DOCUMENT QUE LA ROUTE
    // et on inspecterait des pages que Nicolas ne verra jamais.
    const complet = analyser(DOSSIER_COMPLET(), null, DATE_DOSSIER, REEE_TEST);
    const instantane = commeLaRoute(DOSSIER_COMPLET(), 'instantane');
    expect(complet.constats.length).toBe(8);
    expect(instantane.constats.length).toBe(4);
    expect(instantane.constats.map((c) => c.strategie))
      .toEqual(['cristallisation-pertes', 'cristallisation-gains', 'don-titres', 'ordre-vente']);
  });
});
