import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { renderToBuffer } from '@react-pdf/renderer';
import { StrategyReport } from '@/lib/pdf/strategy-template';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const data = await req.json();

    const buffer = await renderToBuffer(<StrategyReport data={data} />);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${(data.name ?? 'Portefeuille').replace(/[^a-zA-Z0-9àâéèêëïôùûüÿçÀÂÉÈÊËÏÔÙÛÜŸÇ\s-]/g, '')} - Analyse.pdf"`,
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur PDF' },
      { status: 500 }
    );
  }
}
