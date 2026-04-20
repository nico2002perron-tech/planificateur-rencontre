import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import Groq from 'groq-sdk';

const GROQ_MODEL = 'llama-3.3-70b-versatile';

const COMPLIANCE_LABELS: Record<string, string> = {
  q_objectifs: 'Les objectifs de placement ont-ils été discutés?',
  q_horizon: "L'horizon de placement a-t-il été discuté?",
  q_tolerance: 'La tolérance au risque a-t-elle été discutée?',
  q_situation: 'La situation financière a-t-elle été discutée?',
  q_liquidite: 'Les besoins en liquidité ont-ils été discutés?',
  q_recommande: 'Le titre a-t-il été recommandé par le conseiller?',
  q_risques: 'Le client a-t-il été informé des risques?',
  q_comprend: 'Le client comprend-il la nature du placement?',
  q_conforme: "Le placement est-il conforme au profil d'investisseur?",
  q_conflit: "Y a-t-il un conflit d'intérêts potentiel?",
  q_repartition: "La répartition d'actifs a-t-elle été revue?",
  q_non_conforme: 'Les placements non conformes ont-ils été identifiés?',
  q_concentration: 'La concentration a-t-elle été vérifiée?',
  q_rendements: 'Les rendements ont-ils été discutés avec le client?',
  q_frais: 'Les frais ont-ils été discutés?',
  q_changements: 'Les changements de situation personnelle ont-ils été vérifiés?',
};

const SUBJECT_LABELS: Record<string, string> = {
  revision: 'Révision du portefeuille',
  placement: 'Placement',
  both: 'Révision + Placement',
};

const MEETING_TYPE_LABELS: Record<string, string> = {
  phone: 'Téléphone',
  in_person: 'En personne',
  video: 'Vidéoconférence',
};

const SYSTEM_PROMPT = `Tu es un assistant pour un conseiller en gestion de patrimoine chez iA Gestion Privée de Patrimoine au Québec.

On te donne les informations d'une rencontre client (contexte, réponses de conformité, transactions, notes manuelles, et/ou transcription audio). Tu dois générer:

1. **advisor_summary** — Notes pour Croesus (système interne du conseiller):
   - Format concis, factuel, en points avec tirets
   - Inclure: sujets discutés, décisions prises, transactions à effectuer, suivis requis
   - Mentionner les éléments de conformité couverts
   - Si des transactions sont listées, les inclure avec détails (symbole, quantité, type)
   - Style professionnel, pas de formules de politesse
   - Maximum 300 mots

2. **client_summary** — Récapitulatif pour le client:
   - Format professionnel mais chaleureux, vouvoiement
   - Résumer ce qui a été discuté et décidé
   - Si des transactions sont prévues, les mentionner de façon claire
   - Rappeler les prochaines étapes
   - Terminer avec une note de disponibilité du conseiller
   - Maximum 250 mots

3. **action_items** — Liste des actions à suivre (array de strings)

4. **topics_discussed** — Liste des sujets abordés (array de strings)

5. **decisions** — Liste des décisions prises (array de strings)

IMPORTANT: Si tu ne reçois pas de transcription mais seulement des réponses de conformité et du contexte,
génère quand même un résumé professionnel complet en te basant sur les informations disponibles.
Déduis les sujets discutés à partir des questions de conformité répondues par "Oui".
Les questions répondues "Non" peuvent indiquer des points à aborder lors d'une prochaine rencontre.

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
    const { transcription, manualNotes, complianceAnswers, meetingContext } = await req.json();

    let content = '';

    // Meeting context
    if (meetingContext) {
      content += `CONTEXTE DE LA RENCONTRE:\n`;
      if (meetingContext.clientName) content += `Client: ${meetingContext.clientName}\n`;
      if (meetingContext.meetingDate) content += `Date: ${meetingContext.meetingDate}\n`;
      if (meetingContext.meetingType) content += `Type: ${MEETING_TYPE_LABELS[meetingContext.meetingType] || meetingContext.meetingType}\n`;
      if (meetingContext.subject) content += `Sujet: ${SUBJECT_LABELS[meetingContext.subject] || meetingContext.subject}\n`;
      content += '\n';
    }

    // Compliance answers
    if (complianceAnswers && Object.keys(complianceAnswers).length > 0) {
      content += `RÉPONSES DE CONFORMITÉ:\n`;
      for (const [key, value] of Object.entries(complianceAnswers)) {
        if (!value) continue;
        const label = COMPLIANCE_LABELS[key] || key;
        const display = value === 'oui' ? 'Oui' : value === 'non' ? 'Non' : 'N/A';
        content += `- ${label} → ${display}\n`;
      }
      content += '\n';
    }

    // Transactions
    if (meetingContext?.transactions?.length > 0) {
      content += `TRANSACTIONS PRÉVUES:\n`;
      for (const tx of meetingContext.transactions) {
        const typeLabel = tx.type === 'buy' ? 'Achat' : tx.type === 'sell' ? 'Vente' : 'Échange';
        let line = `- ${typeLabel}`;
        if (tx.symbol) line += `: ${tx.symbol}`;
        if (tx.quantity) line += `, ${tx.quantity} actions`;
        if (tx.price) line += ` à ${tx.price}$`;
        line += tx.solicited ? ' (sollicité)' : ' (non sollicité)';
        content += line + '\n';
      }
      content += '\n';
    }

    // Transcription
    if (transcription) content += `TRANSCRIPTION DE LA RENCONTRE:\n${transcription}\n\n`;

    // Manual notes
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
        max_tokens: 2500,
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
