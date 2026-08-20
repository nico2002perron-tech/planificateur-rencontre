// LE RAPPROCHEMENT FX — étape 3, périmètre mesuré (FX-1, FX-2, rien d'autre).
//
// Chaque cas de ce fichier vient soit de la liste obligatoire de Nicolas
// (19 août), soit d'un chiffre de docs/mesure-livre-flux-2026-08-19.md. Les
// données sont SYNTHÉTIQUES : racine « FICT », clients fictifs.
//
// Ce que le fichier tient, au-delà des cas : les INVARIANTS — une ligne dans au
// plus une paire, deux jambes exactement, devises jamais additionnées, flux
// externe consolidé nul, sources conservées, et rien de tout cela ne touche
// les cotisations/retraits existants.
import { describe, it, expect } from 'vitest';
import { rapprocherConversions, tauxDansNote, type PaireConversion } from '../rapprochement';
import { classerLigne } from '../flux';
import type { LigneTransaction } from '@/lib/parseur-croesus/types';

function ligne(partiel: Partial<LigneTransaction> & { type: string; noCompte: string }): LigneTransaction {
  return {
    date: '2026-03-15', dateReglement: '2026-03-17', nom: 'Fictif, Test', note: '',
    symbole: '1CAD', quantite: null, prix: null, devise: 'CAD', total: 1000,
    gainsPertes: null, solde: null, description: '',
    ...partiel,
  };
}

const E = '37-FICT-E';
const F = '37-FICT-F';
const E2 = '37-AUTR-E';   // une AUTRE racine
const W = '37-FICT-W';

/** Une conversion E→F propre : sort −(usd × taux) du E, entre +usd au F. */
function conversion(usd: number, taux: number, opts: { noteTaux?: boolean; date?: string; racineCad?: string } = {}) {
  const date = opts.date ?? '2026-03-15';
  const cad = +(usd * taux).toFixed(2);
  return [
    ligne({ type: 'Transfert', noCompte: opts.racineCad ?? E, date, symbole: '1CAD', devise: 'CAD', total: -cad,
      note: opts.noteTaux === false ? '' : `AU F1 TAUX ${taux}` }),
    ligne({ type: 'Transfert', noCompte: F, date, symbole: '1USD', devise: 'USD', total: usd, note: '' }),
  ];
}

describe('FX-1 — la conversion confirmée par son taux', () => {
  it('positif : structure complète + taux en note + ratio concordant → conversion-devise, confirmé', () => {
    const [x, y] = conversion(10000, 1.3252);
    const { paires, classees } = rapprocherConversions([x, y]);
    expect(paires).toHaveLength(1);
    expect(paires[0].confiance).toBe('confirme');
    expect(paires[0].tauxNote).toBe(1.3252);
    expect(paires[0].motif).toMatch(/FX-1/);
    for (const c of classees) {
      expect(c.nature).toBe('conversion-devise');
      expect(c.confiance).toBe('confirme');
    }
  });

  it('taux juste SOUS 0,5 % d’écart → encore confirmé', () => {
    // ratio réel 1,3252 ; taux écrit 1,3200 → écart 0,394 % < 0,5 %
    const x = ligne({ type: 'Transfert', noCompte: E, total: -13252, note: 'TAUX 1.3200' });
    const y = ligne({ type: 'Transfert', noCompte: F, symbole: '1USD', devise: 'USD', total: 10000 });
    const { paires } = rapprocherConversions([x, y]);
    expect(paires).toHaveLength(1);
    expect(paires[0].confiance).toBe('confirme');
  });

  it('taux juste AU-DESSUS de 0,5 % d’écart → PAS confirmé, PAS élevé : les deux jambes deviennent ambiguës', () => {
    // ratio réel 1,3252 ; taux écrit 1,3150 → écart 0,776 % > 0,5 %.
    // Un taux écrit et CONTREDIT est une preuve négative : FX-2 ne repêche pas.
    const x = ligne({ type: 'Transfert', noCompte: E, total: -13252, note: 'TAUX 1.3150' });
    const y = ligne({ type: 'Transfert', noCompte: F, symbole: '1USD', devise: 'USD', total: 10000 });
    const { paires, classees } = rapprocherConversions([x, y]);
    expect(paires).toHaveLength(0);
    for (const c of classees) {
      expect(c.nature).toBe('ambigu');
      expect(c.motif).toMatch(/CONTREDIT/);
    }
  });
});

describe('FX-2 — la conversion structurelle sans taux', () => {
  it('positif : structure complète, aucune note → conversion-devise, confiance élevée, jamais confirmé', () => {
    const [x, y] = conversion(10000, 1.3252, { noteTaux: false });
    const { paires, classees } = rapprocherConversions([x, y]);
    expect(paires).toHaveLength(1);
    expect(paires[0].confiance).toBe('eleve');
    expect(paires[0].tauxNote).toBeNull();
    expect(paires[0].motif).toMatch(/FX-2/);
    expect(classees.every((c) => c.nature === 'conversion-devise' && c.confiance === 'eleve')).toBe(true);
  });
});

