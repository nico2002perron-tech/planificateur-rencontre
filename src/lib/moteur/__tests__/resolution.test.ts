import { describe, it, expect } from "vitest";
import { construireCatalogue, diagnostiquer } from "@/lib/moteur/resolution";
import type { ChargeurFonds } from "@/lib/moteur/resolution";
import { FONDS, PORTE_ECONOME, PORTE_AVEC_INCONNU } from "./fixtures/portefeuilles";

// Chargeur factice + espion sur les codes demandés.
function chargeurEspion() {
  const appels: string[][] = [];
  const charger: ChargeurFonds = async (codes) => {
    appels.push(codes);
    return FONDS.filter((f) => codes.includes(f.code.toUpperCase()));
  };
  return { charger, appels };
}

describe("construireCatalogue", () => {
  it("construit un catalogue clé par code MAJUSCULE", async () => {
    const { charger } = chargeurEspion();
    const cat = await construireCatalogue(PORTE_ECONOME, charger);
    expect(cat.size).toBe(2);
    expect(cat.get("XEQT")?.code).toBe("XEQT");
    expect(cat.get("ZAG")?.code).toBe("ZAG");
  });

  it("normalise (casse/espaces) et dédoublonne les codes demandés", async () => {
    const { charger, appels } = chargeurEspion();
    await construireCatalogue(
      [{ code: " xeqt " }, { code: "XEQT" }, { code: "zag" }],
      charger,
    );
    expect(appels).toHaveLength(1);
    expect([...appels[0]].sort()).toEqual(["XEQT", "ZAG"]);
  });

  it("ne charge rien pour un portefeuille vide", async () => {
    const { charger, appels } = chargeurEspion();
    const cat = await construireCatalogue([], charger);
    expect(cat.size).toBe(0);
    expect(appels).toHaveLength(0);
  });
});

describe("diagnostiquer (résolution + moteur)", () => {
  it("marque les fonds inconnus non résolus", async () => {
    const { charger } = chargeurEspion();
    const d = await diagnostiquer(PORTE_AVEC_INCONNU, charger);
    expect(d.fondsNonResolus).toEqual(["ZZZ999"]);
    expect(d.positions[0].nonResolu).toBe(false);
    expect(d.positions[1].nonResolu).toBe(true);
    expect(d.scoreGlobal.score).toBeGreaterThan(0);
  });
});
