import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { PriceTargetsDocument, type PriceTargetReportData, type PdfRenderOptions } from '@/lib/pdf/price-targets-template';
import { mergeFundPdfs } from '@/lib/pdf/merge-fund-pdfs';
import { fetchLogoDataUris } from '@/lib/pdf/fetch-logos';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fundCodes, options, ...rest } = body as PriceTargetReportData & { fundCodes?: string[]; options?: PdfRenderOptions };
    const reportData: PriceTargetReportData = { ...rest, options };

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

    return new NextResponse(Buffer.from(finalPdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="cours-cibles-${date}.pdf"`,
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
