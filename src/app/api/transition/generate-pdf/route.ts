import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import { TransitionDocument, type TransitionPDFData } from '@/lib/pdf/transition-template';

/**
 * POST /api/transition/generate-pdf
 *
 * Body: TransitionPDFData
 *
 * Returns the PDF as a binary stream.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const data: TransitionPDFData = await req.json();

    const element = React.createElement(TransitionDocument, { data });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(element as any);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="transition-${data.profileName.replace(/\s+/g, '-').toLowerCase()}-${data.date}.pdf"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (e) {
    console.error('[Transition PDF]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur generation PDF' },
      { status: 500 }
    );
  }
}
