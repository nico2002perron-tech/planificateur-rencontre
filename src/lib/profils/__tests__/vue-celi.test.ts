// LA VUE CELI DE LA TIMELINE — la bascule contrôlée du 20 août 2026.
//
// Ce que ce fichier tient :
//   · D5 : les devises ne se fondent JAMAIS — cas A/B/C/D de la consigne ;
//   · D1 : les retraits sont une borne supérieure DÉCOMPOSÉE (fermes + à
//     confirmer), jamais un tri silencieux ;
//   · l'« inconnu » ne devient jamais 0 ni un faux CAD ;
//   · chaque nombre de la vue est traçable jusqu'aux événements ;
//   · la COMPARAISON EXHAUSTIVE ancien ↔ vue, divergence par divergence,
//     chaque écart classé.
//
// Données synthétiques, comptes « FICT ».
import { describe, it, expect } from 'vitest';
import { construireLigneDuTemps, vueCeliParAnnee } from '../ligne-du-temps';
import { deriverCeliParAnnee } from '../deriver';
import type { LigneTransaction } from '@/lib/parseur-croesus/types';

function tx(partiel: Partial<LigneTransaction> & { type: string; noCompte: string }): LigneTransaction {
  return {
    date: '2026-03-15', dateReglement: '2026-03-17', nom: 'Fictif, Test', note: '',
    symbole: '1CAD', quantite: null, prix: null, devise: 'CAD', total: 1000,
    gainsPertes: null, solde: null, description: '',
    ...partiel,
  };
}
const CELI = '37-FICT-W';
const CELI2 = '37-AUTR-W';
const vue = (lignes: LigneTransaction[]) => vueCeliParAnnee(construireLigneDuTemps(lignes));

describe('D5 — les devises ne se fondent jamais', () => {
  it('cas A · 6 000 CAD → 6 000 CAD, rien d’étranger', () => {
    const v = vue([tx({ type: 'Cotisation', noCompte: CELI, total: 6000 })]);
    expect(v.cotisations['2026']).toBe(6000);
    expect(v.completude.horsCadPresent).toBe(false);
    expect(v.completude.deviseEtrangere.cotisations).toEqual({});
  });

  it('cas B · 1 000 USD → reste 1 000 USD ; la vue ne prétend JAMAIS que ça vaut 1 000 CAD', () => {
    const v = vue([tx({ type: 'Cotisation', noCompte: CELI, symbole: '1USD', devise: 'USD', total: 1000 })]);
    expect(v.cotisations['2026']).toBeUndefined();          // pas de nombre CAD — pas un faux zéro non plus
    expect(v.completude.deviseEtrangere.cotisations['2026']).toEqual({ USD: 1000 });
    expect(v.completude.horsCadPresent).toBe(true);          // le périmètre se DÉCLARE partiel
  });

  it('cas C · 6 000 CAD + 1 000 USD → jamais 7 000', () => {
    const v = vue([
      tx({ type: 'Cotisation', noCompte: CELI, total: 6000 }),
      tx({ type: 'Cotisation', noCompte: CELI, symbole: '1USD', devise: 'USD', total: 1000 }),
    ]);
    expect(v.cotisations['2026']).toBe(6000);                // CAD seulement
    expect(v.completude.deviseEtrangere.cotisations['2026']).toEqual({ USD: 1000 });
    // Et l'ANCIEN fond bel et bien — c'est le défaut que la bascule corrige :
    expect(deriverCeliParAnnee([
      tx({ type: 'Cotisation', noCompte: CELI, total: 6000 }),
      tx({ type: 'Cotisation', noCompte: CELI, symbole: '1USD', devise: 'USD', total: 1000 }),
    ]).cotisations['2026']).toBe(7000);
  });

  it('cas D · AUCUN mécanisme de conversion n’existe dans cette étape — le champ n’offre qu’une déclaration', () => {
    // Le mécanisme « équivalent CAD explicite » viendra d'une donnée structurée
    // future ; l'inventer ici serait une conversion approximative. On vérifie
    // qu'il n'existe PAS : le type de la vue n'a aucun champ de conversion.
    const v = vue([tx({ type: 'Cotisation', noCompte: CELI, symbole: '1USD', devise: 'USD', total: 1000 })]);
    expect(JSON.stringify(v)).not.toMatch(/taux|conversion|equivalentCad/i);
  });

  it('retraits USD : même prudence — déclarés, jamais additionnés au CAD', () => {
    const v = vue([
      tx({ type: 'Retrait', noCompte: CELI, total: -2000 }),
      tx({ type: 'Retrait', noCompte: CELI, symbole: '1USD', devise: 'USD', total: -500 }),
    ]);
    expect(v.retraits['2026']).toBe(2000);                   // CAD seulement
    expect(v.completude.deviseEtrangere.retraits['2026']).toEqual({ USD: 500 });
  });
});

