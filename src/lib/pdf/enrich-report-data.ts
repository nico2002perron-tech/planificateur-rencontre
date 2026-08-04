/**
 * Enrichissement SERVEUR du rapport de cours cibles — partagé par TOUS les
 * exports (PDF et HTML interactif).
 *
 * Pourquoi ce fichier existe : le payload envoyé par le navigateur
 * (`PretAColler.tsx`) est volontairement léger — il ne contient NI les logos,
 * NI le calendrier des revenus, NI les secteurs/descriptions des titres. Ces
 * trois enrichissements se font ici, côté serveur. Tant qu'un seul export les
 * appliquait, le code pouvait vivre dans la route du PDF ; dès qu'un second
 * format consomme les mêmes données, le partage devient obligatoire — sinon les
 * deux formats raconteraient deux histoires différentes au même client.
 *
 * Contrat : même entrée → mêmes enrichissements, quel que soit l'export.
 * Tolérance aux pannes conservée telle quelle (voir les blocs try/catch) : un
 * fournisseur indisponible ne doit jamais empêcher la production du document.
 */
import type { PriceTargetReportData } from './price-targets-template';
import { fetchLogoDataUris } from './fetch-logos';
import { fetchHoldingMeta } from './fetch-sectors';
import { describeHoldings } from './describe-holdings';
import { buildIncomeCalendar } from './fetch-income-calendar';

/**
 * Applique les trois enrichissements serveur et renvoie le rapport complété.
 * L'objet reçu n'est pas muté : on travaille sur une copie de surface.
 */
export async function enrichReportData(input: PriceTargetReportData): Promise<PriceTargetReportData> {
  const reportData: PriceTargetReportData = { ...input };
  const options = reportData.options;

  // ── 1. Logos ───────────────────────────────────────────────────────────────
  // Logos d'entreprise en data URI PNG, pour les titres « actions » qui ont une
  // cible. Les manquants retombent sur les pastilles de catégorie du gabarit.
  const logoSymbols = Array.from(new Set(
    reportData.holdings
      .filter(h => !['CASH', 'FIXED_INCOME', 'OTHER'].includes(h.assetType) && h.targetPrice)
      .map(h => h.symbol)
  ));
  reportData.logos = await fetchLogoDataUris(logoSymbols);

  // ── 2. Secteur + description officielle (actions/FNB) ───────────────────────
  // Un appel Yahoo par symbole donne le secteur ET le résumé officiel anglais ;
  // Groq traduit ce résumé fidèlement en français (aucune réécriture inventée).
  // Au mieux : toute panne laisse le document produisible sans ces données.
  try {
    const eqEtf = reportData.holdings.filter(h => h.assetType === 'EQUITY' || h.assetType === 'ETF');
    if (eqEtf.length > 0) {
      const meta = await fetchHoldingMeta(eqEtf.map(h => h.symbol));
      reportData.holdings = reportData.holdings.map(h => {
        const m = meta[h.symbol];
        return (h.assetType === 'EQUITY' || h.assetType === 'ETF') && m?.sector
          ? { ...h, sector: m.sector }
          : h;
      });
      // Descriptions françaises seulement quand la section est incluse.
      if (options?.includeDescriptions !== false) {
        const desc = await describeHoldings(eqEtf.map(h => ({
          symbol: h.symbol,
          name: h.name,
          sector: meta[h.symbol]?.sector ?? undefined,
          summary: meta[h.symbol]?.summary ?? undefined,
        })));
        reportData.holdings = reportData.holdings.map(h =>
          desc[h.symbol] ? { ...h, description: desc[h.symbol] } : h
        );
      }
    }
  } catch (e) {
    console.error('Holding enrichment failed (non-fatal):', e);
  }

  // ── 3. Calendrier des revenus 12 mois + fréquence par titre ────────────────
  // Les MOIS viennent des dates de dividendes Yahoo ; les MONTANTS restent ceux
  // (déjà en CAD) portés par les titres — aucune double conversion de devise.
  // Coupons dérivés du mois d'échéance, sans réseau.
  if (options?.includeIncomeCalendar !== false || options?.includeIncomeDetail !== false) {
    try {
      const { calendar, frequencies, quarterlyBySymbol } = await buildIncomeCalendar(reportData.holdings);
      reportData.incomeCalendar = calendar;
      reportData.holdings = reportData.holdings.map(h => {
        const freq = frequencies[h.symbol];
        const quarterly = quarterlyBySymbol[h.symbol];
        return (freq || quarterly)
          ? { ...h, ...(freq ? { dividendFrequency: freq } : {}), ...(quarterly ? { quarterlyDividends: quarterly } : {}) }
          : h;
      });
    } catch (e) {
      console.error('Income calendar build failed (non-fatal):', e);
    }
  }

  return reportData;
}
