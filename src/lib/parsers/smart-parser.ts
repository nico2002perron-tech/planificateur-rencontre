/**
 * Smart Portfolio Parser
 *
 * Flexible parser for portfolio data from ANY source (Excel, CSV, broker statements, etc.).
 * Uses the existing croesus-parser infrastructure (header detection, column mapping)
 * and adds fallback logic for simpler formats (symbol lists, two-column layouts).
 *
 * Flow:
 *   1. Try croesus-parser (handles most tabular data with headers)
 *   2. If 0 holdings → try simple format detection (symbol-only, symbol+qty)
 *   3. If still 0 → return empty result (caller can try AI parsing)
 */

import { parseCroesusData, type ParseResult, type ParsedHolding, type AssetType } from './croesus-parser';

// Re-export types for convenience
export type { ParseResult, ParsedHolding, AssetType };

// ─── Simple symbol detection ────────────────────────────────────────────────

const TICKER_REGEX = /^[A-Z]{1,6}(-[A-Z]{1,2})?(\.(TO|V|CN|NE|UN))?$/i;

function isTickerLike(s: string): boolean {
  const trimmed = s.trim().toUpperCase();
  if (!trimmed || trimmed.length > 12) return false;
  return TICKER_REGEX.test(trimmed);
}

function normalizeTickerSimple(symbol: string): string {
  let s = symbol.trim().toUpperCase();
  // Remove common exchange prefixes
  s = s.replace(/^(TSE:|TSX:|TOR:|CVE:|NEO:|NYSE:|NASDAQ:|NYSEARCA:)/i, '');
  return s;
}

// ─── Simple format parsers ──────────────────────────────────────────────────

/**
 * Parse a simple list of symbols (one per line), optionally with quantity.
 * Supports:
 *   AAPL
 *   AAPL 100
 *   AAPL, 100
 *   AAPL  100  50.25   (symbol, qty, cost)
 */
function parseSimpleList(rawText: string): ParseResult | null {
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length === 0) return null;

  // Check if most lines start with something ticker-like
  const firstTokens = lines.map(l => {
    const parts = l.split(/[\t,;|\s]+/);
    return parts[0]?.trim() || '';
  });

  const tickerCount = firstTokens.filter(t => isTickerLike(t)).length;
  if (tickerCount < lines.length * 0.5 || tickerCount < 2) return null;

  const holdings: ParsedHolding[] = [];
  const warnings: string[] = [];

  for (const line of lines) {
    const parts = line.split(/[\t,;|\s]+/).map(p => p.trim()).filter(Boolean);
    if (parts.length === 0) continue;

    const rawSymbol = parts[0];
    if (!isTickerLike(rawSymbol)) {
      warnings.push(`Ignoré: "${line}" (symbole non reconnu)`);
      continue;
    }

    const symbol = normalizeTickerSimple(rawSymbol);
    const quantity = parts.length >= 2 ? parseFloat(parts[1].replace(/[,\s]/g, '').replace(',', '.')) || 0 : 0;
    const cost = parts.length >= 3 ? parseFloat(parts[2].replace(/[,\s]/g, '').replace(',', '.')) || 0 : 0;

    holdings.push({
      symbol,
      name: symbol,
      quantity,
      marketPrice: cost || 0,
      marketValue: quantity * cost,
      bookValue: quantity * cost,
      averageCost: cost,
      currency: 'CAD',
      assetType: 'EQUITY',
      weight: 0,
      accountType: '',
      accountLabel: '',
      annualIncome: 0,
      rawRow: line,
    });
  }

  if (holdings.length === 0) return null;

  // Compute weights
  const totalValue = holdings.reduce((s, h) => s + Math.max(0, h.marketValue), 0);
  if (totalValue > 0) {
    holdings.forEach(h => { h.weight = (h.marketValue / totalValue) * 100; });
  }

  return {
    holdings,
    detectedHeaders: [],
    warnings,
    summary: {
      equities: holdings.filter(h => h.assetType === 'EQUITY').length,
      fixedIncome: 0,
      etfs: 0,
      funds: 0,
      preferred: 0,
      cash: 0,
      other: 0,
      totalMarketValue: holdings.reduce((s, h) => s + h.marketValue, 0),
      totalAnnualIncome: 0,
      currencies: [...new Set(holdings.map(h => h.currency))],
      accountTypes: [],
    },
  };
}

// ─── Main smart parse function ──────────────────────────────────────────────

/**
 * Parse portfolio data from any textual source.
 * Returns { result, needsAI } — if needsAI is true, the caller should
 * try the AI parse-portfolio endpoint as a fallback.
 */