describe('ce qui ne se rapproche PAS — chaque preuve manquante, nommée', () => {
  it('paire à J+1 → aucun rapprochement (0 conversion observable hors J0 dans la mesure)', () => {
    const [x, y] = conversion(10000, 1.3252);
    const yDecale = { ...y, date: '2026-03-16' };
    const { paires, classees } = rapprocherConversions([x, yDecale]);
    expect(paires).toHaveLength(0);
    // Pas de quasi-conversion non plus : à J+1 les lignes ne se voient même pas.
    // Elles sortent en classement ligne-seule (Transfert sans note → ambigu).
    expect(classees.every((c) => c.nature === 'ambigu')).toBe(true);
  });

  it('racines différentes → aucun rapprochement (8 paires inter-racines mesurées : 0 observable)', () => {
    const [x, y] = conversion(10000, 1.3252, { racineCad: E2 });
    const { paires } = rapprocherConversions([x, y]);
    expect(paires).toHaveLength(0);
  });

  it('contreparties multiples → personne n’est rapproché, tout le monde se déclare', () => {
    const [x, y1] = conversion(10000, 1.35, { noteTaux: false });
    const y2 = { ...y1, total: 9900 };
    const { paires, classees } = rapprocherConversions([x, y1, y2]);
    expect(paires).toHaveLength(0);
    expect(classees.filter((c) => c.nature === 'ambigu' && /contrepartie|concurrence/.test(c.motif))).toHaveLength(3);
  });

  it('même signe des deux côtés → pas FX (deux entrées ne sont pas une conversion)', () => {
    const x = ligne({ type: 'Transfert', noCompte: E, total: 13252 });
    const y = ligne({ type: 'Transfert', noCompte: F, symbole: '1USD', devise: 'USD', total: 10000 });
    expect(rapprocherConversions([x, y]).paires).toHaveLength(0);
  });

  it('devise incohérente avec la lettre (E en USD) → jamais candidate ; la ligne suit son classement ligne-seule', () => {
    // 75 paires de l'univers mesuré échouaient sur la devise.
    const x = ligne({ type: 'Transfert', noCompte: E, symbole: '1USD', devise: 'USD', total: -13252 });
    const y = ligne({ type: 'Transfert', noCompte: F, symbole: '1USD', devise: 'USD', total: 10000 });
    const { paires } = rapprocherConversions([x, y]);
    expect(paires).toHaveLength(0);
  });

  it('symbole non 1CAD/1USD → pas FX automatique (mesuré : 402 paires jumelles J0 sur titres = des Achat/Vente)', () => {
    const x = ligne({ type: 'Transfert', noCompte: E, symbole: 'XYZ', total: -13252 });
    const y = ligne({ type: 'Transfert', noCompte: F, symbole: '1USD', devise: 'USD', total: 10000 });
    expect(rapprocherConversions([x, y]).paires).toHaveLength(0);
  });

  it('Achat/Vente d’encaisse → PAS de règle FX pour l’instant (0 occurrence dans la base mesurée)', () => {
    // Même avec la note « CONV. EN CAD @ … » et la structure parfaite : le type
    // Achat/Vente n'est jamais candidat — seule la mesure du GRAND livre pourra
    // ajouter cette règle. Les jambes suivent leur classement ligne-seule
    // (Achat/Vente d'encaisse → ambigu « conversion probable »), sans jamais
    // devenir cotisation ni retrait.
    const x = ligne({ type: 'Vente', noCompte: F, symbole: '1USD', devise: 'USD', total: -10000, note: 'CONV. EN CAD @ 1.3252' });
    const y = ligne({ type: 'Achat', noCompte: E, symbole: '1CAD', devise: 'CAD', total: 13252 });
    const { paires, classees } = rapprocherConversions([x, y]);
    expect(paires).toHaveLength(0);
    for (const c of classees) {
      expect(c.nature).toBe('ambigu');
      expect(c.motif).toMatch(/conversion de devise probable/);
    }
  });
});

