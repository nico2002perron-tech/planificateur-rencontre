import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { PriceTargetsDocument, type PriceTargetReportData, type PdfRenderOptions } from '@/lib/pdf/price-targets-template';
import { mergeFundPdfs } from '@/lib/pdf/merge-fund-pdfs';
import { fetchLogoDataUris } from '@/lib/pdf/fetch-logos';
import { fetchSectors } from '@/lib/pdf/fetch-sectors';

export async function POST(req: NextRequest) {
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

    // Enrich equity/ETF holdings with their sector for the cover sector donut.
    // Best-effort: any lookup failure leaves the holding without a sector
    // (it falls into the "Autres"/"FNB diversifiés" bucket, PDF still renders).
    try {
      const sectorSymbols = reportData.holdings
        .filter(h => h.assetType === 'EQUITY' || h.assetType === 'ETF')
        .map(h => h.symbol);
      if (sectorSymbols.length > 0) {
        const sectorMap = await fetchSectors(sectorSymbols);
        reportData.holdings = reportData.holdings.map(h =>
          (h.assetType === 'EQUITY' || h.assetType === 'ETF') && sectorMap[h.symbol]
            ? { ...h, sector: sectorMap[h.symbol] }
            : h
        );
      }
    } catch (e) {
      console.error('Sector enrichment failed (non-fatal):', e);
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
    const namePart = clientName ? clientName.trim().replace(/[^a-zA-Z\u00C0-\u00FF0-9 -]/g, '').replace(/\s+/g, '-') : '';
    const filename = `cours-cibles${namePart ? `-${namePart}` : ''}-${date}.pdf`;

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
