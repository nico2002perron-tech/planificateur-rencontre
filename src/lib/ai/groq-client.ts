/** Groq LLM Client for Report AI Content */

import Groq from 'groq-sdk';
import type { FullReportData } from '@/lib/pdf/report-data';
import type { AIReportContent, ValuationDataItem } from './types';
import { SYSTEM_PROMPT, buildReportPrompt } from './prompts';
import { getCachedAIContent, setCachedAIContent, computeDataHash } from './cache';

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_TEMPERATURE = 0.3;
const GROQ_MAX_TOKENS = 2500;
const GROQ_TIMEOUT = 30_000;

export async function generateReportAIContent(
  data: FullReportData,
  valuationData?: ValuationDataItem[] | null,
  portfolioId?: string
): Promise<AIReportContent | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn('[AI] GROQ_API_KEY not set, skipping AI content generation');
    return null;
  }

  try {
    // Check cache first
    const dataHash = computeDataHash(data);
    if (portfolioId) {
      const cached = await getCachedAIContent(portfolioId, dataHash);
      if (cached) {
        console.log('[AI] Cache hit for portfolio', portfolioId);
        return cached;
      }
    }

    const groq = new Groq({ apiKey });
    const prompt = buildReportPrompt(data, valuationData);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GROQ_TIMEOUT);

    const completion = await groq.chat.completions.create(
      {
        model: GROQ_MODEL,
        temperature: GROQ_TEMPERATURE,
        max_tokens: GROQ_MAX_TOKENS,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      },
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      console.warn('[AI] Empty response from Groq');
      return null;
    }

    const parsed = JSON.parse(content) as AIReportContent;

    // Validate required fields exist
    if (!parsed.executiveSummary || !parsed.allocationComment) {
      console.warn('[AI] Malformed response — missing required fields');
      return null;
    }

    // Cache the result
    if (portfolioId) {
      await setCachedAIContent(portfolioId, dataHash, parsed).catch((err) => {
        console.warn('[AI] Cache write failed:', err);
      });
    }

    console.log('[AI] Content generated successfully');
    return parsed;
  } catch (err) {
    console.error('[AI] Groq generation failed:', err);
    return null;
  }
}
