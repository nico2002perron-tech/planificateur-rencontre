// LES QUATRE CAS TÉMOINS — voir docs/regles-parseur.md.
//
// Les fixtures reproduisent FIDÈLEMENT les motifs observés sur le livre réel,
// avec des noms FICTIFS : ces tests partent sur GitHub, aucun nom de client
// ne doit y apparaître.
import { describe, it, expect } from 'vitest';
import {
  nombre,
  unitaireDerive,
  separerCotisations,
  estVirementInterne,
  analyserFluxCompte,
} from '../regles';
import { typeDeCompte, estCompteVMBL, type LigneTransaction } from '../types';

function ligne(p: Partial<LigneTransaction>): LigneTransaction {
  return {
    date: '2026-01-14', dateReglement: '2026-01-16', nom: 'CLIENT FICTIF',
    note: '', type: 'Achat', symbole: '', quantite: null, prix: null,
    devise: 'CAD', total: null, gainsPertes: null, solde: null,
    noCompte: '37-TEST-W', description: '', ...p,
  };
}

describe('nombre — format québécois', () => {
  it('lit les espaces insécables et la virgule décimale', () => {
    expect(nombre('1 234,56')).toBe(1234.56);
    expect(nombre('35 081,41')).toBe(35081.41);
  });
  it('lit les parenthèses comme un négatif', () => {
    expect(nombre('(160 675,63)')).toBe(-160675.63);
  });
  it('rend null sur une case vide', () => {
    expect(nombre('')).toBeNull();
    expect(nombre(undefined)).toBeNull();
  });
});

describe('RÈGLE 1 — l’échelle par 100 des obligations', () => {
  it('CAS 1 · une obligation : le PBR unitaire dérivé vaut 1,00 et non 100,00', () => {
    // Motif réel : obligation municipale, 39 000 $ de nominal, PBR unitaire
    // affiché 100,000 dans l’export, coût total 39 000,00 $.
    const derive = unitaireDerive(39000, 39000);
    expect(derive).toBe(1);
    // Le piège qu’on évite : 39 000 × 100 = 3,9 M$ pour une position de 39 k$.
    expect(39000 * 100).toBe(3_900_000);
    expect(39000 * (derive as number)).toBe(39000);
  });

  it('CAS 1b · un FNB : la MÊME formule donne le bon unitaire', () => {
    // Motif réel : 206 parts, coût total 35 081,41 $, PBR unitaire 170,298.
    const derive = unitaireDerive(35081.41, 206) as number;
    expect(derive).toBeCloseTo(170.298, 3);
  });

  it('refuse de diviser par zéro', () => {
    expect(unitaireDerive(1000, 0)).toBeNull();
    expect(unitaireDerive(null, 100)).toBeNull();
  });
});

