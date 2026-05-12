/** DCF Valuation — port direct de valuation/dcf.py */

/** Return val if finite, else fallback */
function safe(val: number, fallback = 0): number {
  return isFinite(val) ? val : fallback;
}

export function calculateValuation(
  grSales: number,
  grFcf: number,
  grEps: number,
  wacc: number,
  psTarget: number,
  peTarget: number,
  revenue: number,
  fcf: number,
  eps: number,
  cash: number,
  debt: number,
  shares: number
): [number, number, number] {
  const safeShares = Math.max(shares, 1);

  // DCF — allows negative FCF (negative intrinsic = unprofitable company)
  let priceDcf = 0;
  if (fcf !== 0 && wacc > 0) {
    const projections = Array.from({ length: 5 }, (_, i) => fcf * Math.pow(1 + grFcf, i + 1));
    // Cap terminal value denominator at 1% minimum to prevent extreme inflation when WACC < 3%
    const terminalVal = (projections[4] * 1.03) / Math.max(wacc - 0.03, 0.01);
    const pvFcf = projections.reduce((sum, val, i) => sum + val / Math.pow(1 + wacc, i + 1), 0);
    priceDcf = safe((pvFcf + terminalVal / Math.pow(1 + wacc, 5) + cash - debt) / safeShares);
  }

  // P/S
  let priceSales = 0;
  if (revenue > 0) {
    const futureMktCap = revenue * Math.pow(1 + grSales, 5) * psTarget;
    priceSales = safe(futureMktCap / Math.pow(1 + wacc, 5) / safeShares);
  }

  // P/E
  let priceEarnings = 0;
  if (eps > 0) {
    const epsFuture = eps * Math.pow(1 + grEps, 5);
    priceEarnings = safe((epsFuture * peTarget) / Math.pow(1 + wacc, 5));
  }

  return [priceDcf, priceSales, priceEarnings];
}

export function solveReverseDcf(
  currentPrice: number,
  fcf: number,
  wacc: number,
  shares: number,
  cash: number,
  debt: number
): number {
  if (fcf <= 0 || currentPrice <= 0 || wacc <= 0 || !isFinite(wacc)) return 0;
  let low = -0.5, high = 1.0;
  for (let i = 0; i < 30; i++) {
    const mid = (low + high) / 2;
    const [val] = calculateValuation(0, mid, 0, wacc, 0, 0, 0, fcf, 0, cash, debt, shares);
    if (!isFinite(val)) { high = mid; continue; }
    if (val > currentPrice) high = mid;
    else low = mid;
  }
  const result = (low + high) / 2;
  return isFinite(result) ? result : 0;
}

export function buildSensitivityMatrix(
  baseWacc: number,
  baseGrFcf: number,
  fcf: number,
  cash: number,
  debt: number,
  shares: number
): { rows: string[]; cols: string[]; data: number[][] } {
  // Clamp WACC to minimum 1% to avoid nonsensical negative rates
  const waccRange = [-1, -0.5, 0, 0.5, 1].map((d) => Math.max(baseWacc + d, 1));
  const growthRange = [-2, -1, 0, 1, 2].map((d) => baseGrFcf + d);

  const data = waccRange.map((w) =>
    growthRange.map((g) => {
      const [val] = calculateValuation(0, g / 100, 0, w / 100, 0, 0, 0, fcf, 0, cash, debt, shares);
      return isFinite(val) ? Math.round(val * 100) / 100 : 0;
    })
  );

  return {
    rows: waccRange.map((w) => `WACC ${w.toFixed(1)}%`),
    cols: growthRange.map((g) => `Cr. ${g.toFixed(1)}%`),
    data,
  };
}
