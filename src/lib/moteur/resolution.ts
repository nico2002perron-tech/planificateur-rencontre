// RÉSOLUTION — positions brutes → catalogue de fonds, via un chargeur INJECTÉ.
// On garde la logique pure et testable : la source réelle (table `fonds`, Yahoo)
// est fournie par l'appelant (voir lib/supabase/requetes/fonds.ts). Les fonds
// inconnus ne sont pas « devinés » : ils restent absents du catalogue et le moteur
// les marque `nonResolu` (échec explicite, jamais silencieux).

import type { Position, Diagnostic } from "@/types/diagnostic";
import type { Fonds } from "@/types/fonds";
import { executerDiagnostic } from "./index";

/** Charge les fonds correspondant à une liste de codes normalisés (MAJUSCULES). */
export type ChargeurFonds = (codes: string[]) => Promise<Fonds[]>;

function normaliser(code: string): string {
  return code.trim().toUpperCase();
}

/** Construit le catalogue (code → Fonds) requis par un portefeuille. */
export async function construireCatalogue(
  positions: Array<Pick<Position, "code">>,
  charger: ChargeurFonds,
): Promise<Map<string, Fonds>> {
  const codes = [...new Set(positions.map((p) => normaliser(p.code)).filter(Boolean))];
  if (codes.length === 0) return new Map();
  const fonds = await charger(codes);
  return new Map(fonds.map((f) => [normaliser(f.code), f]));
}

/** Résout puis diagnostique en une étape (point d'entrée de la route API). */
export async function diagnostiquer(
  positions: Position[],
  charger: ChargeurFonds,
): Promise<Diagnostic> {
  const catalogue = await construireCatalogue(positions, charger);
  return executerDiagnostic(positions, catalogue);
}
