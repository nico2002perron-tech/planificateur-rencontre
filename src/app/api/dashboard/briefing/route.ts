import { NextResponse } from 'next/server';
import { getSectorPerformance } from '@/lib/fmp/client';

let cache: { data: unknown; timestamp: number } = { data: null, timestamp: 0 };
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours

async function callGroq(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 2500,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) throw new Error(`Groq API error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function GET() {
  try {
    const now = Date.now();
    if (cache.data && now - cache.timestamp < CACHE_TTL) {
      return NextResponse.json(cache.data);
    }

    // Fetch market data
    let sectorData: { sector?: string; changesPercentage?: number | string }[] = [];
    try {
      sectorData = await getSectorPerformance() as { sector?: string; changesPercentage?: number | string }[];
    } catch { /* continue without */ }

    const sectorSummary = (Array.isArray(sectorData) ? sectorData : [])
      .map((s) => `${s.sector}: ${s.changesPercentage}%`)
      .join(', ');

    const todayStr = new Date().toLocaleDateString('fr-CA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const prompt = `Tu es un analyste financier senior pour une firme de gestion de patrimoine québécoise (Groupe Financier Ste-Foy). Rédige un briefing matinal pour les conseillers.

Date: ${todayStr}

Performance sectorielle du jour: ${sectorSummary || 'Données non disponibles'}

INSTRUCTIONS:
1. Rédige un briefing de 3-4 paragraphes courts en français québécois professionnel mais accessible.
2. Couvre: tendances macro-économiques, décisions de banques centrales, données économiques clés, mouvements majeurs des marchés.
3. Sois concret et factuel. Explique les CAUSES et CONSÉQUENCES pour les investisseurs canadiens.
4. Termine par une perspective pour la semaine.

Ensuite, génère exactement 5 "faits saillants économiques" — les événements/données économiques les plus importants en ce moment. Chaque fait doit avoir un titre court, un détail explicatif, et un indicateur d'impact.

FORMAT DE RÉPONSE (JSON strict):
{
  "briefing": "Le texte du briefing ici...",
  "highlights": [
    { "title": "Titre court", "detail": "Explication en 1-2 phrases", "impact": "positif" },
    { "title": "Titre court", "detail": "Explication en 1-2 phrases", "impact": "negatif" },
    { "title": "Titre court", "detail": "Explication en 1-2 phrases", "impact": "neutre" }
  ]
}

Les valeurs possibles pour "impact": "positif", "negatif", "neutre"

Réponds UNIQUEMENT avec le JSON, rien d'autre.`;

    const raw = await callGroq(prompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    let parsed = { briefing: '', highlights: [] as { title: string; detail: string; impact: string }[] };

    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        parsed = { briefing: raw.replace(/```json?|```/g, '').trim(), highlights: [] };
      }
    } else {
      parsed = { briefing: raw, highlights: [] };
    }

    const result = {
      briefing: parsed.briefing || 'Briefing en cours de génération...',
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights.slice(0, 5).map(h => ({
        title: h.title || '',
        detail: h.detail || '',
        impact: ['positif', 'negatif', 'neutre'].includes(h.impact) ? h.impact : 'neutre',
      })) : [],
      generatedAt: new Date().toISOString(),
    };

    cache = { data: result, timestamp: now };
    return NextResponse.json(result);
  } catch (error) {
    console.error('Briefing API error:', error);
    if (cache.data) return NextResponse.json(cache.data);
    return NextResponse.json({
      briefing: 'Le briefing est temporairement indisponible. Les marchés continuent de fonctionner normalement.',
      highlights: [],
      generatedAt: new Date().toISOString(),
    });
  }
}
