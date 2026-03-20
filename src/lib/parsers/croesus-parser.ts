/**
 * Croesus Portfolio Data Parser
 *
 * Parses tab-separated (or CSV) data copied from Croesus portfolio management system.
 * Handles equities, fixed income, ETFs, funds, and cash positions.
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
  // Fixed income specifics
  couponRate?: number;
  maturityDate?: string;
  yieldToMaturity?: number;
  modifiedDuration?: number;
  accruedInterest?: number;
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
    currencies: string[];
  };
}

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
  sector: number;
  couponRate: number;
  maturityDate: number;
  yieldToMaturity: number;
  modifiedDuration: number;
  accruedInterest: number;
  weight: number;
}

const HEADER_PATTERNS: Record<keyof ColumnMapping, RegExp[]> = {
  symbol: [/symb/i, /ticker/i, /code/i, /^sym$/i, /titre/i],
  name: [/desc/i, /nom/i, /name/i, /libell/i, /security/i, /instrument/i],
  quantity: [/qt[eéè]/i, /quant/i, /nb\.?\s*parts/i, /units?/i, /nombre/i, /shares/i, /^qty$/i],
  marketPrice: [/prix\s*(du\s*)?march/i, /market\s*price/i, /cours/i, /^prix$/i, /price/i, /dernier\s*prix/i],
  marketValue: [/val(eur)?\.?\s*march/i, /market\s*val/i, /val\.?\s*march/i, /mv/i, /montant/i],
  bookValue: [/val(eur)?\.?\s*compt/i, /book\s*val/i, /co[uû]t\s*total/i, /val\.?\s*livre/i, /bv/i],
  averageCost: [/co[uû]t\s*(moy|unit)/i, /avg\.?\s*cost/i, /prix\s*(moy|achat|co[uû]t)/i, /cost\s*per/i, /pru/i],
  currency: [/dev/i, /curr/i, /monnaie/i, /^ccy$/i, /devise/i],
  assetType: [/type/i, /cat[eé]g/i, /class/i, /asset/i, /sous.?type/i],
  sector: [/sect/i, /industry/i, /indust/i, /gics/i],
  couponRate: [/coupon/i, /taux/i, /rate/i],
  maturityDate: [/[eé]ch[eé]ance/i, /matur/i, /expir/i, /date.*fin/i],
  yieldToMaturity: [/rend/i, /yield/i, /ytm/i, /yld/i],
  modifiedDuration: [/dur[eé]e\s*mod/i, /mod\.?\s*dur/i, /duration/i, /dur\.?\s*mod/i],
  accruedInterest: [/int[eé]r[eê]ts?\s*cour/i, /accrued/i, /int\.?\s*cour/i, /dividende/i, /int\.\s*courus/i],
  weight: [/poids/i, /weight/i, /pond[eé]r/i, /alloc/i, /%\s*port/i, /proportion/i],
};

// ─── Asset type classification ───────────────────────────────────────────────

const FIXED_INCOME_KEYWORDS = [
  /obligat/i, /bond/i, /d[eé]bentur/i, /gic/i, /cpg/i,
  /strip/i, /coupon\s*z/i, /z[eé]ro/i, /tr[eé]sor/i, /treasury/i,
  /hypoth/i, /mortgage/i, /bill/i, /note\b/i, /govt/i, /gouv/i,
  /canada\s*\d/i, /prov\s/i, /municipal/i, /corp\s*\d/i,
  /\d+[\.,]\d+%?\s*\d{4}/i,  // pattern like "3.5% 2027" or "3,5 2027"
  /revenu\s*fixe/i, /fixed\s*income/i, /income\s*fund/i,
];

const ETF_KEYWORDS = [
  /\betf\b/i, /\bfnb\b/i, /ishares/i, /vanguard/i, /bmo\s*etf/i,
  /horizons/i, /invesco/i, /spdr/i, /proshares/i, /wisdomtree/i,
];

const FUND_KEYWORDS = [
  /fonds/i, /fund/i, /mutual/i, /commun/i, /s[eé]rie/i, /series/i,
  /class[e]?\s*[a-f]/i, /cat[eé]gorie/i, /portefeuille\s/i,
  /mandat/i, /strat[eé]g/i, /dynamique/i, /fiera/i, /mackenzie/i,
  /manulife/i, /manuvie/i, /desjardins/i, /ia\s*clarington/i,
  /ci\s*invest/i, /rbc\s*\w+\s*fund/i, /td\s*\w+\s*fund/i,
];

const PREFERRED_KEYWORDS = [
  /privil[eé]gi/i, /prefer/i, /\bpref\b/i, /pr\.[a-z]/i,
  /\.pr\./i, /\.pf\./i,
];

const CASH_KEYWORDS = [
  /encaisse/i, /cash/i, /liquidit/i, /esp[eè]ces/i, /money\s*market/i,
  /march[eé]\s*mon[eé]t/i, /\bcad\b.*\bcash\b/i, /\busd\b.*\bcash\b/i,
  /compte\s/i, /d[eé]p[oô]t/i,
];

const TSX_SUFFIXES_NEEDED = [
  // Well-known Canadian stocks that need .TO
  /^(RY|TD|BNS|BMO|CM|SLF|MFC|GWO|IAG|POW|FFH|CNR|CNQ|CP|TRP|ENB|SU|CVE|IMO|HSE|ABX|K|AEM|FNV|WPM|SHOP|CSU|OTEX|BB|L|ATD|DOL|MRU|SAP|EMP|WN|GIL|CCL|MG|QSR|TFI|WSP|SNC|STN|BAM|BN|BIP|BEP|BEPC|BIPC|FTS|EMA|AQN|NPI|RNW|INE|SPB|IPL|KEY|PPL|GEI|ARX|WCP|ERF|BTE|VET|TVE|MEG|POU|AAV|NVA|CR|TOU|PSK|SGY|CEU|CPG|FRU|PEY|PXT|SES|PNE|WHC|BIR|CJ|KEL|WTE|HWO|ESI|PD|SVM|FR|ELD|EDV|MAG|AG|SSL|CG|GMIN|NGT|LUG|DPM|OGC|TXG|KNT|ARTG|BTO|OR|EQX|LUN|HBM|FM|CS|IVN|ERO|TECK|CCO|NXE|FCX|DML|URC|FIND|EFR|LAC|LAM|LGD|SKE|CGL|GLXY)$/i,
];

// ─── Parser ──────────────────────────────────────────────────────────────────

function detectSeparator(lines: string[]): string {
  // Try first few lines to detect separator
  const sample = lines.slice(0, 5).join('\n');
  const tabCount = (sample.match(/\t/g) || []).length;
  const semiCount = (sample.match(/;/g) || []).length;
  const commaCount = (sample.match(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/g) || []).length;

  if (tabCount >= semiCount && tabCount >= commaCount && tabCount > 0) return '\t';
  if (semiCount >= commaCount && semiCount > 0) return ';';
  if (commaCount > 0) return ',';
  return '\t'; // default
}

function parseNumber(value: string): number {
  if (!value || value.trim() === '' || value.trim() === '—' || value.trim() === '-') return 0;
  let cleaned = value.trim();
  // Remove currency symbols and spaces
  cleaned = cleaned.replace(/[$€£¥]/g, '').replace(/\s/g, '');
  // Handle French number format: 1 234,56 → 1234.56
  // If comma is used as decimal separator (and period as thousands)
  if (cleaned.includes(',') && !cleaned.includes('.')) {
    // "1234,56" → "1234.56"
    cleaned = cleaned.replace(',', '.');
  } else if (cleaned.includes(',') && cleaned.includes('.')) {
    // "1,234.56" - comma is thousands separator
    cleaned = cleaned.replace(/,/g, '');
  }
  // Remove remaining non-numeric chars except . and -
  cleaned = cleaned.replace(/[^0-9.\-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parsePercentage(value: string): number {
  const cleaned = value.replace('%', '').trim();
  const num = parseNumber(cleaned);
  // If value was like "5.25%" return 5.25, if "0.0525" return 5.25
  return Math.abs(num) < 1 ? num * 100 : num;
}

function splitRow(line: string, separator: string): string[] {
  if (separator === ',') {
    // Handle quoted CSV fields
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

function isHeaderRow(fields: string[]): boolean {
  // A header row should have mostly text, not numbers
  let textCount = 0;
  let numberCount = 0;
  for (const f of fields) {
    const trimmed = f.trim();
    if (!trimmed) continue;
    if (/^-?[\d\s,.$€£%]+$/.test(trimmed)) {
      numberCount++;
    } else {
      textCount++;
    }
  }
  return textCount > numberCount && textCount >= 2;
}

function classifyAssetType(symbol: string, name: string, typeField: string): AssetType {
  const combined = `${symbol} ${name} ${typeField}`;

  // Cash first (most specific)
  if (CASH_KEYWORDS.some(kw => kw.test(combined))) return 'CASH';

  // Fixed income
  if (FIXED_INCOME_KEYWORDS.some(kw => kw.test(combined))) return 'FIXED_INCOME';

  // Preferred shares
  if (PREFERRED_KEYWORDS.some(kw => kw.test(combined))) return 'PREFERRED';

  // ETFs (before funds, as ETFs can match fund patterns)
  if (ETF_KEYWORDS.some(kw => kw.test(combined))) return 'ETF';

  // Mutual funds
  if (FUND_KEYWORDS.some(kw => kw.test(combined))) return 'FUND';

  // Type field analysis
  const typeLower = typeField.toLowerCase();
  if (typeLower.includes('action') || typeLower.includes('equity') || typeLower.includes('stock')) return 'EQUITY';
  if (typeLower.includes('oblig') || typeLower.includes('bond') || typeLower.includes('fixed') || typeLower.includes('revenu')) return 'FIXED_INCOME';
  if (typeLower.includes('fond') || typeLower.includes('fund')) return 'FUND';
  if (typeLower.includes('etf') || typeLower.includes('fnb')) return 'ETF';

  // Default: if has a clean symbol pattern, probably equity
  if (/^[A-Z]{1,5}(\.[A-Z]{1,2})?$/.test(symbol.trim())) return 'EQUITY';

  return 'OTHER';
}

/**
 * Extract coupon rate and maturity date from a bond description.
 * Examples:
 *   "Canada 3,500% 2028-06-01"  → { coupon: 3.5, maturity: "2028-06-01" }
 *   "Ontario 4.65 15jun2027"    → { coupon: 4.65, maturity: "15jun2027" }
 *   "CIBC 5,25% 2026-03-15"    → { coupon: 5.25, maturity: "2026-03-15" }
 *   "TD 3.75 01-Dec-2029"      → { coupon: 3.75, maturity: "01-Dec-2029" }
 */
