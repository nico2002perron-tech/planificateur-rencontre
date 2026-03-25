/**
 * Fund Facts PDF Fetcher
 *
 * Tries to download Fund Facts PDFs from manufacturer websites
 * using known URL patterns. Tries each URL in order until one works.
 */

import { getFundFactsUrls, findManufacturer } from './registry';

export interface FetchResult {
  success: boolean;
  buffer?: Buffer;
  url?: string;
  contentType?: string;
  manufacturer?: string;
  error?: string;
}

const FETCH_TIMEOUT = 15_000; // 15 seconds

/**
 * Attempt to fetch a Fund Facts PDF for the given FundSERV code.
 * Tries all known URL patterns for the manufacturer until one returns a valid PDF.
 */
export async function fetchFundFactsPdf(fundCode: string): Promise<FetchResult> {
  const mfr = findManufacturer(fundCode);
  if (!mfr) {
    return {
      success: false,
      error: `Manufacturier inconnu pour le code ${fundCode}`,
    };
  }

  const urls = getFundFactsUrls(fundCode);
  if (urls.length === 0) {
    return {
      success: false,
      error: `Aucune URL connue pour le code ${fundCode}`,
      manufacturer: mfr.name,
    };
  }

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/pdf,*/*',
        },
        redirect: 'follow',
      });

      clearTimeout(timeout);

      if (!res.ok) continue;

      const contentType = res.headers.get('content-type') || '';

      // Verify it's actually a PDF
      if (!contentType.includes('pdf')) {
        // Some servers don't set content-type correctly — check magic bytes
        const arrayBuffer = await res.arrayBuffer();
        const header = new Uint8Array(arrayBuffer.slice(0, 5));
        const isPdf = header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46; // %PDF
        if (!isPdf) continue;

        return {
          success: true,
          buffer: Buffer.from(arrayBuffer),
          url,
          contentType: 'application/pdf',
          manufacturer: mfr.name,
        };
      }

      const buffer = Buffer.from(await res.arrayBuffer());

      // Sanity check: PDF should be at least 1KB
      if (buffer.length < 1024) continue;

      return {
        success: true,
        buffer,
        url,
        contentType: 'application/pdf',
        manufacturer: mfr.name,
      };
    } catch {
      // Timeout or network error — try next URL
      continue;
    }
  }

  return {
    success: false,
    error: `Aucune URL valide trouvée pour ${fundCode} (${urls.length} essais sur ${mfr.name})`,
    manufacturer: mfr.name,
  };
}
