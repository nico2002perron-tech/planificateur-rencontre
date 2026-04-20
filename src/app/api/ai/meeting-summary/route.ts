import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import Groq from 'groq-sdk';

const GROQ_MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `Tu es un assistant pour un conseiller en gestion de patrimoine chez iA Gestion Privée de Patrimoine au Québec.

On te donne la transcription d'une rencontre client. Tu dois générer DEUX résumés:

1. **advisor_summary** — Notes pour Croesus (système interne du conseiller):
   - Format concis, factuel, en points
   - Inclure: sujets discutés, décisions prises, transactions à faire, suivis requis
   - Style professionnel, pas de formules de politesse
   - Maximum 300 mots

2. **client_summary** — Récapitulatif pour le client:
   - Format professionnel mais chaleureux
   - Résumer ce qui a été discuté et décidé
   - Rappeler les prochaines étapes
   - Terminer avec une note de disponibilité
   - Maximum 250 mots

3. **action_items** — Liste des actions à suivre (array de strings)

4. **topics_discussed** — Liste des sujets abordés (array de strings)

5. **decisions** — Liste des décisions prises (array de strings)

Retourne un JSON strict:
{
  "advisor_summary": "...",
  "client_summary": "...",
  "action_items": ["..."],
  "topics_discussed": ["..."],
  "decisions": ["..."]
}`;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Groq API key not configured' }, { status: 500 });
  }

  try {
    const { transcription, manualNotes } = await req.json();

    let content = '';
    if (transcription) content += `TRANSCRIPTION DE LA RENCONTRE:\n${transcription}\n\n`;
    if (manualNotes) content += `NOTES MANUELLES DU CONSEILLER:\n${manualNotes}\n\n`;

    if (!content.trim()) {
      return NextResponse.json({ error: 'No content to summarize' }, { status: 400 });
    }

    const groq = new Groq({ apiKey });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const completion = await groq.chat.completions.create(
      {
        model: GROQ_MODEL,
        temperature: 0.2,
        max_tokens: 2000,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content },
        ],
        response_format: { type: 'json_object' },
      },
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    const raw = completion.choices?.[0]?.message?.content;
    if (!raw) return NextResponse.json({ error: 'No response from AI' }, { status: 500 });

    const parsed = JSON.parse(raw);
    return NextResponse.json(parsed);
  } catch (err) {
    console.warn('[AI meeting-summary] Failed:', err);
    return NextResponse.json({ error: 'AI summary failed' }, { status: 500 });
  }
}
