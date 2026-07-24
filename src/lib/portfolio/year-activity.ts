// Sans cycle : croesus-parser n'importe rien de lib/portfolio.
import { ACCOUNT_TYPE_MAP } from '@/lib/parsers/croesus-parser';

export type ActivityPeriod = 'six_months' | 'year_to_date' | 'one_year';

export type ActivityCategory = 'income' | 'contribution' | 'withdrawal' | 'other';
export type IncomeCategory = 'dividend' | 'fixed_income' | 'other';

export interface CroesusActivityTransaction {
  id: string;
  name: string;
  note: string;
  processingDate: string;
  transactionDate: string;
  accountCode: string;
  accountNumber: string;
  type: string;
  symbol: string;
  quantity: number | null;
  currency: string;
  amount: number;
  fees: number;
  balance: number | null;
  category: ActivityCategory;
  incomeCategory: IncomeCategory;
  /** Prix unitaire de la transaction (colonne Prix), si présent. */
  price?: number | null;
  /** Commission (colonne Commission), si présente. */
  commission?: number | null;
  /** Gains/Pertes inscrits par Croesus sur la ligne (colonne 12) — un FAIT du relevé. */
  realizedGainLoss?: number | null;
  /** Achat ou vente de titre, détecté SEULEMENT quand category === 'other'
   *  (partition stricte : un réinvestissement classé 'income' ne devient jamais un achat). */
  tradeKind?: 'buy' | 'sell' | null;
}

export interface MonthlyPortfolioActivity {
  key: string;
  label: string;
  income: number;
  dividends: number;
  fixedIncome: number;
  otherIncome: number;
  transactionCount: number;
}

export interface PortfolioIncomeSource {
  symbol: string;
  name: string;
  amount: number;
  pct: number;
  /** Nature dominante des revenus de cette source (argmax des montants par nature). */
  category: IncomeCategory;
}

export interface AnnualPortfolioIncome {
  year: number;
  amount: number;
}

export interface PortfolioActivitySummary {
  period: ActivityPeriod;
  periodLabel: string;
  title: string;
  startDate: string;
  endDate: string;
  transactionCount: number;
  ignoredTransactionCount: number;
  incomeTransactionCount: number;
  income: number;
  dividendIncome: number;
  fixedIncomeIncome: number;
  otherIncome: number;
  contributions: number;
  withdrawals: number;
  netContributions: number;
  averageMonthlyIncome: number;
  monthlyIncome: MonthlyPortfolioActivity[];
  /** Année civile de référence (celle de la date de fin). */
  currentYear: number;
  /** Revenus mensuels de l'année civile en cours (Jan→Déc), TOUTES transactions
   *  confondues — indépendant de la période choisie. Sert au tableau de bord de
   *  la couverture pour un « encaissé à date » complet et cohérent avec la page. */
  currentYearMonthlyIncome: MonthlyPortfolioActivity[];
  topIncomeSources: PortfolioIncomeSource[];
  annualIncome: AnnualPortfolioIncome[];
  currentPortfolioValue: number;
  startingPortfolioValue?: number;
  investmentGrowth?: number;
  totalValueChange?: number;
  narrative: string;
  /** Achats/ventes de titres détectés dans la fenêtre (sous-ensemble de
   *  ignoredTransactionCount — invariant : buyCount + sellCount ≤ ignoredTransactionCount).
   *  Alimentent la page « Le parcours de votre argent ». */
  buyCount?: number;
  sellCount?: number;
  buyTotal?: number;
  sellTotal?: number;
}

export interface PortfolioActivityOverrides {
  currentPortfolioValue: number;
  startingPortfolioValue?: number;
  contributions?: number;
  withdrawals?: number;
  incomeCategoriesBySymbol?: Record<string, Exclude<IncomeCategory, 'other'>>;
  /** Taux USD→CAD appliqué aux montants en USD (sinon additionnés tels quels). */
  usdCadRate?: number;
}

