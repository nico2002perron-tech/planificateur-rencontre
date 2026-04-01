import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import Groq from 'groq-sdk';

const GROQ_MODEL = 'llama-3.3-70b-versatile';

/**
 * POST /api/models/email
 *
 * Body: {
 *   profileName: string,
 *   profileNumber: number,
 *   nbStocks: number,
 *   portfolioScores: { overall, health, growth, valuation, sector },
 *   distribution: { excellent, good, average, weak },
 *   stocks: ScoredStock[],
 *   clientName?: string,
 *   tone?: 'formel' | 'semi-formel' | 'decontracte',
 * }
 *
 * Genere un email professionnel resume du scoring via Groq.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY non configure' }, { status: 500 });
  }

  const body = await req.json();
  const {
    profileName, profileNumber, nbStocks,
    portfolioScores, distribution, stocks,
    clientName = 'Client',
    tone = 'semi-formel',
  } = body;

  if (!portfolioScores || !stocks) {
    return NextResponse.json({ error: 'Donnees de scoring requises' }, { status: 400 });
  }

  // Top 5 et bottom 3 titres
  const top5 = stocks.slice(0, 5).map((s: { symbol: string; name: string; scores: { overall: number } }) => ({
    symbol: s.symbol, name: s.name, score: s.scores.overall,
  }));
  const bottom3 = stocks.slice(-3).map((s: { symbol: string; name: string; scores: { overall: number } }) => ({
    symbol: s.symbol, name: s.name, score: s.scores.overall,
  }));

  const toneInstruction = tone === 'formel'
    ? 'Utilise un ton tres formel et professionnel (vouvoiement strict).'
    : tone === 'decontracte'
      ? 'Utilise un ton amical mais professionnel (tutoiement acceptable).'
      : 'Utilise un ton professionnel mais chaleureux (vouvoiement, mais accessible).';

  const systemPrompt = `Tu es un conseiller financier senior du Groupe Financier Ste-Foy qui redige des emails professionnels pour ses clients.

REGLES STRICTES:
- Redige en francais canadien (fr-CA) professionnel
- NE DONNE JAMAIS de conseils d'investissement directs
- Utilise des formulations neutres: "le portefeuille presente", "les donnees suggerent"
- Sois factuel et base sur les donnees fournies
- Ne mentionne jamais que tu es une IA
- ${toneInstruction}
- L'email doit etre pret a envoyer, avec objet, salutation, corps, et signature
- Garde un format clair avec des paragraphes courts`;

  const userPrompt = `Redige un email de suivi pour un client a propos de son portefeuille modele.

DESTINATAIRE: ${clientName}
PORTEFEUILLE: Profil ${profileNumber} — ${profileName}
NOMBRE DE TITRES: ${nbStocks}

SCORES DU PORTEFEUILLE (sur 10):
- Global: ${portfolioScores.overall}
- Sante financiere: ${portfolioScores.health}
- Croissance: ${portfolioScores.growth}
- Valorisation: ${portfolioScores.valuation}
- Qualite sectorielle: ${portfolioScores.sector}

DISTRIBUTION:
- Titres excellents (8+): ${distribution.excellent}
- Titres bons (6-8): ${distribution.good}
- Titres moyens (4-6): ${distribution.average}
- Titres faibles (<4): ${distribution.weak}

TOP 5 TITRES:
${top5.map((t: { symbol: string; name: string; score: number }) => `- ${t.symbol} (${t.name}): ${t.score}/10`).join('\n')}

TITRES LES PLUS FAIBLES:
${bottom3.map((t: { symbol: string; name: string; score: number }) => `- ${t.symbol} (${t.name}): ${t.score}/10`).join('\n')}

Reponds en JSON valide avec ce schema:
{
  "subject": "string — Objet de l'email (court et professionnel)",
  "body": "string — Corps complet de l'email avec salutation et signature. Utilise des retours a la ligne (\\n) pour formater."
}`;

  try {
    const groq = new Groq({ apiKey });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const completion = await groq.chat.completions.create(
      {
        model: GROQ_MODEL,
        temperature: 0.4,
        max_tokens: 1500,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      },
      { signal: controller.signal },
    );

    clearTimeout(timeout);

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'Reponse vide de Groq' }, { status: 500 });
    }

    let parsed: { subject: string; body: string };
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: 'Reponse Groq invalide (JSON malformé)' }, { status: 500 });
    }

    if (!parsed.subject || !parsed.body) {
      return NextResponse.json({ error: 'Reponse Groq incomplete' }, { status: 500 });
    }

    return NextResponse.json({
      subject: parsed.subject,
      body: parsed.body,
      profileName,
      profileNumber,
    });
  } catch (err) {
    console.error('[Email AI] Groq generation failed:', err);
    return NextResponse.json({ error: 'Erreur lors de la generation IA' }, { status: 500 });
  }
}
