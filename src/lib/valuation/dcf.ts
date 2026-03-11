/** DCF Valuation — port direct de valuation/dcf.py */

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
    const terminalVal = (projections[4] * 1.03) / Math.max(wacc - 0.03, 1e-6);
    const pvFcf = projections.reduce((sum, val, i) => sum + val / Math.pow(1 + wacc, i + 1), 0);
    priceDcf = (pvFcf + terminalVal / Math.pow(1 + wacc, 5) + cash - debt) / safeShares;
  }

  // P/S
  let priceSales = 0;
  if (revenue > 0) {
    const futureMktCap = revenue * Math.pow(1 + grSales, 5) * psTarget;
    priceSales = futureMktCap / Math.pow(1 + wacc, 5) / safeShares;
  }

  // P/E
  let priceEarnings = 0;
  if (eps > 0) {
    const epsFuture = eps * Math.pow(1 + grEps, 5);
    priceEarnings = (epsFuture * peTarget) / Math.pow(1 + wacc, 5);
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
  if (fcf <= 0 || currentPrice <= 0) return 0;
  let low = -0.5, high = 1.0;
  for (let i = 0; i < 30; i++) {
    const mid = (low + high) / 2;
    const [val] = calculateValuation(0, mid, 0, wacc, 0, 0, 0, fcf, 0, cash, debt, shares);
    if (val > currentPrice) high = mid;
    else low = mid;
  }
  return (low + high) / 2;
}

export function buildSensitivityMatrix(
  baseWacc: number,
  baseGrFcf: number,
  fcf: number,
  cash: number,
  debt: number,
  shares: number
): { rows: string[]; cols: string[]; data: number[][] } {
  const waccRange = [-1, -0.5, 0, 0.5, 1].map((d) => baseWacc + d);
  const growthRange = [-2, -1, 0, 1, 2].map((d) => baseGrFcf + d);

  const data = waccRange.map((w) =>
    growthRange.map((g) => {
      const [val] = calculateValuation(0, g / 100, 0, w / 100, 0, 0, 0, fcf, 0, cash, debt, shares);
      return Math.round(val * 100) / 100;
    })
  );

  return {
    rows: waccRange.map((w) => `WACC ${w.toFixed(1)}%`),
    cols: growthRange.map((g) => `Cr. ${g.toFixed(1)}%`),
    data,
  };
}