describe('RÈGLE 2 — la partie double des cotisations', () => {
  it('CAS 2 · une cotisation en nature ne compte PAS comme argent neuf', () => {
    // Motif réel : jambe argent +20 177,90 et jambe titre −20 177,90, même
    // compte, même date.
    const lignes = [
      ligne({ type: 'Cotisation', symbole: '1CAD', total: 20177.90 }),
      ligne({ type: 'Cotisation', symbole: 'TD', quantite: 155, total: -20177.90 }),
    ];
    const r = separerCotisations(lignes);
    expect(r.argentNeuf).toBe(0);
    expect(r.apportsEnNature).toBeCloseTo(20177.90, 2);
  });

  it('compte bien l’argent neuf quand il n’y a pas de contrepartie titre', () => {
    const lignes = [ligne({ type: 'Cotisation', symbole: '1CAD', total: 7000 })];
    expect(separerCotisations(lignes).argentNeuf).toBe(7000);
  });

  it('n’apparie pas des lignes de comptes ou de dates différents', () => {
    const lignes = [
      ligne({ type: 'Cotisation', symbole: '1CAD', total: 5000, noCompte: '37-AAAA-W' }),
      ligne({ type: 'Cotisation', symbole: 'TD', quantite: 40, total: -5000, noCompte: '37-BBBB-W' }),
      ligne({ type: 'Cotisation', symbole: '1CAD', total: 3000, date: '2026-02-01' }),
      ligne({ type: 'Cotisation', symbole: 'BCE', quantite: 90, total: -3000, date: '2026-03-15' }),
    ];
    const r = separerCotisations(lignes);
    expect(r.argentNeuf).toBe(8000);
    expect(r.apportsEnNature).toBe(0);
  });

  it('reproduit le cas mesuré : 94 722 $ bruts → 314 $ d’argent neuf', () => {
    const lignes = [
      ligne({ type: 'Cotisation', symbole: '1CAD', total: 94408 }),
      ligne({ type: 'Cotisation', symbole: 'XIU', quantite: 2000, total: -94408 }),
      ligne({ type: 'Cotisation', symbole: '1CAD', total: 314, date: '2026-04-02' }),
    ];
    const r = separerCotisations(lignes);
    expect(r.argentNeuf).toBe(314);
    expect(r.apportsEnNature).toBe(94408);
  });
});

describe('RÈGLE 3 — le virement interne se reconnaît à sa note', () => {
  it('CAS 3 · les motifs réels du livre sont reconnus', () => {
    for (const note of [
      'TRANSFERE A 37-3GDU-S',
      'VIRE DE 373CUVS',
      'FONDS SOLID FTQ A1/N’FRAC ARTICLE 146(16) LIR TRSF I',
      'RYL BK CDA6.25%-AT 1ST PF ARTICLE 146(16) LIR TRSF D',
    ]) {
      expect(estVirementInterne(note)).toBe(true);
    }
  });

  it('CAS 3b · une note qui NOMME un compte désigne une contrepartie interne', () => {
    // Motifs réels du livre. Format iA « 37-XXXX-L », vieux VMBL « 4A/6A-XXXX-N ».
    for (const note of [
      'A 37-AEF9-R - 146(16)',
      'A 37-3BQW-T - 146(16)',
      '4A-Y3VI-6',
      '6A-CDTR-9',
    ]) {
      expect(estVirementInterne(note)).toBe(true);
    }
  });

  it('ne reconnaît pas une note quelconque', () => {
    expect(estVirementInterne('')).toBe(false);
    expect(estVirementInterne('DEPOT CLIENT')).toBe(false);
    expect(estVirementInterne('SOLLICITE INT FLAT PROCHAIN COUPON')).toBe(false);
  });

  it('RÈGLE 4 · les articles de loi SEULS ne prouvent rien', () => {
    // L'article 146(16) autorise le transfert direct entre REER, y compris
    // ENTRE INSTITUTIONS : le citer ne prouve pas l'internalité. 256 lignes du
    // livre portent « TFR-146(16) » sans autre indice — elles restent douteuses.
    expect(estVirementInterne('TFR-146(16)')).toBe(false);
    expect(estVirementInterne('TFR-146.3(2)(E)')).toBe(false);
    expect(estVirementInterne('TRANSFERT DE FONDS')).toBe(false);
    expect(estVirementInterne('PAIEMENT RETRAITE')).toBe(false);
    // …mais accompagnés d'un numéro de compte, ils deviennent probants.
    expect(estVirementInterne('A 37-CT9M-T - 146(16)')).toBe(true);
  });

  it('un transfert apparié NE déclenche PAS la borne', () => {
    const flux = analyserFluxCompte([
      ligne({ type: 'Transfert', symbole: '1CAD', total: 25000, note: 'TRANSFERE A 37-3GDU-S' }),
    ]);
    expect(flux.transfertEntrantDetecte).toBe(false);
    expect(flux.transferts[0].apparie).toBe(true);
  });
});