describe('D1 — la borne supérieure, décomposée', () => {
  it('retrait franc → ferme ; retrait noté → à confirmer ; la borne les additionne', () => {
    const v = vue([
      tx({ type: 'Retrait', noCompte: CELI, total: -2000 }),
      tx({ type: 'Retrait', noCompte: CELI, total: -7000, note: 'TRANSFERE A 37FICTA' }),
    ]);
    expect(v.detail.retraitsFermes['2026']).toBe(2000);
    expect(v.detail.retraitsAConfirmer['2026']).toBe(7000);
    expect(v.retraits['2026']).toBe(9000);                   // la borne — parité nominale avec l'ancien
    expect(deriverCeliParAnnee([
      tx({ type: 'Retrait', noCompte: CELI, total: -2000 }),
      tx({ type: 'Retrait', noCompte: CELI, total: -7000, note: 'TRANSFERE A 37FICTA' }),
    ]).retraits['2026']).toBe(9000);
  });

  it('retrait EN TITRES (D2) → à confirmer, jamais ferme', () => {
    const v = vue([tx({ type: 'Retrait', noCompte: CELI, symbole: 'TD', quantite: 40, total: -5000 })]);
    expect(v.detail.retraitsFermes['2026']).toBeUndefined();
    expect(v.detail.retraitsAConfirmer['2026']).toBe(5000);
    expect(v.retraits['2026']).toBe(5000);
  });

  it('un « retrait » à montant POSITIF (renversement possible) ne compte nulle part — il reste un ambigu déclaré', () => {
    const v = vue([tx({ type: 'Retrait', noCompte: CELI, total: 2000 })]);
    expect(v.retraits).toEqual({});
    expect(v.detail.retraitsAConfirmer).toEqual({});
    expect(v.completude.evenementsAmbigus).toBe(1);
  });
});

describe('traçabilité et bords', () => {
  it('chaque nombre de la vue pointe ses événements — et la somme est exacte', () => {
    const lignes = [
      tx({ type: 'Cotisation', noCompte: CELI, total: 4000 }),
      tx({ type: 'Cotisation', noCompte: CELI2, total: 2500 }),
      tx({ type: 'Retrait', noCompte: CELI, total: -1000 }),
      tx({ type: 'Retrait', noCompte: CELI, total: -3000, note: 'TRSF 37FICTA' }),
    ];
    const t = construireLigneDuTemps(lignes);
    const v = vueCeliParAnnee(t);
    const somme = (ids: number[]) => ids.reduce((s, id) => s + Math.abs(t.evenements[id].montant as number), 0);
    expect(somme(v.detail.sources.cotisations['2026'])).toBe(v.cotisations['2026']);
    expect(somme(v.detail.sources.retraitsFermes['2026'])).toBe(v.detail.retraitsFermes['2026']);
    expect(somme(v.detail.sources.retraitsAConfirmer['2026'])).toBe(v.detail.retraitsAConfirmer['2026']);
  });

  it('aucun flux → vue vide, portée inconnue — pas un « zéro connu »', () => {
    const v = vue([]);
    expect(v.cotisations).toEqual({});
    expect(v.retraits).toEqual({});
    expect(v.completude.portee).toBe('inconnue');
  });

  it('une ligne ambiguë ou inconnue n’entre dans aucun nombre de la vue', () => {
    const v = vue([
      tx({ type: 'Transfert', noCompte: CELI, total: 20000 }),          // ambigu
      tx({ type: 'Mystère', noCompte: CELI, total: 500 }),              // inconnu
    ]);
    expect(v.cotisations).toEqual({});
    expect(v.retraits).toEqual({});
    expect(v.completude.evenementsAmbigus).toBe(1);
  });
});

