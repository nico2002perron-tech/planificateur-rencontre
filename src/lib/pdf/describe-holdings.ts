import 'server-only';
import Groq from 'groq-sdk';

/**
 * Faithful FRENCH translation of the REAL official company description for the
 * "Descriptions des titres" PDF section.
 *
 * Source = the actual Yahoo Finance `assetProfile.longBusinessSummary` (English).
 * We keep the first 1–2 sentences (compact) and translate them faithfully with
 * Groq — strict translation, no rewriting/inventing. Holdings WITHOUT a real
 * summary get NO description (we never fabricate). If the translator is
 * unavailable, we fall back to the real English excerpt (still sourced).
 */

const GROQ_MODEL = 'llama-3.3-70b-versatile';

export interface DescribeInput {
  symbol: string;
  name: string;
  sector?: string;          // unused (kept for caller convenience)
  summary?: string | null;  // REAL English business summary (Yahoo)
}

// symbol → French translation (or English excerpt fallback)
const cache = new Map<string, string>();

/** First 1–2 sentences of the official summary, capped for compactness. */
function excerpt(summary: string, maxChars = 260): string {
  const clean = summary.replace(/\s+/g, ' ').trim();
  const m = clean.match(/^(.*?\.)(\s+.*?\.)?/);
  let out = m ? `${m[1]}${m[2] ?? ''}` : clean;
  if (out.length > maxChars) out = `${out.slice(0, maxChars).replace(/\s+\S*$/, '')}…`;
  return out.trim();
}

const SYSTEM_PROMPT = `Tu es traducteur financier professionnel (anglais → français québécois).
On te donne la description OFFICIELLE (en anglais) de titres boursiers.
Ta SEULE tâche: TRADUIRE fidèlement chaque description en français.
- Traduction stricte: ne rien inventer, ajouter, omettre ni résumer au-delà du texte fourni.
- Conserve le sens exact et les faits. Français clair et professionnel.
Réponds en JSON strict:
{ "descriptions": [ { "symbol": "AAPL", "fr": "Apple Inc. conçoit, fabrique et commercialise des téléphones intelligents, des ordinateurs personnels..." } ] }`;

export async function describeHoldings(items: DescribeInput[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const todo: { symbol: string; en: string }[] = [];

  for (const it of items) {
    if (!it.symbol || !it.summary) continue; // real summaries only — never fabricate
    if (cache.has(it.symbol)) { out[it.symbol] = cache.get(it.symbol)!; continue; }
    todo.push({ symbol: it.symbol, en: excerpt(it.summary) });
  }
  if (todo.length === 0) return out;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    // No translator → use the real English excerpt verbatim (still sourced).
    for (const t of todo) { cache.set(t.symbol, t.en); out[t.symbol] = t.en; }
    return out;
  }

  try {
    const list = todo.map((t) => `${t.symbol} | ${t.en}`).join('\n');
    const groq = new Groq({ apiKey });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    const completion = await groq.chat.completions.create(
      {
        model: GROQ_MODEL,
        temperature: 0,
        max_tokens: 3500,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Descriptions officielles à traduire fidèlement:\n${list}` },
        ],
        response_format: { type: 'json_object' },
      },
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    const translated = new Set<string>();
    const content = completion.choices?.[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content) as { descriptions?: { symbol: string; fr: string }[] };
      for (const d of parsed.descriptions || []) {
        if (d?.symbol && d?.fr?.trim()) {
          const fr = d.fr.trim();
          cache.set(d.symbol, fr);
          out[d.symbol] = fr;
          translated.add(d.symbol);
        }
      }
    }
    // Anything not translated → real English excerpt fallback.
    for (const t of todo) {
      if (!translated.has(t.symbol)) { cache.set(t.symbol, t.en); out[t.symbol] = t.en; }
    }
  } catch (err) {
    console.warn('[describeHoldings] translation failed:', err);
    for (const t of todo) { cache.set(t.symbol, t.en); out[t.symbol] = t.en; }
  }

  return out;
}
