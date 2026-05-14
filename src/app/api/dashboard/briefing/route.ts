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
      max_tokens: 2000,
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

    // Fetch market data in parallel
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
2. Couvre: tendances des marchés, secteurs en mouvement, ce que ça signifie pour les portefeuilles clients.
3. Sois concret et actionnable. Pas de jargon inutile.
4. Termine par une phrase motivante pour commencer la journée.

Ensuite, génère exactement 4 "points de conversation" — des phrases prêtes à utiliser si un client appelle aujourd'hui. Chaque point doit être naturel, rassurant et professionnel.

FORMAT DE RÉPONSE (JSON strict):
{
  "briefing": "Le texte du briefing ici...",
  "talkingPoints": [
    "Point 1...",
    "Point 2...",
    "Point 3...",
    "Point 4..."
  ]
}

Réponds UNIQUEMENT avec le JSON, rien d'autre.`;

    const raw = await callGroq(prompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    let parsed = { briefing: '', talkingPoints: [] as string[] };

    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        parsed = { briefing: raw.replace(/```json?|```/g, '').trim(), talkingPoints: [] };
      }
    } else {
      parsed = { briefing: raw, talkingPoints: [] };
    }

    const result = {
      briefing: parsed.briefing || 'Briefing en cours de génération...',
      talkingPoints: Array.isArray(parsed.talkingPoints) ? parsed.talkingPoints.slice(0, 4) : [],
      generatedAt: new Date().toISOString(),
    };

    cache = { data: result, timestamp: now };
    return NextResponse.json(result);
  } catch (error) {
    console.error('Briefing API error:', error);
    if (cache.data) return NextResponse.json(cache.data);
    return NextResponse.json({
      briefing: 'Le briefing est temporairement indisponible. Les marchés continuent de fonctionner normalement.',
      talkingPoints: [],
      generatedAt: new Date().toISOString(),
    });
  }
}
