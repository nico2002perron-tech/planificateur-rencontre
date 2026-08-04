import { describe, it, expect } from "vitest";
import { analyserGeographie } from "@/lib/moteur";
import type { Position, PositionResolue } from "@/types/diagnostic";
import {
  catalogueTest,
  PORTE_ECONOME,
  PORTE_TOUT_CANADA,
  PORTE_AVEC_INCONNU,
} from "./fixtures/portefeuilles";

function resoudre(positions: Position[]): PositionResolue[] {
  const cat = catalogueTest();
  const total = positions.reduce((s, p) => s + p.montant, 0);
  return positions.map((p) => {
    const fonds = cat.get(p.code.toUpperCase());
    return { ...p, poids: total > 0 ? p.montant / total : 0, fonds, nonResolu: !fonds };
  });
}

describe("analyserGeographie — l'économe", () => {
  const axe = analyserGeographie(resoudre(PORTE_ECONOME));
  it("Canada ≈ 40 % (0,8·0,25 + 0,2·1,0)", () => {
    expect(axe.donnees.canada).toBeCloseTo(0.4, 6);
    expect(axe.score).toBe(62);
  });
});

describe("analyserGeographie — le tout-Canada", () => {
  const axe = analyserGeographie(resoudre(PORTE_TOUT_CANADA));
  it("Canada ≈ 98 %, biais domestique marqué, score très bas", () => {
    expect(axe.donnees.canada).toBeCloseTo(0.98, 6);
    expect(axe.score).toBe(2);
    expect(axe.constats.some((c) => c.includes("biais domestique"))).toBe(true);
  });
});

describe("analyserGeographie — couverture partielle", () => {
  const axe = analyserGeographie(resoudre(PORTE_AVEC_INCONNU));
  it("mesure sur la portion connue (Canada 25 %, couverture 50 %)", () => {
    expect(axe.donnees.canada).toBeCloseTo(0.25, 6);
    expect(axe.donnees.couverture).toBeCloseTo(0.5, 6);
    expect(axe.score).toBe(77);
  });
});

describe("analyserGeographie — donnée absente", () => {
  const axe = analyserGeographie([
    { code: "ZZZ999", montant: 100000, poids: 1, nonResolu: true },
  ]);
  it("marque l'axe indisponible plutôt qu'un score silencieux", () => {
    expect(axe.disponible).toBe(false);
    expect(axe.constats.some((c) => c.includes("n'est pas disponible"))).toBe(true);
  });
});
