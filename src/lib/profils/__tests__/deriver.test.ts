// La dérivation du grand livre vers le profil. Noms fictifs.
import { describe, it, expect } from 'vitest';
import {
  deriverHistoriqueRegime,
  observerTransferts,
  deriverTransactionsAnnee,
  deriverCotisationsAnnee,
} from '../deriver';
import { parserCollage } from '../historique';
import type { LigneTransaction } from '@/lib/parseur-croesus/types';

function l(p: Partial<LigneTransaction>): LigneTransaction {
  return {
    date: '2024-05-10', dateReglement: '2024-05-12', nom: 'CLIENT FICTIF', note: '',
    type: 'Achat', symbole: '', quantite: null, prix: null, devise: 'CAD',
    total: null, gainsPertes: null, solde: null, noCompte: '37-FICT-W',
    description: '', ...p,
  };
}

describe('deriverHistoriqueRegime — CELI', () => {
  it('ne compte que l’argent neuf, pas les apports en nature', () => {
    const h = deriverHistoriqueRegime([
      l({ type: 'Cotisation', symbole: '1CAD', total: 7000, date: '2020-02-01' }),
      // Apport en nature : les deux jambes s’annulent (règle 2).
      l({ type: 'Cotisation', symbole: '1CAD', total: 50000, date: '2021-01-15' }),
      l({ type: 'Cotisation', symbole: 'XIU', quantite: 1200, total: -50000, date: '2021-01-15' }),
    ], 'celi', 2026, '2026-08-04');
    expect(h.cotisationsTotales).toBe(7000);
    expect(h.dateOuverture).toBe('2020-02-01');
    expect(h.portee).toBe('interne-seulement');
  });

  it('exclut les retraits de l’année courante — ils ne redonnent des droits que l’an prochain', () => {
    const h = deriverHistoriqueRegime([
      l({ type: 'Cotisation', symbole: '1CAD', total: 10000, date: '2020-02-01' }),
      l({ type: 'Retrait', symbole: '1CAD', total: -3000, date: '2024-06-01' }),
      l({ type: 'Retrait', symbole: '1CAD', total: -5000, date: '2026-03-01' }),   // année courante
    ], 'celi', 2026, '2026-08-04');
    expect(h.retraitsAnneesPassees).toBe(3000);
  });

  it('un apport en nature sans note rétrograde le régime (règle 4)', () => {
    const h = deriverHistoriqueRegime([
      l({ type: 'Cotisation', symbole: '1CAD', total: 40000, date: '2022-01-10' }),
      l({ type: 'Cotisation', symbole: 'TD', quantite: 300, total: -40000, date: '2022-01-10' }),
    ], 'celi', 2026, '2026-08-04');
    expect(h.transfertEntrantDetecte).toBe(true);
    expect(h.cotisationsTotales).toBe(0);
  });

  it('rend tout null quand le régime est absent — jamais un zéro trompeur', () => {
    const h = deriverHistoriqueRegime([l({ noCompte: '37-FICT-A' })], 'celi', 2026, '2026-08-04');
    expect(h.dateOuverture).toBeNull();
    expect(h.cotisationsTotales).toBeNull();
    expect(h.portee).toBe('inconnue');
  });
});

describe('observerTransferts — la matière de l’écran de résolution', () => {
  it('sépare les appariés des orphelins, du plus récent au plus ancien', () => {
    const t = observerTransferts([
      l({ type: 'Transfert', symbole: '1CAD', total: 25000, date: '2020-01-05', note: 'TRANSFERE A 37-FICT-S' }),
      l({ type: 'Transfert', symbole: '1CAD', total: 40000, date: '2021-03-15', note: '' }),
    ]);
    expect(t).toHaveLength(2);
    expect(t[0].date).toBe('2021-03-15');
    expect(t[0].apparie).toBe(false);
    expect(t[1].apparie).toBe(true);
  });

  it('ignore les transferts sortants', () => {
    expect(observerTransferts([
      l({ type: 'Transfert', symbole: '1CAD', total: -9000 }),
    ])).toHaveLength(0);
  });
});

describe('deriverTransactionsAnnee', () => {
  it('sépare gains et pertes de l’année, et les retraits par régime', () => {
    const r = deriverTransactionsAnnee([
      l({ type: 'Vente', gainsPertes: 32400, date: '2026-04-02', noCompte: '37-FICT-A' }),
      l({ type: 'Vente', gainsPertes: -3100, date: '2026-05-11', noCompte: '37-FICT-A' }),
      l({ type: 'Vente', gainsPertes: 9999, date: '2025-04-02', noCompte: '37-FICT-A' }),   // autre année
      l({ type: 'Retrait', total: -12000, date: '2026-07-01', noCompte: '37-FICT-S' }),
    ], 2026);
    expect(r.gainsRealises).toBe(32400);
    expect(r.pertesRealisees).toBe(3100);
    expect(r.retraitsReer).toBe(12000);
    expect(r.retraitsCeli).toBe(0);
  });
});

describe('deriverCotisationsAnnee', () => {
  it('applique la partie double par compte et par année', () => {
    const r = deriverCotisationsAnnee([
      l({ type: 'Cotisation', symbole: '1CAD', total: 7000, date: '2026-02-01', noCompte: '37-FICT-W' }),
      l({ type: 'Cotisation', symbole: '1CAD', total: 30000, date: '2026-02-01', noCompte: '37-FICT-S' }),
      l({ type: 'Cotisation', symbole: 'BCE', quantite: 900, total: -30000, date: '2026-02-01', noCompte: '37-FICT-S' }),
    ], 2026);
    expect(r.celi).toBe(7000);
    expect(r.reer).toBe(0);          // apport en nature, pas d’argent neuf
  });
});

describe('parserCollage — la lecture du texte brut', () => {
  it('lit une ligne à 20 colonnes et ignore le reste', () => {
    const col = new Array(20).fill('');
    col[1] = 'BANQUE NATIONALE'; col[2] = 'CLIENT FICTIF'; col[5] = '2026-02-01';
    col[7] = 'Cotisation'; col[8] = '1CAD'; col[12] = '7 000,00'; col[19] = '37-FICT-W';
    const texte = ['en-tete sans tabulations', col.join('\t'), '', 'ligne trop courte'].join('\n');
    const r = parserCollage(texte);
    expect(r.lignes).toHaveLength(1);
    expect(r.lignes[0].total).toBe(7000);
    expect(r.lignes[0].type).toBe('Cotisation');
    expect(r.ignorees).toBe(2);
  });
});
