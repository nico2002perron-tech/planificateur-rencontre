/**
 * Évolution d'un client entre les rencontres de cours-cibles.
 *
 * Fonctions PURES (aucun accès réseau, aucun accès au coffre) : à partir des
 * captures passées d'un client (`price_target_snapshots`, regroupées par
 * `name_idx`) et de son portefeuille actuel, on calcule ce qui a changé depuis
 * la DERNIÈRE rencontre — titres conservés, vendus, nouveaux — plus une frise
 * des rencontres. Le résultat alimente la bannière UI et le récapitulatif PDF.
 *
 * Ne manipule jamais les noms de clients (chiffrés) : uniquement symboles/prix.
 */

/** Capture brute telle que renvoyée par GET /api/price-target-snapshots. */
export interface SnapshotRow {
  symbol: string;
  name: string;
  quantity: number | null;
  current_price: number | null;
  target_price: number | null;
  expected_gain_pct: number | null;
  predicted_at: string; // YYYY-MM-DD
  peak_price: number | null;
  trough_price: number | null;
}

/** Position actuelle, prix déjà normalisés en CAD (depuis targetData). */
export interface CurrentHolding {
  symbol: string;
  name: string;
  qty: number;
  currentPrice: number; // CAD
  targetPrice: number;  // CAD (0 si aucune cible)
}

/** Prix live natif (devise Yahoo) pour un titre vendu. */
export interface LivePrice {
  price: number;
  currency: string;
}

export interface TimelineEntry {
  date: string;      // YYYY-MM-DD
  positions: number; // nb de titres à cette rencontre
}

export interface HeldRow {
  symbol: string;
  name: string;
  prevTarget: number | null;
  newTarget: number | null;
  targetDeltaPct: number | null;
  prevPrice: number | null;
  price: number | null;       // prix actuel CAD
  sinceMeetingPct: number | null;
  prevQty: number;
  qty: number;
}

export interface ExitedRow {
  symbol: string;
  name: string;
  prevQty: number;
  prevPrice: number | null;   // prix d'alors (CAD)
  price: number | null;       // prix actuel CAD (live)
  sinceMeetingPct: number | null;
  prevTarget: number | null;
  reachedPrevTarget: boolean | null; // la cible d'alors a-t-elle été touchée
}

export interface AddedRow {
  symbol: string;
  name: string;
  target: number | null;
}

export interface MeetingEvolution {
  lastMeetingDate: string;
  meetingCount: number;       // nb de rencontres antérieures distinctes
  timeline: TimelineEntry[];  // rencontres passées, plus récente d'abord
  held: HeldRow[];
  exited: ExitedRow[];
  added: AddedRow[];
}

function num(v: number | null | undefined): number | null {
  return v != null && Number.isFinite(v) ? v : null;
}

/** Convertit un prix live natif en CAD (USD → CAD si un taux est fourni). */
function toCad(live: LivePrice | undefined, usdCadRate: number | null): number | null {
  if (!live || !(live.price > 0)) return null;
  const rate = live.currency === 'USD' && usdCadRate ? usdCadRate : 1;
  return Math.round(live.price * rate * 100) / 100;
}

function pctChange(from: number | null, to: number | null): number | null {
  if (from == null || to == null || from === 0) return null;
  return ((to - from) / from) * 100;
}

/**
 * Regroupe les captures par date de rencontre (predicted_at), la plus récente
 * d'abord. Chaque rencontre = la liste de ses lignes.
 */
