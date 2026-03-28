import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import * as XLSX from 'xlsx';

/**
 * Common words that look like tickers but aren't.
 */
const FALSE_POSITIVES = new Set([
  'NAME', 'DATE', 'TYPE', 'SYMBOL', 'TICKER', 'QTY', 'PRICE', 'VALUE',
  'TOTAL', 'CASH', 'FUND', 'BOND', 'NOTE', 'DESCRIPTION', 'DESC',
  'USD', 'CAD', 'EUR', 'GBP', 'JPY', 'AUD', 'CHF',
  'BUY', 'SELL', 'HOLD', 'LONG', 'SHORT', 'OPEN', 'CLOSE', 'HIGH', 'LOW',
  'VOL', 'AVG', 'MIN', 'MAX', 'SUM', 'NET', 'FEE', 'TAX', 'COST',
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
  'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN',
  'NEW', 'OLD', 'ALL', 'YES', 'THE', 'AND', 'FOR', 'NOT', 'ARE', 'BUT',
  'PER', 'DAY', 'EST', 'INC', 'LTD', 'LLC', 'CORP', 'ETF',
  'REER', 'CELI', 'REEE', 'FERR', 'NR', 'NO', 'ID', 'REF',
  'ACTIF', 'ACTIFS', 'COMPTE', 'CLIENT', 'PROFIL', 'SECTEUR',
]);

/**
 * Regex for stock ticker patterns:
 * - US: 1-5 uppercase letters (AAPL, MSFT, GOOGL, BRK.B)
 * - Canadian: SYMBOL.TO, SYMBOL.V, SYMBOL.NE, SYMBOL-UN.TO, SYMBOL-B.TO
 */
const TICKER_PATTERN = /^[A-Z]{1,5}(?:[.-][A-Z]{1,3})?(?:\.(TO|V|NE))?$/;

/**
 * POST /api/models/universe/import
 * Receives an Excel file, scans all cells, and returns detected stock symbols.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Fichier requis' }, { status: 400 });

  if (!file.name.match(/\.(xlsx|xlsm|xls|csv)$/i)) {
    return NextResponse.json({ error: 'Format invalide. Fichiers acceptes : .xlsx, .xlsm, .xls, .csv' }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const candidates = new Set<string>();

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    for (const row of rows) {
      if (!row) continue;
      for (const cell of row) {
        if (cell == null) continue;
        const val = String(cell).trim();
        if (val.length < 1 || val.length > 12) continue;

        // Try the cell as-is (uppercase)
        const upper = val.toUpperCase();

        // Check direct match
        if (TICKER_PATTERN.test(upper) && !FALSE_POSITIVES.has(upper.replace(/\.(TO|V|NE)$/, ''))) {
          candidates.add(upper);
          continue;
        }

        // Check if cell contains a ticker with extra text (e.g., "AAPL - Apple Inc")
        const parts = val.split(/[\s,;:\-|/]+/);
        for (const part of parts) {
          const p = part.trim().toUpperCase();
          if (p.length >= 1 && p.length <= 10 && TICKER_PATTERN.test(p) && !FALSE_POSITIVES.has(p.replace(/\.(TO|V|NE)$/, ''))) {
            candidates.add(p);
          }
        }
      }
    }
  }

  // Sort: Canadian tickers first (.TO, .V), then US
  const symbols = [...candidates].sort((a, b) => {
    const aCA = /\.(TO|V|NE)$/.test(a) ? 0 : 1;
    const bCA = /\.(TO|V|NE)$/.test(b) ? 0 : 1;
    return aCA - bCA || a.localeCompare(b);
  });

  return NextResponse.json({
    symbols,
    stats: {
      sheets: workbook.SheetNames.length,
      detected: symbols.length,
    },
  });
}
