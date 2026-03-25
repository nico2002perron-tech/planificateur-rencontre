/**
 * Canadian Fund Manufacturer Registry
 *
 * Maps FundSERV code prefixes to manufacturer info and Fund Facts PDF URL patterns.
 * Each manufacturer publishes Fund Facts at predictable URLs.
 */

export interface FundManufacturer {
  name: string;
  prefixes: string[];
  /** Build the Fund Facts PDF URL from a FundSERV code. Return array of URLs to try in order. */
  buildUrls: (code: string) => string[];
  /** Language: 'en' or 'fr' */
  lang: 'en' | 'fr';
}

export const FUND_MANUFACTURERS: FundManufacturer[] = [
  {
    name: 'RBC Gestion mondiale d\'actifs',
    prefixes: ['RBF'],
    lang: 'en',
    buildUrls: (code) => {
      const lc = code.toLowerCase();
      return [
        // English Fund Facts
        `https://funds.rbcgam.com/pdf/fund-facts/funds/${lc}_e.pdf`,
        // French Aperçu du fonds
        `https://funds.rbcgam.com/pdf/fund-facts/funds/${lc}_f.pdf`,
      ];
    },
  },
  {
    name: 'TD Gestion de placements',
    prefixes: ['TDB'],
    lang: 'en',
    buildUrls: (code) => {
      const lc = code.toLowerCase();
      return [
        `https://www.td.com/content/dam/tdam/ca/en/pdf/${lc}e-en.pdf`,
        `https://www.td.com/content/dam/tdam/ca/fr/pdf/${lc}e-fr.pdf`,
      ];
    },
  },
  {
    name: 'Banque Nationale Investissements',
    prefixes: ['NBC', 'NBI', 'NB'],
    lang: 'en',
    buildUrls: (code) => {
      const uc = code.toUpperCase();
      // NBI uses series names in URL — try common series
      const series = ['Investor', 'Advisor', 'F', 'O', 'FT', 'FT5', 'FT8'];
      return series.map(
        (s) => `https://www.nbinvestments.ca/content/dam/bni/en/fund/regulatory/fund-facts/${uc}-${s}-fund-facts.pdf`
      );
    },
  },
  {
    name: 'Fonds Dynamique',
    prefixes: ['DYN'],
    lang: 'en',
    buildUrls: (code) => {
      // Dynamic uses internal profile codes (H61G, PW1K), not FundSERV codes directly.
      // We try a search approach — the fund code page may redirect.
      // For now, try common series suffixes with the code as-is.
      const uc = code.toUpperCase();
      const series = ['A', 'F', 'I', 'O'];
      return series.map(
        (s) => `https://dynamic.ca/content/dam/docs/regulatory/fund-facts/${uc}_${s}_EN.pdf`
      );
    },
  },
  {
    name: 'Desjardins',
    prefixes: ['DSC', 'DJF'],
    lang: 'fr',
    buildUrls: (code) => {
      // Desjardins uses internal numeric codes in URLs, not FundSERV codes.
      // We try extracting the numeric portion from the FundSERV code.
      const numMatch = code.match(/\d+/);
      if (!numMatch) return [];
      const num = numMatch[0].padStart(5, '0');
      const series = ['a', 'f', 'i', 'c'];
      return series.map(
        (s) => `https://www.fondsdesjardins.com/information/${num}_adf_${s}_fr.pdf`
      );
    },
  },
  {
    name: 'IA Clarington',
    prefixes: ['IAG', 'ICL'],
    lang: 'en',
    buildUrls: (code) => {
      // IA Clarington uses internal IDs in URLs — try the numeric portion
      const numMatch = code.match(/\d+/);
      if (!numMatch) return [];
      const num = numMatch[0];
      return [
        `https://cdn01.iaclarington.com/fund_docs/fund_fact/FundFacts_${num}_EN.pdf`,
        `https://cdn01.iaclarington.com/fund_docs/fund_fact/FundFacts_${num}_F_EN.pdf`,
        `https://cdn01.iaclarington.com/fund_docs/fund_fact/FundFacts_${num}_A_EN.pdf`,
      ];
    },
  },
  {
    name: 'Mackenzie',
    prefixes: ['MKZ', 'MAK', 'MFC'],
    lang: 'en',
    buildUrls: (code) => {
      // Mackenzie uses internal codes. Try the FundSERV code directly.
      const uc = code.toUpperCase();
      return [
        `https://fundexpressweb.dfsco.com/mackenzielaurentian/files/EN4/${uc}.pdf`,
        `https://www.mackenzieinvestments.com/content/dam/final/corporate/mackenzie/docs/fund-facts/${uc}_EN.pdf`,
      ];
    },
  },
  {
    name: 'Fidelity Canada',
    prefixes: ['FID'],
    lang: 'en',
    buildUrls: (code) => {
      // Fidelity uses internal category codes. Try FundSERV code directly.
      const lc = code.toLowerCase();
      const uc = code.toUpperCase();
      return [
        `https://www.fidelity.ca/content/dam/fidelity/en/documents/fund-facts/${lc}/FF_${uc}_A_en.pdf`,
        `https://www.fidelity.ca/content/dam/fidelity/en/documents/fund-facts/${lc}/FF_${uc}_F_en.pdf`,
      ];
    },
  },
  {
    name: 'Manuvie',
    prefixes: ['MMF', 'MLI'],
    lang: 'en',
    buildUrls: (code) => {
      // Manulife uses internal code + series letter. Extract numeric part.
      const numMatch = code.match(/\d+/);
      if (!numMatch) return [];
      const num = numMatch[0];
      const series = ['e', 'f', 'a', 'i'];
      return series.map(
        (s) => `https://funds.manulife.ca/api/mutual/pdf/${num}${s}-en-us`
      );
    },
  },
  {
    name: 'CI Investments',
    prefixes: ['CIG'],
    lang: 'en',
    buildUrls: (code) => {
      const numMatch = code.match(/\d+/);
      if (!numMatch) return [];
      const num = numMatch[0];
      return [
        `https://www.ci.com/content/dam/ci-assets/docs/fund-facts/FF_${num}_A_EN.pdf`,
        `https://www.ci.com/content/dam/ci-assets/docs/fund-facts/FF_${num}_F_EN.pdf`,
      ];
    },
  },
];

/**
 * Find the manufacturer for a given FundSERV code
 */
export function findManufacturer(fundCode: string): FundManufacturer | null {
  const uc = fundCode.toUpperCase();
  for (const mfr of FUND_MANUFACTURERS) {
    for (const prefix of mfr.prefixes) {
      if (uc.startsWith(prefix)) return mfr;
    }
  }
  return null;
}

/**
 * Get all possible PDF URLs for a given fund code
 */
export function getFundFactsUrls(fundCode: string): string[] {
  const mfr = findManufacturer(fundCode);
  if (!mfr) return [];
  return mfr.buildUrls(fundCode);
}
