import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchFundFactsPdf } from '@/lib/providers/funds/fetcher';

const BUCKET = 'fund-facts';

/**
 * Cron job: refresh all fund documents in the library.
 * Runs monthly — tries to auto-download updated Fund Facts PDFs
 * from manufacturer websites for every fund in the database.
 *
 * Schedule: 1st of each month at 8AM EST
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient();

  // Get all fund documents
  const { data: funds, error } = await supabase
    .from('fund_documents')
    .select('*')
    .order('fund_code');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!funds || funds.length === 0) {
    return NextResponse.json({ message: 'No funds to refresh', count: 0 });
  }

  const results = {
    total: funds.length,
    updated: 0,
    failed: 0,
    skipped: 0,
    details: [] as { code: string; status: string; message: string }[],
  };

  for (const fund of funds) {
    try {
      const fetchResult = await fetchFundFactsPdf(fund.fund_code);

      if (!fetchResult.success || !fetchResult.buffer) {
        results.failed++;
        results.details.push({
          code: fund.fund_code,
          status: 'failed',
          message: fetchResult.error || 'Fetch failed',
        });
        continue;
      }

      // Check if the new PDF is different from the old one (by size as heuristic)
      if (fetchResult.buffer.length === fund.file_size) {
        results.skipped++;
        results.details.push({
          code: fund.fund_code,
          status: 'skipped',
          message: 'Fichier identique (même taille)',
        });
        continue;
      }

      // Delete old file from storage
      if (fund.file_path) {
        await supabase.storage.from(BUCKET).remove([fund.file_path]);
      }

      // Upload new file
      const fileName = `${fund.fund_code}_fund-facts.pdf`;
      const filePath = `${fund.fund_code}/${Date.now()}_${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, fetchResult.buffer, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) {
        results.failed++;
        results.details.push({
          code: fund.fund_code,
          status: 'failed',
          message: `Upload error: ${uploadError.message}`,
        });
        continue;
      }

      // Update database record
      await supabase
        .from('fund_documents')
        .update({
          file_name: fileName,
          file_path: filePath,
          file_size: fetchResult.buffer.length,
        })
        .eq('id', fund.id);

      results.updated++;
      results.details.push({
        code: fund.fund_code,
        status: 'updated',
        message: `Mis à jour depuis ${fetchResult.manufacturer} (${fetchResult.url})`,
      });
    } catch (err) {
      results.failed++;
      results.details.push({
        code: fund.fund_code,
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  console.log('[Cron] Fund docs refresh:', JSON.stringify(results, null, 2));

  return NextResponse.json({
    message: 'Fund documents refresh complete',
    ...results,
    timestamp: new Date().toISOString(),
  });
}
