/**
 * Croesus Portfolio Data Parser
 *
 * Parses tab-separated data copied from Croesus portfolio management system.
 * Handles equities, fixed income, ETFs, funds, cash/margin positions.
 *
 * Expected Croesus column order (12 columns):
 *   0: Devise             — e.g. CAD, USD (currency the security is traded in)
 *   1: Quantité           — e.g. 58 000 or (131 167,99) for negatives
 *   2: Description        — e.g. FORD CRED CB 2.961%16SP26
 *   3: Type de compte     — A/E/W/S/T/Y/P/F (Comptant/Marge/CELI/REER/FERR/...)
 *   4: Symbole            — e.g. T482B6 (CUSIP), CJ, ENB, 1CAD, AP.UN
 *   5: PRU (coût moyen)   — e.g. 91,672
 *   6: Prix au marché     — e.g. 99,808
 *   7: Valeur comptable   — e.g. 53 169,50
 *   8: Valeur de marché   — e.g. 57 888,64
 *   9: Durée Mod.         — e.g. 0,48 or n/d
 *  10: Intérêts courus    — e.g. 14,00 (accrued interest / dividends)
 *  11: Revenu annuel      — e.g. 1 717,38 (annual coupon or dividend income)
 *
 * Also supports legacy 11-column format (without Devise) for backwards compatibility.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type AssetType = 'EQUITY' | 'FIXED_INCOME' | 'ETF' | 'FUND' | 'CASH' | 'PREFERRED' | 'OTHER';

export interface ParsedHolding {
  symbol: string;
  name: string;
  quantity: number;
  marketPrice: number;
  marketValue: number;
  bookValue: number;
  averageCost: number;
  currency: string;
  assetType: AssetType;
  weight: number;
  accountType: string;       // Raw code: A, E, W, S, T, Y, P, F
  accountLabel: string;      // Human label: Comptant, Marge, CELI, ...
  annualIncome: number;      // Annual dividend or coupon income
  // Fixed income specifics
  couponRate?: number;
  maturityDate?: string;
  yieldToMaturity?: number;
  modifiedDuration?: number;
  accruedInterest?: number;
  // CDR (Canadian Depositary Receipts) — hedged US stocks on NEO
  isCDR?: boolean;
  underlyingSymbol?: string;  // US underlying (e.g. META for META.NE)
  // Metadata
  sector?: string;
  rawRow: string;
}

export interface ParseResult {
  holdings: ParsedHolding[];
  detectedHeaders: string[];
  warnings: string[];
  summary: {
    equities: number;
    fixedIncome: number;
    etfs: number;
    funds: number;
    preferred: number;
    cash: number;
    other: number;
    totalMarketValue: number;
    totalAnnualIncome: number;
    currencies: string[];
    accountTypes: string[];
  };
}

// ─── Account type mapping ────────────────────────────────────────────────────

export const ACCOUNT_TYPE_MAP: Record<string, string> = {
  A: 'Comptant',
  E: 'Marge',
  W: 'CELI',
  S: 'REER',
  T: 'FERR',
  Y: 'FERR conj.',
  P: 'FRV',
  N: 'RERI/CRI',
  F: 'Devise',
};

// ─── Column detection patterns ───────────────────────────────────────────────

interface ColumnMapping {
  symbol: number;
  name: number;
  quantity: number;
  marketPrice: number;
  marketValue: number;
  bookValue: number;
  averageCost: number;
  currency: number;
  assetType: number;
  accountType: number;
  sector: number;
  couponRate: number;
  maturityDate: number;
  yieldToMaturity: number;
  modifiedDuration: number;
  accruedInterest: number;
  annualIncome: number;
  weight: number;
}

const HEADER_PATTERNS: Record<keyof ColumnMapping, RegExp[]> = {
  symbol: [/symb/i, /ticker/i, /code/i, /^sym$/i, /titre/i],
  name: [/desc/i, /nom/i, /name/i, /libell/i, /security/i, /instrument/i],
  quantity: [/qt[eéè]/i, /quant/i, /nb\.?\s*parts/i, /units?/i, /nombre/i, /shares/i, /^qty$/i],
  marketPrice: [/prix\s*(du\s*)?march/i, /market\s*price/i, /cours/i, /^prix$/i, /price/i, /dernier\s*prix/i],
  marketValue: [/val(eur)?\.?\s*(de\s*)?march/i, /market\s*val/i, /val\.?\s*march/i, /mv/i],
  bookValue: [/val(eur)?\.?\s*compt/i, /book\s*val/i, /co[uû]t\s*total/i, /val\.?\s*livre/i, /bv/i],
  averageCost: [/co[uû]t\s*(moy|unit)/i, /avg\.?\s*cost/i, /prix\s*(moy|achat|co[uû]t)/i, /cost\s*per/i, /pru/i, /prix\s*rev/i],
  currency: [/dev/i, /curr/i, /monnaie/i, /^ccy$/i, /devise/i],
  assetType: [/type\s*(d'actif|actif)/i, /cat[eé]g/i, /class/i, /asset/i, /sous.?type/i],
  accountType: [/type\s*(de\s*)?compte/i, /account/i, /acct/i, /r[eé]gime/i],
  sector: [/sect/i, /industry/i, /indust/i, /gics/i],
  couponRate: [/coupon/i, /taux/i, /rate/i],
  maturityDate: [/[eé]ch[eé]ance/i, /matur/i, /expir/i, /date.*fin/i],
  yieldToMaturity: [/rend/i, /yield/i, /ytm/i, /yld/i],
  modifiedDuration: [/dur[eé]e\s*mod/i, /mod\.?\s*dur/i, /duration/i, /dur\.?\s*mod/i],
  accruedInterest: [/int[eé]r[eê]ts?\s*cour/i, /accrued/i, /int\.?\s*cour/i, /int\.\s*cour/i],
  annualIncome: [/revenu/i, /income/i, /dividende/i, /distrib/i, /annual/i],
  weight: [/poids/i, /weight/i, /pond[eé]r/i, /alloc/i, /%\s*port/i, /proportion/i],
};

// ─── Asset type classification ───────────────────────────────────────────────

const FIXED_INCOME_KEYWORDS = [
  /obligat/i, /bond/i, /d[eé]bentur/i, /\bgic\b/i, /\bcpg\b/i,
  /strip/i, /coupon\s*z/i, /z[eé]ro/i, /tr[eé]sor/i, /treasury/i,
  /hypoth/i, /mortgage/i, /\bbill\b/i, /\bnote\b/i, /govt/i, /gouv/i,
  /prov\s/i, /municipal/i,
  /\bcb\b/i,              // "CB" = Convertible Bond or Corporate Bond in Croesus
  /\bics\b/i,             // "ICS" = Infrastructure/Institutional Certificate Series
  /\bred\b/i,             // "RED" = redeemable (corporate bonds)
  /\d+[.,]\d+%\s*\d{2}/i, // pattern like "2.961%16SP26" or "4.5% 15JA30"
  /revenu\s*fixe/i, /fixed\s*income/i,
];

const ETF_KEYWORDS = [
  /\betf\b/i, /\bfnb\b/i, /ishares/i, /vanguard/i, /bmo\s*(mid|etf)/i,
  /horizons/i, /invesco/i, /spdr/i, /proshares/i, /wisdomtree/i,
  /purpose/i, /harvest/i, /global\s*x/i, /ci\s*first/i,
];

// Keywords that ALONE indicate a fund (generic fund terms)
const FUND_KEYWORDS = [
  /fonds/i, /\bfund\b/i, /mutual/i, /commun/i, /s[eé]rie\s/i, /series\s/i,
  /cat[eé]gorie\s/i, /mandat/i,
];

// Fund manager names — only trigger FUND if description ALSO contains a generic fund term
const FUND_MANAGER_NAMES = [
  /mackenzie/i, /manulife/i, /manuvie/i, /desjardins/i,
  /ia\s*clarington/i, /ci\s*invest/i, /fidelity/i, /dynamique/i,
];

const PREFERRED_KEYWORDS = [
  /privil[eé]gi/i, /prefer/i, /\bpref\b/i, /pr\.[a-z]/i,
  /\.pr\./i, /\.pf\./i,
];

const CASH_KEYWORDS = [
  /solde\s*(du\s*)?compte/i,  // "SOLDE DU COMPTE CAD/USD"
  /^1cad$/i, /^1usd$/i,       // Cash symbols in Croesus
  /encaisse/i, /\bcash\b/i, /liquidit/i, /esp[eè]ces/i,
  /money\s*market/i, /march[eé]\s*mon[eé]t/i,
];

// ─── Number parsing ──────────────────────────────────────────────────────────

function parseNumber(value: string): number {
  if (!value) return 0;
  let cleaned = value.trim();
  // Handle n/d, N/D, n/a, N/A, —, -
  if (/^(n\/[da]|—|-)$/i.test(cleaned)) return 0;
  if (cleaned === '') return 0;

  // Handle accounting-style negatives: (131 167,99) → -131167.99
  let isNegative = false;
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    isNegative = true;
    cleaned = cleaned.slice(1, -1);
  } else if (cleaned.startsWith('-')) {
    isNegative = true;
    cleaned = cleaned.slice(1);
  }

  // Remove currency symbols
  cleaned = cleaned.replace(/[$€£¥]/g, '');
  // Remove spaces (thousands separator in French: "53 169,50")
  cleaned = cleaned.replace(/\s/g, '');

  // Handle French number format
  if (cleaned.includes(',') && !cleaned.includes('.')) {
    // "53169,50" → "53169.50"
    cleaned = cleaned.replace(',', '.');
  } else if (cleaned.includes(',') && cleaned.includes('.')) {
    // "1,234.56" — comma is thousands separator
    cleaned = cleaned.replace(/,/g, '');
  }

  // Remove remaining non-numeric chars except . and -
  cleaned = cleaned.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return isNegative ? -num : num;
}

function parsePercentage(value: string): number {
  const cleaned = value.replace('%', '').trim();
  const num = parseNumber(cleaned);
  return Math.abs(num) < 1 ? num * 100 : num;
}

// ─── Row parsing helpers ─────────────────────────────────────────────────────

function splitRow(line: string, separator: string): string[] {
  if (separator === ',') {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === separator && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());
    return fields;
  }
  return line.split(separator).map(f => f.trim());
}

function detectSeparator(lines: string[]): string {
  const sample = lines.slice(0, 5).join('\n');
  const tabCount = (sample.match(/\t/g) || []).length;
  const semiCount = (sample.match(/;/g) || []).length;
  // Only count commas NOT inside parentheses (to avoid matching "(131,99)")
  const commaCount = (sample.match(/,(?=(?:[^"(]*["(][^")]*[")]*)*[^"(]*$)/g) || []).length;

  if (tabCount >= semiCount && tabCount >= commaCount && tabCount > 0) return '\t';
  if (semiCount >= commaCount && semiCount > 0) return ';';
  if (commaCount > 3) return ',';
  return '\t';
}

function isHeaderRow(fields: string[]): boolean {
  // A header row should have mostly text words (not numbers, not single letters, not n/d)
  let headerLikeCount = 0;
  let dataLikeCount = 0;

  for (const f of fields) {
    const trimmed = f.trim();
    if (!trimmed) continue;
    // Data-like: numbers, parenthesized numbers, n/d, single letters (account codes), currency-like
    if (
      /^\(?[\d\s,.\-$€£%]+\)?$/.test(trimmed) || // numbers, possibly with parens
      /^[A-Z]$/i.test(trimmed) ||                  // single letter (account type code)
      /^n\/[da]$/i.test(trimmed) ||                 // n/d or n/a
      /^1[A-Z]{3}$/i.test(trimmed)                  // 1CAD, 1USD
    ) {
      dataLikeCount++;
    } else if (trimmed.length >= 2) {
      headerLikeCount++;
    }
  }

  return headerLikeCount > dataLikeCount && headerLikeCount >= 3;
}

function detectColumns(headerFields: string[]): Partial<ColumnMapping> {
  const mapping: Partial<ColumnMapping> = {};

  headerFields.forEach((field, index) => {
    const clean = field.trim().toLowerCase();
    if (!clean) return;

    for (const [key, patterns] of Object.entries(HEADER_PATTERNS)) {
      if (mapping[key as keyof ColumnMapping] !== undefined) continue;
      for (const pattern of patterns) {
        if (pattern.test(clean)) {
          mapping[key as keyof ColumnMapping] = index;
          break;
        }
      }
    }
  });

  return mapping;
}

// ─── Asset type classification ───────────────────────────────────────────────

function classifyAssetType(symbol: string, name: string, typeField: string, modifiedDuration: number): AssetType {
  const combined = `${symbol} ${name} ${typeField}`;

  // Cash first — SOLDE DU COMPTE, 1CAD, 1USD
  if (CASH_KEYWORDS.some(kw => kw.test(combined))) return 'CASH';

  // If modified duration > 0, it's fixed income
  if (modifiedDuration > 0) return 'FIXED_INCOME';

  // Fixed income keywords
  if (FIXED_INCOME_KEYWORDS.some(kw => kw.test(name))) return 'FIXED_INCOME';

  // Preferred shares
  if (PREFERRED_KEYWORDS.some(kw => kw.test(combined))) return 'PREFERRED';

  // ETFs (before funds, as ETFs can match fund patterns)
  if (ETF_KEYWORDS.some(kw => kw.test(combined))) return 'ETF';

  // Mutual funds — generic fund terms are strong signals
  if (FUND_KEYWORDS.some(kw => kw.test(combined))) return 'FUND';

  // Fund manager names alone are NOT enough (MFC = Manulife the stock, not a fund).
  // Only classify as FUND if the name also contains a generic fund term.
  if (FUND_MANAGER_NAMES.some(kw => kw.test(name))) {
    if (FUND_KEYWORDS.some(kw => kw.test(name))) return 'FUND';
    // Manager name without fund term → likely the stock (MFC, DSG, IAG, etc.)
  }

  // Type field analysis
  const typeLower = typeField.toLowerCase();
  if (typeLower.includes('action') || typeLower.includes('equity') || typeLower.includes('stock')) return 'EQUITY';
  if (typeLower.includes('oblig') || typeLower.includes('bond') || typeLower.includes('fixed') || typeLower.includes('revenu')) return 'FIXED_INCOME';
  if (typeLower.includes('fond') || typeLower.includes('fund')) return 'FUND';
  if (typeLower.includes('etf') || typeLower.includes('fnb')) return 'ETF';

  // Default: if symbol looks like a ticker (1-5 uppercase letters, optional .XX suffix), probably equity
  if (/^[A-Z]{1,5}(\.[A-Z]{1,3})?$/.test(symbol.trim())) return 'EQUITY';

  return 'OTHER';
}

// ─── Bond detail extraction from description ─────────────────────────────────

/**
 * Extract coupon rate and maturity date from a bond description.
 * Croesus formats like:
 *   "FORD CRED CB 2.961%16SP26"     → coupon=2.961, maturity="16SP26" (Sep 2026)
 *   "COAST CAP 7.005%   28SP26"     → coupon=7.005, maturity="28SP26"
 *   "VIDEOTRON RED 4.5% 15JA30"     → coupon=4.5, maturity="15JA30" (Jan 2030)
 *   "LEVIS ICS   4.2%   23AU34"     → coupon=4.2, maturity="23AU34" (Aug 2034)
 *   "SEPT-ILES ICS 4.25% 8SP35"     → coupon=4.25, maturity="8SP35"
 *   "Canada 3,500% 2028-06-01"      → coupon=3.5, maturity="2028-06-01"
 */
