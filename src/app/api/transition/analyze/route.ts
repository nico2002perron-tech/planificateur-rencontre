import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import Groq from 'groq-sdk';

const GROQ_MODEL = 'llama-3.3-70b-versatile';

interface HoldingSummary {
  symbol: string;
  name: string;
  assetType: string;
  weight: number;
  marketValue: number;
  sector?: string;
}

interface ProfileSummary {
  id: string;
  name: string;
  profile_number: number;
  equity_pct: number;
  bond_pct: number;
}

/**
 * POST /api/transition/analyze
 *
 * Body: {
 *   holdings: HoldingSummary[],
 *   allocations: { equityPct, bondPct, cashPct, fundPct, etfPct, preferredPct },
 *   matchedProfile: ProfileSummary,
 *   totalValue: number,
 * }
 *
 * Returns AI commentary on the transition analysis.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY non configure' }, { status: 500 });
  }

  const body = await req.json();
  const { holdings, allocations, matchedProfile, totalValue } = body as {
    holdings: HoldingSummary[];
    allocations: Record<string, number>;
    matchedProfile: ProfileSummary;
    totalValue: number;
  };

  const groq = new Groq({ apiKey });

  const prompt = `Tu es un analyste financier quebecois specialise en gestion discretionnaire de portefeuille.

Un conseiller veut transitionner le portefeuille d'un client vers la gestion discretionnaire.

PORTEFEUILLE ACTUEL (valeur totale: ${new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(totalValue)}):
- Allocation: Actions ${allocations.equityPct?.toFixed(1)}%, Obligations ${allocations.bondPct?.toFixed(1)}%, Liquidites ${allocations.cashPct?.toFixed(1)}%, FNB ${allocations.etfPct?.toFixed(1)}%, Fonds ${allocations.fundPct?.toFixed(1)}%
- Nombre de positions: ${holdings.length}

TOP 15 POSITIONS:
${holdings.slice(0, 15).map(h => `  ${h.symbol} (${h.name}) — ${h.assetType} — ${h.weight.toFixed(1)}%`).join('\n')}

PROFIL MODELE DETECTE: ${matchedProfile.name} (${matchedProfile.equity_pct}% actions / ${matchedProfile.bond_pct}% obligations)

Genere un JSON avec:
{
  "profileAnalysis": "80-120 mots: Explique pourquoi ce profil est le plus adapte au portefeuille actuel du client. Mentionne les allocations actuelles vs cibles.",
  "transitionRisks": "60-100 mots: Identifie les risques de la transition (concentration sectorielle, liquidite, devises, frais de transaction).",
  "recommendations": "80-120 mots: Resume les grandes lignes de la transition: quels types de titres vendre/acheter en priorite, approche graduelle ou immediate.",
  "taxConsiderations": "40-80 mots: Mentionne les considerations fiscales (gains/pertes en capital, report fiscal)."
}

REGLES:
- Reponds uniquement en JSON valide
- Ton neutre et factuel, vocabulaire quebecois (fr-CA)
- N'utilise JAMAIS "vous devriez" ou "je recommande" — utilise "le portefeuille presente", "la transition impliquerait"
- Pas de recommandations directes d'achat/vente de titres specifiques`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const completion = await groq.chat.completions.create(
      {
        model: GROQ_MODEL,
        temperature: 0.3,
        max_tokens: 1500,
        messages: [
          { role: 'system', content: 'Tu es un analyste financier quebecois. Reponds uniquement en JSON valide.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      },
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'Reponse vide de l\'IA' }, { status: 500 });
    }

    const parsed = JSON.parse(content);
    return NextResponse.json({ analysis: parsed });
  } catch (e) {
    console.error('[Transition AI]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur IA' },
      { status: 500 }
    );
  }
}