export function groupMeetings(snapshots: SnapshotRow[]): { date: string; rows: SnapshotRow[] }[] {
  const byDate = new Map<string, SnapshotRow[]>();
  for (const s of snapshots) {
    if (!s.predicted_at) continue;
    if (!byDate.has(s.predicted_at)) byDate.set(s.predicted_at, []);
    byDate.get(s.predicted_at)!.push(s);
  }
  return Array.from(byDate.entries())
    .map(([date, rows]) => ({ date, rows }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** La cible d'alors a-t-elle été touchée, selon le sens (haussier/baissier) ? */
function reachedTarget(row: SnapshotRow): boolean | null {
  const target = num(row.target_price);
  if (target == null) return null;
  const entry = num(row.current_price);
  const bullish = entry != null ? target >= entry : (row.expected_gain_pct == null || row.expected_gain_pct >= 0);
  if (bullish) {
    const peak = num(row.peak_price);
    return peak == null ? null : peak >= target;
  }
  const trough = num(row.trough_price);
  return trough == null ? null : trough <= target;
}

/**
 * Compare le portefeuille actuel à la dernière rencontre antérieure à `today`.
 * Retourne null s'il n'existe aucune rencontre antérieure (→ comportement actuel,
 * aucun récapitulatif).
 */
export function buildEvolution(params: {
  currentHoldings: CurrentHolding[];
  priorSnapshots: SnapshotRow[];
  priceOf: (symbol: string) => LivePrice | undefined;
  usdCadRate: number | null;
  today: string; // YYYY-MM-DD
}): MeetingEvolution | null {
  const { currentHoldings, priorSnapshots, priceOf, usdCadRate, today } = params;

  // On ne compare qu'aux rencontres STRICTEMENT antérieures à aujourd'hui : une
  // re-génération le même jour (dédup même-jour) ne compte pas comme « rencontre
  // précédente ».
  const meetings = groupMeetings(priorSnapshots).filter((m) => m.date < today);
  if (meetings.length === 0) return null;

  const last = meetings[0];
  // Une ligne par symbole pour la dernière rencontre (au cas où doublons).
  const prevBySymbol = new Map<string, SnapshotRow>();
  for (const r of last.rows) {
    if (!prevBySymbol.has(r.symbol)) prevBySymbol.set(r.symbol, r);
  }

  const currentBySymbol = new Map<string, CurrentHolding>();
  for (const h of currentHoldings) {
    if (!currentBySymbol.has(h.symbol)) currentBySymbol.set(h.symbol, h);
  }

  const held: HeldRow[] = [];
  const added: AddedRow[] = [];
  const exited: ExitedRow[] = [];

  for (const [symbol, cur] of currentBySymbol) {
    const prev = prevBySymbol.get(symbol);
    if (prev) {
      const prevTarget = num(prev.target_price);
      const newTarget = cur.targetPrice > 0 ? cur.targetPrice : null;
      const prevPrice = num(prev.current_price);
      const price = cur.currentPrice > 0 ? cur.currentPrice : null;
      held.push({
        symbol,
        name: cur.name || prev.name,
        prevTarget,
        newTarget,
        targetDeltaPct: pctChange(prevTarget, newTarget),
        prevPrice,
        price,
        sinceMeetingPct: pctChange(prevPrice, price),
        prevQty: num(prev.quantity) ?? 0,
        qty: cur.qty,
      });
    } else {
      added.push({ symbol, name: cur.name, target: cur.targetPrice > 0 ? cur.targetPrice : null });
    }
  }

  for (const [symbol, prev] of prevBySymbol) {
    if (currentBySymbol.has(symbol)) continue;
    const prevPrice = num(prev.current_price);
    const price = toCad(priceOf(symbol), usdCadRate);
    exited.push({
      symbol,
      name: prev.name,
      prevQty: num(prev.quantity) ?? 0,
      prevPrice,
      price,
      sinceMeetingPct: pctChange(prevPrice, price),
      prevTarget: num(prev.target_price),
      reachedPrevTarget: reachedTarget(prev),
    });
  }

  // Tri : plus gros mouvements / changements d'abord.
  held.sort((a, b) => Math.abs(b.targetDeltaPct ?? 0) - Math.abs(a.targetDeltaPct ?? 0));
  exited.sort((a, b) => (b.sinceMeetingPct ?? -Infinity) - (a.sinceMeetingPct ?? -Infinity));
  added.sort((a, b) => a.symbol.localeCompare(b.symbol));

  return {
    lastMeetingDate: last.date,
    meetingCount: meetings.length,
    timeline: meetings.map((m) => ({ date: m.date, positions: new Set(m.rows.map((r) => r.symbol)).size })),
    held,
    exited,
    added,
  };
}