const HEADER_ALIASES = {
  name: ['nom', 'description', 'titre'],
  note: ['note', 'notes'],
  processingDate: ['traitement', 'date de traitement'],
  transactionDate: ['transaction', 'date de transaction', 'date'],
  accountCode: ['code de cp', 'code cp', 'cp'],
  accountNumber: ['no de compte', 'numero de compte', 'compte'],
  type: ['type', 'type de transaction'],
  symbol: ['symbole', 'symbol'],
  quantity: ['quantite', 'qte'],
  currency: ['devise', 'currency'],
  amount: ['total', 'montant', 'montant net'],
  fees: ['frais'],
  balance: ['solde'],
  price: ['prix'],
  commission: ['commission'],
  realizedGainLoss: ['gains/pertes', 'gain/perte', 'gains et pertes'],
} as const;

const MONTH_LABELS = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUN', 'JUL', 'AOÛ', 'SEP', 'OCT', 'NOV', 'DÉC'];

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function cleanCell(value: string): string {
  const trimmed = value.replace(/^\uFEFF/, '').trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/""/g, '"');
  }
  return trimmed;
}

function parseNumber(value: string): number {
  let text = value
    .replace(/\u00a0/g, ' ')
    .replace(/\s/g, '')
    .replace(/[$]/g, '')
    .replace(/[^0-9,().-]/g, '');
  if (!text) return Number.NaN;

  const negative = /^\(.*\)$/.test(text);
  text = text.replace(/[()]/g, '');

  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    text = lastComma > lastDot
      ? text.replace(/\./g, '').replace(',', '.')
      : text.replace(/,/g, '');
  } else if (lastComma >= 0) {
    // Plusieurs virgules = séparateurs de milliers (1,234,567) ; une seule =
    // décimale FR (1 234,56 → 1234.56).
    text = (text.match(/,/g) || []).length > 1 ? text.replace(/,/g, '') : text.replace(',', '.');
  } else if (lastDot >= 0 && (text.match(/\./g) || []).length > 1) {
    // Plusieurs points = séparateurs de milliers style européen (1.234.567).
    text = text.replace(/\./g, '');
  }

  const parsed = Number.parseFloat(text);
  if (!Number.isFinite(parsed)) return Number.NaN;
  return negative ? -Math.abs(parsed) : parsed;
}

// Construit une date en validant les bornes ET en rejetant les débordements
// silencieux de JS (ex. 2026-13-45 deviendrait 2027-02-14 → on renvoie null).
function makeDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

export function parseDate(value: string): Date | null {
  const text = value.trim();
  if (!text) return null;

  let match = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (match) return makeDate(Number(match[1]), Number(match[2]), Number(match[3]));

  match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) return makeDate(Number(match[3]), Number(match[2]), Number(match[1]));

  return null;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function detectIncomeCategory(type: string, note: string): IncomeCategory {
  const combined = normalizeText(type + ' ' + note);
  if (
    combined.includes('coupon') ||
    combined.includes('interet') ||
    combined.includes('revenu fixe') ||
    combined.includes('obligation')
  ) {
    return 'fixed_income';
  }
  if (combined.includes('dividende') || combined.includes('distribution')) {
    return 'dividend';
  }
  return 'other';
}

function detectCategory(type: string, note: string, amount: number): ActivityCategory {
  const normalizedType = normalizeText(type);
  const normalizedNote = normalizeText(note);
  const combined = `${normalizedType} ${normalizedNote}`;

  // Frais et intérêts débiteurs : ni revenu, ni cotisation, ni retrait. Sans
  // cette garde, un « intérêt débiteur » (frais) serait compté comme revenu, et
  // un « paiement de frais de gestion » gonflerait les retraits.
  if (combined.includes('frais') || combined.includes('debiteur')) {
    return 'other';
  }

  if (
    combined.includes('dividende') ||
    combined.includes('distribution') ||
    combined.includes('coupon') ||
    combined.includes('interet') ||
    combined.includes('revenu')
  ) {
    return 'income';
  }

  if (
    combined.includes('cotisation') ||
    normalizedType.includes('depot') ||
    normalizedType.includes('apport')
  ) {
    return amount < 0 ? 'withdrawal' : 'contribution';
  }

  if (
    normalizedType.includes('retrait') ||
    normalizedType.includes('decaissement') ||
    normalizedType.includes('paiement')
  ) {
    return 'withdrawal';
  }

  // Les transferts internes sont volontairement exclus. Ils peuvent être
  // remplacés par les champs Cotisations/Retraits dans le générateur.
  return 'other';
}

