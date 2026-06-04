import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { PriceTargetsDocument, type PriceTargetReportData, type PdfRenderOptions } from '@/lib/pdf/price-targets-template';
import { mergeFundPdfs } from '@/lib/pdf/merge-fund-pdfs';
import { fetchLogoDataUris } from '@/lib/pdf/fetch-logos';
import { fetchHoldingMeta } from '@/lib/pdf/fetch-sectors';
import { describeHoldings } from '@/lib/pdf/describe-holdings';

export async function POST(req: NextRequest) {
  // Le nom du client transite ici (dans le body) pour être imprimé dans le PDF.
  // C'est une donnée sensible : on exige une session authentifiée dans le
  // handler lui-même (pas seulement via le middleware), par défense en profondeur.
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { fundCodes, options, clientName, ...rest } = body as PriceTargetReportData & { fundCodes?: string[]; options?: PdfRenderOptions };
    const reportData: PriceTargetReportData = { ...rest, options, clientName };

    if (!reportData.holdings || reportData.holdings.length === 0) {
      return NextResponse.json({ error: 'Aucune position fournie' }, { status: 400 });
    }

    // Pre-fetch company logos as base64 PNG data URIs for all equity-like holdings
    // that have a price target. Failures are silent: missing logos fall back to
    // category dots in the template.
    const logoSymbols = Array.from(new Set(
      reportData.holdings
        .filter(h => !['CASH', 'FIXED_INCOME', 'OTHER'].includes(h.assetType) && h.targetPrice)
        .map(h => h.symbol)
    ));
    reportData.logos = await fetchLogoDataUris(logoSymbols);

    // Enrich equity/ETF holdings with sector (cover donut) + the REAL official
    // business description (Descriptions section). One Yahoo call per symbol
    // returns both the sector and the official English summary; Groq translates
    // that summary faithfully to French (no rewriting/inventing).
    // Best-effort: any failure leaves the PDF renderable without the extra data.
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
        // French descriptions only when the Descriptions section is included.
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

    const element = React.createElement(PriceTargetsDocument, { data: reportData });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(element as any);

    // Merge fund fact PDFs if fund codes provided
    let finalPdfBytes: Uint8Array;
    if (fundCodes && fundCodes.length > 0) {
      finalPdfBytes = await mergeFundPdfs(buffer, fundCodes);
    } else {
      finalPdfBytes = new Uint8Array(buffer);
    }

    const date = new Date().toISOString().split('T')[0];
    // Nom de fichier NEUTRE : le nom du client n'appara\u00EEt jamais dans l'en-t\u00EAte
    // Content-Disposition (loggable par les proxies/CDN/Vercel). Il reste
    // uniquement \u00E0 l'int\u00E9rieur du PDF, qui est le livrable destin\u00E9 au client.
    const filename = `cours-cibles-${date}.pdf`;

    return new NextResponse(Buffer.from(finalPdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('PDF generation error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur de génération PDF' },
      { status: 500 }
    );
  }
}
