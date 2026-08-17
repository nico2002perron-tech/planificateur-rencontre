// POURQUOI UN COLLAGE N'A RIEN DONNÉ — les formats d'Excel qui échouaient en silence.
//
// Mesuré le 17 août 2026 : trois situations très ordinaires rendaient
// « 0 transaction ajoutée » sans un mot d'explication. Le parseur a raison de
// refuser ; c'est le silence qui était fautif.

import { describe, it, expect } from 'vitest';
import { diagnostiquerCollage, parserCollage } from '../historique';

const T = '\t';
function ligne(over: Record<number, string> = {}): string {
  const c = new Array(20).fill('');
  c[1] = 'FICTIF'; c[5] = '2026-03-15'; c[7] = 'Achat'; c[8] = 'AAA';
  c[9] = '100'; c[10] = '10'; c[11] = 'CAD'; c[12] = '-1000'; c[19] = '37-FICT-A';
  for (const [i, v] of Object.entries(over)) c[Number(i)] = v;
  return c.join(T);
}

describe('diagnostiquerCollage', () => {
  it('collage vide', () => {
    expect(diagnostiquerCollage('')).toMatch(/vide/i);
  });

  it('colonnes TRONQUÉES : dit combien il en manque et où est le compte', () => {
    const tronque = ligne().split(T).slice(0, 18).join(T);
    expect(parserCollage(tronque).lignes).toHaveLength(0);   // le parseur refuse
    const d = diagnostiquerCollage(tronque);
    expect(d).toMatch(/18/);
    expect(d).toMatch(/20/);
    expect(d).toMatch(/num[ée]ro de compte/i);
  });

  it('POINTS-VIRGULES (Excel français) : nomme le vrai problème', () => {
    const pv = ligne().replace(/\t/g, ';');
    expect(parserCollage(pv).lignes).toHaveLength(0);
    expect(diagnostiquerCollage(pv)).toMatch(/points-virgules/i);
  });

  it('dates JJ/MM/AAAA : dit le format attendu', () => {
    const mauvaiseDate = ligne({ 5: '15/03/2026' });
    expect(parserCollage(mauvaiseDate).lignes).toHaveLength(0);
    const d = diagnostiquerCollage(mauvaiseDate);
    expect(d).toMatch(/AAAA-MM-JJ/);
    expect(d).toMatch(/JJ\/MM\/AAAA/);
  });

  it('aucune séparation de colonnes : envoie vers Excel', () => {
    expect(diagnostiquerCollage('juste du texte colle a la main')).toMatch(/Excel/);
  });

  it('dernière colonne vide : le dit', () => {
    expect(diagnostiquerCollage(ligne({ 19: '' }))).toMatch(/derni[èe]re colonne/i);
  });

  it('NE MENT JAMAIS : un collage valide n’a aucun diagnostic', () => {
    // La garde qui compte : un diagnostic affiché sur un import réussi
    // enverrait corriger ce qui fonctionne.
    const bon = [ligne(), ligne({ 12: '-2000' })].join('\n');
    expect(parserCollage(bon).lignes).toHaveLength(2);
    expect(diagnostiquerCollage(bon)).toBeNull();
  });

  it('un en-tête Excel ne déclenche aucun faux diagnostic', () => {
    const avecEntete = ['Date\tNom\tType\tSymbole', ligne()].join('\n');
    expect(parserCollage(avecEntete).lignes).toHaveLength(1);
    expect(diagnostiquerCollage(avecEntete)).toBeNull();
  });
});
