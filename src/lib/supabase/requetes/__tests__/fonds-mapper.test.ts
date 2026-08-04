import { describe, it, expect } from "vitest";
import { versFonds } from "../fonds-mapper";

describe("versFonds — ligne Supabase → Fonds", () => {
  it("mappe snake_case → camelCase et coerce les numériques (même en string)", () => {
    const f = versFonds({
      code: "XEQT",
      nom: "iShares Core Equity ETF Portfolio",
      type: "fnb",
      categorie: "Répartition d'actifs — croissance",
      rfg: "0.0020", // Supabase peut renvoyer numeric en string
      rfg_median_categorie: "0.0025",
      allocation_geo: { canada: 0.25, usa: 0.45 },
      allocation_secteurs: null,
      source: "manuel",
      verifie_le: null,
      a_enrichir: false,
    });

    expect(f.code).toBe("XEQT");
    expect(f.type).toBe("fnb");
    expect(f.rfg).toBeCloseTo(0.002, 6);
    expect(f.rfgMedianCategorie).toBeCloseTo(0.0025, 6);
    expect(f.allocationGeo).toEqual({ canada: 0.25, usa: 0.45 });
    expect(f.allocationSecteurs).toBeUndefined();
    expect(f.aEnrichir).toBe(false);
  });

  it("tolère une médiane absente (null)", () => {
    const f = versFonds({ code: "ZAG", nom: "x", type: "fnb", categorie: "c", rfg: 0.0009 });
    expect(f.rfgMedianCategorie).toBeNull();
    expect(f.rfg).toBeCloseTo(0.0009, 6);
  });
});
