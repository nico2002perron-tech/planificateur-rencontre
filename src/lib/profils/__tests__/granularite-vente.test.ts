// LA GRANULARITÉ DE VENTE — mesurée, pas devinée.
//
// Ces tests verrouillent la politique v1 : une action se vend par unités, une
// part de fonds par millièmes, et deux types ne se vendent pas du tout tant que
// leur granularité d'exécution n'est pas établie.
//
// Données entièrement fictives.
import { describe, it, expect } from 'vitest';
import {
  granulariteVente, quantitesExecutablesVoisines, enMilliemes, depuisMilliemes,
} from '../granularite-vente';
import { deriverComptes } from '../comptes';

// ═══════════════════════════════════════════════════════════════════════════
// Q19 — LA PROPAGATION
// ═══════════════════════════════════════════════════════════════════════════

describe('Q19 · typeInstrument traverse le parseur sans être transformé', () => {
  it('arrive dans Position exactement tel que le relevé le dit', () => {
    // Colonnes : devise · type · quantité · description · suffixe · symbole ·
    // PBR unit. · prix unit. · coût total · valeur marchande
    const releve = [
      ['CAD', 'Action', '100', 'Titre fictif', 'FICT-A', 'AAA', '50', '40', '5000', '4000'],
      ['CAD', "Fonds d'investissement", '527.731', 'Fonds fictif', 'FICT-A', 'FFF', '10', '9', '5277', '4749'],
      ['CAD', 'Obligation', '30000', 'Oblig fictive', 'FICT-A', 'OOO', '100', '95', '30000', '28500'],
    ].map((c) => c.join('\t')).join('\n');

    const { comptes } = deriverComptes(releve, [], { dateReleve: '2026-08-19' });
    const positions = comptes.flatMap((c) => c.positions);
    const parSymbole = new Map(positions.map((p) => [p.symbole, p]));

    expect(parSymbole.get('AAA')?.typeInstrument).toBe('Action');
    expect(parSymbole.get('FFF')?.typeInstrument).toBe("Fonds d'investissement");
    expect(parSymbole.get('OOO')?.typeInstrument).toBe('Obligation');

    // ⚠ ET `categorie` RESTE NULLE. Le type ne doit jamais servir à fabriquer
    // une catégorie d'actif — c'est l'interdit posé dans `comptes.ts`.
    for (const p of positions) expect(p.categorie).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Q27 / Q28 / Q29 / Q30 — LA QUANTITÉ TRAVERSE, SON SENS RESTE AU TYPE
// ═══════════════════════════════════════════════════════════════════════════

describe('Q27-Q29 · quantite est reportée fidèlement, quel que soit son sens', () => {
  const releve = [
    ['CAD', 'Action', '300', 'Titre fictif', 'FICT-A', 'AAA', '50', '40', '15000', '12000'],
    ['CAD', "Fonds d'investissement", '527.731', 'Fonds fictif', 'FICT-A', 'FFF', '10', '9', '5277.31', '4749.58'],
    ['CAD', 'Obligation', '30000', 'Oblig fictive', 'FICT-A', 'OOO', '100', '95', '30000', '28500'],
  ].map((c) => c.join(String.fromCharCode(9))).join(String.fromCharCode(10));
  const positions = deriverComptes(releve, [], { dateReleve: '2026-08-19' })
    .comptes.flatMap((c) => c.positions);
  const par = new Map(positions.map((p) => [p.symbole, p]));

  it('Q27 · une action : 300 reste 300', () => {
    expect(par.get('AAA')?.quantite).toBe(300);
  });

  it('Q28 · un fonds : 527,731 n’est ni tronqué ni arrondi', () => {
    expect(par.get('FFF')?.quantite).toBe(527.731);
    expect(par.get('FFF')?.quantite).not.toBe(527);
    expect(par.get('FFF')?.quantite).not.toBe(528);
  });

  it('Q29 · une obligation : 30 000 est reporté — c’est un NOMINAL, pas 30 000 titres', () => {
    // ⚠ Ce test ne dit QUE le report fidèle. Il ne prétend rien sur ce que
    // cette valeur permet d'exécuter : voir Q30 juste en dessous.
    expect(par.get('OOO')?.quantite).toBe(30000);
  });

  it('Q30 · l’obligation reste NON SUPPORTÉE, quantité présente ou non', () => {
    const oblig = par.get('OOO')!;
    expect(oblig.quantite).toBe(30000);
    expect(granulariteVente(oblig.typeInstrument)).toEqual({
      supportee: false, raison: 'obligation-nominal-non-supporte',
    });
    // Transporter une donnée n'est pas savoir l'utiliser.
    expect(quantitesExecutablesVoisines(300, oblig.quantite!, oblig.typeInstrument)).toEqual([]);
  });

  it('l’aller-retour d’un fonds survit jusqu’à la quantification en millièmes', () => {
    for (const attendue of [527.731, 379.659, 1204.123]) {
      const ligne = ['CAD', "Fonds d'investissement", String(attendue), 'F', 'FICT-A', 'FFF', '1', '1', '100', '90'].join(String.fromCharCode(9));
      const q = deriverComptes(ligne, [], { dateReleve: '2026-08-19' })
        .comptes.flatMap((c) => c.positions)[0].quantite!;
      expect(q, String(attendue)).toBe(attendue);
      expect(depuisMilliemes(enMilliemes(q)), String(attendue)).toBe(attendue);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LA POLITIQUE PAR TYPE
// ═══════════════════════════════════════════════════════════════════════════

describe('granulariteVente · une seule primitive décide', () => {
  it('Action → unités, pas de 1', () => {
    expect(granulariteVente('Action')).toEqual({ supportee: true, unite: 'unite', pas: 1 });
  });

  it('Fonds d’investissement → parts, pas de 0,001', () => {
    const g = granulariteVente("Fonds d'investissement");
    expect(g).toEqual({ supportee: true, unite: 'part', pas: 0.001 });
    // L'apostrophe typographique du relevé passe aussi bien que l'ASCII.
    expect(granulariteVente('Fonds d’investissement').supportee).toBe(true);
  });

  it('Q23 · Obligation → NON supportée, pour son motif propre', () => {
    // ⚠ Ce n'est PAS « données manquantes » : le prix de base et la valeur
    // marchande peuvent être parfaits. C'est la quantité d'exécution qui n'est
    // pas établie — la quantité d'une obligation est un NOMINAL.
    expect(granulariteVente('Obligation')).toEqual({
      supportee: false, raison: 'obligation-nominal-non-supporte',
    });
  });

  it('Q26 · Autre → non supporté', () => {
    expect(granulariteVente('Autre')).toEqual({
      supportee: false, raison: 'type-instrument-non-supporte',
    });
  });

  it('un type absent ou vide n’est jamais supposé supporté', () => {
    for (const t of [undefined, null, '', '   ', 'Bidule']) {
      expect(granulariteVente(t).supportee, String(t)).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Q20 / Q21 / Q22 — LA QUANTIFICATION
// ═══════════════════════════════════════════════════════════════════════════

describe('les millièmes évitent les flottants binaires', () => {
  it('Q21 · 527,731 parts survit à l’aller-retour', () => {
    expect(enMilliemes(527.731)).toBe(527731);
    expect(depuisMilliemes(527731)).toBe(527.731);
    for (const p of [379.659, 1204.123, 427.478, 1168.637, 204.832]) {
      expect(depuisMilliemes(enMilliemes(p))).toBe(p);
    }
  });
});

describe('quantitesExecutablesVoisines', () => {
  it('Q20 · une action ne devient JAMAIS fractionnaire', () => {
    const qs = quantitesExecutablesVoisines(299.933, 1000, 'Action');
    expect(qs).toEqual([299, 300]);
    for (const q of qs) expect(Number.isInteger(q)).toBe(true);
  });

  it('Q22 · un fonds est quantifié au millième, jamais à quatre décimales', () => {
    const qs = quantitesExecutablesVoisines(120.1234, 1000, "Fonds d'investissement");
    expect(qs).toEqual([120.123, 120.124]);
    // Le défaut que la représentation entière existe pour empêcher :
    for (const q of qs) expect(String(q)).not.toMatch(/\d{5,}$/);
  });

  it('Q4 · jamais plus que la quantité détenue', () => {
    expect(quantitesExecutablesVoisines(299.9, 250, 'Action')).toEqual([]);
    expect(quantitesExecutablesVoisines(240.5, 250, 'Action')).toEqual([240, 241]);
    // Exactement à la borne : le haut est retenu, le dépassement non.
    expect(quantitesExecutablesVoisines(249.7, 250, 'Action')).toEqual([249, 250]);
  });

  it('Q12 / Q13 · quantité nulle, négative ou aberrante → aucun candidat', () => {
    expect(quantitesExecutablesVoisines(10, 0, 'Action')).toEqual([]);
    expect(quantitesExecutablesVoisines(10, -5, 'Action')).toEqual([]);
    expect(quantitesExecutablesVoisines(0, 100, 'Action')).toEqual([]);
    expect(quantitesExecutablesVoisines(-3, 100, 'Action')).toEqual([]);
    expect(quantitesExecutablesVoisines(Number.NaN, 100, 'Action')).toEqual([]);
    expect(quantitesExecutablesVoisines(Number.POSITIVE_INFINITY, 100, 'Action')).toEqual([]);
  });

  it('Q23 / Q26 · un type non supporté ne produit AUCUN candidat', () => {
    expect(quantitesExecutablesVoisines(300, 1000, 'Obligation')).toEqual([]);
    expect(quantitesExecutablesVoisines(300, 1000, 'Autre')).toEqual([]);
  });

  it('une quantité théorique exacte ne rend qu’un seul candidat', () => {
    expect(quantitesExecutablesVoisines(300, 1000, 'Action')).toEqual([300]);
    expect(quantitesExecutablesVoisines(120.123, 1000, "Fonds d'investissement")).toEqual([120.123]);
  });

  it('une action détenue en quantité fractionnaire ne se vend qu’en entiers', () => {
    // Le cas ne s'observe pas dans la base, mais la borne doit tenir : on ne
    // propose jamais de vendre 100,7 actions parce que 100,7 sont détenues.
    expect(quantitesExecutablesVoisines(100.9, 100.7, 'Action')).toEqual([100]);
  });
});
