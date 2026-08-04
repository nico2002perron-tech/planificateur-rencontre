/**
 * L'éventail de scénarios 12 mois — fonction PURE, partagée par le PDF et
 * l'export HTML interactif.
 *
 * Extraite de `price-targets-template.tsx` pour qu'un seul endroit calcule :
 * si le PDF et le film racontaient deux projections différentes au même client,
 * le document perdrait toute crédibilité.
 *
 * Sens des trois bornes : gain en CAPITAL si toutes les cibles BASSES /
 * CONSENSUS / HAUTES des analystes étaient atteintes, plus le revenu annuel
 * (dividendes + coupons) ajouté identiquement aux trois. Ce sont des repères,
 * pas des prévisions — le libellé à l'écran doit toujours le dire.
 */

/** Forme minimale exigée d'un titre (compatible `PriceTargetHolding`). */
export interface ScenarioHolding {
  assetType: string;
  quantity: number;
  marketPrice: number;
  currentPrice?: number;
  targetPrice?: number;
  targetLow?: number;
  targetHigh?: number;
}

export interface ScenarioRange {
  low: number;
  mid: number;
  high: number;
}

/**
 * @param holdings tous les titres du portefeuille (liquidités/revenu fixe/autres
 *                 sont ignorés : ils n'ont pas de cible d'analyste)
 * @param income   revenu annuel à ajouter aux trois bornes (dividendes + coupons)
 */
export function computeScenarios(holdings: ScenarioHolding[], income: number): ScenarioRange {
  let capLow = 0, capMid = 0, capHigh = 0;
  for (const h of holdings) {
    if (['CASH', 'FIXED_INCOME', 'OTHER'].includes(h.assetType)) continue;
    if (!h.targetPrice) continue;
    const cp = h.currentPrice || h.marketPrice;
    if (!(cp > 0)) continue;
    const mid = h.targetPrice;
    const lo = h.targetLow ?? mid;
    const hi = h.targetHigh ?? mid;
    capLow += h.quantity * (Math.min(lo, mid, hi) - cp);
    capMid += h.quantity * (mid - cp);
    capHigh += h.quantity * (Math.max(lo, mid, hi) - cp);
  }
  return { low: capLow + income, mid: capMid + income, high: capHigh + income };
}
