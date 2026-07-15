'use client';

import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCopy,
  ClipboardPaste,
  Eraser,
  Mail,
  Paintbrush,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { formatNumber } from '@/lib/utils/format';

const COLUMNS = [
  { key: 'accountNumber', label: 'No de compte' },
  { key: 'name', label: 'Nom' },
  { key: 'note', label: 'Note' },
  { key: 'processingDate', label: 'Traitement' },
  { key: 'transactionDate', label: 'Transaction' },
  { key: 'type', label: 'Type' },
  { key: 'symbol', label: 'Symbole' },
  { key: 'quantity', label: 'Quantité' },
  { key: 'currency', label: 'Devise' },
  { key: 'totalLabel', label: 'Total' },
  { key: 'balance', label: 'Solde' },
] as const;

const FALLBACK_HEADERS = [
  'No de compte',
  'Nom',
  'Note',
  'Traitement',
  'Transaction',
  'Code de CP',
  'Type',
  'Symbole',
  'Quantité',
  'Prix',
  'Devise',
  'Total',
  'Commission',
  'Gains/Pertes',
  'Int. courus',
  'Frais',
  'PBR manuel',
  'Solde',
];

const LEGACY_FALLBACK_HEADERS = FALLBACK_HEADERS.filter((header) => header !== 'Note');
const RECIPIENTS_STORAGE_KEY = 'transactions-du-jour:recipients';

type CellValue = string | number | boolean | Date | null | undefined;
type RawRow = Record<string, CellValue>;
type IncludedType = 'Dépôt' | 'Transfert' | 'Remboursement';
type CopyMode = 'none' | 'plain' | 'rich';

type TransactionRow = {
  id: string;
  accountNumber: string;
  name: string;
  note: string;
  processingDate: string;
  transactionDate: string;
  type: IncludedType;
  symbol: string;
  quantity: string;
  currency: string;
  total: number;
  totalLabel: string;
  balance: string;
  inclusionReason: string;
};

const todayLabel = new Intl.DateTimeFormat('fr-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getCell(row: RawRow, labels: string[]) {
  const wanted = labels.map(normalizeText);
  const key = Object.keys(row).find((header) => wanted.includes(normalizeText(header)));
  return key ? row[key] : '';
}

function hasColumn(rows: RawRow[], label: string) {
  return rows.some((row) => Object.keys(row).some((header) => normalizeText(header) === normalizeText(label)));
}

function cleanCell(value: string) {
  const trimmed = value.replace(/^\uFEFF/, '').trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/""/g, '"');
  }
  return trimmed;
}

function detectDelimiter(text: string) {
  const sample = text.split(/\r?\n/).slice(0, 5).join('\n');
  const tabs = (sample.match(/\t/g) ?? []).length;
  const semicolons = (sample.match(/;/g) ?? []).length;
  return tabs >= semicolons ? '\t' : ';';
}

function splitCells(line: string, delimiter: string) {
  return line.split(delimiter).map(cleanCell);
}

function firstRowHasHeaders(cells: string[]) {
  const headers = cells.map(normalizeText);
  return headers.includes('type') && headers.includes('total');
}

function parsePastedRows(text: string) {
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalizedText) return [];

  const delimiter = detectDelimiter(normalizedText);
  const lines = normalizedText
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => splitCells(line, delimiter));

  if (lines.length === 0) return [];

  const hasHeaders = firstRowHasHeaders(lines[0]);
  const fallbackHeaders = lines[0].length === LEGACY_FALLBACK_HEADERS.length ? LEGACY_FALLBACK_HEADERS : FALLBACK_HEADERS;
  const headers = hasHeaders ? lines[0] : fallbackHeaders;
  const dataLines = hasHeaders ? lines.slice(1) : lines;

  if (!hasHeaders && lines[0].length < 11) {
    throw new Error('Impossible d’identifier les colonnes Type et Total. Collez la ligne d’en-têtes ou les colonnes dans l’ordre du modèle.');
  }

  const rows = dataLines.map((cells) => {
    const row: RawRow = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? '';
    });
    return row;
  });

  if (rows.length > 0 && (!hasColumn(rows, 'Type') || !hasColumn(rows, 'Total'))) {
    throw new Error('Les colonnes Type et Total sont requises pour appliquer les restrictions.');
  }

  return rows;
}

