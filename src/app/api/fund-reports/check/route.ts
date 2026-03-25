import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

export interface FundCheckResult {
  fund_code: string;
  status: 'ok' | 'outdated' | 'missing';
  fund_name?: string;
  updated_at?: string;
  months_old?: number;
}

/**
 * POST - Check which fund codes have up-to-date Fund Facts in the library.
 * Body: { fund_codes: string[] }
 * Returns status for each fund: ok (< 6 months), outdated (> 6 months), missing
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const fundCodes: string[] = body.fund_codes || [];

  if (fundCodes.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const supabase = createClient();

  const { data: docs } = await supabase
    .from('fund_documents')
    .select('fund_code, fund_name, updated_at')
    .in('fund_code', fundCodes.map((c) => c.toUpperCase()));

  const docMap = new Map<string, { fund_name: string; updated_at: string }>();
  (docs || []).forEach((d) => docMap.set(d.fund_code, d));

  const now = Date.now();

  const results: FundCheckResult[] = fundCodes.map((code) => {
    const uc = code.toUpperCase();
    const doc = docMap.get(uc);

    if (!doc) {
      return { fund_code: uc, status: 'missing' };
    }

    const monthsOld = (now - new Date(doc.updated_at).getTime()) / (1000 * 60 * 60 * 24 * 30);

    return {
      fund_code: uc,
      status: monthsOld < 6 ? 'ok' : 'outdated',
      fund_name: doc.fund_name,
      updated_at: doc.updated_at,
      months_old: Math.round(monthsOld * 10) / 10,
    };
  });

  return NextResponse.json({ results });
}
