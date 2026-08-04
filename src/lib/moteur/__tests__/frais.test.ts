import { describe, it, expect } from "vitest";
import { executerDiagnostic, coutDesFrais } from "@/lib/moteur";
import type { ResultatAxe } from "@/types/diagnostic";
import {
  catalogueTest,
  PORTE_ECONOME,
  PORTE_COUTEUX,
  PORTE_AVEC_INCONNU,
} from "./fixtures/portefeuilles";

const axeFrais = (porte: Parameters<typeof executerDiagnostic>[0]): ResultatAxe =>
  executerDiagnostic(porte, catalogueTest()).axes.find((a) => a.nom === "frais")!;

describe("coutDesFrais — ancres calculées à la main", () => {
  it("est nul quand le RFG est nul", () => {
    expect(coutDesFrais(100_000, 0, 0.06, 25)).toBe(0);
  });

  it("sans rendement (g=0), c'est l'érosion pure : V0·(1−(1−f)^n)", () => {
    // 100 000 · (1 − 0,99^10) = 100 000 · (1 − 0,9043820750) = 9 561,79
    expect(coutDesFrais(100_000, 0.01, 0, 10)).toBeCloseTo(9561.79, 2);
  });

  it("capte l'effet composé : 100k à 2 % sur 25 ans (g=6 %) ≈ 162 600 $", () => {
    // 100 000 · (1,06^25 − 1,04^25) = 100 000 · (4,291871 − 2,665835) ≈ 162 604
    const cout = coutDesFrais(100_000, 0.02, 0.06, 25);
    expect(cout).toBeGreaterThan(162_000);
    expect(cout).toBeLessThan(163_000);
  });
});

describe("analyserFrais — l'économe (XEQT 80k / ZAG 20k)", () => {
  const axe = axeFrais(PORTE_ECONOME);

  it("RFG pondéré = 0,178 %", () => {
    // (80 000·0,0020 + 20 000·0,0009) / 100 000 = 178 / 100 000
    expect(axe.donnees.rfgPondere).toBeCloseTo(0.00178, 6);
  });

  it("médiane pondérée = 0,224 %", () => {
    // (80 000·0,0025 + 20 000·0,0012) / 100 000 = 224 / 100 000
    expect(axe.donnees.rfgMedianPondere).toBeCloseTo(0.00224, 6);
  });

  it("score au plafond (frais très bas)", () => {
    expect(axe.score).toBe(100);
    expect(axe.disponible).toBe(true);
  });

  it("mentionne la médiane dans les constats", () => {
    expect(axe.constats.some((c) => c.includes("médiane"))).toBe(true);
  });
});

describe("analyserFrais — le coûteux (MMF559 à 2,55 %)", () => {
  const d = executerDiagnostic(PORTE_COUTEUX, catalogueTest());
  const axe = d.axes.find((a) => a.nom === "frais")!;

  it("RFG pondéré = 2,55 %, score au plancher", () => {
    expect(axe.donnees.rfgPondere).toBeCloseTo(0.0255, 6);
    expect(axe.score).toBe(0);
  });

  it("dit qu'on paie plus que la médiane", () => {
    expect(axe.constats.some((c) => c.includes("de plus que"))).toBe(true);
  });

  it("projection 25 ans dans la fourchette attendue (~195 700 $)", () => {
    expect(d.projectionFrais.h25).toBeGreaterThan(190_000);
    expect(d.projectionFrais.h25).toBeLessThan(200_000);
  });
});

describe("analyserFrais — couverture partielle (fonds inconnu)", () => {
  const d = executerDiagnostic(PORTE_AVEC_INCONNU, catalogueTest());
  const axe = d.axes.find((a) => a.nom === "frais")!;

  it("ne pondère que la portion résolue (RFG = 0,20 %, couverture 50 %)", () => {
    expect(axe.donnees.rfgPondere).toBeCloseTo(0.002, 6);
    expect(d.couvertureFrais).toBeCloseTo(0.5, 6);
  });

  it("signale explicitement la portion non résolue", () => {
    expect(axe.constats.some((c) => c.includes("n'est pas résolu"))).toBe(true);
  });
});