/**
 * Achat ou vente de titre — appelé UNIQUEMENT quand category === 'other'.
 * « rachat » est testé AVANT « achat » (piège : « rachat » contient « achat »).
 */
export function detectTradeKind(type: string): 'buy' | 'sell' | null {
  const t = normalizeText(type);
  if (t.includes('rachat')) return 'sell';
  if (t.includes('vente') || t.includes('vendu')) return 'sell';
  if (t.includes('achat') || t.includes('achete') || t.includes('souscription')) return 'buy';
  return null;
}

function findHeaderIndex(headers: string[], aliases: readonly string[]): number {
  const normalizedAliases = aliases.map(normalizeText);
  return headers.findIndex(header => normalizedAliases.includes(normalizeText(header)));
}

function getHeaderedCell(cells: string[], headers: string[], aliases: readonly string[]): string {
  const index = findHeaderIndex(headers, aliases);
  return index >= 0 ? cells[index] ?? '' : '';
}

function parseHeaderedRow(cells: string[], headers: string[], index: number): CroesusActivityTransaction | null {
  const transactionDateRaw = getHeaderedCell(cells, headers, HEADER_ALIASES.transactionDate);
  const processingDateRaw = getHeaderedCell(cells, headers, HEADER_ALIASES.processingDate);
  const date = parseDate(transactionDateRaw) ?? parseDate(processingDateRaw);
  const type = getHeaderedCell(cells, headers, HEADER_ALIASES.type);
  const amountRaw = getHeaderedCell(cells, headers, HEADER_ALIASES.amount);
  const amount = parseNumber(amountRaw);
  if (!date || !type || !Number.isFinite(amount)) return null;

  const note = getHeaderedCell(cells, headers, HEADER_ALIASES.note);
  const quantity = parseNumber(getHeaderedCell(cells, headers, HEADER_ALIASES.quantity));
  const fees = parseNumber(getHeaderedCell(cells, headers, HEADER_ALIASES.fees));
  const balance = parseNumber(getHeaderedCell(cells, headers, HEADER_ALIASES.balance));
  const price = parseNumber(getHeaderedCell(cells, headers, HEADER_ALIASES.price));
  const commission = parseNumber(getHeaderedCell(cells, headers, HEADER_ALIASES.commission));
  const realizedGainLoss = parseNumber(getHeaderedCell(cells, headers, HEADER_ALIASES.realizedGainLoss));
  const category = detectCategory(type, note, amount);

  return {
    id: `${toIsoDate(date)}-${index}-${getHeaderedCell(cells, headers, HEADER_ALIASES.symbol) || type}`,
    name: getHeaderedCell(cells, headers, HEADER_ALIASES.name),
    note,
    processingDate: processingDateRaw,
    transactionDate: toIsoDate(date),
    accountCode: getHeaderedCell(cells, headers, HEADER_ALIASES.accountCode),
    accountNumber: getHeaderedCell(cells, headers, HEADER_ALIASES.accountNumber),
    type,
    symbol: getHeaderedCell(cells, headers, HEADER_ALIASES.symbol),
    quantity: Number.isFinite(quantity) ? quantity : null,
    currency: getHeaderedCell(cells, headers, HEADER_ALIASES.currency) || 'CAD',
    amount,
    fees: Number.isFinite(fees) ? fees : 0,
    balance: Number.isFinite(balance) ? balance : null,
    category,
    incomeCategory: detectIncomeCategory(type, note),
    price: Number.isFinite(price) ? price : null,
    commission: Number.isFinite(commission) ? commission : null,
    realizedGainLoss: Number.isFinite(realizedGainLoss) ? realizedGainLoss : null,
    tradeKind: category === 'other' ? detectTradeKind(type) : null,
  };
}

