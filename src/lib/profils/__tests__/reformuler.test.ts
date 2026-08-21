// LA COUCHE DE REFORMULATION — la vérification aval, testée sans aucun modèle.
//
// C'est la partie qui protège le client, donc c'est la partie qui existe et se
// teste en premier. Le jour du branchement, ces garde-fous seront déjà rodés.

import { describe, it, expect } from 'vitest';
import {
  reformuler, verifierReformulation, referencePour, nombresDe, STYLE_PAR_DEFAUT,
  identifiantsDuProfil, masquerIdentifiants, demasquer,
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
  p.transactionsAnnee.gainsRealisesNonEnregistres = 12000;
  p.comptes = [{
    numero: '37-FICT-A', suffixe: 'A', provenanceNumero: 'livre', presence: 'au-releve', derniereActivite: null, dernierSolde: null, candidats: ['37-FICT-A'],
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
      'donneesManquantes', 'echeance', 'libelleMontant', 'limiteVisibilite',
      'montantEstime', 'plan', 'recurrence', 'statut', 'strategie',
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

describe('LE MASQUAGE DES IDENTIFIANTS — le défaut du 7 août 2026', () => {
  const profilAvecEnfants = () => {
    const p = profilVierge('f', DATE);
    p.demographie.enfants = [{ prenom: 'Laurie', age: 9 }, { prenom: 'Jules', age: 6 }];
    p.comptes = [{
      numero: '37-FICT-A', suffixe: 'A', provenanceNumero: 'livre', presence: 'au-releve', derniereActivite: null, dernierSolde: null, candidats: ['37-FICT-A'],
      type: 'non-enregistre', titulaire: 'client', dateReleve: DATE, encaisse: [],
      positions: [{ symbole: 'BBB', devise: 'CAD', categorie: null, valeurMarchande: 1, valeurComptable: 1, revenuAnnuel: null }],
    }];
    return p;
  };

  it('récolte les prénoms d’enfants ET les symboles de positions', () => {
    const ids = identifiantsDuProfil(profilAvecEnfants());
    expect(ids.prenoms).toEqual(['Laurie', 'Jules']);
    expect(ids.symboles).toEqual(['BBB']);
  });

  it('AUCUN PRÉNOM D’ENFANT NE FRANCHIT LA FRONTIÈRE', async () => {
    // C'est LE défaut : « Laurie : 500 $ de plus » partait vers un tiers.
    const ids = identifiantsDuProfil(profilAvecEnfants());
    let charge: ChargeReformulation | null = null;
    const c = constatChiffre();
    await reformuler('Laurie : 500 $ de plus, et le titre BBB porte un gain.', c, {
      identifiants: ids,
      appelLLM: async (ch) => { charge = ch; return ch.texteSource; },
    });
    expect(charge).not.toBeNull();
    expect(charge!.texteSource).not.toMatch(/Laurie/i);
    expect(charge!.texteSource).not.toMatch(/BBB/);
    expect(charge!.texteSource).toMatch(/<<ENFANT_1>>/);
    expect(charge!.texteSource).toMatch(/<<TITRE_1>>/);
  });

  it('LE DOCUMENT RETROUVE SES VRAIS NOMS après coup', async () => {
    // Le masquage protège la frontière, il n'appauvrit pas la page.
    const ids = identifiantsDuProfil(profilAvecEnfants());
    // La sortie doit porter la nature du montant, sinon le garde la refuse —
    // et il a raison de le faire, c'est la regle du 5 aout.
    const r = await reformuler(
      'Laurie : 500 $ de perte à cristalliser de plus.', constatChiffre(), {
        identifiants: ids,
        appelLLM: async (ch) => ch.texteSource,
      });
    expect(r.origine).toBe('reformule');
    expect(r.texte).toMatch(/Laurie/);
    expect(r.texte).not.toMatch(/<<ENFANT/);
  });

  it('REJETTE une sortie qui restaure un prénom de son propre chef', async () => {
    const ids = identifiantsDuProfil(profilAvecEnfants());
    const source = 'Laurie : 500 $ de plus.';
    const r = await reformuler(source, constatChiffre(), {
      identifiants: ids,
      appelLLM: async () => 'Pour Laurie, 500 $ de perte à cristalliser de plus.',
    });
    expect(r.origine).toBe('gabarit');
    expect(r.motifRepli).toMatch(/prénom/);
  });

  it('REJETTE une sortie qui a perdu le repère', async () => {
    const ids = identifiantsDuProfil(profilAvecEnfants());
    const r = await reformuler(
      'Laurie : 500 $ de perte à cristalliser de plus.', constatChiffre(), {
        identifiants: ids,
        appelLLM: async () => 'Il reste 500 $ de perte à cristalliser.',
      });
    expect(r.origine).toBe('gabarit');
    expect(r.motifRepli).toMatch(/repère/);
  });

  it('un prénom qui ressemble à un mot courant est masqué quand même', () => {
    const m = masquerIdentifiants('Rose a 500 $ de plus.', { symboles: [], prenoms: ['Rose'] });
    expect(m.texte).not.toMatch(/Rose/);
    expect(demasquer(m.texte, m.jetons)).toBe('Rose a 500 $ de plus.');
  });
});


describe('LE TEMPOREL ET LE PLAN — la référence étendue (11 août 2026)', () => {
  const constatAvecPlan = () => {
    const c = constatChiffre();
    return {
      ...c,
      plan: [{ symbole: 'BBB', vendre: 10000, gain: 8000, partiel: false }],
      echeance: 'Aucune échéance : une perte reportée ne périme pas, rachat permis le jour même.',
    };
  };
  const idsAvecBBB = () => ({ symboles: ['BBB'], prenoms: [] });

  it('LE PLAN PART MASQUÉ : aucun symbole réel dans la référence', async () => {
    let charge: ChargeReformulation | null = null;
    await reformuler('Texte source avec 12 000 $ de perte à cristalliser.', constatAvecPlan(), {
      identifiants: idsAvecBBB(),
      appelLLM: async (ch) => { charge = ch; return ch.texteSource; },
    });
    expect(JSON.stringify(charge!.reference)).not.toMatch(/BBB/);
    expect(charge!.reference.plan![0].titre).toBe('<<TITRE_1>>');
    expect(charge!.reference.echeance).toMatch(/ne périme pas/);
  });

  it('les nombres du PLAN sont citables sans déclencher le rejet', async () => {
    const r = await reformuler('12 000 $ de perte à cristalliser.', constatAvecPlan(), {
      identifiants: idsAvecBBB(),
      appelLLM: async () =>
        'Vendre environ 10 000 $ de <<TITRE_1>> cristallise 8 000 $ — sur vos 12 000 $ de perte à cristalliser.',
    });
    expect(r.origine).toBe('reformule');
    // Et le démasquage a remis le vrai symbole, en local.
    expect(r.texte).toMatch(/BBB/);
  });

  it('les nombres de l’ÉCHÉANCE (30 jours, 31 décembre) sont permis', async () => {
    const c = { ...constatAvecPlan(), echeance: 'Ordres réglés avant le 31 décembre — pas de rachat pendant 30 jours.' };
    const r = await reformuler('12 000 $ de perte à cristalliser.', c, {
      identifiants: idsAvecBBB(),
      appelLLM: async () => 'Avant le 31 décembre, cristallisez vos 12 000 $ de perte à cristalliser.',
    });
    expect(r.origine).toBe('reformule');
  });

  it('un jeton du plan NON cité ne fait PAS échouer la sortie', async () => {
    // Le modèle n'est pas tenu de citer chaque ligne du plan — seuls les
    // repères du TEXTE doivent survivre.
    const r = await reformuler('12 000 $ de perte à cristalliser.', constatAvecPlan(), {
      identifiants: idsAvecBBB(),
      appelLLM: async () => 'Vos 12 000 $ de perte à cristalliser peuvent être effacés.',
    });
    expect(r.origine).toBe('reformule');
  });

  it('une date INVENTÉE hors référence est rejetée', async () => {
    const r = await reformuler('12 000 $ de perte à cristalliser.', constatAvecPlan(), {
      identifiants: idsAvecBBB(),
      appelLLM: async () => 'Agissez avant le 15 mars : 12 000 $ de perte à cristalliser.',
    });
    expect(r.origine).toBe('gabarit');
    expect(r.motifRepli).toMatch(/absent de la référence/);
  });
});

describe('LE GARDE DES FICTIFS', () => {
  it('iaEssaiPermise exige le marqueur explicite', async () => {
    const { iaEssaiPermise } = await import('../appel-llm-essai');
    const p = profilVierge('f', DATE);
    expect(iaEssaiPermise(p)).toBe(false);          // réel par défaut
    p.fictif = true;
    expect(iaEssaiPermise(p)).toBe(true);           // fictif marqué, local
  });

  it('hors exécution locale, JAMAIS — même sur un fictif', async () => {
    const { iaEssaiPermise } = await import('../appel-llm-essai');
    const p = profilVierge('f', DATE);
    p.fictif = true;
    process.env.VERCEL = '1';
    try {
      expect(iaEssaiPermise(p)).toBe(false);
    } finally {
      delete process.env.VERCEL;
    }
  });
});
