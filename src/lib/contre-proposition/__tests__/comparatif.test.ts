import { describe, it, expect } from "vitest";
import { executerComparatif } from "@/lib/contre-proposition/comparatif";
import type { Position, PositionResolue } from "@/types/diagnostic";
import { catalogueTest } from "@/lib/moteur/__tests__/fixtures/portefeuilles";

function resoudre(positions: Position[]): PositionResolue[] {
  const cat = catalogueTest();
  const total = positions.reduce((s, p) => s + p.montant, 0);
  return positions.map((p) => {
    const fonds = cat.get(p.code.toUpperCase());
    return { ...p, poids: total > 0 ? p.montant / total : 0, fonds, nonResolu: !fonds };
  });
}

describe("executerComparatif — actuel coûteux vs proposé économe", () => {
  const actuel = resoudre([{ code: "MMF559", montant: 100000 }]); // RFG 2,55 %
  const propose = resoudre([
    { code: "XEQT", montant: 80000 },
    { code: "ZAG", montant: 20000 },
  ]); // RFG 0,178 %
  const c = executerComparatif(actuel, propose);

  it("calcule les RFG et l'écart", () => {
    expect(c.rfgActuel).toBeCloseTo(0.0255, 6);
    expect(c.rfgPropose).toBeCloseTo(0.00178, 6);
    expect(c.ecartRfg).toBeGreaterThan(0.023);
  });

  it("chiffre l'économie composée sur 25 ans (~178 000 $)", () => {
    expect(c.economie.h25).toBeGreaterThan(150000);
    expect(c.economie.h25).toBeLessThan(200000);
    expect(c.economieAnnuelle).toBeGreaterThan(0);
  });

  it("compare l'exposition au Canada", () => {
    expect(c.canadaActuel).toBeCloseTo(0.05, 6);
    expect(c.canadaPropose).toBeCloseTo(0.4, 6);
  });
});