function extractBondDetails(description: string): { coupon?: number; maturity?: string } {
  const result: { coupon?: number; maturity?: string } = {};

  // Coupon: "2.961%" or "4,5%" or "3,500%"
  const couponMatch = description.match(/(\d+[.,]\d+)\s*%/);
  if (couponMatch) {
    result.coupon = parseFloat(couponMatch[1].replace(',', '.'));
  }

  // Maturity — Croesus compact format: "16SP26" (DDmmYY), "15JA30", "23AU34", "8SP35"
  const croesusDate = description.match(/\b(\d{1,2})(JA|FE|MR|AL|MA|JN|JL|AU|SP|OC|NO|DE)(\d{2})\b/i);
  if (croesusDate) {
    const monthMap: Record<string, string> = {
      JA: 'jan', FE: 'fév', MR: 'mar', AL: 'avr', MA: 'mai', JN: 'jun',
      JL: 'jul', AU: 'aoû', SP: 'sep', OC: 'oct', NO: 'nov', DE: 'déc',
    };
    const day = croesusDate[1];
    const monthCode = croesusDate[2].toUpperCase();
    const year = parseInt(croesusDate[3]) + 2000;
    result.maturity = `${day} ${monthMap[monthCode] || monthCode} ${year}`;
  } else {
    // ISO date: 2028-06-01
    const isoDate = description.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    if (isoDate) {
      result.maturity = isoDate[1];
    } else {
      // Just a year
      const yearOnly = description.match(/\b(20[2-9]\d)\b/);
      if (yearOnly) result.maturity = yearOnly[1];
    }
  }

  return result;
}

