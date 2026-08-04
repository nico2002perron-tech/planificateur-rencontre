// Le parseur de positions — et la règle 1 appliquée pour de vrai.
// Valeurs tirées de relevés réels, noms de clients retirés.
import { describe, it, expect } from 'vitest';
import { parserPositions, grouperParCompte } from '../positions';

/** Fabrique une ligne de relevé à 13 colonnes. */
function lig(...cols: string[]): string {
  const c = new Array(13).fill('');
  cols.forEach((v, i) => { c[i] = v; });
  return c.join('\t');
}

// Motifs réels : un FNB, une obligation municipale, une encaisse.
const FNB = lig('USD', 'Action', '206', 'ISHARES 3-7 YR TREAS BND', 'S', 'IEI',
  '170,298', '163,458', '35 081,41', '33 672,26');
const OBLIGATION = lig('CAD', 'Obligation', '39 000', 'ST-GEDEON ICS 4.45%20JA28', 'A', 'Q273A4',
  '100,000', '101,744', '39 000,00', '39 680,16');
const ENCAISSE = lig('CAD', 'Encaisse', '3 035,60', 'SOLDE DU COMPTE CAD', 'A', '1CAD',
  '1,000', '1,000', '3 035,60', '3 035,60');

describe('parserPositions — la règle 1 en action', () => {
  it('CAS 1 · une obligation : l’unitaire dérivé vaut 1,017 et non 101,744', () => {
    const { positions } = parserPositions(OBLIGATION);
    const o = positions[0];
    expect(o.symbole).toBe('Q273A4');
    expect(o.quantite).toBe(39000);
    // Le piège évité : 39 000 × 101,744 donnerait 3,97 M$ pour 39 680 $ réels.
    expect(o.prixUnitaire).toBeCloseTo(1.01744, 5);
    expect(o.pbrUnitaire).toBeCloseTo(1, 5);
    expect((o.quantite * (o.prixUnitaire as number))).toBeCloseTo(39680.16, 2);
  });

  it('CAS 1b · un FNB : la MÊME formule redonne les colonnes unitaires', () => {
    const { positions } = parserPositions(FNB);
    const p = positions[0];
    expect(p.pbrUnitaire).toBeCloseTo(170.298, 3);
    expect(p.prixUnitaire).toBeCloseTo(163.458, 3);
  });

  it('le total reste exact pour les deux types — c’est ce qui compte', () => {
    const { positions } = parserPositions([FNB, OBLIGATION].join('\n'));
    const total = positions.reduce((s, p) => s + (p.valeurMarchande ?? 0), 0);
    expect(total).toBeCloseTo(33672.26 + 39680.16, 2);
  });
});

describe('parserPositions — encaisse, tolérance, suffixes', () => {
  it('met l’encaisse à part : ce n’est pas une position', () => {
    const r = parserPositions([ENCAISSE, FNB].join('\n'));
    expect(r.positions).toHaveLength(1);
    expect(r.encaisses).toEqual([{ suffixeCompte: 'A', devise: 'CAD', montant: 3035.6 }]);
  });

  it('lit les négatifs entre parenthèses (marge débitrice)', () => {
    const r = parserPositions(
      lig('CAD', 'Encaisse', '(160 675,63)', 'SOLDE', 'E', '1CAD', '0', '0', '0', '(160 675,63)')
    );
    expect(r.encaisses[0].montant).toBeCloseTo(-160675.63, 2);
  });

  it('ignore l’en-tête, les lignes vides et les séparateurs sans échouer', () => {
    const r = parserPositions(['### CLIENT FICTIF', '', 'colonne unique', FNB].join('\n'));
    expect(r.positions).toHaveLength(1);
    expect(r.ignorees).toBe(1);
  });

  it('relève les suffixes de compte rencontrés', () => {
    const r = parserPositions([FNB, OBLIGATION, ENCAISSE].join('\n'));
    expect(r.suffixes).toEqual(['A', 'S']);
  });

  it('rend null plutôt qu’un chiffre quand le coût manque', () => {
    const sansCout = lig('CAD', 'Action', '100', 'TITRE SANS COUT', 'A', 'ZZZ', '', '', '', '2 500,00');
    const p = parserPositions(sansCout).positions[0];
    expect(p.pbrUnitaire).toBeNull();
    expect(p.prixUnitaire).toBeCloseTo(25, 3);
  });
});

describe('grouperParCompte', () => {
  it('groupe par suffixe et laisse le numéro à null sans jointure', () => {
    const { positions } = parserPositions([FNB, OBLIGATION].join('\n'));
    const g = grouperParCompte(positions);
    expect(g.map((x) => x.suffixe)).toEqual(['A', 'S']);
    expect(g[0].numero).toBeNull();
  });

  it('accepte une jointure vers le numéro complet quand elle existe', () => {
    const { positions } = parserPositions([FNB, OBLIGATION].join('\n'));
    const g = grouperParCompte(positions, (s) => (s === 'A' ? '37-FICT-A' : null));
    expect(g.find((x) => x.suffixe === 'A')?.numero).toBe('37-FICT-A');
    expect(g.find((x) => x.suffixe === 'S')?.numero).toBeNull();
  });
});
