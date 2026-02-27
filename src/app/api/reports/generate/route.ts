import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { renderToBuffer } from '@react-pdf/renderer';
import { ReportDocument } from '@/lib/pdf/report-template';
import { createClient } from '@/lib/supabase/server';
import React from 'react';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { portfolio_id, client_id } = body;

    const supabase = createClient();

    // Fetch portfolio with holdings
    const { data: portfolio } = await supabase
      .from('portfolios')
      .select('*, holdings(*)')
      .eq('id', portfolio_id)
      .single();

    if (!portfolio) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
    }

    // Fetch client
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', client_id)
      .single();

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Build report data (simplified - in production, fetch live prices etc.)
    const reportData = {
      client: {
        name: `${client.first_name} ${client.last_name}`,
        type: client.type,
        riskProfile: client.risk_profile || 'Équilibré',
        objectives: client.objectives || '',
        horizon: client.investment_horizon || '',
      },
      advisor: {
        name: session.user.name,
        title: '',
      },
      portfolio: {
        name: portfolio.name,
        accountType: portfolio.account_type,
        currency: portfolio.currency,
        totalValue: (portfolio.holdings || []).reduce(
          (sum: number, h: { quantity: number; average_cost: number }) => sum + h.quantity * h.average_cost,
          0
        ),
        holdings: (portfolio.holdings || []).map((h: {
          symbol: string;
          name: string;
          quantity: number;
          average_cost: number;
        }) => ({
          symbol: h.symbol,
          name: h.name || h.symbol,
          quantity: h.quantity,
          avgCost: h.average_cost,
          currentPrice: h.average_cost, // Would be replaced with live price
          marketValue: h.quantity * h.average_cost,
          weight: 0,
          gainLoss: 0,
        })),
      },
      performance: {
        periods: { '1M': 0, '3M': 0, 'YTD': 0, '1A': 0, '3A': 0, '5A': 0 },
        benchmarks: {
          'S&P/TSX': { '1M': 0, '3M': 0, 'YTD': 0, '1A': 0, '3A': 0, '5A': 0 },
          'S&P 500': { '1M': 0, '3M': 0, 'YTD': 0, '1A': 0, '3A': 0, '5A': 0 },
        },
      },
      riskMetrics: {
        volatility: 0,
        sharpe: 0,
        maxDrawdown: 0,
        beta: 1,
      },
      scenarios: [
        { name: 'Optimiste', projectedValue: 0, annualizedReturn: 0 },
        { name: 'Base', projectedValue: 0, annualizedReturn: 0 },
        { name: 'Pessimiste', projectedValue: 0, annualizedReturn: 0 },
      ],
      generatedAt: new Intl.DateTimeFormat('fr-CA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(new Date()),
    };

    // Calculate weights
    const totalValue = reportData.portfolio.totalValue;
    if (totalValue > 0) {
      reportData.portfolio.holdings = reportData.portfolio.holdings.map((h: {
        symbol: string;
        name: string;
        quantity: number;
        avgCost: number;
        currentPrice: number;
        marketValue: number;
        weight: number;
        gainLoss: number;
      }) => ({
        ...h,
        weight: (h.marketValue / totalValue) * 100,
      }));
    }

    // Generate PDF
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = React.createElement(ReportDocument, { data: reportData }) as any;
    const buffer = await renderToBuffer(element);

    // Record report
    await supabase.from('reports').insert({
      portfolio_id,
      client_id,
      advisor_id: session.user.id,
      title: `Rapport - ${client.first_name} ${client.last_name} - ${portfolio.name}`,
      config: body.config || {},
      status: 'ready',
      generated_at: new Date().toISOString(),
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="rapport-${client.last_name}-${portfolio.name}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Report generation error:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
