import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { PriceTargetsDocument, type PriceTargetReportData } from '@/lib/pdf/price-targets-template';
import { mergeFundPdfs } from '@/lib/pdf/merge-fund-pdfs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fundCodes, ...reportData } = body as PriceTargetReportData & { fundCodes?: string[] };

    if (!reportData.holdings || reportData.holdings.length === 0) {
      return NextResponse.json({ error: 'Aucune position fournie' }, { status: 400 });
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
