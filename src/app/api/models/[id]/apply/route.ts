import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json();
    const { client_id, portfolio_name, account_type, currency, total_investment, prices } = body;

    if (!client_id || !portfolio_name || !total_investment) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createClient();

    // Verify client belongs to this advisor
    const { data: client } = await supabase
      .from('clients')
      .select('id, advisor_id')
      .eq('id', client_id)
      .eq('advisor_id', session.user.id)
      .single();

    if (!client) {
      return NextResponse.json({ error: 'Client not found or unauthorized' }, { status: 404 });
    }

    // Fetch the model
    const { data: model } = await supabase
      .from('model_portfolios')
      .select('*')
      .eq('id', id)
      .single();

    if (!model) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    const modelHoldings = model.holdings as {
      symbol: string;
      name: string;
      weight: number;
      asset_class: string;
      region?: string;
    }[];

    if (!modelHoldings || modelHoldings.length === 0) {
      return NextResponse.json({ error: 'Model has no holdings' }, { status: 400 });
    }

    // Create the portfolio
    const { data: portfolio, error: portfolioError } = await supabase
      .from('portfolios')
      .insert({
        client_id,
        name: portfolio_name,
        account_type: account_type || 'NON_ENREGISTRE',
        currency: currency || 'CAD',
        status: 'active',
      })
      .select()
      .single();

    if (portfolioError || !portfolio) {
      console.error('Portfolio creation error:', portfolioError);
      return NextResponse.json({ error: 'Failed to create portfolio' }, { status: 500 });
    }

    // Create holdings from model
    const priceMap: Record<string, number> = prices || {};
    const holdingsToInsert = modelHoldings.map((mh) => {
      const price = priceMap[mh.symbol] || 100;
      const allocatedAmount = (total_investment * mh.weight) / 100;
      const quantity = price > 0 ? allocatedAmount / price : 0;

      return {
        portfolio_id: portfolio.id,
        symbol: mh.symbol,
        name: mh.name,
        quantity: Math.round(quantity * 1000000) / 1000000, // 6 decimal precision
        average_cost: price,
        asset_class: mh.asset_class || 'EQUITY',
        sector: '',
        region: mh.region || 'CA',
      };
    });

    const { data: holdings, error: holdingsError } = await supabase
      .from('holdings')
      .insert(holdingsToInsert)
      .select();

    if (holdingsError) {
      console.error('Holdings creation error:', holdingsError);
      // Clean up the portfolio if holdings fail
      await supabase.from('portfolios').delete().eq('id', portfolio.id);
      return NextResponse.json({ error: 'Failed to create holdings' }, { status: 500 });
    }

    return NextResponse.json({
      portfolio,
      holdings_created: holdings?.length || 0,
    }, { status: 201 });
  } catch (error) {
    console.error('Apply model error:', error);
    return NextResponse.json({ error: 'Failed to apply model' }, { status: 500 });
  }
}