export function parseSmartData(rawText: string): { result: ParseResult; needsAI: boolean } {
  // Step 1: Try the full croesus-parser (handles most tabular data)
  const croesusResult = parseCroesusData(rawText);
  if (croesusResult.holdings.length > 0) {
    return { result: croesusResult, needsAI: false };
  }

  // Step 2: Try simple symbol list
  const simpleResult = parseSimpleList(rawText);
  if (simpleResult && simpleResult.holdings.length > 0) {
    return { result: simpleResult, needsAI: false };
  }

  // Step 3: Data exists but we can't parse it — suggest AI
  const hasContent = rawText.trim().split('\n').filter(l => l.trim()).length >= 2;
  return {
    result: {
      holdings: [],
      detectedHeaders: [],
      warnings: hasContent
        ? ['Format non reconnu. Analyse IA en cours...']
        : ['Aucune donnée détectée. Collez les positions ou ajoutez-les manuellement.'],
      summary: {
        equities: 0, fixedIncome: 0, etfs: 0, funds: 0, preferred: 0, cash: 0, other: 0,
        totalMarketValue: 0, totalAnnualIncome: 0, currencies: [], accountTypes: [],
      },
    },
    needsAI: hasContent,
  };
}

// ─── Build ParseResult from AI-parsed data ─────────────────────────────────

export interface AIHolding {
  symbol: string;
  name?: string;
  quantity?: number;
  marketPrice?: number;
  bookValue?: number;
  averageCost?: number;
  currency?: string;
  assetType?: AssetType;
  accountType?: string;
}

export function buildParseResultFromAI(aiHoldings: AIHolding[]): ParseResult {
  const holdings: ParsedHolding[] = aiHoldings.map(h => {
    const quantity = h.quantity || 0;
    const marketPrice = h.marketPrice || 0;
    const marketValue = quantity * marketPrice;
    const averageCost = h.averageCost || 0;
    const bookValue = h.bookValue || (quantity * averageCost);

    return {
      symbol: (h.symbol || '').toUpperCase().trim(),
      name: h.name || h.symbol || '',
      quantity,
      marketPrice,
      marketValue,
      bookValue,
      averageCost,
      currency: h.currency || 'CAD',
      assetType: h.assetType || 'EQUITY',
      weight: 0,
      accountType: h.accountType || '',
      accountLabel: h.accountType || '',
      annualIncome: 0,
      rawRow: '',
    };
  }).filter(h => h.symbol.length > 0);

  // Compute weights
  const totalValue = holdings.reduce((s, h) => s + Math.max(0, h.marketValue), 0);
  if (totalValue > 0) {
    holdings.forEach(h => { h.weight = (h.marketValue / totalValue) * 100; });
  }

  return {
    holdings,
    detectedHeaders: [],
    warnings: [],
    summary: {
      equities: holdings.filter(h => h.assetType === 'EQUITY').length,
      fixedIncome: holdings.filter(h => h.assetType === 'FIXED_INCOME').length,
      etfs: holdings.filter(h => h.assetType === 'ETF').length,
      funds: holdings.filter(h => h.assetType === 'FUND').length,
      preferred: holdings.filter(h => h.assetType === 'PREFERRED').length,
      cash: holdings.filter(h => h.assetType === 'CASH').length,
      other: holdings.filter(h => h.assetType === 'OTHER').length,
      totalMarketValue: holdings.reduce((s, h) => s + h.marketValue, 0),
      totalAnnualIncome: 0,
      currencies: [...new Set(holdings.map(h => h.currency))],
      accountTypes: [...new Set(holdings.map(h => h.accountType).filter(Boolean))],
    },
  };
}

// ─── Manual holding builder ─────────────────────────────────────────────────

export function createManualHolding(
  symbol: string,
  name: string,
  quantity: number,
  cost: number,
  currency: string = 'CAD',
): ParsedHolding {
  return {
    symbol: symbol.toUpperCase().trim(),
    name: name || symbol,
    quantity,
    marketPrice: cost,
    marketValue: quantity * cost,
    bookValue: quantity * cost,
    averageCost: cost,
    currency,
    assetType: 'EQUITY',
    weight: 0,
    accountType: '',
    accountLabel: '',
    annualIncome: 0,
    rawRow: '',
  };
}

export function mergeHoldingsIntoResult(
  existing: ParseResult,
  additionalHoldings: ParsedHolding[],
): ParseResult {
  const all = [...existing.holdings, ...additionalHoldings];
  const totalValue = all.reduce((s, h) => s + Math.max(0, h.marketValue), 0);
  if (totalValue > 0) {
    all.forEach(h => { h.weight = (h.marketValue / totalValue) * 100; });
  }

  return {
    ...existing,
    holdings: all,
    summary: {
      equities: all.filter(h => h.assetType === 'EQUITY').length,
      fixedIncome: all.filter(h => h.assetType === 'FIXED_INCOME').length,
      etfs: all.filter(h => h.assetType === 'ETF').length,
      funds: all.filter(h => h.assetType === 'FUND').length,
      preferred: all.filter(h => h.assetType === 'PREFERRED').length,
      cash: all.filter(h => h.assetType === 'CASH').length,
      other: all.filter(h => h.assetType === 'OTHER').length,
      totalMarketValue: all.reduce((s, h) => s + h.marketValue, 0),
      totalAnnualIncome: all.reduce((s, h) => s + h.annualIncome, 0),
      currencies: [...new Set(all.map(h => h.currency))],
      accountTypes: [...new Set(all.map(h => h.accountType).filter(Boolean))],
    },
  };
}
