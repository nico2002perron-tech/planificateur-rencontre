// APERÇU — le document réel, SUIVI des deux pages de stratégie, dans le format
// de production. Sert à répondre à trois questions par l'œil :
//
//   1. les cinq étapes tiennent-elles en A4 (17 pt plus étroit, 50 pt plus haut) ?
//   2. les cartes en gris ardoise froid tiennent-elles sur le blanc chaud #fffdf9 ?
//   3. le blanc du bas de la deuxième page disparaît-il quand les stratégies
//      s'enchaînent ?
//
// ⚠ CE N'EST PAS UN BRANCHEMENT. `OptimisationsFiscalesDocument` n'est pas
// modifié, la route de production non plus. On assemble ici, dans un aperçu,
// ce que le branchement PRODUIRAIT — parce qu'il faut le regarder avant de
// décider, et parce qu'une mesure a montré qu'il ne faut pas encore décider.
//
// Dossier entièrement fictif.
import { describe, it, expect, beforeAll } from 'vitest';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { Document, Font, renderToBuffer } from '@react-pdf/renderer';
import { OptimisationsFiscalesPage } from '../optimisations-fiscales-page';
import { STRATEGIES_VISUELLES } from '../strategies-visuelles';
import { PRESENTATION_CALCULEE } from '../__fixtures__/cristallisation-pertes';
import { PRESENTATION_GAINS_CALCULEE } from '../__fixtures__/cristallisation-gains';
import { analyser } from '@/lib/profils/strategies';
import { profilVierge, type ProfilClient, type Position } from '@/lib/profils/types';

const DATE = '2026-08-23';

beforeAll(() => {
  const F = path.join(process.cwd(), 'public', 'fonts');
  Font.register({ family: 'Montserrat', fonts: [
    { src: path.join(F, 'Montserrat-Bold.ttf'), fontWeight: 700 },
    { src: path.join(F, 'Montserrat-ExtraBold.ttf'), fontWeight: 800 }] });
  Font.register({ family: 'Open Sans', fonts: [
    { src: path.join(F, 'OpenSans-Regular.ttf'), fontWeight: 400 },
    { src: path.join(F, 'OpenSans-SemiBold.ttf'), fontWeight: 600 }] });
  Font.registerHyphenationCallback((m) => [m]);
});

const pos = (symbole: string, vm: number, pbr: number, quantite: number): Position => ({
  symbole, devise: 'CAD', categorie: null, uniteValeursRapport: 'CAD',
  typeInstrument: 'Action', quantite,
  valeurMarchande: vm, valeurComptable: pbr, revenuAnnuel: null,
});

function profilFictif(): ProfilClient {
  const vierge = profilVierge('FICT', DATE);
  return {
    ...vierge,
    comptes: [{
      numero: '37-FICT-A', suffixe: 'A', provenanceNumero: 'livre' as const,
      candidats: ['37-FICT-A'], presence: 'au-releve' as const,
      derniereActivite: null, dernierSolde: null, type: 'non-enregistre' as const,
      titulaire: 'client' as const, dateReleve: DATE, encaisse: [],
      positions: [
        pos('AAA', 12_400, 21_000, 310),
        pos('BBB', 8_150, 11_300, 163),
        pos('DDD', 19_740, 7_755, 141),
      ],
    }],
    transactionsAnnee: {
      ...vierge.transactionsAnnee,
      gainsRealisesNonEnregistres: 5_000, pertesRealiseesNonEnregistrees: 0,
    },
    droits: {
      ...vierge.droits,
      pertesCapitalReportees: {
        montant: 12_000, unite: 'perte-capital-brute',
        source: 'avis-cotisation', dateDonnee: DATE,
      },
    },
    consolidation: { ...vierge.consolidation, comptesExternes: 'non' },
  } as ProfilClient;
}

describe('apercu · document integre', () => {
  it('ecrit le PDF du document reel suivi des deux pages de strategie', async () => {
    const resultat = analyser(profilFictif(), null, DATE, null, null);

    const pertes = STRATEGIES_VISUELLES['cristallisation-pertes'];
    const gains = STRATEGIES_VISUELLES['cristallisation-gains'];

    const buf = await renderToBuffer(
      <Document title="Optimisations fiscales — essai d’intégration">
        <OptimisationsFiscalesPage resultat={resultat} />
        {pertes.Page({ presentation: PRESENTATION_CALCULEE })}
        {gains.Page({ presentation: PRESENTATION_GAINS_CALCULEE })}
      </Document>
    );
    fs.mkdirSync('C:/tmp/integre', { recursive: true });
    fs.writeFileSync('C:/tmp/integre/document.pdf', buf);
    expect(buf.length).toBeGreaterThan(1000);
  }, 120000);
});
