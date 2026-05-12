/** Groq LLM Client V2 — Extended AI Content for 18-page report */

import Groq from 'groq-sdk';
import type { AIReportContentV2 } from './types-v2';
import { SYSTEM_PROMPT_V2, buildReportPromptV2 } from './prompts-v2';
import type { V2PromptData } from './prompts-v2';
import { getCachedAIContent, setCachedAIContent } from './cache';
import type { AIReportContent } from './types';
import crypto from 'crypto';

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_TEMPERATURE = 0.3;
const GROQ_MAX_TOKENS = 4000;
const GROQ_TIMEOUT = 45_000;

/**
 * Generate extended AI content for the V2 report.
 * Falls back gracefully — the report still renders without AI.
 */
export async function generateReportAIContentV2(
  promptData: V2PromptData,
  portfolioId?: string
): Promise<AIReportContentV2 | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn('[AI-V2] GROQ_API_KEY not set, skipping AI content generation');
    return null;
  }

  try {
    // Cache check
    const dataHash = computeV2Hash(promptData);
    if (portfolioId) {
      const cached = await getCachedAIContent(portfolioId, dataHash);
      if (cached) {
        console.log('[AI-V2] Cache hit for portfolio', portfolioId);
        return cached as unknown as AIReportContentV2;
      }
    }

    const groq = new Groq({ apiKey });
    const prompt = buildReportPromptV2(promptData);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GROQ_TIMEOUT);

    const completion = await groq.chat.completions.create(
      {
        model: GROQ_MODEL,
        temperature: GROQ_TEMPERATURE,
        max_tokens: GROQ_MAX_TOKENS,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_V2 },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      },
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      console.warn('[AI-V2] Empty response from Groq');
      return null;
    }

    const parsed = JSON.parse(content) as AIReportContentV2;

    // Validate minimum required fields
    if (!parsed.executiveSummary || !parsed.allocationComment) {
      console.warn('[AI-V2] Malformed response — missing required fields');
      return null;
    }

    // Cache the result
    if (portfolioId) {
      await setCachedAIContent(portfolioId, dataHash, parsed as unknown as AIReportContent).catch((err) => {
        console.warn('[AI-V2] Cache write failed:', err);
      });
    }

    console.log('[AI-V2] Content generated successfully');
    return parsed;
  } catch (err) {
    console.error('[AI-V2] Groq generation failed:', err);
    return null;
  }
}

function computeV2Hash(data: V2PromptData): string {
  const key = JSON.stringify({
    v: data.totalValue,
    n: data.holdings.length,
    s: data.holdings.map(h => h.symbol).join(','),
    w: data.holdings.map(h => h.weight.toFixed(2)).join(','),
    iq: data.intelligence.overall,
  });
  return crypto.createHash('md5').update(key).digest('hex');
}