function extractBondDetails(description: string): { coupon?: number; maturity?: string } {
  const result: { coupon?: number; maturity?: string } = {};

  // Try to find coupon rate: "3,500%" or "3.5%" or standalone decimal like "4.65"
  const couponMatch = description.match(/(\d+[.,]\d+)\s*%/) ||
    description.match(/\b(\d+[.,]\d{1,3})\b(?=\s+\d{2,4}[\s\-])/);
  if (couponMatch) {
    result.coupon = parseFloat(couponMatch[1].replace(',', '.'));
  }

  // Try to find maturity date in various formats
  // YYYY-MM-DD
  const isoDate = description.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoDate) {
    result.maturity = isoDate[1];
  } else {
    // DD-Mon-YYYY or DDmonYYYY
    const altDate = description.match(/\b(\d{1,2}[\s\-]?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|janv?|f[eé]vr?|mars?|avr|mai|juin|juil|ao[uû]t|sept?|oct|nov|d[eé]c)[a-z]*[\s\-]?\d{4})\b/i);
    if (altDate) {
      result.maturity = altDate[1];
    } else {
      // Just a year like "2028" at the end
      const yearOnly = description.match(/\b(20[2-9]\d)\b/);
      if (yearOnly) {
        result.maturity = yearOnly[1];
      }
    }
  }

  return result;
}

