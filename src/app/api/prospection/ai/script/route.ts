import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { askGemini } from '@/lib/ai/gemini-client';

// POST — generate a call script for a lead
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const advisorName = session.user.name || 'Conseiller';
  const { lead } = await req.json();

  if (!lead) return NextResponse.json({ error: 'Lead requis' }, { status: 400 });

  const systemPrompt = `Tu es un expert en prospection téléphonique pour une firme de gestion de patrimoine au Québec (Groupe Financier Ste-Foy / IA Private Wealth).

Génère un script d'appel naturel et professionnel en français québécois. Le script doit:
- Être conversationnel, pas robotique
- Avoir une accroche personnalisée selon la profession du lead
- Mentionner un bénéfice concret (optimisation fiscale, planification de retraite, gestion corporative)
- Inclure une question ouverte pour engager la conversation
- Prévoir 2-3 réponses aux objections courantes
- Durer environ 30 secondes de lecture

Format:
ACCROCHE: (la première phrase)
CORPS: (le pitch principal)
QUESTION: (la question ouverte)
OBJECTIONS:
- Si "pas intéressé": ...
- Si "j'ai déjà un conseiller": ...
- Si "pas le temps": ...`;

  const prompt = `Génère un script d'appel pour:
- Conseiller: ${advisorName}
- Lead: ${lead.name}
- Profession: ${lead.profession}
- Entreprise: ${lead.business_name || 'N/A'}
- Ville: ${lead.city}
- Score: ${lead.score || 'N/A'}/10
- Contexte: ${lead.score_reason || 'Nouveau lead'}`;

  try {
    const script = await askGemini(prompt, systemPrompt);
    return NextResponse.json({ script });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
