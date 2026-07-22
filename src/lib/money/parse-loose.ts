/**
 * Parsing tolérant des MONTANTS SAISIS À LA MAIN dans l'interface
 * (« 782 000 », « 782,000 », « 1 234,56 », « 1,234.56 », « (2 500,00) »…).
 *
 * Règles :
 * - espaces (y compris insécables) et « $ » ignorés ;
 * - virgule ET point présents → le DERNIER des deux est la décimale ;
 * - virgule seule : plusieurs virgules OU « ,ddd » final = milliers (782,000 →
 *   782000) ; sinon décimale FR (1 234,56 → 1234.56) ;
 * - point seul : plusieurs points = milliers européens (1.234.567) ;
 * - parenthèses = négatif comptable, si `allowNegative`.
 *
 * ⚠️ NE PAS utiliser pour les collages Croesus (year-activity.ts /
 * croesus-parser.ts ont leur propre sémantique) — champs de formulaire seulement.
 */
export function parseMoneyLoose(
  value: string,
  options?: { allowNegative?: boolean }
): number | undefined {
  const allowNegative = options?.allowNegative ?? false;
  const cleaned = value
    .replace(/ /g, ' ')
    .replace(/\s/g, '')
    .replace(/[$]/g, '')
    .replace(/[^0-9,().-]/g, '');
  if (!cleaned) return undefined;

  const negative = allowNegative && (/^\(.*\)$/.test(cleaned) || cleaned.startsWith('-'));
  const unsigned = cleaned.replace(/[()-]/g, '');

  const lastComma = unsigned.lastIndexOf(',');
  const lastDot = unsigned.lastIndexOf('.');
  const normalized = lastComma >= 0 && lastDot >= 0
    ? lastComma > lastDot
      ? unsigned.replace(/\./g, '').replace(',', '.')
      : unsigned.replace(/,/g, '')
    : lastComma >= 0
      ? ((unsigned.match(/,/g) || []).length > 1 || /,\d{3}$/.test(unsigned))
        ? unsigned.replace(/,/g, '')
        : unsigned.replace(',', '.')
      : (unsigned.match(/\./g) || []).length > 1
        ? unsigned.replace(/\./g, '')
        : unsigned;

  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return undefined;
  return negative ? -Math.abs(parsed) : parsed;
}
