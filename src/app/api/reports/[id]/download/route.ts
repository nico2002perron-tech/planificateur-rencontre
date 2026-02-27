import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { renderToBuffer } from '@react-pdf/renderer';
import { FullReportDocument } from '@/lib/pdf/report-template';
import { buildFullReportData } from '@/lib/pdf/report-data';
import { createClient } from '@/lib/supabase/server';
import React from 'react';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const supabase = createClient();

    // Fetch report
    const { data: report } = await supabase
      .from('reports')
      .select('*')
      .eq('id', id)
      .eq('advisor_id', session.user.id)
      .single();

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Fetch portfolio with holdings
    const { data: portfolio } = await supabase
      .from('portfolios')
      .select('*, holdings(*)')
      .eq('id', report.portfolio_id)
      .single();

    if (!portfolio) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
    }

    // Fetch client
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', report.client_id)
      .single();

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Fetch cached prices
    const symbols = (portfolio.holdings || []).map((h: { symbol: string }) => h.symbol);
    const priceMap: Record<string, { price: number; company_name?: string; sector?: string }> = {};

    if (symbols.length > 0) {
      const { data: cachedPrices } = await supabase
        .from('price_cache')
        .select('symbol, price, company_name, sector')
        .in('symbol', symbols);

      if (cachedPrices) {
        for (const cp of cachedPrices) {
          priceMap[cp.symbol] = {
            price: cp.price,
            company_name: cp.company_name,
            sector: cp.sector,
          };
        }
      }
    }

    // Fetch advisor
    const { data: advisor } = await supabase
      .from('users')
      .select('name, title')
      .eq('id', session.user.id)
      .single();

    // Build and render
    const reportData = buildFullReportData(
      portfolio,
      portfolio.holdings || [],
      client,
      {
        name: advisor?.name || session.user.name || 'Conseiller',
        title: advisor?.title || '',
      },
      priceMap,
      {
        sections: (report.config as Record<string, unknown>)?.sections as string[] | undefined,
        projectionYears: (report.config as Record<string, unknown>)?.projection_years as number | undefined,
      }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = React.createElement(FullReportDocument, { data: reportData }) as any;
    const buffer = await renderToBuffer(element);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="rapport-${client.last_name}-${portfolio.name}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Report download error:', error);
    return NextResponse.json({ error: 'Failed to download report' }, { status: 500 });
  }
}