describe('la comparaison exhaustive — ancien ↔ vue, chaque écart classé', () => {
  type Cas = { nom: string; lignes: LigneTransaction[]; verdict: 'parite' | 'bug-ancien-corrige' | 'ambiguite-volontaire' };
  const CAS: Cas[] = [
    { nom: 'cas simple', verdict: 'parite', lignes: [tx({ type: 'Cotisation', noCompte: CELI, total: 7000 })] },
    { nom: 'multi-comptes', verdict: 'parite', lignes: [
      tx({ type: 'Cotisation', noCompte: CELI, total: 5000 }), tx({ type: 'Cotisation', noCompte: CELI2, total: 1500 })] },
    { nom: 'multi-années', verdict: 'parite', lignes: [
      tx({ type: 'Cotisation', noCompte: CELI, date: '2024-02-01', total: 6000 }),
      tx({ type: 'Cotisation', noCompte: CELI, date: '2025-02-01', total: 6500 }),
      tx({ type: 'Retrait', noCompte: CELI, date: '2025-08-01', total: -2000 })] },
    { nom: 'partie double cotisation (transfert écarté)', verdict: 'parite', lignes: [
      tx({ type: 'Cotisation', noCompte: CELI, total: 9000 }),
      tx({ type: 'Cotisation', noCompte: CELI, symbole: 'TD', quantite: 55, total: -9000, note: 'TRANSFERE A 37AUTRW' })] },
    { nom: 'partie double cotisation en titres (comptée)', verdict: 'parite', lignes: [
      tx({ type: 'Cotisation', noCompte: CELI, total: 12000 }),
      tx({ type: 'Cotisation', noCompte: CELI, symbole: 'FNB', quantite: 100, total: -12000, note: 'COTISATION EN TITRES' })] },
    { nom: 'retrait franc', verdict: 'parite', lignes: [tx({ type: 'Retrait', noCompte: CELI, total: -2000 })] },
    { nom: 'retrait noté D1 — la borne préserve le nominal', verdict: 'parite', lignes: [
      tx({ type: 'Retrait', noCompte: CELI, total: -7000, note: 'TRANSFERE A 37FICTA' })] },
    { nom: 'retrait en titres D2 — la borne préserve le nominal', verdict: 'parite', lignes: [
      tx({ type: 'Retrait', noCompte: CELI, symbole: 'TD', quantite: 40, total: -5000 })] },
    { nom: 'cotisation USD D5', verdict: 'bug-ancien-corrige', lignes: [
      tx({ type: 'Cotisation', noCompte: CELI, total: 6000 }),
      tx({ type: 'Cotisation', noCompte: CELI, symbole: '1USD', devise: 'USD', total: 1000 })] },
    { nom: 'retrait USD D5', verdict: 'bug-ancien-corrige', lignes: [
      tx({ type: 'Retrait', noCompte: CELI, total: -2000 }),
      tx({ type: 'Retrait', noCompte: CELI, symbole: '1USD', devise: 'USD', total: -500 })] },
    { nom: 'transfert entrant sans note (jamais compté nulle part)', verdict: 'ambiguite-volontaire', lignes: [
      tx({ type: 'Transfert', noCompte: CELI, total: 20000 })] },
    { nom: 'bruit hors flux', verdict: 'parite', lignes: [
      tx({ type: 'Achat', noCompte: CELI, symbole: 'XYZ', total: -3000 }),
      tx({ type: 'Dividendes', noCompte: CELI, symbole: 'XYZ', total: 80 })] },
  ];

  for (const c of CAS) {
    it(`${c.nom} → ${c.verdict}`, () => {
      const ancien = deriverCeliParAnnee(c.lignes);
      const v = vue(c.lignes);
      const annees = new Set([...Object.keys(ancien.cotisations), ...Object.keys(ancien.retraits),
        ...Object.keys(v.cotisations), ...Object.keys(v.retraits)]);

      for (const a of annees) {
        const ancienCot = ancien.cotisations[a] ?? 0;
        const ancienRet = ancien.retraits[a] ?? 0;
        const vueCot = v.cotisations[a] ?? 0;
        const vueRet = v.retraits[a] ?? 0;
        if (c.verdict === 'parite' || c.verdict === 'ambiguite-volontaire') {
          // Parité au dollar près — l'ambiguïté volontaire (transfert sans note)
          // vaut 0 des DEUX côtés : l'ancien ne comptait pas les Transferts non plus.
          expect(vueCot, `${c.nom} cotisations ${a}`).toBe(ancienCot);
          expect(vueRet, `${c.nom} retraits ${a}`).toBe(ancienRet);
        } else {
          // bug-ancien-corrigé (D5) : l'écart est EXACTEMENT le montant étranger fondu.
          const usdCot = Object.values(v.completude.deviseEtrangere.cotisations[a] ?? {}).reduce((s, x) => s + x, 0);
          const usdRet = Object.values(v.completude.deviseEtrangere.retraits[a] ?? {}).reduce((s, x) => s + x, 0);
          expect(vueCot + usdCot, `${c.nom} cotisations ${a} (écart = fusion de devises)`).toBe(ancienCot);
          expect(vueRet + usdRet, `${c.nom} retraits ${a}`).toBe(ancienRet);
          expect(usdCot + usdRet, `${c.nom} : l'écart existe`).toBeGreaterThan(0);
        }
      }
    });
  }
});