// ─── Symbol normalization ────────────────────────────────────────────────────

function normalizeSymbol(symbol: string, name: string, assetType: AssetType, currency: string): string {
  // Don't touch cash symbols
  if (assetType === 'CASH') return symbol;

  // Don't touch bond CUSIP-like symbols (alphanumeric codes like T482B6, R37092, Q445C1)
  if (assetType === 'FIXED_INCOME' && /^[A-Z]\d{2,}[A-Z0-9]*$/i.test(symbol.trim())) {
    return symbol.trim().toUpperCase();
  }

  let s = symbol.trim().toUpperCase();
  const isCAD = /^(CAD|CA|CAN)$/i.test(currency.trim());

  // Remove common exchange prefixes
  s = s.replace(/^(TSE:|TSX:|TOR:|CVE:|NEO:|XTSE:|XTOR:)/i, '');
  s = s.replace(/^(NYSE:|NYSEARCA:|NASDAQ:|NMS:|XNYS:|XNAS:)/i, '');
  s = s.replace(/^(US\.|CA\.)/i, '');

  // Already has an exchange suffix → done
  if (/\.(TO|V|CN|NE)$/.test(s)) return s;

  // Handle .UN (REIT trust units): AP.UN → AP-UN.TO (CAD only)
  if (s.match(/\.UN$/)) {
    s = s.replace('.UN', '-UN');
    return isCAD ? `${s}.TO` : s;
  }

  // Preferred shares: BNS.PR.I → BNS-PI.TO (CAD only)
  if (s.match(/\.PR\.[A-Z]$/)) {
    s = s.replace(/\.PR\.([A-Z])$/, '-P$1');
    return isCAD ? `${s}.TO` : s;
  }

  // Class shares: GIB.A → GIB-A (Yahoo format with dash)
  if (s.match(/\.[A-Z]{1,2}$/)) {
    s = s.replace(/\.([A-Z]{1,2})$/, '-$1');
  }

  // CDR C$HDG stocks trade on NEO (.NE), not TSX — don't add .TO
  if (/C\$H(DG|ED)|CDR\$?H|CDR/i.test(name)) {
    return s;
  }

  // Use currency to determine exchange suffix:
  // CAD → Toronto Stock Exchange (.TO)
  // USD → US exchange (no suffix, NEVER .TO)
  if (isCAD && /^[A-Z]{1,6}(-[A-Z]{1,2})?$/.test(s)) {
    return `${s}.TO`;
  }

  return s;
}

