/**
 * bonds-excel-parser.ts
 * Parse un fichier Excel de bonds (format Bonds CAD.xlsm / Bonds US.xlsm)
 * et extrait les obligations avec CUSIP, coupon, échéance, prix, yield, etc.
 *
 * Port de extract_bonds.py vers TypeScript.
 */

import * as XLSX from 'xlsx';
import { MOIS_FR } from '@/lib/utils/constants';

// Onglets à ignorer dans les fichiers source
const ONGLETS_IGNORER = new Set(['DISCLAIMER', 'MUNI NI', 'MONEY MARKET']);

export interface ParsedBond {
  cusip: string;
  issuer: string;
  coupon: number | null;
  maturity: string | null; // ISO date string
  price: number | null;
  yield: number | null;
  spread: number | null;
  category: string;       // nom de l'onglet source
  source: 'CAD' | 'US';
  rating_sp?: string;
  rating_dbrs?: string;
}

export interface BondImportResult {
  bonds: ParsedBond[];
  stats: {
    total: number;
    sheets_parsed: number;
    sheets_skipped: number;
  };
}

/**
 * Parse un fichier Excel de bonds (Buffer ou ArrayBuffer).
 * Détecte automatiquement la source (CAD/US) via le nom du fichier.
 */
export function parseBondsExcel(
  buffer: ArrayBuffer,
  fileName: string
): BondImportResult {
  const source: 'CAD' | 'US' = fileName.toUpperCase().includes('CAD') ? 'CAD' : 'US';
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  const allBonds: ParsedBond[] = [];
  let sheetsParsed = 0;
  let sheetsSkipped = 0;

  for (const sheetName of workbook.SheetNames) {
    if (ONGLETS_IGNORER.has(sheetName.toUpperCase())) {
      sheetsSkipped++;
      continue;
    }

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      sheetsSkipped++;
      continue;
    }

    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    // Localiser la ligne d'en-tête (première cellule = 'CUSIP')
    let headerRowIdx = -1;
    let headers: string[] = [];
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const row = rows[i];
      if (row && String(row[0]).trim().toUpperCase() === 'CUSIP') {
        headers = (row as unknown[]).map((h, j) =>
          h != null ? String(h).trim().toUpperCase() : `COL_${j}`
        );
        headerRowIdx = i;
        break;
      }
    }

    if (headerRowIdx === -1) {
      sheetsSkipped++;
      continue;
    }

    sheetsParsed++;

    // Mapper les colonnes connues
    const colIdx = {
      cusip:     headers.indexOf('CUSIP'),
      issuer:    headers.indexOf('ISSUER'),
      coupon:    headers.indexOf('COUPON'),
      maturity:  headers.indexOf('MATURITY'),
      price:     headers.indexOf('PRICE'),
      yield:     headers.indexOf('YIELD'),
      spread:    headers.indexOf('SPREAD'),
      sp:        headers.indexOf('S&P'),
      dbrs:      headers.indexOf('DBRS'),
    };

    // Lire les lignes de données
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      const cusip = row[colIdx.cusip];
      if (!cusip || String(cusip).trim() === '') continue;

      const bond: ParsedBond = {
        cusip:      String(cusip).trim(),
        issuer:     colIdx.issuer >= 0 && row[colIdx.issuer] ? String(row[colIdx.issuer]).trim() : '',
        coupon:     parseNum(row[colIdx.coupon]),
        maturity:   parseDate(row[colIdx.maturity]),
        price:      parseNum(row[colIdx.price]),
        yield:      parseNum(row[colIdx.yield]),
        spread:     colIdx.spread >= 0 ? parseNum(row[colIdx.spread]) : null,
        category:   sheetName,
        source,
        rating_sp:  colIdx.sp >= 0 && row[colIdx.sp] ? String(row[colIdx.sp]).trim() : undefined,
        rating_dbrs: colIdx.dbrs >= 0 && row[colIdx.dbrs] ? String(row[colIdx.dbrs]).trim() : undefined,
      };

      allBonds.push(bond);
    }
  }

  return {
    bonds: allBonds,
    stats: {
      total: allBonds.length,
      sheets_parsed: sheetsParsed,
      sheets_skipped: sheetsSkipped,
    },
  };
}

/**
 * Parse une description abrégée de bond (format Croesus).
 * Ex: 'HEB CB 5.82% 13AU29' → { coupon: 5.82, maturity: '2029-08-13', issuer: 'HEB CB' }
 */
export function parseBondDescription(desc: string): {
  coupon: number | null;
  maturity: string | null;
  issuer: string;
} {
  desc = desc.trim();

  // Coupon : ex "5.82%", "6%", "C$4.375%", "CV5.5%"
  const couponMatch = desc.match(/(\d+(?:[.,]\d+)?)\s*%/);
  const coupon = couponMatch
    ? parseFloat(couponMatch[1].replace(',', '.'))
    : null;

  // Echéance : ex "15JN32", "13AU29", "8SP35"
  const moisKeys = Object.keys(MOIS_FR).join('|');
  const dateRegex = new RegExp(`(\\d{1,2})(${moisKeys})(\\d{2})\\b`);
  const dateMatch = desc.match(dateRegex);
  let maturity: string | null = null;
  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10);
    const month = MOIS_FR[dateMatch[2]];
    const year = 2000 + parseInt(dateMatch[3], 10);
    if (month && day >= 1 && day <= 31) {
      maturity = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Emetteur : texte avant le coupon%
  const parts = desc.split(/\d+(?:[.,]\d+)?\s*%/);
  const issuer = parts.length > 1 ? parts[0].trim() : desc.replace(/\d{1,2}(?:JA|FV|MR|AP|MI|JN|JL|AU|SP|OC|NO|DC)\d{2}/, '').trim();

  return { coupon, maturity, issuer };
}

// ── Helpers ──

function parseNum(val: unknown): number | null {
  if (val == null) return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  return isFinite(n) ? n : null;
}

function parseDate(val: unknown): string | null {
  if (val == null) return null;
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  const s = String(val).trim();
  // Essayer ISO format
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return null;
}
