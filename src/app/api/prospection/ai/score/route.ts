import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import { askGeminiJSON } from '@/lib/ai/gemini-client';

interface ScoreResult {
  scores: { id: string; score: number; reason: string }[];
}

// POST — score leads using Gemini AI
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { lead_ids } = await req.json();
  const supabase = createClient();

  // Fetch leads to score
  let query = supabase.from('leads').select('id, name, business_name, profession, city, source').is('score', null);

  if (lead_ids?.length) {
    query = query.in('id', lead_ids);
  }

  const { data: leads, error } = await query.limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!leads?.length) return NextResponse.json({ message: 'Aucun lead à scorer', scored: 0 });

  const leadsDesc = leads
    .map((l) => `- ID: ${l.id} | ${l.name} | ${l.profession} | ${l.city} | Source: ${l.source}${l.business_name ? ` | Entreprise: ${l.business_name}` : ''}`)
    .join('\n');

  const systemPrompt = `Tu es un analyste en développement des affaires pour une firme de gestion de patrimoine au Québec (IA Private Wealth). Tu évalues des leads potentiels pour de la prospection téléphonique.

Critères de scoring (1-10):
- Profession à haut revenu (dentiste, médecin, avocat, CPA) = +3
- Professionnel incorporé = +2
- Ville proche de notre zone (Québec, Lévis) = +1
- Nouvelle entreprise = +2
- Entrepreneur/propriétaire = +1

Réponds en JSON avec un tableau "scores" contenant pour chaque lead: id, score (1-10), reason (1 phrase en français).`;

  try {
    const result = await askGeminiJSON<ScoreResult>(
      `Évalue ces leads:\n${leadsDesc}`,
      systemPrompt
    );

    let scored = 0;
    for (const s of result.scores) {
      const { error: updateErr } = await supabase
        .from('leads')
        .update({ score: s.score, score_reason: s.reason })
        .eq('id', s.id);
      if (!updateErr) scored++;
    }

    return NextResponse.json({ message: `${scored} leads scorés`, scored });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
