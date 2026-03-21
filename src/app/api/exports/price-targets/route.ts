import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { PriceTargetsDocument, type PriceTargetReportData } from '@/lib/pdf/price-targets-template';

export async function POST(req: NextRequest) {
  try {
    const body: PriceTargetReportData = await req.json();

    if (!body.holdings || body.holdings.length === 0) {
      return NextResponse.json({ error: 'Aucune position fournie' }, { status: 400 });
    }

    const element = React.createElement(PriceTargetsDocument, { data: body });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(element as any);

    const date = new Date().toISOString().split('T')[0];

    return new NextResponse(new Uint8Array(buffer), {
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
