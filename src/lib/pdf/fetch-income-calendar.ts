import 'server-only';
import { getYahooDividendEvents } from '@/lib/yahoo/client';
import type { PriceTargetHolding, IncomeMonth } from './price-targets-template';

// Libellés courts FR (3 lettres) pour l'axe du calendrier.
const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

// Cache process-level (comme fetch-sectors) — un même symbole n'est fetché qu'une fois.
const scheduleCache = new Map<string, Promise<{ months: number[]; count: number }>>();

// Mois d'échéance d'une obligation à partir de maturityDate (ISO ou FR).
const FR_MONTH: Record<string, number> = {
  jan: 0, fév: 1, fev: 1, mar: 2, avr: 3, mai: 4, jui: 5, jun: 5, jul: 6,
  aoû: 7, aou: 7, sep: 8, oct: 9, nov: 10, déc: 11, dec: 11,
};
function maturityMonth(dateStr?: string): number | null {
  if (!dateStr) return null;
  const iso = dateStr.match(/^(20\d{2})-(\d{2})-(\d{2})/);
  if (iso) return +iso[2] - 1;
  const fr = dateStr.match(/(\d{1,2})\s+(\S+)\s+(\d{4})/);
  if (fr) {
    const m = FR_MONTH[fr[2].toLowerCase().slice(0, 3)];
    if (m !== undefined) return m;
  }
  return null;
}

// Fréquence de versement déduite du nombre de versements sur 365 jours.
function frequencyLabel(count: number): string | undefined {
  if (count >= 11) return 'mensuel';
  if (count >= 3) return 'trimestriel'; // ~4/an
  if (count === 2) return 'semestriel';
  if (count === 1) return 'annuel';
  return undefined;
}

// Mois de versement (0-11 distincts) + nombre de versements, pour un symbole.
async function paymentSchedule(symbol: string): Promise<{ months: number[]; count: number }> {
  let p = scheduleCache.get(symbol);
  if (!p) {
    p = (async () => {
      try {
        const events = await getYahooDividendEvents(symbol);
        const monthsSet = new Set<number>();
        for (const ev of events) {
          const d = new Date(`${ev.date}T00:00:00`);
          if (!isNaN(d.getTime())) monthsSet.add(d.getMonth());
        }
        return { months: Array.from(monthsSet).sort((a, b) => a - b), count: events.length };
      } catch {
        return { months: [], count: 0 };
      }
    })();
    scheduleCache.set(symbol, p);
  }
  return p;
}

/**
 * Construit le calendrier des revenus 12 mois (dividendes + coupons) et la
 * fréquence de versement par titre, à partir des holdings déjà chiffrés en CAD.
 *
 * - Dividendes : le montant annuel du titre (forwardDividend, repli annualIncome)
 *   est réparti sur ses mois de versement réels (dates ex-dividende Yahoo) ;
 *   repli trimestriel (mars/juin/sep/déc) si aucun historique n'est disponible.
 *   AUCUNE conversion FX : on réutilise le montant CAD déjà sur le holding —
 *   Yahoo ne sert qu'à connaître les MOIS et la fréquence.
 * - Coupons : semestriels, dérivés du mois d'échéance (mois et mois+6), sans
 *   appel réseau ; repli juin/déc si l'échéance est inconnue.
 *
 * Best-effort : toute erreur par symbole retombe sur les replis. Renvoie
 * toujours 12 entrées (janvier→décembre).
 */
export async function buildIncomeCalendar(holdings: PriceTargetHolding[]): Promise<{
  calendar: IncomeMonth[];
  frequencies: Record<string, string>;
  quarterlyBySymbol: Record<string, [number, number, number, number]>;
}> {
  const dividends = new Array(12).fill(0) as number[];
  const coupons = new Array(12).fill(0) as number[];
  const frequencies: Record<string, string> = {};
  // Dividende annuel réparti par TRIMESTRE (T1..T4) pour chaque titre, d'après
  // ses mois de versement réels — alimente les colonnes T1–T4 de la page Revenus.
  const quarterlyBySymbol: Record<string, [number, number, number, number]> = {};

  const dividendPayers = holdings.filter(h =>
    ['EQUITY', 'ETF', 'FUND', 'PREFERRED'].includes(h.assetType) &&
    (h.forwardDividend ?? h.annualIncome ?? 0) > 0);

  const schedules = await Promise.all(
    dividendPayers.map(async h => ({ h, sched: await paymentSchedule(h.symbol) }))
  );

  for (const { h, sched } of schedules) {
    const annual = h.forwardDividend ?? h.annualIncome ?? 0;
    if (!(annual > 0)) continue;
    const freq = frequencyLabel(sched.count);
    if (freq) frequencies[h.symbol] = freq;
    const payMonths = sched.months.length > 0 ? sched.months : [2, 5, 8, 11];
    const per = annual / payMonths.length;
    const q: [number, number, number, number] = [0, 0, 0, 0];
    for (const m of payMonths) { dividends[m] += per; q[Math.floor(m / 3)] += per; }
    quarterlyBySymbol[h.symbol] = [Math.round(q[0]), Math.round(q[1]), Math.round(q[2]), Math.round(q[3])];
  }

  const bonds = holdings.filter(h => h.assetType === 'FIXED_INCOME' && (h.annualIncome ?? 0) > 0);
  for (const b of bonds) {
    const annual = b.annualIncome ?? 0;
    const m1 = maturityMonth(b.maturityDate);
    if (m1 == null) {
      coupons[5] += annual / 2;
      coupons[11] += annual / 2;
    } else {
      coupons[m1] += annual / 2;
      coupons[(m1 + 6) % 12] += annual / 2;
    }
  }

  const calendar: IncomeMonth[] = MONTH_LABELS.map((label, i) => ({
    label,
    dividends: Math.round(dividends[i]),
    coupons: Math.round(coupons[i]),
  }));
  return { calendar, frequencies, quarterlyBySymbol };
}
