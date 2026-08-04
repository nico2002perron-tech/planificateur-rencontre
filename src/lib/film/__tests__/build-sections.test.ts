import { describe, it, expect } from 'vitest';
import {
  buildComptes, buildObligations, buildMoisRevenu, rendementEcheance,
} from '../build-sections';
import type { PriceTargetHolding } from '../../pdf/price-targets-template';

const h = (over: Partial<PriceTargetHolding> = {}): PriceTargetHolding => ({
  symbol: 'RY.TO', name: 'Banque Royale', quantity: 100,
  averageCost: 100, marketPrice: 150, marketValue: 15000, bookValue: 10000,
  assetType: 'EQUITY', accountType: 'S', accountLabel: 'REER', annualIncome: 400,
  ...over,
});

// ═══ VOS COMPTES ═══════════════════════════════════════════════════════════

describe('buildComptes — le même argent, trois impôts', () => {
  it('regroupe par compte et calcule le gain NON réalisé', () => {
    const c = buildComptes([
      h({ accountType: 'S', accountLabel: 'REER', marketValue: 100000, bookValue: 70000, annualIncome: 2000 }),
      h({ accountType: 'W', accountLabel: 'CELI', marketValue: 60000, bookValue: 50000, annualIncome: 1200 }),
      h({ accountType: 'A', accountLabel: 'Comptant', marketValue: 40000, bookValue: 44000, annualIncome: 800 }),
    ])!;
    expect(c.lignes.map((l) => l.label)).toEqual(['REER', 'CELI', 'Comptant']); // triés par valeur
    expect(c.lignes[0].gain).toBe(30000);
    expect(c.lignes[1].gain).toBe(10000);
    expect(c.lignes[2].gain).toBe(-4000);
    expect(c.valeur).toBe(200000);
    expect(c.gain).toBe(36000);
  });

  it('additionne plusieurs positions du même compte', () => {
    const c = buildComptes([
      h({ accountLabel: 'CELI', accountType: 'W', marketValue: 10000, bookValue: 8000, annualIncome: 100 }),
      h({ symbol: 'ENB.TO', accountLabel: 'CELI', accountType: 'W', marketValue: 5000, bookValue: 6000, annualIncome: 50 }),
    ])!;
    expect(c.lignes).toHaveLength(1);
    expect(c.lignes[0].valeur).toBe(15000);
    expect(c.lignes[0].gain).toBe(1000);
    expect(c.lignes[0].revenu).toBe(150);
    expect(c.lignes[0].titres).toBe(2);
  });

  it('les liquidités comptent dans la valeur mais ne créent aucun gain', () => {
    const c = buildComptes([
      h({ accountLabel: 'Comptant', accountType: 'A', assetType: 'CASH', marketValue: 20000, bookValue: 0, annualIncome: 0 }),
    ])!;
    expect(c.lignes[0].valeur).toBe(20000);
    expect(c.lignes[0].gain).toBe(0);
  });

  it('une valeur comptable absente ne se transforme pas en gain fictif', () => {
    // bookValue à 0 sur une position qui vaut 15 000 : c'est une donnée manquante,
    // pas un coût nul. La compter donnerait un gain de 15 000 $ inventé.
    const c = buildComptes([h({ accountLabel: 'Marge', accountType: 'E', marketValue: 15000, bookValue: 0 })])!;
    expect(c.lignes[0].gain).toBe(0);
    expect(c.lignes[0].phrase).toMatch(/non fourni/i);
    expect(c.gainConnu).toBe(false);
  });

  it('la lecture fiscale suit le TYPE de compte', () => {
    const c = buildComptes([
      h({ accountType: 'W', accountLabel: 'CELI', marketValue: 100, bookValue: 50 }),
      h({ accountType: 'S', accountLabel: 'REER', marketValue: 100, bookValue: 50 }),
      h({ accountType: 'A', accountLabel: 'Comptant', marketValue: 100, bookValue: 50 }),
      h({ accountType: 'T', accountLabel: 'FERR', marketValue: 100, bookValue: 50 }),
    ])!;
    const par = Object.fromEntries(c.lignes.map((l) => [l.label, l.fiscalite]));
    expect(par).toEqual({ CELI: 'abri', REER: 'reporte', FERR: 'reporte', Comptant: 'imposable' });
  });

  it('la phrase change avec le SIGNE du gain — on n’annonce pas d’impôt sur une perte', () => {
    const gain = buildComptes([h({ accountType: 'A', accountLabel: 'Comptant', marketValue: 100, bookValue: 50 })])!;
    const perte = buildComptes([h({ accountType: 'A', accountLabel: 'Comptant', marketValue: 50, bookValue: 100 })])!;
    expect(gain.lignes[0].phrase).toMatch(/moitié.*revenu imposable/i);
    expect(perte.lignes[0].phrase).toMatch(/perte.*réduire/i);
  });

  it('les parts totalisent 100 %', () => {
    const c = buildComptes([
      h({ accountLabel: 'REER', marketValue: 75000 }),
      h({ accountLabel: 'CELI', accountType: 'W', marketValue: 25000 }),
    ])!;
    expect(c.lignes.reduce((s, l) => s + l.part, 0)).toBeCloseTo(100, 6);
  });

  it('aucune position → null, jamais une section vide', () => {
    expect(buildComptes([])).toBeNull();
  });
});