function normalizeSymbol(symbol: string, name: string): string {
  let s = symbol.trim().toUpperCase();

  // Remove common Croesus prefixes
  s = s.replace(/^(TSE:|TSX:|TOR:|CVE:|NEO:|XTSE:|XTOR:)/i, '');
  s = s.replace(/^(NYSE:|NYSEARCA:|NASDAQ:|NMS:|XNYS:|XNAS:)/i, '');
  s = s.replace(/^(US\.|CA\.)/i, '');

  // If it's a known Canadian stock without .TO suffix, add it
  const baseSymbol = s.replace(/\.(TO|V|CN|NE)$/, '');
  if (TSX_SUFFIXES_NEEDED.some(rx => rx.test(baseSymbol)) && !s.includes('.')) {
    s = `${baseSymbol}.TO`;
  }

  // Replace Croesus preferred share notation
  // e.g., "BNS.PR.I" → "BNS-PI.TO"
  s = s.replace(/\.PR\.([A-Z])/, '-P$1.TO');

  return s;
}

function isSkippableLine(line: string): boolean {
  const trimmed = line.trim().toLowerCase();
  if (!trimmed) return true;
  // Skip total/subtotal lines
  if (/^(total|sous.?total|sub.?total|grand\s*total|s\/total)/i.test(trimmed)) return true;
  // Skip separator lines
  if (/^[-=_]+$/.test(trimmed)) return true;
  // Skip lines that are just dates or page numbers
  if (/^(page\s*\d|date|imprim|print|rapport|report|portefeuille|portfolio|client)/i.test(trimmed)) return true;
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
      summary: { equities: 0, fixedIncome: 0, etfs: 0, funds: 0, preferred: 0, cash: 0, other: 0, totalMarketValue: 0, currencies: [] },
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
    // No headers detected — try positional guessing
    // Primary: Nicolas's Croesus order: Qté, Description, Symbole, Prix marché, Val comptable, Val marché, Durée Mod., Int. courus
    warnings.push('En-têtes non détectés — ordre Croesus appliqué automatiquement (Qté, Desc, Symbole, Prix, Val. compt., Val. marché, Dur. Mod., Int. courus).');
    if (firstFields.length >= 6) {
      columnMapping = {
        quantity: 0,
        name: 1,
        symbol: 2,
        marketPrice: 3,
        bookValue: 4,
        marketValue: 5,
      };
      if (firstFields.length >= 7) columnMapping.modifiedDuration = 6;
      if (firstFields.length >= 8) columnMapping.accruedInterest = 7;
    } else if (firstFields.length === 5) {
      columnMapping = {
        quantity: 0,
        name: 1,
        symbol: 2,
        marketPrice: 3,
        marketValue: 4,
      };
    } else if (firstFields.length >= 3) {
      // Minimal fallback
      columnMapping = {
        quantity: 0,
        name: 1,
        symbol: 2,
      };
      if (firstFields.length >= 4) columnMapping.marketPrice = 3;
    }
  }

  // We need at minimum symbol + (name or quantity)
  if (columnMapping.symbol === undefined) {
    // Last resort: find the column that looks most like symbols
    const sample = allLines.slice(dataStartIndex, dataStartIndex + 5);
    for (let col = 0; col < 10; col++) {
      const values = sample.map(l => splitRow(l, separator)[col] || '').filter(Boolean);
      const symbolLike = values.filter(v => /^[A-Z]{1,6}(\.[A-Z]{1,3})?$/i.test(v.trim()));
      if (symbolLike.length >= values.length * 0.5 && symbolLike.length >= 2) {
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
      summary: { equities: 0, fixedIncome: 0, etfs: 0, funds: 0, preferred: 0, cash: 0, other: 0, totalMarketValue: 0, currencies: [] },
    };
  }

  // Parse data rows
  const currencySet = new Set<string>();

  for (let i = dataStartIndex; i < allLines.length; i++) {
    const line = allLines[i];
    if (isSkippableLine(line)) continue;

    const fields = splitRow(line, separator);

    const getField = (key: keyof ColumnMapping): string => {
      const idx = columnMapping[key];
      return idx !== undefined && idx < fields.length ? fields[idx].trim() : '';
    };

    const rawSymbol = getField('symbol');
    if (!rawSymbol || rawSymbol.length > 30) continue; // Skip invalid

    const name = getField('name') || rawSymbol;
    const typeField = getField('assetType');

    // Parse modified duration early — helps classify fixed income
    const modDurStr = getField('modifiedDuration');
    const modifiedDuration = modDurStr ? parseNumber(modDurStr) : 0;

    // Parse accrued interest / dividends
    const accruedStr = getField('accruedInterest');
    const accruedInterest = accruedStr ? parseNumber(accruedStr) : 0;

    // If modified duration > 0, it's almost certainly fixed income
    let assetType = classifyAssetType(rawSymbol, name, typeField);
    if (modifiedDuration > 0 && assetType !== 'CASH') {
      assetType = 'FIXED_INCOME';
    }

    const symbol = assetType === 'CASH' ? rawSymbol : normalizeSymbol(rawSymbol, name);

    const quantity = parseNumber(getField('quantity'));
    const marketPrice = parseNumber(getField('marketPrice'));
    const marketValue = parseNumber(getField('marketValue')) || (quantity * marketPrice);
    const bookValue = parseNumber(getField('bookValue'));
    const averageCost = parseNumber(getField('averageCost')) || (quantity > 0 ? bookValue / quantity : 0);
    const currency = getField('currency').toUpperCase() || 'CAD';
    const weight = parseNumber(getField('weight'));

    if (currency) currencySet.add(currency || 'CAD');

    const holding: ParsedHolding = {
      symbol,
      name,
      quantity,
      marketPrice,
      marketValue,
      bookValue,
      averageCost,
      currency: currency || 'CAD',
      assetType,
      weight,
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

    holdings.push(holding);
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
    currencies: Array.from(currencySet),
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
