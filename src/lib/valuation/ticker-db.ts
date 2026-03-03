/** Base de tickers — port de data/ticker_database.py */

export const TICKER_DB = [
  '--- TECH US (MAGNIFICENT 7) ---',
  'AAPL - Apple Inc.',
  'MSFT - Microsoft Corp.',
  'NVDA - NVIDIA Corp.',
  'GOOG - Alphabet Inc. (Google)',
  'AMZN - Amazon.com',
  'META - Meta Platforms',
  'TSLA - Tesla Inc.',
  '--- POPULAIRES ---',
  'DUOL - Duolingo',
  'UBER - Uber Technologies',
  'ABNB - Airbnb',
  'SPOT - Spotify',
  'NFLX - Netflix',
  'COST - Costco Wholesale',
  'LLY - Eli Lilly (Pharma)',
  '--- SPACE & DÉFENSE ---',
  'MDA.TO - MDA Space (Canada)',
  'RKLB - Rocket Lab USA',
  'ASTS - AST SpaceMobile',
  'PLTR - Palantir Technologies',
  'LMT - Lockheed Martin',
  'IONQ - IonQ Inc',
  '--- CANADA (TSX) ---',
  'RY.TO - Royal Bank (RBC)',
  'TD.TO - TD Bank',
  'SHOP.TO - Shopify (CAD)',
  'CNR.TO - CN Rail',
  'ENB.TO - Enbridge',
  'ATD.TO - Alimentation Couche-Tard',
  'CSU.TO - Constellation Software',
  '--- CRYPTO & FINTECH ---',
  'COIN - Coinbase',
  'MSTR - MicroStrategy',
  'SQ - Block Inc.',
  'PYPL - PayPal',
  '--- SAAS & CLOUD ---',
  'CRM - Salesforce',
  'SNOW - Snowflake',
  'DDOG - Datadog',
  'NOW - ServiceNow',
  'MDB - MongoDB',
  '--- CYBERSÉCURITÉ ---',
  'PANW - Palo Alto Networks',
  'CRWD - CrowdStrike',
  'FTNT - Fortinet',
  'ZS - Zscaler',
];

/** Extrait le symbole d'une entrée comme "AAPL - Apple Inc." → "AAPL" */
export function extractTicker(entry: string): string | null {
  if (entry.startsWith('---')) return null;
  const parts = entry.split(' - ');
  return parts[0]?.trim() || null;
}

/** Retourne uniquement les tickers valides (sans les séparateurs) */
export function getValidTickers(): string[] {
  return TICKER_DB.filter((e) => !e.startsWith('---')).map((e) => e.split(' - ')[0].trim());
}