describe('les invariants', () => {
  it('deux paires indépendantes le même jour, même racine → matching un-à-un correct', () => {
    // Deux conversions distinctes, montants différents, chacune avec son taux :
    // l'appariement par taux est impossible à confondre.
    const [x1, y1] = conversion(10000, 1.3252);
    const [x2, y2] = conversion(5000, 1.3252);
    const { paires, classees } = rapprocherConversions([x1, y1, x2, y2]);
    // Contreparties multiples le même jour → la règle d'unicité REFUSE, elle ne
    // devine pas (invariant : mieux vaut ambigu qu'un faux rapprochement).
    expect(paires).toHaveLength(0);
    expect(classees.every((c) => c.nature === 'ambigu')).toBe(true);
  });

  it('l’unicité vaut DANS LES DEUX SENS : deux jambes CAD pour une seule USD → personne n’est rapproché', () => {
    // Le miroir du cas « contreparties multiples » : ici c'est la jambe USD qui
    // est disputée par deux jambes CAD. Une version du code qui ne vérifiait
    // l'unicité que côté CAD rapprochait silencieusement la première venue —
    // falsifiée le 19 août : ce test est né de cette falsification.
    const y = ligne({ type: 'Transfert', noCompte: F, symbole: '1USD', devise: 'USD', total: 10000 });
    const x1 = ligne({ type: 'Transfert', noCompte: E, total: -13252 });
    const x2 = ligne({ type: 'Transfert', noCompte: E, total: -13100 });
    const { paires, classees } = rapprocherConversions([x1, x2, y]);
    expect(paires).toHaveLength(0);
    expect(classees.filter((c) => c.nature === 'ambigu' && /concurrence|contrepartie/.test(c.motif)).length).toBe(3);
  });

  it('une ligne ne peut pas être consommée deux fois', () => {
    const [x, y] = conversion(10000, 1.3252);
    const { paires } = rapprocherConversions([x, y, x, y]);   // la même référence, deux fois
    const jambes = paires.flatMap((p) => [p.jambeCad, p.jambeUsd]);
    expect(new Set(jambes).size).toBe(jambes.length);   // aucune jambe répétée
  });

  it('somme externe consolidée d’une conversion = 0 : ni cotisation, ni retrait, ni apport, ni retrait de capital', () => {
    const [x, y] = conversion(10000, 1.3252);
    const { paires, classees } = rapprocherConversions([x, y]);
    const p = paires[0];
    // Les jambes gardent leur devise et leur montant SOURCE — jamais additionnés.
    expect(p.jambeCad.devise).toBe('CAD');
    expect(p.jambeUsd.devise).toBe('USD');
    expect(p.jambeCad.total).toBe(-13252);
    expect(p.jambeUsd.total).toBe(10000);
    // Aucune jambe ne porte une nature de flux externe.
    for (const c of classees) {
      expect(['cotisation', 'retrait', 'apport-capital', 'retrait-capital']).not.toContain(c.nature);
    }
    // Le ratio est un dérivé, pas une somme : 13 252 / 10 000.
    expect(p.ratio).toBeCloseTo(1.3252, 4);
  });

  it('chaque paire garde ses deux transactions sources et son motif', () => {
    const [x, y] = conversion(10000, 1.3252);
    const { paires } = rapprocherConversions([x, y]);
    expect(paires[0].jambeCad).toBe(x);       // la référence MÊME, pas une copie
    expect(paires[0].jambeUsd).toBe(y);
    expect(paires[0].motif.length).toBeGreaterThan(20);
  });

  it('l’ordre commande : la jambe 1CAD d’une conversion aurait été « ambigu » lue seule — le rapprochement passe AVANT', () => {
    const [x, y] = conversion(10000, 1.3252);
    expect(classerLigne(x).nature).toBe('ambigu');            // ligne seule : Transfert sans contrepartie
    const { classees } = rapprocherConversions([x, y]);
    expect(classees.find((c) => c.source === x)?.nature).toBe('conversion-devise');
  });

  it('une note d’annulation ne neutralise RIEN : aucun « annule » automatique', () => {
    // Deux lignes qui s'annulent au cent près, avec la note la plus explicite
    // possible — et le résultat n'est PAS « annule » : la mesure a montré 0
    // type correctif dans les 110 paires, et 12 des 21 « notes d'annulation »
    // étaient des conversions.
    const a = ligne({ type: 'Retrait', noCompte: W, total: -5000, note: 'ANNULATION' });
    const b = ligne({ type: 'Cotisation', noCompte: W, total: 5000, note: 'ANNULATION' });
    const { paires, classees } = rapprocherConversions([a, b]);
    expect(paires).toHaveLength(0);
    expect(classees.map((c) => c.nature)).not.toContain('annule');
  });
});

describe('le taux dans la note', () => {
  it('lit la convention DIRECTE (mesuré : 8/8 en direct, 0 en inverse)', () => {
    expect(tauxDansNote('AU F1 TAUX 1.3252')).toBe(1.3252);
    expect(tauxDansNote('CONV. EN CAD @ 1.37893')).toBe(1.37893);
    expect(tauxDansNote('TAUX 1,3252')).toBe(1.3252);
    expect(tauxDansNote('TAUX 1.31')).toBe(1.31);          // 2 décimales derrière un mot-clé
    expect(tauxDansNote('')).toBeNull();
    expect(tauxDansNote('VIRE DE 37FICTE')).toBeNull();
  });

  it('ne prend pas un prix isolé pour un taux (4 décimales minimum sans mot-clé)', () => {
    expect(tauxDansNote('PRIX 23.50 PAR PART')).toBeNull();
  });
});
