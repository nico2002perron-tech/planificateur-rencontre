import { describe, it, expect } from "vitest";
import { executerDiagnostic } from "@/lib/moteur";
import {
  catalogueTest,
  PORTE_ECONOME,
  PORTE_COUTEUX,
  PORTE_TOUT_CANADA,
  PORTE_AVEC_INCONNU,
} from "./fixtures/portefeuilles";

const cat = catalogueTest();

describe("executerDiagnostic — orchestration & scoring", () => {
  it("l'économe : score global 62, seul axe faible = concentration", () => {
    const d = executerDiagnostic(PORTE_ECONOME, cat);
    expect(d.valeurTotale).toBe(100000);
    expect(d.fondsNonResolus).toEqual([]);
    expect(d.couvertureFrais).toBe(1);
    expect(d.axes).toHaveLength(4);
    // Un seul fonds détaillé (XEQT ; ZAG n'a pas de titres) → chevauchement indisponible,
    // exclu du score global comme des axes faibles.
    expect(d.axes.find((a) => a.nom === "chevauchement")?.disponible).toBe(false);
    expect(d.scoreGlobal.score).toBe(62);
    expect(d.scoreGlobal.axesFaibles).toEqual(["concentration"]);
    expect(d.scoreGlobal.ordreNarratif).toEqual(["concentration", "geographie", "frais"]);
  });

  it("le coûteux : score global 33, frais et concentration faibles", () => {
    const d = executerDiagnostic(PORTE_COUTEUX, cat);
    expect(d.scoreGlobal.score).toBe(33);
    expect(d.scoreGlobal.axesFaibles).toEqual(["frais", "concentration"]);
  });

  it("le tout-Canada : score global 46, récit mené par la géographie", () => {
    const d = executerDiagnostic(PORTE_TOUT_CANADA, cat);
    // Les deux fonds détiennent les mêmes banques → chevauchement disponible (score 59)
    // et compté dans le global : frais 71, chevauchement 59, concentration 50, géo 2 → 46.
    expect(d.axes.find((a) => a.nom === "chevauchement")?.score).toBe(59);
    expect(d.scoreGlobal.score).toBe(46);
    expect(d.scoreGlobal.axesFaibles).toEqual(["geographie", "concentration", "chevauchement"]);
    expect(d.scoreGlobal.ordreNarratif[0]).toBe("geographie");
  });

  it("fonds inconnu : listé, marqué non résolu, couverture 50 %", () => {
    const d = executerDiagnostic(PORTE_AVEC_INCONNU, cat);
    expect(d.fondsNonResolus).toEqual(["ZZZ999"]);
    expect(d.positions[1].nonResolu).toBe(true);
    expect(d.positions[0].nonResolu).toBe(false);
    expect(d.couvertureFrais).toBeCloseTo(0.5, 6);
    expect(d.scoreGlobal.axesFaibles).toEqual([]);
  });

  it("résout les codes insensiblement à la casse et aux espaces", () => {
    const d = executerDiagnostic([{ code: " xeqt ", montant: 1000 }], cat);
    expect(d.positions[0].nonResolu).toBe(false);
    expect(d.positions[0].fonds?.code).toBe("XEQT");
  });

  it("ne plante pas sur un portefeuille vide", () => {
    const d = executerDiagnostic([], cat);
    expect(d.valeurTotale).toBe(0);
    expect(d.fondsNonResolus).toEqual([]);
    expect(d.projectionFrais).toEqual({ h10: 0, h15: 0, h25: 0 });
  });
});
