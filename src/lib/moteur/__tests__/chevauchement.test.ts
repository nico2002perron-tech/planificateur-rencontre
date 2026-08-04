import { describe, it, expect } from "vitest";
import { analyserChevauchement } from "@/lib/moteur";
import type { Position, PositionResolue } from "@/types/diagnostic";
import type { TitreRecoupe } from "@/lib/moteur/chevauchement";
import {
  catalogueTest,
  PORTE_RECOUPEMENT,
  PORTE_SANS_RECOUPEMENT,
  PORTE_RECOUPEMENT_PARTIEL,
  PORTE_COUTEUX,
  PORTE_ECONOME,
} from "./fixtures/portefeuilles";

function resoudre(positions: Position[]): PositionResolue[] {
  const cat = catalogueTest();
  const total = positions.reduce((s, p) => s + p.montant, 0);
  return positions.map((p) => {
    const fonds = cat.get(p.code.toUpperCase());
    return { ...p, poids: total > 0 ? p.montant / total : 0, fonds, nonResolu: !fonds };
  });
}

describe("analyserChevauchement — deux fonds canadiens qui se recoupent", () => {
  const axe = analyserChevauchement(resoudre(PORTE_RECOUPEMENT));
  const d = axe.donnees as {
    poidsRecoupement: number;
    couverture: number;
    titresRecoupes: TitreRecoupe[];
  };

  it("agrège le look-through sur le portefeuille total", () => {
    // Banque Royale : 0,5·0,10 + 0,5·0,08 = 0,09 ; Banque TD : 0,5·0,10 + 0,5·0,06 = 0,08
    expect(axe.disponible).toBe(true);
    expect(d.poidsRecoupement).toBeCloseTo(0.17, 6);
    expect(d.couverture).toBeCloseTo(1, 6);
  });

  it("rapproche les titres malgré la casse (« BANQUE ROYALE » = « Banque Royale »)", () => {
    const royale = d.titresRecoupes.find((t) => t.titre.toLowerCase() === "banque royale");
    expect(royale).toBeDefined();
    expect(royale!.nbFonds).toBe(2);
    expect(royale!.poids).toBeCloseTo(0.09, 6);
  });

  it("n'inclut PAS les titres détenus par un seul fonds", () => {
    // Enbridge (RBF460 seul) et Shopify (TDB900 seul) ne sont pas des recoupements.
    expect(d.titresRecoupes.map((t) => t.titre.toLowerCase())).not.toContain("enbridge");
    expect(d.titresRecoupes.map((t) => t.titre.toLowerCase())).not.toContain("shopify");
    expect(d.titresRecoupes).toHaveLength(2);
  });

  it("score = 58 (100 − 0,17/0,40·100), recoupement « notable » signalé", () => {
    expect(axe.score).toBe(58);
    expect(axe.constats.some((c) => c.includes("au moins 17"))).toBe(true);
  });
});

describe("analyserChevauchement — titres disjoints", () => {
  const axe = analyserChevauchement(resoudre(PORTE_SANS_RECOUPEMENT));
  it("aucun recoupement → score 100, constat explicite", () => {
    expect(axe.disponible).toBe(true);
    expect(axe.score).toBe(100);
    expect((axe.donnees as { poidsRecoupement: number }).poidsRecoupement).toBe(0);
    expect(axe.constats.some((c) => c.includes("Aucun titre commun"))).toBe(true);
  });
});

describe("analyserChevauchement — couverture partielle", () => {
  const axe = analyserChevauchement(resoudre(PORTE_RECOUPEMENT_PARTIEL));
  const d = axe.donnees as { poidsRecoupement: number; couverture: number };
  it("mesure en borne inférieure sur la portion connue (couverture 50 %)", () => {
    // Poids des fonds détaillés = 0,25 chacun. Royale : 0,25·0,10+0,25·0,08 = 0,045 ;
    // TD : 0,25·0,10+0,25·0,06 = 0,04 → recoupement 0,085.
    expect(d.poidsRecoupement).toBeCloseTo(0.085, 6);
    expect(d.couverture).toBeCloseTo(0.5, 6);
    expect(axe.score).toBe(79);
    expect(axe.constats.some((c) => c.includes("50 % du portefeuille"))).toBe(true);
  });
});

describe("analyserChevauchement — donnée insuffisante", () => {
  it("aucun fonds détaillé → indisponible plutôt qu'un score silencieux", () => {
    const axe = analyserChevauchement(resoudre(PORTE_COUTEUX)); // MMF559, sans topHoldings
    expect(axe.disponible).toBe(false);
    expect(axe.constats.some((c) => c.includes("n'est pas disponible"))).toBe(true);
  });

  it("un seul fonds détaillé → indisponible (il en faut deux)", () => {
    const axe = analyserChevauchement(resoudre(PORTE_ECONOME)); // XEQT détaillé, ZAG non
    expect(axe.disponible).toBe(false);
    expect(axe.constats.some((c) => c.includes("au moins deux"))).toBe(true);
  });
});
