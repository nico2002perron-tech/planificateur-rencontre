/**
 * Fixed Income Analytics — Calculs pour obligations et débentures
 *
 * Fonctionne sans API externe : toutes les données viennent de l'import Excel
 * et de la courbe des taux Banque du Canada (cached).
 */

import type { BocYieldPoint } from '@/lib/api/bank-of-canada';
import { interpolateYield } from '@/lib/api/bank-of-canada';

// ── Types ───────────────────────────────────────────────────────────────────

export interface BondHolding {
  symbol: string;          // CUSIP ou identifiant
  issuer: string;
  coupon: number;          // taux coupon annuel (ex: 5.82 = 5.82%)
  maturity: string;        // ISO date YYYY-MM-DD
  quantity: number;        // nombre d'unités (face value = quantity × parValue)
  parValue: number;        // valeur nominale par unité (default 100)
  marketPrice: number;     // prix du marché (% du pair, ex: 98.50)
  rating?: string;         // cote de crédit (S&P ou DBRS)
  category?: string;       // catégorie (Gov, Corp, Muni, etc.)
  source?: 'CAD' | 'US';
}

export interface MaturityBucket {
  label: string;           // ex: '2026', '2027', '2028-2029', '2030+'
  yearStart: number;
  yearEnd: number;
  bonds: BondHolding[];
  totalFaceValue: number;
  totalMarketValue: number;
  avgCoupon: number;
  avgYield: number;
}