// ═══ VOS OBLIGATIONS ═══════════════════════════════════════════════════════

const obligation = (over: Partial<PriceTargetHolding> = {}): PriceTargetHolding => h({
  symbol: 'QC29', name: 'Québec 3,5 % 2029', assetType: 'FIXED_INCOME',
  quantity: 25000, marketPrice: 100.88, marketValue: 25220, bookValue: 24500,
  annualIncome: 875, couponRate: 3.5, maturityDate: '2029-09-01',
  accruedInterest: 140, modifiedDuration: 2.9,
  accountLabel: 'REER', accountType: 'S',
  ...over,
});

describe('buildObligations — l’échéancier du client', () => {
  const today = new Date(2026, 6, 15); // 15 juillet 2026

  it('bâtit des coupons SEMESTRIELS calés sur le mois d’échéance et ce mois moins six', () => {
    const o = buildObligations([obligation()], today)!;
    const coupons = o.lignes[0].flux.filter((f) => f.type === 'coupon');
    // Échéance en septembre (mois 8) → versements en mars (2) et septembre (8).
    expect(new Set(coupons.map((f) => f.mois))).toEqual(new Set([2, 8]));
    expect(coupons.every((f) => f.montant === 437.5)).toBe(true);
  });

  it('le dernier versement porte le capital EN PLUS du coupon', () => {
    const o = buildObligations([obligation()], today)!;
    const dernier = o.lignes[0].flux.filter((f) => f.cle === '2029-09');
    expect(dernier.map((f) => f.type).sort()).toEqual(['capital', 'coupon']);
    expect(dernier.find((f) => f.type === 'capital')!.montant).toBe(25000);
  });

  it('rien après l’échéance', () => {
    const o = buildObligations([obligation()], today)!;
    expect(o.lignes[0].flux.every((f) => f.cle <= '2029-09')).toBe(true);
  });

  it('marque comme passés les versements déjà encaissés cette année', () => {
    const o = buildObligations([obligation()], today)!;
    const mars = o.lignes[0].flux.find((f) => f.cle === '2026-03')!;
    const sept = o.lignes[0].flux.find((f) => f.cle === '2026-09' && f.type === 'coupon')!;
    expect(mars.passe).toBe(true);   // mars 2026 est derrière nous
    expect(sept.passe).toBe(false);  // septembre 2026 est devant
  });

  it('le total à venir n’inclut jamais les versements passés', () => {
    const o = buildObligations([obligation()], today)!;
    const somme = o.lignes[0].flux.filter((f) => !f.passe).reduce((s, f) => s + f.montant, 0);
    expect(o.lignes[0].totalAVenir).toBeCloseTo(somme, 6);
    expect(o.lignes[0].totalAVenir).toBeGreaterThan(25000);   // capital plus coupons
  });

  it('le capital des 24 prochains mois ne compte que les échéances proches', () => {
    const o = buildObligations([
      obligation({ symbol: 'A', maturityDate: '2027-03-01', quantity: 10000, marketValue: 10000 }),
      obligation({ symbol: 'B', maturityDate: '2033-03-01', quantity: 50000, marketValue: 50000 }),
    ], today)!;
    expect(o.capital24Mois).toBe(10000);
  });

  it('trie par échéance : ce qui revient bientôt d’abord', () => {
    const o = buildObligations([
      obligation({ symbol: 'LOIN', maturityDate: '2033-03-01' }),
      obligation({ symbol: 'PROCHE', maturityDate: '2027-03-01' }),
    ], today)!;
    expect(o.lignes.map((l) => l.symbole)).toEqual(['PROCHE', 'LOIN']);
  });

  it('sans échéance connue, aucune frise inventée', () => {
    const o = buildObligations([obligation({ maturityDate: undefined })], today)!;
    expect(o.lignes[0].flux).toEqual([]);
    expect(o.lignes[0].rendementEcheance).toBeNull();
  });

  it('aucune obligation → null', () => {
    expect(buildObligations([h()], today)).toBeNull();
    expect(buildObligations([], today)).toBeNull();
  });

  it('la durée moyenne est pondérée par la valeur, pas une moyenne simple', () => {
    const o = buildObligations([
      obligation({ symbol: 'A', marketValue: 90000, modifiedDuration: 1 }),
      obligation({ symbol: 'B', marketValue: 10000, modifiedDuration: 11 }),
    ], today)!;
    expect(o.dureeMoyenne).toBeCloseTo(2, 2);   // et non 6
  });
});

