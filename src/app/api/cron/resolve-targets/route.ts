import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getYahooDailyHistory, getUsdCadRate, type YahooDailyPoint } from '@/lib/yahoo/client';

/**
 * Résolution du journal des cours cibles.
 *
 * Tourne une fois par jour. Pour chaque prédiction NON résolue :
 *   1. Suivi    — recalcule le sommet (peak) et le creux (trough) atteints
 *                 depuis la date de prédiction, à partir de l'historique
 *                 quotidien (haut/bas). Toujours recalculé depuis la source →
 *                 idempotent, jamais de dérive.
 *   2. Résolution — si l'horizon est atteint (predicted_at + horizon_months ≤
 *                 aujourd'hui), fige le résultat : prix de clôture à l'échéance,
 *                 gain réalisé, et `hit` (cible touchée pendant l'horizon, dans
 *                 le sens haussier ou baissier de la prédiction).
 *
 * Ne touche JAMAIS aux noms de clients (chiffrés côté navigateur) : uniquement
 * symboles et prix. Aucun déchiffrement requis.
 *
 * Auth : header `Authorization: Bearer ${CRON_SECRET}` (injecté par Vercel Cron).
 */

const MAX_SNAPSHOTS = 4000;   // garde-fou
const FETCH_BATCH = 6;        // symboles fetchés en parallèle (cohérent avec getYahooQuotes)

type Row = {
  id: string;
  symbol: string;
  predicted_at: string;        // YYYY-MM-DD
  horizon_months: number | null;
  current_price: number | null;
  target_price: number | null;
  expected_gain_pct: number | null;
};

function addMonthsISO(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + (months || 12));
  return d.toISOString().split('T')[0];
}

/** Extrême (sommet ou creux) sur une fenêtre de dates [from, to]. */
function extremesInWindow(history: YahooDailyPoint[], fromISO: string, toISO: string) {
  let peak = -Infinity, trough = Infinity;
  let peakAt = '', troughAt = '', lastClose: number | null = null, lastDate = '';
  for (const p of history) {
    if (p.date < fromISO || p.date > toISO) continue;
    if (p.high > peak) { peak = p.high; peakAt = p.date; }
    if (p.low < trough) { trough = p.low; troughAt = p.date; }
    if (p.close > 0) { lastClose = p.close; lastDate = p.date; }
  }
  if (!isFinite(peak)) return null;
  return { peak, peakAt, trough, troughAt, lastClose, lastDate };
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient();
  const today = new Date().toISOString().split('T')[0];

  // 1) Toutes les prédictions encore ouvertes (tous conseillers confondus).
  const { data, error } = await supabase
    .from('price_target_snapshots')
    .select('id, symbol, predicted_at, horizon_months, current_price, target_price, expected_gain_pct')
    .is('resolved_at', null)
    .order('predicted_at', { ascending: true })
    .limit(MAX_SNAPSHOTS);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as Row[];
  if (rows.length === 0) {
    return NextResponse.json({ message: 'Aucune prédiction ouverte', tracked: 0, resolved: 0 });
  }

  // 2) Pour chaque symbole : la date de prédiction la plus ancienne → on fetch
  //    l'historique quotidien une seule fois par symbole, depuis cette date.
  const earliestBySymbol = new Map<string, string>();
  for (const r of rows) {
    if (!r.symbol) continue;
    const prev = earliestBySymbol.get(r.symbol);
    if (!prev || r.predicted_at < prev) earliestBySymbol.set(r.symbol, r.predicted_at);
  }

  // Taux USD/CAD — récupéré une seule fois, à la demande. Le journal stocke en
  // CAD (la capture convertit déjà les prix US), donc on aligne l'historique :
  // les .TO arrivent déjà en CAD chez Yahoo, on ne convertit que les cotations USD.
  let usdCad: number | null = null;
  const getRate = async () => {
    if (usdCad == null) usdCad = await getUsdCadRate();
    return usdCad;
  };

  const histBySymbol = new Map<string, YahooDailyPoint[]>();
  const symbols = Array.from(earliestBySymbol.keys());
  for (let i = 0; i < symbols.length; i += FETCH_BATCH) {
    const batch = symbols.slice(i, i + FETCH_BATCH);
    const results = await Promise.all(
      batch.map((sym) => getYahooDailyHistory(sym, earliestBySymbol.get(sym)!))
    );
    for (let j = 0; j < batch.length; j++) {
      const sym = batch[j];
      const { currency, points } = results[j];
      if (currency === 'USD' && points.length > 0) {
        const rate = await getRate();
        const r = (v: number) => Math.round(v * rate * 100) / 100;
        histBySymbol.set(sym, points.map((p) => ({ date: p.date, high: r(p.high), low: r(p.low), close: r(p.close) })));
      } else {
        histBySymbol.set(sym, points);
      }
    }
  }

  // 3) Mise à jour ligne par ligne (suivi + résolution éventuelle).
  let tracked = 0, resolved = 0, skipped = 0;

  for (const r of rows) {
    const history = histBySymbol.get(r.symbol);
    if (!history || history.length === 0) { skipped++; continue; }

    // Suivi : sommet/creux sur toute la fenêtre [prédiction → aujourd'hui].
    const live = extremesInWindow(history, r.predicted_at, today);
    if (!live) { skipped++; continue; }

    const update: Record<string, unknown> = {
      peak_price: live.peak,
      peak_at: live.peakAt || null,
      trough_price: live.trough,
      trough_at: live.troughAt || null,
    };

    // Résolution : l'horizon est-il atteint ?
    const dueISO = addMonthsISO(r.predicted_at, r.horizon_months ?? 12);
    if (dueISO <= today && r.target_price != null && r.target_price > 0) {
      // On juge sur la fenêtre [prédiction → échéance], pas au-delà.
      const win = extremesInWindow(history, r.predicted_at, dueISO);
      if (win && win.lastClose != null) {
        const entry = r.current_price;
        // Sens de la prédiction : haussier si la cible est au-dessus du prix
        // d'alors (ou, à défaut de prix d'alors, selon le signe du gain visé).
        const bullish =
          entry != null && isFinite(entry)
            ? r.target_price >= entry
            : (r.expected_gain_pct == null || r.expected_gain_pct >= 0);

        const hit = bullish ? win.peak >= r.target_price : win.trough <= r.target_price;
        const actualGain =
          entry != null && entry > 0 ? ((win.lastClose - entry) / entry) * 100 : null;

        update.actual_price = win.lastClose;
        update.actual_gain_pct = actualGain != null ? Math.round(actualGain * 100) / 100 : null;
        update.hit = hit;
        update.resolved_at = today;
        resolved++;
      }
    }

    const { error: upErr } = await supabase
      .from('price_target_snapshots')
      .update(update)
      .eq('id', r.id);

    if (upErr) { console.error(`resolve-targets: maj ${r.id} (${r.symbol}) échouée:`, upErr.message); skipped++; }
    else tracked++;
  }

  return NextResponse.json({
    message: 'Cours cibles mis à jour',
    open: rows.length,
    symbols: symbols.length,
    tracked,
    resolved,
    skipped,
    timestamp: new Date().toISOString(),
  });
}