export interface FixedIncomeMetrics {
  totalFaceValue: number;
  totalMarketValue: number;
  weightedAvgCoupon: number;       // coupon moyen pondéré (%)
  weightedAvgYield: number;        // yield moyen pondéré (%)
  weightedAvgMaturityYears: number; // WAM (weighted avg maturity)
  annualCouponIncome: number;       // revenu annuel de coupons ($)
  modifiedDuration: number;         // duration modifiée approximative (années)
  avgSpreadVsGov: number | null;    // spread moyen vs gouvernement (bps)
  maturityLadder: MaturityBucket[];
  ratingDistribution: { rating: string; weight: number }[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function yearsToMaturity(maturityDate: string): number {
  const now = new Date();
  const mat = new Date(maturityDate);
  return Math.max(0, (mat.getTime() - now.getTime()) / (365.25 * 24 * 3600 * 1000));
}

/**
 * Simplified modified duration for a bond.
 * Uses the approximation: D_mod ≈ (T / (1 + y/200)) where T = years to maturity, y = yield.
 * For more precision, use full cashflow-based Macaulay duration.
 */
function approxModifiedDuration(yearsToMat: number, yieldPct: number): number {
  if (yearsToMat <= 0) return 0;
  const y = yieldPct / 100;
  // Macaulay approximation for coupon-paying bond: slightly less than T
  const macaulay = yearsToMat * (1 - 0.03 * yearsToMat / Math.max(yearsToMat, 1));
  return macaulay / (1 + y / 2); // semi-annual compounding
}

// ── Main calculation ────────────────────────────────────────────────────────

/**
 * Calculate comprehensive fixed income metrics for a portfolio's bond holdings.
 *
 * @param bonds - Array of bond holdings
 * @param yieldCurve - Optional Bank of Canada yield curve for spread calculation
 */
export function calculateFixedIncomeMetrics(
  bonds: BondHolding[],
  yieldCurve?: BocYieldPoint[]
): FixedIncomeMetrics {
  if (bonds.length === 0) {
    return {
      totalFaceValue: 0,
      totalMarketValue: 0,
      weightedAvgCoupon: 0,
      weightedAvgYield: 0,
      weightedAvgMaturityYears: 0,
      annualCouponIncome: 0,
      modifiedDuration: 0,
      avgSpreadVsGov: null,
      maturityLadder: [],
      ratingDistribution: [],
    };
  }

  let totalFace = 0;
  let totalMarket = 0;
  let couponSum = 0;
  let yieldSum = 0;
  let matYearsSum = 0;
  let durationSum = 0;
  let spreadSum = 0;
  let spreadCount = 0;
  let totalCouponIncome = 0;

  const ratingMap = new Map<string, number>();
  const yearBuckets = new Map<number, BondHolding[]>();

  for (const bond of bonds) {
    const faceValue = bond.quantity * bond.parValue;
    const marketValue = bond.quantity * bond.parValue * (bond.marketPrice / 100);
    const ytm = yearsToMaturity(bond.maturity);

    totalFace += faceValue;
    totalMarket += marketValue;
    couponSum += bond.coupon * faceValue;
    totalCouponIncome += (bond.coupon / 100) * faceValue;

    // YTM approximation: use coupon as yield proxy if no market yield available
    const bondYield = bond.coupon; // Simple proxy — real YTM would need iterative calc
    yieldSum += bondYield * faceValue;
    matYearsSum += ytm * faceValue;
    durationSum += approxModifiedDuration(ytm, bondYield) * faceValue;

    // Spread vs government
    if (yieldCurve && ytm > 0) {
      const govYield = interpolateYield(yieldCurve, ytm);
      if (govYield !== null) {
        const spreadBps = (bondYield - govYield) * 100;
        spreadSum += spreadBps * faceValue;
        spreadCount += faceValue;
      }
    }

    // Rating distribution
    const rating = bond.rating || 'NR';
    ratingMap.set(rating, (ratingMap.get(rating) || 0) + faceValue);

    // Maturity year bucket
    const matYear = new Date(bond.maturity).getFullYear();
    if (!yearBuckets.has(matYear)) yearBuckets.set(matYear, []);
    yearBuckets.get(matYear)!.push(bond);
  }

  // ── Build maturity ladder ──────────────────────────────────────────────

  const currentYear = new Date().getFullYear();
  const sortedYears = [...yearBuckets.keys()].sort((a, b) => a - b);
  const maturityLadder: MaturityBucket[] = [];

  // Group: individual years for next 5 years, then 5-year buckets
  for (const year of sortedYears) {
    const bucketBonds = yearBuckets.get(year) || [];
    const bucketFace = bucketBonds.reduce((s, b) => s + b.quantity * b.parValue, 0);
    const bucketMarket = bucketBonds.reduce(
      (s, b) => s + b.quantity * b.parValue * (b.marketPrice / 100), 0
    );
    const avgCoup = bucketFace > 0
      ? bucketBonds.reduce((s, b) => s + b.coupon * b.quantity * b.parValue, 0) / bucketFace
      : 0;

    maturityLadder.push({
      label: String(year),
      yearStart: year,
      yearEnd: year,
      bonds: bucketBonds,
      totalFaceValue: Math.round(bucketFace),
      totalMarketValue: Math.round(bucketMarket),
      avgCoupon: Math.round(avgCoup * 100) / 100,
      avgYield: Math.round(avgCoup * 100) / 100, // proxy
    });
  }

  // ── Rating distribution (sorted) ──────────────────────────────────────

  const ratingOrder = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-', 'BB+', 'BB', 'BB-', 'B', 'NR'];
  const ratingDistribution = [...ratingMap.entries()]
    .map(([rating, fv]) => ({
      rating,
      weight: totalFace > 0 ? Math.round((fv / totalFace) * 10000) / 100 : 0,
    }))
    .sort((a, b) => {
      const idxA = ratingOrder.indexOf(a.rating);
      const idxB = ratingOrder.indexOf(b.rating);
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });

  return {
    totalFaceValue: Math.round(totalFace),
    totalMarketValue: Math.round(totalMarket),
    weightedAvgCoupon: totalFace > 0 ? Math.round((couponSum / totalFace) * 100) / 100 : 0,
    weightedAvgYield: totalFace > 0 ? Math.round((yieldSum / totalFace) * 100) / 100 : 0,
    weightedAvgMaturityYears: totalFace > 0
      ? Math.round((matYearsSum / totalFace) * 100) / 100
      : 0,
    annualCouponIncome: Math.round(totalCouponIncome),
    modifiedDuration: totalFace > 0 ? Math.round((durationSum / totalFace) * 100) / 100 : 0,
    avgSpreadVsGov: spreadCount > 0
      ? Math.round((spreadSum / spreadCount) * 10) / 10
      : null,
    maturityLadder,
    ratingDistribution,
  };
}

/**
 * Calculate the estimated price impact for a given yield change.
 * Uses: ΔP ≈ -D_mod × Δy × MarketValue
 */
export function estimateYieldImpact(
  metrics: FixedIncomeMetrics,
  yieldChangeBps: number
): { newValue: number; dollarChange: number; pctChange: number } {
  const dy = yieldChangeBps / 10000;
  const dollarChange = -metrics.modifiedDuration * dy * metrics.totalMarketValue;
  const newValue = metrics.totalMarketValue + dollarChange;
  const pctChange = metrics.totalMarketValue > 0
    ? (dollarChange / metrics.totalMarketValue) * 100
    : 0;

  return {
    newValue: Math.round(newValue),
    dollarChange: Math.round(dollarChange),
    pctChange: Math.round(pctChange * 100) / 100,
  };
}