function parseAmount(value: CellValue) {
  if (typeof value === 'number') return value;

  let text = String(value ?? '').trim();
  if (!text) return Number.NaN;

  const isParenthesesNegative = /^\(.*\)$/.test(text);
  text = text
    .replace(/\u00a0/g, ' ')
    .replace(/\s/g, '')
    .replace(/[$]/g, '')
    .replace(/[^0-9,.-]/g, '');

  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');

  if (lastComma !== -1 && lastDot !== -1) {
    text = lastComma > lastDot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  } else if (lastComma !== -1) {
    text = text.replace(',', '.');
  }

  const amount = Number.parseFloat(text);
  if (!Number.isFinite(amount)) return Number.NaN;
  return isParenthesesNegative ? -Math.abs(amount) : amount;
}

function formatMoney(value: number, currency: string) {
  if (!Number.isFinite(value)) return '';

  try {
    return new Intl.NumberFormat('fr-CA', {
      style: 'currency',
      currency: currency || 'CAD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${formatNumber(value, 2)} ${currency || '$'}`;
  }
}

function excelSerialToDate(value: number) {
  if (value < 20000 || value > 60000) return null;
  const utcDays = Math.floor(value - 25569);
  const date = new Date(utcDays * 86400 * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateCell(value: CellValue) {
  if (value instanceof Date) {
    return new Intl.DateTimeFormat('fr-CA').format(value);
  }

  if (typeof value === 'number') {
    const date = excelSerialToDate(value);
    if (date) return new Intl.DateTimeFormat('fr-CA').format(date);
  }

  return formatCell(value);
}

function formatCell(value: CellValue) {
  if (value == null) return '';
  if (value instanceof Date) return new Intl.DateTimeFormat('fr-CA').format(value);
  if (typeof value === 'number') return formatNumber(value, Math.abs(value % 1) > 0 ? 2 : 0);
  return String(value).trim();
}

function transformRow(row: RawRow, index: number): TransactionRow | null {
  const rawType = formatCell(getCell(row, ['Type']));
  const normalizedType = normalizeText(rawType);
  const note = formatCell(getCell(row, ['Note', 'Notes']));
  const normalizedNote = normalizeText(note);
  const total = parseAmount(getCell(row, ['Total']));
  const currency = formatCell(getCell(row, ['Devise'])) || 'CAD';
  const isLargeTransfer = Math.abs(total) > 1000;
  const isRetirementPayment = normalizedNote.includes('paiement retraite');

  let type: IncludedType | null = null;
  let inclusionReason = '';

  if (normalizedType.includes('depot') && total > 1000) {
    type = 'Dépôt';
    inclusionReason = 'Dépôt supérieur à 1 000 $';
  } else if (normalizedType.includes('transfert') && !isRetirementPayment && (total > 0 || isLargeTransfer)) {
    type = 'Transfert';
    inclusionReason = total > 0 ? 'Transfert positif' : 'Transfert de plus de 1 000 $';
  } else if (normalizedType.includes('remboursement')) {
    type = 'Remboursement';
    inclusionReason = 'Remboursement';
  }

  if (!type) return null;

  return {
    id: `${index}-${formatCell(getCell(row, ['No de compte']))}-${formatCell(getCell(row, ['Total']))}`,
    accountNumber: formatCell(getCell(row, ['No de compte', 'N° de compte', 'Numero de compte', 'Numéro de compte'])),
    name: formatCell(getCell(row, ['Nom'])),
    note,
    processingDate: formatDateCell(getCell(row, ['Traitement'])),
    transactionDate: formatDateCell(getCell(row, ['Transaction'])),
    type,
    symbol: formatCell(getCell(row, ['Symbole'])),
    quantity: formatCell(getCell(row, ['Quantité', 'Quantite'])),
    currency,
    total,
    totalLabel: formatMoney(total, currency),
    balance: formatCell(getCell(row, ['Solde'])),
    inclusionReason,
  };
}

function buildEmailBody(rows: TransactionRow[]) {
  const headers = [...COLUMNS.map((column) => column.label), 'Critère'];
  const lines = rows.map((row) => [
    row.accountNumber,
    row.name,
    row.note,
    row.processingDate,
    row.transactionDate,
    row.type,
    row.symbol,
    row.quantity,
    row.currency,
    row.totalLabel,
    row.balance,
    row.inclusionReason,
  ].join(' | '));

  return [
    'Bonjour,',
    '',
    `Voici les transactions du jour (${todayLabel}) qui respectent les critères convenus.`,
    '',
    headers.join(' | '),
    ...lines,
    '',
    'Critères appliqués : dépôt > 1 000 $, transfert positif ou transfert de plus de 1 000 $, remboursement. Les transferts avec la note Paiement Retraite sont exclus.',
    '',
    'Merci.',
  ].join('\n');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getTypeStyle(type: IncludedType) {
  if (type === 'Dépôt') return { bg: '#e0f2fe', color: '#0369a1', border: '#7dd3fc' };
  if (type === 'Transfert') return { bg: '#fef3c7', color: '#92400e', border: '#fbbf24' };
  return { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' };
}

function buildEmailHtml(rows: TransactionRow[], sourceRowCount: number, netAmount: number) {
  const included = rows.length;
  const excluded = Math.max(sourceRowCount - included, 0);
  const bodyRows = rows.map((row, index) => {
    const typeStyle = getTypeStyle(row.type);
    const totalColor = row.total >= 0 ? '#047857' : '#dc2626';
    const background = index % 2 === 0 ? '#ffffff' : '#f8fafc';

    return `
      <tr style="background:${background};">
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-weight:700;color:#0f172a;white-space:nowrap;">${escapeHtml(row.accountNumber)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#0f172a;">${escapeHtml(row.name)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#475569;font-size:12px;min-width:140px;">${escapeHtml(row.note || '-')}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#334155;white-space:nowrap;">${escapeHtml(row.processingDate)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#334155;white-space:nowrap;">${escapeHtml(row.transactionDate)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;white-space:nowrap;"><span style="display:inline-block;border:1px solid ${typeStyle.border};background:${typeStyle.bg};color:${typeStyle.color};border-radius:999px;padding:4px 9px;font-size:12px;font-weight:700;">${escapeHtml(row.type)}</span></td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#334155;text-align:center;white-space:nowrap;">${escapeHtml(row.symbol || '-')}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#334155;text-align:right;white-space:nowrap;">${escapeHtml(row.quantity || '-')}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#334155;text-align:center;white-space:nowrap;">${escapeHtml(row.currency)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:${totalColor};text-align:right;font-weight:800;white-space:nowrap;">${escapeHtml(row.totalLabel || '-')}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#334155;text-align:right;white-space:nowrap;">${escapeHtml(row.balance || '-')}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#475569;font-size:12px;">${escapeHtml(row.inclusionReason)}</td>
      </tr>`;
  }).join('');

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.45;">
      <p style="margin:0 0 12px;">Bonjour,</p>
      <p style="margin:0 0 16px;">Voici les transactions du jour (${escapeHtml(todayLabel)}) qui respectent les critères convenus.</p>

      <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 16px;width:100%;max-width:760px;">
        <tr>
          <td style="background:#e0f2fe;border:1px solid #bae6fd;border-radius:8px;padding:10px 12px;width:33%;">
            <div style="font-size:11px;font-weight:700;color:#0369a1;text-transform:uppercase;letter-spacing:.04em;">Gardées</div>
            <div style="font-size:24px;font-weight:800;color:#0f172a;">${included}</div>
          </td>
          <td style="width:10px;"></td>
          <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;width:33%;">
            <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em;">Exclues</div>
            <div style="font-size:24px;font-weight:800;color:#0f172a;">${excluded}</div>
          </td>
          <td style="width:10px;"></td>
          <td style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:8px;padding:10px 12px;width:33%;">
            <div style="font-size:11px;font-weight:700;color:#047857;text-transform:uppercase;letter-spacing:.04em;">Total net</div>
            <div style="font-size:20px;font-weight:800;color:#0f172a;">${escapeHtml(formatMoney(netAmount, 'CAD'))}</div>
          </td>
        </tr>
      </table>

      <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;font-size:13px;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#03045e;color:#ffffff;">
            ${[...COLUMNS.map((column) => column.label), 'Critère'].map((label) => `<th style="padding:11px 12px;text-align:left;border-bottom:1px solid #03045e;font-size:11px;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;">${escapeHtml(label)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>

      <p style="margin:14px 0 0;font-size:12px;color:#475569;">
        Critères appliqués : dépôt &gt; 1 000 $, transfert positif ou transfert de plus de 1 000 $, remboursement. Les transferts avec la note Paiement Retraite sont exclus.
      </p>
      <p style="margin:16px 0 0;">Merci.</p>
    </div>`;
}

function normalizeRecipients(value: string) {
  return value
    .split(/[;,]/)
    .map((recipient) => recipient.trim())
    .filter(Boolean)
    .join(',');
}

export default function TransactionsDuJourPage() {
  const [pastedText, setPastedText] = useState('');
  const [recipients, setRecipients] = useState('');
  const [savedRecipients, setSavedRecipients] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [sourceRowCount, setSourceRowCount] = useState(0);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<CopyMode>('none');

  const totalIncluded = transactions.length;
  const totalExcluded = Math.max(sourceRowCount - totalIncluded, 0);
  const netAmount = useMemo(
    () => transactions.reduce((sum, row) => sum + (Number.isFinite(row.total) ? row.total : 0), 0),
    [transactions]
  );
  const emailBody = useMemo(() => buildEmailBody(transactions), [transactions]);
  const emailHtml = useMemo(
    () => buildEmailHtml(transactions, sourceRowCount, netAmount),
    [netAmount, sourceRowCount, transactions]
  );
  const mailtoLength = useMemo(() => {
    const to = normalizeRecipients(recipients);
    return `mailto:${to}?subject=${encodeURIComponent(`Transactions du jour - ${todayLabel}`)}&body=${encodeURIComponent(emailBody)}`.length;
  }, [emailBody, recipients]);

  useEffect(() => {
    const storedRecipients = window.localStorage.getItem(RECIPIENTS_STORAGE_KEY) ?? '';
    setSavedRecipients(storedRecipients);
    setRecipients(storedRecipients);
  }, []);

  function parseTransactions(text: string) {
    setPastedText(text);
    setCopied('none');

    if (!text.trim()) {
      setError('');
      setSourceRowCount(0);
      setTransactions([]);
      return;
    }

    try {
      const rows = parsePastedRows(text);
      setSourceRowCount(rows.length);
      setTransactions(rows.map(transformRow).filter((row): row is TransactionRow => row !== null));
      setError('');
    } catch (err) {
      setSourceRowCount(0);
      setTransactions([]);
      setError(err instanceof Error ? err.message : 'Impossible de lire les cellules collées.');
    }
  }

  function handlePasteChange(event: ChangeEvent<HTMLTextAreaElement>) {
    parseTransactions(event.target.value);
  }

  function saveRecipients() {
    const normalized = normalizeRecipients(recipients);
    window.localStorage.setItem(RECIPIENTS_STORAGE_KEY, normalized);
    setRecipients(normalized);
    setSavedRecipients(normalized);
    setSaveStatus(normalized ? 'Courriel sauvegardé' : 'Destinataires effacés');
    window.setTimeout(() => setSaveStatus(''), 2500);
  }

  function clearPaste() {
    setPastedText('');
    setSourceRowCount(0);
    setTransactions([]);
    setError('');
    setCopied('none');
  }

  function openOutlookDraft(withBody = true) {
    const to = normalizeRecipients(recipients);
    const subject = encodeURIComponent(`Transactions du jour - ${todayLabel}`);
    const body = withBody ? `&body=${encodeURIComponent(emailBody)}` : '';
    window.location.href = `mailto:${to}?subject=${subject}${body}`;
  }

  async function copyRichEmail() {
    if (transactions.length === 0) return;

    if ('ClipboardItem' in window && navigator.clipboard.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([emailHtml], { type: 'text/html' }),
          'text/plain': new Blob([emailBody], { type: 'text/plain' }),
        }),
      ]);
    } else {
      await navigator.clipboard.writeText(emailBody);
    }

    setCopied('rich');
    window.setTimeout(() => setCopied('none'), 3000);
  }

  async function exportToOutlook() {
    if (transactions.length === 0) return;
    await copyRichEmail();
    openOutlookDraft(false);
  }

  async function copyPlainEmail() {
    if (transactions.length === 0) return;
    await navigator.clipboard.writeText(emailBody);
    setCopied('plain');
    window.setTimeout(() => setCopied('none'), 2500);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-primary/20 bg-brand-primary/10 px-3 py-1 text-xs font-bold text-brand-accent">
            <ShieldCheck className="h-3.5 w-3.5" />
            Traitement local seulement
          </div>
          <h1 className="text-3xl font-extrabold text-text-main">Transactions du jour</h1>
          <p className="mt-2 max-w-2xl text-sm text-text-muted">
            Collage Excel, tri automatique des transactions essentielles, puis export Outlook avec un tableau couleur prêt à coller.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] bg-white px-4 py-3 shadow-[var(--shadow-card)]">
          <span className="text-xs font-bold uppercase text-text-light">Règles</span>
          <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">Dépôt &gt; 1 000 $</span>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Transfert positif ou &gt; 1 000 $</span>
          <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">Sauf Paiement Retraite</span>
          <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">Remboursement</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-[var(--radius-card)] bg-white p-6 shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
                  <ClipboardPaste className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-text-main">Cellules Excel</h2>
                  <p className="mt-1 text-sm text-text-muted">
                    {sourceRowCount > 0 ? `${sourceRowCount} ligne(s) analysée(s)` : 'Collez les cellules copiées depuis Excel'}
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                icon={<Eraser className="h-4 w-4" />}
                disabled={!pastedText}
                onClick={clearPaste}
              >
                Effacer
              </Button>
            </div>

            <textarea
              value={pastedText}
              onChange={handlePasteChange}
              placeholder="No de compte&#9;Nom&#9;Note&#9;Traitement&#9;Transaction&#9;Code de CP&#9;Type&#9;Symbole&#9;Quantité&#9;Prix&#9;Devise&#9;Total..."
              spellCheck={false}
              className="min-h-[190px] w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-xs leading-5 text-text-main outline-none transition placeholder:text-text-light focus:border-brand-primary focus:bg-white focus:ring-2 focus:ring-brand-primary/10"
            />
          </div>

          {error && (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </section>

        <section className="rounded-[var(--radius-card)] bg-white p-6 shadow-[var(--shadow-card)]">
          <h2 className="text-lg font-bold text-text-main">Courriel Outlook</h2>
          <label className="mt-4 block text-xs font-bold uppercase text-text-light" htmlFor="recipients">
            Destinataires
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="recipients"
              value={recipients}
              onChange={(event) => {
                setRecipients(event.target.value);
                setSaveStatus('');
              }}
              placeholder="nom@domaine.com; autre@domaine.com"
              className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-text-main outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
            />
            <Button
              type="button"
              variant={recipients === savedRecipients ? 'ghost' : 'outline'}
              icon={saveStatus ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              onClick={saveRecipients}
              className="shrink-0"
            >
              Sauver
            </Button>
          </div>

          {(saveStatus || savedRecipients) && (
            <div className="mt-2 text-xs font-medium text-text-muted">
              {saveStatus || `Sauvegardé : ${savedRecipients}`}
            </div>
          )}

          <div className="mt-3 rounded-xl bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800">
            Le bouton couleur copie le courriel complet. Dans Outlook, cliquez dans le corps du message puis collez.
          </div>

          {mailtoLength > 1800 && transactions.length > 0 && (
            <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              Le courriel texte est long. Le mode couleur par copier-coller est recommandé.
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 gap-2">
            <Button
              icon={copied === 'rich' ? <CheckCircle2 className="h-4 w-4" /> : <Paintbrush className="h-4 w-4" />}
              disabled={transactions.length === 0}
              onClick={exportToOutlook}
              className="w-full"
            >
              {copied === 'rich' ? 'Tableau copié' : 'Exporter couleur vers Outlook'}
            </Button>
            <Button
              variant="outline"
              icon={<Mail className="h-4 w-4" />}
              disabled={transactions.length === 0}
              onClick={() => openOutlookDraft(true)}
              className="w-full"
            >
              Ouvrir en texte simple
            </Button>
            <Button
              variant="ghost"
              icon={copied === 'plain' ? <CheckCircle2 className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
              disabled={transactions.length === 0}
              onClick={copyPlainEmail}
              className="w-full"
            >
              {copied === 'plain' ? 'Texte copié' : 'Copier le texte'}
            </Button>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
          <p className="text-xs font-bold uppercase text-text-light">Transactions gardées</p>
          <p className="mt-2 text-3xl font-extrabold text-text-main">{totalIncluded}</p>
        </div>
        <div className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
          <p className="text-xs font-bold uppercase text-text-light">Transactions exclues</p>
          <p className="mt-2 text-3xl font-extrabold text-text-main">{totalExcluded}</p>
        </div>
        <div className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
          <p className="text-xs font-bold uppercase text-text-light">Total net retenu</p>
          <p className="mt-2 text-3xl font-extrabold text-text-main">{formatMoney(netAmount, 'CAD')}</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-2 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-text-main">Tableau filtré</h2>
            <p className="text-sm text-text-muted">
              {transactions.length > 0 ? `${transactions.length} ligne(s) prêtes pour le courriel.` : 'Collez des cellules Excel pour afficher les résultats.'}
            </p>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {COLUMNS.map((column) => (
                <TableHead key={column.key}>{column.label}</TableHead>
              ))}
              <TableHead>Critère</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNS.length + 1} className="py-12 text-center text-text-muted">
                  Aucune transaction à afficher.
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-semibold">{row.accountNumber}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="max-w-[240px] text-xs text-text-muted">{row.note || '-'}</TableCell>
                  <TableCell>{row.processingDate}</TableCell>
                  <TableCell>{row.transactionDate}</TableCell>
                  <TableCell>
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 data-[type=depot]:bg-sky-50 data-[type=depot]:text-sky-700 data-[type=remboursement]:bg-violet-50 data-[type=remboursement]:text-violet-700" data-type={row.type === 'Dépôt' ? 'depot' : row.type === 'Remboursement' ? 'remboursement' : 'transfert'}>
                      {row.type}
                    </span>
                  </TableCell>
                  <TableCell>{row.symbol || '-'}</TableCell>
                  <TableCell>{row.quantity || '-'}</TableCell>
                  <TableCell>{row.currency}</TableCell>
                  <TableCell className={row.total >= 0 ? 'font-bold text-emerald-700' : 'font-bold text-red-600'}>
                    {row.totalLabel || '-'}
                  </TableCell>
                  <TableCell>{row.balance || '-'}</TableCell>
                  <TableCell className="text-xs font-semibold text-text-muted">{row.inclusionReason}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}