// ─── Skip detection ──────────────────────────────────────────────────────────

function isSkippableLine(line: string): boolean {
  const trimmed = line.trim().toLowerCase();
  if (!trimmed) return true;
  // Skip total/subtotal lines (but only if the line starts with those words)
  if (/^(total|sous.?total|sub.?total|grand\s*total|s\/total)/i.test(trimmed)) return true;
  // Skip separator lines
  if (/^[-=_\s]+$/.test(trimmed)) return true;
  // Skip page headers (but NOT "SOLDE" — those are cash positions)
  if (/^(page\s*\d|imprim|print)/i.test(trimmed)) return true;
  return false;
}

// ─── Main parse function ─────────────────────────────────────────────────────

export function parseCroesusData(rawText: string): ParseResult {
  const warnings: string[] = [];
  const holdings: ParsedHolding[] = [];

  // Normalize line endings
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const allLines = text.split('\n').filter(l => l.trim() !== '');

  if (allLines.length === 0) {
    return {
      holdings: [],
      detectedHeaders: [],
      warnings: ['Aucune donnée détectée. Copiez les positions depuis Croesus et collez-les ici.'],
      summary: { equities: 0, fixedIncome: 0, etfs: 0, funds: 0, preferred: 0, cash: 0, other: 0, totalMarketValue: 0, totalAnnualIncome: 0, currencies: [], accountTypes: [] },
    };
  }

  const separator = detectSeparator(allLines);
  let columnMapping: Partial<ColumnMapping> = {};
  let dataStartIndex = 0;
  let detectedHeaders: string[] = [];

  // Try to detect header row
  const firstFields = splitRow(allLines[0], separator);
  if (isHeaderRow(firstFields)) {
    columnMapping = detectColumns(firstFields);
    detectedHeaders = firstFields.map(f => f.trim()).filter(Boolean);
    dataStartIndex = 1;

    // Check if second row is also a header (multi-line headers)
    if (allLines.length > 1) {
      const secondFields = splitRow(allLines[1], separator);
      if (isHeaderRow(secondFields)) {
        dataStartIndex = 2;
      }
    }
  } else {
    // No headers detected — check if first column is a currency code (new 12-column format)
    const firstVal = firstFields[0]?.trim();
    const hasCurrencyCol = /^(CAD|USD|EUR|GBP|JPY|CHF|AUD|CA|US)$/i.test(firstVal);

    if (hasCurrencyCol && firstFields.length >= 9) {
      // New format with Devise column at position 0 (12 columns)
      columnMapping = {
        currency: 0,
        quantity: 1,
        name: 2,
        accountType: 3,
        symbol: 4,
        averageCost: 5,
        marketPrice: 6,
        bookValue: 7,
        marketValue: 8,
      };
      if (firstFields.length >= 10) columnMapping.modifiedDuration = 9;
      if (firstFields.length >= 11) columnMapping.accruedInterest = 10;
      if (firstFields.length >= 12) columnMapping.annualIncome = 11;
    } else if (firstFields.length >= 8) {
      // Legacy format without Devise column (11 columns)
      columnMapping = {
        quantity: 0,
        name: 1,
        accountType: 2,
        symbol: 3,
        averageCost: 4,
        marketPrice: 5,
        bookValue: 6,
        marketValue: 7,
      };
      if (firstFields.length >= 9) columnMapping.modifiedDuration = 8;
      if (firstFields.length >= 10) columnMapping.accruedInterest = 9;
      if (firstFields.length >= 11) columnMapping.annualIncome = 10;
    } else if (firstFields.length >= 6) {
      columnMapping = {
        quantity: 0,
        name: 1,
        accountType: 2,
        symbol: 3,
        marketPrice: 4,
        marketValue: 5,
      };
    } else if (firstFields.length >= 4) {
      columnMapping = {
        quantity: 0,
        name: 1,
        symbol: 2,
        marketPrice: 3,
      };
      if (firstFields.length >= 5) columnMapping.marketValue = 4;
    }
  }

  // Validate we have a symbol column
  if (columnMapping.symbol === undefined) {
    // Last resort: find the column that looks most like symbols
    const sample = allLines.slice(dataStartIndex, Math.min(dataStartIndex + 10, allLines.length));
    for (let col = 0; col < 15; col++) {
      const values = sample.map(l => splitRow(l, separator)[col] || '').filter(Boolean);
      if (values.length === 0) continue;
      const symbolLike = values.filter(v => /^[A-Z0-9]{1,8}(\.[A-Z]{1,3})?$/i.test(v.trim()));
      if (symbolLike.length >= values.length * 0.4 && symbolLike.length >= 2) {
        columnMapping.symbol = col;
        break;
      }
    }
  }

  if (columnMapping.symbol === undefined) {
    return {
      holdings: [],
      detectedHeaders,
      warnings: ['Impossible de détecter la colonne des symboles. Vérifiez le format des données.'],
      summary: { equities: 0, fixedIncome: 0, etfs: 0, funds: 0, preferred: 0, cash: 0, other: 0, totalMarketValue: 0, totalAnnualIncome: 0, currencies: [], accountTypes: [] },
    };
  }

  // Parse data rows
  const accountTypesSet = new Set<string>();

  for (let i = dataStartIndex; i < allLines.length; i++) {
    const line = allLines[i];
    if (isSkippableLine(line)) continue;

    const fields = splitRow(line, separator);

    const getField = (key: keyof ColumnMapping): string => {
      const idx = columnMapping[key];
      return idx !== undefined && idx < fields.length ? fields[idx].trim() : '';
    };

    const rawSymbol = getField('symbol');
    if (!rawSymbol || rawSymbol.length > 30) continue;

    const name = getField('name') || rawSymbol;
    const typeField = getField('assetType');
    const accountCode = getField('accountType').toUpperCase();
    const rawCurrency = getField('currency').toUpperCase() || 'CAD';

    // Parse modified duration early — helps classify fixed income
    const modDurStr = getField('modifiedDuration');
    const modifiedDuration = (modDurStr && !/^n\/[da]$/i.test(modDurStr.trim())) ? parseNumber(modDurStr) : 0;

    // Classify asset type
    const assetType = classifyAssetType(rawSymbol, name, typeField, modifiedDuration);

    // Normalize symbol — currency determines exchange suffix (.TO for CAD, none for USD)
    const symbol = normalizeSymbol(rawSymbol, name, assetType, rawCurrency);

    // Parse numbers
    const quantity = parseNumber(getField('quantity'));
    const averageCost = parseNumber(getField('averageCost'));
    const marketPrice = parseNumber(getField('marketPrice'));
    const bookValue = parseNumber(getField('bookValue'));
    const marketValue = parseNumber(getField('marketValue')) || (quantity * marketPrice);
    const annualIncome = parseNumber(getField('annualIncome'));

    // Accrued interest / dividends
    const accruedStr = getField('accruedInterest');
    const accruedInterest = (accruedStr && !/^n\/[da]$/i.test(accruedStr.trim())) ? parseNumber(accruedStr) : 0;

    // Account type
    const accountLabel = ACCOUNT_TYPE_MAP[accountCode] || accountCode;
    if (accountCode) accountTypesSet.add(accountCode);

    const holding: ParsedHolding = {
      symbol,
      name,
      quantity,
      marketPrice,
      marketValue,
      bookValue,
      averageCost: averageCost || (quantity !== 0 ? bookValue / quantity : 0),
      currency: /^(CAD|CA|CAN)$/i.test(rawCurrency) ? 'CAD' : (rawCurrency || 'CAD'),
      assetType,
      weight: 0,
      accountType: accountCode,
      accountLabel,
      annualIncome,
      rawRow: line,
    };

    // Fixed income specifics
    if (modifiedDuration > 0) holding.modifiedDuration = modifiedDuration;
    if (accruedInterest !== 0) holding.accruedInterest = accruedInterest;

    const couponStr = getField('couponRate');
    if (couponStr) holding.couponRate = parsePercentage(couponStr);

    const maturityStr = getField('maturityDate');
    if (maturityStr) holding.maturityDate = maturityStr;

    const yieldStr = getField('yieldToMaturity');
    if (yieldStr) holding.yieldToMaturity = parsePercentage(yieldStr);

    // Auto-extract coupon & maturity from description for fixed income
    if (assetType === 'FIXED_INCOME' && (!holding.couponRate || !holding.maturityDate)) {
      const bondDetails = extractBondDetails(name);
      if (bondDetails.coupon && !holding.couponRate) holding.couponRate = bondDetails.coupon;
      if (bondDetails.maturity && !holding.maturityDate) holding.maturityDate = bondDetails.maturity;
    }

    // CDR detection — Canadian Depositary Receipts (hedged US stocks on NEO)
    if (/C\$H(DG|ED)|CDR\$?H|CDR/i.test(name)) {
      holding.isCDR = true;
      // The symbol in Croesus is the base US ticker (META, AMZN, GOOGL, etc.)
      // Strip exchange suffix (.NE) and class share suffix (-A from V-A → V for Visa)
      const baseSymbol = symbol.replace(/\.(NE|NEO)$/i, '').replace(/-[A-Z]{1,2}$/, '');
      holding.underlyingSymbol = baseSymbol;
    }

    holdings.push(holding);
  }

  // Compute weights
  const totalPositiveValue = holdings.reduce((sum, h) => sum + Math.max(0, h.marketValue), 0);
  if (totalPositiveValue > 0) {
    holdings.forEach(h => {
      h.weight = (h.marketValue / totalPositiveValue) * 100;
    });
  }

  // Build summary
  const summary = {
    equities: holdings.filter(h => h.assetType === 'EQUITY').length,
    fixedIncome: holdings.filter(h => h.assetType === 'FIXED_INCOME').length,
    etfs: holdings.filter(h => h.assetType === 'ETF').length,
    funds: holdings.filter(h => h.assetType === 'FUND').length,
    preferred: holdings.filter(h => h.assetType === 'PREFERRED').length,
    cash: holdings.filter(h => h.assetType === 'CASH').length,
    other: holdings.filter(h => h.assetType === 'OTHER').length,
    totalMarketValue: holdings.reduce((sum, h) => sum + h.marketValue, 0),
    totalAnnualIncome: holdings.reduce((sum, h) => sum + h.annualIncome, 0),
    currencies: [...new Set(holdings.map(h => h.currency))],
    accountTypes: Array.from(accountTypesSet),
  };

  if (holdings.length === 0) {
    warnings.push('Aucune position valide détectée. Vérifiez le format des données.');
  }

  return { holdings, detectedHeaders, warnings, summary };
}

// ─── Asset type labels & colors ──────────────────────────────────────────────

export const ASSET_TYPE_CONFIG: Record<AssetType, { label: string; color: string; bg: string }> = {
  EQUITY: { label: 'Action', color: 'text-blue-700', bg: 'bg-blue-50' },
  FIXED_INCOME: { label: 'Revenu fixe', color: 'text-amber-700', bg: 'bg-amber-50' },
  ETF: { label: 'FNB', color: 'text-purple-700', bg: 'bg-purple-50' },
  FUND: { label: 'Fonds', color: 'text-teal-700', bg: 'bg-teal-50' },
  PREFERRED: { label: 'Privilégiée', color: 'text-indigo-700', bg: 'bg-indigo-50' },
  CASH: { label: 'Liquidité', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  OTHER: { label: 'Autre', color: 'text-gray-700', bg: 'bg-gray-100' },
};
