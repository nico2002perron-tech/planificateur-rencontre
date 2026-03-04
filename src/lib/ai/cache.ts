/** AI Content Cache — Supabase 24h cache */

import { createClient } from '@/lib/supabase/server';
import type { AIReportContent } from './types';
import type { FullReportData } from '@/lib/pdf/report-data';

const CACHE_TTL_HOURS = 24;

export function computeDataHash(data: FullReportData): string {
  // Simple hash: use portfolio value + holdings symbols + weights
  const key = [
    Math.round(data.portfolio.totalValue),
    ...data.portfolio.holdings.map((h) => `${h.symbol}:${h.weight.toFixed(1)}`),
  ].join('|');

  // Simple string hash (djb2)
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) + hash + key.charCodeAt(i)) & 0xffffffff;
  }
  return hash.toString(16);
}

export async function getCachedAIContent(
  portfolioId: string,
  dataHash: string
): Promise<AIReportContent | null> {
  try {
    const supabase = createClient();
    const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 3600_000).toISOString();

    const { data } = await supabase
      .from('ai_content_cache')
      .select('content')
      .eq('portfolio_id', portfolioId)
      .eq('data_hash', dataHash)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data?.content) {
      return data.content as AIReportContent;
    }
    return null;
  } catch {
    return null;
  }
}

export async function setCachedAIContent(
  portfolioId: string,
  dataHash: string,
  content: AIReportContent
): Promise<void> {
  try {
    const supabase = createClient();
    await supabase.from('ai_content_cache').upsert(
      {
        portfolio_id: portfolioId,
        data_hash: dataHash,
        content,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'portfolio_id,data_hash' }
    );
  } catch (err) {
    console.warn('[AI Cache] Write failed:', err);
  }
}
