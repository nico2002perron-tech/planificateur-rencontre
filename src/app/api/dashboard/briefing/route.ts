import { NextResponse } from 'next/server';
import { getSectorPerformance } from '@/lib/fmp/client';

let cache: { data: unknown; timestamp: number } = { data: null, timestamp: 0 };
const CACHE_TTL = 2 * 60 * 60 * 1000;

async function callGroq(prompt: string, maxTokens = 3000): Promise<string> {
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
      temperature: 0.5,
      max_tokens: maxTokens,
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

    let sectorData: { sector?: string; changesPercentage?: number | string }[] = [];
    try {
      sectorData = await getSectorPerformance() as { sector?: string; changesPercentage?: number | string }[];
    } catch { /* continue */ }

    const sectorSummary = (Array.isArray(sectorData) ? sectorData : [])
      .map((s) => `${s.sector}: ${s.changesPercentage}%`)
      .join(', ');

    const todayStr = new Date().toLocaleDateString('fr-CA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const prompt = `Tu es le rédacteur en chef du "Journal du Matin" pour les conseillers financiers du Groupe Financier Ste-Foy (Québec). Ton style est professionnel mais chaleureux et accessible — comme un collègue expérimenté qui résume la journée autour d'un café.

Date: ${todayStr}
Performance sectorielle: ${sectorSummary || 'Non disponible'}

GÉNÈRE un briefing complet avec ces sections:

1. "topStories" — Les 3 sujets MAJEURS du jour. Pour chaque sujet:
   - "emoji": un emoji pertinent
   - "headline": titre accrocheur en français (max 60 caractères)
   - "summary": explication en 2-3 phrases. Pourquoi c'est important? Quel impact pour les investisseurs canadiens?
   - "impact": "positif", "negatif", ou "neutre"
   - "tag": un mot-clé court (ex: "Banque centrale", "Emploi", "Technologie", "Géopolitique")

2. "briefing" — Un texte de 4-5 paragraphes qui donne le portrait complet de la journée:
   - Commence par LA nouvelle la plus importante
   - Mentionne les mouvements de marché significatifs
   - Explique ce que ça signifie concrètement pour les portefeuilles
   - Termine avec une note d'encouragement/perspective
   - Utilise des paragraphes courts, aérés, faciles à scanner rapidement
   - Ton: confiant, informatif, rassurant mais réaliste

3. "keyData" — 4 données économiques chiffrées du moment:
   - "label": nom de l'indicateur (ex: "Inflation Canada", "Taux directeur BoC")
   - "value": la valeur actuelle ou récente
   - "trend": "up", "down", ou "stable"
   - "context": explication en 1 phrase

FORMAT JSON STRICT:
{
  "topStories": [
    { "emoji": "📉", "headline": "Titre ici", "summary": "Explication...", "impact": "negatif", "tag": "Inflation" }
  ],
  "briefing": "Le texte complet du briefing...",
  "keyData": [
    { "label": "Inflation Canada", "value": "2.7%", "trend": "down", "context": "En baisse..." }
  ]
}

Réponds UNIQUEMENT avec le JSON.`;

    const raw = await callGroq(prompt, 4000);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);

    interface TopStory {
      emoji: string;
      headline: string;
      summary: string;
      impact: string;
      tag: string;
    }
    interface KeyData {
      label: string;
      value: string;
      trend: string;
      context: string;
    }
    interface ParsedBriefing {
      topStories: TopStory[];
      briefing: string;
      keyData: KeyData[];
    }

    let parsed: ParsedBriefing = { topStories: [], briefing: '', keyData: [] };

    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        parsed = { topStories: [], briefing: raw.replace(/```json?|```/g, '').trim(), keyData: [] };
      }
    } else {
      parsed = { topStories: [], briefing: raw, keyData: [] };
    }

    const result = {
      topStories: Array.isArray(parsed.topStories) ? parsed.topStories.slice(0, 3).map(s => ({
        emoji: s.emoji || '📰',
        headline: s.headline || '',
        summary: s.summary || '',
        impact: ['positif', 'negatif', 'neutre'].includes(s.impact) ? s.impact : 'neutre',
        tag: s.tag || '',
      })) : [],
      briefing: parsed.briefing || 'Briefing en cours de génération...',
      keyData: Array.isArray(parsed.keyData) ? parsed.keyData.slice(0, 4).map(d => ({
        label: d.label || '',
        value: d.value || '',
        trend: ['up', 'down', 'stable'].includes(d.trend) ? d.trend : 'stable',
        context: d.context || '',
      })) : [],
      generatedAt: new Date().toISOString(),
    };

    cache = { data: result, timestamp: now };
    return NextResponse.json(result);
  } catch (error) {
    console.error('Briefing API error:', error);
    if (cache.data) return NextResponse.json(cache.data);
    return NextResponse.json({
      topStories: [],
      briefing: 'Le briefing est temporairement indisponible.',
      keyData: [],
      generatedAt: new Date().toISOString(),
    });
  }
}
