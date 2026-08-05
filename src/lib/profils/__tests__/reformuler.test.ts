// LA COUCHE DE REFORMULATION — la vérification aval, testée sans aucun modèle.
//
// C'est la partie qui protège le client, donc c'est la partie qui existe et se
// teste en premier. Le jour du branchement, ces garde-fous seront déjà rodés.

import { describe, it, expect } from 'vitest';
import {
  reformuler, verifierReformulation, referencePour, nombresDe, STYLE_PAR_DEFAUT,
  type ChargeReformulation,
} from '../reformuler';
import { analyser } from '../strategies';
import { profilVierge, type ProfilClient } from '../types';

const DATE = '2026-08-05';

function constatChiffre() {
  const p: ProfilClient = profilVierge('f', DATE);
  p.consolidation.comptesExternes = 'non';
  p.consolidation.dateConfirmation = DATE;
  p.demographie.etatCivil = 'marie';
  p.transactionsAnnee.gainsRealises = 12000;
  p.comptes = [{
    numero: '37-FICT-A', suffixe: 'A', provenanceNumero: 'livre', candidats: ['37-FICT-A'],
    type: 'non-enregistre', titulaire: 'client', dateReleve: DATE, encaisse: [],
    positions: [{ symbole: 'AAA', devise: 'CAD', categorie: null, valeurMarchande: 8000, valeurComptable: 20000, revenuAnnuel: null }],
  }];
  return analyser(p, null, DATE).constats.find((c) => c.strategie === 'cristallisation-pertes')!;
}

const chargePour = (c: ReturnType<typeof constatChiffre>): ChargeReformulation => ({
  texteSource: c.explication, reference: referencePour(c), style: STYLE_PAR_DEFAUT,
});

describe('la couche est DÉBRANCHÉE', () => {
  it('sans appelLLM, rend le gabarit — sans réseau, sans erreur', async () => {
    const c = constatChiffre();
    const r = await reformuler(c.explication, c);
    expect(r.origine).toBe('gabarit');
    expect(r.texte).toBe(c.explication);
    expect(r.motifRepli).toMatch(/débranchée/);
  });

  it('un appel en échec retombe sur le gabarit', async () => {
    const c = constatChiffre();
    const r = await reformuler(c.explication, c, {
      appelLLM: async () => { throw new Error('réseau coupé'); },
    });
    expect(r.origine).toBe('gabarit');
    expect(r.motifRepli).toMatch(/réseau coupé/);
  });
});

describe('la charge utile est pseudonymisée PAR CONSTRUCTION', () => {
  it('ne porte ni nom, ni numéro de compte, ni identifiant', () => {
    const ref = referencePour(constatChiffre());
    const brut = JSON.stringify(ref);
    expect(brut).not.toMatch(/37-FICT-A|37FICTA/);
    expect(Object.keys(ref).sort()).toEqual([
      'donneesManquantes', 'libelleMontant', 'limiteVisibilite',
      'montantEstime', 'recurrence', 'statut', 'strategie',
    ]);
  });
});

describe('nombresDe', () => {
  it('lit les montants formatés à la québécoise, séparateurs retirés', () => {
    expect(nombresDe('12 000 $ et 7 500 $')).toEqual(['12000', '7500']);
  });
  it('normalise la virgule décimale', () => {
    expect(nombresDe('1 234,56 $')).toEqual(['1234.56']);
  });
});

describe('la vérification aval', () => {
  const c = constatChiffre();
  const charge = chargePour(c);

  it('accepte une reformulation fidèle', () => {
    const sortie = `Vous avez 12 000 $ de perte à cristalliser. En les vendant, vous annulez les gains de l’année.`;
    expect(verifierReformulation(sortie, charge).accepte).toBe(true);
  });

  it('REJETTE un chiffre inventé, même anodin', () => {
    const sortie = `Vous avez 12 000 $ de perte à cristalliser sur les 3 prochaines années.`;
    const v = verifierReformulation(sortie, charge);
    expect(v.accepte).toBe(false);
    expect(v.motif).toMatch(/absent de la référence/);
  });

  it('REJETTE un montant modifié', () => {
    expect(verifierReformulation('Vous avez 15 000 $ de perte à cristalliser.', charge).accepte).toBe(false);
  });

  it('REJETTE la disparition de la nature du montant', () => {
    // Un montant sans sa nature se lit comme une économie — c'est le défaut du
    // 5 août, en pire, parce qu'il serait au singulier et donc crédible.
    const v = verifierReformulation('Vous économisez 12 000 $ cette année.', charge);
    expect(v.accepte).toBe(false);
    expect(v.motif).toMatch(/nature du montant/);
  });

  it('REJETTE une sortie trop longue', () => {
    const sortie = 'perte à cristalliser ' + 'mot '.repeat(200);
    expect(verifierReformulation(sortie, charge).accepte).toBe(false);
  });

  it('REJETTE une sortie vide', () => {
    expect(verifierReformulation('   ', charge).accepte).toBe(false);
  });

  it('EXIGE la réserve « à confirmer » quand le statut la porte', () => {
    const aConfirmer: ChargeReformulation = {
      ...charge,
      reference: { ...charge.reference, statut: 'montant-a-confirmer', montantEstime: null },
    };
    expect(verifierReformulation('Il y a une piste ici.', aConfirmer).accepte).toBe(false);
    expect(verifierReformulation('Une piste, à confirmer avec vous.', aConfirmer).accepte).toBe(true);
  });

  it('une sortie refusée fait retomber reformuler() sur le gabarit', async () => {
    const r = await reformuler(c.explication, c, {
      appelLLM: async () => 'Vous économisez 99 999 $, garanti.',
    });
    expect(r.origine).toBe('gabarit');
    expect(r.texte).toBe(c.explication);
  });

  it('une sortie acceptée est retenue', async () => {
    const bonne = 'Vous avez 12 000 $ de perte à cristalliser cette année.';
    const r = await reformuler(c.explication, c, { appelLLM: async () => bonne });
    expect(r.origine).toBe('reformule');
    expect(r.texte).toBe(bonne);
  });
});
