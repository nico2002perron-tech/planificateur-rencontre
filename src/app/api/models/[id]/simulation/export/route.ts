import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { SimulationPDFDocument, type SimulationPDFData } from '@/lib/pdf/simulation-template';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = body as SimulationPDFData;

    if (!data.holdings || data.holdings.length === 0) {
      return NextResponse.json({ error: 'Aucune position fournie' }, { status: 400 });
    }

    const element = React.createElement(SimulationPDFDocument, { data });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(element as any);

    const date = new Date().toISOString().split('T')[0];
    const safeName = (data.modelName || 'simulation').replace(/[^a-zA-Z0-9-_]/g, '_');

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="simulation-${safeName}-${date}.pdf"`,
      },
    });
  } catch (err) {
    console.error('Simulation PDF generation error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur de génération PDF' },
      { status: 500 }
    );
  }
}
