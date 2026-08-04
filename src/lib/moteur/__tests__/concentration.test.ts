import { describe, it, expect } from "vitest";
import { analyserConcentration } from "@/lib/moteur";
import type { Position, PositionResolue } from "@/types/diagnostic";
import { catalogueTest, PORTE_ECONOME, PORTE_COUTEUX } from "./fixtures/portefeuilles";

// Petit résolveur local pour tester l'axe isolément.
function resoudre(positions: Position[]): PositionResolue[] {
  const cat = catalogueTest();
  const total = positions.reduce((s, p) => s + p.montant, 0);
  return positions.map((p) => {
    const fonds = cat.get(p.code.toUpperCase());
    return { ...p, poids: total > 0 ? p.montant / total : 0, fonds, nonResolu: !fonds };
  });
}

describe("analyserConcentration — l'économe (2 produits 80/20)", () => {
  const axe = analyserConcentration(resoudre(PORTE_ECONOME));

  it("compte 2 produits, le plus gros à 80 %", () => {
    expect(axe.donnees.nbPositions).toBe(2);
    expect((axe.donnees.produitMax as { poids: number }).poids).toBeCloseTo(0.8, 6);
  });

  it("score de concentration produit = 25", () => {
    expect(axe.score).toBe(25);
    expect(axe.donnees.niveauProduit).toBe("Très élevé");
  });

  it("HHI au niveau des positions = 6800", () => {
    // 80² + 20² = 6400 + 400
    expect(axe.donnees.hhi).toBe(6800);
  });
});

describe("analyserConcentration — le coûteux (1 seul produit)", () => {
  const axe = analyserConcentration(resoudre(PORTE_COUTEUX));

  it("un seul produit → score 0, niveau Très élevé", () => {
    expect(axe.donnees.nbPositions).toBe(1);
    expect(axe.score).toBe(0);
    expect(axe.donnees.niveauProduit).toBe("Très élevé");
  });

  it("aucune donnée sectorielle disponible (MMF559 sans secteurs)", () => {
    expect(axe.donnees.secteursDisponibles).toBe(false);
  });
});

describe("analyserConcentration — secteur au-delà de 30 %", () => {
  // 100 % RBF460 → finance 35 % > 30 % : doit être signalé.
  const axe = analyserConcentration(resoudre([{ code: "RBF460", montant: 100000 }]));

  it("signale le secteur finance", () => {
    const depassant = axe.donnees.secteursDepassant as Array<{ secteur: string }>;
    expect(depassant.map((s) => s.secteur)).toContain("finance");
    expect(axe.constats.some((c) => c.includes("finance"))).toBe(true);
  });
});
