import 'server-only';
import Groq from 'groq-sdk';

/**
 * Generate a short FRENCH one-line description of each equity/ETF holding for
 * the "Descriptions des titres" PDF section. Grounded on the Yahoo English
 * business summary when available, otherwise written from the name/symbol.
 * One batched Groq call, cached by symbol, best-effort (failures → no entry).
 */

const GROQ_MODEL = 'llama-3.3-70b-versatile';

export interface DescribeInput {
  symbol: string;
  name: string;
  sector?: string;
  summary?: string | null; // English business summary (optional grounding)
}

const cache = new Map<string, string>();

const SYSTEM_PROMPT = `Tu es analyste financier québécois. Pour CHAQUE titre fourni, rédige UNE seule phrase courte en FRANÇAIS (maximum ~140 caractères) décrivant l'activité de l'entreprise ou la nature du titre.

Règles:
- Français professionnel, clair, neutre. Pas de prix, pas de recommandation, pas de "Ce titre".
- Va droit au but: secteur d'activité et ce que fait l'entreprise.
- Si un résumé anglais (EN:) est fourni, traduis/condense-le. Sinon, base-toi sur ton savoir du titre.
- Ne répète pas inutilement le nom complet.

Réponds en JSON strict:
{ "descriptions": [ { "symbol": "AAPL", "fr": "Conçoit et vend des appareils électroniques grand public et des services numériques." } ] }`;

export async function describeHoldings(items: DescribeInput[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const todo: DescribeInput[] = [];
  for (const it of items) {
    if (!it.symbol) continue;
    if (cache.has(it.symbol)) out[it.symbol] = cache.get(it.symbol)!;
    else todo.push(it);
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || todo.length === 0) return out;

  try {
    const list = todo
      .map((it) => {
        let s = `${it.symbol} | ${it.name}`;
        if (it.sector) s += ` | secteur: ${it.sector}`;
        if (it.summary) s += ` | EN: ${it.summary.slice(0, 400)}`;
        return s;
      })
      .join('\n');

    const groq = new Groq({ apiKey });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    const completion = await groq.chat.completions.create(
      {
        model: GROQ_MODEL,
        temperature: 0.2,
        max_tokens: 3000,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Titres à décrire:\n${list}` },
        ],
        response_format: { type: 'json_object' },
      },
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    const content = completion.choices?.[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content) as { descriptions?: { symbol: string; fr: string }[] };
      for (const d of parsed.descriptions || []) {
        if (d?.symbol && d?.fr && d.fr.trim()) {
          const fr = d.fr.trim();
          cache.set(d.symbol, fr);
          out[d.symbol] = fr;
        }
      }
    }
  } catch (err) {
    console.warn('[describeHoldings] Failed:', err);
  }

  return out;
}
