import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { askGemini } from '@/lib/ai/gemini-client';

// POST — summarize call notes
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { notes, lead_name, profession } = await req.json();
  if (!notes) return NextResponse.json({ error: 'Notes requises' }, { status: 400 });

  const systemPrompt = `Tu es un assistant CRM pour une firme de gestion de patrimoine. Résume les notes d'appel de manière structurée et concise en français.

Format de réponse:
RÉSUMÉ: (1-2 phrases)
INTÉRÊT: (Élevé / Moyen / Faible / Aucun)
BESOINS: (liste à puces des besoins identifiés)
OBJECTIONS: (liste des objections soulevées)
PROCHAINE ACTION: (action recommandée)
RAPPEL: (quand rappeler, si applicable)`;

  const prompt = `Résume ces notes d'appel:
Lead: ${lead_name || 'Inconnu'} (${profession || 'N/A'})
Notes brutes: ${notes}`;

  try {
    const summary = await askGemini(prompt, systemPrompt);
    return NextResponse.json({ summary });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