describe('RÈGLE 4 — dans le doute, la borne', () => {
  it('CAS 4 · un transfert entrant SANS note est présumé externe', () => {
    const flux = analyserFluxCompte([
      ligne({ type: 'Transfert', symbole: '1CAD', total: 40000, note: '' }),
    ]);
    expect(flux.transfertEntrantDetecte).toBe(true);
  });

  it('un seul transfert orphelin suffit à rétrograder, même parmi des appariés', () => {
    const flux = analyserFluxCompte([
      ligne({ type: 'Transfert', symbole: '1CAD', total: 25000, note: 'TRANSFERE A 37-AAAA-S' }),
      ligne({ type: 'Transfert', symbole: '1CAD', total: 900, note: '', date: '2026-05-02' }),
    ]);
    expect(flux.transfertEntrantDetecte).toBe(true);
  });

  it('un apport en NATURE sans note d’appariement rétrograde aussi', () => {
    // Le motif du CELI ouvert en janvier avec 300 k$ « de cotisations » :
    // des titres arrivés d’ailleurs, sans note. C’est un transfert de régime.
    const flux = analyserFluxCompte([
      ligne({ type: 'Cotisation', symbole: '1CAD', total: 300221 }),
      ligne({ type: 'Cotisation', symbole: 'RCI.B', quantite: 197, total: -300221 }),
    ]);
    expect(flux.cotisations).toBe(0);
    expect(flux.apportsEnNature).toBeCloseTo(300221, 2);
    expect(flux.transfertEntrantDetecte).toBe(true);
  });

  it('un compte sans aucun transfert reste calculable', () => {
    const flux = analyserFluxCompte([
      ligne({ type: 'Cotisation', symbole: '1CAD', total: 7000 }),
      ligne({ type: 'Retrait', symbole: '1CAD', total: -2000, date: '2025-06-01' }),
    ]);
    expect(flux.transfertEntrantDetecte).toBe(false);
    expect(flux.cotisations).toBe(7000);
    expect(flux.retraits).toBe(2000);
  });
});

describe('typeDeCompte — deux conventions, iA et VMBL', () => {
  it('lit le SUFFIXE d’un compte iA', () => {
    expect(typeDeCompte('37-3DYJ-W')).toBe('celi');
    expect(typeDeCompte('37-3DYJ-T')).toBe('ferr');
    expect(typeDeCompte('37-3DYJ-E')).toBe('non-enregistre');
  });

  it('lit la LETTRE DU MILIEU d’un compte VMBL — le suffixe y est un chiffre', () => {
    expect(typeDeCompte('4A-Y91I-7')).toBe('celi');          // « CONT AU CELI »
    expect(typeDeCompte('6A-C5SR-7')).toBe('reer');          // « CONT TO RRSP »
    expect(typeDeCompte('4A-YJQS-2')).toBe('reer-conjoint'); // « CONTCJ AU REER »
    expect(typeDeCompte('4A-WV7O-1')).toBe('reee');          // « COTIS AU REEE »
  });

  it('ATTENTION : R et S sont INVERSÉS entre les deux conventions', () => {
    expect(typeDeCompte('37-3ABC-R')).toBe('reer');           // iA : R = REER conjoint (même famille)
    expect(typeDeCompte('4A-ABCR-1')).toBe('reer');           // VMBL : R = REER personnel
    expect(typeDeCompte('4A-ABCS-1')).toBe('reer-conjoint');  // VMBL : S = REER conjoint
  });

  it('rend null sur une lettre VMBL non prouvée — jamais un régime deviné', () => {
    for (const c of ['4A-ABCE-1', '4A-ABCQ-1', '4A-ABCT-1', '4A-ABCB-1']) {
      expect(typeDeCompte(c)).toBeNull();
    }
  });

  it('reconnaît le format VMBL', () => {
    expect(estCompteVMBL('4A-Y91I-7')).toBe(true);
    expect(estCompteVMBL('37-3DYJ-W')).toBe(false);
  });
});