describe('rendementEcheance', () => {
  it('une obligation achetée AU PAIR rend son coupon', () => {
    // 100 $ payés, 2 $ tous les six mois pendant 5 ans, 100 $ à la fin → 4 % l’an.
    const flux: { montant: number; annees: number }[] = [];
    for (let i = 1; i <= 10; i++) flux.push({ montant: 2, annees: i / 2 });
    flux.push({ montant: 100, annees: 5 });
    expect(rendementEcheance(100, flux)).toBeCloseTo(4, 1);
  });

  it('payée SOUS le pair, elle rend plus que son coupon', () => {
    const flux: { montant: number; annees: number }[] = [];
    for (let i = 1; i <= 10; i++) flux.push({ montant: 2, annees: i / 2 });
    flux.push({ montant: 100, annees: 5 });
    const y = rendementEcheance(90, flux)!;
    expect(y).toBeGreaterThan(4);
    expect(y).toBeLessThan(7);
  });

  it('payée AU-DESSUS du pair, elle rend moins', () => {
    const flux: { montant: number; annees: number }[] = [];
    for (let i = 1; i <= 10; i++) flux.push({ montant: 2, annees: i / 2 });
    flux.push({ montant: 100, annees: 5 });
    const y = rendementEcheance(110, flux)!;
    expect(y).toBeLessThan(4);
    expect(y).toBeGreaterThan(1);
  });

  it('refuse de répondre plutôt que d’inventer', () => {
    expect(rendementEcheance(0, [{ montant: 100, annees: 1 }])).toBeNull();
    expect(rendementEcheance(100, [])).toBeNull();
    expect(rendementEcheance(100, [{ montant: 5, annees: -1 }])).toBeNull();
  });
});

// ═══ UN MOIS DU CALENDRIER ═════════════════════════════════════════════════

describe('buildMoisRevenu — expliquer, avec les montants du client', () => {
  const cal = Array.from({ length: 12 }, (_, i) => ({
    label: 'M' + i, dividends: i === 2 ? 900 : 100, coupons: i === 2 ? 400 : 0,
  }));

  it('donne les deux mécaniques quand le mois porte les deux', () => {
    const m = buildMoisRevenu(cal, 2, 6)!;
    expect(m.dividendes).toBe(900);
    expect(m.coupons).toBe(400);
    expect(m.total).toBe(1300);
    expect(m.etapes.some((e) => /dividende/i.test(e.titre))).toBe(true);
    expect(m.etapes.some((e) => /coupon/i.test(e.titre))).toBe(true);
  });

  it('écrit les VRAIS montants du mois dans les étapes', () => {
    const m = buildMoisRevenu(cal, 2, 6)!;
    // L'espace avant le « $ » est INSÉCABLE (U+00A0) : un montant ne doit jamais
    // se couper entre le nombre et son symbole en fin de ligne. On normalise pour
    // comparer, puis on vérifie l'insécable séparément — c'est une exigence
    // typographique, pas un détail.
    const titres = m.etapes.map((e) => e.titre);
    const plat = titres.map((t) => t.replace(/ /g, ' '));
    expect(plat.some((t) => t.includes('900 $'))).toBe(true);
    expect(plat.some((t) => t.includes('400 $'))).toBe(true);
    expect(titres.some((t) => /900 \$/.test(t))).toBe(true);
  });

  it('n’explique pas les coupons quand il n’y en a pas', () => {
    const m = buildMoisRevenu(cal, 5, 6)!;
    expect(m.coupons).toBe(0);
    expect(m.etapes.some((e) => /coupon/i.test(e.titre))).toBe(false);
  });

  it('un mois passé parle au passé', () => {
    const m = buildMoisRevenu(cal, 1, 6)!;
    expect(m.passe).toBe(true);
    expect(m.etapes.some((e) => /déjà entré/i.test(e.texte))).toBe(true);
  });

  it('un mois vide dit pourquoi il est vide, au lieu de rester muet', () => {
    const vide = [{ label: 'M', dividends: 0, coupons: 0 }];
    const m = buildMoisRevenu(vide, 0, 6)!;
    expect(m.etapes).toHaveLength(1);
    expect(m.etapes[0].texte).toMatch(/pas un mois sans rendement/i);
  });

  it('un index hors calendrier retourne null', () => {
    expect(buildMoisRevenu(cal, 12, 6)).toBeNull();
    expect(buildMoisRevenu(cal, -1, 6)).toBeNull();
  });
});