function parseCroesusHistoryRow(cells: string[], index: number): CroesusActivityTransaction | null {
  // Export "Historique des transactions" Croesus sans en-têtes:
  // Nom, Note, Traitement, Transaction, Code CP, Type, Symbole, Quantité,
  // Prix, Devise, Total, Commission, Gains/Pertes, Int. courus, Frais,
  // PBR manuel, Solde, No de compte.
  const date = parseDate(cells[3] ?? '') ?? parseDate(cells[2] ?? '');
  const type = cells[5] ?? '';
  const amount = parseNumber(cells[10] ?? '');
  if (!date || !type || !Number.isFinite(amount)) return null;

  const note = cells[1] ?? '';
  const quantity = parseNumber(cells[7] ?? '');
  const fees = parseNumber(cells[14] ?? '');
  const balance = parseNumber(cells[16] ?? '');
  const price = parseNumber(cells[8] ?? '');
  const commission = parseNumber(cells[11] ?? '');
  const realizedGainLoss = parseNumber(cells[12] ?? '');
  const category = detectCategory(type, note, amount);

  return {
    id: `${toIsoDate(date)}-${index}-${cells[6] || type}`,
    name: cells[0] ?? '',
    note,
    processingDate: cells[2] ?? '',
    transactionDate: toIsoDate(date),
    accountCode: cells[4] ?? '',
    accountNumber: cells[17] ?? '',
    type,
    symbol: cells[6] ?? '',
    quantity: Number.isFinite(quantity) ? quantity : null,
    currency: cells[9] || 'CAD',
    amount,
    fees: Number.isFinite(fees) ? fees : 0,
    balance: Number.isFinite(balance) ? balance : null,
    category,
    incomeCategory: detectIncomeCategory(type, note),
    price: Number.isFinite(price) ? price : null,
    commission: Number.isFinite(commission) ? commission : null,
    realizedGainLoss: Number.isFinite(realizedGainLoss) ? realizedGainLoss : null,
    tradeKind: category === 'other' ? detectTradeKind(type) : null,
  };
}

export function parseCroesusActivity(text: string): CroesusActivityTransaction[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return [];

  const lines = normalized
    .split('\n')
    .filter(line => line.trim().length > 0)
    .map(line => line.split('\t').map(cleanCell));

  if (lines.length === 0) return [];

  // Détection d'en-têtes tolérante : on s'appuie sur les alias (ex. « Type de
  // transaction », « Montant net ») plutôt que sur une correspondance exacte.
  const hasHeaders = findHeaderIndex(lines[0], HEADER_ALIASES.type) >= 0 &&
    findHeaderIndex(lines[0], HEADER_ALIASES.amount) >= 0;
  const headers = hasHeaders ? lines[0] : [];
  const rows = hasHeaders ? lines.slice(1) : lines;

  const parsed = rows
    .map((cells, index) => hasHeaders
      ? parseHeaderedRow(cells, headers, index)
      : parseCroesusHistoryRow(cells, index))
    .filter((row): row is CroesusActivityTransaction => row !== null);

  if (parsed.length === 0) {
    throw new Error(
      'Aucune transaction reconnue. Collez l’historique Croesus en 18 colonnes, avec ou sans la ligne d’en-têtes.'
    );
  }

  return parsed.sort((a, b) => a.transactionDate.localeCompare(b.transactionDate));
}

export function getActivityWindow(period: ActivityPeriod, endDate = new Date()): { start: Date; end: Date } {
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999);
  let start: Date;

  if (period === 'year_to_date') {
    start = new Date(end.getFullYear(), 0, 1);
  } else if (period === 'six_months') {
    start = new Date(end.getFullYear(), end.getMonth() - 5, 1);
  } else {
    start = new Date(end.getFullYear(), end.getMonth() - 11, 1);
  }

  return { start, end };
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function buildMonthBuckets(start: Date, end: Date): MonthlyPortfolioActivity[] {
  const months: MonthlyPortfolioActivity[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const lastMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= lastMonth) {
    months.push({
      key: monthKey(cursor),
      label: MONTH_LABELS[cursor.getMonth()],
      income: 0,
      dividends: 0,
      fixedIncome: 0,
      otherIncome: 0,
      transactionCount: 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNarrativeDate(isoDate: string): string {
  const formatted = new Intl.DateTimeFormat('fr-CA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${isoDate}T12:00:00`));
  return formatted.replace(/^1 /, '1er ');
}

function buildNarrative(summary: Omit<PortfolioActivitySummary, 'narrative'>): string {
  const periodStart = formatNarrativeDate(summary.startDate);
  const periodEnd = formatNarrativeDate(summary.endDate);
  const parts = [
    `Depuis le ${periodStart}, le portefeuille a encaissé ${formatMoney(summary.income)} en revenus.`,
    `Les cotisations nettes totalisent ${formatMoney(summary.netContributions)}.`,
  ];

  if (summary.investmentGrowth != null) {
    parts.push(
      `L’évolution attribuable aux placements s’établit à ${formatMoney(summary.investmentGrowth)} sur la période.`
    );
  }

  parts.push(
    `La valeur du portefeuille s’établit à ${formatMoney(summary.currentPortfolioValue)} au ${periodEnd}.`
  );

  return parts.join(' ');
}

// Catégorie de revenu effective : la catégorie détectée, ou celle mappée par
// symbole (plein puis base « RY.TO » → « RY ») quand elle est « other ».
function resolveIncomeCategory(
  transaction: CroesusActivityTransaction,
  overrides: PortfolioActivityOverrides
): IncomeCategory {
  if (transaction.incomeCategory !== 'other') return transaction.incomeCategory;
  const symbolKey = transaction.symbol.trim().toUpperCase();
  const baseSymbolKey = symbolKey.split('.')[0];
  return overrides.incomeCategoriesBySymbol?.[symbolKey]
    ?? overrides.incomeCategoriesBySymbol?.[baseSymbolKey]
    ?? 'other';
}

// ── Comptes ───────────────────────────────────────────────────────────────
// Le vrai type de compte est le SUFFIXE du numéro (37-3B8V-W → W = CELI), pas le
// « Code CP » (souvent un code de foyer identique partout, ex. « SA1H »).
const ACCOUNT_SUFFIX_MAP: Record<string, string> = {
  ...ACCOUNT_TYPE_MAP,
  R: 'REER conjoint', // observé sur les cotisations-conjoint
  B: 'Devises',       // compte en devises (USD)
};

/** Libellé depuis un numéro de compte (37-3B8V-W → W → CELI). */
function accountLabelFromNumber(num: string): string | null {
  const suffix = (num.trim().split('-').pop() ?? '').toUpperCase();
  return suffix ? (ACCOUNT_SUFFIX_MAP[suffix] ?? null) : null;
}

/** Libellé de compte : suffixe du numéro d'abord, sinon le Code CP ; null si non mappé. */
export function accountLabelForTransaction(t: CroesusActivityTransaction): string | null {
  const byNumber = accountLabelFromNumber(t.accountNumber);
  if (byNumber) return byNumber;
  const code = t.accountCode.trim().toUpperCase();
  return code ? (ACCOUNT_TYPE_MAP[code] ?? ACCOUNT_TYPE_MAP[code[0]] ?? null) : null;
}

/** Compte d'une COTISATION = destination. Pour une jambe encaisse, la destination
 *  figure dans la note (« COTIS AU CELI 37-3B8V-W ») ; sinon le compte de la ligne. */
function contributionAccountLabel(t: CroesusActivityTransaction): string | null {
  const m = t.note.match(/(\d{2}-[A-Z0-9]+-[A-Z])\b/i);
  if (m) {
    const byNote = accountLabelFromNumber(m[1]);
    if (byNote) return byNote;
  }
  return accountLabelForTransaction(t);
}

/** Symbole de trésorerie (1CAD, 1USD…) ou vide — pas un vrai titre. */
function isCashSymbol(symbol: string): boolean {
  const s = symbol.trim();
  return s === '' || /^1[A-Z]{3}$/i.test(s);
}

/** Un apport en titres = une acquisition (la jambe négative décrit ce qui a été acquis). */
export interface ContributionSecurity {
  symbol: string;
  name: string;
  amountCad: number;
  quantity: number | null;
  date: string;
  accountLabel: string | null;
}

/** Événement daté de cotisation (jambe retenue) — pour la timeline. */
export interface ContributionEvent {
  date: string;
  amountCad: number;
  kind: 'cash' | 'security';
  accountLabel: string | null;
  symbol?: string;
  name?: string;
  quantity?: number | null;
}

export interface ContributionAnalysis {
  cash: number;        // cotisations EN ARGENT (jambes encaisse retenues)
  securities: number;  // cotisations EN TITRES
  total: number;       // cash + securities
  count: number;       // nombre de jambes retenues
  securityList: ContributionSecurity[];
  byAccount: { label: string; amountCad: number }[];
  events: ContributionEvent[]; // triés par date
  /** Jambes encaisse miroir écartées (= transferts EN NATURE comptés une seule fois).
   *  > 0 signale qu'une dédup a été appliquée — à rendre visible. */
  mirrorsDropped: number;
}

/**
 * Cotisations selon la partie double Croesus. On ne retient que les jambes
 * NÉGATIVES (celles qui décrivent l'apport réel), scindées en :
 *  - EN TITRES : jambe portant un vrai symbole + quantité (= une acquisition) ;
 *  - EN ARGENT : jambe encaisse « 1CAD » / « SOLDE DU COMPTE ».
 * Les jambes encaisse qui ne font que refléter un apport en titres (même jour +
 * même |montant|) sont écartées : un transfert en nature n'est PAS compté deux fois.
 */
export function analyzeContributions(
  txns: CroesusActivityTransaction[],
  toCad: (t: CroesusActivityTransaction, v: number) => number,
): ContributionAnalysis {
  const negs = txns.filter(
    t => normalizeText(t.type).includes('cotisation') && toCad(t, t.amount) < 0,
  );
  const secLegs = negs.filter(t => !isCashSymbol(t.symbol) && (t.quantity ?? 0) !== 0);
  const cashLegs = negs.filter(t => isCashSymbol(t.symbol) || (t.quantity ?? 0) === 0);

  // Dédup : jambe encaisse miroir d'un apport en titres (même jour + |montant| ≈).
  const survivingCash = cashLegs.filter(cl => {
    const amt = Math.abs(toCad(cl, cl.amount));
    return !secLegs.some(
      sl => sl.transactionDate === cl.transactionDate
        && Math.abs(Math.abs(toCad(sl, sl.amount)) - amt) < 0.5,
    );
  });

  const securityList: ContributionSecurity[] = secLegs.map(t => ({
    symbol: t.symbol.trim().toUpperCase(),
    name: t.name,
    amountCad: Math.abs(toCad(t, t.amount)),
    quantity: t.quantity != null ? Math.abs(t.quantity) : null,
    date: t.transactionDate,
    accountLabel: contributionAccountLabel(t),
  }));
  const securities = securityList.reduce((s, x) => s + x.amountCad, 0);
  const cash = survivingCash.reduce((s, t) => s + Math.abs(toCad(t, t.amount)), 0);

  const byAccountMap = new Map<string, number>();
  const add = (label: string | null, amt: number) => {
    const k = label ?? 'Autre compte';
    byAccountMap.set(k, (byAccountMap.get(k) ?? 0) + amt);
  };
  for (const t of survivingCash) add(contributionAccountLabel(t), Math.abs(toCad(t, t.amount)));
  for (const s of securityList) add(s.accountLabel, s.amountCad);

  const events: ContributionEvent[] = [
    ...survivingCash.map((t): ContributionEvent => ({
      date: t.transactionDate,
      amountCad: Math.abs(toCad(t, t.amount)),
      kind: 'cash',
      accountLabel: contributionAccountLabel(t),
    })),
    ...securityList.map((s): ContributionEvent => ({
      date: s.date,
      amountCad: s.amountCad,
      kind: 'security',
      accountLabel: s.accountLabel,
      symbol: s.symbol,
      name: s.name,
      quantity: s.quantity,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return {
    cash,
    securities,
    total: cash + securities,
    count: survivingCash.length + secLegs.length,
    securityList,
    byAccount: [...byAccountMap.entries()]
      .map(([label, amountCad]) => ({ label, amountCad }))
      .sort((a, b) => b.amountCad - a.amountCad),
    events,
    mirrorsDropped: cashLegs.length - survivingCash.length,
  };
}

export function buildPortfolioActivitySummary(
  transactions: CroesusActivityTransaction[],
  period: ActivityPeriod,
  overrides: PortfolioActivityOverrides,
  endDate = new Date()
): PortfolioActivitySummary {
  const { start, end } = getActivityWindow(period, endDate);

  // Montant ramené en CAD : les montants en USD sont convertis si un taux est
  // fourni ; les autres devises restent telles quelles (meilleur effort).
  const usdCadRate = overrides.usdCadRate;
  const toCad = (transaction: CroesusActivityTransaction): number =>
    usdCadRate && usdCadRate > 0 && transaction.currency.trim().toUpperCase() === 'USD'
      ? transaction.amount * usdCadRate
      : transaction.amount;
  const inWindow = transactions.filter(transaction => {
    const date = parseDate(transaction.transactionDate);
    return date != null && date >= start && date <= end;
  });
  const monthlyIncome = buildMonthBuckets(start, end);
  const monthMap = new Map(monthlyIncome.map(month => [month.key, month]));

  // Cotisations : partie double Croesus → analyseur partagé (mêmes règles que la
  // page Parcours : jambes négatives, argent + titres, dédup des miroirs).
  const contribAnalysis = analyzeContributions(
    inWindow,
    (t, v) => usdCadRate && usdCadRate > 0 && t.currency.trim().toUpperCase() === 'USD' ? v * usdCadRate : v,
  );

  let income = 0;
  let dividendIncome = 0;
  let fixedIncomeIncome = 0;
  let otherIncome = 0;
  let detectedContributions = 0;
  let detectedWithdrawals = 0;
  let incomeTransactionCount = 0;
  let ignoredTransactionCount = 0;
  let buyCount = 0;
  let sellCount = 0;
  let buyTotal = 0;
  let sellTotal = 0;
  const sourceMap = new Map<string, {
    symbol: string;
    name: string;
    amount: number;
    byCategory: Record<IncomeCategory, number>;
  }>();

  for (const transaction of inWindow) {
    // Cotisations traitées par contribAnalysis — hors de cette boucle (sinon les
    // jambes négatives gonflaient les retraits et les positives les cotisations).
    if (normalizeText(transaction.type).includes('cotisation')) continue;
    const absoluteAmount = Math.abs(toCad(transaction));
    if (transaction.category === 'income') {
      income += absoluteAmount;
      incomeTransactionCount += 1;

      const incomeCategory = resolveIncomeCategory(transaction, overrides);
      if (incomeCategory === 'dividend') dividendIncome += absoluteAmount;
      else if (incomeCategory === 'fixed_income') fixedIncomeIncome += absoluteAmount;
      else otherIncome += absoluteAmount;

      const key = monthKey(new Date(`${transaction.transactionDate}T12:00:00`));
      const month = monthMap.get(key);
      if (month) {
        month.income += absoluteAmount;
        if (incomeCategory === 'dividend') month.dividends += absoluteAmount;
        else if (incomeCategory === 'fixed_income') month.fixedIncome += absoluteAmount;
        else month.otherIncome += absoluteAmount;
        month.transactionCount += 1;
      }

      // Clé normalisée (majuscules, sans espaces) pour éviter les doublons de
      // source (« bns.to » vs « BNS.TO »).
      const sourceKey = transaction.symbol.trim().toUpperCase()
        || transaction.name.trim().toUpperCase() || 'AUTRE';
      const current = sourceMap.get(sourceKey) ?? {
        symbol: transaction.symbol || 'AUTRE',
        name: transaction.name || transaction.symbol || 'Autre',
        amount: 0,
        byCategory: { dividend: 0, fixed_income: 0, other: 0 },
      };
      current.amount += absoluteAmount;
      current.byCategory[incomeCategory] += absoluteAmount;
      sourceMap.set(sourceKey, current);
    } else if (transaction.category === 'contribution') {
      detectedContributions += absoluteAmount;
    } else if (transaction.category === 'withdrawal') {
      detectedWithdrawals += absoluteAmount;
    } else {
      ignoredTransactionCount += 1;
      // Sous-comptes achats/ventes (toujours ⊂ ignoredTransactionCount : la note
      // méthodologique de la page Activité reste vraie mot pour mot).
      if (transaction.tradeKind === 'buy') {
        buyCount += 1;
        buyTotal += absoluteAmount;
      } else if (transaction.tradeKind === 'sell') {
        sellCount += 1;
        sellTotal += absoluteAmount;
      }
    }
  }

  detectedContributions = contribAnalysis.total; // partie double : jambes négatives (argent + titres)
  const contributions = overrides.contributions ?? detectedContributions;
  const withdrawals = overrides.withdrawals ?? detectedWithdrawals;
  const netContributions = contributions - withdrawals;
  const topIncomeSources: PortfolioIncomeSource[] = Array.from(sourceMap.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map(({ byCategory, ...source }) => ({
      ...source,
      pct: income > 0 ? (source.amount / income) * 100 : 0,
      // Nature dominante ; départage stable dividende > revenu fixe > autre.
      category: (['dividend', 'fixed_income', 'other'] as const).reduce(
        (best, candidate) => (byCategory[candidate] > byCategory[best] ? candidate : best),
        'dividend' as IncomeCategory
      ),
    }));

  const annualMap = new Map<number, number>();
  for (const transaction of transactions) {
    if (transaction.category !== 'income') continue;
    const date = parseDate(transaction.transactionDate);
    if (!date) continue;
    annualMap.set(date.getFullYear(), (annualMap.get(date.getFullYear()) ?? 0) + Math.abs(toCad(transaction)));
  }
  const annualIncome = Array.from(annualMap.entries())
    .map(([year, amount]) => ({ year, amount }))
    .sort((a, b) => a.year - b.year)
    .slice(-3);

  // Revenus mensuels de l'ANNÉE CIVILE en cours (Jan→Déc), toutes transactions
  // confondues — indépendant de la période choisie. Garantit un « encaissé à
  // date » complet sur la couverture, cohérent avec la progression annuelle.
  const currentYear = end.getFullYear();
  const currentYearMonthlyIncome = buildMonthBuckets(
    new Date(currentYear, 0, 1),
    new Date(currentYear, 11, 1)
  );
  const currentYearMap = new Map(currentYearMonthlyIncome.map(month => [month.key, month]));
  for (const transaction of transactions) {
    if (transaction.category !== 'income') continue;
    const date = parseDate(transaction.transactionDate);
    if (!date || date.getFullYear() !== currentYear) continue;
    const amount = Math.abs(toCad(transaction));
    const incomeCategory = resolveIncomeCategory(transaction, overrides);
    const month = currentYearMap.get(monthKey(date));
    if (!month) continue;
    month.income += amount;
    if (incomeCategory === 'dividend') month.dividends += amount;
    else if (incomeCategory === 'fixed_income') month.fixedIncome += amount;
    else month.otherIncome += amount;
    month.transactionCount += 1;
  }

  const startingPortfolioValue = overrides.startingPortfolioValue;
  const investmentGrowth = startingPortfolioValue != null
    ? overrides.currentPortfolioValue - startingPortfolioValue - netContributions - income
    : undefined;
  const totalValueChange = startingPortfolioValue != null
    ? overrides.currentPortfolioValue - startingPortfolioValue
    : undefined;

  const periodLabel = period === 'year_to_date'
    ? `Depuis le 1er janvier ${end.getFullYear()}`
    : period === 'six_months'
      ? '6 derniers mois'
      : '12 derniers mois';
  const title = period === 'year_to_date'
    ? `BILAN ${end.getFullYear()}`
    : period === 'six_months'
      ? 'BILAN - 6 MOIS'
      : 'BILAN - 12 MOIS';

  const withoutNarrative: Omit<PortfolioActivitySummary, 'narrative'> = {
    period,
    periodLabel,
    title,
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
    transactionCount: inWindow.length,
    ignoredTransactionCount,
    incomeTransactionCount,
    income,
    dividendIncome,
    fixedIncomeIncome,
    otherIncome,
    contributions,
    withdrawals,
    netContributions,
    averageMonthlyIncome: monthlyIncome.length > 0 ? income / monthlyIncome.length : 0,
    monthlyIncome,
    currentYear,
    currentYearMonthlyIncome,
    topIncomeSources,
    annualIncome,
    currentPortfolioValue: overrides.currentPortfolioValue,
    startingPortfolioValue,
    investmentGrowth,
    totalValueChange,
    buyCount,
    sellCount,
    buyTotal,
    sellTotal,
  };

  return {
    ...withoutNarrative,
    narrative: buildNarrative(withoutNarrative),
  };
}
